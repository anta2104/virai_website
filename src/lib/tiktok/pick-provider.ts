/**
 * Chọn nguồn dữ liệu TikTok. Tách khỏi provider.ts để file đó không kéo theo
 * `cloudflare:workers` (qua settings → env) và vẫn test được bằng Node.
 */
import { tiktokDataConfig } from '../settings';
import { ApifyProvider, MockProvider, type TikTokProvider } from './provider';

/**
 * Chọn nguồn dữ liệu theo cài đặt admin (D1) rồi tới biến môi trường.
 * Thiếu token thì về mock và UI phải nói rõ đó là dữ liệu giả.
 */
export async function pickProvider(): Promise<TikTokProvider> {
  const config = await tiktokDataConfig();
  if (config.provider === 'apify' && config.apifyToken) return new ApifyProvider(config.apifyToken);
  return new MockProvider();
}
