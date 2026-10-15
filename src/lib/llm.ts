/**
 * Gọi Workers AI trả về JSON theo cấu trúc cố định.
 *
 * Dùng chung cho phân tích TikTok và studio người mẫu ảo. Tách khỏi `ai.ts`
 * (viết bài tưởng niệm) vì hai nơi dùng khác hạn mức và khác cách kiểm tra kết quả.
 */

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/** Ký tự Hán/Nhật — Llama đôi khi chèn vào giữa câu tiếng Việt. */
export const CJK_PATTERN = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿･-ﾟ]/;

export interface LlmJsonOptions {
  maxTokens?: number;
  temperature?: number;
  /** Trả về true nếu kết quả chấp nhận được; sai thì thử model kế tiếp */
  validate?: (value: unknown) => boolean;
}

/**
 * Lấy khối JSON đầu tiên trong văn bản model trả về. Model hay bọc trong ```json
 * hoặc thêm một câu dẫn trước, nên không parse thẳng.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '');
  const start = text.search(/[[{]/);
  if (start === -1) throw new Error('Không thấy JSON trong kết quả');
  const open = text[start]!;
  const close = open === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  if (end <= start) throw new Error('JSON không đóng');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Gọi model và parse JSON. Thử model chính hai lần rồi lùi về model nhỏ.
 * Trả null khi cả ba lần đều hỏng — chỗ gọi tự quyết định hiển thị gì.
 */
export async function chatJson<T>(
  ai: Ai,
  system: string,
  user: string,
  options: LlmJsonOptions = {},
): Promise<T | null> {
  const attempts = [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL];
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  for (const [index, model] of attempts.entries()) {
    try {
      const result = (await ai.run(model as never, {
        messages,
        max_tokens: options.maxTokens ?? 1800,
        temperature: index === 0 ? (options.temperature ?? 0.4) : 0.2,
      } as never)) as { response?: string };

      const raw = String(result?.response ?? '');
      if (CJK_PATTERN.test(raw)) {
        console.warn(`[llm] ${model} lẫn chữ Hán, thử lại`);
        continue;
      }
      const value = extractJson(raw);
      if (options.validate && !options.validate(value)) {
        console.warn(`[llm] ${model} trả JSON sai cấu trúc, thử lại`);
        continue;
      }
      return value as T;
    } catch (error) {
      console.error(`[llm] Lỗi với model ${model}:`, error);
    }
  }
  return null;
}

/** Gọi model trả văn bản thuần (prompt sinh ảnh, kịch bản). */
export async function chatText(
  ai: Ai,
  system: string,
  user: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const result = (await ai.run(model as never, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: options.maxTokens ?? 500,
        temperature: options.temperature ?? 0.5,
      } as never)) as { response?: string };
      const text = String(result?.response ?? '').trim();
      if (text) return text;
    } catch (error) {
      console.error(`[llm] Lỗi với model ${model}:`, error);
    }
  }
  return null;
}
