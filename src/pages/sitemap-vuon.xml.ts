import type { APIRoute } from 'astro';
import { listGardenSlugs } from '../lib/garden';
import { describeDbError } from '../lib/db';
import { memorialUrl, site } from '../lib/site';
import { env } from '../lib/env';

/**
 * Sitemap cho các trang kỷ niệm **chủ nuôi tự bật** hiện ở Vườn tưởng niệm.
 *
 * Tách riêng khỏi `sitemap-index.xml` (do @astrojs/sitemap sinh lúc build, chỉ
 * chứa trang tĩnh) vì danh sách này thay đổi lúc chạy. robots.txt trỏ tới cả
 * hai file.
 *
 * Tuyệt đối không liệt kê mọi trang `/be/*`: trang chủ và Chính sách bảo mật
 * hứa với người dùng rằng trang của họ không nằm trong danh sách công khai nào
 * trừ khi chính họ bật.
 */
export const GET: APIRoute = async () => {
  let slugs: string[] = [];
  try {
    slugs = await listGardenSlugs(env.DB);
  } catch (error) {
    // D1 chớp lỗi thì trả sitemap rỗng còn hơn trả 500 cho công cụ tìm kiếm
    console.error('[sitemap-vuon] Không đọc được danh sách:', describeDbError(error));
  }

  const urls = [
    new URL('/vuon-tuong-niem', site.url).href,
    ...slugs.map((slug) => memorialUrl(slug)),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
