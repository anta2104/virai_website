import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../../lib/guards';
import { getModel, setPortrait } from '../../../../../lib/studio/models';
import { pickImageProvider } from '../../../../../lib/studio/provider';
import { buildPortraitPrompt } from '../../../../../lib/studio/prompt';
import { env } from '../../../../../lib/env';

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

  const prompt = buildPortraitPrompt({ promptBase: model.persona.promptBase, style: model.persona.style });
  try {
    const bytes = await pickImageProvider(env).generate({ prompt, width: 1024, height: 1024 });
    const key = `studio/models/${model.model.id}/portrait-${Date.now()}.png`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
    });
    await setPortrait(model.model.id, key);
    return jsonResponse({ ok: true, key, url: `/media/${key}`, prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: message, prompt }, 500);
  }
};
