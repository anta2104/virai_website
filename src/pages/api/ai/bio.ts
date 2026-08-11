import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db';
import { memorials } from '../../../lib/db/schema';
import { getOwnedMemorial } from '../../../lib/memorials';
import { generateBio, STORY_QUESTIONS, type StoryNotes } from '../../../lib/ai';
import { jsonResponse } from '../../../lib/guards';
import { env } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonResponse({ ok: false, error: 'Bạn cần đăng nhập.' }, 401);


  let payload: { memorialId?: string; notes?: Record<string, unknown> };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ ok: false, error: 'Dữ liệu gửi lên không đọc được.' }, 400);
  }

  const memorial = await getOwnedMemorial(env.DB, String(payload.memorialId ?? ''), user.id);
  if (!memorial) {
    return jsonResponse({ ok: false, error: 'Không tìm thấy trang kỷ niệm.' }, 404);
  }

  const notes: StoryNotes = {};
  for (const question of STORY_QUESTIONS) {
    const value = payload.notes?.[question.key];
    if (typeof value === 'string' && value.trim()) {
      notes[question.key] = value.trim().slice(0, 1200);
    }
  }

  // Lưu ghi chú trước khi gọi AI để người dùng không mất công đã nhập
  const db = getDb(env.DB);
  await db
    .update(memorials)
    .set({ storyNotes: JSON.stringify(notes), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(memorials.id, memorial.id));

  const result = await generateBio(env, {
    userId: user.id,
    isPremium: Boolean(memorial.isPremium),
    context: {
      petName: memorial.petName,
      species: memorial.species,
      breed: memorial.breed,
      birthDate: memorial.birthDate,
      deathDate: memorial.deathDate,
      notes,
    },
  });

  return jsonResponse(result, result.ok ? 200 : 400);
};
