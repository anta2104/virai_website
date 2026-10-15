import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/guards';
import { createJob, runJob } from '../../../lib/studio/service';
import { ensureWelcomeCredits } from '../../../lib/credits';
import { waitUntil } from '../../../lib/env';

/** Tạo buổi chụp ảnh. Nhận multipart từ form ở /nguoi-mau-ao/tao. */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ ok: false, error: 'Bạn cần đăng nhập.' }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
  }

  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);

  await ensureWelcomeCredits(user.id);

  const result = await createJob({
    userId: user.id,
    modelId: String(form.get('modelId') ?? ''),
    productName: String(form.get('productName') ?? ''),
    productDescription: String(form.get('productDescription') ?? ''),
    category: String(form.get('category') ?? ''),
    scene: String(form.get('sceneCustom') ?? '').trim() || String(form.get('scene') ?? ''),
    count: Number(form.get('count') ?? 1),
    notes: String(form.get('notes') ?? ''),
    source: String(form.get('source') ?? ''),
    files,
  });

  if (!result.ok) {
    const status = result.code === 'credits' ? 402 : result.code === 'model' ? 404 : 400;
    return jsonResponse(result, status);
  }

  waitUntil(
    locals,
    runJob(result.job.id).catch((error) => console.error('[studio] runJob lỗi ngoài dự kiến:', error)),
  );

  return jsonResponse({ ok: true, id: result.job.id });
};
