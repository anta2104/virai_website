import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../../lib/guards';
import { getOwnedAnalysis, STATUS_LABEL } from '../../../../../lib/tiktok/service';

/** Trang kết quả gọi mỗi 3 giây cho tới khi `done` hoặc `failed`. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ error: 'Bạn cần đăng nhập.' }, 401);

  const analysis = await getOwnedAnalysis(params.id!, user.id);
  if (!analysis) return jsonResponse({ error: 'Không tìm thấy phân tích.' }, 404);

  return new Response(
    JSON.stringify({
      status: analysis.status,
      label: STATUS_LABEL[analysis.status] ?? analysis.status,
      error: analysis.error,
      finishedAt: analysis.finishedAt,
    }),
    {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
};
