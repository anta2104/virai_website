import { addDays, canChiOfYear, lunarShort, nextAnniversary, parseIsoDate, solarToLunar } from './lunar';
import { daysSince, formatDate, humanSpan, todayInVietnam } from './format';

export interface Milestone {
  /** Khoá kỹ thuật, cũng là `reminders.type` */
  key: '49_ngay' | '100_ngay' | 'gio_hang_nam';
  label: string;
  /** Ngày dương lịch 'YYYY-MM-DD' */
  date: string;
  lunarText: string | null;
  /** Đã qua chưa */
  passed: boolean;
  note?: string;
}

/**
 * Các mốc tưởng niệm theo phong tục Việt Nam.
 *
 * Quy ước tính: ngày bé rời đi được tính là ngày thứ nhất, nên ngày 49 là
 * ngày mất + 48 ngày. Ngày giỗ hằng năm lấy theo ngày âm của ngày mất.
 */
export function milestonesFor(deathDate: string | null, today = todayInVietnam()): Milestone[] {
  if (!deathDate || !parseIsoDate(deathDate)) return [];

  const milestones: Milestone[] = [];
  const day49 = addDays(deathDate, 48);
  const day100 = addDays(deathDate, 99);

  milestones.push({
    key: '49_ngay',
    label: 'Cúng 49 ngày (chung thất)',
    date: day49,
    lunarText: lunarShort(day49),
    passed: (daysSince(day49, today) ?? 0) > 0,
    note: 'Tính ngày bé rời đi là ngày thứ nhất.',
  });

  milestones.push({
    key: '100_ngay',
    label: 'Cúng 100 ngày (tốt khốc)',
    date: day100,
    lunarText: lunarShort(day100),
    passed: (daysSince(day100, today) ?? 0) > 0,
  });

  const anniversary = nextAnniversary(deathDate, today);
  if (anniversary) {
    const ordinal = anniversary.yearsSince === 1 ? 'Giỗ đầu' : `Giỗ năm thứ ${anniversary.yearsSince}`;
    milestones.push({
      key: 'gio_hang_nam',
      label: `${ordinal} — năm ${canChiOfYear(anniversary.lunar.year)}`,
      date: anniversary.date,
      lunarText: `${String(anniversary.lunar.day).padStart(2, '0')}/${String(anniversary.lunar.month).padStart(2, '0')} âm lịch`,
      passed: false,
      note: 'Theo ngày âm của ngày bé rời đi.',
    });
  }

  return milestones;
}

/** Mốc kế tiếp chưa qua — dùng để hiện "sắp tới" trên trang. */
export function upcomingMilestone(deathDate: string | null, today = todayInVietnam()): Milestone | null {
  const upcoming = milestonesFor(deathDate, today).filter((milestone) => !milestone.passed);
  return upcoming[0] ?? null;
}

export interface LifeSummary {
  /** "12/03/2012 — 20/03/2025" */
  dateLine: string;
  /** "Sinh 12/03 âm lịch, năm Nhâm Thìn · Rời đi 21/02 âm lịch, năm Ất Tỵ" */
  lunarLine: string | null;
  /** "12 năm 3 tháng bên nhau" */
  spanLine: string | null;
}

export function lifeSummary(
  birthDate: string | null,
  deathDate: string | null,
): LifeSummary {
  const birthText = formatDate(birthDate);
  const deathText = formatDate(deathDate);

  let dateLine = '';
  if (birthText && deathText) dateLine = `${birthText} — ${deathText}`;
  else if (deathText) dateLine = `Rời đi ngày ${deathText}`;
  else if (birthText) dateLine = `Sinh ngày ${birthText}`;

  const lunarParts: string[] = [];
  const birthLunar = birthDate ? lunarWithYear(birthDate) : null;
  const deathLunar = deathDate ? lunarWithYear(deathDate) : null;
  if (birthLunar) lunarParts.push(`Sinh ${birthLunar}`);
  if (deathLunar) lunarParts.push(`Rời đi ${deathLunar}`);

  const span = humanSpan(birthDate, deathDate);

  return {
    dateLine,
    lunarLine: lunarParts.length > 0 ? lunarParts.join(' · ') : null,
    spanLine: span ? `${span} bên nhau` : null,
  };
}

function lunarWithYear(iso: string): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const lunar = solarToLunar(parsed.day, parsed.month, parsed.year);
  return `${String(lunar.day).padStart(2, '0')}/${String(lunar.month).padStart(2, '0')} âm lịch năm ${canChiOfYear(lunar.year)}`;
}
