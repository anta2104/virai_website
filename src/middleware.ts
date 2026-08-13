import { defineMiddleware } from 'astro:middleware';
import { describeDbError, getDb } from './lib/db';
import { SESSION_COOKIE, resolveSession } from './lib/auth';
import { env } from './lib/env';

/** Route cần đăng nhập. */
const PROTECTED = /^\/tai-khoan(\/|$)/;
/** Route chỉ dành cho admin. */
const ADMIN_ONLY = /^\/admin(\/|$)/;

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  if (env.DB && env.SESSION_SECRET) {
    const cookie = context.cookies.get(SESSION_COOKIE)?.value;
    if (cookie) {
      try {
        context.locals.user = await resolveSession(getDb(env.DB), cookie, env.SESSION_SECRET);
      } catch (error) {
        // Đọc cả `cause` để thấy thông báo thật của D1, không chỉ câu truy vấn
        console.error('[middleware] Không đọc được session:', describeDbError(error));
      }
    }
  }

  const { pathname } = context.url;

  if (!context.locals.user && (PROTECTED.test(pathname) || ADMIN_ONLY.test(pathname))) {
    const next = encodeURIComponent(pathname + context.url.search);
    return context.redirect(`/dang-nhap?next=${next}`);
  }

  if (ADMIN_ONLY.test(pathname) && context.locals.user?.role !== 'admin') {
    return new Response('Không tìm thấy trang', { status: 404 });
  }

  // Ghi lại nguyên nhân thật của mọi lỗi chưa xử lý rồi ném lại để Astro hiện
  // trang 500. Không đọc `cause` thì lúc D1 hỏng log chỉ có câu truy vấn.
  try {
    return await next();
  } catch (error) {
    console.error(`[middleware] Lỗi chưa xử lý tại ${pathname}:`, describeDbError(error));
    throw error;
  }
});
