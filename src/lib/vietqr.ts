/**
 * Sinh chuỗi thanh toán VietQR (chuẩn EMVCo của NAPAS) để app ngân hàng quét.
 *
 * Cấu trúc TLV: mỗi trường là <id 2 số><độ dài 2 số><giá trị>.
 * Trường 38 chứa thông tin tài khoản nhận, trường 62.08 chứa nội dung chuyển khoản.
 */

/** GUID của NAPAS trong đặc tả VietQR. */
const NAPAS_GUID = 'A000000727';
/** Chuyển tiền đến số tài khoản (khác QRIBFTTC là đến số thẻ). */
const SERVICE_TRANSFER_TO_ACCOUNT = 'QRIBFTTA';

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, '0');
  return `${id}${length}${value}`;
}

/** CRC-16/CCITT-FALSE, đúng biến thể mà VietQR dùng cho trường 63. */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: chỉ chữ/số/space để ngân hàng không cắt bớt. */
function sanitizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 50);
}

export interface VietQrInput {
  /** Mã ngân hàng theo chuẩn VietQR (BIN 6 số), ví dụ Vietcombank 970436 */
  bankCode: string;
  accountNumber: string;
  /** Số tiền (VND, số nguyên). Bỏ trống thì người chuyển tự nhập. */
  amount?: number;
  /** Nội dung chuyển khoản — chính là payment_code của đơn */
  description?: string;
}

export function vietQrPayload(input: VietQrInput): string {
  const bankInfo =
    tlv('00', input.bankCode) + tlv('01', input.accountNumber);

  const merchantAccount =
    tlv('00', NAPAS_GUID) + tlv('01', bankInfo) + tlv('02', SERVICE_TRANSFER_TO_ACCOUNT);

  let payload =
    tlv('00', '01') +
    // 12 = mã động (có số tiền / nội dung cụ thể), 11 = mã tĩnh
    tlv('01', input.amount ? '12' : '11') +
    tlv('38', merchantAccount) +
    tlv('53', '704') +
    (input.amount ? tlv('54', String(Math.round(input.amount))) : '') +
    tlv('58', 'VN');

  if (input.description) {
    const description = sanitizeDescription(input.description);
    if (description) {
      payload += tlv('62', tlv('08', description));
    }
  }

  payload += '6304';
  return payload + crc16(payload);
}

/** Danh sách BIN của vài ngân hàng phổ biến, để hiện gợi ý trong cấu hình. */
export const BANK_NAMES: Record<string, string> = {
  '970436': 'Vietcombank',
  '970415': 'VietinBank',
  '970418': 'BIDV',
  '970405': 'Agribank',
  '970422': 'MB Bank',
  '970407': 'Techcombank',
  '970416': 'ACB',
  '970432': 'VPBank',
  '970423': 'TPBank',
  '970403': 'Sacombank',
  '970441': 'VIB',
  '970443': 'SHB',
  '970426': 'MSB',
  '546034': 'Cake by VPBank',
  '963388': 'Timo',
};

export function bankLabel(bankCode: string): string {
  return BANK_NAMES[bankCode] ?? `Ngân hàng mã ${bankCode}`;
}

export interface BankConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/** Đọc cấu hình ngân hàng từ secrets; trả về null nếu chưa cấu hình đủ. */
export function bankConfigFrom(env: Env): BankConfig | null {
  const bankCode = env.BANK_CODE?.trim();
  const accountNumber = env.BANK_ACCOUNT_NUMBER?.trim();
  const accountName = env.BANK_ACCOUNT_NAME?.trim();
  if (!bankCode || !accountNumber || !accountName) return null;
  return { bankCode, accountNumber, accountName };
}
