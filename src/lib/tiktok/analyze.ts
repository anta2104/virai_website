/**
 * Phân tích định tính bằng LLM trên bảng chỉ số đã tính sẵn.
 *
 * LLM chỉ nhận số đã tính và caption; không được tự tính hay bịa số.
 */
import { chatJsonDetailed } from '../llm';
import { WEEKDAY_LABEL, bestSlots, compactNumber, percent, type CreatorMetrics } from './metrics';
import type { CreatorProfile, VideoData } from './provider';
import type { Insights } from './insights';

export interface AnalysisResult {
  summary: string;
  topVideos: Array<{ tiktokId: string; why: string }>;
  themes: Array<{ name: string; share: string; performance: string }>;
  trend: { direction: 'len' | 'xuong' | 'di_ngang'; reason: string };
  postingAdvice: string;
  hashtagAdvice: string;
  nextIdeas: Array<{
    hook: string;
    idea: string;
    /** Định dạng gợi ý, ví dụ "nói trước camera 30 giây", "vlog 60 giây" */
    format?: string;
    /** 3–5 hashtag nên dùng, không có # */
    hashtags?: string[];
    /** Vì sao tin là sẽ chạy, dẫn từ video/chỉ số nào của chính kênh */
    why?: string;
  }>;
  /** Một câu chốt: nên đăng khi nào, dẫn từ số liệu giờ/thứ */
  bestTimeAdvice?: string;
  /** Chân dung người xem SUY LUẬN từ nội dung, không phải số đo. UI phải ghi rõ. */
  audience?: {
    who: string;
    age: string;
    gender: string;
    location: string;
    interests: string[];
    whenOnline: string;
    /** Dựa vào đâu mà suy ra */
    basis: string;
  };
  /** Điều kênh đang làm tốt, mỗi điều kèm bằng chứng là số */
  strengths?: Array<{ claim: string; evidence: string }>;
  /** Điều đang kéo kênh xuống, kèm bằng chứng */
  weaknesses?: Array<{ claim: string; evidence: string }>;
  /** Lịch đăng 2 tuần tới: 4–6 mục */
  plan?: Array<{ day: string; hour: string; title: string; ideaIndex?: number }>;
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
- nextIdeas: 5 ý tưởng video tiếp theo, mỗi ý gồm: "hook" là câu nói ra trong 2 giây đầu (1 dòng, cụ thể, không chung chung); "idea" mô tả 1–2 câu phải làm gì trong video; "format" là định dạng và độ dài (ví dụ "nói trước camera 30 giây", "vlog 45 giây", "trước/sau 20 giây"); "hashtags" 3–5 hashtag lấy từ hashtag đã hiệu quả của chính kênh (không có #); "why" một câu nói rõ ý tưởng này dựa vào video hay chỉ số nào của kênh (ví dụ "lặp lại công thức của 2 video review mỹ phẩm đạt 35K và 34K view"). Ý tưởng phải tái dụng công thức mở đầu đã chạy tốt của kênh, không được chung chung kiểu "giới thiệu về...". Hook KHÔNG được bắt đầu bằng "Bạn đã sẵn sàng", "Bạn có biết", "Bạn muốn biết"; hãy bắt chước cách mở đầu trong caption của chính các video nổi bật (ví dụ kênh hay dùng "Sự thật không ai nói với bạn về..." thì viết hook theo mẫu đó với chủ đề mới). Trong "why" và mọi chỗ khác, gọi video bằng vài chữ đầu caption trong ngoặc kép, KHÔNG dùng dãy số id.
- checklist: mỗi việc phải đo được và có mốc (ví dụ "Đăng 2 video vào thứ ba 22h trong 2 tuần tới"), không viết chung chung kiểu "tăng cường tương tác".
- bestTimeAdvice: một câu chốt nên đăng thứ mấy, giờ nào, dẫn đúng số trung vị đã cho.
- audience: chân dung người xem SUY LUẬN từ caption, hashtag, bio và chủ đề (TikTok không cho số đo nhân khẩu học). "who" một câu mô tả; "age" khoảng tuổi; "gender" tỉ lệ ước lượng bằng chữ; "location" nơi ở; "interests" 3–5 mối quan tâm; "whenOnline" họ hay xem lúc nào (dẫn từ khung giờ tốt); "basis" nói rõ suy ra từ dấu hiệu nào. Không bịa số phần trăm.
- strengths: 2–4 điều kênh đang làm tốt. Mỗi điều "claim" một câu khẳng định, "evidence" là con số cụ thể lấy từ bảng (ví dụ "công thức 'sự thật không ai' 5 video, trung vị 34K, gấp 24 lần kênh").
- weaknesses: 2–4 điều đang kéo kênh xuống, cùng cấu trúc, kèm bằng chứng số. Ví dụ nhịp đăng thưa, nhóm nội dung kém, hashtag ồn, độ dài không hợp.
- plan: lịch đăng 2 tuần tới, 4–6 mục, mỗi mục "day" (ví dụ "Thứ ba tuần này"), "hour" (ví dụ "22h"), "title" tên video ngắn, "ideaIndex" số thứ tự ý tưởng trong nextIdeas (1–5) nếu lấy từ đó. Chỉ dùng khung giờ và thứ đã được chứng minh tốt trong bảng.
- healthScore: 0–100, cân nhắc tần suất đăng, tỉ lệ tương tác, tỉ lệ lưu/chia sẻ, có video nổi bật hay không.
- checklist: 3–6 việc cụ thể nên làm trong 2 tuần tới.

Chỉ trả về JSON đúng cấu trúc sau, không giải thích gì thêm, không bọc trong markdown:
{"summary":"...","audience":{"who":"...","age":"...","gender":"...","location":"...","interests":["..."],"whenOnline":"...","basis":"..."},"strengths":[{"claim":"...","evidence":"..."}],"weaknesses":[{"claim":"...","evidence":"..."}],"topVideos":[{"tiktokId":"...","why":"..."}],"themes":[{"name":"...","share":"...","performance":"..."}],"trend":{"direction":"len|xuong|di_ngang","reason":"..."},"postingAdvice":"...","bestTimeAdvice":"...","hashtagAdvice":"...","nextIdeas":[{"hook":"...","idea":"...","format":"...","hashtags":["..."],"why":"..."}],"plan":[{"day":"...","hour":"...","title":"...","ideaIndex":1}],"healthScore":0,"checklist":["..."]}`;

function describeSlots(metrics: CreatorMetrics): string {
  const hours = bestSlots(metrics.byHour).map((s) => `${s.slot}h (${s.count} video, trung vị ${compactNumber(s.medianViews)} view)`);
  const days = bestSlots(metrics.byWeekday).map(
    (s) => `${WEEKDAY_LABEL[s.slot]} (${s.count} video, trung vị ${compactNumber(s.medianViews)} view)`,
  );
  return [`Khung giờ tốt nhất: ${hours.join('; ') || 'chưa đủ dữ liệu'}`, `Thứ tốt nhất: ${days.join('; ') || 'chưa đủ dữ liệu'}`].join('\n');
}

function pct(value: number): string {
  return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
}

function describeInsights(insights: Insights): string[] {
  const lines: string[] = ['', '== Insight tính sẵn từ dữ liệu =='];
  if (insights.patterns.length) {
    lines.push('Công thức mở đầu caption (4 chữ đầu) và hiệu quả:');
    for (const p of insights.patterns) {
      lines.push(`- "${p.template}…": ${p.count} video, trung vị ${compactNumber(p.medianViews)} view (gấp ${p.multiple.toFixed(1)} lần kênh). Ví dụ: ${p.example.slice(0, 100)}`);
    }
  } else {
    lines.push('Công thức mở đầu: kênh chưa lặp lại cách mở đầu nào (mỗi caption một kiểu).');
  }
  if (insights.durations.length) {
    lines.push(
      `Độ dài và view: ${insights.durations.map((d) => `${d.label} ${d.count} video trung vị ${compactNumber(d.medianViews)} (x${d.multiple.toFixed(1)})`).join('; ')}`,
    );
  }
  if (insights.format.slideshowCount > 0) {
    lines.push(`Ảnh slideshow: ${insights.format.slideshowCount} bài trung vị ${compactNumber(insights.format.slideshowMedian)} view, so với video ${compactNumber(insights.format.videoMedian)}.`);
  }
  if (insights.halves) {
    lines.push(`Nửa cũ (${insights.halves.firstCount} video) trung vị ${compactNumber(insights.halves.firstMedian)} → nửa mới (${insights.halves.secondCount} video) trung vị ${compactNumber(insights.halves.secondMedian)}: ${pct(insights.halves.change)}.`);
  }
  if (insights.viewsPerFollower !== null) {
    lines.push(`Trung vị view / follower = ${insights.viewsPerFollower.toFixed(2)} (trên 1 là video vươn ra ngoài tệp theo dõi nhờ For You).`);
  }
  if (insights.mostSaved) lines.push(`Video được lưu nhiều nhất (lưu/view ${pct(insights.mostSaved.rate)}): ${(insights.mostSaved.caption ?? '').slice(0, 100)}`);
  if (insights.mostShared) lines.push(`Video được chia sẻ nhiều nhất (share/view ${pct(insights.mostShared.rate)}): ${(insights.mostShared.caption ?? '').slice(0, 100)}`);
  if (insights.mostCommented) lines.push(`Video được bình luận nhiều nhất (bình luận/view ${pct(insights.mostCommented.rate)}): ${(insights.mostCommented.caption ?? '').slice(0, 100)}`);
  if (insights.tagOpportunities.length) {
    lines.push(`Hashtag dùng ít nhưng view cao (nên dùng thêm): ${insights.tagOpportunities.map((t) => `#${t.name} (${t.count} video, trung vị ${compactNumber(t.medianViews)})`).join('; ')}`);
  }
  if (insights.tagNoise.length) {
    lines.push(`Hashtag dùng nhiều mà view thấp (tiếng ồn): ${insights.tagNoise.map((t) => `#${t.name} (${t.count} video, trung vị ${compactNumber(t.medianViews)})`).join('; ')}`);
  }
  const r = insights.rhythm;
  if (r.avgGapDays !== null) {
    lines.push(`Nhịp đăng: trung bình ${r.avgGapDays.toFixed(1)} ngày một video, khoảng nghỉ dài nhất ${r.maxGapDays?.toFixed(0)} ngày, video mới nhất cách đây ${r.daysSinceLast?.toFixed(0)} ngày.`);
  }
  return lines;
}

export function buildUserPrompt(
  handle: string,
  profile: CreatorProfile | null,
  metrics: CreatorMetrics,
  videos: VideoData[],
  insights?: Insights,
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
    ...(insights ? describeInsights(insights) : []),
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

/** Model hay dẫn video bằng dãy id 19 số; đổi sang vài chữ đầu caption cho người đọc hiểu. */
function humanizeIds(text: string, captionById: Map<string, string>): string {
  return text.replace(/\b(7\d{17,18})\b/g, (id) => {
    const caption = captionById.get(id);
    return caption ? `“${caption.slice(0, 50)}${caption.length > 50 ? '…' : ''}”` : 'video nổi bật';
  });
}

/** Dọn kết quả: ép điểm về 0–100, bỏ phần tử rỗng, giới hạn số lượng, đổi id video thành caption. */
function tidy(result: AnalysisResult, videos: VideoData[]): AnalysisResult {
  const captionById = new Map(videos.map((v) => [v.tiktokId, (v.caption ?? '').replace(/#\S+/g, '').trim()]));
  const h = (text: unknown) => humanizeIds(String(text ?? ''), captionById);
  return {
    summary: h(result.summary).trim(),
    topVideos: result.topVideos
      .filter((t) => isString(t?.tiktokId) && isString(t?.why))
      .slice(0, 5)
      .map((t) => ({ tiktokId: t.tiktokId, why: h(t.why) })),
    themes: result.themes.filter((t) => isString(t?.name)).slice(0, 6).map((t) => ({
      name: t.name,
      share: String(t.share ?? ''),
      performance: String(t.performance ?? ''),
    })),
    trend: { direction: result.trend.direction, reason: h(result.trend.reason) },
    postingAdvice: h(result.postingAdvice).trim(),
    hashtagAdvice: h(result.hashtagAdvice).trim(),
    nextIdeas: result.nextIdeas
      .filter((n) => isString(n?.hook))
      .slice(0, 6)
      .map((n) => ({
        hook: n.hook.trim().replace(/^[“"']+|[”"']+$/g, ''),
        idea: h(n.idea),
        format: isString(n.format) ? n.format : undefined,
        hashtags: Array.isArray(n.hashtags)
          ? n.hashtags.filter(isString).map((h) => h.replace(/^#/, '').trim()).filter(Boolean).slice(0, 6)
          : undefined,
        why: isString(n.why) ? h(n.why) : undefined,
      })),
    bestTimeAdvice: isString(result.bestTimeAdvice) ? result.bestTimeAdvice.trim() : undefined,
    audience:
      result.audience && typeof result.audience === 'object' && isString(result.audience.who)
        ? {
            who: h(result.audience.who),
            age: String(result.audience.age ?? ''),
            gender: String(result.audience.gender ?? ''),
            location: String(result.audience.location ?? ''),
            interests: Array.isArray(result.audience.interests) ? result.audience.interests.filter(isString).slice(0, 6) : [],
            whenOnline: String(result.audience.whenOnline ?? ''),
            basis: h(result.audience.basis),
          }
        : undefined,
    strengths: Array.isArray(result.strengths)
      ? result.strengths.filter((x) => isString(x?.claim)).slice(0, 4).map((x) => ({ claim: h(x.claim), evidence: h(x.evidence) }))
      : undefined,
    weaknesses: Array.isArray(result.weaknesses)
      ? result.weaknesses.filter((x) => isString(x?.claim)).slice(0, 4).map((x) => ({ claim: h(x.claim), evidence: h(x.evidence) }))
      : undefined,
    plan: Array.isArray(result.plan)
      ? result.plan
          .filter((x) => isString(x?.title))
          .slice(0, 6)
          .map((x) => ({
            day: String(x.day ?? ''),
            hour: String(x.hour ?? ''),
            title: h(x.title),
            ideaIndex: Number.isInteger(x.ideaIndex) && Number(x.ideaIndex) >= 1 ? Number(x.ideaIndex) : undefined,
          }))
      : undefined,
    healthScore: Math.max(0, Math.min(100, Math.round(result.healthScore))),
    checklist: result.checklist.filter(isString).map(h).slice(0, 8),
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
    bestTimeAdvice: { type: 'string' },
    audience: {
      type: 'object',
      properties: {
        who: { type: 'string' },
        age: { type: 'string' },
        gender: { type: 'string' },
        location: { type: 'string' },
        interests: { type: 'array', items: { type: 'string' } },
        whenOnline: { type: 'string' },
        basis: { type: 'string' },
      },
      required: ['who', 'age', 'gender', 'location', 'interests', 'whenOnline', 'basis'],
    },
    strengths: {
      type: 'array',
      items: { type: 'object', properties: { claim: { type: 'string' }, evidence: { type: 'string' } }, required: ['claim', 'evidence'] },
    },
    weaknesses: {
      type: 'array',
      items: { type: 'object', properties: { claim: { type: 'string' }, evidence: { type: 'string' } }, required: ['claim', 'evidence'] },
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { day: { type: 'string' }, hour: { type: 'string' }, title: { type: 'string' }, ideaIndex: { type: 'integer' } },
        required: ['day', 'hour', 'title'],
      },
    },
    nextIdeas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hook: { type: 'string' },
          idea: { type: 'string' },
          format: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
        },
        required: ['hook', 'idea', 'format', 'hashtags', 'why'],
      },
    },
    healthScore: { type: 'integer' },
    checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'audience', 'strengths', 'weaknesses', 'topVideos', 'themes', 'trend', 'postingAdvice', 'hashtagAdvice', 'nextIdeas', 'plan', 'healthScore', 'checklist'],
};

export interface AnalyzeOutcome {
  result: AnalysisResult | null;
  /** Lý do thất bại từng lần thử, rỗng nếu thành công */
  failures: string[];
}

/** `result` null khi Workers AI không gọi được hoặc cả ba lần thử đều hỏng. */
export async function analyzeCreator(
  ai: Ai | undefined,
  input: { handle: string; profile: CreatorProfile | null; metrics: CreatorMetrics; videos: VideoData[]; insights?: Insights },
): Promise<AnalyzeOutcome> {
  if (!ai) return { result: null, failures: ['Không có binding AI (chạy local)'] };
  const { value, failures } = await chatJsonDetailed<AnalysisResult>(
    ai,
    SYSTEM_PROMPT,
    buildUserPrompt(input.handle, input.profile, input.metrics, input.videos, input.insights),
    { maxTokens: 5200, temperature: 0.4, validate: isAnalysisResult, schema: RESULT_SCHEMA },
  );
  return { result: value ? tidy(value, input.videos) : null, failures };
}
