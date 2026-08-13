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

## Kết quả rà soát tài liệu này (13/08/2026, đã kiểm chứng bằng thực nghiệm)

> Rà trên hệ thống **đang chạy thật với 29 tài khoản, 27 trang kỷ niệm, 1 đơn đã thanh toán**.
> Mỗi kết luận dưới đây đều có phép thử kèm theo, không phải đọc code rồi suy đoán.

### Khẳng định trong tài liệu bị SAI

**A2 — "middleware không hề gán `cfContext`" là sai.** Adapter `@astrojs/cloudflare` tự gán
field này (`node_modules/@astrojs/cloudflare/dist/utils/handler.js`, dòng 64-66:
`const locals = { cfContext: context }`). Không có gì để sửa. Nếu muốn chắc chắn thì thêm một
dòng cảnh báo lúc chạy khi `locals.cfContext` vắng mặt, thay vì viết lại phần lấy context —
viết lại có nguy cơ làm hỏng thứ đang chạy đúng. **Hạ ưu tiên xuống thấp nhất.**

**A4.3 — mô tả sai lỗi.** Tháng nhuận **không** phải vấn đề: thử ngày mất 22/03/2023 (mùng 1
tháng 2 **nhuận**), giỗ ba năm liên tiếp đều rơi đúng mùng 1 tháng 2 âm. Lỗi thật nằm ở
**ngày 30 âm lịch**: ngày mất 21/01/2023 (30 tháng Chạp), giỗ tính ra lại rơi vào **mùng 1
tháng Giêng** — lệch hẳn sang tháng sau, cả ba năm thử đều sai. Nguyên nhân: `lunarToSolar`
nhận ngày 30 trong tháng thiếu (29 ngày) và tự tràn sang tháng kế. Đây là ca **rất hay gặp
với ngày mất dịp cuối năm âm**. Sửa: nếu tháng âm đích không có ngày 30 thì lùi về ngày 29
(quy ước cúng giỗ phổ biến), kèm test cho cả hai ca.

### Rủi ro MẤT DỮ LIỆU trong B3 — bắt buộc đổi cách làm

Yêu cầu "`password_hash` cho phép NULL" khiến drizzle-kit sinh ra migration **xoá và dựng lại
bảng `users`**:

```sql
PRAGMA foreign_keys=OFF;
CREATE TABLE `__new_users` (...);
INSERT INTO `__new_users`(...) SELECT ..., "google_id", ... FROM `users`;
DROP TABLE `users`;                     -- ⚠ trên DB đang có 29 người dùng thật
ALTER TABLE `__new_users` RENAME TO `users`;
```

Hai vấn đề:

1. **Migration này hỏng ngay khi chạy**: câu `INSERT ... SELECT` đọc cột `google_id` từ bảng
   `users` **cũ** — cột chưa tồn tại. Migration sẽ dừng giữa chừng và để lại bảng thừa
   `__new_users`.
2. `DROP TABLE users` trong khi `sessions`, `memorials`, `orders`, `ai_usage` đều tham chiếu
   tới nó, trên database đang phục vụ người dùng.

**Cách làm thay thế — không cần NULL:** tài khoản cũ luôn có mật khẩu; chỉ tài khoản sinh từ
Google mới chưa có. Lưu một giá trị đánh dấu (ví dụ `google-only`) là đủ, vì `verifyPassword`
chỉ chấp nhận chuỗi đúng định dạng `pbkdf2$...` và trả về sai với mọi giá trị khác. Ai quên
mật khẩu thì dùng luồng A1. Khi đó migration chỉ còn hai câu **thêm vào**, không đụng dữ liệu
cũ:

```sql
ALTER TABLE users ADD COLUMN google_id text;
CREATE UNIQUE INDEX users_google_id_unique ON users (google_id);
```

**Quy tắc từ nay:** trước khi chạy bất kỳ migration nào lên production, đọc file SQL do
drizzle-kit sinh ra. Thấy `DROP TABLE` hoặc `__new_` thì **dừng lại**, tìm cách khác hoặc chuẩn
bị phương án phục hồi (D1 có Time Travel 30 ngày — đã kiểm tra là dùng được).

### Sai thứ tự phụ thuộc

**B1 phụ thuộc B2.** B1 lọc `mode tưởng niệm`, nhưng cột `mode` mãi tới B2 mới có. Hoặc đổi
thứ tự thành B2 → B1, hoặc B1 bỏ điều kiện `mode` và thêm lại sau.

