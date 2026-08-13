import { eq } from 'drizzle-orm';
import { getDb, withDbRetry } from './db';
import { users, type User } from './db/schema';
import { newId, randomToken } from './ids';

/**
 * Đăng nhập bằng Google, viết tay theo OAuth 2.0 authorization code.
 *
 * Không dùng thư viện: cả luồng chỉ có hai lần gọi HTTP, mà thư viện auth nào
 * cũng kéo theo phụ thuộc Node không chạy được trên Workers.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export const STATE_COOKIE = 'vm_oauth_state';

/**
 * Giá trị đánh dấu cho tài khoản chỉ đăng nhập bằng Google.
 *
 * `password_hash` là NOT NULL và cố ý giữ nguyên như vậy (xem ghi chú trong
 * schema). `verifyPassword` chỉ chấp nhận chuỗi đúng định dạng `pbkdf2$...`
 * nên giá trị này không bao giờ khớp với mật khẩu nào.
 */
export const GOOGLE_ONLY_PASSWORD = 'google-only';

export function isGoogleOnly(user: Pick<User, 'passwordHash'>): boolean {
  return user.passwordHash === GOOGLE_ONLY_PASSWORD;
}

/**
 * Email này có phải tài khoản chỉ đăng nhập bằng Google không.
 *
 * Chỉ gọi **sau khi** đăng nhập bằng mật khẩu đã thất bại: ai gõ đúng email của
 * người khác cũng chỉ biết thêm rằng tài khoản đó dùng Google — mà chính màn
 * hình Google cũng cho biết điều đó.
 */
export async function isGoogleOnlyEmail(d1: D1Database, rawEmail: string): Promise<boolean> {
  const rows = await withDbRetry('isGoogleOnlyEmail', () =>
    getDb(d1)
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, rawEmail.trim().toLowerCase()))
      .limit(1),
  );
  return Boolean(rows[0] && isGoogleOnly(rows[0]));
}

/** Cấu hình đã có đủ chưa — thiếu thì giấu luôn nút "Tiếp tục với Google". */
export function googleAuthConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return new URL('/api/auth/google/callback', origin).href;
}

/**
 * URL đưa người dùng sang Google.
 *
 * `state` chống CSRF: giá trị ngẫu nhiên, lưu vào cookie và đối chiếu lại lúc
 * quay về. `next` đi kèm trong state (sau dấu hai chấm) để sau khi đăng nhập
 * còn quay lại đúng chỗ người ta đang đứng.
 */
export function buildAuthUrl(env: Env, origin: string, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // Nhắc Google hỏi lại tài khoản nào, thay vì lẳng lặng dùng tài khoản đang mở
  url.searchParams.set('prompt', 'select_account');
  return url.href;
}

export function newState(next: string): string {
  return `${randomToken(16)}:${next}`;
}

/** Tách phần `next` khỏi state, chỉ nhận đường dẫn nội bộ. */
export function nextFromState(state: string): string {
  const idx = state.indexOf(':');
  const next = idx >= 0 ? state.slice(idx + 1) : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/tai-khoan';
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Đổi authorization code lấy thông tin người dùng. */
export async function fetchGoogleProfile(
  env: Env,
  code: string,
  origin: string,
): Promise<GoogleProfile | null> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    console.error('[google] Đổi code lấy token thất bại:', await tokenResponse.text());
    return null;
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const userResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) {
    console.error('[google] Lấy userinfo thất bại:', await userResponse.text());
    return null;
  }

  const profile = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };

  if (!profile.sub || !profile.email) return null;

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: profile.name?.trim() || profile.email.split('@')[0]!,
    emailVerified: profile.email_verified !== false,
  };
}

/**
 * Tìm hoặc tạo tài khoản cho một hồ sơ Google.
 *
 * Thứ tự tra cứu quan trọng: `google_id` trước, rồi mới tới email. Ai đổi địa
 * chỉ Gmail vẫn vào đúng tài khoản cũ.
 *
 * Email trùng tài khoản có sẵn thì gắn `google_id` vào tài khoản đó thay vì tạo
 * bản trùng — người ta đã trả tiền cho những trang trong tài khoản ấy.
 */
export async function findOrCreateGoogleUser(
  d1: D1Database,
  profile: GoogleProfile,
  adminEmail?: string,
): Promise<User> {
  const db = getDb(d1);

  const byGoogleId = await withDbRetry('googleUserById', () =>
    db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1),
  );
  if (byGoogleId[0]) return byGoogleId[0];

  const byEmail = await withDbRetry('googleUserByEmail', () =>
    db.select().from(users).where(eq(users.email, profile.email)).limit(1),
  );
  if (byEmail[0]) {
    await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, byEmail[0].id));
    return { ...byEmail[0], googleId: profile.sub };
  }

  const user: User = {
    id: newId(),
    email: profile.email,
    passwordHash: GOOGLE_ONLY_PASSWORD,
    name: profile.name,
    role:
      adminEmail && profile.email === adminEmail.trim().toLowerCase() ? 'admin' : 'user',
    createdAt: Math.floor(Date.now() / 1000),
    googleId: profile.sub,
  };
  await db.insert(users).values(user);
  return user;
}
