/** Thông tin thương hiệu dùng chung — đổi ở đây là đổi toàn site. */
export const site = {
  name: 'Virai',
  shortName: 'Virai',
  tagline: 'Phân tích TikTok và người mẫu ảo bằng AI',
  description:
    'Dán link kênh TikTok để biết video nào đang kéo bạn lên và AI gợi ý gì tiếp theo. Thuê người mẫu ảo chụp ảnh sản phẩm cho shop trong vài phút.',
  url: 'https://virai.com.vn',
  locale: 'vi_VN',
  company: 'Công ty Virai',
  companyUrl: 'https://virai.com.vn',
  supportEmail: 'hotro@virai.com.vn',
  /** Email gửi đi qua Resend — domain phải được xác thực trên Resend */
  fromEmail: 'Virai <no-reply@virai.com.vn>',
} as const;

/** Đường dẫn công khai của một trang kỷ niệm. */
export function memorialPath(slug: string): string {
  return `/be/${slug}`;
}

export function memorialUrl(slug: string, baseUrl: string = site.url): string {
  return new URL(memorialPath(slug), baseUrl).href;
}
