/** Giá và hạn mức của từng gói. Sửa giá ở đây là đổi toàn bộ site. */

export const PRICES = {
  premium: 249_000,
  physicalCombo: 499_000,
} as const;

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
