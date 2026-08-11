import { ImageResponse } from 'workers-og';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Cache font trong bộ nhớ của isolate để không đọc lại mỗi request. */
const fontCache = new Map<string, ArrayBuffer>();

async function loadFont(env: Env, requestUrl: string, file: string): Promise<ArrayBuffer | null> {
  const cached = fontCache.get(file);
  if (cached) return cached;

  const path = `/fonts/${file}`;
  const attempts: Array<() => Promise<Response>> = [
    () => env.ASSETS.fetch(new URL(path, requestUrl).toString()),
    () => fetch(new URL(path, requestUrl).toString()),
  ];

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1000) {
          fontCache.set(file, buffer);
          return buffer;
        }
      }
    } catch {
      // thử cách tiếp theo
    }
  }
  console.error(`Không tải được font ${file} cho OG image`);
  return null;
}

export async function ogFonts(env: Env, requestUrl: string) {
  const [regular, semibold] = await Promise.all([
    loadFont(env, requestUrl, 'BeVietnamPro-Regular.ttf'),
    loadFont(env, requestUrl, 'BeVietnamPro-SemiBold.ttf'),
  ]);

  const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }> = [];
  if (regular) fonts.push({ name: 'Be Vietnam Pro', data: regular, weight: 400, style: 'normal' });
  if (semibold) fonts.push({ name: 'Be Vietnam Pro', data: semibold, weight: 600, style: 'normal' });
  return fonts;
}

/** Giới hạn dung lượng ảnh nhúng vào OG để không vượt bộ nhớ Worker. */
const MAX_EMBEDDED_PHOTO_BYTES = 2_500_000;

/** Đọc ảnh từ R2 và trả về data URI để satori không phải gọi mạng. */
export async function photoDataUri(env: Env, r2Key: string | null): Promise<string | null> {
  if (!r2Key) return null;
  try {
    const object = await env.BUCKET.get(r2Key);
    if (!object || object.size > MAX_EMBEDDED_PHOTO_BYTES) return null;
    const bytes = new Uint8Array(await object.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const contentType = object.httpMetadata?.contentType ?? 'image/jpeg';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (error) {
    console.error('Không đọc được ảnh cho OG image:', error);
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MemorialOgInput {
  petName: string;
  dateLine: string;
  lunarLine?: string | null;
  photo?: string | null;
  brand: string;
  theme?: string;
}

const THEME_COLORS: Record<string, { bg: string; panel: string; heading: string; muted: string; accent: string }> = {
  'am-ap': { bg: '#faf5ec', panel: '#f3ead9', heading: '#2f2823', muted: '#6b5f56', accent: '#b06d48' },
  'thanh-tinh': { bg: '#f4f7f8', panel: '#e4ecef', heading: '#23343b', muted: '#7b8d95', accent: '#4f7f8b' },
  'dem-sao': { bg: '#131625', panel: '#1e2338', heading: '#f2f3fa', muted: '#8e97b5', accent: '#f0b95c' },
};

/** HTML cho satori — chỉ dùng flexbox và style inline. */
export function memorialOgHtml(input: MemorialOgInput): string {
  const colors = THEME_COLORS[input.theme ?? 'am-ap'] ?? THEME_COLORS['am-ap']!;
  const name = escapeHtml(input.petName);
  const dateLine = escapeHtml(input.dateLine);
  const lunarLine = input.lunarLine ? escapeHtml(input.lunarLine) : '';

  const photoBlock = input.photo
    ? `<div style="display:flex;width:430px;height:430px;border-radius:32px;overflow:hidden;background:${colors.panel};">
         <img src="${input.photo}" width="430" height="430" style="width:430px;height:430px;object-fit:cover;" />
       </div>`
    : // Không có ảnh: hiện chữ đầu của tên bé (satori không vẽ được emoji nếu
      // chưa nạp font emoji riêng, nên tránh dùng emoji ở đây)
      `<div style="display:flex;align-items:center;justify-content:center;width:430px;height:430px;border-radius:32px;background:${colors.panel};font-size:190px;font-weight:600;color:${colors.accent};">${escapeHtml([...input.petName][0] ?? '•')}</div>`;

  return `<div style="display:flex;width:${OG_WIDTH}px;height:${OG_HEIGHT}px;background:${colors.bg};padding:80px;align-items:center;font-family:'Be Vietnam Pro';">
  ${photoBlock}
  <div style="display:flex;flex-direction:column;justify-content:center;margin-left:64px;width:496px;">
    <div style="display:flex;font-size:26px;color:${colors.accent};font-weight:600;letter-spacing:2px;">TƯỞNG NHỚ</div>
    <div style="display:flex;font-size:${name.length > 14 ? 66 : 86}px;font-weight:600;color:${colors.heading};margin-top:14px;line-height:1.1;">${name}</div>
    <div style="display:flex;font-size:34px;color:${colors.muted};margin-top:22px;">${dateLine}</div>
    ${lunarLine ? `<div style="display:flex;font-size:26px;color:${colors.muted};margin-top:10px;">${lunarLine}</div>` : ''}
    <div style="display:flex;font-size:24px;color:${colors.accent};margin-top:44px;font-weight:600;">${escapeHtml(input.brand)}</div>
  </div>
</div>`;
}

export interface SiteOgInput {
  title: string;
  subtitle: string;
  brand: string;
}

export function siteOgHtml(input: SiteOgInput): string {
  const colors = THEME_COLORS['am-ap']!;
  return `<div style="display:flex;flex-direction:column;width:${OG_WIDTH}px;height:${OG_HEIGHT}px;background:${colors.bg};padding:96px;justify-content:center;font-family:'Be Vietnam Pro';">
  <div style="display:flex;font-size:28px;color:${colors.accent};font-weight:600;letter-spacing:2px;">${escapeHtml(input.brand.toUpperCase())}</div>
  <div style="display:flex;font-size:76px;font-weight:600;color:${colors.heading};margin-top:24px;line-height:1.15;">${escapeHtml(input.title)}</div>
  <div style="display:flex;font-size:34px;color:${colors.muted};margin-top:28px;line-height:1.4;">${escapeHtml(input.subtitle)}</div>
</div>`;
}

/** PNG nhỏ nhất được coi là hợp lệ — nhỏ hơn mức này coi như render lỗi. */
const MIN_VALID_PNG_BYTES = 1000;

/**
 * Sinh ảnh PNG từ HTML.
 *
 * Đọc hết body thay vì trả stream: nếu satori/resvg lỗi giữa đường (ví dụ ảnh
 * nhúng bị hỏng) thì stream chỉ đơn giản kết thúc rỗng, phía gọi sẽ không biết.
 * Trả `null` khi render lỗi để phía gọi có phương án dự phòng.
 */
export async function renderOg(
  html: string,
  fonts: Awaited<ReturnType<typeof ogFonts>>,
): Promise<Uint8Array | null> {
  try {
    const response = new ImageResponse(html, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      format: 'png',
      fonts: fonts as never,
    });
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < MIN_VALID_PNG_BYTES) {
      console.error(`Sinh OG image ra ${buffer.byteLength} byte — coi như lỗi`);
      return null;
    }
    return new Uint8Array(buffer);
  } catch (error) {
    console.error('Sinh OG image lỗi:', error);
    return null;
  }
}

/** Đóng gói PNG thành Response kèm header cache. */
export function ogResponse(png: Uint8Array, maxAge = 86400, sMaxAge = 2592000): Response {
  return new Response(png as unknown as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'content-length': String(png.byteLength),
      'cache-control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`,
    },
  });
}
