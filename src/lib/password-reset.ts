import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb, withDbRetry } from './db';
import { passwordResetTokens, sessions, users } from './db/schema';
import { hashPassword } from './auth';
import { randomToken } from './ids';

/** Link đặt lại sống 1 giờ — đủ để mở hộp thư, không đủ để quên rồi bị lợi dụng. */
const TOKEN_TTL_SECONDS = 60 * 60;

/** Tối đa 3 yêu cầu mỗi email mỗi giờ, đếm bằng chính bảng token. */
const MAX_REQUESTS_PER_HOUR = 3;

/**
 * Băm token trước khi lưu.
 *
 * Database chỉ giữ SHA-256; token thô chỉ tồn tại trong email của người dùng.
 * SHA-256 trần là đủ ở đây (khác với mật khẩu): token dài 32 byte ngẫu nhiên
 * nên không có gì để dò từ điển.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ResetRequest {
  /** Token thô để đặt vào link trong email */
  token: string;
  userName: string;
  userEmail: string;
}

/**
 * Tạo yêu cầu đặt lại mật khẩu.
 *
 * Trả về `null` khi email không có tài khoản **hoặc** khi vượt hạn mức — người
 * gọi hiển thị cùng một thông báo cho mọi trường hợp, không tiết lộ email nào
 * đang tồn tại.
 */
export async function createResetRequest(
  d1: D1Database,
  rawEmail: string,
): Promise<ResetRequest | null> {
  const db = getDb(d1);
  const email = rawEmail.trim().toLowerCase();

  const rows = await withDbRetry('createResetRequest', () =>
    db.select().from(users).where(eq(users.email, email)).limit(1),
  );
  const user = rows[0];
  if (!user) return null;

  const now = Math.floor(Date.now() / 1000);
  const recent = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gt(passwordResetTokens.createdAt, now - 3600),
      ),
    );
  if (recent.length >= MAX_REQUESTS_PER_HOUR) return null;

  const token = randomToken(32);
  await db.insert(passwordResetTokens).values({
    id: await hashToken(token),
    userId: user.id,
    expiresAt: now + TOKEN_TTL_SECONDS,
    usedAt: null,
    createdAt: now,
  });

  return { token, userName: user.name, userEmail: user.email };
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Đổi mật khẩu bằng token.
 *
 * Đổi xong thì **xoá toàn bộ session của người đó**: nếu tài khoản từng bị người
 * khác đăng nhập, đổi mật khẩu phải đá họ ra khỏi mọi thiết bị.
 */
export async function completeReset(
  d1: D1Database,
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const db = getDb(d1);
  const id = await hashToken(token);

  const rows = await withDbRetry('completeReset', () =>
    db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, id)).limit(1),
  );
  const record = rows[0];

  const invalid = { ok: false, error: 'Link đã hết hạn hoặc đã được dùng rồi. Bạn gửi lại yêu cầu mới nhé.' } as const;
  if (!record) return invalid;
  if (record.usedAt !== null) return invalid;
  if (record.expiresAt * 1000 < Date.now()) return invalid;

  const passwordHash = await hashPassword(newPassword);

  // Đánh dấu đã dùng trước tiên, và chỉ khi vẫn còn chưa dùng. Hai lần bấm cùng
  // lúc thì chỉ một lần đi tiếp; lần kia thấy 0 dòng và dừng lại.
  const claimed = await db
    .update(passwordResetTokens)
    .set({ usedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });
  if (claimed.length === 0) return invalid;

  await db.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
  await db.delete(sessions).where(eq(sessions.userId, record.userId));

  return { ok: true };
}

/** Token còn dùng được không — để trang đặt lại báo sớm thay vì bắt nhập rồi mới báo. */
export async function isTokenUsable(d1: D1Database, token: string): Promise<boolean> {
  const db = getDb(d1);
  const id = await hashToken(token);
  const rows = await withDbRetry('isTokenUsable', () =>
    db
      .select({ expiresAt: passwordResetTokens.expiresAt, usedAt: passwordResetTokens.usedAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id))
      .limit(1),
  );
  const record = rows[0];
  return Boolean(record && record.usedAt === null && record.expiresAt * 1000 >= Date.now());
}
