import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/guards';
import { createCreditOrder } from '../../../lib/orders';

/** Tạo đơn nạp tín chỉ rồi trả id để trang chuyển sang màn thanh toán. */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ ok: false, error: 'Bạn cần đăng nhập.' }, 401);

  let packId = '';
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await request.json()) as { packId?: string };
      packId = String(payload.packId ?? '');
    } catch {
      return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
    }
  } else {
    try {
      const form = await request.formData();
      packId = String(form.get('packId') ?? '');
    } catch {
      return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
    }
  }

  const order = await createCreditOrder(user.id, packId);
  if (!order) return jsonResponse({ ok: false, error: 'Gói nạp không hợp lệ.' }, 400);

  if (!contentType.includes('application/json')) {
    return new Response(null, { status: 303, headers: { location: `/tai-khoan/thanh-toan/${order.id}` } });
  }
  return jsonResponse({ ok: true, orderId: order.id });
};
