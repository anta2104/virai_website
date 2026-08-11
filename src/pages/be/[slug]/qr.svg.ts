import type { APIRoute } from 'astro';
import { getMemorialBySlug } from '../../../lib/memorials';
import { qrCardSvg, qrSvg } from '../../../lib/qr';
import { lifeSummary } from '../../../lib/memorial-dates';
import { limitsFor } from '../../../lib/plans';
import { memorialUrl, site } from '../../../lib/site';
import { env } from '../../../lib/env';

/**
 * Mã QR của trang kỷ niệm.
 * - `?card=1` trả về thẻ in sẵn (tên bé + ngày tháng + QR) — dành cho gói Premium
 *   hoặc chủ trang đang xem.
 * - `?download=1` buộc trình duyệt tải về thay vì mở trong tab.
 */
export const GET: APIRoute = async ({ params, locals, url, site: astroSite }) => {
  const memorial = await getMemorialBySlug(env.DB, params.slug!);
  if (!memorial) {
    return new Response('Not found', { status: 404 });
  }

  const isOwner = locals.user?.id === memorial.userId;
  if (!memorial.isPublished && !isOwner) {
    return new Response('Not found', { status: 404 });
  }

  const base = (astroSite ?? new URL(site.url)).origin;
  const target = memorialUrl(memorial.slug, base);
  const wantsCard = url.searchParams.get('card') === '1';

  if (wantsCard && !limitsFor(memorial.isPremium).qrDownload && !isOwner) {
    return new Response('Thẻ QR in sẵn là tính năng của gói Premium', { status: 403 });
  }

  const summary = lifeSummary(memorial.birthDate, memorial.deathDate);
  const svg = wantsCard
    ? qrCardSvg({
        url: target,
        petName: memorial.petName,
        dateLine: summary.dateLine,
        footer: site.name,
      })
    : qrSvg(target);

  const headers = new Headers({
    'content-type': 'image/svg+xml; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  });

  if (url.searchParams.get('download') === '1') {
    const filename = `${memorial.slug}${wantsCard ? '-the-qr' : '-qr'}.svg`;
    headers.set('content-disposition', `attachment; filename="${filename}"`);
  }

  return new Response(svg, { headers });
};
