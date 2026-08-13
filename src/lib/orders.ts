import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './db';
import { memorials, orders, type Memorial, type Order } from './db/schema';
import { newId } from './ids';
import { newPaymentCode } from './payment-code';
import { amountToCharge } from './plans';
import { ensureRemindersFor } from './reminders';
import { env } from './env';

export type OrderType = 'premium' | 'physical_combo';

export interface ShippingInfo {
  fullName: string;
  phone: string;
  address: string;
  /** 'kim_loai' | 'go' */
  material: string;
  note?: string;
}

/**
 * Số tiền tính vào đơn, lấy tại thời điểm tạo đơn nên đã bao gồm ưu đãi đang
 * chạy. Giá được chốt cứng vào `orders.amount`: khách tạo đơn trong đợt giảm
 * giá thì giữ giá đó kể cả khi chuyển khoản sau khi ưu đãi kết thúc.
 */
export function amountFor(type: OrderType): number {
  return amountToCharge(type === 'physical_combo' ? 'physicalCombo' : 'premium');
}

/**
 * Lấy đơn chờ thanh toán hiện có cho trang kỷ niệm này, hoặc tạo đơn mới.
 * Tái dùng đơn cũ để khách bấm lại không sinh ra hàng loạt mã chuyển khoản.
 */
export async function getOrCreateOrder(input: {
  userId: string;
  memorialId: string;
  type: OrderType;
  shippingInfo?: ShippingInfo | null;
}): Promise<Order> {
  const db = getDb(env.DB);

  const existing = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, input.userId),
        eq(orders.memorialId, input.memorialId),
        eq(orders.type, input.type),
        eq(orders.status, 'pending'),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (existing[0]) {
    if (input.shippingInfo) {
      await db
        .update(orders)
        .set({ shippingInfo: JSON.stringify(input.shippingInfo) })
        .where(eq(orders.id, existing[0].id));
      return { ...existing[0], shippingInfo: JSON.stringify(input.shippingInfo) };
    }
    return existing[0];
  }

  const order: Order = {
    id: newId(),
    userId: input.userId,
    memorialId: input.memorialId,
    type: input.type,
    amount: amountFor(input.type),
    paymentCode: newPaymentCode(env),
    status: 'pending',
    shippingInfo: input.shippingInfo ? JSON.stringify(input.shippingInfo) : null,
    note: null,
    createdAt: Math.floor(Date.now() / 1000),
    paidAt: null,
  };

  await db.insert(orders).values(order);
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = await getDb(env.DB).select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getOwnedOrder(id: string, userId: string): Promise<Order | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listOrdersOfUser(userId: string): Promise<Order[]> {
  return getDb(env.DB)
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

/** Tìm đơn theo nội dung chuyển khoản — dùng cho webhook và xác nhận tay. */
export async function findOrderByPaymentCode(code: string): Promise<Order | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(orders)
    .where(eq(orders.paymentCode, code.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Ghi nhận đã thanh toán: đổi trạng thái đơn và nâng trang kỷ niệm lên Premium.
 * Chạy lại nhiều lần cũng an toàn (webhook có thể gửi trùng).
 */
export async function markOrderPaid(
  order: Order,
  note: string,
): Promise<{ order: Order; memorial: Memorial | null }> {
  const db = getDb(env.DB);
  const now = Math.floor(Date.now() / 1000);

  if (order.status === 'pending') {
    await db
      .update(orders)
      .set({ status: 'paid', paidAt: now, note })
      .where(eq(orders.id, order.id));
  }

  let memorial: Memorial | null = null;
  if (order.memorialId) {
    await db
      .update(memorials)
      .set({ isPremium: 1, updatedAt: now })
      .where(eq(memorials.id, order.memorialId));

    const rows = await db.select().from(memorials).where(eq(memorials.id, order.memorialId)).limit(1);
    memorial = rows[0] ?? null;
    if (memorial) {
      await ensureRemindersFor(env.DB, memorial);
    }
  }

  return {
    order: { ...order, status: order.status === 'pending' ? 'paid' : order.status, paidAt: order.paidAt ?? now },
    memorial,
  };
}

export function parseShippingInfo(raw: string | null): ShippingInfo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShippingInfo;
  } catch {
    return null;
  }
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  shipped: 'Đã gửi hàng',
  done: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  premium: 'Nâng cấp Premium',
  physical_combo: 'Combo thẻ QR vật lý',
};

export const MATERIAL_LABEL: Record<string, string> = {
  kim_loai: 'Thẻ kim loại',
  go: 'Thẻ gỗ',
};
