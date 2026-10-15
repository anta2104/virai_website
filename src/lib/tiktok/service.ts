/**
 * Vòng đời một lần phân tích kênh: tạo bản ghi → chạy nền → đọc kết quả.
 *
 * Trình tự chạy nền: queued → fetching (gọi provider) → analyzing (gọi LLM)
 * → done | failed. Trang kết quả poll trạng thái rồi đọc từ D1, không gọi
 * provider lần nữa.
 */
import { and, desc, eq, gt, inArray, isNotNull, ne } from 'drizzle-orm';
import { getDb } from '../db';
import {
  creatorAnalyses,
  creators,
  videoSnapshots,
  videos,
  type Creator,
  type CreatorAnalysis,
  type Video,
} from '../db/schema';
import { newId } from '../ids';
import { env } from '../env';
import { analyzeCreator, type AnalysisResult } from './analyze';
import { computeMetrics, type CreatorMetrics } from './metrics';
import { type CreatorProfile, type VideoData } from './provider';
import { pickProvider } from './pick-provider';

/** Số video gần nhất kéo về mỗi lần. */
export const VIDEO_LIMIT = 30;

/** Phân tích xong trong khoảng này thì mở lại, không kéo dữ liệu mới. */
const REUSE_WINDOW_S = 12 * 3600;

export const STATUS_LABEL: Record<string, string> = {
  queued: 'Đang xếp hàng',
  fetching: 'Đang kéo dữ liệu video',
  analyzing: 'AI đang phân tích',
  done: 'Hoàn tất',
  failed: 'Thất bại',
};

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Tạo phân tích mới cho người dùng, hoặc tái dùng bản đã xong trong 12 giờ.
 *
 * Bản xong của người khác thì sao chép kết quả sang bản ghi mới của người này:
 * tiết kiệm phí provider mà vẫn giữ mỗi người chỉ thấy phân tích của mình.
 */
export async function createAnalysis(input: {
  userId: string;
  handle: string;
}): Promise<{ analysis: CreatorAnalysis; reused: boolean }> {
  const db = getDb(env.DB);
  const since = now() - REUSE_WINDOW_S;
  const providerName = (await pickProvider()).name;

  const recent = await db
    .select()
    .from(creatorAnalyses)
    .where(
      and(
        eq(creatorAnalyses.handle, input.handle),
        eq(creatorAnalyses.status, 'done'),
        // Chỉ tái dùng bản cùng nguồn: vừa bật dữ liệu thật thì không được
        // trả lại bản số giả còn trong 12 giờ
        eq(creatorAnalyses.provider, providerName),
        // Bản thiếu phần AI (lúc Workers AI lỗi) không được tái dùng, để lần
        // gửi lại có cơ hội chạy LLM
        isNotNull(creatorAnalyses.resultJson),
        gt(creatorAnalyses.finishedAt, since),
      ),
    )
    .orderBy(desc(creatorAnalyses.finishedAt))
    .limit(1);

  const source = recent[0];
  if (source && source.userId === input.userId) {
    return { analysis: source, reused: true };
  }

  const analysis: CreatorAnalysis = {
    id: newId(),
    userId: input.userId,
    handle: input.handle,
    creatorId: source?.creatorId ?? null,
    status: source ? 'done' : 'queued',
    provider: providerName,
    inputHash: source?.inputHash ?? null,
    metricsJson: source?.metricsJson ?? null,
    resultJson: source?.resultJson ?? null,
    error: null,
    createdAt: now(),
    finishedAt: source ? now() : null,
  };
  await db.insert(creatorAnalyses).values(analysis);
  return { analysis, reused: Boolean(source) };
}

async function setStatus(id: string, status: string, extra: Partial<CreatorAnalysis> = {}): Promise<void> {
  await getDb(env.DB)
    .update(creatorAnalyses)
    .set({ status, ...extra })
    .where(eq(creatorAnalyses.id, id));
}

