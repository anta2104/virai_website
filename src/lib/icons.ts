/**
 * Bộ icon nét mảnh vẽ riêng cho dự án.
 *
 * Thay cho emoji: emoji mỗi hệ điều hành hiển thị một kiểu, màu sắc chỏi với bảng
 * màu của trang, và là dấu hiệu rõ nhất của giao diện dựng vội. Cả bộ dùng chung
 * khung 24×24, nét 1.5, bo tròn đầu nét, ăn theo `currentColor`.
 *
 * Để riêng ở file .ts vì frontmatter của component Astro không export type được.
 */

export type IconName =
  | 'moon'
  | 'quill'
  | 'qr'
  | 'candle'
  | 'petal'
  | 'share'
  | 'infinity'
  | 'paw'
  | 'sprout'
  | 'heart'
  | 'lotus'
  | 'clock'
  | 'check'
  | 'arrow-right'
  | 'link'
  | 'mail'
  | 'book'
  | 'arrow-left'
  | 'plus'
  | 'image'
  | 'pencil'
  | 'palette'
  | 'eye'
  | 'external'
  | 'chevron-right';

export const ICON_PATHS: Record<IconName, string> = {
  moon: '<path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z"/><path d="M17 4.2v3.1M15.4 5.8h3.1"/>',
  quill:
    '<path d="M4.5 19.5c0-5 2.2-9.2 5.6-11.7C13 5.6 16.6 4.6 20 4.5c-.1 3.4-1.1 7-3.3 9.9-2.5 3.4-6.7 5.6-11.7 5.6"/><path d="m10.6 13.4-5.9 6"/><path d="M9.4 16.2h4"/>',
  qr:
    '<rect x="3.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="3.5" y="14.5" width="6" height="6" rx="1.2"/><path d="M14.5 14.5h2.5v2.5h-2.5zM20.5 20.5H18V18h2.5z"/><path d="M14.5 20.5h1.2M20.5 14.5v1.2"/>',
  candle:
    '<path d="M12 3.2c1.9 2.6 2.8 4.3 2.8 5.8A2.8 2.8 0 0 1 12 11.8a2.8 2.8 0 0 1-2.8-2.8c0-1.5.9-3.2 2.8-5.8Z"/><path d="M12 11.8v1.9"/><rect x="8.2" y="13.7" width="7.6" height="7.1" rx="2"/>',
  petal:
    '<path d="M12 3.2c3.8 4.2 5.6 7.6 5.6 10.4 0 3.7-2.5 6-5.6 6s-5.6-2.3-5.6-6c0-2.8 1.8-6.2 5.6-10.4Z"/><path d="M12 19.6V9.4"/>',
  share:
    '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="5.8" r="2.6"/><circle cx="17.5" cy="18.2" r="2.6"/><path d="m8.3 10.8 6.9-3.7M8.3 13.2l6.9 3.7"/>',
  infinity:
    '<path d="M8.4 8.6c2.3 0 3 2 3.6 3.4.6 1.4 1.3 3.4 3.6 3.4a3.4 3.4 0 1 0 0-6.8c-2.3 0-3 2-3.6 3.4-.6 1.4-1.3 3.4-3.6 3.4a3.4 3.4 0 1 1 0-6.8Z"/>',
  paw:
    '<ellipse cx="7.4" cy="10.2" rx="1.9" ry="2.5"/><ellipse cx="12" cy="8.4" rx="2" ry="2.7"/><ellipse cx="16.6" cy="10.2" rx="1.9" ry="2.5"/><path d="M12 13.2c3 0 5.3 2.2 5.3 4.3 0 1.7-1.5 2.6-3.2 2.6-.9 0-1.5-.3-2.1-.3s-1.2.3-2.1.3c-1.7 0-3.2-.9-3.2-2.6 0-2.1 2.3-4.3 5.3-4.3Z"/>',
  sprout:
    '<path d="M12 20.5v-7.8"/><path d="M12 12.7C12 9.5 9.6 7 6.4 7c0 3.2 2.4 5.7 5.6 5.7Z"/><path d="M12 12.7c0-3.6 2.7-6.4 6.2-6.4 0 3.5-2.8 6.4-6.2 6.4Z"/>',
  heart:
    '<path d="M12 20.4c-.5 0-6.9-4.1-6.9-9.1A4.2 4.2 0 0 1 12 8.6a4.2 4.2 0 0 1 6.9 2.7c0 5-6.4 9.1-6.9 9.1Z"/>',
  lotus:
    '<path d="M12 5c1.9 2.3 2.8 4.3 2.8 6.2 0 2.4-1.3 3.9-2.8 3.9s-2.8-1.5-2.8-3.9c0-1.9.9-3.9 2.8-6.2Z"/><path d="M9.2 11.2c-1.7-1-3.4-1.4-5-1.2.4 2.6 2.3 4.6 4.7 5.1"/><path d="M14.8 11.2c1.7-1 3.4-1.4 5-1.2-.4 2.6-2.3 4.6-4.7 5.1"/><path d="M4 17.6c2 1.6 4.9 2.5 8 2.5s6-.9 8-2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.3V12l3.2 2"/>',
  check: '<path d="m4.8 12.6 4.6 4.6L19.2 7.4"/>',
  'arrow-right': '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
  link:
    '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 1 0-5.1-5.1l-1.4 1.4"/><path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 1 0 5.1 5.1l1.4-1.4"/>',
  mail: '<rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2"/><path d="m4.4 7.4 7.6 5.4 7.6-5.4"/>',
  'arrow-left': '<path d="M19.5 12h-15"/><path d="m10.5 6-6 6 6 6"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  image:
    '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.2"/><circle cx="8.8" cy="9.8" r="1.6"/><path d="m4 17.2 4.6-4.3a2 2 0 0 1 2.7 0l3.2 3a2 2 0 0 0 2.7 0l3.4-3.1"/>',
  pencil:
    '<path d="M4.5 19.5h3.2L18.9 8.3a2.3 2.3 0 0 0-3.2-3.2L4.5 16.3v3.2Z"/><path d="m14.6 6.2 3.2 3.2"/>',
  palette:
    '<path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.4 0 2.2-.9 2.2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.9-1.8h1.4a3.9 3.9 0 0 0 3.9-4c0-3.5-3.6-6.3-8.4-6.3Z"/><circle cx="8" cy="10.4" r="1.1"/><circle cx="12" cy="7.9" r="1.1"/><circle cx="16" cy="10.4" r="1.1"/>',
  eye: '<path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.9"/>',
  external:
    '<path d="M13.5 4.5h6v6"/><path d="m19.5 4.5-8 8"/><path d="M18 14.2v4.1a1.6 1.6 0 0 1-1.6 1.6H5.7a1.6 1.6 0 0 1-1.6-1.6V7.6A1.6 1.6 0 0 1 5.7 6h4.1"/>',
  'chevron-right': '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  book:
    '<path d="M4.5 5.2c2.5-.7 5-.7 7.5 0v14.2c-2.5-.7-5-.7-7.5 0V5.2Z"/><path d="M19.5 5.2c-2.5-.7-5-.7-7.5 0v14.2c2.5-.7 5-.7 7.5 0V5.2Z"/>',
};
