import { createMockProvider } from '@ai-crm/crm-copilot';
import {
  aiSuggestionDecisionSchema,
  aiSuggestionListSchema,
  apiErrorResponseSchema,
  type AiSuggestion,
  type AuthUser,
} from '@ai-crm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { createMockLineClient } from '../line/mock-line-client';

// ───────── Required test #2: AI skill behavior / fallback + approval flow ─────────

const prisma = createTestPrisma();
let sales: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma, { name: 'AI Tester' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** lead ที่ลูกค้าทักมาทาง LINE และยังไม่มีใครตอบ */
async function leadWaitingOnLine(options: { withLine?: boolean } = {}) {
  const contact = await createContact(prisma, {
    name: 'คุณลูกค้า ทดสอบ',
    ...(options.withLine === false
      ? {}
      : { lineUserId: `U${Date.now()}${Math.random().toString(16).slice(2, 10)}` }),
  });
  const lead = await createLeadRow(prisma, {
    contactId: contact.id,
    stage: 'QUALIFIED',
    ownerId: sales.id,
    score: 40,
    value: 800_000,
  });
  await prisma.message.create({
    data: {
      leadId: lead.id,
      contactId: contact.id,
      direction: 'INBOUND',
      channel: 'LINE',
      status: 'RECEIVED',
      text: 'สนใจทำระบบสมาชิก รบกวนติดต่อกลับด้วย',
    },
  });
  return { lead, contact };
}

function byType<T extends AiSuggestion['type']>(items: AiSuggestion[], type: T) {
  const found = items.find((item) => item.type === type);
  if (!found) throw new Error(`no ${type} suggestion`);
  return found as Extract<AiSuggestion, { type: T }>;
}

async function snapshot(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { score: true, summary: true, stage: true },
  });
  return {
    lead,
    outbound: await prisma.message.count({ where: { leadId, direction: 'OUTBOUND' } }),
    activities: await prisma.activity.count({ where: { leadId } }),
  };
}

describe('asking the AI', () => {
  it('stores Claude-unavailable results as FALLBACK suggestions and changes nothing else', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider({ kind: 'error' }), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const before = await snapshot(lead.id);
    const agent = await loginAs(app, sales);

    const res = await agent.post(`/api/leads/${lead.id}/ai-suggestions`);
    expect(res.status).toBe(201);
    const { items } = aiSuggestionListSchema.parse(res.body);
    expect(items.map((item) => item.type).sort()).toEqual([
      'LINE_REPLY',
      'NEXT_ACTION',
      'QUALIFICATION',
    ]);
    for (const item of items) {
      expect(item).toMatchObject({
        status: 'PENDING',
        source: 'FALLBACK',
        fallbackReason: 'provider_error',
        aiModel: null,
        requestedBy: { id: sales.id },
      });
    }
    // ยังไม่มีอะไรเปลี่ยนจนกว่าจะมีคนอนุมัติ
    expect(await snapshot(lead.id)).toEqual(before);
  });

  it('falls back with reason timeout when the model does not answer in time', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider({ kind: 'hang' }), timeoutMs: 50 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    expect(items.every((item) => item.fallbackReason === 'timeout')).toBe(true);
  });

  it('does not draft a LINE reply when the contact has no LINE', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine({ withLine: false });
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    expect(items.map((item) => item.type).sort()).toEqual(['NEXT_ACTION', 'QUALIFICATION']);
    expect(items[0]).toMatchObject({ source: 'LLM', aiModel: 'mock-model' });
  });

  it('requires login', async () => {
    const app = await createTestApp(prisma);
    const { lead } = await leadWaitingOnLine();
    expect((await request(app).post(`/api/leads/${lead.id}/ai-suggestions`)).status).toBe(401);
  });
});

