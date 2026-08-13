import type { APIRoute } from 'astro';
import {
  STATE_COOKIE,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  googleAuthConfigured,
  nextFromState,
} from '../../../../lib/google-auth';
import { createSession, setSessionCookie } from '../../../../lib/auth';
import { getDb, describeDbError } from '../../../../lib/db';
import { timingSafeEqual } from '../../../../lib/guards';
import { env } from '../../../../lib/env';

/** Google gọi ngược về đây sau khi người dùng đồng ý. */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const isSecure = url.protocol === 'https:';
  const savedState = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: '/' });

  if (!googleAuthConfigured(env)) {
    return redirect('/dang-nhap?google=chua-cau-hinh');
  }

  // Người dùng bấm huỷ ở màn hình Google
  if (url.searchParams.get('error')) {
    return redirect('/dang-nhap');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // State phải khớp cookie: chặn người khác dụ nạn nhân mở link callback dựng sẵn
  if (!code || !state || !savedState || !timingSafeEqual(state, savedState)) {
    console.warn('[google] State không khớp hoặc thiếu code');
    return redirect('/dang-nhap?google=loi');
  }

  try {
    const profile = await fetchGoogleProfile(env, code, url.origin);
    if (!profile) return redirect('/dang-nhap?google=loi');

    // Email chưa xác thực thì không được dùng để nhận diện tài khoản có sẵn —
    // nếu không, ai đó tạo tài khoản Google với email của người khác là chiếm
    // được tài khoản đó.
    if (!profile.emailVerified) {
      console.warn('[google] Email chưa xác thực:', profile.email);
      return redirect('/dang-nhap?google=email-chua-xac-thuc');
    }

    const user = await findOrCreateGoogleUser(env.DB, profile, env.ADMIN_EMAIL);
    const session = await createSession(getDb(env.DB), user.id, env.SESSION_SECRET);
    setSessionCookie(cookies, session.cookieValue, session.expiresAt, isSecure);

    return redirect(nextFromState(state));
  } catch (error) {
    console.error('[google] Lỗi khi đăng nhập:', describeDbError(error));
    return redirect('/dang-nhap?google=loi');
  }
};
