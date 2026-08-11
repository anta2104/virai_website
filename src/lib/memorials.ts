import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type DB } from './db';
import { guestbookEntries, memorials, photos, type Memorial, type Photo } from './db/schema';
import { lunarLabel } from './lunar';

/** Đường dẫn phục vụ ảnh từ R2. */
export function photoUrl(r2Key: string): string {
  return `/media/${r2Key}`;
}

export function coverUrlOf(memorial: Memorial, photoList: Photo[]): string | null {
  const cover =
    photoList.find((p) => p.id === memorial.coverPhotoId) ?? photoList[0] ?? null;
  return cover ? photoUrl(cover.r2Key) : null;
}

export async function getMemorialBySlug(d1: D1Database, slug: string): Promise<Memorial | null> {
  const db = getDb(d1);
  const rows = await db.select().from(memorials).where(eq(memorials.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getMemorialById(d1: D1Database, id: string): Promise<Memorial | null> {
  const db = getDb(d1);
  const rows = await db.select().from(memorials).where(eq(memorials.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Lấy trang kỷ niệm và kiểm tra quyền sở hữu trong một bước. */
export async function getOwnedMemorial(
  d1: D1Database,
  id: string,
  userId: string,
): Promise<Memorial | null> {
  const db = getDb(d1);
  const rows = await db
    .select()
    .from(memorials)
    .where(and(eq(memorials.id, id), eq(memorials.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMemorialsOfUser(d1: D1Database, userId: string): Promise<Memorial[]> {
  const db = getDb(d1);
  return db
    .select()
    .from(memorials)
    .where(eq(memorials.userId, userId))
    .orderBy(desc(memorials.createdAt));
}

export async function listPhotos(d1: D1Database, memorialId: string): Promise<Photo[]> {
  const db = getDb(d1);
  return db
    .select()
    .from(photos)
    .where(eq(photos.memorialId, memorialId))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
}

export async function countPhotos(d1: D1Database, memorialId: string): Promise<number> {
  const db = getDb(d1);
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(photos)
    .where(eq(photos.memorialId, memorialId));
  return Number(rows[0]?.n ?? 0);
}

export async function listApprovedGuestbook(d1: D1Database, memorialId: string, limit: number) {
  const db = getDb(d1);
  return db
    .select()
    .from(guestbookEntries)
    .where(and(eq(guestbookEntries.memorialId, memorialId), eq(guestbookEntries.status, 'approved')))
    .orderBy(desc(guestbookEntries.createdAt))
    .limit(limit);
}

export async function slugExists(db: DB, slug: string): Promise<boolean> {
  const rows = await db.select({ id: memorials.id }).from(memorials).where(eq(memorials.slug, slug)).limit(1);
  return rows.length > 0;
}

/** Tính lại chuỗi ngày âm mỗi khi ngày dương thay đổi. */
export function lunarFieldsFor(birthDate: string | null, deathDate: string | null) {
  return {
    birthDateLunar: lunarLabel(birthDate),
    deathDateLunar: lunarLabel(deathDate),
  };
}

/**
 * Các trang mẫu hiển thị trên landing page. Tạo bằng `npm run seed:demo`
 * rồi liệt kê slug ở đây; trang nào chưa có trong DB sẽ tự động bị bỏ qua.
 */
export const DEMO_SLUGS = ['mit-golden', 'bap-meo-tam-the', 'lucky-corgi'];

export async function listDemoMemorials(d1: D1Database): Promise<Memorial[]> {
  if (DEMO_SLUGS.length === 0) return [];
  const db = getDb(d1);
  const rows = await db
    .select()
    .from(memorials)
    .where(and(inArray(memorials.slug, DEMO_SLUGS), eq(memorials.isPublished, 1)));

  // Giữ đúng thứ tự khai trong DEMO_SLUGS, không phụ thuộc thứ tự D1 trả về
  return rows.sort((a, b) => DEMO_SLUGS.indexOf(a.slug) - DEMO_SLUGS.indexOf(b.slug));
}
