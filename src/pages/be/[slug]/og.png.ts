import type { APIRoute } from 'astro';
import { getMemorialBySlug, listPhotos } from '../../../lib/memorials';
import { lifeSummary } from '../../../lib/memorial-dates';
import { memorialOgHtml, ogFonts, ogResponse, photoDataUri, renderOg } from '../../../lib/og';
import { site } from '../../../lib/site';
import { env } from '../../../lib/env';

/**
 * Ảnh xem trước khi chia sẻ trang kỷ niệm lên Facebook/Zalo.
 * Cache 1 ngày ở trình duyệt, 30 ngày ở CDN — trang đổi ảnh bìa thì URL đổi
 * theo `?v=updatedAt` nên không bị dính cache cũ.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const memorial = await getMemorialBySlug(env.DB, params.slug!);

  if (!memorial || !memorial.isPublished) {
    return new Response('Not found', { status: 404 });
  }

  const photos = await listPhotos(env.DB, memorial.id);
  const cover =
    photos.find((photo) => photo.id === memorial.coverPhotoId) ??
    photos.find((photo) => photo.contentType.startsWith('image/')) ??
    null;

  const [fonts, photo] = await Promise.all([
    ogFonts(env, request.url),
    photoDataUri(env, cover?.r2Key ?? null),
  ]);

  const summary = lifeSummary(memorial.birthDate, memorial.deathDate);
  const base = {
    petName: memorial.petName,
    dateLine: summary.dateLine || 'Mãi được thương nhớ',
    lunarLine: memorial.deathDateLunar,
    brand: site.name,
    theme: memorial.theme,
  };

  let png = await renderOg(memorialOgHtml({ ...base, photo }), fonts);

  // Ảnh bìa hỏng hoặc định dạng resvg không đọc được: vẽ lại bản không có ảnh
  if (!png && photo) {
    console.warn(`OG image của ${memorial.slug}: bỏ ảnh bìa và thử lại`);
    png = await renderOg(memorialOgHtml({ ...base, photo: null }), fonts);
  }

  if (!png) {
    // Vẫn lỗi thì trả ảnh mặc định của site để link chia sẻ không bị trống
    return Response.redirect(new URL('/og.png', request.url).toString(), 302);
  }

  return ogResponse(png);
};
