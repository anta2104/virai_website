# Kế hoạch: Phân tích TikTok + Người mẫu ảo cho thuê

> ## Trạng thái (cập nhật 15/10/2026)
>
> Nhánh `tiktok-studio`. **Code giai đoạn 1 của cả hai tính năng đã xong**, chưa commit,
> **chưa deploy, chưa chạy migration lên production**. Đã rà soát code (15/10/2026),
> sửa 9 lỗi tìm được (Apify gọi đôi, biểu đồ rỗng ném lỗi, thứ tự cộng tín chỉ và đổi
> trạng thái đơn, chặn oan từ khoá, trừ tín chỉ trước khi ghi R2, không tái dùng bản
> thiếu AI, N+1 snapshot, admin xác nhận đơn đã huỷ, form lỗi trả 500).
> tsc, astro check, 36 test và build đều sạch.
>
> **Deploy:** production tự build từ `main` (Cloudflare), không chạy migration, nên
> Worker tự áp migration còn thiếu lúc nhận request đầu (`src/lib/db/auto-migrate.ts`).
> Đẩy `main` là đủ. Bản 15/10 đã lên virai.com.vn và mọi trang trả 200.
>
> **Giao diện:** 15/10 đổi sang bảng màu công cụ (nền xám nhạt, chữ gần đen, nhấn tím),
> bỏ serif, logo mới, ảnh đại diện người mẫu bằng SVG minh hoạ cho tới khi sinh ảnh thật.
> Trang `/be/*` giữ tông ấm cũ qua biến riêng. Đã thử thật trên dev server với provider `mock`; phần gọi Workers AI
> (LLM và sinh ảnh) chưa chạy được ở local vì cần `CF_REMOTE=1`.
>
> | Mục | Trạng thái |
> |---|---|
> | T1 Nhập link, kéo video, bảng + biểu đồ | ✅ xong, migration `0006`; provider `mock` đã thử, `apify` chưa thử token thật |
> | T2 LLM phân tích top video, chủ đề, giờ đăng, hashtag | ✅ code xong; chất lượng JSON của llama chưa kiểm chứng (cần AI remote) |
> | T3 Theo dõi kênh hằng ngày, so sánh đối thủ (Premium) | ⬜ |
> | T4 Media kit công khai, báo cáo chia sẻ, cảnh báo email | ⬜ |
> | M1 Buổi chụp ảnh ảo (ảnh tĩnh) + tín chỉ | ✅ code xong; tín chỉ + webhook đã thử giả lập; sinh ảnh Flux chưa chạy thật; chưa có ảnh đại diện 5 người mẫu |
> | M2 Video người mẫu nói chuyện (talking head) | ⬜ |
> | M3 Video người mẫu tương tác với sản phẩm | ⬜ chờ kết quả thử nghiệm M1 |
> | **Q1 Chọn nhà cung cấp dữ liệu TikTok** | ⬜ chờ chủ dự án: hiện có `mock` và adapter Apify (chưa kiểm chứng với token thật) |
> | **Q2 Chọn nhà cung cấp sinh ảnh giữ đúng sản phẩm** | ⬜ chờ chủ dự án: hiện dùng Workers AI (chỉ text-to-image) |
> | **Q3 Giữ hay bỏ phần tưởng niệm thú cưng** | 🟡 15/10: trang chủ, tên site, menu, chân trang, ảnh chia sẻ, bảng giá đã chuyển sang sản phẩm mới; phần tưởng niệm dời về `/tuong-niem`, mọi trang `/be/*`, vườn, tài khoản vẫn chạy. Gỡ hẳn hay không: chờ chủ dự án |
> | **Q4 Rà soát pháp lý nội dung AI trong quảng cáo** | ⬜ chờ chủ dự án hỏi người có chuyên môn |

> Nguyên tắc: tái dùng nền tảng đang có (auth, Google login, D1, R2, Workers AI,
> SePay VietQR, email Resend, cron). Không refactor phần tưởng niệm. Mọi UI tiếng Việt.
> Migration chỉ thêm, không dựng lại bảng.

---

## Việc cần làm tiếp theo (theo thứ tự)

1. Chạy `npm run db:migrate:local`, `CF_REMOTE=1 npm run dev`, thử một phân tích và một
   buổi chụp thật để kiểm chứng LLM và Flux. Sinh ảnh đại diện 5 người mẫu bằng
   `POST /api/studio/models/<id>/portrait` (cookie admin).
