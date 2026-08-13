import type { APIRoute } from 'astro';
import {
  STATE_COOKIE,
  buildAuthUrl,
  googleAuthConfigured,
  newState,
} from '../../../lib/google-auth';
import { env } from '../../../lib/env';

/** Bắt đầu đăng nhập bằng Google. */
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!googleAuthConfigured(env)) {
    console.error('[google] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET chưa được cấu hình');
    return redirect('/dang-nhap?google=chua-cau-hinh');
  }

  const requested = url.searchParams.get('next') ?? '';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/tai-khoan';
  const state = newState(next);

  // State sống 10 phút — đủ để đăng nhập, không đủ để nằm lại lâu trong máy
  cookies.set(STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600,
  });

  return redirect(buildAuthUrl(env, url.origin, state));
};
