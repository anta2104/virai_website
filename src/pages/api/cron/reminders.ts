import type { APIRoute } from 'astro';
import { advanceReminder, dueReminders } from '../../../lib/reminders';
import { reminderEmail, sendEmail } from '../../../lib/email';
import { jsonResponse, timingSafeEqual } from '../../../lib/guards';
import { daysSince, todayInVietnam } from '../../../lib/format';
import { memorialUrl, site } from '../../../lib/site';
import { env } from '../../../lib/env';

/**
 * Gửi email nhắc ngày tưởng niệm.
 *
 * Cron Trigger (`0 1 * * *` = 8h sáng giờ Việt Nam) gọi vào đây qua handler
 * `scheduled` do scripts/postbuild.mjs sinh ra. Admin cũng gọi tay được từ
 * trang /admin để kiểm tra.
 */
export const POST: APIRoute = async ({ request, locals, url }) => {
  const secret = env.CRON_SECRET;
  const providedSecret = request.headers.get('x-cron-secret');
  const isAdmin = locals.user?.role === 'admin';
  const isCron = Boolean(secret && providedSecret && timingSafeEqual(providedSecret, secret));

  if (!isCron && !isAdmin) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const dryRun = url.searchParams.get('dryRun') === '1';
  const today = todayInVietnam();
  const due = await dueReminders(env.DB, today);

  const baseUrl = site.url;
  const results: Array<{ memorial: string; type: string; date: string; sent: boolean; error?: string }> = [];

  for (const item of due) {
    const daysUntil = -(daysSince(item.reminder.nextDate, today) ?? 0);
    const message = reminderEmail({
      ownerName: item.ownerName,
      memorial: item.memorial,
      reminder: item.reminder,
      memorialUrl: memorialUrl(item.memorial.slug, baseUrl),
      settingsUrl: new URL(`/tai-khoan/be/${item.memorial.id}`, baseUrl).href,
      daysUntil,
    });

    if (dryRun) {
      results.push({
        memorial: item.memorial.petName,
        type: item.reminder.type,
        date: item.reminder.nextDate,
        sent: false,
        error: 'dryRun',
      });
      continue;
    }

    const sent = await sendEmail(env, { ...message, to: item.ownerEmail });
    if (sent.ok) {
      await advanceReminder(env.DB, item);
    } else {
      console.error(`[cron] Không gửi được email cho ${item.ownerEmail}:`, sent.error);
    }

    results.push({
      memorial: item.memorial.petName,
      type: item.reminder.type,
      date: item.reminder.nextDate,
      sent: sent.ok,
      error: sent.error,
    });
  }

  const summary = {
    today,
    due: due.length,
    sent: results.filter((result) => result.sent).length,
    dryRun,
    results,
  };
  console.log('[cron] reminders:', JSON.stringify(summary));
  return jsonResponse(summary);
};

/** Cho phép gọi bằng GET từ trang admin để xem trước (không gửi thật). */
export const GET: APIRoute = async (context) => {
  if (context.locals.user?.role !== 'admin') {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const today = todayInVietnam();
  const due = await dueReminders(env.DB, today);
  return jsonResponse({
    today,
    due: due.map((item) => ({
      memorial: item.memorial.petName,
      email: item.ownerEmail,
      type: item.reminder.type,
      label: item.reminder.label,
      date: item.reminder.nextDate,
    })),
  });
};