2. Quyết định Q1–Q4 ở bảng trạng thái.
3. Khi hài lòng: commit nhánh, `npm run db:migrate` (migration chỉ thêm), merge, deploy.
4. Hạn chế đã biết, chấp nhận ở MVP: trừ tín chỉ không có khoá giao dịch (hai request
   song song có thể cùng qua kiểm tra số dư); `waitUntil` không bảo đảm job dài chạy
   trọn, khi dùng provider thật nên chuyển sang Cloudflare Queues.

## Phần T: Phân tích kênh TikTok

### Nguồn dữ liệu (quyết định Q1)

[Unverified] TikTok không có API công khai để lấy video của một tài khoản bất kỳ từ link.
Ba hướng:

| Hướng | Lấy được gì | Rủi ro |
|---|---|---|
| A. TikTok Login Kit + Display API | Chỉ video của chính người đăng nhập | Hợp lệ ToS, không phân tích được kênh khác |
| B. Dịch vụ bên thứ ba (Apify, EnsembleData, TikAPI...) | Mọi kênh công khai | Phí theo request, vùng xám ToS |
| C. Tự scrape từ Worker | Như B | Dễ bị chặn, không làm |

Chọn **B cho MVP**, bọc sau interface `TikTokProvider` (`src/lib/tiktok/provider.ts`):

- `mock`: dữ liệu giả sinh từ handle, dùng để dev và demo không tốn phí.
- `apify`: gọi actor `clockworks/tiktok-scraper` bằng `APIFY_TOKEN`. Tên field đọc
  phòng thủ theo nhiều tên gọi vì chưa kiểm chứng với token thật.
- Chọn bằng biến `TIKTOK_PROVIDER=mock|apify`. Thiếu token thì tự về `mock` và báo rõ trên UI.

### Luồng một lần phân tích

1. Người dùng (đã đăng nhập) dán link hoặc @handle vào `/tiktok`. Chuẩn hóa handle.
2. Nếu đã có phân tích `done` cho handle này trong 12 giờ thì mở lại, không gọi provider.
3. Tạo bản ghi `creator_analyses` trạng thái `queued`, chạy nền bằng `waitUntil`:
   kéo profile + 30 video gần nhất → ghi `creators`, `videos`, `video_snapshots`
   → tính chỉ số bằng code thuần (`metrics.ts`) → gọi LLM trả JSON (`analyze.ts`)
   → lưu `result_json`, trạng thái `done` hoặc `failed`.
4. Trang `/tiktok/phan-tich/[id]` poll `/api/tiktok/analyses/[id]/status` mỗi 3 giây
   cho tới khi xong, rồi render từ D1.

### Chỉ số tính bằng code (không để LLM tính số)

- Tổng và trung bình view, like, comment, share, save trên N video.
- Engagement rate = (like + comment + share + save) / view.
- Tỉ lệ save/view và share/view (TikTok ưu tiên đẩy hai tín hiệu này).
- Tần suất đăng (video/tuần), độ dài trung bình.
- Video nổi bật: view > 2 lần trung vị.
- Giờ và thứ trong tuần đăng hiệu quả (theo giờ Việt Nam), tính theo view trung vị.
- Hashtag và nhạc: tần suất và view trung vị của video chứa nó.

### LLM (Workers AI, llama 3.3 70B, fallback 8B)

Đầu vào: bảng chỉ số đã tính + caption 30 video. Đầu ra JSON cố định:
`summary`, `topVideos[] {id, why}`, `themes[] {name, share, performance}`,
`trend` (`len|xuong|di_ngang` + lý do), `postingAdvice`, `hashtagAdvice`,
`nextIdeas[] {hook, idea}`, `healthScore` 0–100 + `checklist[]`.
Lọc chữ Hán như `ai.ts` đang làm. Lưu `input_hash` để không gọi lại khi dữ liệu không đổi.

### Giai đoạn sau (T3, T4)

- `watchlists` + cron hằng ngày chụp snapshot → biểu đồ tăng trưởng (Premium).
- So sánh 2–3 kênh cùng ngách.
- Media kit công khai `/tiktok/@handle` cho KOC gửi nhãn hàng.
- Ảnh chia sẻ điểm sức khỏe kênh (tái dùng pipeline OG).
- Email cảnh báo video tăng đột biến / engagement sụt.

---

## Phần M: Người mẫu ảo cho thuê

### Đánh giá rủi ro

