import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Mốc thời gian lưu dưới dạng unix epoch (giây) cho gọn trên D1. */
const createdAt = () =>
  integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    /** 'user' | 'admin' */
    role: text('role').notNull().default('user'),
    createdAt: createdAt(),
    /**
     * `sub` của tài khoản Google đã liên kết, null nếu chưa liên kết.
     *
     * `password_hash` cố ý **vẫn là NOT NULL**. Cho phép NULL thì drizzle-kit
     * sinh migration xoá và dựng lại bảng `users` — trên database đang phục vụ
     * người dùng thật, với sessions/memorials/orders đều tham chiếu tới nó.
     * Tài khoản chỉ dùng Google lưu giá trị đánh dấu `google-only`; verifyPassword
     * chỉ chấp nhận chuỗi đúng định dạng `pbkdf2$...` nên nó không đăng nhập
     * bằng mật khẩu được.
     */
    googleId: text('google_id'),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_google_id_unique').on(t.googleId),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Token đặt lại mật khẩu.
 *
 * `id` là SHA-256 (hex) của token gửi trong email, không phải token thô: ai đọc
 * được database cũng không dựng lại được đường link trong hộp thư của người dùng.
 */
export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    /** Null khi chưa dùng; đặt một lần rồi thôi để token không dùng lại được */
    usedAt: integer('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);

export const memorials = sqliteTable(
  'memorials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    petName: text('pet_name').notNull(),
    /** 'cho' | 'meo' | 'khac' */
    species: text('species').notNull().default('khac'),
    breed: text('breed'),
    /** 'duc' | 'cai' | 'khong_ro' */
    gender: text('gender').notNull().default('khong_ro'),
    /** 'YYYY-MM-DD' theo dương lịch, có thể null nếu không rõ */
    birthDate: text('birth_date'),
    deathDate: text('death_date'),
    /** Chuỗi ngày âm đã tính sẵn, ví dụ "12/03 âm lịch (năm Giáp Thìn)" */
    birthDateLunar: text('birth_date_lunar'),
    deathDateLunar: text('death_date_lunar'),
    bio: text('bio'),
    /** JSON các câu trả lời gợi ý dùng cho AI (đồ ăn thích, tính cách, kỷ niệm...) */
    storyNotes: text('story_notes'),
    /** 'am-ap' | 'thanh-tinh' | 'dem-sao' */
    theme: text('theme').notNull().default('am-ap'),
    coverPhotoId: text('cover_photo_id'),
    isPremium: integer('is_premium').notNull().default(0),
    isPublished: integer('is_published').notNull().default(0),
    visitCount: integer('visit_count').notNull().default(0),
    candleCount: integer('candle_count').notNull().default(0),
    flowerCount: integer('flower_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
    /**
     * 'memorial' = bé đã về cầu vồng | 'living' = sổ ký ức cho bé đang sống.
     *
     * Mặc định 'memorial' để 27 trang đang có giữ nguyên hành vi cũ.
     */
    mode: text('mode').notNull().default('memorial'),
    /**
     * Chủ nuôi tự bật để bé xuất hiện ở Vườn tưởng niệm chung.
     *
     * Mặc định TẮT, và phải giữ như vậy: trang chủ đã hứa với người dùng rằng
     * trang của họ "không nằm trong danh sách công khai nào". Chỉ những trang
     * chủ nuôi chủ động bật mới được vào vườn và vào sitemap.
     */
    showInGarden: integer('show_in_garden').notNull().default(0),
  },
  (t) => [
    uniqueIndex('memorials_slug_unique').on(t.slug),
    index('memorials_user_idx').on(t.userId),
  ],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    memorialId: text('memorial_id')
      .notNull()
      .references(() => memorials.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull().default('image/jpeg'),
    width: integer('width'),
    height: integer('height'),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('photos_memorial_idx').on(t.memorialId, t.sortOrder)],
);

export const guestbookEntries = sqliteTable(
  'guestbook_entries',
  {
    id: text('id').primaryKey(),
    memorialId: text('memorial_id')
      .notNull()
      .references(() => memorials.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    message: text('message').notNull(),
    /** 'pending' | 'approved' | 'rejected' */
    status: text('status').notNull().default('pending'),
    /** Hash IP để chống spam, không lưu IP thô */
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('guestbook_memorial_idx').on(t.memorialId, t.status)],
);

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memorialId: text('memorial_id').references(() => memorials.id, { onDelete: 'set null' }),
    /** 'premium' | 'physical_combo' */
    type: text('type').notNull(),
    amount: integer('amount').notNull(),
    /** Nội dung chuyển khoản duy nhất, ví dụ VRM7K2QP */
    paymentCode: text('payment_code').notNull(),
    /** 'pending' | 'paid' | 'shipped' | 'done' | 'cancelled' */
    status: text('status').notNull().default('pending'),
    /** JSON: { fullName, phone, address, material, note } cho đơn vật lý */
    shippingInfo: text('shipping_info'),
    /** Ghi chú của admin hoặc dữ liệu webhook thô */
    note: text('note'),
    createdAt: createdAt(),
    paidAt: integer('paid_at'),
    /** JSON tuỳ loại đơn, ví dụ { credits: 20 } cho đơn nạp tín chỉ */
    meta: text('meta'),
  },
  (t) => [
    uniqueIndex('orders_payment_code_unique').on(t.paymentCode),
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
  ],
);

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    memorialId: text('memorial_id')
      .notNull()
      .references(() => memorials.id, { onDelete: 'cascade' }),
    /** '49_ngay' | '100_ngay' | 'gio_hang_nam' */
    type: text('type').notNull(),
    /** Ngày dương lịch cần gửi email, 'YYYY-MM-DD' */
    nextDate: text('next_date').notNull(),
    /** Nhãn hiển thị trong email, ví dụ "Giỗ đầu (12/03 âm lịch)" */
    label: text('label').notNull(),
    enabled: integer('enabled').notNull().default(1),
    lastSentAt: integer('last_sent_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reminders_due_idx').on(t.nextDate, t.enabled),
    index('reminders_memorial_idx').on(t.memorialId),
  ],
);

