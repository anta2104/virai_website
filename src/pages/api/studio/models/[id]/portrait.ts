import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../../lib/guards';
import { getModel } from '../../../../../lib/studio/models';
import { generatePortrait } from '../../../../../lib/studio/portraits';

/**
 * Admin sinh (lại) ảnh đại diện cho một người mẫu ảo.
 *
 * Gọi: POST /api/studio/models/vm_linh/portrait (cần cookie admin). Mỗi lần
 * sinh một key mới để cache cũ không dính; ảnh cũ để lại trong R2, nhẹ thôi.
 */
export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'admin') return jsonResponse({ ok: false, error: 'Chỉ admin.' }, 403);

  const model = await getModel(params.id!);
  if (!model) return jsonResponse({ ok: false, error: 'Không có người mẫu này.' }, 404);

  try {
    const { key, prompt } = await generatePortrait(model);
    return jsonResponse({ ok: true, key, url: `/media/${key}`, prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
