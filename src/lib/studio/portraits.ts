/**
 * Ảnh chân dung của người mẫu ảo.
 *
 * Sinh bằng Workers AI, lưu R2, ghi key vào `virtual_models.portrait_key`.
 * Hai đường vào: admin bấm sinh lại (API), và tự sinh ở nền khi có người mở
 * trang mà người mẫu chưa có ảnh — cách sau để production tự lo lấy, không cần
 * ai đăng nhập wrangler hay bấm gì. Mỗi isolate chỉ sinh một ảnh cho một người
 * mẫu tại một thời điểm; isolate khác có thể sinh trùng, chỉ tốn thêm một lần
 * gọi model, ảnh sau ghi đè key là xong.
 */
import { setPortrait, type ModelView } from './models';
import { pickImageProvider } from './provider';
import { buildPortraitPrompt } from './prompt';
import { env, waitUntil } from '../env';

export async function generatePortrait(model: ModelView): Promise<{ key: string; prompt: string }> {
  const prompt = buildPortraitPrompt({ promptBase: model.persona.promptBase, style: model.persona.style });
  const bytes = await pickImageProvider(env).generate({ prompt, width: 1024, height: 1024 });
  const key = `studio/models/${model.model.id}/portrait-${Date.now()}.png`;
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
  });
  await setPortrait(model.model.id, key);
  return { key, prompt };
}

/** Đang sinh, hoặc vừa hỏng gần đây (chờ một lúc rồi mới thử lại) */
const inFlight = new Set<string>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 10 * 60 * 1000;

/**
 * Lên lịch sinh ảnh ở nền cho những người mẫu chưa có ảnh. Gọi từ trang hiển
 * thị danh sách; không chặn response. Không có binding AI (dev local) thì thôi.
 */
export function ensurePortraits(models: ModelView[], locals: App.Locals): void {
  if (!env.AI || !env.BUCKET) return;
  const now = Date.now();

  for (const model of models) {
    const id = model.model.id;
    if (model.portraitUrl || inFlight.has(id)) continue;
    const lastFailure = failedAt.get(id);
    if (lastFailure && now - lastFailure < RETRY_AFTER_MS) continue;

    inFlight.add(id);
    const task = generatePortrait(model)
      .then(({ key }) => {
        failedAt.delete(id);
        console.log(`[studio] Đã sinh ảnh chân dung cho ${model.model.name}: ${key}`);
      })
      .catch((error) => {
        failedAt.set(id, Date.now());
        console.error(`[studio] Không sinh được ảnh chân dung cho ${model.model.name}:`, error);
      })
      .finally(() => inFlight.delete(id));
    waitUntil(locals, task);
  }
}
