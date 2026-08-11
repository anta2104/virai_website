import { env as cloudflareEnv } from 'cloudflare:workers';

/**
 * Bindings và secrets của Worker.
 *
 * Astro 6 / @astrojs/cloudflare 13 đã bỏ `Astro.locals.runtime.env`; cách đúng
 * hiện nay là import từ `cloudflare:workers`. Gom vào một chỗ để sau này API có
 * đổi nữa thì chỉ sửa file này.
 */
export const env = cloudflareEnv as Env;

/** `waitUntil` cho việc chạy nền (ví dụ tăng bộ đếm lượt ghé thăm). */
export function waitUntil(locals: App.Locals, promise: Promise<unknown>): void {
  const ctx = locals.cfContext;
  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    void promise;
  }
}
