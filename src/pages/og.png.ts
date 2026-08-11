import type { APIRoute } from 'astro';
import { ogFonts, ogResponse, renderOg, siteOgHtml } from '../lib/og';
import { site } from '../lib/site';
import { env } from '../lib/env';

/** Ảnh chia sẻ mặc định cho các trang không phải trang kỷ niệm. */
export const GET: APIRoute = async ({ request }) => {
  const fonts = await ogFonts(env, request.url);

  const png = await renderOg(
    siteOgHtml({
      brand: site.name,
      title: 'Bé đã đi rồi.\nKỷ niệm thì vẫn ở lại.',
      subtitle: 'Trang tưởng niệm thú cưng: ảnh, câu chuyện, sổ lưu bút và mã QR để chia sẻ.',
    }),
    fonts,
  );

  if (!png) {
    return new Response('Không sinh được ảnh', { status: 500 });
  }

  return ogResponse(png, 86400, 604800);
};
