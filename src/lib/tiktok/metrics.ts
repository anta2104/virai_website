/**
 * Chỉ số kênh tính bằng code thuần từ danh sách video.
 *
 * Không import gì ngoài kiểu để test trực tiếp bằng Node, và để chắc chắn
 * mọi con số trên trang kết quả đều do code tính, không phải LLM đoán.
 */
import type { VideoData } from './provider';

export interface StatSummary {
  total: number;
  mean: number;
  median: number;
}

export interface TopVideo {
  tiktokId: string;
  url: string;
  caption: string | null;
  postedAt: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** views / trung vị views */
  multiple: number;
}

export interface SlotStat {
  /** 0–23 (giờ) hoặc 0–6 (thứ, 0 = Chủ nhật) theo giờ Việt Nam */
  slot: number;
  count: number;
  medianViews: number;
}

export interface TagStat {
  name: string;
  count: number;
  medianViews: number;
}

export interface SeriesPoint {
  tiktokId: string;
  postedAt: number;
  views: number;
  engagementRate: number;
}

export interface CreatorMetrics {
  videoCount: number;
  /** Khoảng ngày của dữ liệu, epoch giây */
  from: number | null;
  to: number | null;
  views: StatSummary;
  likes: StatSummary;
  comments: StatSummary;
  shares: StatSummary;
  saves: StatSummary;
  /** (like + comment + share + save) / view, tính trên tổng */
  engagementRate: number;
  saveRate: number;
  shareRate: number;
  postsPerWeek: number;
  avgDurationS: number | null;
  topVideos: TopVideo[];
  byHour: SlotStat[];
  byWeekday: SlotStat[];
  hashtags: TagStat[];
  music: TagStat[];
  /** Theo thời gian tăng dần, cho biểu đồ */
  series: SeriesPoint[];
}

const VN_OFFSET_S = 7 * 3600;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function summarize(values: number[]): StatSummary {
  const total = values.reduce((sum, v) => sum + v, 0);
  return {
    total,
    mean: values.length ? total / values.length : 0,
    median: median(values),
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function engagementOf(video: VideoData): number {
  return ratio(video.likes + video.comments + video.shares + video.saves, video.views);
}

/** Giờ (0–23) và thứ (0 = Chủ nhật) theo giờ Việt Nam từ epoch giây. */
export function vietnamSlot(postedAt: number): { hour: number; weekday: number } {
  const shifted = postedAt + VN_OFFSET_S;
  const hour = Math.floor((shifted % 86_400) / 3600);
  // 1/1/1970 là thứ Năm (4)
  const weekday = (Math.floor(shifted / 86_400) + 4) % 7;
  return { hour, weekday };
}

function slotStats(videos: VideoData[], pick: (v: VideoData) => number, size: number): SlotStat[] {
  const buckets: number[][] = Array.from({ length: size }, () => []);
  for (const video of videos) {
    if (video.postedAt === null) continue;
    buckets[pick(video)]!.push(video.views);
  }
  return buckets.map((views, slot) => ({ slot, count: views.length, medianViews: median(views) }));
}

function tagStats(videos: VideoData[], pick: (v: VideoData) => string[], limit: number): TagStat[] {
  const map = new Map<string, number[]>();
  for (const video of videos) {
    for (const name of new Set(pick(video))) {
      const list = map.get(name) ?? [];
      list.push(video.views);
      map.set(name, list);
    }
  }
  return [...map.entries()]
    .map(([name, views]) => ({ name, count: views.length, medianViews: median(views) }))
    .sort((a, b) => b.count - a.count || b.medianViews - a.medianViews)
    .slice(0, limit);
}

export function computeMetrics(videos: VideoData[]): CreatorMetrics {
  const views = summarize(videos.map((v) => v.views));
  const likes = summarize(videos.map((v) => v.likes));
  const comments = summarize(videos.map((v) => v.comments));
  const shares = summarize(videos.map((v) => v.shares));
  const saves = summarize(videos.map((v) => v.saves));

  const dated = videos.filter((v): v is VideoData & { postedAt: number } => v.postedAt !== null);
  const times = dated.map((v) => v.postedAt);
  const from = times.length ? Math.min(...times) : null;
  const to = times.length ? Math.max(...times) : null;
  // Khoảng thời gian tối thiểu một tuần để một video đơn lẻ không thành "7 video/tuần"
  const spanWeeks = from !== null && to !== null ? Math.max(1, (to - from) / (7 * 86_400)) : 0;

  const durations = videos.map((v) => v.durationS).filter((d): d is number => d !== null && d > 0);

  const threshold = views.median * 2;
  const topVideos: TopVideo[] = videos
    .filter((v) => views.median > 0 && v.views > threshold)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((v) => ({
      tiktokId: v.tiktokId,
      url: v.url,
      caption: v.caption,
      postedAt: v.postedAt,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      saves: v.saves,
      multiple: ratio(v.views, views.median),
    }));

  return {
    videoCount: videos.length,
    from,
    to,
    views,
    likes,
    comments,
    shares,
    saves,
    engagementRate: ratio(likes.total + comments.total + shares.total + saves.total, views.total),
    saveRate: ratio(saves.total, views.total),
    shareRate: ratio(shares.total, views.total),
    postsPerWeek: spanWeeks > 0 ? dated.length / spanWeeks : 0,
    avgDurationS: durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    topVideos,
    byHour: slotStats(dated, (v) => vietnamSlot(v.postedAt!).hour, 24),
    byWeekday: slotStats(dated, (v) => vietnamSlot(v.postedAt!).weekday, 7),
    hashtags: tagStats(videos, (v) => v.hashtags, 10),
    music: tagStats(videos, (v) => (v.musicTitle ? [v.musicTitle] : []), 10),
    series: dated
      .map((v) => ({ tiktokId: v.tiktokId, postedAt: v.postedAt, views: v.views, engagementRate: engagementOf(v) }))
      .sort((a, b) => a.postedAt - b.postedAt),
  };
}

/** Khung giờ đăng tốt nhất: có ít nhất 2 video, xếp theo trung vị view. */
/**
 * Khung giờ/thứ tốt nhất theo view trung vị.
 *
 * Khung chỉ có 1–2 video thì trung vị là may rủi (một video viral kéo cả khung
 * lên). Nên yêu cầu tối thiểu 3 video; không khung nào đủ 3 mới hạ xuống 2.
 */
export function bestSlots(stats: SlotStat[], limit = 3): SlotStat[] {
  const minCount = stats.some((s) => s.count >= 3) ? 3 : 2;
  return stats
    .filter((s) => s.count >= minCount)
    .sort((a, b) => b.medianViews - a.medianViews || b.count - a.count)
    .slice(0, limit);
}

export const WEEKDAY_LABEL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** 12_345 → '12,3K', 1_234_567 → '1,2M' — gọn cho thẻ chỉ số. */
export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',').replace(',0', '')}K`;
  return String(Math.round(value));
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace('.', ',')}%`;
}
