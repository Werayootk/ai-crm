import { opsSummarySchema } from '@ai-crm/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { getOpsSummary } from './ops.service';

const prisma = createTestPrisma();

beforeAll(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedSignals() {
  const contact = await createContact(prisma, { lineUserId: `Uops${Date.now()}` });
  const lead = await createLeadRow(prisma, { contactId: contact.id, source: 'LINE' });
  const now = Date.now();
  await prisma.webhookEvent.createMany({
    data: [
      {
        eventId: `ops-failed-${now}`,
        type: 'message',
        payload: {},
        status: 'FAILED',
        nextRetryAt: new Date(now + 60_000),
      },
      {
        eventId: `ops-gaveup-${now}`,
        type: 'message',
        payload: {},
        status: 'FAILED',
        nextRetryAt: null,
      },
      {
        eventId: `ops-stuck-${now}`,
        type: 'message',
        payload: {},
        status: 'RECEIVED',
        receivedAt: new Date(now - 10 * 60_000),
      },
      { eventId: `ops-fresh-${now}`, type: 'message', payload: {}, status: 'RECEIVED' },
    ],
  });
  await prisma.message.create({
    data: {
      leadId: lead.id,
      contactId: contact.id,
      direction: 'OUTBOUND',
      channel: 'LINE',
      status: 'FAILED',
      text: 'ส่งไม่ออก',
    },
  });
  const suggestion = {
    leadId: lead.id,
    type: 'QUALIFICATION' as const,
    payload: {},
    promptVersion: 'test',
  };
  await prisma.aiSuggestion.createMany({
    data: [
      {
        ...suggestion,
        source: 'LLM',
        aiModel: 'claude-sonnet-5',
        latencyMs: 4_000,
        status: 'APPROVED',
      },
      {
        ...suggestion,
        source: 'LLM',
        aiModel: 'claude-sonnet-5',
        latencyMs: 6_000,
        status: 'REJECTED',
      },
      {
        ...suggestion,
        source: 'FALLBACK',
        fallbackReason: 'timeout',
        latencyMs: 25_000,
        status: 'PENDING',
      },
    ],
  });
}

describe('ops summary', () => {
  it('counts the signals worth alerting on', async () => {
    await seedSignals();

    const summary = await getOpsSummary(prisma);

    expect(summary.line).toEqual({
      failedEvents: 1,
      gaveUpEvents: 1,
      stuckEvents: 1,
      failedMessages: 1,
    });
    // 1 ใน 3 ครั้งใช้กติกาสำรอง, เวลาเฉลี่ยนับเฉพาะครั้งที่ Claude ตอบ
    expect(summary.ai).toEqual({
      requests: 3,
      fallbackRate: 0.333,
      avgLlmLatencyMs: 5_000,
      pendingApprovals: 1,
    });
    expect(summary.leads.unassignedNew).toBe(1);
  });

  it('is available to admins only', async () => {
    const app = await createTestApp(prisma);
    const sales = await loginAs(app, await createUser(prisma));
    const admin = await loginAs(app, await createUser(prisma, { role: 'ADMIN' }));

    expect((await sales.get('/api/ops/summary')).status).toBe(403);
    const res = await admin.get('/api/ops/summary');
    expect(res.status).toBe(200);
    expect(opsSummarySchema.safeParse(res.body).success).toBe(true);
  });
});
