# Hướng dẫn deploy website Virai (virai.com.vn)

## Checklist trước deploy (bắt buộc)

Mở [`src/data/site.ts`](src/data/site.ts) và cập nhật:

| Trường | Hiện tại | Cần làm |
|--------|----------|---------|
| `contact.email` | `tanvn@virai.com.vn` | Đã cập nhật |
| `contact.phone` | `0966286480` | Đã cập nhật |
| `contact.address` | `Việt Nam` | Địa chỉ đầy đủ |
| `PUBLIC_FORMSPREE_FORM_ID` | (env trên Cloudflare) | [Formspree](https://formspree.io) → tạo form → dán ID vào biến môi trường |

Sau khi sửa, chạy:

```bash
npm run build
npm run preview   # kiểm tra tại http://localhost:4321
```

Kiểm tra tay: menu mobile, 3 section giải pháp, form (gửi thử), link `mailto:` / `tel:`.

---

## Thêm / thay file SVG (logo, mockup...)

1. **Kéo thả** file `.svg` vào thư mục `public/` (hoặc `public/images/mockups/`).
2. Trong Cursor: chuột phải file → **Reveal in Finder** để mở đúng thư mục.
3. Tham chiếu trên website: đường dẫn bắt đầu từ `/`, ví dụ file `public/logo-icon.svg` → dùng `src="/logo-icon.svg"`.

| File | Mục đích |
|------|----------|
| `public/logo-icon.svg` | Logo icon gốc (vuông, 200×200) — favicon, app icon |
| `public/logo.svg` | Logo ngang (icon + chữ Virai) — header, footer |
| `public/images/mockups/*.svg` | Mockup UI các giải pháp |

**Thay logo:** ghi đè `public/logo-icon.svg` bằng file SVG của bạn (giữ `viewBox="0 0 200 200"` nếu có thể). Sau đó chạy lại `npm run build`.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:4321

## Build production

```bash
npm run build
```

Output: thư mục `dist/`

## Form liên hệ (Formspree)

1. Đăng ký https://formspree.io
2. Tạo form mới, copy Form ID
3. Sửa `src/data/site.ts` → `contact.formEndpoint`: `https://formspree.io/f/XXXXXXXX`

## GitHub repository

```bash
git init
git remote add origin git@github.com:anta2104/virai_website.git
git add .
git commit -m "Website giới thiệu Virai"
git branch -M main
git push -u origin main
```

## Deploy Cloudflare Pages (miễn phí)

1. Push code lên GitHub (xem mục GitHub repository)
2. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Chọn repo `anta2104/virai_website`
4. **Build settings:**
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** `22` (hoặc file `.node-version`)
5. **Environment variables** (Production):
   - `PUBLIC_FORMSPREE_FORM_ID` = Form ID từ [Formspree](https://formspree.io) (email: tanvn@virai.com.vn)
6. **Save and Deploy** → đợi build xong → URL `virai-website.pages.dev`

## DNS virai.com.vn

**Cách 1 — Domain trên Cloudflare (khuyến nghị):**

1. Cloudflare Pages → project → **Custom domains** → **Set up a custom domain**
2. Nhập `virai.com.vn` và `www.virai.com.vn`
3. Cloudflare tự thêm DNS records

**Cách 2 — DNS thủ công:**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `www` | `<tên-project>.pages.dev` | Bật |
| CNAME | `@` | `<tên-project>.pages.dev` | Bật (nếu registrar hỗ trợ CNAME flattening) |

SSL: tự động (Full). Kiểm tra sau 5–30 phút: https://virai.com.vn

## Form liên hệ sau deploy

1. Đăng ký Formspree, tạo form nhận về `tanvn@virai.com.vn`
2. Copy Form ID (phần sau `/f/` trong URL)
3. Cloudflare Pages → **Settings** → **Environment variables** → thêm `PUBLIC_FORMSPREE_FORM_ID`
4. **Redeploy** project

Trước khi cấu hình Formspree: nút **Gửi yêu cầu** mở app email với nội dung đã điền; nút **Hoặc gửi email trực tiếp** luôn hoạt động.

## Cập nhật thông tin liên hệ

Sửa file `src/data/site.ts` — các trường `contact.email`, `contact.phone`, `contact.address`.
