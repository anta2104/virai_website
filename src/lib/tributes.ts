/** Thắp nến / thả hoa: mỗi khách một lần mỗi loại mỗi ngày, chặn bằng cookie. */

export type TributeType = 'candle' | 'flower';

export const TRIBUTE_TYPES: TributeType[] = ['candle', 'flower'];

export function parseTributeType(value: unknown): TributeType | null {
  return value === 'candle' || value === 'flower' ? value : null;
}

/**
 * Tên cookie ghi dấu khách đã gửi loại tưởng niệm này chưa.
 * Dùng chung giữa API và trang kỷ niệm để hai bên không lệch nhau.
 */
export function tributeCookieName(type: TributeType, memorialId: string): string {
  return `vm_${type}_${memorialId.slice(0, 8)}`;
}
