import { encode, renderSVG } from 'uqr';

export interface QrOptions {
  /** Số module viền trắng quanh mã (QR cần ít nhất 2 để máy quét đọc tốt) */
  border?: number;
  darkColor?: string;
  lightColor?: string;
}

/** Mã QR dạng SVG thuần, không phụ thuộc canvas nên chạy được trên Workers. */
export function qrSvg(text: string, options: QrOptions = {}): string {
  return renderSVG(text, {
    border: options.border ?? 2,
    blackColor: options.darkColor ?? '#2f2823',
    whiteColor: options.lightColor ?? '#ffffff',
    ecc: 'M',
  });
}

/** Ma trận module — dùng khi cần tự vẽ QR vào một SVG lớn hơn. */
export function qrMatrix(text: string): boolean[][] {
  const result = encode(text, { border: 0, ecc: 'M' });
  return result.data as unknown as boolean[][];
}

export interface QrCardInput {
  url: string;
  petName: string;
  /** Dòng ngày tháng, ví dụ "2012 — 2025" */
  dateLine?: string;
  /** Dòng chân thẻ, ví dụ tên thương hiệu */
  footer?: string;
}

/**
 * Thẻ QR để in hoặc gửi xưởng khắc: khổ dọc 600×820, mã QR vẽ bằng path
 * nên phóng to bao nhiêu cũng nét.
 */
export function qrCardSvg(input: QrCardInput): string {
  const matrix = qrMatrix(input.url);
  const modules = matrix.length;
  const qrSize = 380;
  const cell = qrSize / modules;
  const qrX = (600 - qrSize) / 2;
  const qrY = 210;

  let path = '';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (matrix[row]![col]) {
        const x = qrX + col * cell;
        const y = qrY + row * cell;
        path += `M${round(x)} ${round(y)}h${round(cell)}v${round(cell)}h-${round(cell)}z`;
      }
    }
  }

  const dateLine = input.dateLine ? escapeXml(input.dateLine) : '';
  const footer = input.footer ? escapeXml(input.footer) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 820" width="600" height="820" role="img" aria-label="Mã QR trang kỷ niệm của ${escapeXml(input.petName)}">
  <rect width="600" height="820" fill="#ffffff"/>
  <rect x="24" y="24" width="552" height="772" rx="28" fill="none" stroke="#e8dac2" stroke-width="3"/>
  <text x="300" y="118" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" fill="#2f2823">${escapeXml(input.petName)}</text>
  ${dateLine ? `<text x="300" y="162" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#6b5f56">${dateLine}</text>` : ''}
  <path d="${path}" fill="#2f2823" shape-rendering="crispEdges"/>
  <text x="300" y="672" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#6b5f56">Quét mã để xem trang kỷ niệm</text>
  ${footer ? `<text x="300" y="746" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#b06d48">${footer}</text>` : ''}
</svg>`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
