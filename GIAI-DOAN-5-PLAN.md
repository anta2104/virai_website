# Giai Đoạn 5: Gia Cố Nền Tảng + Tính Năng Tăng Trưởng

> Tài liệu đặc tả triển khai cho Virai Memorial (nền tảng tưởng niệm thú cưng). MVP đã hoàn thành ~95% (xem `PET-MEMORIAL-PLAN.md` cho kiến trúc gốc). Tài liệu này mô tả đợt cập nhật tiếp theo: **Phần A (gia cố, làm trước)** và **Phần B (tính năng tăng trưởng, làm sau)**.
>
> **Nguyên tắc chung:** làm tuần tự A1 → A5 rồi B1 → B4, mỗi mục hoàn thành và chạy thử được rồi mới sang mục kế. Không refactor ngoài phạm vi. Giữ nguyên ngôn ngữ thiết kế UI hiện có và tiếng Việt cho mọi UI/email.

---

## Hiện trạng hệ thống (đã review 13/08/2026)

- Astro 6 SSR (`output: 'server'`) + Tailwind 4, deploy Cloudflare Workers.
- Bindings: `DB` (D1 + Drizzle, schema tại `src/lib/db/schema.ts`, migrations tại `migrations/`), `BUCKET` (R2), `AI` (Workers AI), cron `0 1 * * *`.
- Auth tự xây: PBKDF2 + session cookie HMAC (`src/lib/auth.ts`), middleware bảo vệ `/tai-khoan/*` và `/admin/*` (`src/middleware.ts`).
- **Thanh toán: SePay** (VietQR + webhook biến động số dư tại `src/pages/api/webhook/payment.ts`, xác nhận tay trong `/admin/don-hang`). **GIỮ NGUYÊN SePay** — không chuyển sang PayOS.
- Email: Resend qua REST (`src/lib/email.ts`). Âm lịch tự viết (`src/lib/lunar.ts`), nhắc 49 ngày/100 ngày/giỗ âm qua cron (`src/pages/api/cron/reminders.ts`).
- Giá hiện hành trong `src/lib/plans.ts`: Premium 119k, Combo thẻ vật lý 299k, promo 50% đến 31/08.

---

## PHẦN A — GIA CỐ (bắt buộc, làm trước)

### A1. Quên mật khẩu (ưu tiên cao nhất)

**Vấn đề:** khách trả tiền Premium mà quên mật khẩu là mất quyền truy cập vĩnh viễn — hiện không có cách tự khôi phục.

**Triển khai:**

1. Migration mới — bảng `password_reset_tokens`:
   - `id` (token dạng random 32+ bytes, lưu **hash SHA-256** của token chứ không lưu token thô), `user_id`, `expires_at` (1 giờ), `used_at` (nullable), `created_at`.
2. Trang `/quen-mat-khau`: form nhập email. Xử lý POST:
   - Luôn hiện thông báo chung "Nếu email tồn tại, chúng tôi đã gửi link đặt lại" (không tiết lộ email có tồn tại hay không).
   - Nếu email tồn tại: sinh token, gửi email qua Resend với link `https://<domain>/dat-lai-mat-khau?token=...`. Rate limit: tối đa 3 yêu cầu/email/giờ (đếm bằng bảng token).
3. Trang `/dat-lai-mat-khau`: nhận `token` từ query, form đặt mật khẩu mới (2 ô, tối thiểu 8 ký tự). Xử lý POST:
   - Verify: hash token khớp, chưa hết hạn, chưa `used_at`.
   - Cập nhật `password_hash`, đánh dấu `used_at`, **xóa toàn bộ sessions của user** (bắt đăng nhập lại mọi nơi), redirect về `/dang-nhap` với thông báo thành công.
4. Thêm link "Quên mật khẩu?" vào trang `/dang-nhap`.
5. Template email tiếng Việt, cùng phong cách các email hiện có trong `src/lib/email.ts`.

### A2. Sửa wiring `waitUntil` trên Workers

**Vấn đề:** `src/lib/env.ts` đọc `locals.cfContext` nhưng middleware không hề gán field này → các tác vụ nền (gửi email báo lưu bút mới, tăng visit count) rơi vào fallback `void promise` và có thể bị Workers cắt giữa chừng sau khi response trả về.

**Triển khai:** trong `src/middleware.ts`, lấy execution context từ adapter Cloudflare (`locals.runtime.ctx` theo chuẩn `@astrojs/cloudflare`) và gán vào `locals.cfContext` (hoặc sửa `env.ts` đọc thẳng `locals.runtime.ctx`). Khai báo type trong `src/env.d.ts`. Kiểm tra mọi chỗ gọi background task đều đi qua helper này.

