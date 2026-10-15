import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../../lib/guards';
import { getOwnedJob, parseResultKeys } from '../../../../../lib/studio/service';

/** Trang job gọi mỗi 3 giây để biết ảnh đã xong chưa. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ error: 'Bạn cần đăng nhập.' }, 401);

  const job = await getOwnedJob(params.id!, user.id);
  if (!job) return jsonResponse({ error: 'Không tìm thấy buổi chụp.' }, 404);

  return new Response(
    JSON.stringify({
      status: job.status,
      done: parseResultKeys(job.resultKeysJson).length,
      error: job.error,
    }),
    {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
};
