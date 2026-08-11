// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://virai.com.vn',
  output: 'server',

  // Chặn CSRF cho form POST (không ảnh hưởng webhook vì webhook gửi JSON)
  security: {
    checkOrigin: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    sitemap({
      // Chỉ index trang công khai, không index khu vực tài khoản/admin/api
      filter: (page) =>
        !/\/(tai-khoan|admin|api)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  adapter: cloudflare({
    imageService: 'compile',
    // Workers AI chỉ chạy được qua kết nối remote. Mặc định tắt để build/dev
    // được khi chưa `wrangler login`; bật bằng: CF_REMOTE=1 npm run dev
    remoteBindings: process.env.CF_REMOTE === '1',
  }),
});
