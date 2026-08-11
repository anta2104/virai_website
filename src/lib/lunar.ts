/**
 * Chuyển đổi âm lịch ⇄ dương lịch cho múi giờ Việt Nam (UTC+7).
 *
 * Thuật toán dựa trên bài "Âm lịch Việt Nam" của Hồ Ngọc Đức, xây trên các công
 * thức thiên văn của Jean Meeus (Astronomical Algorithms). Viết lại bằng
 * TypeScript, không phụ thuộc thư viện ngoài để chạy được trên Cloudflare Workers.
 */

const TIMEZONE = 7;
const PI = Math.PI;

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = [
  'Tý',
  'Sửu',
  'Dần',
  'Mão',
  'Thìn',
  'Tỵ',
  'Ngọ',
  'Mùi',
  'Thân',
  'Dậu',
  'Tuất',
  'Hợi',
];

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** 1 nếu là tháng nhuận */
  leap: number;
}

/** Số ngày Julius của một ngày dương lịch. */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Ngược lại: số ngày Julius → [ngày, tháng, năm] dương lịch. */
export function jdToDate(jd: number): [number, number, number] {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

/** Thời điểm sóc (new moon) thứ k tính từ 1/1/1900, trả về số ngày Julius. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 = jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

/** Kinh độ mặt trời (radian) tại thời điểm jdn. */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  dl = dl + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + dl) * dr;
  L = L - PI * 2 * Math.floor(L / (PI * 2));
  return L;
}

function getSunLongitude(dayNumber: number, timeZone: number): number {
  return Math.floor((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

function getNewMoonDay(k: number, timeZone: number): number {
  return Math.floor(newMoon(k) + 0.5 + timeZone / 24);
}

/** Ngày bắt đầu tháng 11 âm lịch của năm dương yy. */
function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Dương lịch → âm lịch (múi giờ Việt Nam). */
export function solarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const timeZone = TIMEZONE;
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

/**
 * Âm lịch → dương lịch. Trả về `null` nếu ngày âm không tồn tại
 * (ví dụ yêu cầu tháng nhuận trong năm không có tháng nhuận đó).
 */
export function lunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap = 0,
): { day: number; month: number; year: number } | null {
  const timeZone = TIMEZONE;
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) {
      return null;
    }
    if (lunarLeap !== 0 || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  const [day, month, year] = jdToDate(monthStart + lunarDay - 1);
  return { day, month, year };
}

/** Can Chi của năm âm lịch, ví dụ 2024 → "Giáp Thìn". */
export function canChiOfYear(lunarYear: number): string {
  const can = CAN[(lunarYear + 6) % 10] ?? '';
  const chi = CHI[(lunarYear + 8) % 12] ?? '';
  return `${can} ${chi}`;
}

// ── Tiện ích cho chuỗi ngày 'YYYY-MM-DD' ────────────────────────────────────

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tách 'YYYY-MM-DD' thành số, trả về null nếu sai định dạng hoặc không phải ngày thật. */
export function parseIsoDate(
  value: string | null | undefined,
): { day: number; month: number; year: number } | null {
  if (!value) return null;
  const m = ISO_DATE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Kiểm tra ngày có thật (ví dụ loại 2025-02-30)
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { day, month, year };
}

export function toIsoDate(d: { day: number; month: number; year: number }): string {
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Cộng số ngày vào một ngày ISO, trả về ngày ISO mới. */
export function addDays(iso: string, days: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) throw new Error(`Ngày không hợp lệ: ${iso}`);
  const jd = jdFromDate(parsed.day, parsed.month, parsed.year) + days;
  const [day, month, year] = jdToDate(jd);
  return toIsoDate({ day, month, year });
}

/** Chuỗi âm lịch hiển thị: "12/03 âm lịch, năm Giáp Thìn". */
export function lunarLabel(iso: string | null | undefined): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const lunar = solarToLunar(parsed.day, parsed.month, parsed.year);
  const leap = lunar.leap ? ' (nhuận)' : '';
  return `${pad(lunar.day)}/${pad(lunar.month)}${leap} âm lịch, năm ${canChiOfYear(lunar.year)}`;
}

/** Chuỗi ngắn cho ngày âm: "12/03 âm lịch". */
export function lunarShort(iso: string | null | undefined): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const lunar = solarToLunar(parsed.day, parsed.month, parsed.year);
  return `${pad(lunar.day)}/${pad(lunar.month)}${lunar.leap ? ' nhuận' : ''} âm lịch`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Ngày dương lịch của lần giỗ (theo ngày âm của ngày mất) kế tiếp sau `fromIso`.
 * Trả về cả nhãn hiển thị và năm giỗ thứ mấy.
 */
export function nextAnniversary(
  deathIso: string,
  fromIso: string,
): { date: string; lunar: LunarDate; yearsSince: number } | null {
  const death = parseIsoDate(deathIso);
  const from = parseIsoDate(fromIso);
  if (!death || !from) return null;
  const deathLunar = solarToLunar(death.day, death.month, death.year);
  const fromJd = jdFromDate(from.day, from.month, from.year);

  // Thử từ năm âm hiện tại trở đi; cần vài vòng vì tháng nhuận có thể làm lệch.
  const fromLunar = solarToLunar(from.day, from.month, from.year);
  for (let y = fromLunar.year; y <= fromLunar.year + 4; y++) {
    const solar = lunarToSolar(deathLunar.day, deathLunar.month, y, 0);
    if (!solar) continue;
    const jd = jdFromDate(solar.day, solar.month, solar.year);
    if (jd >= fromJd) {
      return {
        date: toIsoDate(solar),
        lunar: { day: deathLunar.day, month: deathLunar.month, year: y, leap: 0 },
        yearsSince: y - deathLunar.year,
      };
    }
  }
  return null;
}