/** Ghi hoặc cập nhật kênh, trả về bản ghi đã lưu. */
async function upsertCreator(handle: string, profile: CreatorProfile | null): Promise<Creator> {
  const db = getDb(env.DB);
  const existing = await db
    .select()
    .from(creators)
    .where(and(eq(creators.platform, 'tiktok'), eq(creators.handle, handle)))
    .limit(1);

  const fields = {
    displayName: profile?.displayName ?? existing[0]?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? existing[0]?.avatarUrl ?? null,
    bio: profile?.bio ?? existing[0]?.bio ?? null,
    followers: profile?.followers ?? existing[0]?.followers ?? 0,
    following: profile?.following ?? existing[0]?.following ?? 0,
    likesTotal: profile?.likesTotal ?? existing[0]?.likesTotal ?? 0,
    videoCount: profile?.videoCount ?? existing[0]?.videoCount ?? 0,
    fetchedAt: now(),
  };

  if (existing[0]) {
    await db.update(creators).set(fields).where(eq(creators.id, existing[0].id));
    return { ...existing[0], ...fields };
  }

  const creator: Creator = { id: newId(), platform: 'tiktok', handle, createdAt: now(), ...fields };
  await db.insert(creators).values(creator);
  return creator;
}

/** Ghi video mới, cập nhật video cũ, và chụp một snapshot số liệu cho từng video. */
async function upsertVideos(creatorId: string, list: VideoData[]): Promise<void> {
  if (list.length === 0) return;
  const db = getDb(env.DB);
  const existing = await db.select().from(videos).where(eq(videos.creatorId, creatorId));
  const byTiktokId = new Map(existing.map((v) => [v.tiktokId, v]));
  const capturedAt = now();

  const statements = [];
  for (const item of list) {
    const found = byTiktokId.get(item.tiktokId);
    const fields = {
      url: item.url,
      caption: item.caption,
      durationS: item.durationS,
      postedAt: item.postedAt,
      musicTitle: item.musicTitle,
      hashtagsJson: JSON.stringify(item.hashtags),
      coverUrl: item.coverUrl,
    };
    const videoId = found?.id ?? newId();

    if (found) {
      statements.push(db.update(videos).set(fields).where(eq(videos.id, found.id)));
    } else {
      const row: Video = { id: videoId, creatorId, tiktokId: item.tiktokId, createdAt: capturedAt, ...fields };
      statements.push(db.insert(videos).values(row));
    }
    statements.push(
      db.insert(videoSnapshots).values({
        id: newId(),
        videoId,
        capturedAt,
        views: item.views,
        likes: item.likes,
        comments: item.comments,
        shares: item.shares,
        saves: item.saves,
      }),
    );
  }

  // D1 batch chạy trong một round-trip và là một transaction
  await db.batch(statements as [typeof statements[0], ...typeof statements]);
}

/** Tìm phân tích đã xong của cùng kênh với cùng dữ liệu đầu vào, để khỏi gọi LLM lại. */
async function findSameInput(creatorId: string, inputHash: string, excludeId: string): Promise<string | null> {
  const rows = await getDb(env.DB)
    .select({ resultJson: creatorAnalyses.resultJson })
    .from(creatorAnalyses)
    .where(
      and(
        eq(creatorAnalyses.creatorId, creatorId),
        eq(creatorAnalyses.inputHash, inputHash),
        eq(creatorAnalyses.status, 'done'),
        isNotNull(creatorAnalyses.resultJson),
        ne(creatorAnalyses.id, excludeId),
      ),
    )
    .orderBy(desc(creatorAnalyses.finishedAt))
    .limit(1);
  return rows[0]?.resultJson ?? null;
}

/**
 * Chạy nền sau khi API đã trả về id. Mọi lỗi đều được nuốt và ghi vào bản ghi
 * để trang kết quả hiện được lý do, không để waitUntil ném lỗi âm thầm.
 */
