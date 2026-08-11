import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { aiUsage } from './db/schema';
import { newId } from './ids';
import { todayInVietnam } from './format';
import { limitsFor } from './plans';
import { SPECIES_LABEL } from './format';

/**
 * Model chính và model dự phòng trên Workers AI.
 * Nếu tài khoản chưa bật model 70B, hệ thống tự lùi về model 8B.
 */
const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export interface StoryNotes {
  /** Bé đến với gia đình thế nào */
  howWeMet?: string;
  /** Tính cách, tật đáng yêu */
  personality?: string;
  /** Món ăn, món đồ, chỗ ngủ bé thích */
  favourites?: string;
  /** Kỷ niệm đáng nhớ nhất */
  bestMemory?: string;
  /** Điều bạn muốn nói với bé */
  message?: string;
}

export const STORY_QUESTIONS: Array<{
  key: keyof StoryNotes;
  label: string;
  placeholder: string;
}> = [
  {
    key: 'howWeMet',
    label: 'Bé đến với bạn như thế nào?',
    placeholder: 'Ví dụ: mình nhận bé từ một bạn cứu hộ ở Hà Đông, hồi đó bé mới hơn một tháng, gầy lắm.',
  },
  {
    key: 'personality',
    label: 'Bé có tính cách hay tật gì đáng yêu?',
    placeholder: 'Ví dụ: rất nhát người lạ nhưng bám mình như hình với bóng, hay ngồi trước cửa đợi mình về.',
  },
  {
    key: 'favourites',
    label: 'Bé thích gì nhất?',
    placeholder: 'Ví dụ: thích cá hấp, thích nằm phơi nắng ở ban công buổi chiều, thích quả bóng vàng cũ.',
  },
  {
    key: 'bestMemory',
    label: 'Kỷ niệm nào bạn nhớ nhất?',
    placeholder: 'Ví dụ: lần cả nhà đi Đà Lạt, bé say xe nhưng vẫn cố ngóc đầu nhìn ra cửa sổ suốt đường.',
  },
  {
    key: 'message',
    label: 'Nếu được nói với bé một câu, bạn sẽ nói gì?',
    placeholder: 'Ví dụ: cảm ơn con vì đã chọn nhà mình. Ngủ ngoan nhé.',
  },
];

export interface BioContext {
  petName: string;
  species: string;
  breed?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  notes: StoryNotes;
}

function buildPrompt(context: BioContext): string {
  const speciesLabel = SPECIES_LABEL[context.species] ?? 'bạn nhỏ';
  const lines: string[] = [
    `Tên bé: ${context.petName}`,
    `Loài: ${speciesLabel}${context.breed ? ` (${context.breed})` : ''}`,
  ];
  if (context.birthDate) lines.push(`Ngày sinh: ${context.birthDate}`);
  if (context.deathDate) lines.push(`Ngày bé rời đi: ${context.deathDate}`);

  for (const question of STORY_QUESTIONS) {
    const answer = context.notes[question.key]?.trim();
    if (answer) lines.push(`${question.label} ${answer}`);
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `Bạn là người viết giúp chủ nuôi một bài tưởng niệm ngắn về thú cưng đã qua đời.

Yêu cầu về ngôn ngữ:
- Viết bằng tiếng Việt tự nhiên, giọng ấm áp và bình tĩnh, ngôi thứ nhất ("mình" hoặc "tôi" tuỳ giọng của ghi chú).
- CHỈ dùng chữ Latin có dấu tiếng Việt. Tuyệt đối không dùng chữ Hán, chữ Trung Quốc, chữ Nhật hay bất kỳ ký tự nào không thuộc tiếng Việt.

Yêu cầu về nội dung:
- Dài 3 đến 4 đoạn, tổng 200-300 từ. Ngắn mà thật thì tốt hơn dài mà rỗng.
- CHỈ dùng chi tiết có trong ghi chú. Tuyệt đối không bịa thêm sự kiện, tên người, địa danh.
- Đặc biệt không suy diễn về bệnh tật, cơn đau, việc bé "đã hết đau khổ", "được yên nghỉ", hay nguyên nhân bé mất — nếu ghi chú không nói thì bạn không biết.
- Không nhắc lại câu hỏi gợi ý. Đừng viết kiểu "Nếu được nói với bé một câu, mình sẽ nói:" — hãy lồng câu đó vào mạch văn tự nhiên.
- Không dùng sáo ngữ kiểu "thiên đường của các bé", "cầu vồng", "người bạn bốn chân trung thành". Không lên gân, không giảng giải về sự mất mát.
- Không nhận xét chung về giống loài ("với tính cách đặc trưng của loài này"). Chỉ viết về đúng bé này.

Yêu cầu về định dạng:
- Không mở đầu bằng lời chào hay câu dẫn kiểu "Dưới đây là bài viết". Trả về đúng nội dung bài viết.
- Không dùng markdown, không tiêu đề, không gạch đầu dòng. Chỉ các đoạn văn cách nhau bằng một dòng trống.`;

export interface BioResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** Số lần còn lại trong ngày */
  remaining?: number;
}

/** Số lần đã dùng trong ngày và hạn mức của gói. */
async function quotaState(
  d1: D1Database,
  userId: string,
  isPremium: boolean,
): Promise<{ used: number; max: number; day: string }> {
  const db = getDb(d1);
  const day = todayInVietnam();
  const max = limitsFor(isPremium).aiRewritesPerDay;
  const rows = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
    .limit(1);
  return { used: rows[0]?.count ?? 0, max, day };
}

/**
 * Ghi nhận một lần dùng AI. Chỉ gọi sau khi model trả về kết quả — lần gọi lỗi
 * không nên trừ hạn mức của người dùng.
 */
async function recordUsage(d1: D1Database, userId: string, day: string): Promise<void> {
  const db = getDb(d1);
  const rows = await db
    .select({ id: aiUsage.id })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
    .limit(1);

  if (rows[0]) {
    await db
      .update(aiUsage)
      .set({ count: sql`${aiUsage.count} + 1` })
      .where(eq(aiUsage.id, rows[0].id));
  } else {
    await db.insert(aiUsage).values({ id: newId(), userId, day, count: 1 });
  }
}

/**
 * Ký tự Hán/Nhật. Llama đôi khi chèn lẫn chữ Trung vào giữa câu tiếng Việt
 * (đã gặp thật: "Bông sẽ 表现 sự hạnh phúc"), nên phải phát hiện và loại bỏ bản đó.
 */
const CJK_PATTERN = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿･-ﾟ]/;

