# Đưa Virai Memorial lên production

Làm một lần theo thứ tự dưới đây. Mọi lệnh chạy ở thư mục gốc của repo.

## 1. Đăng nhập Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

## 2. Tạo D1 database

```bash
npx wrangler d1 create virai-memorial
```

Lệnh trên in ra `database_id`. Mở `wrangler.jsonc` và thay chuỗi
`REPLACE_WITH_D1_DATABASE_ID` bằng id đó.

Rồi chạy migration lên database thật:

```bash
npm run db:migrate
```

## 3. Tạo R2 bucket

```bash
npx wrangler r2 bucket create virai-memorial-media
```

Tên bucket phải khớp `bucket_name` trong `wrangler.jsonc`.

## 4. Bật Workers AI

Workers AI dùng binding `AI` đã khai trong `wrangler.jsonc`, không cần tạo tài nguyên.
Vào Cloudflare Dashboard → Workers & Pages → AI để kiểm tra tài khoản đã bật và xem hạn mức
miễn phí. Model đang dùng khai ở `src/lib/ai.ts`:

- chính: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- dự phòng: `@cf/meta/llama-3.1-8b-instruct`

Nếu tài khoản chưa có model 70B, hệ thống tự lùi về 8B. Nên thử nút "Nhờ AI viết giúp" một lần
sau khi deploy để xác nhận chất lượng tiếng Việt.

## 5. Đặt secrets

```bash
# Ký session cookie — bắt buộc
npx wrangler secret put SESSION_SECRET      # dán kết quả: openssl rand -hex 32

# Email nhắc ngày tưởng niệm
npx wrangler secret put RESEND_API_KEY

# Xác thực webhook thanh toán
npx wrangler secret put PAYMENT_WEBHOOK_SECRET

# Bí mật để cron gọi vào route gửi email
npx wrangler secret put CRON_SECRET         # openssl rand -hex 16

# Tài khoản nhận tiền, hiện trên mã VietQR
npx wrangler secret put BANK_ACCOUNT_NUMBER
npx wrangler secret put BANK_CODE           # BIN VietQR, ví dụ Vietcombank 970436, MB 970422
npx wrangler secret put BANK_ACCOUNT_NAME

# Email này khi đăng ký sẽ tự thành admin
npx wrangler secret put ADMIN_EMAIL
```

Danh sách BIN các ngân hàng phổ biến nằm trong `src/lib/vietqr.ts`.

## 6. Deploy

```bash
npm run deploy
```

Build đã kèm `scripts/postbuild.mjs`, nó làm hai việc bắt buộc:

1. thêm rule `CompiledWasm` để wrangler upload được file wasm của workers-og (dùng cho OG image);
2. bọc entry của Astro bằng entry có thêm handler `scheduled` để Cron Trigger gọi được.

Sau khi deploy, kiểm tra Cron Trigger đã xuất hiện trong Dashboard → Worker → Settings → Trigger
Events (`0 1 * * *`, tức 08:00 giờ Việt Nam).

### Kiểm tra Cron Trigger có thật sự chạy

Handler `scheduled` **không test được ở local**: `wrangler dev` bọc Worker bằng asset-worker và
lớp bọc đó không chuyển tiếp sự kiện `scheduled`, nên `curl /cdn-cgi/handler/scheduled` luôn trả
500 ở máy. (Đã kiểm chứng: bỏ khai báo `assets` ra khỏi config thì handler chạy đúng, gửi email
và ghi log.)

Vì vậy sau lần deploy đầu, hãy xác nhận trên production:

1. Vào Dashboard → Worker → Logs (Observability đã bật sẵn), chờ qua 08:00 giờ Việt Nam.
2. Tìm dòng log `[cron] reminders: {...}`. Có dòng này là cron chạy tốt.

Nếu **không** thấy dòng đó (Workers Assets chặn `scheduled` trên production), dùng phương án dự phòng —
route `/api/cron/reminders` gọi được từ ngoài bằng header bí mật:

```bash
curl -X POST https://virai.com.vn/api/cron/reminders \
  -H "x-cron-secret: <CRON_SECRET>"
```

Đặt lệnh này vào bất kỳ scheduler nào (một Worker nhỏ riêng chỉ có `scheduled`, GitHub Actions
`schedule`, cron-job.org…) chạy 01:00 UTC mỗi ngày. Ngoài ra `/admin` luôn có nút **Chạy gửi ngay**
để gửi tay.

## 7. Tạo tài khoản admin

