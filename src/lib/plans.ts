/** Giá và hạn mức của từng gói. Sửa giá ở đây là đổi toàn bộ site. */

export const PRICES = {
  premium: 29_000,
  physicalCombo: 99_000,
} as const;

export type PriceKey = keyof typeof PRICES;

/**
 * Đợt ưu đãi có hạn.
 *
 * Hạn chót tính bằng mốc UTC tương ứng 23:59:59 ngày 31/08/2026 giờ Việt Nam.
 * Hết hạn là giá tự về mức thường, không cần ai tắt bằng tay — điều này quan
 * trọng: hiện "giá gốc gạch ngang" mà giá không bao giờ quay lại thì là quảng
 * cáo sai sự thật.
 */
export const PROMO = {
  /** Chỉ áp cho gói nào */
  applies: 'premium' as PriceKey,
  percent: 50,
  label: 'Ưu đãi ra mắt',
  /** 23:59:59 ngày 31/08/2026 theo giờ Việt Nam (UTC+7) */
  endsAtUtc: Date.UTC(2026, 7, 31, 16, 59, 59, 999),
  /** Hiển thị cho người đọc */
  endsAtLabel: '31/08/2026',
} as const;

export interface PriceView {
  /** Giá thường, dùng để gạch ngang khi có ưu đãi */
  base: number;
  /** Số tiền khách thật sự trả */
  price: number;
  /** Có đang giảm không */
  discounted: boolean;
  percent: number;
  endsAtLabel: string;
  /** Số ngày còn lại, tính theo ngày giờ Việt Nam */
  daysLeft: number;
}

/** Làm tròn xuống hàng nghìn cho số tiền dễ nhìn và luôn có lợi cho khách. */
function roundDown(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

export function isPromoActive(now: number = Date.now()): boolean {
  return now <= PROMO.endsAtUtc;
}

/** Giá hiển thị của một gói tại thời điểm `now`. */
export function priceView(key: PriceKey, now: number = Date.now()): PriceView {
  const base = PRICES[key];
  const active = key === PROMO.applies && isPromoActive(now);
  const price = active ? roundDown((base * (100 - PROMO.percent)) / 100) : base;
  const msLeft = PROMO.endsAtUtc - now;

  return {
    base,
    price,
    discounted: active && price < base,
    percent: PROMO.percent,
    endsAtLabel: PROMO.endsAtLabel,
    daysLeft: active ? Math.max(0, Math.ceil(msLeft / 86_400_000)) : 0,
  };
}

/** Số tiền thật sự tính vào đơn hàng — nguồn duy nhất cho việc thu tiền. */
export function amountToCharge(key: PriceKey, now: number = Date.now()): number {
  return priceView(key, now).price;
}

export const LIMITS = {
  free: {
    /** Số trang kỷ niệm miễn phí mỗi tài khoản */
    memorials: 1,
    photos: 10,
    themes: ['am-ap'] as string[],
    /** Số lời lưu bút được hiển thị trên trang free */
    guestbookVisible: 20,
    aiRewritesPerDay: 3,
    videoUpload: false,
    hideBranding: false,
    reminders: false,
    qrDownload: false,
  },
  premium: {
    memorials: Number.POSITIVE_INFINITY,
    photos: 200,
    themes: ['am-ap', 'thanh-tinh', 'dem-sao'] as string[],
    guestbookVisible: Number.POSITIVE_INFINITY,
    aiRewritesPerDay: 30,
    videoUpload: true,
    hideBranding: true,
    reminders: true,
    qrDownload: true,
  },
} as const;

export type PlanKey = keyof typeof LIMITS;

export function planOf(isPremium: boolean | number): PlanKey {
  return isPremium ? 'premium' : 'free';
}

export function limitsFor(isPremium: boolean | number) {
  return LIMITS[planOf(isPremium)];
}

export const THEMES = [
  {
    id: 'am-ap',
    name: 'Ấm áp',
    description: 'Nền kem, chữ nâu ấm, cảm giác như một cuốn album gia đình.',
    premiumOnly: false,
  },
  {
    id: 'thanh-tinh',
    name: 'Thanh tịnh',
    description: 'Trắng xanh nhạt, nhiều khoảng trống, tĩnh lặng và trang trọng.',
    premiumOnly: true,
  },
  {
    id: 'dem-sao',
    name: 'Đêm sao',
    description: 'Nền đêm sâu với dải sao mờ — dành cho những bé đã về trời.',
    premiumOnly: true,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function isThemeAllowed(theme: string, isPremium: boolean | number): boolean {
  return limitsFor(isPremium).themes.includes(theme);
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}
