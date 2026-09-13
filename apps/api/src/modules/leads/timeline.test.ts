import {
  activitySchema,
  apiErrorResponseSchema,
  timelinePageSchema,
  type AuthUser,
  type TimelineItem,
} from '@ai-crm/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';

const prisma = createTestPrisma();
const app = createTestApp(prisma);
let sales: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function newLead() {
  const contact = await createContact(prisma);
  const lead = await createLeadRow(prisma, { contactId: contact.id });
  return { lead, contact };
}

describe('GET /api/leads/:id/timeline', () => {
  it('merges activities and messages newest first and pages through both tables without gaps', async () => {
    const { lead, contact } = await newLead();
    const base = Date.parse('2026-09-01T09:00:00.000Z');
    const at = (minutes: number) => new Date(base + minutes * 60_000);

    // สลับ activity / message ในเวลาต่างกัน (มี 2 รายการเวลาเดียวกันเพื่อทดสอบ tie-break)
    await prisma.activity.createMany({
      data: [0, 2, 4, 6].map((minute) => ({
        leadId: lead.id,
        type: 'NOTE' as const,
        body: `note ${minute}`,
        createdAt: at(minute),
      })),
    });
    await prisma.message.createMany({
      data: [1, 3, 5, 6].map((minute) => ({
        leadId: lead.id,
        contactId: contact.id,
        direction: 'INBOUND' as const,
        channel: 'LINE' as const,
        status: 'RECEIVED' as const,
        text: `message ${minute}`,
        createdAt: at(minute),
      })),
    });

    const agent = await loginAs(app, sales);
    const seen: TimelineItem[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await agent
        .get(`/api/leads/${lead.id}/timeline`)
        .query({ limit: '3', ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      const page = timelinePageSchema.parse(res.body);
      expect(page.total).toBe(8);
      seen.push(...page.items);
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(8);
    expect(new Set(seen.map((item) => item.id)).size).toBe(8);
    const times = seen.map((item) => Date.parse(item.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(seen.map((item) => item.kind)).toContain('message');
  });

  it('rejects a malformed cursor and an unknown lead', async () => {
    const { lead } = await newLead();
    const agent = await loginAs(app, sales);

    const badCursor = await agent
      .get(`/api/leads/${lead.id}/timeline`)
      .query({ cursor: 'garbage' });
    expect(badCursor.status).toBe(400);
    expect(apiErrorResponseSchema.parse(badCursor.body).error.code).toBe('VALIDATION_ERROR');

    expect((await agent.get('/api/leads/missing/timeline')).status).toBe(404);
  });
});

describe('activities', () => {
  it('adds a note and a task with the actor recorded', async () => {
    const { lead } = await newLead();
    const agent = await loginAs(app, sales);

    const note = await agent
      .post(`/api/leads/${lead.id}/activities`)
      .send({ type: 'CALL', body: 'โทรคุยเบื้องต้น ลูกค้าสนใจ' });
    expect(note.status).toBe(201);
    expect(activitySchema.parse(note.body)).toMatchObject({
      type: 'CALL',
      actor: { id: sales.id },
      dueAt: null,
    });

    const task = await agent
      .post(`/api/leads/${lead.id}/activities`)
      .send({ type: 'TASK', body: 'ส่งใบเสนอราคา', dueAt: '2026-10-01T09:00:00.000Z' });
    expect(activitySchema.parse(task.body)).toMatchObject({
      type: 'TASK',
      dueAt: '2026-10-01T09:00:00.000Z',
      completedAt: null,
    });
  });

  it('refuses system-only activity types and dueAt on non-tasks', async () => {
    const { lead } = await newLead();
    const agent = await loginAs(app, sales);
    for (const body of [
      { type: 'STAGE_CHANGE', body: 'forged' },
      { type: 'AI_APPROVED', body: 'forged' },
      { type: 'NOTE', body: 'x', dueAt: '2026-10-01T09:00:00.000Z' },
    ]) {
      expect((await agent.post(`/api/leads/${lead.id}/activities`).send(body)).status).toBe(400);
    }
  });

  it('completes a task once; completing it again or completing a note is a conflict', async () => {
    const { lead } = await newLead();
    const agent = await loginAs(app, sales);
    const task = activitySchema.parse(
      (
        await agent
          .post(`/api/leads/${lead.id}/activities`)
          .send({ type: 'TASK', body: 'follow up' })
      ).body,
    );
    const note = activitySchema.parse(
      (await agent.post(`/api/leads/${lead.id}/activities`).send({ type: 'NOTE', body: 'note' }))
        .body,
    );

    const done = await agent.patch(`/api/activities/${task.id}/complete`);
    expect(done.status).toBe(200);
    expect(activitySchema.parse(done.body).completedAt).not.toBeNull();

    expect((await agent.patch(`/api/activities/${task.id}/complete`)).status).toBe(409);
    expect((await agent.patch(`/api/activities/${note.id}/complete`)).status).toBe(409);
    expect((await agent.patch('/api/activities/missing/complete')).status).toBe(404);
  });
});
