/** Kiểm tra phần tách câu lệnh của auto-migrate — phần gọi D1 thật thử bằng dev server. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

// Không import module chính vì nó dùng import.meta.glob của Vite; copy hàm thuần ra test
function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint/)
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

describe('splitStatements', () => {
  it('tách đúng số câu lệnh của mọi migration đang có', () => {
    for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(`migrations/${file}`, 'utf8');
      const statements = splitStatements(sql);
      const breakpoints = (sql.match(/statement-breakpoint/g) ?? []).length;
      assert.ok(statements.length >= 1, `${file} không có câu lệnh nào`);
      assert.ok(statements.length <= breakpoints + 1, `${file} tách ra nhiều hơn số dấu ngắt`);
      for (const statement of statements) {
        assert.match(statement, /^(CREATE|ALTER|INSERT|DROP|UPDATE|PRAGMA)/i, `${file}: câu lệnh lạ: ${statement.slice(0, 60)}`);
        assert.ok(!statement.includes('statement-breakpoint'));
      }
    }
  });

  it('bỏ dòng chú thích nhưng giữ nguyên câu lệnh nhiều dòng', () => {
    const out = splitStatements('-- ghi chú\nCREATE TABLE a (\n  id text\n);--> statement-breakpoint\n-- nữa\nINSERT INTO a VALUES (1);');
    assert.deepEqual(out, ['CREATE TABLE a (\n  id text\n);', 'INSERT INTO a VALUES (1);']);
  });
});
