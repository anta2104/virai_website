/**
 * Kiểm tra lịch âm — chạy bằng: npm test
 *
 * Node 24 tự bóc kiểu TypeScript nên chạy thẳng file .ts, không cần build.
 * `src/lib/lunar.ts` cố ý không phụ thuộc thư viện nào để test được như thế.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, lunarToSolar, nextAnniversary, solarToLunar } from '../src/lib/lunar.ts';

describe('solarToLunar ⇄ lunarToSolar', () => {
  it('đi và về khớp nhau ở các ngày mốc', () => {
    for (const iso of ['2023-01-21', '2023-03-22', '2024-02-10', '2025-01-29', '2026-02-17']) {
      const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
      const lunar = solarToLunar(d, m, y);
      const back = lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.leap);
      assert.deepEqual(back, { day: d, month: m, year: y }, `lệch ở ${iso}`);
    }
  });

  it('trả null khi tháng thiếu không có ngày 30', () => {
    // 21/01/2023 = 30 tháng Chạp năm Nhâm Dần. Tháng Chạp các năm sau đó
    // có năm chỉ 29 ngày — khi ấy ngày 30 không tồn tại.
    const lunar = solarToLunar(21, 1, 2023);
    assert.equal(lunar.day, 30);
    assert.equal(lunar.month, 12);

    const missing = [2023, 2024, 2025, 2026].filter(
      (y) => lunarToSolar(30, 12, y, 0) === null,
    );
    assert.ok(missing.length > 0, 'phải có ít nhất một năm tháng Chạp thiếu');
  });

  it('trả null với ngày âm không hợp lệ', () => {
    assert.equal(lunarToSolar(0, 5, 2025, 0), null);
    assert.equal(lunarToSolar(31, 5, 2025, 0), null);
  });
});

describe('nextAnniversary', () => {
  /** Ngày giỗ phải rơi đúng vào ngày âm đã hẹn, không tràn sang tháng sau. */
  function checkThreeYears(deathIso: string, expectMonth: number, expectDays: number[]) {
    // Bắt đầu từ hôm sau ngày mất, và mỗi vòng lại nhích thêm một ngày —
    // truyền lại đúng ngày giỗ thì hàm trả về chính ngày đó (jd >= fromJd).
    let from = addDays(deathIso, 1);
    const seen: string[] = [];

    for (let i = 0; i < 3; i++) {
      const next = nextAnniversary(deathIso, from);
      assert.ok(next, `không tính được giỗ lần ${i + 1} của ${deathIso}`);
      assert.ok(next.date > from || next.date === from, 'giỗ không được nằm trước mốc');

      const [y, m, d] = next.date.split('-').map(Number) as [number, number, number];
      const actual = solarToLunar(d, m, y);

      assert.equal(actual.month, expectMonth, `giỗ lần ${i + 1} lệch tháng: ${next.date}`);
      assert.ok(
        expectDays.includes(actual.day),
        `giỗ lần ${i + 1} rơi vào ngày ${actual.day} âm (${next.date}), ngoài dự kiến`,
      );
      // Nhãn hiển thị phải khớp ngày âm thật
      assert.equal(next.lunar.day, actual.day);
      assert.equal(next.lunar.month, actual.month);

      seen.push(next.date);
      from = addDays(next.date, 1);
    }

    assert.equal(new Set(seen).size, 3, `ba lần giỗ phải khác nhau: ${seen.join(', ')}`);
  }

  it('ngày mất 30 tháng Chạp — giỗ lùi về 29 khi tháng thiếu, không nhảy sang tháng Giêng', () => {
    // Ca lỗi cũ: giỗ bị tính thành mùng 1 tháng Giêng, lệch hẳn một tháng.
    checkThreeYears('2023-01-21', 12, [29, 30]);
  });

  it('ngày mất mùng 1 tháng 2 nhuận — giỗ vào tháng 2 thường', () => {
    checkThreeYears('2023-03-22', 2, [1]);
  });

  it('ngày mất giữa tháng — giỗ giữ nguyên ngày âm', () => {
    checkThreeYears('2024-06-15', solarToLunar(15, 6, 2024).month, [
      solarToLunar(15, 6, 2024).day,
    ]);
  });

  it('lần giỗ kế tiếp luôn nằm sau mốc so sánh', () => {
    const next = nextAnniversary('2023-01-21', '2026-08-13');
    assert.ok(next);
    assert.ok(next.date > '2026-08-13', `giỗ ${next.date} không được nằm trong quá khứ`);
  });
});
