import type { Memorial, User } from './db/schema';
import { getOwnedMemorial } from './memorials';
import { env } from './env';

/** Middleware đã chặn khách chưa đăng nhập, hàm này chỉ để TypeScript yên tâm. */
export function currentUser(locals: App.Locals): User {
  const user = locals.user;
  if (!user) throw new Error('Route này phải nằm sau middleware bảo vệ');
  return user;
}

export function requireAdmin(locals: App.Locals): User {
  const user = currentUser(locals);
  if (user.role !== 'admin') throw new Error('Chỉ admin');
  return user;
}

/** Lấy trang kỷ niệm thuộc về người đang đăng nhập, hoặc null nếu không có quyền. */
export async function ownedMemorial(
  locals: App.Locals,
  id: string | undefined,
): Promise<Memorial | null> {
  if (!id) return null;
  const user = currentUser(locals);
  return getOwnedMemorial(env.DB, id, user.id);
}

/**
 * Tạo Response 404 mới mỗi lần gọi — body của Response chỉ đọc được một lần
 * nên không dùng chung một instance giữa các request.
 */
export function notFound(message = 'Không tìm thấy trang kỷ niệm'): Response {
  return new Response(message, {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * So sánh hai chuỗi bí mật trong thời gian không phụ thuộc nội dung.
 *
 * `===` thoát ra ngay ở ký tự khác đầu tiên, nên thời gian trả lời hé lộ được
 * bao nhiêu ký tự đầu là đúng. Dùng cho mọi chỗ đối chiếu secret/token.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
