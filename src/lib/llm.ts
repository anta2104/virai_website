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
  /**
   * JSON Schema cho chế độ JSON của Workers AI (response_format json_schema).
   * Có schema thì model bị ép trả đúng cấu trúc, đỡ hỏng vì thiếu dấu ngoặc.
   * Lần thử cuối bỏ schema đi, phòng model không hỗ trợ tham số này.
   */
  schema?: Record<string, unknown>;
}

export interface LlmJsonResult<T> {
  value: T | null;
  /** Lý do từng lần thử thất bại, để lưu lại mà soi khi không xem được log */
  failures: string[];
}

/**
 * Chữ Hán lẻ tẻ (vài ký tự) thì xoá đi được; dày đặc thì coi như bản hỏng.
 */
function stripSparseCjk(raw: string): string | null {
  const matches = raw.match(new RegExp(CJK_PATTERN.source, 'g'));
  if (!matches) return raw;
  if (matches.length > 12) return null;
  return raw.replace(new RegExp(CJK_PATTERN.source, 'g'), '');
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
export async function chatJsonDetailed<T>(
  ai: Ai,
  system: string,
  user: string,
  options: LlmJsonOptions = {},
): Promise<LlmJsonResult<T>> {
  // Lần 1-2 model chính (lần 2 không schema), lần 3 model nhỏ không schema
  const attempts: Array<{ model: string; useSchema: boolean }> = [
    { model: PRIMARY_MODEL, useSchema: Boolean(options.schema) },
    { model: PRIMARY_MODEL, useSchema: false },
    { model: FALLBACK_MODEL, useSchema: false },
  ];
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const failures: string[] = [];

  for (const [index, attempt] of attempts.entries()) {
    const label = `${attempt.model.split('/').pop()}${attempt.useSchema ? '+schema' : ''}`;
    try {
      const params: Record<string, unknown> = {
        messages,
        max_tokens: options.maxTokens ?? 1800,
        temperature: index === 0 ? (options.temperature ?? 0.4) : 0.2,
      };
      if (attempt.useSchema && options.schema) {
        params.response_format = { type: 'json_schema', json_schema: options.schema };
      }
      const result = (await ai.run(attempt.model as never, params as never)) as {
        response?: unknown;
      };

      // JSON mode có thể trả object sẵn thay vì chuỗi
      let value: unknown;
      if (result?.response && typeof result.response === 'object') {
        value = result.response;
      } else {
        const raw = stripSparseCjk(String(result?.response ?? ''));
        if (raw === null) {
          failures.push(`${label}: lẫn nhiều chữ Hán`);
          continue;
        }
        value = extractJson(raw);
      }

      if (options.validate && !options.validate(value)) {
        failures.push(`${label}: JSON sai cấu trúc (${JSON.stringify(value).slice(0, 120)})`);
        continue;
      }
      return { value: value as T, failures };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${label}: ${message.slice(0, 200)}`);
      console.error(`[llm] Lỗi với ${label}:`, message);
    }
  }
  return { value: null, failures };
}

export async function chatJson<T>(
  ai: Ai,
  system: string,
  user: string,
  options: LlmJsonOptions = {},
): Promise<T | null> {
  return (await chatJsonDetailed<T>(ai, system, user, options)).value;
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
