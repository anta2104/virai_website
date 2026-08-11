# Virai Memorial

Nền tảng tạo trang tưởng niệm thú cưng: ảnh, câu chuyện (có AI viết giúp), sổ lưu bút, mã QR chia sẻ,
ảnh Open Graph tự sinh, và email nhắc ngày 49 / ngày giỗ **theo âm lịch**.

Chạy trên Cloudflare Workers: Astro 6 (SSR) + Tailwind 4 + D1 + R2 + Workers AI.

## Chạy local

```bash
npm install
cp .dev.vars.example .dev.vars   # rồi điền giá trị, ít nhất SESSION_SECRET
npm run db:migrate:local         # tạo bảng trong D1 local
npm run db:seed:local            # (tuỳ chọn) 3 trang mẫu cho landing page
npm run dev                      # http://localhost:4321
```

Tài khoản admin: đăng ký bằng đúng email đặt ở `ADMIN_EMAIL` trong `.dev.vars` là tự có quyền admin.

**Workers AI ở local**: binding `AI` chỉ chạy qua kết nối remote. Mặc định remote binding bị tắt để
`npm run dev` chạy được khi chưa đăng nhập Cloudflare. Muốn thử tính năng "Nhờ AI viết giúp" thật:

```bash
npx wrangler login
CF_REMOTE=1 npm run dev
```

Không có AI thì mọi thứ khác vẫn chạy bình thường, nút "Nhờ AI viết giúp" chỉ báo lỗi nhẹ nhàng.

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build + chèn handler cron vào output |
| `npm run check` | Kiểm tra type (astro check) |
| `npm run db:generate` | Sinh migration mới từ `src/lib/db/schema.ts` |
| `npm run db:migrate:local` / `db:migrate` | Chạy migration local / production |
| `npm run db:seed:local` / `db:seed` | Nạp 3 trang mẫu |
| `npm run deploy` | Build và deploy lên Cloudflare |

## Cấu trúc

```
src/
  lib/
    lunar.ts          Chuyển âm ⇄ dương lịch (thuật toán Hồ Ngọc Đức, không phụ thuộc thư viện)
    memorial-dates.ts Mốc 49 ngày / 100 ngày / giỗ hằng năm
    reminders.ts      Lịch nhắc và việc dời sang lần giỗ sau
    email.ts          Gửi email qua Resend + nội dung email
    ai.ts             "Nhờ AI viết giúp" (Workers AI) + hạn mức theo ngày
    og.ts             Ảnh Open Graph 1200×630 (workers-og / satori + resvg)
    qr.ts             Mã QR (uqr) và thẻ QR in sẵn dạng SVG
    vietqr.ts         Chuỗi thanh toán VietQR chuẩn EMVCo
    orders.ts         Đơn hàng, xác nhận thanh toán, nâng Premium
    plans.ts          Giá và hạn mức từng gói — sửa giá ở đây
    site.ts           Tên thương hiệu, email, URL — sửa brand ở đây
    db/               Schema Drizzle + kết nối D1
  pages/
    index.astro                    Landing
    be/[slug]/                     Trang kỷ niệm công khai, og.png, qr.svg
    tai-khoan/                     Dashboard + wizard 5 bước + thanh toán
    admin/                         Quản trị
    api/                           upload, ai/bio, tribute, webhook/payment, cron/reminders
migrations/                        SQL do drizzle-kit sinh
scripts/postbuild.mjs              Chèn handler `scheduled` + rule WASM vào output
scripts/seed-demo.sql              Dữ liệu mẫu
```

Xem [DEPLOY.md](./DEPLOY.md) để đưa lên production.

## Ghi chú kỹ thuật

- **Không dùng `Astro.locals.runtime.env`** — Astro 6 đã bỏ. Import `env` từ `src/lib/env.ts`.
- **Cron**: adapter Cloudflare chỉ export `fetch`, nên `scripts/postbuild.mjs` bọc thêm handler
  `scheduled` gọi vào `POST /api/cron/reminders` với header `x-cron-secret`.
  Handler này **không chạy được ở local** (`wrangler dev` bọc Worker bằng asset-worker, lớp bọc
  không chuyển tiếp `scheduled`) — xem cách kiểm tra và phương án dự phòng trong DEPLOY.md.
  Ở local cứ gọi thẳng route bằng `x-cron-secret`, hoặc dùng nút trong `/admin`.
- **Font cho OG image**: `public/fonts/BeVietnamPro-*.ttf` (giấy phép OFL, xem `public/fonts/OFL.txt`).
  Cần font tiếng Việt vì satori không tự có glyph dấu.
- **Ảnh**: nén phía client (canvas, cạnh dài tối đa 1600px) trước khi tải lên R2.
- **Quy ước ngày 49**: tính ngày bé rời đi là ngày thứ nhất, nên ngày 49 = ngày mất + 48 ngày.
