/**
 * Phân tích định tính bằng LLM trên bảng chỉ số đã tính sẵn.
 *
 * LLM chỉ nhận số đã tính và caption; không được tự tính hay bịa số.
 */
import { chatJsonDetailed } from '../llm';
import { WEEKDAY_LABEL, bestSlots, compactNumber, percent, type CreatorMetrics } from './metrics';
import type { CreatorProfile, VideoData } from './provider';

export interface AnalysisResult {
  summary: string;
  topVideos: Array<{ tiktokId: string; why: string }>;
  themes: Array<{ name: string; share: string; performance: string }>;
  trend: { direction: 'len' | 'xuong' | 'di_ngang'; reason: string };
  postingAdvice: string;
  hashtagAdvice: string;
  nextIdeas: Array<{ hook: string; idea: string }>;
  healthScore: number;
  checklist: string[];
}

export const TREND_LABEL: Record<AnalysisResult['trend']['direction'], string> = {
  len: 'Đang lên',
  xuong: 'Đang xuống',
  di_ngang: 'Đi ngang',
};

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích kênh TikTok cho người bán hàng và nhà sáng tạo nội dung ở Việt Nam.

Bạn nhận một bảng chỉ số ĐÃ ĐƯỢC TÍNH SẴN và danh sách caption video. Nhiệm vụ: rút ra nhận xét định tính và lời khuyên hành động.

Quy tắc bắt buộc:
- Viết tiếng Việt tự nhiên, ngắn gọn, nói thẳng. CHỈ dùng chữ Latin có dấu tiếng Việt; tuyệt đối không dùng chữ Hán, Nhật, Hàn.
- KHÔNG tự tính hay bịa số. Chỉ nhắc lại số đã cho. Không nói "khoảng 50%" nếu bảng không ghi.
- topVideos: chọn từ danh sách "video nổi bật" đã cho, giải thích vì sao nổi (hook mở đầu, chủ đề, định dạng, thời điểm).
- themes: nhóm nội dung theo chủ đề từ caption, 3–5 nhóm; "share" là tỉ trọng ước lượng bằng chữ (ví dụ "khoảng 1/3 video"), "performance" nói nhóm đó hiệu quả hơn hay kém hơn mức chung.
- trend: dựa vào chuỗi view theo thời gian đã cho.
- nextIdeas: 5 ý tưởng video tiếp theo, mỗi ý có câu hook mở đầu 1 dòng và mô tả 1–2 câu, bám vào những gì đã hiệu quả của chính kênh này.
- healthScore: 0–100, cân nhắc tần suất đăng, tỉ lệ tương tác, tỉ lệ lưu/chia sẻ, có video nổi bật hay không.
- checklist: 3–6 việc cụ thể nên làm trong 2 tuần tới.

