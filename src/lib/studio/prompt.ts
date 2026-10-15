/**
 * Dựng prompt sinh ảnh cho buổi chụp người mẫu ảo.
 *
 * Thuần, không phụ thuộc gì để test được bằng Node. Prompt viết tiếng Anh vì
 * model sinh ảnh bám tiếng Anh tốt hơn; phần tinh chỉnh bằng LLM (tuỳ chọn)
 * nằm ở service, và luôn có bản thuần này làm dự phòng.
 */

export interface PromptPersona {
  promptBase: string;
  style?: string;
}

export interface PromptProduct {
  name: string;
  description?: string | null;
  category?: string | null;
}

export interface PromptBrief {
  /** Bối cảnh chụp, tiếng Việt hoặc Anh đều được */
  scene: string;
  notes?: string | null;
  /** Số thứ tự ảnh trong buổi chụp, để mỗi ảnh một góc máy khác nhau */
  index?: number;
}

/** Bối cảnh gợi ý sẵn trong form. Key dùng làm value, prompt là phần tiếng Anh. */
export const SCENE_PRESETS: Array<{ id: string; label: string; prompt: string }> = [
  { id: 'studio', label: 'Studio nền trơn', prompt: 'clean studio backdrop, soft diffused lighting' },
  { id: 'nha', label: 'Trong nhà ấm cúng', prompt: 'cozy modern living room, warm window light' },
  { id: 'cafe', label: 'Quán cà phê', prompt: 'bright minimalist cafe, wooden table, natural light' },
  { id: 'pho', label: 'Phố Việt Nam', prompt: 'vibrant Vietnamese street at golden hour, shallow depth of field' },
  { id: 'gym', label: 'Phòng gym', prompt: 'modern gym interior, dramatic directional lighting' },
  { id: 'ngoai-troi', label: 'Ngoài trời xanh mát', prompt: 'outdoor park with greenery, soft morning light' },
];

const ANGLES = [
  'medium shot, looking at camera, holding the product at chest level',
  'close-up, product near the face, gentle smile',
  'three-quarter shot, using the product naturally',
  'wide shot, product placed in the scene beside the model',
];

const QUALITY =
  'commercial product photography, photorealistic, sharp focus on the product, natural skin texture, 4k, high detail';

const SAFETY = 'fully clothed, tasteful, no text, no watermark, no logo distortion, no extra hands';

/** Giữ chuỗi người dùng nhập gọn và không phá cấu trúc prompt. */
export function sanitizeFragment(value: string | null | undefined, max = 300): string {
  return (value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function scenePrompt(scene: string): string {
  const preset = SCENE_PRESETS.find((item) => item.id === scene);
  return preset ? preset.prompt : sanitizeFragment(scene, 200);
}

export function buildPhotoshootPrompt(
  persona: PromptPersona,
  product: PromptProduct,
  brief: PromptBrief,
): string {
  const parts: string[] = [];
  parts.push(sanitizeFragment(persona.promptBase, 400));
  if (persona.style) parts.push(sanitizeFragment(persona.style, 150));

  const productBits = [`presenting a product: ${sanitizeFragment(product.name, 120)}`];
  if (product.category) productBits.push(`(${sanitizeFragment(product.category, 60)})`);
  if (product.description) productBits.push(`— ${sanitizeFragment(product.description, 300)}`);
  parts.push(productBits.join(' '));

  parts.push(scenePrompt(brief.scene));
  parts.push(ANGLES[(brief.index ?? 0) % ANGLES.length]!);
  if (brief.notes) parts.push(sanitizeFragment(brief.notes, 200));
  parts.push(QUALITY);
  parts.push(SAFETY);

  return parts.filter(Boolean).join(', ');
}

/** Prompt chân dung giới thiệu người mẫu, không có sản phẩm. */
export function buildPortraitPrompt(persona: PromptPersona): string {
  return [
    sanitizeFragment(persona.promptBase, 400),
    persona.style ? sanitizeFragment(persona.style, 150) : '',
    'portrait, head and shoulders, looking at camera, friendly expression',
    'clean neutral backdrop, soft studio lighting',
    'photorealistic, natural skin texture, high detail',
    SAFETY,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Từ khoá sản phẩm không nhận. Danh sách cố ý ngắn và thô: mục đích là chặn
 * trường hợp rõ ràng, không thay cho kiểm duyệt tay.
 */
const BLOCKED_KEYWORDS = [
  'thuốc kê đơn',
  'thuốc kê toa',
  'kháng sinh',
  'rượu',
  'bia',
  'vodka',
  'whisky',
  'thuốc lá',
  'vape',
  'pod',
  'cờ bạc',
  'cá độ',
  'casino',
  'vũ khí',
  'súng',
  'dao găm',
  'sex',
  'đồ chơi người lớn',
  'khiêu dâm',
  '18+',
];

/**
 * Mỗi từ khoá khớp theo ranh giới từ (chữ hoặc số kề bên thì không tính), để
 * "unisex" không dính "sex" và "tripod" không dính "pod".
 */
const BLOCKED_PATTERNS = new Map(
  BLOCKED_KEYWORDS.map((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [keyword, new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u')];
  }),
);

/** Trả về từ khoá vi phạm đầu tiên, hoặc null nếu ổn. */
export function findBlockedKeyword(...texts: Array<string | null | undefined>): string | null {
  const haystack = texts.map((text) => (text ?? '').toLowerCase()).join(' ');
  for (const keyword of BLOCKED_KEYWORDS) {
    if (BLOCKED_PATTERNS.get(keyword)!.test(haystack)) return keyword;
  }
  return null;
}