### B4.5 mâu thuẫn với lời hứa đã công bố

B4 yêu cầu đưa các trang `/be/[slug]` vào sitemap. Nhưng trang chủ đang ghi *"không nằm trong
danh sách công khai nào, **không có trong sitemap**"*, và Chính sách bảo mật ghi *"chỉ mở cho
người có đường link hoặc quét mã QR. Chúng tôi không tạo danh bạ công khai các trang"*.

Người dùng đã đọc lời hứa đó trước khi đăng ký. Đưa trang của họ vào sitemap là **bội tín**, và
là chuyện nhạy cảm vì đây là trang tưởng niệm riêng tư của gia đình. **Chỉ đưa vào sitemap
những trang chủ nuôi tự bật opt-in ở Vườn tưởng niệm (B1)** — và sửa lại câu chữ ở hai trang
kia cho khớp. Sitemap các trang tĩnh thì giữ nguyên.

### Việc quan trọng mà tài liệu còn thiếu

Ba việc dưới đây phát hiện từ vận hành thật, mức độ ưu tiên **ngang hoặc trên Phần A**:

**A0. Ảnh chia sẻ đang hỏng 1/3 số lần.** Gọi `/be/<slug>/og.png` với URL chưa cache: 6 lần thì
2 lần trả `HTTP 503 — error code 1102`, tức *Worker exceeded CPU time limit*. Gói free cho 10ms
CPU mỗi request, còn việc vẽ ảnh PNG 1200×630 bằng satori + resvg vượt xa mức đó. Lỗi chỉ lộ ở
lần sinh đầu tiên vì sau đó CDN cache 30 ngày — mà đó đúng là lúc người ta vừa dán link lên
Facebook. Tệ hơn: URL ảnh có `?v=<lần sửa cuối>` nên **mỗi lần chủ trang sửa gì là phải sinh
lại**. Đây là động cơ lan truyền chính của sản phẩm. Xử lý: nâng Workers Paid ($5/tháng, CPU
lên 30 giây, không cần sửa code), hoặc bỏ thẻ có thương hiệu và dùng thẳng ảnh bìa.

**A0b. Không có giám sát ngoài.** Sáng 13/08 toàn bộ truy vấn D1 thất bại khoảng **4 giờ 40
phút** — trang kỷ niệm và cả đăng nhập đều chết — và không ai biết cho tới khi chủ dự án tự phát
hiện. Cron của Cloudflare không dùng thay được: Worker sập thì cron sập theo. Cần một dịch vụ
bên ngoài gọi `/` mỗi 5 phút và báo qua email.

**A0c. Push lên `main` là deploy thẳng production sau ~60 giây.** Đã đo hai lần: 57 giây và 58
giây sau khi push, một version mới tự sinh và tự nhận 100% traffic. Bản CI dựng ra **khớp từng
byte** với bản build tay (đã đối chiếu tên file CSS băm nội dung), nên bản thân cơ chế này không
hỏng. Nhưng nó nghĩa là **không có cửa kiểm tra nào**: commit chưa test mà vào `main` là lên
thẳng. Hoặc tắt tích hợp Git và deploy tay theo quy trình upload-version → test trên URL preview
→ mới chuyển traffic, hoặc giữ nguyên và tự ràng buộc chỉ commit vào `main` thứ đã test.

### Đã làm xong sau khi tài liệu này được viết

- Lớp chịu lỗi D1: `src/lib/db/retry.ts` — `describeDbError()` đi theo chuỗi `error.cause` (Drizzle
  giấu thông báo thật của D1 trong đó), `withDbRetry()` thử lại một lần với lỗi tạm thời và không
  thử lại với lỗi cấu trúc. Đã áp cho phiên đăng nhập, đăng nhập, tra trang theo slug, danh sách
  trang, danh sách ảnh, tra đơn theo mã.
- `src/pages/500.astro`: trang lỗi cùng ngôn ngữ thiết kế, **không đọc D1/R2** (sự cố hay gặp nhất
  chính là D1; trang lỗi mà cần D1 thì cũng sập theo).
- Middleware ghi nguyên nhân thật của mọi lỗi chưa xử lý.
- Ưu đãi có hạn: Premium 119k → 59k đến hết 31/08, tự hết hạn theo giờ Việt Nam.

### Nhận xét chung

