import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { products, studioJobs, type Product, type StudioJob } from '../db/schema';
import { newId } from '../ids';
import { STUDIO_COSTS } from '../plans';
import { balanceOf, chargeForJob, refundJob } from '../credits';
import { chatText } from '../llm';
import { env } from '../env';
import { getModel, type ModelView } from './models';
import { pickImageProvider } from './provider';
import { buildPhotoshootPrompt, findBlockedKeyword, sanitizeFragment } from './prompt';

/** Thông tin người dùng nhập cho một buổi chụp, lưu vào `studio_jobs.brief_json`. */
export interface PhotoshootBrief {
  scene: string;
  count: number;
  notes: string | null;
  /** Ghi chú nguồn, ví dụ id phân tích TikTok dẫn tới đây */
  source: string | null;
}

export const MAX_PRODUCT_IMAGES = 3;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MIN_COUNT = 1;
export const MAX_COUNT = 4;

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type CreateJobResult =
  | { ok: true; job: StudioJob }
  | { ok: false; error: string; code: 'invalid' | 'blocked' | 'credits' | 'model' };

export interface CreateJobInput {
  userId: string;
  modelId: string;
  productName: string;
  productDescription: string;
  category: string;
  scene: string;
  count: number;
  notes: string;
  source: string;
  files: File[];
}

export function photoshootCost(count: number): number {
  return count * STUDIO_COSTS.photoshootImage;
}

/**
 * Kiểm tra đầu vào, lưu sản phẩm + ảnh vào R2, trừ tín chỉ, ghi job `queued`.
 * Không gọi model sinh ảnh ở đây — việc đó chạy nền trong `runJob`.
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  const productName = sanitizeFragment(input.productName, 120);
  if (productName.length < 2) {
    return { ok: false, code: 'invalid', error: 'Bạn nhập tên sản phẩm giúp nhé.' };
  }
  const scene = sanitizeFragment(input.scene, 200);
  if (!scene) {
    return { ok: false, code: 'invalid', error: 'Bạn chọn hoặc mô tả bối cảnh chụp giúp nhé.' };
  }
  const count = Math.floor(input.count);
  if (!Number.isFinite(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return { ok: false, code: 'invalid', error: `Số ảnh từ ${MIN_COUNT} đến ${MAX_COUNT}.` };
  }
  if (input.files.length > MAX_PRODUCT_IMAGES) {
    return { ok: false, code: 'invalid', error: `Tối đa ${MAX_PRODUCT_IMAGES} ảnh sản phẩm.` };
  }
  for (const file of input.files) {
    if (!IMAGE_TYPES[file.type]) {
      return { ok: false, code: 'invalid', error: 'Ảnh sản phẩm chỉ nhận JPG, PNG hoặc WebP.' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, code: 'invalid', error: 'Mỗi ảnh sản phẩm tối đa 6MB.' };
    }
  }

  const blocked = findBlockedKeyword(productName, input.productDescription, input.notes, scene);
  if (blocked) {
    return {
      ok: false,
      code: 'blocked',
      error: `Studio không nhận sản phẩm thuộc nhóm "${blocked}" (thuốc kê đơn, rượu bia, thuốc lá, cờ bạc, vũ khí, nội dung người lớn).`,
    };
  }

  const model = await getModel(input.modelId);
  if (!model || !model.model.active) {
    return { ok: false, code: 'model', error: 'Người mẫu này hiện không nhận việc.' };
  }

  // Trừ tín chỉ TRƯỚC khi lưu sản phẩm và ảnh: lần bấm thiếu tín chỉ không để
  // lại bản ghi và tệp R2 mồ côi. Nếu bước lưu phía dưới hỏng thì hoàn lại.
  const cost = photoshootCost(count);
  const jobId = newId();
  const charged = await chargeForJob(input.userId, jobId, cost);
  if (!charged) {
    return {
      ok: false,
      code: 'credits',
      error: `Buổi chụp này cần ${cost} tín chỉ. Bạn nạp thêm rồi quay lại nhé.`,
    };
  }

  const db = getDb(env.DB);
  const productId = newId();
  const imageKeys: string[] = [];
  try {
    for (const [index, file] of input.files.entries()) {
      const key = `studio/products/${productId}/${index + 1}.${IMAGE_TYPES[file.type]}`;
      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      });
      imageKeys.push(key);
    }

    await db.insert(products).values({
      id: productId,
      userId: input.userId,
      name: productName,
      description: sanitizeFragment(input.productDescription, 600) || null,
      category: sanitizeFragment(input.category, 60) || null,
      imagesJson: JSON.stringify(imageKeys),
    });
  } catch (error) {
    await refundJob(input.userId, jobId, cost);
    throw error;
  }

  const brief: PhotoshootBrief = {
    scene,
    count,
    notes: sanitizeFragment(input.notes, 200) || null,
    source: sanitizeFragment(input.source, 80) || null,
  };
  const provider = pickImageProvider(env);
  const job: StudioJob = {
    id: jobId,
    userId: input.userId,
    modelId: model.model.id,
    productId,
    kind: 'photoshoot',
    status: 'queued',
    briefJson: JSON.stringify(brief),
    prompt: null,
    provider: provider.name,
    resultKeysJson: null,
    costCredits: cost,
    error: null,
    createdAt: Math.floor(Date.now() / 1000),
    finishedAt: null,
  };
  try {
    await db.insert(studioJobs).values(job);
  } catch (error) {
    await refundJob(input.userId, jobId, cost);
    throw error;
  }
  return { ok: true, job };
}

const PROMPT_REFINE_SYSTEM = `You refine image-generation prompts for commercial product photos featuring a fixed virtual model.
Rules: keep every detail describing the model's appearance exactly as given; keep the product name verbatim; output ONE English prompt under 120 words, comma-separated phrases, no quotes, no explanation.`;

/**
 * Nhờ LLM gọt prompt cho tự nhiên hơn. Hỏng hoặc trả về thứ lạ thì dùng bản thuần.
 * Prompt tinh chỉnh phải vẫn chứa tên sản phẩm, nếu không thì coi như không dùng được.
 */
