/**
 * Lớp chịu lỗi cho D1: đọc được nguyên nhân thật và thử lại lỗi tạm thời.
 *
 * Để riêng, không import gì, để test được trực tiếp bằng Node.
 */

/**
 * Moi thông báo lỗi thật của D1.
 *
 * Drizzle bọc lỗi thành `Failed query: select ...` và nhét nguyên nhân thật vào
 * `error.cause`. Không đọc cause thì lúc D1 hỏng chỉ thấy câu truy vấn mà không
 * biết vì sao — đã gặp thật ngày 13/08/2026, phải đoán mất nhiều thời gian.
 */
export function describeDbError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }

  return parts.join(' ⟵ caused by ⟵ ');
}

/** Lỗi tạm thời thì thử lại có ích; lỗi cú pháp hay thiếu cột thì không. */
function looksTransient(error: unknown): boolean {
  const text = describeDbError(error).toLowerCase();
  if (/no such (table|column)|syntax error|unique constraint|not null constraint|foreign key/.test(text)) {
    return false;
  }
  return true;
}

const RETRY_DELAY_MS = 150;

/**
 * Chạy một truy vấn D1, lỗi tạm thời thì thử lại đúng một lần.
 *
 * D1 có thể chớp lỗi trong vài phút (đã gặp: toàn bộ truy vấn thất bại trong khi
 * D1 gọi qua API vẫn tốt). Một lần thử lại sau 150ms vớt được phần lớn trường
 * hợp đó mà không làm chậm đường chạy bình thường — khi không lỗi thì hàm này
 * chỉ là một lớp gọi hàm mỏng.
 *
 * Không nuốt lỗi: thử lại vẫn thất bại thì ném lại nguyên lỗi cho phía trên.
 */
export async function withDbRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!looksTransient(error)) {
      console.error(`[db] ${label} lỗi không phải tạm thời:`, describeDbError(error));
      throw error;
    }

    console.warn(`[db] ${label} lỗi, thử lại sau ${RETRY_DELAY_MS}ms:`, describeDbError(error));
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    try {
      const result = await run();
      console.log(`[db] ${label} thử lại thành công`);
      return result;
    } catch (retryError) {
      console.error(`[db] ${label} thất bại cả hai lần:`, describeDbError(retryError));
      throw retryError;
    }
  }
}
