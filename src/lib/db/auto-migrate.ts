/**
 * Tự chạy migration D1 còn thiếu khi Worker nhận request đầu tiên.
 *
 * Vì sao cần: production được build và deploy tự động mỗi khi `main` đổi, nhưng
 * bước đó không chạy `wrangler d1 migrations apply`. Đã có lần code mới lên mà
 * bảng chưa có, mọi trang chạm vào bảng mới đều 500 (15/10/2026). Worker tự
 * kiểm tra và áp migration thì đẩy code là đủ, không cần ai nhớ chạy lệnh tay.
 *
 * Cách làm khớp với wrangler để hai bên dùng chung sổ: cùng bảng `d1_migrations`,
 * cùng tên file làm khoá. Chạy `npm run db:migrate` bằng tay sau đó vẫn được và
 * sẽ báo "No migrations to apply".
 *
 * Nhiều isolate có thể cùng khởi động một lúc. Mỗi migration chạy trong một
 * `batch` (D1 chạy batch như một giao dịch), và tên migration là UNIQUE, nên
 * isolate đến sau sẽ hỏng ở câu INSERT và cả batch bị huỷ — không có chuyện áp
 * một nửa. Lỗi kiểu đó được coi là "người khác đã làm rồi".
 */

// Vite nạp nội dung file .sql ở thư mục gốc; đường dẫn bắt đầu bằng "/" là tính
// từ gốc dự án.
const files = import.meta.glob('/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface Migration {
  /** Tên wrangler ghi vào d1_migrations, ví dụ "0006_tiktok_studio.sql" */
  name: string;
  statements: string[];
}

/** Danh sách migration theo thứ tự tên file (tiền tố số nên sort chuỗi là đủ). */
export function bundledMigrations(): Migration[] {
  return Object.entries(files)
    .map(([path, sql]) => ({
      name: path.split('/').pop()!,
      statements: splitStatements(sql),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tách theo dấu drizzle-kit chèn giữa các câu lệnh, bỏ chú thích và câu rỗng. */
export function splitStatements(sql: string): string[] {
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

const CREATE_LEDGER = `CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/** Lỗi cho thấy isolate khác đã áp migration này rồi. */
function alreadyApplied(error: unknown): boolean {
  const text = describe(error);
  return /UNIQUE constraint failed: d1_migrations\.name|already exists/i.test(text);
}

function describe(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(' <- ');
}

async function appliedNames(d1: D1Database): Promise<Set<string>> {
  const rows = await d1.prepare('SELECT name FROM d1_migrations').all<{ name: string }>();
  return new Set((rows.results ?? []).map((row) => row.name));
}

/** Áp mọi migration còn thiếu. Trả về tên các migration vừa áp. */
export async function applyPendingMigrations(d1: D1Database): Promise<string[]> {
  await d1.prepare(CREATE_LEDGER).run();
  const applied = await appliedNames(d1);
  const done: string[] = [];

  for (const migration of bundledMigrations()) {
    if (applied.has(migration.name)) continue;

    const statements = [
      ...migration.statements.map((statement) => d1.prepare(statement)),
      d1.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(migration.name),
    ];

    try {
      await d1.batch(statements);
      done.push(migration.name);
      console.log(`[auto-migrate] Đã áp ${migration.name} (${migration.statements.length} câu lệnh)`);
    } catch (error) {
      if (alreadyApplied(error)) {
        console.log(`[auto-migrate] ${migration.name} đã được isolate khác áp, bỏ qua`);
        continue;
      }
      throw new Error(`Migration ${migration.name} thất bại: ${describe(error)}`, { cause: error });
    }
  }
  return done;
}

let pending: Promise<void> | null = null;

/**
 * Gọi ở đầu mỗi request; chỉ thật sự chạy một lần cho mỗi isolate. Lỗi thì ghi
 * log và cho lần request sau thử lại, không ném ra để trang không chạm bảng
 * mới vẫn phục vụ được.
 */
export function ensureMigrations(d1: D1Database): Promise<void> {
  if (!pending) {
    pending = applyPendingMigrations(d1)
      .then(() => undefined)
      .catch((error) => {
        console.error('[auto-migrate]', describe(error));
        pending = null;
      });
  }
  return pending;
}