/** Đếm số lần dùng "Nhờ AI viết giúp" theo ngày để áp hạn mức từng gói. */
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Ngày theo giờ Việt Nam, 'YYYY-MM-DD' */
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [uniqueIndex('ai_usage_user_day_unique').on(t.userId, t.day)],
);

/* ── Phân tích TikTok ───────────────────────────────────────────────────── */

/** Kênh đã từng được kéo dữ liệu. Thông tin profile là bản chụp lần kéo gần nhất. */
export const creators = sqliteTable(
  'creators',
  {
    id: text('id').primaryKey(),
    platform: text('platform').notNull().default('tiktok'),
    /** Handle không có @, chữ thường */
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    followers: integer('followers').notNull().default(0),
    following: integer('following').notNull().default(0),
    likesTotal: integer('likes_total').notNull().default(0),
    videoCount: integer('video_count').notNull().default(0),
    fetchedAt: integer('fetched_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('creators_platform_handle_unique').on(t.platform, t.handle)],
);

export const videos = sqliteTable(
  'videos',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    tiktokId: text('tiktok_id').notNull(),
    url: text('url').notNull(),
    caption: text('caption'),
    durationS: integer('duration_s'),
    /** unix epoch giây */
    postedAt: integer('posted_at'),
    musicTitle: text('music_title'),
    /** JSON string[] không có # */
    hashtagsJson: text('hashtags_json'),
    coverUrl: text('cover_url'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('videos_creator_tiktok_unique').on(t.creatorId, t.tiktokId),
    index('videos_creator_posted_idx').on(t.creatorId, t.postedAt),
  ],
);

/** Mỗi lần kéo dữ liệu ghi một bản chụp để sau này vẽ tăng trưởng theo thời gian. */
export const videoSnapshots = sqliteTable(
  'video_snapshots',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    capturedAt: integer('captured_at').notNull(),
    views: integer('views').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    comments: integer('comments').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    saves: integer('saves').notNull().default(0),
  },
  (t) => [index('video_snapshots_video_idx').on(t.videoId, t.capturedAt)],
);

/** Một lần người dùng yêu cầu phân tích: vừa là job chạy nền, vừa là kết quả. */
export const creatorAnalyses = sqliteTable(
  'creator_analyses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    creatorId: text('creator_id').references(() => creators.id, { onDelete: 'set null' }),
    /** 'queued' | 'fetching' | 'analyzing' | 'done' | 'failed' */
    status: text('status').notNull().default('queued'),
    /** 'mock' | 'apify' */
    provider: text('provider').notNull().default('mock'),
    /** Hash dữ liệu đầu vào của LLM, để không gọi lại khi dữ liệu không đổi */
    inputHash: text('input_hash'),
    /** JSON chỉ số tính bằng code (xem src/lib/tiktok/metrics.ts) */
    metricsJson: text('metrics_json'),
    /** JSON kết quả LLM (xem src/lib/tiktok/analyze.ts) */
    resultJson: text('result_json'),
    error: text('error'),
    createdAt: createdAt(),
    finishedAt: integer('finished_at'),
  },
  (t) => [
    index('creator_analyses_user_idx').on(t.userId, t.createdAt),
    index('creator_analyses_handle_idx').on(t.handle, t.status),
  ],
);

