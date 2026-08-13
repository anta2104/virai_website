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
      // Chỉ những trang tĩnh đáng cho công cụ tìm kiếm biết. Loại khu tài
      // khoản/admin/api, và loại cả các trang đăng nhập/đăng ký/đặt lại mật
      // khẩu — chúng không có nội dung gì để tìm kiếm.
      //
      // Các trang /be/[slug] không nằm ở đây vì chạy SSR. Trang nào chủ nuôi
      // bật "Hiện trong vườn" thì có mặt ở /sitemap-vuon.xml (sinh lúc chạy).
      filter: (page) =>
        !/\/(tai-khoan|admin|api|dang-nhap|dang-ky|dang-xuat|quen-mat-khau|dat-lai-mat-khau)(\/|$)/.test(
          new URL(page).pathname,
        ),
    }),
  ],
  adapter: cloudflare({
    imageService: 'compile',
    // Workers AI chỉ chạy được qua kết nối remote. Mặc định tắt để build/dev
    // được khi chưa `wrangler login`; bật bằng: CF_REMOTE=1 npm run dev
    remoteBindings: process.env.CF_REMOTE === '1',
  }),
});
