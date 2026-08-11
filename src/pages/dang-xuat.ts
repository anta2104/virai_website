import type { APIRoute } from 'astro';
import { SESSION_COOKIE, clearSessionCookie, destroySession } from '../lib/auth';
import { getDb } from '../lib/db';
import { env } from '../lib/env';

export const POST: APIRoute = async ({ cookies, url, redirect }) => {
  const cookie = cookies.get(SESSION_COOKIE)?.value;
  await destroySession(getDb(env.DB), cookie, env.SESSION_SECRET);
  clearSessionCookie(cookies, url.protocol === 'https:');
  return redirect('/');
};
