import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { virtualModels, type VirtualModel } from '../db/schema';
import { env } from '../env';

/** Mô tả cố định của một người mẫu ảo — nguồn duy nhất để giữ nhất quán giữa các lần sinh. */
export interface Persona {
  age: number;
  gender: string;
  appearance: string;
  style: string;
  voice: string;
  niches: string[];
  /** Tiếng Anh, ghép vào đầu mọi prompt sinh ảnh */
  promptBase: string;
}

export interface ModelView {
  model: VirtualModel;
  persona: Persona;
  portraitUrl: string | null;
}

export function parsePersona(raw: string): Persona {
  const parsed = JSON.parse(raw) as Partial<Persona>;
  return {
    age: Number(parsed.age ?? 25),
    gender: String(parsed.gender ?? ''),
    appearance: String(parsed.appearance ?? ''),
    style: String(parsed.style ?? ''),
    voice: String(parsed.voice ?? ''),
    niches: Array.isArray(parsed.niches) ? parsed.niches.map(String) : [],
    promptBase: String(parsed.promptBase ?? ''),
  };
}

function toView(model: VirtualModel): ModelView {
  return {
    model,
    persona: parsePersona(model.personaJson),
    portraitUrl: model.portraitKey ? `/media/${model.portraitKey}` : null,
  };
}

export async function listActiveModels(): Promise<ModelView[]> {
  const rows = await getDb(env.DB)
    .select()
    .from(virtualModels)
    .where(eq(virtualModels.active, 1))
    .orderBy(asc(virtualModels.sortOrder));
  return rows.map(toView);
}

export async function getModel(id: string): Promise<ModelView | null> {
  const rows = await getDb(env.DB).select().from(virtualModels).where(eq(virtualModels.id, id)).limit(1);
  return rows[0] ? toView(rows[0]) : null;
}

export async function getModelBySlug(slug: string): Promise<ModelView | null> {
  const rows = await getDb(env.DB)
    .select()
    .from(virtualModels)
    .where(eq(virtualModels.slug, slug))
    .limit(1);
  return rows[0] ? toView(rows[0]) : null;
}

export async function setPortrait(id: string, portraitKey: string): Promise<void> {
  await getDb(env.DB).update(virtualModels).set({ portraitKey }).where(eq(virtualModels.id, id));
}

/** Màu nền cho ô chữ cái khi người mẫu chưa có ảnh đại diện. */
export const MODEL_PLACEHOLDER_CLASS: Record<string, string> = {
  linh: 'bg-clay-200 text-clay-800',
  minh: 'bg-ink-700 text-cream-100',
  thao: 'bg-sage-300 text-sage-700',
  khoa: 'bg-ink-900 text-cream-100',
  an: 'bg-candle text-ink-900',
};
