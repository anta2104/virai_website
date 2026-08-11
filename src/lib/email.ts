import { site } from './site';
import { formatDate } from './format';
import type { Memorial, Reminder } from './db/schema';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Gửi email qua Resend REST API (không cần SDK, chạy được trên Workers). */
export async function sendEmail(env: Env, message: EmailMessage): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY chưa được cấu hình' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: site.fromEmail,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return { ok: false, error: body.message ?? `Resend trả về ${response.status}` };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Bố cục email chung: bảng đơn giản, tông ấm, không phụ thuộc ảnh ngoài. */
function layout(options: { heading: string; body: string; ctaLabel?: string; ctaHref?: string; footerNote?: string }): string {
  const cta =
    options.ctaLabel && options.ctaHref
      ? `<tr><td style="padding:8px 0 4px;">
           <a href="${options.ctaHref}" style="display:inline-block;background:#b06d48;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:15px;">${escapeHtml(options.ctaLabel)}</a>
         </td></tr>`
      : '';

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#faf5ec;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4a3f38;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8dac2;border-radius:16px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#b06d48;font-weight:600;">${escapeHtml(site.name)}</p>
      <h1 style="margin:12px 0 0;font-size:24px;line-height:1.3;color:#2f2823;font-weight:600;">${escapeHtml(options.heading)}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:15px;line-height:1.7;">${options.body}</td></tr>
        ${cta}
      </table>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #f3ead9;font-size:12px;color:#6b5f56;">
      ${options.footerNote ? `<p style="margin:0 0 8px;">${options.footerNote}</p>` : ''}
      <p style="margin:0;">${escapeHtml(site.name)} — vận hành bởi ${escapeHtml(site.company)}.</p>
    </td></tr>
  </table>
</body></html>`;
}

export interface ReminderEmailInput {
  ownerName: string;
  memorial: Memorial;
  reminder: Reminder;
  /** URL công khai của trang kỷ niệm */
  memorialUrl: string;
  /** URL để tắt nhắc */
  settingsUrl: string;
  /** Còn bao nhiêu ngày nữa tới mốc (0 = hôm nay) */
  daysUntil: number;
}

/** Email nhắc mốc tưởng niệm (49 ngày, 100 ngày, giỗ hằng năm). */
export function reminderEmail(input: ReminderEmailInput): EmailMessage {
  const { memorial, reminder, daysUntil } = input;
  const petName = memorial.petName;
  const dateText = formatDate(reminder.nextDate);

  const whenPhrase =
    daysUntil <= 0
      ? 'Hôm nay'
      : daysUntil === 1
        ? 'Ngày mai'
        : `Còn ${daysUntil} ngày nữa`;

  const subject =
    daysUntil <= 0
      ? `Hôm nay là ${reminder.label.toLowerCase()} của ${petName}`
      : `${whenPhrase} là ${reminder.label.toLowerCase()} của ${petName} (${dateText})`;

  const sentence =
    daysUntil <= 0
      ? `Hôm nay là <strong>${escapeHtml(reminder.label)}</strong> của ${escapeHtml(petName)} — ngày ${dateText}.`
      : `${whenPhrase} là <strong>${escapeHtml(reminder.label)}</strong> của ${escapeHtml(petName)} — ngày ${dateText}.`;

  const lunarNote = memorial.deathDateLunar
    ? `<p style="margin:0 0 14px;">Ngày bé rời đi theo âm lịch: <strong>${escapeHtml(memorial.deathDateLunar)}</strong>.</p>`
    : '';

  const body = `
    <p style="margin:0 0 14px;">Chào ${escapeHtml(input.ownerName)},</p>
    <p style="margin:0 0 14px;">${sentence}</p>
    ${lunarNote}
    <p style="margin:0 0 14px;">Chúng tôi gửi email này để bạn không phải tự nhớ ngày âm — nếu gia đình có làm mâm cơm hay thắp một nén nhang cho bé thì đây là ngày đó.</p>
    <p style="margin:0 0 14px;">Bạn cũng có thể ghé lại trang của bé, xem lại ảnh cũ, hoặc thêm một dòng vào câu chuyện.</p>
  `;

  const html = layout({
    heading: `${reminder.label} của ${petName}`,
    body,
    ctaLabel: `Ghé trang của ${petName}`,
    ctaHref: input.memorialUrl,
    footerNote: `Bạn nhận email này vì đã bật nhắc ngày tưởng niệm cho ${escapeHtml(petName)}. <a href="${input.settingsUrl}" style="color:#b06d48;">Tắt nhắc</a>.`,
  });

  const text = [
    `Chào ${input.ownerName},`,
    '',
    `${whenPhrase} là ${reminder.label} của ${petName} — ngày ${dateText}.`,
    memorial.deathDateLunar ? `Ngày bé rời đi theo âm lịch: ${memorial.deathDateLunar}.` : '',
    '',
    `Ghé trang của bé: ${input.memorialUrl}`,
    '',
    `Tắt nhắc: ${input.settingsUrl}`,
    '',
    `${site.name} — vận hành bởi ${site.company}.`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { to: '', subject, html, text };
}

/** Email thông báo có lời lưu bút mới chờ duyệt. */
export function newGuestbookEmail(input: {
  ownerName: string;
  petName: string;
  authorName: string;
  message: string;
  moderateUrl: string;
}): EmailMessage {
  const body = `
    <p style="margin:0 0 14px;">Chào ${escapeHtml(input.ownerName)},</p>
    <p style="margin:0 0 14px;"><strong>${escapeHtml(input.authorName)}</strong> vừa để lại một lời nhắn trên trang của ${escapeHtml(input.petName)}:</p>
    <blockquote style="margin:0 0 14px;padding:12px 16px;background:#faf5ec;border-left:3px solid #daa484;border-radius:8px;white-space:pre-line;">${escapeHtml(input.message.slice(0, 600))}</blockquote>
    <p style="margin:0 0 14px;">Lời nhắn sẽ chỉ hiện trên trang sau khi bạn duyệt.</p>
  `;

  return {
    to: '',
    subject: `Lời nhắn mới trên trang của ${input.petName}`,
    html: layout({
      heading: `Lời nhắn mới cho ${input.petName}`,
      body,
      ctaLabel: 'Duyệt lời nhắn',
      ctaHref: input.moderateUrl,
    }),
    text: `${input.authorName} vừa để lại lời nhắn trên trang của ${input.petName}:\n\n${input.message.slice(0, 600)}\n\nDuyệt tại: ${input.moderateUrl}`,
  };
}