async function refinePrompt(base: string, productName: string): Promise<string> {
  if (!env.AI) return base;
  const refined = await chatText(env.AI, PROMPT_REFINE_SYSTEM, base, { maxTokens: 300, temperature: 0.3 });
  if (!refined) return base;
  const clean = refined.replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim();
  const keepsProduct = clean.toLowerCase().includes(productName.toLowerCase().slice(0, 20));
  return clean.length > 40 && clean.length < 1200 && keepsProduct ? clean : base;
}

/**
 * Chạy job trong nền: sinh từng ảnh, lưu R2, cập nhật trạng thái.
 * Lỗi ở bất kỳ ảnh nào thì job `failed` và hoàn toàn bộ tín chỉ — không trả
 * nửa vời vì người dùng không có cách nào tự "sinh nốt" phần còn thiếu.
 */
export async function runJob(jobId: string): Promise<void> {
  const db = getDb(env.DB);
  const rows = await db.select().from(studioJobs).where(eq(studioJobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job || job.status !== 'queued') return;

  await db.update(studioJobs).set({ status: 'running' }).where(eq(studioJobs.id, jobId));

  try {
    const [model, product] = await Promise.all([getModel(job.modelId), getProduct(job.productId)]);
    if (!model || !product) throw new Error('Thiếu người mẫu hoặc sản phẩm của job');

    const brief = parseBrief(job.briefJson);
    const basePrompt = buildPhotoshootPrompt(
      { promptBase: model.persona.promptBase, style: model.persona.style },
      { name: product.name, description: product.description, category: product.category },
      { scene: brief.scene, notes: brief.notes, index: 0 },
    );
    const refined = await refinePrompt(basePrompt, product.name);
    await db.update(studioJobs).set({ prompt: refined }).where(eq(studioJobs.id, jobId));

    const provider = pickImageProvider(env);
    const keys: string[] = [];
    for (let index = 0; index < brief.count; index++) {
      // Ảnh đầu dùng prompt đã gọt; các ảnh sau đổi góc máy để không ra bốn tấm giống nhau
      const prompt =
        index === 0
          ? refined
          : buildPhotoshootPrompt(
              { promptBase: model.persona.promptBase, style: model.persona.style },
              { name: product.name, description: product.description, category: product.category },
              { scene: brief.scene, notes: brief.notes, index },
            );
      const bytes = await provider.generate({ prompt, width: 1024, height: 1024 });
      if (bytes.length < 1000) throw new Error('Ảnh sinh ra quá nhỏ, coi như lỗi');
      const key = `studio/jobs/${jobId}/${index + 1}.png`;
      await env.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
      });
      keys.push(key);
      // Ghi dần để trang trạng thái hiện ảnh đã xong trong lúc chờ ảnh kế
      await db.update(studioJobs).set({ resultKeysJson: JSON.stringify(keys) }).where(eq(studioJobs.id, jobId));
    }

    await db
      .update(studioJobs)
      .set({ status: 'done', finishedAt: Math.floor(Date.now() / 1000) })
      .where(eq(studioJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[studio] Job ${jobId} lỗi:`, error);
    await db
      .update(studioJobs)
      .set({ status: 'failed', error: message.slice(0, 500), finishedAt: Math.floor(Date.now() / 1000) })
      .where(eq(studioJobs.id, jobId));
    await refundJob(job.userId, jobId, job.costCredits);
  }
}

export function parseBrief(raw: string): PhotoshootBrief {
  try {
    const parsed = JSON.parse(raw) as Partial<PhotoshootBrief>;
    return {
      scene: String(parsed.scene ?? ''),
      count: Math.min(MAX_COUNT, Math.max(MIN_COUNT, Number(parsed.count ?? 1))),
      notes: parsed.notes ? String(parsed.notes) : null,
      source: parsed.source ? String(parsed.source) : null,
    };
  } catch {
    return { scene: '', count: 1, notes: null, source: null };
  }
}

export function parseResultKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseImageKeys(raw: string | null): string[] {
  return parseResultKeys(raw);
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await getDb(env.DB).select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getOwnedJob(id: string, userId: string): Promise<StudioJob | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(studioJobs)
    .where(and(eq(studioJobs.id, id), eq(studioJobs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listJobsOfUser(userId: string, limit = 20): Promise<StudioJob[]> {
  return getDb(env.DB)
    .select()
    .from(studioJobs)
    .where(eq(studioJobs.userId, userId))
    .orderBy(desc(studioJobs.createdAt))
    .limit(limit);
}

export const JOB_STATUS_LABEL: Record<string, string> = {
  queued: 'Đang xếp hàng',
  running: 'Đang chụp',
  done: 'Đã xong',
  failed: 'Lỗi, đã hoàn tín chỉ',
};

export type { ModelView };
