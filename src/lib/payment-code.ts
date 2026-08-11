/**
 * Mã đơn ghi trong nội dung chuyển khoản.
 *
 * Tiền tố rất quan trọng và không tự do chọn: VietinBank chỉ đẩy thông báo biến
 * động số dư cho SePay với những giao dịch có nội dung chứa tiền tố đã đăng ký
 * (mặc định của SePay là `SEVQR`). Dùng tiền tố khác — ví dụ `VRM` như bản đầu —
 * thì ngân hàng lặng lẽ bỏ qua giao dịch, SePay không thấy gì, webhook không bao
 * giờ chạy, dù mọi cấu hình đều đúng.
 *
 * Đổi tiền tố bằng secret PAYMENT_CODE_PREFIX, không cần sửa code.
 */

const DEFAULT_PREFIX = 'SEVQR';

/** Tiền tố cũ vẫn phải nhận, cho các đơn tạo trước khi đổi. */
const LEGACY_PREFIXES = ['VRM'];

/** Bảng chữ không có ký tự dễ nhìn lẫn (0/O, 1/I/L). */
const UNAMBIGUOUS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Số ký tự ngẫu nhiên sau tiền tố. */
const SUFFIX_LENGTH = 7;

export function paymentCodePrefix(env: Env): string {
  const configured = env.PAYMENT_CODE_PREFIX?.trim().toUpperCase();
  return configured && /^[A-Z0-9]{2,10}$/.test(configured) ? configured : DEFAULT_PREFIX;
}

export function newPaymentCode(env: Env): string {
  const buffer = new Uint8Array(SUFFIX_LENGTH);
  crypto.getRandomValues(buffer);
  let suffix = '';
  for (const byte of buffer) {
    suffix += UNAMBIGUOUS[byte % UNAMBIGUOUS.length];
  }
  return `${paymentCodePrefix(env)}${suffix}`;
}

/**
 * Mẫu dò mã đơn trong nội dung chuyển khoản. Nhận cả tiền tố đang dùng và các
 * tiền tố cũ, để đơn tạo trước khi đổi vẫn khớp được.
 */
export function paymentCodePattern(env: Env): RegExp {
  const prefixes = [paymentCodePrefix(env), ...LEGACY_PREFIXES];
  const unique = [...new Set(prefixes)];
  return new RegExp(`(?:${unique.join('|')})[0-9A-Z]{${SUFFIX_LENGTH}}`);
}
