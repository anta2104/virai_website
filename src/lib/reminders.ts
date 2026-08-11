import { and, eq, lte } from 'drizzle-orm';
import { getDb } from './db';
import { memorials, reminders, users, type Memorial, type Reminder } from './db/schema';
import { milestonesFor } from './memorial-dates';
import { newId } from './ids';
import { addDays, nextAnniversary } from './lunar';
import { todayInVietnam } from './format';

/**
 * Tạo/cập nhật lịch nhắc của một trang kỷ niệm dựa trên ngày mất.
 * Gọi mỗi khi ngày mất thay đổi hoặc khi xuất bản trang.
 */
export async function ensureRemindersFor(d1: D1Database, memorial: Memorial): Promise<void> {
  const db = getDb(d1);
  const existing = await db.select().from(reminders).where(eq(reminders.memorialId, memorial.id));
  const byType = new Map(existing.map((reminder) => [reminder.type, reminder]));

  if (!memorial.deathDate) {
    if (existing.length > 0) {
      await db.delete(reminders).where(eq(reminders.memorialId, memorial.id));
    }
    return;
  }

  const today = todayInVietnam();
  const milestones = milestonesFor(memorial.deathDate, today);

  for (const milestone of milestones) {
    const current = byType.get(milestone.key);

    // Mốc một lần đã qua thì không cần nhắc nữa
    if (milestone.passed && milestone.key !== 'gio_hang_nam') {
      if (current) {
        await db.update(reminders).set({ enabled: 0 }).where(eq(reminders.id, current.id));
      }
      continue;
    }

    if (current) {
      await db
        .update(reminders)
        .set({ nextDate: milestone.date, label: milestone.label })
        .where(eq(reminders.id, current.id));
    } else {
      await db.insert(reminders).values({
        id: newId(),
        memorialId: memorial.id,
        type: milestone.key,
        nextDate: milestone.date,
        label: milestone.label,
        enabled: 1,
      });
    }
  }
}

export interface DueReminder {
  reminder: Reminder;
  memorial: Memorial;
  ownerEmail: string;
  ownerName: string;
}

/** Số ngày gửi email trước mốc tưởng niệm, để gia đình còn kịp chuẩn bị. */
export const REMINDER_LEAD_DAYS = 3;

/**
 * Các lời nhắc sắp đến hạn (trong vòng REMINDER_LEAD_DAYS ngày) của những trang
 * Premium đã xuất bản. Chỉ gói Premium nhận email nhắc — đây là quyền lợi trả phí.
 */
export async function dueReminders(d1: D1Database, today = todayInVietnam()): Promise<DueReminder[]> {
  const db = getDb(d1);
  const cutoff = addDays(today, REMINDER_LEAD_DAYS);
  const rows = await db
    .select({ reminder: reminders, memorial: memorials, user: users })
    .from(reminders)
    .innerJoin(memorials, eq(memorials.id, reminders.memorialId))
    .innerJoin(users, eq(users.id, memorials.userId))
    .where(
      and(
        eq(reminders.enabled, 1),
        lte(reminders.nextDate, cutoff),
        eq(memorials.isPremium, 1),
        eq(memorials.isPublished, 1),
      ),
    );

  return rows.map((row) => ({
    reminder: row.reminder,
    memorial: row.memorial,
    ownerEmail: row.user.email,
    ownerName: row.user.name,
  }));
}

/**
 * Sau khi gửi xong: mốc một lần thì tắt, giỗ hằng năm thì dời sang lần sau.
 */
export async function advanceReminder(
  d1: D1Database,
  due: DueReminder,
  sentAt = Math.floor(Date.now() / 1000),
): Promise<void> {
  const db = getDb(d1);

  if (due.reminder.type !== 'gio_hang_nam' || !due.memorial.deathDate) {
    await db
      .update(reminders)
      .set({ enabled: 0, lastSentAt: sentAt })
      .where(eq(reminders.id, due.reminder.id));
    return;
  }

  // Tính lần giỗ tiếp theo, mốc bắt đầu là ngày sau mốc vừa gửi
  const dayAfter = addDays(due.reminder.nextDate, 1);
  const next = nextAnniversary(due.memorial.deathDate, dayAfter);
  if (!next) {
    await db
      .update(reminders)
      .set({ enabled: 0, lastSentAt: sentAt })
      .where(eq(reminders.id, due.reminder.id));
    return;
  }

  const ordinal = next.yearsSince === 1 ? 'Giỗ đầu' : `Giỗ năm thứ ${next.yearsSince}`;
  await db
    .update(reminders)
    .set({
      nextDate: next.date,
      label: `${ordinal} — ${String(next.lunar.day).padStart(2, '0')}/${String(next.lunar.month).padStart(2, '0')} âm lịch`,
      lastSentAt: sentAt,
    })
    .where(eq(reminders.id, due.reminder.id));
}

/** Bật/tắt toàn bộ lời nhắc của một trang. */
export async function setRemindersEnabled(
  d1: D1Database,
  memorialId: string,
  enabled: boolean,
): Promise<void> {
  await getDb(d1)
    .update(reminders)
    .set({ enabled: enabled ? 1 : 0 })
    .where(eq(reminders.memorialId, memorialId));
}

export async function listRemindersOf(d1: D1Database, memorialId: string): Promise<Reminder[]> {
  return getDb(d1).select().from(reminders).where(eq(reminders.memorialId, memorialId));
}
