import { eq } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { getDb, withDbRetry, type DB } from './db';
import { sessions, users, type User } from './db/schema';
import { newId, randomToken } from './ids';

export const SESSION_COOKIE = 'vm_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày
const PBKDF2_ITERATIONS = 100_000;

// ── Mật khẩu ────────────────────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Định dạng lưu trong D1: `pbkdf2$<iterations>$<saltB64>$<hashB64>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = fromBase64(parts[2]!);
  const expected = fromBase64(parts[3]!);
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ── Ký cookie ───────────────────────────────────────────────────────────────

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toBase64(new Uint8Array(sig)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function sign(secret: string, value: string): Promise<string> {
  return `${value}.${await hmac(secret, value)}`;
}

async function unsign(secret: string, signed: string): Promise<string | null> {
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const provided = signed.slice(idx + 1);
  const expected = await hmac(secret, value);
  const enc = new TextEncoder();
  if (!timingSafeEqual(enc.encode(provided), enc.encode(expected))) return null;
  return value;
}

// ── Session ─────────────────────────────────────────────────────────────────

export async function createSession(
  db: DB,
  userId: string,
  secret: string,
): Promise<{ cookieValue: string; expiresAt: Date }> {
  const id = randomToken(32);
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db.insert(sessions).values({ id, userId, expiresAt: expiresAtSeconds });
  return {
    cookieValue: await sign(secret, id),
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}

export async function resolveSession(
  db: DB,
  cookieValue: string | undefined,
  secret: string,
): Promise<User | null> {
  if (!cookieValue) return null;
  const sessionId = await unsign(secret, cookieValue);
  if (!sessionId) return null;

  const rows = await withDbRetry('resolveSession', () =>
    db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, sessionId))
      .limit(1),
  );

  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt * 1000 < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  return row.user;
}

export async function destroySession(
  db: DB,
  cookieValue: string | undefined,
  secret: string,
): Promise<void> {
  if (!cookieValue) return;
  const sessionId = await unsign(secret, cookieValue);
  if (!sessionId) return;
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function setSessionCookie(cookies: AstroCookies, value: string, expiresAt: Date, isSecure: boolean): void {
  cookies.set(SESSION_COOKIE, value, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: AstroCookies, isSecure: boolean): void {
  cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, secure: isSecure, sameSite: 'lax' });
}

// ── Tạo tài khoản / đăng nhập ───────────────────────────────────────────────

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
}

export async function registerUser(
  d1: D1Database,
  input: { email: string; password: string; name: string; adminEmail?: string },
): Promise<AuthResult> {
  const db = getDb(d1);
  const email = input.email.trim().toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: 'Email này đã có tài khoản. Bạn thử đăng nhập nhé.' };
  }

  const role = input.adminEmail && email === input.adminEmail.trim().toLowerCase() ? 'admin' : 'user';
  const user: User = {
    id: newId(),
    email,
    passwordHash: await hashPassword(input.password),
    name: input.name.trim(),
    role,
    createdAt: Math.floor(Date.now() / 1000),
    googleId: null,
  };
  await db.insert(users).values(user);
  return { ok: true, user };
}

export async function loginUser(
  d1: D1Database,
  input: { email: string; password: string },
): Promise<AuthResult> {
  const db = getDb(d1);
  const email = input.email.trim().toLowerCase();
  const rows = await withDbRetry('loginUser', () =>
    db.select().from(users).where(eq(users.email, email)).limit(1),
  );
  const user = rows[0];
  // Vẫn chạy một lần hash giả để thời gian phản hồi không tiết lộ email có tồn tại
  const stored = user?.passwordHash ?? 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const valid = await verifyPassword(input.password, stored);
  if (!user || !valid) {
    return { ok: false, error: 'Email hoặc mật khẩu không đúng.' };
  }
  return { ok: true, user };
}

// ── Kiểm tra dữ liệu nhập ───────────────────────────────────────────────────

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Vui lòng nhập email.';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return 'Email chưa đúng định dạng.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (password.length > 200) return 'Mật khẩu quá dài.';
  return null;
}
