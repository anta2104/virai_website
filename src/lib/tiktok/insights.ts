/**
 * Insight tính bằng code từ danh sách video: công thức mở đầu nào ăn khách, độ
 * dài nào hiệu quả, hashtag bị bỏ sót, nửa sau tăng hay giảm, tầm với ngoài tệp
 * follower, nhịp đăng. Thuần, không import gì ngoài kiểu, để test bằng Node và
 * để chắc chắn số nào hiện lên cũng do code tính.
 */
import type { CreatorProfile, VideoData } from './provider';

export interface OpeningPattern {
  /** Vài chữ đầu caption đã chuẩn hoá, ví dụ "sự thật không ai nói" */
  template: string;
  count: number;
  medianViews: number;
  /** medianViews / trung vị cả kênh */
  multiple: number;
  /** Caption đầy đủ của video tốt nhất trong nhóm */
  example: string;
}

export interface DurationBucket {
  label: string;
  count: number;
  medianViews: number;
  multiple: number;
}

export interface HalfTrend {
  firstMedian: number;
  secondMedian: number;
  /** (second - first) / first, ví dụ 0.35 = tăng 35% */
  change: number;
  firstCount: number;
  secondCount: number;
}

export interface StandoutVideo {
  tiktokId: string;
  url: string;
  caption: string | null;
  views: number;
  /** Tỉ lệ dùng để chọn (lưu/view, share/view, bình luận/view) */
  rate: number;
}

export interface TagInsight {
  name: string;
  count: number;
  medianViews: number;
  multiple: number;
}

export interface PostingRhythm {
  avgGapDays: number | null;
  maxGapDays: number | null;
  /** Số ngày từ video mới nhất tới `now` */
  daysSinceLast: number | null;
}

export interface FormatMix {
  videoCount: number;
  videoMedian: number;
  slideshowCount: number;
  slideshowMedian: number;
}

