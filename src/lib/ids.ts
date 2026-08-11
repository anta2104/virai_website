/** Bảng chữ không có ký tự dễ nhìn lẫn (0/O, 1/I/L) — dùng cho mã chuyển khoản. */
const UNAMBIGUOUS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newId(): string {
  return crypto.randomUUID();
}

/** Token ngẫu nhiên dạng hex, dùng cho session id. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomChars(length: number, alphabet: string): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (const byte of buf) {
    out += alphabet[byte % alphabet.length];
  }
  return out;
}

/**
 * Nội dung chuyển khoản duy nhất cho một đơn, ví dụ `VRM7K2QPX4`.
 * Chỉ chữ IN + số để ngân hàng không bóp méo khi khách nhập tay.
 */
export function newPaymentCode(): string {
  return `VRM${randomChars(7, UNAMBIGUOUS)}`;
}

/** Hậu tố ngắn thêm vào slug khi bị trùng. */
export function shortSuffix(length = 4): string {
  return randomChars(length, 'abcdefghijkmnpqrstuvwxyz23456789');
}
