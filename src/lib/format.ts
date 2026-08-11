import { jdFromDate, parseIsoDate } from './lunar';

/** '2025-03-20' → '20/03/2025'. Trả về chuỗi rỗng nếu không hợp lệ. */
export function formatDate(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  if (!d) return '';
  return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
}

/** Mốc unix (giây) → '20/03/2025 14:05' theo giờ Việt Nam. */
export function formatDateTime(seconds: number | null | undefined): string {
  if (!seconds) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(seconds * 1000));
}

/** Ngày hôm nay ở Việt Nam, dạng 'YYYY-MM-DD'. */
export function todayInVietnam(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
  return parts; // en-CA cho ra đúng YYYY-MM-DD
}

/**
 * Khoảng thời gian giữa hai ngày, diễn đạt tự nhiên: "12 năm 3 tháng".
 * Dùng để hiển thị "đã ở bên nhau bao lâu".
 */
export function humanSpan(fromIso: string | null | undefined, toIso: string | null | undefined): string {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return '';
  if (jdFromDate(to.day, to.month, to.year) < jdFromDate(from.day, from.month, from.year)) return '';

  let years = to.year - from.year;
  let months = to.month - from.month;
  let days = to.day - from.day;
  if (days < 0) months -= 1;
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} năm`);
  if (months > 0) parts.push(`${months} tháng`);
  if (parts.length === 0) {
    const totalDays = jdFromDate(to.day, to.month, to.year) - jdFromDate(from.day, from.month, from.year);
    return `${totalDays} ngày`;
  }
  return parts.join(' ');
}

/** Số ngày đã trôi qua kể từ `iso` tới `todayIso`. */
export function daysSince(iso: string, todayIso: string): number | null {
  const a = parseIsoDate(iso);
  const b = parseIsoDate(todayIso);
  if (!a || !b) return null;
  return jdFromDate(b.day, b.month, b.year) - jdFromDate(a.day, a.month, a.year);
}

export const SPECIES_LABEL: Record<string, string> = {
  cho: 'Chó',
  meo: 'Mèo',
  khac: 'Khác',
};

export const GENDER_LABEL: Record<string, string> = {
  duc: 'Bạn trai',
  cai: 'Bạn gái',
  khong_ro: '',
};

/** Cắt chuỗi cho meta description / OG. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
