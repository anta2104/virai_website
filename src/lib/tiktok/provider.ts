/**
 * Nguồn dữ liệu TikTok, bọc sau một interface để đổi nhà cung cấp mà không
 * chạm vào phần tính chỉ số và phân tích.
 *
 * - `mock`: dữ liệu giả sinh xác định từ handle, dùng để dev/demo không tốn phí.
 * - `apify`: actor `clockworks/tiktok-scraper`. Tên field đọc phòng thủ theo
 *   nhiều tên gọi vì CHƯA kiểm chứng với token thật (xem JSDoc bên dưới).
 */
import { profileUrl } from './handle';


export interface CreatorProfile {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  following: number;
  likesTotal: number;
  videoCount: number;
}

export interface VideoData {
  tiktokId: string;
  url: string;
  caption: string | null;
  durationS: number | null;
  /** unix epoch giây */
  postedAt: number | null;
  musicTitle: string | null;
  /** Không có # */
  hashtags: string[];
  coverUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface TikTokProvider {
  readonly name: 'mock' | 'apify';
  fetchProfile(handle: string): Promise<CreatorProfile | null>;
  fetchVideos(handle: string, limit: number): Promise<VideoData[]>;
}

/* ── Mock ──────────────────────────────────────────────────────────────── */

/** FNV-1a 32 bit — đủ để sinh số giả lặp lại được, không dùng cho bảo mật. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Bộ sinh số ngẫu nhiên có seed (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_TOPICS = [
  { topic: 'review mỹ phẩm', tags: ['review', 'skincare', 'lamdep'], music: 'original sound' },
  { topic: 'một ngày của mình', tags: ['dailyvlog', 'xuhuong'], music: 'Chill Lofi Beat' },
  { topic: 'mẹo hay', tags: ['meohay', 'tips', 'learnontiktok'], music: 'Funny Background' },
  { topic: 'unbox đồ mới', tags: ['unboxing', 'haul', 'mua_gi'], music: 'Aesthetic Vibes' },
  { topic: 'trả lời bình luận', tags: ['qna', 'fyp'], music: 'original sound' },
  { topic: 'thử thách', tags: ['challenge', 'trend', 'xuhuong'], music: 'Viral Dance Sound' },
];

const MOCK_HOOKS = [
  'Đừng mua cái này nếu bạn chưa biết điều này',
  '3 điều mình ước biết sớm hơn về',
  'Mình đã thử 7 ngày và đây là kết quả',
  'Ai hỏi mình hoài nên làm luôn video',
  'Sự thật không ai nói với bạn về',
  'Cách mình tiết kiệm 2 tiếng mỗi ngày với',
];

export class MockProvider implements TikTokProvider {
  readonly name = 'mock' as const;

  async fetchProfile(handle: string): Promise<CreatorProfile> {
    const rand = seeded(fnv1a(`profile:${handle}`));
    const followers = Math.round(2_000 + rand() * 180_000);
    return {
      displayName: handle.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      avatarUrl: null,
      bio: `Kênh demo của @${handle} · dữ liệu giả để thử tính năng`,
      followers,
      following: Math.round(50 + rand() * 600),
      likesTotal: Math.round(followers * (8 + rand() * 30)),
      videoCount: Math.round(40 + rand() * 300),
    };
  }

  async fetchVideos(handle: string, limit: number): Promise<VideoData[]> {
    const rand = seeded(fnv1a(`videos:${handle}`));
    const base = 1_500 + rand() * 40_000;
    const now = Math.floor(Date.now() / 1000);
    const count = Math.min(limit, 30);
    const videos: VideoData[] = [];

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor((i / count) * 90 + rand() * 3);
      const hourVn = [7, 11, 12, 18, 19, 20, 21, 22][Math.floor(rand() * 8)]!;
      // Giờ Việt Nam → UTC: trừ 7 tiếng
      const dayStart = now - daysAgo * 86_400;
      const postedAt = dayStart - (dayStart % 86_400) + ((hourVn - 7 + 24) % 24) * 3600 + Math.floor(rand() * 1800);

      const topic = MOCK_TOPICS[Math.floor(rand() * MOCK_TOPICS.length)]!;
      const hook = MOCK_HOOKS[Math.floor(rand() * MOCK_HOOKS.length)]!;
      // Khoảng 1/8 video nổi bật gấp 4–12 lần
      const viral = rand() < 0.125;
      const multiplier = viral ? 4 + rand() * 8 : 0.4 + rand() * 1.4;
      const views = Math.round(base * multiplier);
      const likeRate = 0.03 + rand() * 0.07;
      // Ghép chuỗi để ra 19 chữ số như id thật mà không vượt Number.MAX_SAFE_INTEGER
      const tiktokId = `73${String(fnv1a(`${handle}:${i}`)).padStart(10, '0')}${String(i).padStart(7, '0')}`;

      videos.push({
        tiktokId,
        url: `${profileUrl(handle)}/video/${tiktokId}`,
        caption: `${hook} ${topic.topic} ${topic.tags.map((t) => `#${t}`).join(' ')}`,
        durationS: Math.round(12 + rand() * 75),
        postedAt,
        musicTitle: topic.music,
        hashtags: [...topic.tags],
        coverUrl: null,
        views,
        likes: Math.round(views * likeRate),
        comments: Math.round(views * likeRate * (0.03 + rand() * 0.08)),
        shares: Math.round(views * (viral ? 0.01 + rand() * 0.02 : 0.002 + rand() * 0.006)),
        saves: Math.round(views * (viral ? 0.015 + rand() * 0.02 : 0.003 + rand() * 0.008)),
      });
    }

    return videos.sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0));
  }
}

/* ── Apify ─────────────────────────────────────────────────────────────── */

type Raw = Record<string, unknown>;

function pickNumber(source: Raw | undefined, keys: string[]): number {
  if (!source) return 0;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function pickString(source: Raw | undefined, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Raw | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined;
}

/** createTimeISO ('2025-01-02T03:04:05.000Z') hoặc createTime (epoch giây hay ms). */
function pickTimestamp(source: Raw): number | null {
  const iso = pickString(source, ['createTimeISO', 'createTimeIso', 'createdAt']);
  if (iso) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  const numeric = pickNumber(source, ['createTime', 'create_time', 'timestamp']);
  if (numeric > 0) return numeric > 1e11 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  return null;
}

function pickHashtags(source: Raw): string[] {
  const list = source.hashtags;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const name = typeof item === 'string' ? item : pickString(asRecord(item), ['name', 'title']);
    if (name) out.push(name.replace(/^#/, '').toLowerCase());
  }
  return out;
}

/**
 * Chuyển một dòng dataset của actor `clockworks/tiktok-scraper` sang dạng chuẩn.
 *
 * [Unverified] Tên field dựa trên tài liệu công khai của actor tại thời điểm
 * viết, chưa đối chiếu với token thật. Nếu số liệu về 0 hàng loạt thì in một
 * dòng dataset thô ra log và bổ sung tên field vào các mảng bên dưới.
 */
export function mapApifyItem(item: Raw, handle: string): VideoData | null {
  const tiktokId = pickString(item, ['id', 'videoId', 'video_id', 'awemeId']);
  if (!tiktokId) return null;
  const videoMeta = asRecord(item.videoMeta);
  const musicMeta = asRecord(item.musicMeta);
  const stats = asRecord(item.stats);

  return {
    tiktokId,
    url: pickString(item, ['webVideoUrl', 'url']) ?? `${profileUrl(handle)}/video/${tiktokId}`,
    caption: pickString(item, ['text', 'desc', 'caption']),
    durationS: pickNumber(videoMeta, ['duration']) || pickNumber(item, ['duration']) || null,
    postedAt: pickTimestamp(item),
    musicTitle: pickString(musicMeta, ['musicName', 'title']),
    hashtags: pickHashtags(item),
    coverUrl: pickString(videoMeta, ['coverUrl', 'cover']) ?? pickString(item, ['coverUrl', 'cover']),
    views: pickNumber(item, ['playCount', 'views', 'viewCount']) || pickNumber(stats, ['playCount']),
    likes: pickNumber(item, ['diggCount', 'likes', 'likeCount']) || pickNumber(stats, ['diggCount']),
    comments: pickNumber(item, ['commentCount', 'comments']) || pickNumber(stats, ['commentCount']),
    shares: pickNumber(item, ['shareCount', 'shares']) || pickNumber(stats, ['shareCount']),
    saves: pickNumber(item, ['collectCount', 'saves', 'saveCount']) || pickNumber(stats, ['collectCount']),
  };
}

export function mapApifyAuthor(item: Raw): CreatorProfile | null {
  const author = asRecord(item.authorMeta) ?? asRecord(item.author);
  if (!author) return null;
  return {
    displayName: pickString(author, ['nickName', 'nickname', 'name']),
    avatarUrl: pickString(author, ['avatar', 'avatarLarger', 'avatarUrl']),
    bio: pickString(author, ['signature', 'bio']),
    followers: pickNumber(author, ['fans', 'followers', 'followerCount']),
    following: pickNumber(author, ['following', 'followingCount']),
    likesTotal: pickNumber(author, ['heart', 'hearts', 'likes', 'heartCount']),
    videoCount: pickNumber(author, ['video', 'videos', 'videoCount']),
  };
}

const APIFY_ACTOR = 'clockworks~tiktok-scraper';

export class ApifyProvider implements TikTokProvider {
  readonly name = 'apify' as const;
  /** Cache cả promise đang chạy: fetchProfile và fetchVideos gọi song song chỉ tốn một lần actor */
  private cache = new Map<string, Promise<Raw[]>>();
  private readonly token: string;

  // Không dùng parameter property: Node strip-only (npm test) không hỗ trợ
  constructor(token: string) {
    this.token = token;
  }

  /** Một lần gọi actor cho cả profile lẫn video; cache trong đời request. */
  private items(handle: string, limit: number): Promise<Raw[]> {
    const cached = this.cache.get(handle);
    if (cached) return cached;

    const pending = this.fetchItems(handle, limit).catch((error) => {
      // Lỗi thì bỏ cache để lần gọi sau còn thử lại được
      this.cache.delete(handle);
      throw error;
    });
    this.cache.set(handle, pending);
    return pending;
  }

  private async fetchItems(handle: string, limit: number): Promise<Raw[]> {
    const url = new URL(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`);
    url.searchParams.set('token', this.token);
    url.searchParams.set('timeout', '240');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profiles: [handle],
        resultsPerPage: limit,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Apify trả ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as unknown;
    const list = Array.isArray(data) ? (data.filter((x) => asRecord(x)) as Raw[]) : [];
    if (list.length === 0) {
      console.warn(`[tiktok/apify] Không có dòng nào cho @${handle}`);
    } else if (!mapApifyItem(list[0]!, handle)?.views) {
      console.warn('[tiktok/apify] Dòng đầu không đọc được số liệu, payload thô:', JSON.stringify(list[0]).slice(0, 800));
    }
    return list;
  }

  async fetchProfile(handle: string): Promise<CreatorProfile | null> {
    const list = await this.items(handle, 30);
    for (const item of list) {
      const profile = mapApifyAuthor(item);
      if (profile) return profile;
    }
    return null;
  }

  async fetchVideos(handle: string, limit: number): Promise<VideoData[]> {
    const list = await this.items(handle, limit);
    const out: VideoData[] = [];
    for (const item of list) {
      const video = mapApifyItem(item, handle);
      if (video) out.push(video);
    }
    return out.slice(0, limit);
  }
}

/** Chọn provider theo TIKTOK_PROVIDER; thiếu token thì về mock và ghi log. */