Chỉ trả về JSON đúng cấu trúc sau, không giải thích gì thêm, không bọc trong markdown:
{"summary":"...","topVideos":[{"tiktokId":"...","why":"..."}],"themes":[{"name":"...","share":"...","performance":"..."}],"trend":{"direction":"len|xuong|di_ngang","reason":"..."},"postingAdvice":"...","hashtagAdvice":"...","nextIdeas":[{"hook":"...","idea":"..."}],"healthScore":0,"checklist":["..."]}`;

function describeSlots(metrics: CreatorMetrics): string {
  const hours = bestSlots(metrics.byHour).map((s) => `${s.slot}h (${s.count} video, trung vị ${compactNumber(s.medianViews)} view)`);
  const days = bestSlots(metrics.byWeekday).map(
    (s) => `${WEEKDAY_LABEL[s.slot]} (${s.count} video, trung vị ${compactNumber(s.medianViews)} view)`,
  );
  return [`Khung giờ tốt nhất: ${hours.join('; ') || 'chưa đủ dữ liệu'}`, `Thứ tốt nhất: ${days.join('; ') || 'chưa đủ dữ liệu'}`].join('\n');
}

export function buildUserPrompt(
  handle: string,
  profile: CreatorProfile | null,
  metrics: CreatorMetrics,
  videos: VideoData[],
): string {
  const lines: string[] = [`Kênh: @${handle}`];
  if (profile) {
    lines.push(
      `Follower: ${compactNumber(profile.followers)} · Tổng like: ${compactNumber(profile.likesTotal)} · Tổng video: ${profile.videoCount}`,
    );
    if (profile.bio) lines.push(`Bio: ${profile.bio.slice(0, 200)}`);
  }
  lines.push(
    '',
    `== Chỉ số trên ${metrics.videoCount} video gần nhất ==`,
    `View: tổng ${compactNumber(metrics.views.total)}, trung bình ${compactNumber(metrics.views.mean)}, trung vị ${compactNumber(metrics.views.median)}`,
    `Like trung bình ${compactNumber(metrics.likes.mean)} · Comment ${compactNumber(metrics.comments.mean)} · Share ${compactNumber(metrics.shares.mean)} · Lưu ${compactNumber(metrics.saves.mean)}`,
    `Tỉ lệ tương tác: ${percent(metrics.engagementRate)} · Tỉ lệ lưu/view: ${percent(metrics.saveRate, 2)} · Tỉ lệ share/view: ${percent(metrics.shareRate, 2)}`,
    `Tần suất đăng: ${metrics.postsPerWeek.toFixed(1)} video/tuần · Độ dài trung bình: ${metrics.avgDurationS ? Math.round(metrics.avgDurationS) : '?'} giây`,
    '',
    describeSlots(metrics),
    '',
    `Hashtag hay dùng: ${metrics.hashtags.map((h) => `#${h.name} (${h.count} video, trung vị ${compactNumber(h.medianViews)} view)`).join('; ') || 'không có'}`,
    `Nhạc hay dùng: ${metrics.music.map((m) => `"${m.name}" (${m.count} video)`).join('; ') || 'không có'}`,
    '',
    '== Video nổi bật (view vượt 2 lần trung vị) ==',
    ...(metrics.topVideos.length
      ? metrics.topVideos.map(
          (v) => `- id ${v.tiktokId}: ${compactNumber(v.views)} view (gấp ${v.multiple.toFixed(1)} lần trung vị), caption: ${(v.caption ?? '').slice(0, 160)}`,
        )
      : ['- không có video nào vượt trội']),
    '',
    '== View theo thời gian (cũ → mới) ==',
    metrics.series.map((p) => compactNumber(p.views)).join(', '),
    '',
    '== Caption các video (mới → cũ) ==',
    // Gọn để đầu ra JSON tiếng Việt (tốn token) còn chỗ: 24 caption, mỗi caption 110 ký tự
    ...videos.slice(0, 24).map((v) => `- [${v.tiktokId}] ${(v.caption ?? '(không có caption)').slice(0, 110)}`),
  );
  return lines.join('\n');
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const trend = v.trend as Record<string, unknown> | undefined;
  return (
    isString(v.summary) &&
    Array.isArray(v.topVideos) &&
    Array.isArray(v.themes) &&
    Boolean(trend) &&
    ['len', 'xuong', 'di_ngang'].includes(String(trend?.direction)) &&
    isString(v.postingAdvice) &&
    isString(v.hashtagAdvice) &&
    Array.isArray(v.nextIdeas) &&
    v.nextIdeas.length > 0 &&
    typeof v.healthScore === 'number' &&
    Array.isArray(v.checklist)
  );
}

/** Dọn kết quả: ép điểm về 0–100, bỏ phần tử rỗng, giới hạn số lượng. */
function tidy(result: AnalysisResult): AnalysisResult {
  return {
    summary: result.summary.trim(),
    topVideos: result.topVideos.filter((t) => isString(t?.tiktokId) && isString(t?.why)).slice(0, 5),
    themes: result.themes.filter((t) => isString(t?.name)).slice(0, 6).map((t) => ({
      name: t.name,
      share: String(t.share ?? ''),
      performance: String(t.performance ?? ''),
    })),
    trend: { direction: result.trend.direction, reason: String(result.trend.reason ?? '') },
    postingAdvice: result.postingAdvice.trim(),
    hashtagAdvice: result.hashtagAdvice.trim(),
    nextIdeas: result.nextIdeas.filter((n) => isString(n?.hook)).slice(0, 6).map((n) => ({ hook: n.hook, idea: String(n.idea ?? '') })),
    healthScore: Math.max(0, Math.min(100, Math.round(result.healthScore))),
    checklist: result.checklist.filter(isString).slice(0, 8),
  };
}

/** JSON Schema cho chế độ JSON của Workers AI, khớp với AnalysisResult. */
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    topVideos: {
      type: 'array',
      items: { type: 'object', properties: { tiktokId: { type: 'string' }, why: { type: 'string' } }, required: ['tiktokId', 'why'] },
    },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, share: { type: 'string' }, performance: { type: 'string' } },
        required: ['name', 'share', 'performance'],
      },
    },
    trend: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['len', 'xuong', 'di_ngang'] }, reason: { type: 'string' } },
      required: ['direction', 'reason'],
    },
    postingAdvice: { type: 'string' },
    hashtagAdvice: { type: 'string' },
    nextIdeas: {
      type: 'array',
      items: { type: 'object', properties: { hook: { type: 'string' }, idea: { type: 'string' } }, required: ['hook', 'idea'] },
    },
    healthScore: { type: 'integer' },
    checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'topVideos', 'themes', 'trend', 'postingAdvice', 'hashtagAdvice', 'nextIdeas', 'healthScore', 'checklist'],
};

export interface AnalyzeOutcome {
  result: AnalysisResult | null;
  /** Lý do thất bại từng lần thử, rỗng nếu thành công */
  failures: string[];
}

/** `result` null khi Workers AI không gọi được hoặc cả ba lần thử đều hỏng. */
export async function analyzeCreator(
  ai: Ai | undefined,
  input: { handle: string; profile: CreatorProfile | null; metrics: CreatorMetrics; videos: VideoData[] },
): Promise<AnalyzeOutcome> {
  if (!ai) return { result: null, failures: ['Không có binding AI (chạy local)'] };
  const { value, failures } = await chatJsonDetailed<AnalysisResult>(
    ai,
    SYSTEM_PROMPT,
    buildUserPrompt(input.handle, input.profile, input.metrics, input.videos),
    { maxTokens: 3600, temperature: 0.4, validate: isAnalysisResult, schema: RESULT_SCHEMA },
  );
  return { result: value ? tidy(value) : null, failures };
}
