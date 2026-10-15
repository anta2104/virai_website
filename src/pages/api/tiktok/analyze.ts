import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/guards';
import { waitUntil } from '../../../lib/env';
import { normalizeHandle } from '../../../lib/tiktok/handle';
import { createAnalysis, runAnalysis } from '../../../lib/tiktok/service';

/** Nhận link hoặc @handle, tạo phân tích và chạy nền; trả về id để trang kết quả poll. */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ ok: false, error: 'Bạn cần đăng nhập.' }, 401);

  let input = '';
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as { input?: unknown };
      input = String(payload.input ?? '');
    } else {
      const form = await request.formData();
      input = String(form.get('input') ?? '');
    }
  } catch {
    return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
  }

  const handle = normalizeHandle(input);
  if (!handle) {
    return jsonResponse(
      { ok: false, error: 'Link hoặc tên kênh không hợp lệ. Ví dụ: https://www.tiktok.com/@tenkenh hoặc @tenkenh' },
      400,
    );
  }

  const { analysis, reused } = await createAnalysis({ userId: user.id, handle });
  if (!reused) {
    waitUntil(
      locals,
      runAnalysis(analysis.id).catch((error) => console.error('[tiktok] runAnalysis lỗi:', error)),
    );
  }

  return jsonResponse({ ok: true, id: analysis.id, handle, reused });
};
