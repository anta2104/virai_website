import { shortSuffix } from './ids';

const VIETNAMESE_MAP: Record<string, string> = {
  à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a',
  ă: 'a', ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
  è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
  ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
  ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o',
  ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
  ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
  ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
  đ: 'd',
};

/** "Miu Béo" → "miu-beo". Trả về chuỗi rỗng nếu không còn ký tự hợp lệ. */
export function slugify(input: string): string {
  const lower = input.toLowerCase().normalize('NFC');
  let out = '';
  for (const ch of lower) {
    out += VIETNAMESE_MAP[ch] ?? ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

/** Các slug không được dùng vì trùng route hệ thống. */
const RESERVED = new Set([
  'admin',
  'api',
  'dang-ky',
  'dang-nhap',
  'dang-xuat',
  'tai-khoan',
  'bang-gia',
  'be',
  'og',
  'qr',
  'demo',
]);

/**
 * Sinh slug khả dụng cho trang kỷ niệm: thử tên gốc, nếu trùng thì thêm hậu tố.
 * `exists` do phía gọi cung cấp để kiểm tra trong D1.
 */
export async function uniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name) || 'be-yeu';
  let candidate = RESERVED.has(base) ? `${base}-${shortSuffix()}` : base;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${base}-${shortSuffix()}`;
  }
  return `${base}-${shortSuffix(8)}`;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 64 && !RESERVED.has(slug);
}
