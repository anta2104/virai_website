import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/guards';
import { waitUntil } from '../../../lib/env';
import { balanceOf, charge, ensureWelcomeCredits } from '../../../lib/credits';
import { ANALYSIS_FREE_PER_MONTH, STUDIO_COSTS } from '../../../lib/plans';
import { normalizeHandle } from '../../../lib/tiktok/handle';
import { pickProvider } from '../../../lib/tiktok/pick-provider';
import {
  countBillableAnalysesThisMonth,
  createAnalysis,
  findReusable,
  runAnalysis,
} from '../../../lib/tiktok/service';

/**
 * Nhận link hoặc @handle, tạo phân tích và chạy nền; trả về id để trang kết quả poll.
 *
 * Tính phí: dữ liệu demo miễn phí. Dữ liệu thật được ANALYSIS_FREE_PER_MONTH lượt
 * miễn phí mỗi tháng, sau đó mỗi lượt trừ STUDIO_COSTS.tiktokAnalysis tín chỉ.
 * Bản tái dùng trong 12 giờ không tốn lượt, không tốn tín chỉ.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ ok: false, error: 'Bạn cần đăng nhập.' }, 401);

  let input = '';
  /** Bỏ qua bản lưu 12 giờ, kéo dữ liệu mới (tốn lượt như phân tích mới) */
  let force = false;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as { input?: unknown; force?: unknown };
      input = String(payload.input ?? '');
      force = payload.force === true;
    } else {
      const form = await request.formData();
      input = String(form.get('input') ?? '');
      force = form.get('force') === '1';
    }
  } catch {
    return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
  }

  const handle = normalizeHandle(input);
  if (!handle) {
    return jsonResponse(
      { ok: false, error: 'Link hoặc tên kênh không hợp lệ. Ví dụ: https://www.tiktok.com/@tenkenh hoặc @tenkenh' },
      400,
    );
  }

  const provider = await pickProvider();
  let cost = 0;
  if (provider.name !== 'mock' && (force || !(await findReusable(handle, provider.name)))) {
    const used = await countBillableAnalysesThisMonth(user.id);
    if (used >= ANALYSIS_FREE_PER_MONTH) {
      cost = STUDIO_COSTS.tiktokAnalysis;
      await ensureWelcomeCredits(user.id);
      const balance = await balanceOf(user.id);
      if (balance < cost) {
        return jsonResponse(
          {
            ok: false,
            code: 'credits',
            error: `Bạn đã dùng hết ${ANALYSIS_FREE_PER_MONTH} lượt miễn phí tháng này. Mỗi lượt tiếp theo cần ${cost} tín chỉ, bạn đang có ${balance}.`,
          },
          402,
        );
      }
    }
  }

  const { analysis, reused } = await createAnalysis({
    userId: user.id,
    handle,
    providerName: provider.name,
    costCredits: cost,
    force,
  });

  if (!reused && analysis.costCredits > 0) {
    const charged = await charge(user.id, 'analysis', analysis.id, analysis.costCredits);
    if (!charged) {
      // Hai request song song cùng qua kiểm tra số dư: request sau không chạy
      return jsonResponse(
        { ok: false, code: 'credits', error: 'Không đủ tín chỉ cho lượt phân tích này.' },
        402,
      );
    }
  }

  if (!reused) {
    waitUntil(
      locals,
      runAnalysis(analysis.id).catch((error) => console.error('[tiktok] runAnalysis lỗi:', error)),
    );
  }

  return jsonResponse({ ok: true, id: analysis.id, handle, reused, cost: reused ? 0 : analysis.costCredits });
};