export interface Insights {
  channelMedian: number;
  patterns: OpeningPattern[];
  durations: DurationBucket[];
  halves: HalfTrend | null;
  mostSaved: StandoutVideo | null;
  mostShared: StandoutVideo | null;
  mostCommented: StandoutVideo | null;
  /** Hashtag dùng ít nhưng view cao: nên dùng thêm */
  tagOpportunities: TagInsight[];
  /** Hashtag dùng nhiều mà view thấp: đang là tiếng ồn */
  tagNoise: TagInsight[];
  rhythm: PostingRhythm;
  format: FormatMix;
  /** Trung vị view / follower. > 1 nghĩa là video vươn ra ngoài tệp theo dõi */
  viewsPerFollower: number | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function ratio(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/** Bỏ hashtag, @, link, emoji và ký tự lạ; hạ chữ thường; gom khoảng trắng. */
export function normalizeCaption(caption: string | null): string {
  return (caption ?? '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@]\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nhóm video theo 4 chữ đầu caption; trả nhóm có từ 2 video, xếp theo trung vị. */
export function openingPatterns(videos: VideoData[], channelMedian: number, words = 4): OpeningPattern[] {
  const groups = new Map<string, VideoData[]>();
  for (const video of videos) {
    const text = normalizeCaption(video.caption);
    const parts = text.split(' ').filter(Boolean);
    if (parts.length < words) continue;
    const key = parts.slice(0, words).join(' ');
    groups.set(key, [...(groups.get(key) ?? []), video]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([template, list]) => {
      const medianViews = median(list.map((v) => v.views));
      const best = [...list].sort((a, b) => b.views - a.views)[0]!;
      return { template, count: list.length, medianViews, multiple: ratio(medianViews, channelMedian), example: best.caption ?? '' };
    })
    .sort((a, b) => b.medianViews - a.medianViews)
    .slice(0, 6);
}

const DURATION_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'dưới 20 giây', min: 0, max: 20 },
  { label: '20–40 giây', min: 20, max: 40 },
  { label: '40–60 giây', min: 40, max: 60 },
  { label: 'trên 60 giây', min: 60, max: Number.POSITIVE_INFINITY },
];

export function durationBuckets(videos: VideoData[], channelMedian: number): DurationBucket[] {
  return DURATION_BUCKETS.map((bucket) => {
    const list = videos.filter((v) => v.durationS !== null && v.durationS >= bucket.min && v.durationS < bucket.max);
    const medianViews = median(list.map((v) => v.views));
    return { label: bucket.label, count: list.length, medianViews, multiple: ratio(medianViews, channelMedian) };
  }).filter((b) => b.count > 0);
}

/** So trung vị view nửa cũ với nửa mới (theo ngày đăng). Cần ít nhất 6 video. */
export function halvesTrend(videos: VideoData[]): HalfTrend | null {
  const dated = videos.filter((v) => v.postedAt !== null).sort((a, b) => a.postedAt! - b.postedAt!);
  if (dated.length < 6) return null;
  const mid = Math.floor(dated.length / 2);
  const first = dated.slice(0, mid);
  const second = dated.slice(mid);
  const firstMedian = median(first.map((v) => v.views));
  const secondMedian = median(second.map((v) => v.views));
  return {
    firstMedian,
    secondMedian,
    change: firstMedian > 0 ? (secondMedian - firstMedian) / firstMedian : 0,
    firstCount: first.length,
    secondCount: second.length,
  };
}

function standout(videos: VideoData[], pick: (v: VideoData) => number, minViews = 100): StandoutVideo | null {
  const candidates = videos.filter((v) => v.views >= minViews);
  if (candidates.length === 0) return null;
  const best = [...candidates].sort((a, b) => ratio(pick(b), b.views) - ratio(pick(a), a.views))[0]!;
  const rate = ratio(pick(best), best.views);
  if (rate <= 0) return null;
  return { tiktokId: best.tiktokId, url: best.url, caption: best.caption, views: best.views, rate };
}

function tagInsights(videos: VideoData[], channelMedian: number): { opportunities: TagInsight[]; noise: TagInsight[] } {
  const byTag = new Map<string, number[]>();
  for (const video of videos) {
    for (const tag of new Set(video.hashtags.map((t) => t.toLowerCase()))) {
      byTag.set(tag, [...(byTag.get(tag) ?? []), video.views]);
    }
  }
  const all: TagInsight[] = [...byTag.entries()].map(([name, views]) => {
    const medianViews = median(views);
    return { name, count: views.length, medianViews, multiple: ratio(medianViews, channelMedian) };
  });
  const opportunities = all
    .filter((t) => t.count >= 1 && t.count <= 3 && t.multiple >= 1.5)
    .sort((a, b) => b.medianViews - a.medianViews)
    .slice(0, 5);
  const noise = all
    .filter((t) => t.count >= 4 && t.multiple <= 0.7)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return { opportunities, noise };
}

export function postingRhythm(videos: VideoData[], now: number): PostingRhythm {
  const times = videos
    .map((v) => v.postedAt)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  if (times.length === 0) return { avgGapDays: null, maxGapDays: null, daysSinceLast: null };
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i]! - times[i - 1]!) / 86_400);
  return {
    avgGapDays: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null,
    maxGapDays: gaps.length ? Math.max(...gaps) : null,
    daysSinceLast: Math.max(0, (now - times[times.length - 1]!) / 86_400),
  };
}

export function formatMix(videos: VideoData[]): FormatMix {
  const clips = videos.filter((v) => v.durationS !== null && v.durationS > 0);
  const slides = videos.filter((v) => v.durationS === null || v.durationS === 0);
  return {
    videoCount: clips.length,
    videoMedian: median(clips.map((v) => v.views)),
    slideshowCount: slides.length,
    slideshowMedian: median(slides.map((v) => v.views)),
  };
}

export function computeInsights(videos: VideoData[], profile: CreatorProfile | null, now: number): Insights {
  const channelMedian = median(videos.map((v) => v.views));
  const tags = tagInsights(videos, channelMedian);
  return {
    channelMedian,
    patterns: openingPatterns(videos, channelMedian),
    durations: durationBuckets(videos, channelMedian),
    halves: halvesTrend(videos),
    mostSaved: standout(videos, (v) => v.saves),
    mostShared: standout(videos, (v) => v.shares),
    mostCommented: standout(videos, (v) => v.comments),
    tagOpportunities: tags.opportunities,
    tagNoise: tags.noise,
    rhythm: postingRhythm(videos, now),
    format: formatMix(videos),
    viewsPerFollower: profile && profile.followers > 0 ? channelMedian / profile.followers : null,
  };
}
