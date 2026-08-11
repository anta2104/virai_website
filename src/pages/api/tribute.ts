import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db';
import { memorials } from '../../lib/db/schema';
import { getMemorialBySlug } from '../../lib/memorials';
import { jsonResponse } from '../../lib/guards';
import { todayInVietnam } from '../../lib/format';
import { parseTributeType, tributeCookieName } from '../../lib/tributes';
import { env } from '../../lib/env';

/**
 * Thắp nến / thả hoa. Mỗi khách được một lần mỗi loại mỗi ngày, chặn bằng cookie —
 * đủ để con số có ý nghĩa mà không cần bắt người ghé thăm đăng nhập.
 */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  let payload: { slug?: string; type?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: 'Dữ liệu không đọc được.' }, 400);
  }

  const type = parseTributeType(payload.type);
  if (!type || !payload.slug) {
    return jsonResponse({ error: 'Yêu cầu không hợp lệ.' }, 400);
  }

  const memorial = await getMemorialBySlug(env.DB, payload.slug);
  if (!memorial || !memorial.isPublished) {
    return jsonResponse({ error: 'Không tìm thấy trang.' }, 404);
  }

  const cookieName = tributeCookieName(type, memorial.id);
  const today = todayInVietnam();
  if (cookies.get(cookieName)?.value === today) {
    return jsonResponse({
      alreadyDone: true,
      candles: memorial.candleCount,
      flowers: memorial.flowerCount,
    });
  }

  const db = getDb(env.DB);
  await db
    .update(memorials)
    .set(
      type === 'candle'
        ? { candleCount: sql`${memorials.candleCount} + 1` }
        : { flowerCount: sql`${memorials.flowerCount} + 1` },
    )
    .where(eq(memorials.id, memorial.id));

  cookies.set(cookieName, today, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 2,
  });

  return jsonResponse({
    candles: memorial.candleCount + (type === 'candle' ? 1 : 0),
    flowers: memorial.flowerCount + (type === 'flower' ? 1 : 0),
  });
};