export async function runAnalysis(id: string): Promise<void> {
  const db = getDb(env.DB);
  const rows = await db.select().from(creatorAnalyses).where(eq(creatorAnalyses.id, id)).limit(1);
  const analysis = rows[0];
  if (!analysis || analysis.status !== 'queued') return;

  try {
    await setStatus(id, 'fetching');
    const provider = await pickProvider();
    const [profile, list] = await Promise.all([
      provider.fetchProfile(analysis.handle),
      provider.fetchVideos(analysis.handle, VIDEO_LIMIT),
    ]);

    if (list.length === 0) {
      await setStatus(id, 'failed', {
        error: 'Không lấy được video nào. Kênh có thể riêng tư, không tồn tại, hoặc nguồn dữ liệu đang lỗi.',
        finishedAt: now(),
      });
      return;
    }

    const creator = await upsertCreator(analysis.handle, profile);
    await upsertVideos(creator.id, list);

    const metrics = computeMetrics(list);
    const inputHash = await sha256(JSON.stringify({ metrics, captions: list.map((v) => v.caption) }));

    await setStatus(id, 'analyzing', {
      creatorId: creator.id,
      provider: provider.name,
      metricsJson: JSON.stringify(metrics),
      inputHash,
    });

    let resultJson = await findSameInput(creator.id, inputHash, id);
    let aiError: string | null = null;
    if (!resultJson) {
      const outcome = await analyzeCreator(env.AI, { handle: analysis.handle, profile, metrics, videos: list });
      resultJson = outcome.result ? JSON.stringify(outcome.result) : null;
      // Phần AI hỏng thì vẫn 'done' (có số liệu), nhưng ghi lý do để soi được
      // qua endpoint status mà không cần đọc log Worker
      if (!resultJson) aiError = `AI: ${outcome.failures.join(' | ')}`.slice(0, 900);
    }

    await setStatus(id, 'done', { resultJson, error: aiError, finishedAt: now() });
  } catch (error) {
    console.error(`[tiktok] Phân tích ${id} thất bại:`, error);
    await setStatus(id, 'failed', {
      error: error instanceof Error ? error.message.slice(0, 500) : 'Lỗi không xác định',
      finishedAt: now(),
    });
  }
}

export async function getOwnedAnalysis(id: string, userId: string): Promise<CreatorAnalysis | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(creatorAnalyses)
    .where(and(eq(creatorAnalyses.id, id), eq(creatorAnalyses.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAnalysesOfUser(userId: string, limit = 10): Promise<CreatorAnalysis[]> {
  return getDb(env.DB)
    .select()
    .from(creatorAnalyses)
    .where(eq(creatorAnalyses.userId, userId))
    .orderBy(desc(creatorAnalyses.createdAt))
    .limit(limit);
}

export async function getCreator(id: string): Promise<Creator | null> {
  const rows = await getDb(env.DB).select().from(creators).where(eq(creators.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Video của kênh kèm snapshot mới nhất, mới đăng xếp trước. */
export async function listCreatorVideos(creatorId: string): Promise<VideoData[]> {
  const db = getDb(env.DB);
  const rows = await db.select().from(videos).where(eq(videos.creatorId, creatorId)).orderBy(desc(videos.postedAt));
  if (rows.length === 0) return [];

  // Một truy vấn cho mọi snapshot, giữ bản mới nhất của từng video — không
  // chạy 30 truy vấn nối tiếp mỗi lần mở trang.
  const snapshots = await db
    .select()
    .from(videoSnapshots)
    .where(inArray(videoSnapshots.videoId, rows.map((row) => row.id)))
    .orderBy(desc(videoSnapshots.capturedAt));
  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latest.has(snapshot.videoId)) latest.set(snapshot.videoId, snapshot);
  }

  const out: VideoData[] = [];
  for (const row of rows) {
    const s = latest.get(row.id);
    out.push({
      tiktokId: row.tiktokId,
      url: row.url,
      caption: row.caption,
      durationS: row.durationS,
      postedAt: row.postedAt,
      musicTitle: row.musicTitle,
      hashtags: parseJson<string[]>(row.hashtagsJson) ?? [],
      coverUrl: row.coverUrl,
      views: s?.views ?? 0,
      likes: s?.likes ?? 0,
      comments: s?.comments ?? 0,
      shares: s?.shares ?? 0,
      saves: s?.saves ?? 0,
    });
  }
  return out;
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function metricsOf(analysis: CreatorAnalysis): CreatorMetrics | null {
  return parseJson<CreatorMetrics>(analysis.metricsJson);
}

export function resultOf(analysis: CreatorAnalysis): AnalysisResult | null {
  return parseJson<AnalysisResult>(analysis.resultJson);
}
