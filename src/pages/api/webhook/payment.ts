import type { APIRoute } from 'astro';
import { findOrderByPaymentCode, markOrderPaid } from '../../../lib/orders';
import { jsonResponse } from '../../../lib/guards';
import { env } from '../../../lib/env';
import { paymentCodePattern } from '../../../lib/payment-code';

/**
 * Webhook nhận thông báo biến động số dư (SePay).
 *
 * Cấu hình trên SePay: URL `https://virai.com.vn/api/webhook/payment`,
 * kiểu xác thực API Key → header `Authorization: Apikey <PAYMENT_WEBHOOK_SECRET>`.
 *
 * Tên field trong payload có thể khác nhau giữa các nhà cung cấp nên hàm đọc
 * theo nhiều tên gọi. Mã đơn được dò bằng regex trong nội dung chuyển khoản.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const match = /^(?:Apikey|Bearer|ApiKey|apikey)\s+(.+)$/.exec(header.trim());
  if (match && timingSafeEqual(match[1]!.trim(), secret)) return true;

  const custom = request.headers.get('x-webhook-secret');
  return Boolean(custom && timingSafeEqual(custom.trim(), secret));
}

function firstString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] PAYMENT_WEBHOOK_SECRET chưa được cấu hình');
    return jsonResponse({ success: false, error: 'Webhook chưa được cấu hình' }, 500);
  }

  if (!isAuthorized(request, secret)) {
    console.warn('[webhook] Yêu cầu bị từ chối vì sai khoá');
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ success: false, error: 'Body không phải JSON' }, 400);
  }

  // Chỉ xử lý tiền vào; nếu nhà cung cấp không gửi field này thì bỏ qua kiểm tra
  const direction = firstString(payload, ['transferType', 'transfer_type', 'type']);
  if (direction && direction.toLowerCase() !== 'in') {
    return jsonResponse({ success: true, ignored: 'Không phải giao dịch tiền vào' });
  }

  const haystack = [
    firstString(payload, ['code']),
    firstString(payload, ['content']),
    firstString(payload, ['description']),
    firstString(payload, ['referenceCode', 'reference_code']),
  ]
    .join(' ')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ');

  // Thử trên chuỗi còn khoảng trắng trước: mã đứng thành từ riêng thì chắc chắn
  // đúng. Chỉ khi không thấy mới bỏ hết khoảng trắng — cách này vớt được trường
  // hợp ngân hàng chèn dấu cách vào giữa mã, nhưng dễ khớp nhầm qua ranh giới
  // hai từ nên để làm phương án sau.
  const pattern = paymentCodePattern(env);
  const found = pattern.exec(haystack) ?? pattern.exec(haystack.replace(/\s+/g, ''));

  if (!found) {
    // Log cả payload thô: nội dung thật của ngân hàng là thứ duy nhất giúp dò
    // được vì sao không khớp (đã gặp thật: VietinBank chèn BANKAPINOTIFY, mã FT...).
    console.warn(
      '[webhook] Không tìm thấy mã đơn. Chuỗi đã chuẩn hoá:',
      haystack,
      '| payload thô:',
      JSON.stringify(payload).slice(0, 800),
    );
    return jsonResponse({ success: true, matched: false });
  }

  const order = await findOrderByPaymentCode(found[0]);
  if (!order) {
    // Có thể là khớp nhầm qua ranh giới từ (ví dụ nội dung chỉ có "SEVQR" trơ trọi
    // rồi tới mã giao dịch của ngân hàng), nên log kèm payload thô để đối chiếu.
    console.warn(
      '[webhook] Mã đơn không có trong hệ thống:',
      found[0],
      '| payload thô:',
      JSON.stringify(payload).slice(0, 800),
    );
    return jsonResponse({ success: true, matched: false });
  }

  if (order.status !== 'pending') {
    return jsonResponse({ success: true, alreadyProcessed: true, orderId: order.id });
  }

  const amount = firstNumber(payload, ['transferAmount', 'transfer_amount', 'amount', 'money']);
  if (amount === null || amount < order.amount) {
    console.warn(
      `[webhook] Số tiền chưa đủ cho đơn ${order.paymentCode}: nhận ${amount}, cần ${order.amount}`,
    );
    return jsonResponse({
      success: true,
      matched: true,
      paid: false,
      reason: 'Số tiền chưa đủ — cần xác nhận tay',
    });
  }

  await markOrderPaid(
    order,
    `Tự động qua webhook: ${JSON.stringify(payload).slice(0, 900)}`,
  );

  console.log(`[webhook] Đơn ${order.paymentCode} đã thanh toán ${amount}đ`);
  return jsonResponse({ success: true, matched: true, paid: true, orderId: order.id });
};
