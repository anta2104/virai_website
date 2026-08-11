import type { APIRoute } from 'astro';
import { getOwnedOrder } from '../../../../lib/orders';
import { jsonResponse } from '../../../../lib/guards';

/** Trang thanh toán gọi endpoint này mỗi 5 giây để biết tiền đã vào chưa. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ error: 'Bạn cần đăng nhập.' }, 401);

  const order = await getOwnedOrder(params.id!, user.id);
  if (!order) return jsonResponse({ error: 'Không tìm thấy đơn.' }, 404);

  return new Response(JSON.stringify({ status: order.status, paidAt: order.paidAt }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
