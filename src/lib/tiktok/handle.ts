/**
 * Chuẩn hoá đầu vào của người dùng thành handle TikTok.
 *
 * Nhận: `https://www.tiktok.com/@abc?lang=vi`, `tiktok.com/@abc/video/123`,
 * `@abc`, `abc`. Trả về handle chữ thường không có @, hoặc null nếu không hợp lệ.
 *
 * Không import gì để test được trực tiếp bằng Node.
 */

/** TikTok cho phép chữ, số, dấu chấm và gạch dưới; 2–24 ký tự. */
const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;

export function normalizeHandle(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  // Link đầy đủ hoặc thiếu giao thức
  if (/tiktok\.com/i.test(value)) {
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const match = /^\/@([^/?#]+)/.exec(url.pathname);
    if (!match) return null;
    value = match[1]!;
  }

  value = value.replace(/^@/, '').toLowerCase();
  // Dấu chấm cuối handle không hợp lệ trên TikTok
  if (value.endsWith('.')) return null;
  return HANDLE_PATTERN.test(value) ? value : null;
}

export function profileUrl(handle: string): string {
  return `https://www.tiktok.com/@${handle}`;
}
