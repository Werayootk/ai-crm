import type { Activity, ActivityCreateInput, AuthUser, Page, TimelineItem } from '@ai-crm/shared';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound } from '../../http/errors';
import { decodeTimeCursor, encodeTimeCursor, type TimeCursor } from '../../http/pagination';
import { activitySelect, messageSelect, toActivity, toMessage } from '../mappers';

async function assertLeadExists(prisma: PrismaClient, leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw notFound('Lead');
}

/** เงื่อนไข "เก่ากว่า cursor" ตามลำดับ (createdAt desc, id desc) */
function olderThan(cursor: TimeCursor | undefined) {
  return cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : {};
}

function newestFirst(
  a: { createdAt: Date; id: string },
  b: { createdAt: Date; id: string },
): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * รวม activity + message ของ lead เรียงใหม่ → เก่า (keyset pagination ข้าม 2 ตาราง)
 * ดึงแต่ละตารางมา limit + 1 แถว แล้ว merge — top `limit` ของผลรวมจึงถูกต้องเสมอ
 */
export async function getTimeline(
  prisma: PrismaClient,
  leadId: string,
  query: { limit: number; cursor?: string | undefined },
): Promise<Page<TimelineItem>> {
  await assertLeadExists(prisma, leadId);
  const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
  const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const [activities, messages, activityCount, messageCount] = await Promise.all([
    prisma.activity.findMany({
      where: { leadId, ...olderThan(cursor) },
      select: activitySelect,
      orderBy,
      take: query.limit + 1,
    }),
    prisma.message.findMany({
      where: { leadId, ...olderThan(cursor) },
      select: messageSelect,
      orderBy,
      take: query.limit + 1,
    }),
    prisma.activity.count({ where: { leadId } }),
    prisma.message.count({ where: { leadId } }),
  ]);

  const merged = [
    ...activities.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      item: { kind: 'activity' as const, ...toActivity(row) },
    })),
    ...messages.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      item: { kind: 'message' as const, ...toMessage(row) },
    })),
  ].sort(newestFirst);

  const page = merged.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((entry) => entry.item),
    nextCursor: merged.length > query.limit && last ? encodeTimeCursor(last) : null,
    total: activityCount + messageCount,
  };
}

export async function addActivity(
  prisma: PrismaClient,
  leadId: string,
  input: ActivityCreateInput,
  actor: AuthUser,
): Promise<Activity> {
  await assertLeadExists(prisma, leadId);
  const row = await prisma.activity.create({
    data: {
      leadId,
      type: input.type,
      body: input.body,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      actorId: actor.id,
    },
    select: activitySelect,
  });
  return toActivity(row);
}

/** activity เป็น append-only — ข้อยกเว้นเดียวคือ mark TASK ว่าเสร็จ (ครั้งเดียว) */
export async function completeTask(prisma: PrismaClient, activityId: string): Promise<Activity> {
  const { count } = await prisma.activity.updateMany({
    where: { id: activityId, type: 'TASK', completedAt: null },
    data: { completedAt: new Date() },
  });
  const row = await prisma.activity.findUnique({
    where: { id: activityId },
    select: activitySelect,
  });
  if (!row) throw notFound('Activity');
  if (count === 0) {
    throw new HttpError(
      409,
      'CONFLICT',
      row.type === 'TASK' ? 'Task is already completed' : 'Only TASK activities can be completed',
    );
  }
  return toActivity(row);
}
