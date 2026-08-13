import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, withDbRetry } from './db';
import { memorials, photos, type Memorial, type Photo } from './db/schema';
import { coverUrlOf } from './memorials';

/** Số bé hiện trên mỗi trang vườn. */
export const GARDEN_PAGE_SIZE = 24;

export interface GardenEntry {
  memorial: Memorial;
  coverUrl: string | null;
}

/**
 * Điều kiện để một bé xuất hiện ở Vườn tưởng niệm.
 *
 * Cả ba điều kiện đều bắt buộc và không được nới:
 *  - `isPublished`: trang nháp không phải trang công khai.
 *  - `showInGarden`: chủ nuôi phải tự bật. Trang chủ đã hứa trang của họ không
 *    nằm trong danh sách công khai nào — mặc định phải là không hiện.
 *  - `mode = 'memorial'`: vườn là nơi tưởng niệm, không phải nơi trưng bé đang
 *    sống.
 *
 * Dùng chung cho cả trang vườn lẫn sitemap để hai chỗ không bao giờ lệch nhau.
 */
function gardenFilter() {
  return and(
    eq(memorials.isPublished, 1),
    eq(memorials.showInGarden, 1),
    eq(memorials.mode, 'memorial'),
  );
}

export async function countGardenMemorials(d1: D1Database): Promise<number> {
  const rows = await withDbRetry('countGardenMemorials', () =>
    getDb(d1).select({ total: sql<number>`count(*)` }).from(memorials).where(gardenFilter()),
  );
  return Number(rows[0]?.total ?? 0);
}

/** Một trang của vườn, mới xuất bản nhất lên trước. */
export async function listGardenPage(d1: D1Database, page = 1): Promise<GardenEntry[]> {
  const db = getDb(d1);
  const offset = Math.max(0, page - 1) * GARDEN_PAGE_SIZE;

  const rows = await withDbRetry('listGardenPage', () =>
    db
      .select()
      .from(memorials)
      .where(gardenFilter())
      .orderBy(desc(memorials.updatedAt))
      .limit(GARDEN_PAGE_SIZE)
      .offset(offset),
  );
  if (rows.length === 0) return [];

  // Lấy ảnh của cả trang trong một truy vấn thay vì mỗi bé một lần
  const photoRows = await withDbRetry('listGardenPhotos', () =>
    db
      .select()
      .from(photos)
      .where(inArray(photos.memorialId, rows.map((memorial) => memorial.id))),
  );

  const byMemorial = new Map<string, Photo[]>();
  for (const photo of photoRows) {
    const list = byMemorial.get(photo.memorialId);
    if (list) list.push(photo);
    else byMemorial.set(photo.memorialId, [photo]);
  }

  return rows.map((memorial) => ({
    memorial,
    coverUrl: coverUrlOf(memorial, byMemorial.get(memorial.id) ?? []),
  }));
}

/** Slug của mọi bé đang ở trong vườn — dùng cho sitemap. */
export async function listGardenSlugs(d1: D1Database): Promise<string[]> {
  const rows = await withDbRetry('listGardenSlugs', () =>
    getDb(d1)
      .select({ slug: memorials.slug })
      .from(memorials)
      .where(gardenFilter())
      .orderBy(desc(memorials.updatedAt)),
  );
  return rows.map((row) => row.slug);
}
