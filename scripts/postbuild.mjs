/**
 * Chạy sau `astro build`.
 *
 * Adapter Cloudflare chỉ export `fetch`, không export `scheduled`, nên Cron Trigger
 * không gọi được gì. Ta bọc entry của Astro bằng một entry nhỏ có thêm `scheduled`,
 * handler này gọi thẳng vào route /api/cron/reminders trong cùng Worker.
 *
 * Lưu ý: không thêm rule CompiledWasm ở đây. Wrangler đã có rule mặc định cho file
 * .wasm; khai thêm một rule cùng loại sẽ che rule mặc định và làm file wasm của
 * workers-og bị bỏ qua khi upload.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SERVER_DIR = path.resolve('dist/server');
const CONFIG_PATH = path.join(SERVER_DIR, 'wrangler.json');
const WRAPPER_NAME = 'cron-entry.mjs';

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

// Entry bọc thêm handler scheduled
const astroEntry = config.main;
if (!astroEntry) {
  throw new Error('Không tìm thấy "main" trong dist/server/wrangler.json');
}

if (astroEntry !== WRAPPER_NAME) {
  const wrapper = `// Tự sinh bởi scripts/postbuild.mjs — đừng sửa tay.
import astroWorker from './${astroEntry}';

export default {
  fetch: astroWorker.fetch,

  /** Cron Trigger hằng ngày: gọi vào route gửi email nhắc tưởng niệm. */
  async scheduled(event, env, ctx) {
    const request = new Request('https://cron.internal/api/cron/reminders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cron-secret': env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ cron: event.cron, scheduledTime: event.scheduledTime }),
    });

    const task = astroWorker
      .fetch(request, env, ctx)
      .then((response) => response.text())
      .then((body) => console.log('[cron] reminders:', body))
      .catch((error) => console.error('[cron] lỗi:', error));

    ctx.waitUntil(task);
  },
};
`;
  await writeFile(path.join(SERVER_DIR, WRAPPER_NAME), wrapper, 'utf8');
  config.main = WRAPPER_NAME;
}

await writeFile(CONFIG_PATH, JSON.stringify(config), 'utf8');
console.log(`[postbuild] main=${config.main}`);
