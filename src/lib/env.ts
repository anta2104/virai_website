import { env as cloudflareEnv } from 'cloudflare:workers';

/**
 * Bindings và secrets của Worker.
 *
 * Astro 6 / @astrojs/cloudflare 13 đã bỏ `Astro.locals.runtime.env`; cách đúng
 * hiện nay là import từ `cloudflare:workers`. Gom vào một chỗ để sau này API có
 * đổi nữa thì chỉ sửa file này.
 */
export const env = cloudflareEnv as Env;

/**
 * `waitUntil` cho việc chạy nền (gửi email, tăng bộ đếm lượt ghé thăm).
 *
 * `locals.cfContext` do adapter `@astrojs/cloudflare` gán sẵn — không tự gán ở
 * middleware, và **không** đọc `locals.runtime.ctx`: Astro 6 đã bỏ, chạm vào là
 * ném lỗi. Lúc `astro dev` thì không có context, việc nền vẫn chạy nhưng không
 * được bảo đảm; chỉ cảnh báo khi bản build production thiếu, vì khi ấy việc nền
 * có thể bị cắt ngang giữa chừng sau khi response đã trả về.
 */
export function waitUntil(locals: App.Locals, promise: Promise<unknown>): void {
  const ctx = locals.cfContext;
  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
    return;
  }
  if (import.meta.env.PROD) {
    console.warn('[env] Thiếu locals.cfContext — việc chạy nền có thể bị cắt giữa chừng');
  }
  void promise;
}
