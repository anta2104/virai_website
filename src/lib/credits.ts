import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { creditLedger, type CreditEntry } from './db/schema';
import { newId } from './ids';
import { WELCOME_CREDITS } from './plans';
import { env } from './env';

/**
 * Tín chỉ cho studio người mẫu ảo.
 *
 * Sổ cái chỉ thêm dòng, không sửa dòng cũ; số dư là tổng `delta`. Mỗi cặp
 * (reason, ref_id) chỉ ghi được một lần nhờ unique index — webhook thanh toán
 * gọi trùng, hay job hoàn tiền hai lần, đều không cộng đúp.
 */

export type CreditReason = 'topup' | 'job' | 'refund' | 'bonus' | 'admin';

export const CREDIT_REASON_LABEL: Record<string, string> = {
  topup: 'Nạp tín chỉ',
  job: 'Buổi chụp ảnh',
  refund: 'Hoàn tín chỉ',
  bonus: 'Tặng',
  admin: 'Điều chỉnh',
};

export async function balanceOf(userId: string): Promise<number> {
  const rows = await getDb(env.DB)
    .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

export async function listLedger(userId: string, limit = 50): Promise<CreditEntry[]> {
  return getDb(env.DB)
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

/**
 * Ghi một dòng vào sổ cái. Trả `false` nếu cặp (reason, refId) đã có — tức là
 * lần gọi này trùng và không làm gì.
 */
export async function grant(
  userId: string,
  delta: number,
  reason: CreditReason,
  refId: string,
): Promise<boolean> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`delta tín chỉ không hợp lệ: ${delta}`);
  }
  try {
    await getDb(env.DB).insert(creditLedger).values({ id: newId(), userId, delta, reason, refId });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/** Tặng tín chỉ chào mừng một lần cho mỗi tài khoản khi ghé studio lần đầu. */
export async function ensureWelcomeCredits(userId: string): Promise<void> {
  if (WELCOME_CREDITS <= 0) return;
  await grant(userId, WELCOME_CREDITS, 'bonus', `welcome:${userId}`);
}

/**
 * Trừ tín chỉ cho một job. Trả `false` nếu không đủ số dư; khi ấy không ghi gì.
 *
 * Kiểm tra số dư và ghi sổ là hai câu lệnh riêng nên hai request cùng lúc có
 * thể cùng qua kiểm tra. Chấp nhận ở quy mô hiện tại: số dư âm chỉ xảy ra khi
 * người dùng cố tình bấm song song, và họ cũng chỉ lỗ về phía nhà cung cấp.
 */
export async function chargeForJob(userId: string, jobId: string, cost: number): Promise<boolean> {
  if (cost <= 0) return true;
  const balance = await balanceOf(userId);
  if (balance < cost) return false;
  return grant(userId, -cost, 'job', jobId);
}

/** Hoàn tín chỉ của job bị lỗi. Gọi nhiều lần cũng chỉ hoàn một lần. */
export async function refundJob(userId: string, jobId: string, cost: number): Promise<boolean> {
  if (cost <= 0) return false;
  return grant(userId, cost, 'refund', jobId);
}
