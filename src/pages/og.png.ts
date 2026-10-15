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
      title: 'Phân tích TikTok bằng AI.\nNgười mẫu ảo chụp sản phẩm.',
      subtitle: 'Phân tích kênh TikTok bằng AI và thuê người mẫu ảo chụp ảnh sản phẩm.',
    }),
    fonts,
  );

  if (!png) {
    return new Response('Không sinh được ảnh', { status: 500 });
  }

  return ogResponse(png, 86400, 604800);
};