/** Dọn kết quả model: bỏ markdown thừa, bỏ câu dẫn, chuẩn hoá dòng trống. */
function cleanUp(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '');
  text = text.replace(/^(Dưới đây là|Đây là)[^\n]*\n+/i, '');
  text = text.replace(/^#+\s.*$/gm, '');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Bản viết dùng được: đủ dài và không lẫn ký tự ngoài tiếng Việt. */
function isUsable(text: string): boolean {
  return text.length > 200 && !CJK_PATTERN.test(text);
}

export async function generateBio(
  env: Env,
  input: { userId: string; isPremium: boolean; context: BioContext },
): Promise<BioResult> {
  const filled = STORY_QUESTIONS.filter((q) => input.context.notes[q.key]?.trim()).length;
  if (filled === 0) {
    return { ok: false, error: 'Bạn trả lời giúp ít nhất một câu gợi ý để AI có gì mà viết nhé.' };
  }

  const quota = await quotaState(env.DB, input.userId, input.isPremium);
  if (quota.used >= quota.max) {
    return {
      ok: false,
      remaining: 0,
      error: input.isPremium
        ? 'Bạn đã dùng hết số lần nhờ AI trong hôm nay. Mai bạn thử lại nhé.'
        : `Gói miễn phí được ${quota.max} lần nhờ AI mỗi ngày. Bạn thử lại mai, hoặc nâng cấp Premium để dùng nhiều hơn.`,
    };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildPrompt(input.context) },
  ];

  // Thử model chính hai lần (model đôi khi lẫn chữ Hán), rồi mới lùi về model nhỏ
  const attempts = [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL];

  for (const [index, model] of attempts.entries()) {
    try {
      const result = (await env.AI.run(model as never, {
        messages,
        max_tokens: 900,
        // Lần thử lại hạ nhiệt độ cho model bám sát yêu cầu hơn
        temperature: index === 0 ? 0.7 : 0.5,
      } as never)) as { response?: string };

      const text = cleanUp(String(result?.response ?? ''));
      if (isUsable(text)) {
        await recordUsage(env.DB, input.userId, quota.day);
        return { ok: true, text, remaining: quota.max - quota.used - 1 };
      }
      console.warn(
        `Workers AI (${model}) trả về bản không dùng được: ${text.length} ký tự, lẫn chữ Hán = ${CJK_PATTERN.test(text)}`,
      );
    } catch (error) {
      console.error(`Workers AI lỗi với model ${model}:`, error);
    }
  }

  return {
    ok: false,
    error: 'Hiện chưa gọi được AI. Bạn thử lại sau ít phút, hoặc tự viết rồi sửa sau cũng được.',
    remaining: quota.max - quota.used,
  };
}

export async function remainingAiQuota(
  d1: D1Database,
  userId: string,
  isPremium: boolean,
): Promise<number> {
  const db = getDb(d1);
  const day = todayInVietnam();
  const max = limitsFor(isPremium).aiRewritesPerDay;
  const rows = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
    .limit(1);
  return Math.max(0, max - (rows[0]?.count ?? 0));
}
