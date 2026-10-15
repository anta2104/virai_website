import type { APIRoute } from 'astro';
import { jsonResponse, timingSafeEqual } from '../../../lib/guards';
import { SETTING_KEYS, setSetting, type SettingKey } from '../../../lib/settings';
import { env } from '../../../lib/env';

/**
 * Đặt một cài đặt vận hành từ bên ngoài, xác thực bằng CRON_SECRET (bí mật nội
 * bộ của Worker, cùng loại với cron). Dùng khi chủ dự án không thao tác được
 * trên /admin/cai-dat. Chỉ ghi, không bao giờ trả giá trị ra ngoài.
 *
 * Gọi: POST /api/internal/settings, header `x-internal-secret`, body {key, value}.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = env.CRON_SECRET;
  if (!secret) return jsonResponse({ ok: false, error: 'Chưa cấu hình CRON_SECRET' }, 500);

  const provided = request.headers.get('x-internal-secret') ?? '';
  if (!provided || !timingSafeEqual(provided, secret)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  let payload: { key?: unknown; value?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ ok: false, error: 'Body không phải JSON' }, 400);
  }

  const key = String(payload.key ?? '');
  const allowed = Object.values(SETTING_KEYS) as string[];
  if (!allowed.includes(key)) return jsonResponse({ ok: false, error: 'Key không hợp lệ' }, 400);

  await setSetting(key as SettingKey, String(payload.value ?? ''));
  return jsonResponse({ ok: true, key });
};
