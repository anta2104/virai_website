/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Người dùng của session hiện tại, do middleware gán. */
    user: import('./lib/db/schema').User | null;
  }
}

/**
 * Secret chưa có trong `worker-configuration.d.ts`.
 *
 * `wrangler types` sinh file đó từ wrangler.jsonc và `.dev.vars` của máy đang
 * chạy, nên secret nào chưa đặt ở máy này sẽ vắng mặt. Khai ở đây để code vẫn
 * kiểm kiểu được, và để optional vì đúng là có thể chưa cấu hình — chỗ dùng
 * phải tự kiểm tra trước (xem `googleAuthConfigured`).
 */
interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
