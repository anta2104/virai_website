/**
 * Vòng đời một lần phân tích kênh: tạo bản ghi → chạy nền → đọc kết quả.
 *
 * Trình tự chạy nền: queued → fetching (gọi provider) → analyzing (gọi LLM)
 * → done | failed. Trang kết quả poll trạng thái rồi đọc từ D1, không gọi
 * provider lần nữa.
 */
import { and, desc, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm';
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
import { refund } from '../credits';
import { computeInsights } from './insights';
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

/** Bản phân tích `done` cùng nguồn của handle này trong 12 giờ qua, nếu có. */
export async function findReusable(handle: string, providerName: string): Promise<CreatorAnalysis | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(creatorAnalyses)
    .where(
      and(
        eq(creatorAnalyses.handle, handle),
        eq(creatorAnalyses.status, 'done'),
        // Chỉ tái dùng bản cùng nguồn: vừa bật dữ liệu thật thì không được
        // trả lại bản số giả còn trong 12 giờ
        eq(creatorAnalyses.provider, providerName),
        // Bản thiếu phần AI (lúc Workers AI lỗi) không được tái dùng
        isNotNull(creatorAnalyses.resultJson),
        gt(creatorAnalyses.finishedAt, now() - REUSE_WINDOW_S),
      ),
    )
    .orderBy(desc(creatorAnalyses.finishedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Số lần phân tích bằng dữ liệu thật tính vào hạn mức miễn phí của tài khoản:
 * do chính người này tạo, không phải bản sao chép, không phải demo, không thất bại.
 */
export async function countBillableAnalyses(userId: string): Promise<number> {
  const rows = await getDb(env.DB)
    .select({ n: sql<number>`count(*)` })
    .from(creatorAnalyses)
    .where(
      and(
        eq(creatorAnalyses.userId, userId),
        eq(creatorAnalyses.reused, 0),
        ne(creatorAnalyses.provider, 'mock'),
        ne(creatorAnalyses.status, 'failed'),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Tạo bản ghi phân tích. Tái dùng bản `done` cùng nguồn trong 12 giờ nếu có;
 * của chính mình thì trả lại luôn, của người khác thì sao chép (không tốn lượt).
 * `costCredits` do API quyết định và trừ tín chỉ trước khi gọi vào đây.
 */
export async function createAnalysis(input: {
  userId: string;
  handle: string;
  providerName: string;
  costCredits?: number;
  /** true = không tái dùng bản 12 giờ, kéo dữ liệu mới */
  force?: boolean;
}): Promise<{ analysis: CreatorAnalysis; reused: boolean }> {
  const db = getDb(env.DB);
  const source = input.force ? null : await findReusable(input.handle, input.providerName);
  if (source && source.userId === input.userId) {
    return { analysis: source, reused: true };
  }

  const analysis: CreatorAnalysis = {
    id: newId(),
    userId: input.userId,
    handle: input.handle,
    creatorId: source?.creatorId ?? null,
    status: source ? 'done' : 'queued',
    provider: input.providerName,
    inputHash: source?.inputHash ?? null,
    metricsJson: source?.metricsJson ?? null,
    resultJson: source?.resultJson ?? null,
    error: null,
    createdAt: now(),
    finishedAt: source ? now() : null,
    costCredits: source ? 0 : (input.costCredits ?? 0),
    reused: source ? 1 : 0,
    providerJobId: null,
    stepAt: null,
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
/**
 * Ghi hoặc cập nhật kênh. Kênh demo lưu `platform = 'mock'` để video giả không
 * bao giờ lẫn vào kênh thật cùng handle (đã xảy ra 15/10/2026: bảng video của
 * @dieulinh_hg hiện 60 video, một nửa là số giả).
 */
async function upsertCreator(handle: string, profile: CreatorProfile | null, providerName: string): Promise<Creator> {
  const db = getDb(env.DB);
  const platform = providerName === 'mock' ? 'mock' : 'tiktok';
  const existing = await db
    .select()
    .from(creators)
    .where(and(eq(creators.platform, platform), eq(creators.handle, handle)))
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

  const creator: Creator = { id: newId(), platform, handle, createdAt: now(), ...fields };
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

/** Khoá bước quá hạn này (giây) thì coi như tiến trình trước đã chết. */
const STEP_LOCK_S = 90;

/**
 * Làm tiếp MỘT bước của phân tích rồi trả về. Gọi nhiều lần cho tới khi xong.
 *
 * Vì sao chia bước: Worker chỉ cho tác vụ nền chạy khoảng 30 giây sau khi trả
 * response, kênh lớn kéo lâu hơn thế là kẹt mãi ở "fetching" (đã gặp 15/10/2026
 * với @tiktok). Giờ trang kết quả hỏi trạng thái mỗi 3 giây, mỗi lần hỏi là
 * máy chủ làm thêm một bước ngay trong request đó, không cần tác vụ nền.
 *
 * Các bước: queued → fetching (đã gửi yêu cầu kéo, chờ nhà cung cấp) →
 * analyzing (đã có số liệu, gọi LLM) → done | failed. Mỗi bước giành khoá
 * `step_at` bằng một câu UPDATE có điều kiện để hai request song song không
 * cùng làm một việc.
 */
export async function advanceAnalysis(id: string): Promise<CreatorAnalysis | null> {
  const db = getDb(env.DB);
  const rows = await db.select().from(creatorAnalyses).where(eq(creatorAnalyses.id, id)).limit(1);
  const analysis = rows[0];
  if (!analysis || analysis.status === 'done' || analysis.status === 'failed') return analysis ?? null;

  const t = now();
  const lock = await env.DB.prepare(
    'UPDATE creator_analyses SET step_at = ?1 WHERE id = ?2 AND status = ?3 AND (step_at IS NULL OR step_at < ?4)',
  )
    .bind(t, id, analysis.status, t - STEP_LOCK_S)
    .run();
  if (!lock.meta.changes) return analysis; // tiến trình khác đang làm bước này

  try {
    const provider = await pickProvider();

    if (analysis.status === 'queued' || (analysis.status === 'fetching' && !analysis.providerJobId)) {
      if (provider.startJob) {
        const jobId = await provider.startJob(analysis.handle, VIDEO_LIMIT);
        await setStatus(id, 'fetching', { providerJobId: jobId, provider: provider.name, stepAt: null });
        return (await getAnalysis(id))!;
      }
      // Nhà cung cấp đồng bộ (mock): kéo luôn trong bước này
      await setStatus(id, 'fetching', { provider: provider.name });
      const [profile, list] = await Promise.all([
        provider.fetchProfile(analysis.handle),
        provider.fetchVideos(analysis.handle, VIDEO_LIMIT),
      ]);
      await storeFetched(analysis, provider.name, profile, list);
      return (await getAnalysis(id))!;
    }

    if (analysis.status === 'fetching' && analysis.providerJobId && provider.pollJob) {
      const poll = await provider.pollJob(analysis.providerJobId, analysis.handle, VIDEO_LIMIT);
      if (poll.state === 'running') {
        await setStatus(id, 'fetching', { stepAt: null });
        return (await getAnalysis(id))!;
      }
      if (poll.state === 'failed') {
        await fail(analysis, poll.detail);
        return (await getAnalysis(id))!;
      }
      await storeFetched(analysis, provider.name, poll.profile, poll.videos);
      return (await getAnalysis(id))!;
    }

    if (analysis.status === 'analyzing') {
      const current = (await getAnalysis(id))!;
      const creator = current.creatorId ? await getCreator(current.creatorId) : null;
      const metrics = metricsOf(current);
      if (!creator || !metrics) {
        await fail(analysis, 'Thiếu số liệu để AI phân tích');
        return (await getAnalysis(id))!;
      }
      const list = (await listCreatorVideos(creator.id)).slice(0, VIDEO_LIMIT);
      const profile: CreatorProfile = {
        displayName: creator.displayName,
        avatarUrl: creator.avatarUrl,
        bio: creator.bio,
        followers: creator.followers,
        following: creator.following,
        likesTotal: creator.likesTotal,
        videoCount: creator.videoCount,
      };

      let resultJson = current.inputHash ? await findSameInput(creator.id, current.inputHash, id) : null;
      let aiError: string | null = null;
      if (!resultJson) {
        const insights = computeInsights(list, profile, now());
        const outcome = await analyzeCreator(env.AI, { handle: analysis.handle, profile, metrics, videos: list, insights });
        resultJson = outcome.result ? JSON.stringify(outcome.result) : null;
        // Phần AI hỏng thì vẫn 'done' (có số liệu), nhưng ghi lý do để soi được
        // qua endpoint status mà không cần đọc log Worker
        if (!resultJson) aiError = `AI: ${outcome.failures.join(' | ')}`.slice(0, 900);
      }
      await setStatus(id, 'done', { resultJson, error: aiError, finishedAt: now(), stepAt: null });
      return (await getAnalysis(id))!;
    }

    // Trạng thái lạ: nhả khoá
    await setStatus(id, analysis.status, { stepAt: null });
    return analysis;
  } catch (error) {
    console.error(`[tiktok] Phân tích ${id} lỗi ở bước ${analysis.status}:`, error);
    await fail(analysis, error instanceof Error ? error.message.slice(0, 500) : 'Lỗi không xác định');
    return (await getAnalysis(id))!;
  }
}

/** Chạy liên tiếp các bước cho tới khi xong hoặc tới khi phải chờ nhà cung cấp. */
export async function runAnalysis(id: string): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const before = await getAnalysis(id);
    const after = await advanceAnalysis(id);
    if (!after || after.status === 'done' || after.status === 'failed') return;
    // Không đổi trạng thái nghĩa là đang chờ nhà cung cấp, để lần hỏi sau làm tiếp
    if (before?.status === after.status && after.status === 'fetching' && after.providerJobId) return;
  }
}

async function getAnalysis(id: string): Promise<CreatorAnalysis | null> {
  const rows = await getDb(env.DB).select().from(creatorAnalyses).where(eq(creatorAnalyses.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Lưu kết quả kéo được, tính chỉ số, chuyển sang bước AI. */
async function storeFetched(
  analysis: CreatorAnalysis,
  providerName: string,
  profile: CreatorProfile | null,
  list: VideoData[],
): Promise<void> {
  if (list.length === 0) {
    await fail(
      analysis,
      `Không tìm thấy video nào của @${analysis.handle}. Kiểm tra lại tên kênh (tên trong link tiktok.com/@...), hoặc kênh đang để riêng tư. Lượt này không bị tính.`,
    );
    return;
  }
  const creator = await upsertCreator(analysis.handle, profile, providerName);
  await upsertVideos(creator.id, list);
  const metrics = computeMetrics(list);
  const inputHash = await sha256(JSON.stringify({ metrics, captions: list.map((v) => v.caption) }));
  await setStatus(analysis.id, 'analyzing', {
    creatorId: creator.id,
    provider: providerName,
    metricsJson: JSON.stringify(metrics),
    inputHash,
    stepAt: null,
  });
}

async function fail(analysis: CreatorAnalysis, message: string): Promise<void> {
  await setStatus(analysis.id, 'failed', { error: message, finishedAt: now(), stepAt: null });
  await refundIfCharged(analysis);
}

/** Phân tích thất bại thì trả lại tín chỉ đã trừ; gọi trùng cũng chỉ hoàn một lần. */
async function refundIfCharged(analysis: CreatorAnalysis): Promise<void> {
  if (analysis.costCredits > 0) {
    await refund(analysis.userId, analysis.id, analysis.costCredits).catch((error) =>
      console.error(`[tiktok] Không hoàn được tín chỉ cho ${analysis.id}:`, error),
    );
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
