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
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
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

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type Memorial = typeof memorials.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type GuestbookEntry = typeof guestbookEntries.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
