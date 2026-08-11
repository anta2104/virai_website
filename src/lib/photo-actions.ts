import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { memorials, photos, type Memorial } from './db/schema';
import { listPhotos } from './memorials';

/**
 * Xử lý các thao tác với ảnh (xoá, chọn ảnh bìa, đổi chú thích, đổi thứ tự).
 * Trả về thông báo lỗi nếu có, `null` nếu thành công.
 */
export async function handlePhotoAction(
  env: Env,
  memorial: Memorial,
  form: FormData,
): Promise<string | null> {
  const db = getDb(env.DB);
  const action = String(form.get('action') ?? '');
  const photoId = String(form.get('photoId') ?? '');
  if (!action) return null;

  const rows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.memorialId, memorial.id)))
    .limit(1);
  const photo = rows[0];
  if (!photo) return 'Không tìm thấy ảnh này.';

  const touch = { updatedAt: Math.floor(Date.now() / 1000) };

  switch (action) {
    case 'delete': {
      await env.BUCKET.delete(photo.r2Key).catch((error: unknown) => {
        // Xoá bản ghi vẫn có ý nghĩa dù object trên R2 lỗi
        console.error('Không xoá được object R2:', error);
      });
      await db.delete(photos).where(eq(photos.id, photo.id));

      if (memorial.coverPhotoId === photo.id) {
        const remaining = await listPhotos(env.DB, memorial.id);
        const nextCover = remaining.find((item) => item.contentType.startsWith('image/'));
        await db
          .update(memorials)
          .set({ coverPhotoId: nextCover?.id ?? null, ...touch })
          .where(eq(memorials.id, memorial.id));
      }
      return null;
    }

    case 'cover': {
      if (!photo.contentType.startsWith('image/')) return 'Ảnh bìa phải là ảnh, không phải video.';
      await db
        .update(memorials)
        .set({ coverPhotoId: photo.id, ...touch })
        .where(eq(memorials.id, memorial.id));
      return null;
    }

    case 'caption': {
      const caption = String(form.get('caption') ?? '').trim().slice(0, 200);
      await db
        .update(photos)
        .set({ caption: caption || null })
        .where(eq(photos.id, photo.id));
      return null;
    }

    case 'move': {
      const direction = String(form.get('dir') ?? '');
      const all = await listPhotos(env.DB, memorial.id);
      const index = all.findIndex((item) => item.id === photo.id);
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      const neighbour = all[swapIndex];
      if (index < 0 || !neighbour) return null;

      // Ghi lại thứ tự cho toàn bộ danh sách để tránh trùng sortOrder
      const reordered = [...all];
      reordered[index] = neighbour;
      reordered[swapIndex] = photo;
      await db.batch(
        reordered.map((item, position) =>
          db.update(photos).set({ sortOrder: position }).where(eq(photos.id, item.id)),
        ) as never,
      );
      return null;
    }

    default:
      return null;
  }
}