### A3. Email giao dịch

**Vấn đề:** khách thanh toán xong không nhận được email nào — thiếu tin cậy với mô hình chuyển khoản.

**Triển khai:** thêm vào `src/lib/email.ts` và gọi tại các điểm chuyển trạng thái đơn (cả webhook `markOrderPaid` lẫn xác nhận tay ở admin):

1. **Đơn được xác nhận thanh toán** → email "Đã nhận thanh toán — Premium đã kích hoạt cho bé [tên]" kèm link trang kỷ niệm. Với đơn combo: thêm đoạn "Thẻ QR sẽ được gửi trong X ngày".
2. **Đơn vật lý chuyển sang shipped** (admin bấm) → email "Thẻ kỷ niệm của bé [tên] đã được gửi đi" kèm thông tin ship đã lưu trong `orders.shipping_info`.
3. Mọi email gửi qua `waitUntil` (sau khi A2 xong), lỗi gửi email không được làm hỏng flow chính.

### A4. Sửa 3 lỗi đã phát hiện

1. **`src/components/PhotoUploader.astro`**: có nhánh dùng `bitmap.width` sau khi đã gọi `bitmap.close()` → đọc kích thước vào biến trước khi close.
2. **`src/pages/api/cron/reminders.ts`**: so sánh cron secret bằng `===` → dùng so sánh timing-safe (đã có pattern sẵn trong `src/pages/api/webhook/payment.ts`, trích thành helper dùng chung nếu tiện).
3. **Tháng nhuận âm lịch**: `nextAnniversary` trong `src/lib/memorial-dates.ts` đang cố định `lunarLeap = 0`. Xử lý: nếu ngày mất rơi vào tháng nhuận, ngày giỗ các năm sau lấy tháng thường cùng số (quy ước phổ biến); thêm unit test hoặc script kiểm tra nhanh với vài ca biên (ngày 30 tháng thiếu, tháng nhuận).

### A5. Đồng bộ tài liệu

- Cập nhật `PET-MEMORIAL-PLAN.md`: mục thanh toán đổi từ PayOS sang SePay đúng thực tế (webhook API key, VietQR tự sinh/SePay sinh, biến `PAYMENT_WEBHOOK_SECRET`, `BANK_*`, `QR_PROVIDER`, `PAYMENT_CODE_PREFIX`).
- Rà `.dev.vars.example` khớp với toàn bộ biến môi trường code đang đọc (kể cả biến mới của giai đoạn này). **Không đụng vào file `.dev.vars` thật.**

---

## PHẦN B — TÍNH NĂNG TĂNG TRƯỞNG (sau khi xong Phần A)

### B1. Vườn tưởng niệm chung

Trang cộng đồng để người lạ ghé xem và xúc động → tự tạo trang cho bé của mình.

1. Migration: thêm cột `show_in_garden` (integer 0/1, default 0) vào `memorials`.
2. Toggle "Hiển thị bé trong Vườn tưởng niệm chung" trong trang quản lý bé (`/tai-khoan/be/[id]`) — mặc định TẮT, chủ nuôi tự bật (opt-in).
3. Trang công khai `/vuon-tuong-niem`:
   - Grid card các bé: ảnh bìa, tên, ngày về cầu vồng, số nến đã thắp. Click vào → trang `/be/[slug]`.
   - Chỉ hiện memorial: `is_published = 1` AND `show_in_garden = 1` AND mode tưởng niệm.
   - Phân trang (24 bé/trang), sắp theo mới xuất bản nhất. Có OG meta riêng cho trang này.
4. Link vào vườn từ landing page và footer.

### B2. Sổ Ký Ức Sống

Cho phép tạo trang cho **bé còn sống** (nhật ký lớn lên) — kéo người dùng đến từ sớm, khi bé mất chỉ cần chuyển chế độ.

1. Migration: thêm cột `mode` (`'memorial'` | `'living'`, default `'memorial'`) vào `memorials`; `death_date` cho phép NULL khi `mode = 'living'`.
2. Wizard bước 1 (`/tai-khoan/tao-trang`): thêm lựa chọn đầu tiên "Bé đã về cầu vồng" / "Bé vẫn đang bên tôi". Chế độ living: ẩn trường ngày mất, đổi các nhãn/câu chữ cho phù hợp (không dùng từ ngữ tưởng niệm).
3. Trang công khai `/be/[slug]` chế độ living: đổi tiêu đề phụ ("đồng hành cùng ... từ [ngày sinh]"), ẩn khối 49 ngày/ngày giỗ, thắp nến → đổi thành "gửi yêu thương" (tim), sổ lưu bút giữ nguyên.
4. Nút "Chuyển sang trang tưởng niệm" trong `/tai-khoan/be/[id]` (kèm confirm 2 bước vì nhạy cảm): nhập ngày mất → set `mode = 'memorial'` + `death_date` → tự tính lại ngày âm + tạo reminders 49 ngày/giỗ như flow hiện tại. Giữ nguyên toàn bộ ảnh, câu chuyện, lưu bút.
5. Reminders và email nhắc chỉ áp dụng cho mode memorial (kiểm tra lại query trong `src/lib/reminders.ts`).
6. Vườn tưởng niệm (B1) không hiện bé đang ở mode living.

