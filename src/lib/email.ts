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

/**
 * Email báo đã nhận thanh toán.
 *
 * Với hình thức chuyển khoản thì đây là thứ duy nhất chứng minh tiền đã tới nơi —
 * không có email này khách chỉ biết ngồi đoán.
 */
export function orderPaidEmail(input: {
  ownerName: string;
  petName: string | null;
  amountText: string;
  paymentCode: string;
  memorialUrl: string | null;
  /** Đơn combo thẻ vật lý thì hẹn ngày gửi thẻ */
  physical: boolean;
  shippingDays?: number;
}): EmailMessage {
  const petPhrase = input.petName ? ` cho bé ${input.petName}` : '';

  const physicalNote = input.physical
    ? `<p style="margin:0 0 14px;">Thẻ QR khắc sẵn của bé sẽ được gửi đi trong khoảng <strong>${input.shippingDays ?? 7} ngày</strong>. Chúng tôi sẽ báo bạn ngay khi thẻ rời kho.</p>`
    : '';

  const body = `
    <p style="margin:0 0 14px;">Chào ${escapeHtml(input.ownerName)},</p>
    <p style="margin:0 0 14px;">Chúng tôi đã nhận được <strong>${escapeHtml(input.amountText)}</strong> cho đơn <code>${escapeHtml(input.paymentCode)}</code>. Premium đã được kích hoạt${escapeHtml(petPhrase)}.</p>
    <p style="margin:0 0 14px;">Từ giờ trang của bé không còn giới hạn ảnh, không hiện thương hiệu của chúng tôi, và bạn dùng được toàn bộ tính năng.</p>
    ${physicalNote}
    <p style="margin:0 0 14px;">Cảm ơn bạn đã tin chúng tôi giữ giúp những kỷ niệm này.</p>
  `;

  return {
    to: '',
    subject: input.petName
      ? `Đã nhận thanh toán — Premium đã kích hoạt cho bé ${input.petName}`
      : 'Đã nhận thanh toán — Premium đã kích hoạt',
    html: layout({
      heading: 'Đã nhận thanh toán',
      body,
      ctaLabel: input.memorialUrl ? `Ghé trang của ${input.petName ?? 'bé'}` : undefined,
      ctaHref: input.memorialUrl ?? undefined,
      footerNote: `Mã đơn: ${escapeHtml(input.paymentCode)}. Cần hỗ trợ, bạn trả lời email này hoặc viết cho ${escapeHtml(site.supportEmail)}.`,
    }),
    text: [
      `Chào ${input.ownerName},`,
      '',
      `Chúng tôi đã nhận được ${input.amountText} cho đơn ${input.paymentCode}. Premium đã được kích hoạt${petPhrase}.`,
      input.physical
        ? `Thẻ QR khắc sẵn sẽ được gửi đi trong khoảng ${input.shippingDays ?? 7} ngày.`
        : '',
      '',
      input.memorialUrl ? `Trang của bé: ${input.memorialUrl}` : '',
      '',
      `${site.name} — vận hành bởi ${site.company}.`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

/** Email báo thẻ QR vật lý đã gửi đi. */
export function orderShippedEmail(input: {
  ownerName: string;
  petName: string | null;
  paymentCode: string;
  /** Địa chỉ đã lưu lúc đặt, nhắc lại để khách đối chiếu */
  recipientName?: string;
  address?: string;
  materialLabel?: string;
}): EmailMessage {
  const petPhrase = input.petName ? `của bé ${input.petName}` : 'của bạn';

  const addressBlock =
    input.recipientName || input.address
      ? `<p style="margin:0 0 6px;">Gửi tới:</p>
         <p style="margin:0 0 14px;padding:12px 16px;background:#faf5ec;border-left:3px solid #daa484;border-radius:8px;">
           ${input.recipientName ? `<strong>${escapeHtml(input.recipientName)}</strong><br>` : ''}
           ${input.address ? escapeHtml(input.address) : ''}
         </p>`
      : '';

  const body = `
    <p style="margin:0 0 14px;">Chào ${escapeHtml(input.ownerName)},</p>
    <p style="margin:0 0 14px;">Thẻ kỷ niệm ${escapeHtml(petPhrase)}${input.materialLabel ? ` (${escapeHtml(input.materialLabel)})` : ''} đã được gửi đi.</p>
    ${addressBlock}
    <p style="margin:0 0 14px;">Quét mã QR trên thẻ là mở thẳng trang của bé — bạn thử quét một lần khi nhận được để chắc chắn mã in rõ nhé.</p>
    <p style="margin:0 0 14px;">Nếu sau một tuần vẫn chưa thấy thẻ, bạn báo lại giúp chúng tôi.</p>
  `;

  return {
    to: '',
    subject: input.petName
      ? `Thẻ kỷ niệm của bé ${input.petName} đã được gửi đi`
      : 'Thẻ kỷ niệm của bạn đã được gửi đi',
    html: layout({
      heading: 'Thẻ đã lên đường',
      body,
      footerNote: `Mã đơn: ${escapeHtml(input.paymentCode)}. Cần hỗ trợ, bạn viết cho ${escapeHtml(site.supportEmail)}.`,
    }),
    text: [
      `Chào ${input.ownerName},`,
      '',
      `Thẻ kỷ niệm ${petPhrase}${input.materialLabel ? ` (${input.materialLabel})` : ''} đã được gửi đi.`,
      input.recipientName ? `Gửi tới: ${input.recipientName}` : '',
      input.address ?? '',
      '',
      'Quét mã QR trên thẻ là mở thẳng trang của bé.',
      `Mã đơn: ${input.paymentCode}`,
      '',
      `${site.name} — vận hành bởi ${site.company}.`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

/** Email chứa link đặt lại mật khẩu. */
export function passwordResetEmail(input: {
  userName: string;
  resetUrl: string;
  /** Link sống bao nhiêu phút, để nói rõ trong thư */
  minutesValid: number;
}): EmailMessage {
  const body = `
    <p style="margin:0 0 14px;">Chào ${escapeHtml(input.userName)},</p>
    <p style="margin:0 0 14px;">Có người vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Nếu là bạn, bấm nút bên dưới để chọn mật khẩu mới.</p>
    <p style="margin:0 0 14px;">Link chỉ dùng được <strong>một lần</strong> và hết hạn sau ${input.minutesValid} phút.</p>
    <p style="margin:0 0 14px;">Nếu không phải bạn yêu cầu thì cứ bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên, không có gì thay đổi.</p>
  `;

  return {
    to: '',
    subject: `Đặt lại mật khẩu ${site.name}`,
    html: layout({
      heading: 'Đặt lại mật khẩu',
      body,
      ctaLabel: 'Chọn mật khẩu mới',
      ctaHref: input.resetUrl,
      footerNote: 'Nút không bấm được? Dán đường dẫn này vào trình duyệt:<br>' + escapeHtml(input.resetUrl),
    }),
    text: [
      `Chào ${input.userName},`,
      '',
      'Có người vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Nếu là bạn, mở link sau để chọn mật khẩu mới:',
      '',
      input.resetUrl,
      '',
      `Link chỉ dùng được một lần và hết hạn sau ${input.minutesValid} phút.`,
      'Nếu không phải bạn yêu cầu thì cứ bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.',
      '',
      `${site.name} — vận hành bởi ${site.company}.`,
    ].join('\n'),
  };
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