Phần A đúng hướng và A1 (quên mật khẩu) vẫn là việc đáng làm nhất — 29 người dùng hiện chưa có
đường nào tự lấy lại tài khoản, và đã có khách trả tiền. Phần B nên **hoãn cho tới khi xong A0 và
A0b**: thêm tính năng mới trong khi ảnh chia sẻ hỏng 1/3 và không ai biết lúc web sập là đầu tư
sai chỗ.

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

### A2. Sửa wiring `waitUntil` trên Workers  ⚠️ TIỀN ĐỀ SAI — xem phần rà soát

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
3. **Ngày 30 âm lịch** (không phải tháng nhuận — xem phần rà soát): `nextAnniversary` trong `src/lib/memorial-dates.ts` đang cố định `lunarLeap = 0`. Xử lý: nếu ngày mất rơi vào tháng nhuận, ngày giỗ các năm sau lấy tháng thường cùng số (quy ước phổ biến); thêm unit test hoặc script kiểm tra nhanh với vài ca biên (ngày 30 tháng thiếu, tháng nhuận).

### A5. Đồng bộ tài liệu

- Cập nhật `PET-MEMORIAL-PLAN.md`: mục thanh toán đổi từ PayOS sang SePay đúng thực tế (webhook API key, VietQR tự sinh/SePay sinh, biến `PAYMENT_WEBHOOK_SECRET`, `BANK_*`, `QR_PROVIDER`, `PAYMENT_CODE_PREFIX`).
- Rà `.dev.vars.example` khớp với toàn bộ biến môi trường code đang đọc (kể cả biến mới của giai đoạn này). **Không đụng vào file `.dev.vars` thật.**

---

## PHẦN B — TÍNH NĂNG TĂNG TRƯỞNG (sau khi xong Phần A)

### B1. Vườn tưởng niệm chung  ⚠️ phụ thuộc cột `mode` của B2 — làm B2 trước

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

### B3. Google OAuth  ⚠️ ĐỔI CÁCH LÀM — migration gốc xoá bảng `users`

Giảm rào cản đăng ký + giảm quên mật khẩu.

1. Flow OAuth 2.0 authorization code thủ công (không cần thư viện nặng): route `/api/auth/google` (redirect sang Google, kèm `state` chống CSRF lưu cookie) và `/api/auth/google/callback` (đổi code lấy token, gọi userinfo lấy email + tên).
2. Migration: **chỉ thêm** cột `google_id` (nullable, unique) vào `users`. **KHÔNG** đổi `password_hash` sang NULL — xem phần rà soát; dùng giá trị đánh dấu cho tài khoản chỉ dùng Google.
3. Logic liên kết: nếu email Google trùng tài khoản có sẵn → gắn `google_id` vào tài khoản đó (đăng nhập luôn); nếu chưa có → tạo user mới. Sau đó tạo session như flow thường.
4. Nút "Tiếp tục với Google" trên `/dang-nhap` và `/dang-ky`.
5. Trang `/dang-nhap` với tài khoản không có mật khẩu: nếu thử đăng nhập bằng mật khẩu → gợi ý dùng Google hoặc đặt mật khẩu qua luồng quên mật khẩu (A1).
6. Biến môi trường mới: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (thêm vào `.dev.vars.example`). Việc tạo OAuth Client trên Google Cloud Console do chủ dự án làm — code cứ đọc từ env.

### B4. SEO cơ bản

1. Meta description riêng cho từng trang tĩnh (landing, bảng giá, cách hoạt động, vườn tưởng niệm); trang `/be/[slug]` sinh description từ tên bé + đoạn đầu tiểu sử.
2. JSON-LD cho trang kỷ niệm (schema.org, dùng `ProfilePage` hoặc `WebPage` + `about`) và `Organization` + `Product`/`Offer` cho landing/bảng giá.
3. `robots.txt`: chặn `/tai-khoan`, `/admin`, `/api`, `/dang-*`; trỏ sitemap.
4. Trang 404 tùy chỉnh (`src/pages/404.astro`) cùng ngôn ngữ thiết kế, có link về landing và vườn tưởng niệm.
5. ⚠️ **KHÔNG** đưa mọi trang `/be/[slug]` vào sitemap — mâu thuẫn với lời hứa đã công bố trên trang chủ và Chính sách bảo mật. Chỉ đưa những trang chủ nuôi tự bật opt-in ở Vườn tưởng niệm (B1).

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