### B3. Google OAuth

Giảm rào cản đăng ký + giảm quên mật khẩu.

1. Flow OAuth 2.0 authorization code thủ công (không cần thư viện nặng): route `/api/auth/google` (redirect sang Google, kèm `state` chống CSRF lưu cookie) và `/api/auth/google/callback` (đổi code lấy token, gọi userinfo lấy email + tên).
2. Migration: thêm cột `google_id` (nullable, unique) vào `users`; `password_hash` cho phép NULL với tài khoản chỉ dùng Google.
3. Logic liên kết: nếu email Google trùng tài khoản có sẵn → gắn `google_id` vào tài khoản đó (đăng nhập luôn); nếu chưa có → tạo user mới. Sau đó tạo session như flow thường.
4. Nút "Tiếp tục với Google" trên `/dang-nhap` và `/dang-ky`.
5. Trang `/dang-nhap` với tài khoản không có mật khẩu: nếu thử đăng nhập bằng mật khẩu → gợi ý dùng Google hoặc đặt mật khẩu qua luồng quên mật khẩu (A1).
6. Biến môi trường mới: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (thêm vào `.dev.vars.example`). Việc tạo OAuth Client trên Google Cloud Console do chủ dự án làm — code cứ đọc từ env.

### B4. SEO cơ bản

1. Meta description riêng cho từng trang tĩnh (landing, bảng giá, cách hoạt động, vườn tưởng niệm); trang `/be/[slug]` sinh description từ tên bé + đoạn đầu tiểu sử.
2. JSON-LD cho trang kỷ niệm (schema.org, dùng `ProfilePage` hoặc `WebPage` + `about`) và `Organization` + `Product`/`Offer` cho landing/bảng giá.
3. `robots.txt`: chặn `/tai-khoan`, `/admin`, `/api`, `/dang-*`; trỏ sitemap.
4. Trang 404 tùy chỉnh (`src/pages/404.astro`) cùng ngôn ngữ thiết kế, có link về landing và vườn tưởng niệm.
5. Kiểm tra sitemap (`@astrojs/sitemap`) có chứa các trang `/be/[slug]` đã publish không — nếu không (do SSR), tạo endpoint `sitemap.xml` động liệt kê trang công khai từ DB.

---

## Biến môi trường mới trong giai đoạn này

```
GOOGLE_CLIENT_ID=        # B3 — OAuth client từ Google Cloud Console
GOOGLE_CLIENT_SECRET=    # B3
```

(Quên mật khẩu dùng `RESEND_API_KEY` sẵn có, không cần biến mới.)

## Việc chủ dự án cần làm ngoài code

- [ ] (B3) Tạo project + OAuth Client ID trên Google Cloud Console, thêm redirect URI `https://<domain>/api/auth/google/callback` và bản localhost cho dev; điền 2 biến env.
- [ ] (A3) Kiểm tra domain gửi email trên Resend vẫn hoạt động tốt.
- [ ] Sau khi A1-A4 xong: tự test luồng quên mật khẩu + thanh toán trên môi trường thật trước khi chạy quảng bá.

## Checklist nghiệm thu nhanh

- [ ] A1: nhận email reset trong ~1 phút, token hết hạn/dùng lại đều bị chặn, đổi xong bị logout mọi phiên.
- [ ] A2: viết lưu bút → chủ trang nhận email (deploy thật trên Workers, không chỉ local).
- [ ] A3: xác nhận đơn (webhook lẫn tay) → khách nhận email; chuyển shipped → khách nhận email.
- [ ] B1: bé chưa bật opt-in không xuất hiện trong vườn.
- [ ] B2: tạo trang living → chuyển tưởng niệm → reminders được tạo, ngày âm đúng.
- [ ] B3: đăng nhập Google với email đã có tài khoản → vào đúng tài khoản cũ, không tạo trùng.
- [ ] B4: `curl /robots.txt`, kiểm tra JSON-LD bằng Rich Results Test.