describe('approving and rejecting', () => {
  it('writes the approved score and summary, keeps both versions and records the change', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const qualification = byType(items, 'QUALIFICATION');

    const res = await agent
      .post(`/api/ai-suggestions/${qualification.id}/approve`)
      .send({ score: 66 }); // คนแก้คะแนนก่อนอนุมัติ
    expect(res.status).toBe(200);
    const decision = aiSuggestionDecisionSchema.parse(res.body);
    expect(decision.suggestion).toMatchObject({
      status: 'APPROVED',
      reviewedBy: { id: sales.id },
      finalPayload: { score: 66, summary: qualification.payload.summary },
    });
    expect(decision.suggestion.payload).toEqual(qualification.payload); // สิ่งที่ AI เสนอยังเก็บไว้

    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated).toMatchObject({ score: 66, summary: qualification.payload.summary });
    const audit = await prisma.activity.findFirstOrThrow({
      where: { leadId: lead.id, type: 'AI_APPROVED' },
    });
    expect(audit).toMatchObject({
      actorId: sales.id,
      metadata: {
        suggestionId: qualification.id,
        suggestionType: 'QUALIFICATION',
        edited: true,
        changes: { score: { from: 40, to: 66 } },
      },
    });
  });

  it('turns an approved next action into a task', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const action = byType(items, 'NEXT_ACTION');
    const dueAt = '2026-12-01T03:00:00.000Z';

    await agent.post(`/api/ai-suggestions/${action.id}/approve`).send({ dueAt }).expect(200);
    const task = await prisma.activity.findFirstOrThrow({
      where: { leadId: lead.id, type: 'TASK' },
    });
    expect(task).toMatchObject({ body: action.payload.action, actorId: sales.id });
    expect(task.dueAt?.toISOString()).toBe(dueAt);
  });

  it('sends an approved (edited) LINE reply once, linked back to the suggestion', async () => {
    const line = createMockLineClient();
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
      line,
    });
    const { lead, contact } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const reply = byType(items, 'LINE_REPLY');
    const text = 'ขอบคุณที่สนใจ ขอนัดคุยรายละเอียดวันพฤหัสนี้ได้ไหม';

    const decision = aiSuggestionDecisionSchema.parse(
      (await agent.post(`/api/ai-suggestions/${reply.id}/approve`).send({ text })).body,
    );
    expect(decision.message).toMatchObject({
      direction: 'OUTBOUND',
      status: 'SENT',
      text,
      fromAiSuggestion: true,
      sentBy: { id: sales.id },
    });
    expect(line.sent).toHaveLength(1);
    expect(line.sent[0]).toMatchObject({ to: contact.lineUserId, text });
    expect(line.sent[0]?.retryKey).toMatch(/^[0-9a-f-]{36}$/);

    // กดซ้ำ = 409 และไม่ส่งซ้ำ
    const again = await agent.post(`/api/ai-suggestions/${reply.id}/approve`).send({});
    expect(again.status).toBe(409);
    expect(line.sent).toHaveLength(1);
  });

  it('records a failed LINE delivery without losing the approval', async () => {
    const line = createMockLineClient();
    line.failNext(3); // ล้มทุกครั้งที่ลอง (1 + retry 2)
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
      line,
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const decision = aiSuggestionDecisionSchema.parse(
      (await agent.post(`/api/ai-suggestions/${byType(items, 'LINE_REPLY').id}/approve`).send({}))
        .body,
    );
    expect(decision.suggestion.status).toBe('APPROVED');
    expect(decision.message).toMatchObject({ status: 'FAILED' });
    const stored = await prisma.message.findFirstOrThrow({
      where: { leadId: lead.id, direction: 'OUTBOUND' },
    });
    expect(stored).toMatchObject({ status: 'FAILED', attempts: 3 });
    expect(stored.lastError).toBeTruthy();
    expect(line.sent).toHaveLength(0);
  });

  it('rejects with a reason, and a rejected suggestion can no longer be approved', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const qualification = byType(items, 'QUALIFICATION');
    const before = await snapshot(lead.id);

    const rejected = aiSuggestionDecisionSchema.parse(
      (
        await agent
          .post(`/api/ai-suggestions/${qualification.id}/reject`)
          .send({ reason: 'คะแนนสูงเกินจริง' })
      ).body,
    );
    expect(rejected.suggestion).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'คะแนนสูงเกินจริง',
    });
    expect((await snapshot(lead.id)).lead).toEqual(before.lead);
    expect(await prisma.activity.count({ where: { leadId: lead.id, type: 'AI_REJECTED' } })).toBe(
      1,
    );

    const late = await agent.post(`/api/ai-suggestions/${qualification.id}/approve`).send({});
    expect(late.status).toBe(409);
  });

  it('supersedes pending suggestions when the AI is asked again', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const first = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    await agent.post(`/api/leads/${lead.id}/ai-suggestions`).expect(201);

    const stale = await agent
      .post(`/api/ai-suggestions/${byType(first.items, 'QUALIFICATION').id}/approve`)
      .send({});
    expect(stale.status).toBe(409);
    const pending = aiSuggestionListSchema.parse(
      (await agent.get(`/api/leads/${lead.id}/ai-suggestions`).query({ status: 'PENDING' })).body,
    );
    expect(pending.items).toHaveLength(3);
    expect(
      await prisma.aiSuggestion.count({ where: { leadId: lead.id, status: 'SUPERSEDED' } }),
    ).toBe(3);
  });

  it('only accepts fields that belong to the suggestion type', async () => {
    const app = await createTestApp(prisma, {
      copilot: { provider: createMockProvider(), timeoutMs: 1_000 },
    });
    const { lead } = await leadWaitingOnLine();
    const agent = await loginAs(app, sales);
    const { items } = aiSuggestionListSchema.parse(
      (await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).body,
    );
    const res = await agent
      .post(`/api/ai-suggestions/${byType(items, 'QUALIFICATION').id}/approve`)
      .send({ text: 'not a reply suggestion' });
    expect(res.status).toBe(400);
    expect(apiErrorResponseSchema.parse(res.body).error.details).toEqual({
      issues: [{ path: 'text', message: 'Not editable for QUALIFICATION suggestions' }],
    });
    const unknownField = await agent
      .post(`/api/ai-suggestions/${byType(items, 'QUALIFICATION').id}/approve`)
      .send({ stage: 'WON' });
    expect(unknownField.status).toBe(400);
  });
});