Vào `https://virai.com.vn/dang-ky` và đăng ký bằng đúng email đã đặt ở `ADMIN_EMAIL`.
Tài khoản đó tự có quyền admin, vào được `/admin`.

## 8. Cấu hình Resend

1. Tạo tài khoản tại <https://resend.com> (free 3.000 email/tháng).
2. Thêm domain `virai.com.vn`, thêm các bản ghi DNS (SPF, DKIM) mà Resend yêu cầu.
3. Lấy API key, đặt vào secret `RESEND_API_KEY`.
4. Địa chỉ gửi khai ở `site.fromEmail` trong `src/lib/site.ts` (hiện là
   `no-reply@virai.com.vn`) — phải thuộc domain đã xác thực.

Kiểm tra: vào `/admin`, bấm **Xem danh sách sắp gửi**, rồi **Chạy gửi ngay**.
Kết quả trả về JSON có `sent` và `error` của từng email.

## 9. Cấu hình SePay (tự động xác nhận chuyển khoản)

1. Tạo tài khoản tại <https://sepay.vn>, liên kết tài khoản ngân hàng nhận tiền.
2. Thêm webhook:
   - URL: `https://virai.com.vn/api/webhook/payment`
   - Xác thực: API Key → header `Authorization: Apikey <PAYMENT_WEBHOOK_SECRET>`
3. Kiểm tra bằng lệnh dưới (thay `<CODE>` bằng mã đơn thật đang chờ, lấy ở `/admin/don-hang`):

```bash
curl -X POST https://virai.com.vn/api/webhook/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey <PAYMENT_WEBHOOK_SECRET>" \
  -d '{"transferType":"in","transferAmount":249000,"content":"CK <CODE>"}'
```

Kết quả mong đợi: `{"success":true,"matched":true,"paid":true,...}` và trang kỷ niệm lên Premium.

> Tên field trong payload của SePay có thể thay đổi. Endpoint đọc theo nhiều tên gọi
> (`transferAmount`/`amount`, `content`/`description`/`code`) và dò mã đơn bằng regex `VRM[0-9A-Z]{7}`.
> Nên gửi một giao dịch thật số tiền nhỏ để xác nhận trước khi mở bán.
> Nếu webhook lỗi, `/admin/don-hang` luôn có nút **Xác nhận đã nhận tiền** để xử lý tay.

## 10. Trang mẫu cho landing page

```bash
npm run db:seed
```

Tạo tài khoản `demo@virai.com.vn` (mật khẩu `demo-virai-2026`) và 3 trang mẫu:
`/be/mit-golden`, `/be/bap-meo-tam-the`, `/be/lucky-corgi`.

Seed **không** tạo được ảnh (ảnh nằm trên R2). Đăng nhập bằng tài khoản demo rồi tải ảnh thật
cho ba trang này — landing page chỉ đẹp khi trang mẫu có ảnh. **Nên đổi mật khẩu tài khoản demo**
hoặc xoá nó sau khi đã tải ảnh xong.

Danh sách slug hiện trên landing khai ở `DEMO_SLUGS` trong `src/lib/memorials.ts`.

## 11. Việc cần kiểm tra sau deploy

- [ ] Đăng ký / đăng nhập / đăng xuất.
- [ ] Tạo trang qua wizard 5 bước, tải ảnh (thử cả ảnh chụp từ điện thoại, dung lượng lớn).
- [ ] Nút "Nhờ AI viết giúp" trả về văn bản tiếng Việt đọc được.
- [ ] Dán link `/be/<slug>` vào Facebook và Zalo → ảnh xem trước hiện đúng ảnh của bé.
      (Zalo cache khá dai; URL ảnh có `?v=updatedAt` nên sửa trang là ảnh mới.)
- [ ] Quét mã QR bằng điện thoại → vào đúng trang.
- [ ] **Quét mã VietQR bằng app ngân hàng thật** → số tiền và nội dung chuyển khoản điền sẵn đúng.
- [ ] Chuyển khoản thật một đơn nhỏ → webhook tự xác nhận.
- [ ] Gửi lưu bút từ máy khác → chủ trang nhận email và duyệt được.
- [ ] `/admin` chỉ vào được bằng tài khoản admin (tài khoản thường phải ra 404).

## Đổi tên thương hiệu / giá

- Tên, tagline, email, URL: `src/lib/site.ts`
- Giá và hạn mức từng gói: `src/lib/plans.ts`
- Gắn thêm domain mới cho Worker: Dashboard → Worker → Settings → Domains & Routes.
  Không cần sửa code; `site.url` chỉ dùng cho link trong email và ảnh OG mặc định.
