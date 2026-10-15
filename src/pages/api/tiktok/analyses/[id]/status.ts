import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../../lib/guards';
import { advanceAnalysis, getOwnedAnalysis, STATUS_LABEL } from '../../../../../lib/tiktok/service';

/** Trang kết quả gọi mỗi 3 giây cho tới khi `done` hoặc `failed`; mỗi lần gọi làm tiếp một bước. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ error: 'Bạn cần đăng nhập.' }, 401);

  let analysis = await getOwnedAnalysis(params.id!, user.id);
  if (!analysis) return jsonResponse({ error: 'Không tìm thấy phân tích.' }, 404);

  // Mỗi lần trang hỏi là máy chủ làm tiếp một bước ngay trong request này,
  // nên phân tích vẫn chạy trọn dù tác vụ nền của Worker có bị cắt.
  if (analysis.status !== 'done' && analysis.status !== 'failed') {
    analysis = (await advanceAnalysis(analysis.id)) ?? analysis;
  }

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
