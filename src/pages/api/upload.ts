import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db';
import { memorials, photos } from '../../lib/db/schema';
import { countPhotos, getOwnedMemorial, photoUrl } from '../../lib/memorials';
import { limitsFor } from '../../lib/plans';
import { jsonResponse } from '../../lib/guards';
import { newId } from '../../lib/ids';
import { env } from '../../lib/env';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ error: 'Bạn cần đăng nhập.' }, 401);

  const form = await request.formData();
  const memorialId = String(form.get('memorialId') ?? '');
  const file = form.get('file');

  if (!(file instanceof File)) {
    return jsonResponse({ error: 'Không nhận được tệp.' }, 400);
  }

  const memorial = await getOwnedMemorial(env.DB, memorialId, user.id);
  if (!memorial) {
    return jsonResponse({ error: 'Không tìm thấy trang kỷ niệm.' }, 404);
  }

  const limits = limitsFor(memorial.isPremium);
  const isVideo = file.type in VIDEO_TYPES;
  const extension = IMAGE_TYPES[file.type] ?? VIDEO_TYPES[file.type];

  if (!extension) {
    return jsonResponse({ error: 'Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4.' }, 400);
  }
  if (isVideo && !limits.videoUpload) {
    return jsonResponse({ error: 'Tải video là tính năng của gói Premium.' }, 403);
  }
  if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    return jsonResponse(
      { error: isVideo ? 'Video tối đa 40MB.' : 'Ảnh tối đa 6MB — bạn thử ảnh nhỏ hơn nhé.' },
      400,
    );
  }

  const used = await countPhotos(env.DB, memorial.id);
  if (used >= limits.photos) {
    return jsonResponse(
      {
        error: memorial.isPremium
          ? `Mỗi trang tối đa ${limits.photos} tệp.`
          : `Gói miễn phí được ${limits.photos} ảnh. Nâng cấp Premium để thêm nhiều hơn.`,
        limitReached: true,
      },
      403,
    );
  }

  const db = getDb(env.DB);
  const photoId = newId();
  const r2Key = `memorials/${memorial.id}/${photoId}.${extension}`;

  await env.BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const orderRows = await db
    .select({ maxOrder: sql<number>`coalesce(max(${photos.sortOrder}), -1)` })
    .from(photos)
    .where(eq(photos.memorialId, memorial.id));
  const sortOrder = Number(orderRows[0]?.maxOrder ?? -1) + 1;

  const width = Number(form.get('width')) || null;
  const height = Number(form.get('height')) || null;

  await db.insert(photos).values({
    id: photoId,
    memorialId: memorial.id,
    r2Key,
    contentType: file.type,
    width,
    height,
    sortOrder,
  });

  // Ảnh đầu tiên mặc định làm ảnh bìa
  if (!memorial.coverPhotoId && !isVideo) {
    await db
      .update(memorials)
      .set({ coverPhotoId: photoId, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(memorials.id, memorial.id));
  }

  return jsonResponse({
    id: photoId,
    url: photoUrl(r2Key),
    contentType: file.type,
    used: used + 1,
    limit: limits.photos === Number.POSITIVE_INFINITY ? null : limits.photos,
  });
};
