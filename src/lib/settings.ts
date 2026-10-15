/**
 * Cài đặt vận hành lưu trong D1, admin sửa ở /admin/cai-dat.
 *
 * Ưu tiên giá trị trong D1; chưa đặt thì rơi về biến môi trường / secret của
 * Worker (để ai thích cấu hình bằng wrangler vẫn được). Cache 30 giây trong
 * isolate để không truy vấn mỗi request.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings } from './db/schema';
import { env } from './env';

export const SETTING_KEYS = {
  tiktokProvider: 'tiktok_provider',
  apifyToken: 'apify_token',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

const CACHE_MS = 30_000;
let cache: { at: number; values: Map<string, string> } | null = null;

async function load(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;
  const rows = await getDb(env.DB).select().from(settings);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const values = await load();
  const value = values.get(key)?.trim();
  return value ? value : null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = getDb(env.DB);
  const trimmed = value.trim();
  if (!trimmed) {
    await db.delete(settings).where(eq(settings.key, key));
  } else {
    await db
      .insert(settings)
      .values({ key, value: trimmed, updatedAt: Math.floor(Date.now() / 1000) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: trimmed, updatedAt: Math.floor(Date.now() / 1000) },
      });
  }
  cache = null;
}

/** Cấu hình nguồn dữ liệu TikTok sau khi gộp D1 và biến môi trường. */
export async function tiktokDataConfig(): Promise<{ provider: 'mock' | 'apify'; apifyToken: string | null }> {
  const [providerSetting, tokenSetting] = await Promise.all([
    getSetting(SETTING_KEYS.tiktokProvider),
    getSetting(SETTING_KEYS.apifyToken),
  ]);
  const apifyToken = tokenSetting ?? env.APIFY_TOKEN?.trim() ?? null;
  const wanted = (providerSetting ?? env.TIKTOK_PROVIDER ?? 'mock').trim().toLowerCase();
  // Có token là tự hiểu muốn dữ liệu thật, trừ khi admin cố ý chọn mock
  const provider = wanted === 'apify' || (wanted !== 'mock' && apifyToken) ? 'apify' : 'mock';
  return { provider: provider === 'apify' && apifyToken ? 'apify' : 'mock', apifyToken };
}

/** Che token khi hiển thị: 4 ký tự đầu và 4 ký tự cuối. */
export function maskSecret(value: string | null): string {
  if (!value) return '';
  if (value.length <= 10) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