- Khó nhất là **giữ đúng sản phẩm** (logo, chữ, hình dáng). Workers AI hiện chỉ có
  text-to-image nên M1 bản đầu chỉ dựng được người mẫu + mô tả sản phẩm bằng lời.
  Muốn ghép đúng ảnh sản phẩm cần nhà cung cấp nhận ảnh tham chiếu (quyết định Q2).
- Video tốn phí và chậm (vài phút) → bắt buộc chạy nền, lưu R2, báo email.
- Pháp lý: chặn mặt người thật, sản phẩm cấm quảng cáo; gắn nhãn "nhân vật do AI tạo".

### M1: Buổi chụp ảnh ảo

- 5 người mẫu ảo định nghĩa trong `virtual_models` (seed trong migration `0006`),
  mỗi người có `persona_json` (ngoại hình, phong cách, ngách phù hợp) dùng làm prompt
  cố định để giữ nhất quán. Ảnh đại diện sinh một lần, lưu `portrait_key` trong R2.
- Người dùng chọn người mẫu, nhập tên + mô tả sản phẩm, tải ảnh sản phẩm (lưu R2 để
  dùng cho provider có ảnh tham chiếu sau này), chọn bối cảnh, số ảnh (1–4).
- `ImageProvider` (`src/lib/studio/provider.ts`): `workers-ai` (mặc định) và chỗ
  cắm `external` qua `IMAGE_PROVIDER`.
- Job chạy nền: LLM viết prompt từ persona + sản phẩm + bối cảnh → sinh ảnh → lưu R2
  `studio/jobs/{jobId}/{n}.png` → `done`. Lỗi thì hoàn tín chỉ.

### Tín chỉ

- `credit_ledger` (delta dương/âm, lý do, tham chiếu). Số dư = tổng delta.
- Gói nạp trong `plans.ts` (`CREDIT_PACKS`); đơn `orders.type = 'credits'`,
  `orders.meta` ghi số tín chỉ. Thanh toán VietQR y như Premium; webhook `markOrderPaid`
  cộng tín chỉ một lần duy nhất.
- Giá tín chỉ: 1 ảnh = 1 tín chỉ. Video (M2) dự kiến 10–20 tín chỉ.

### Kết nối hai tính năng

Sau khi phân tích kênh: nút "Tạo ảnh/video theo xu hướng này" mở studio với kịch bản
viết sẵn từ hook và chủ đề đang hiệu quả của kênh đó.

---

## Schema mới (migration `0006_tiktok_studio`)

```sql
creators          (id, platform, handle, display_name, avatar_url, bio, followers, following,
                   likes_total, video_count, fetched_at, created_at)
videos            (id, creator_id, tiktok_id, url, caption, duration_s, posted_at,
                   music_title, hashtags_json, cover_url, created_at)
video_snapshots   (id, video_id, captured_at, views, likes, comments, shares, saves)
creator_analyses  (id, user_id, handle, creator_id, status, provider, input_hash,
                   metrics_json, result_json, error, created_at, finished_at)
virtual_models    (id, slug, name, tagline, persona_json, portrait_key, sort_order, active)
products          (id, user_id, name, description, category, images_json, created_at)
studio_jobs       (id, user_id, model_id, product_id, kind, status, brief_json, prompt,
                   provider, result_keys_json, cost_credits, error, created_at, finished_at)
credit_ledger     (id, user_id, delta, reason, ref_id, created_at)
orders            + meta text
```

## Route mới

| Route | Việc |
|---|---|
| `/tiktok` | Nhập link, danh sách phân tích gần đây của tôi |
| `/tiktok/phan-tich/[id]` | Kết quả: tổng quan, biểu đồ, bảng video, phân tích LLM |
| `POST /api/tiktok/analyze` | Tạo job phân tích |
| `GET /api/tiktok/analyses/[id]/status` | Poll trạng thái |
| `/nguoi-mau-ao` | Giới thiệu 5 người mẫu |
| `/nguoi-mau-ao/tao` | Tạo buổi chụp |
| `/nguoi-mau-ao/job/[id]` | Trạng thái + kết quả |
| `POST /api/studio/jobs`, `GET /api/studio/jobs/[id]/status` | Tạo và poll job |
| `/tai-khoan/tin-chi` | Số dư, lịch sử, nạp tín chỉ |
| `POST /api/credits/order` | Tạo đơn nạp tín chỉ |

## Biến môi trường mới (đều tùy chọn)

```
TIKTOK_PROVIDER=mock|apify
APIFY_TOKEN=
IMAGE_PROVIDER=workers-ai|external
```