/* ── Người mẫu ảo ──────────────────────────────────────────────────────── */

export const virtualModels = sqliteTable(
  'virtual_models',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull(),
    /** JSON: { appearance, style, voice, niches[], promptBase } — mô tả cố định để giữ nhất quán */
    personaJson: text('persona_json').notNull(),
    /** Key R2 của ảnh đại diện, null khi chưa sinh */
    portraitKey: text('portrait_key'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('virtual_models_slug_unique').on(t.slug)],
);

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    /** JSON string[] các key R2 ảnh sản phẩm */
    imagesJson: text('images_json'),
    createdAt: createdAt(),
  },
  (t) => [index('products_user_idx').on(t.userId, t.createdAt)],
);

export const studioJobs = sqliteTable(
  'studio_jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modelId: text('model_id')
      .notNull()
      .references(() => virtualModels.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** 'photoshoot' | 'talking_video' (giai đoạn sau) */
    kind: text('kind').notNull().default('photoshoot'),
    /** 'queued' | 'running' | 'done' | 'failed' */
    status: text('status').notNull().default('queued'),
    /** JSON: { scene, count, notes } người dùng nhập */
    briefJson: text('brief_json').notNull(),
    /** Prompt cuối cùng đã gửi cho model sinh ảnh, để debug và sinh lại */
    prompt: text('prompt'),
    /** 'workers-ai' | 'external' */
    provider: text('provider').notNull().default('workers-ai'),
    /** JSON string[] các key R2 kết quả */
    resultKeysJson: text('result_keys_json'),
    costCredits: integer('cost_credits').notNull().default(0),
    error: text('error'),
    createdAt: createdAt(),
    finishedAt: integer('finished_at'),
  },
  (t) => [index('studio_jobs_user_idx').on(t.userId, t.createdAt)],
);

/** Sổ cái tín chỉ: số dư = tổng delta. Không sửa dòng cũ, chỉ thêm dòng mới. */
export const creditLedger = sqliteTable(
  'credit_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    /** 'topup' | 'job' | 'refund' | 'bonus' | 'admin' */
    reason: text('reason').notNull(),
    /** id đơn hàng hoặc job liên quan */
    refId: text('ref_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('credit_ledger_user_idx').on(t.userId, t.createdAt),
    // Mỗi đơn/job chỉ được ghi một dòng cùng lý do: webhook gọi trùng không cộng hai lần
    uniqueIndex('credit_ledger_reason_ref_unique').on(t.reason, t.refId),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type Memorial = typeof memorials.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type GuestbookEntry = typeof guestbookEntries.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Creator = typeof creators.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type VideoSnapshot = typeof videoSnapshots.$inferSelect;
export type CreatorAnalysis = typeof creatorAnalyses.$inferSelect;
export type VirtualModel = typeof virtualModels.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StudioJob = typeof studioJobs.$inferSelect;
export type CreditEntry = typeof creditLedger.$inferSelect;
