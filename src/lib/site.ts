/** Thông tin thương hiệu dùng chung — đổi ở đây là đổi toàn site. */
export const site = {
  name: 'Virai Memorial',
  shortName: 'Virai Memorial',
  tagline: 'Nơi lưu giữ kỷ niệm về người bạn nhỏ',
  description:
    'Tạo trang tưởng niệm trực tuyến cho thú cưng đã rời đi: ảnh, câu chuyện, sổ lưu bút, mã QR chia sẻ và nhắc ngày giỗ theo âm lịch.',
  url: 'https://virai.com.vn',
  locale: 'vi_VN',
  company: 'Công ty Virai',
  companyUrl: 'https://virai.com.vn',
  supportEmail: 'hotro@virai.com.vn',
  /** Email gửi đi qua Resend — domain phải được xác thực trên Resend */
  fromEmail: 'Virai Memorial <no-reply@virai.com.vn>',
} as const;

/** Đường dẫn công khai của một trang kỷ niệm. */
export function memorialPath(slug: string): string {
  return `/be/${slug}`;
}

export function memorialUrl(slug: string, baseUrl: string = site.url): string {
  return new URL(memorialPath(slug), baseUrl).href;
}
