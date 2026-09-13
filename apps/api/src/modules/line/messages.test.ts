import { apiErrorResponseSchema, messageSchema, type AuthUser } from '@ai-crm/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { LineApiError } from './line-client';
import { createMockLineClient } from './mock-line-client';

const prisma = createTestPrisma();
let sales: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma, { name: 'LINE Sender' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function lineLead(options: { linked?: boolean } = {}) {
  const contact = await createContact(prisma, {
    ...(options.linked === false ? {} : { lineUserId: `U${randomBytes(16).toString('hex')}` }),
  });
  return createLeadRow(prisma, { contactId: contact.id, source: 'LINE', ownerId: sales.id });
}

async function setup() {
  const line = createMockLineClient();
  const app = await createTestApp(prisma, { line });
  const agent = await loginAs(app, sales);
  return { app, line, agent };
}

describe('sending a LINE message typed by a person', () => {
  it('sends it, records who sent it, and supersedes the pending AI reply draft', async () => {
    const { line, agent } = await setup();
    const lead = await lineLead();
    await prisma.message.create({
      data: {
        leadId: lead.id,
        contactId: lead.contactId,
        direction: 'INBOUND',
        channel: 'LINE',
        status: 'RECEIVED',
        text: 'ยังรอคำตอบอยู่นะครับ',
      },
    });
    expect((await agent.post(`/api/leads/${lead.id}/ai-suggestions`)).status).toBe(201);

    const res = await agent
      .post(`/api/leads/${lead.id}/messages`)
      .send({ text: 'ขอบคุณที่รอครับ จะส่งรายละเอียดให้ภายในวันนี้' });

    expect(res.status).toBe(201);
    expect(messageSchema.parse(res.body)).toMatchObject({
      direction: 'OUTBOUND',
      status: 'SENT',
      sentBy: { id: sales.id },
      fromAiSuggestion: false,
      lastError: null,
    });
    expect(line.sent).toHaveLength(1);

    const drafts = await prisma.aiSuggestion.findMany({
      where: { leadId: lead.id },
      select: { type: true, status: true },
    });
    expect(drafts).toContainEqual({ type: 'LINE_REPLY', status: 'SUPERSEDED' });
    expect(drafts).toContainEqual({ type: 'QUALIFICATION', status: 'PENDING' });
  });

  it('refuses when the contact is not linked to LINE', async () => {
    const { line, agent } = await setup();
    const lead = await lineLead({ linked: false });

    const res = await agent.post(`/api/leads/${lead.id}/messages`).send({ text: 'สวัสดีครับ' });

    expect(res.status).toBe(409);
    expect(await prisma.message.count({ where: { leadId: lead.id } })).toBe(0);
    expect(line.sent).toHaveLength(0);
  });

  it('validates the text and requires login', async () => {
    const { app, agent } = await setup();
    const lead = await lineLead();

    const blank = await agent.post(`/api/leads/${lead.id}/messages`).send({ text: '   ' });
    const tooLong = await agent
      .post(`/api/leads/${lead.id}/messages`)
      .send({ text: 'ก'.repeat(2_001) });
    const extra = await agent
      .post(`/api/leads/${lead.id}/messages`)
      .send({ text: 'สวัสดี', status: 'SENT' });
    const anonymous = await request(app)
      .post(`/api/leads/${lead.id}/messages`)
      .send({ text: 'สวัสดี' });

    expect([blank.status, tooLong.status, extra.status, anonymous.status]).toEqual([
      400, 400, 400, 401,
    ]);
    expect(apiErrorResponseSchema.parse(blank.body).error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.message.count({ where: { leadId: lead.id } })).toBe(0);
  });
});

describe('LINE delivery failures and retries', () => {
  it('marks the message FAILED after automatic retries, then a manual retry reuses the same retry key', async () => {
    const { line, agent } = await setup();
    const lead = await lineLead();
    line.failNext(3); // ครั้งแรก + retry อัตโนมัติ 2 ครั้ง

    const sent = await agent.post(`/api/leads/${lead.id}/messages`).send({ text: 'ทดสอบส่ง' });
    expect(sent.status).toBe(201);
    const failed = messageSchema.parse(sent.body);
    expect(failed).toMatchObject({ status: 'FAILED', lastError: 'LINE API unavailable (mock)' });
    expect(line.sent).toHaveLength(0);

    const retried = await agent.post(`/api/messages/${failed.id}/retry`);
    expect(retried.status).toBe(200);
    expect(messageSchema.parse(retried.body)).toMatchObject({ status: 'SENT', lastError: null });

    const row = await prisma.message.findUniqueOrThrow({ where: { id: failed.id } });
    expect(row.attempts).toBe(4);
    expect(line.sent).toHaveLength(1);
    expect(line.sent[0]).toMatchObject({ text: 'ทดสอบส่ง', retryKey: row.retryKey });

    expect((await agent.post(`/api/messages/${failed.id}/retry`)).status).toBe(409);
    expect((await agent.post('/api/messages/does-not-exist/retry')).status).toBe(404);
  });

  it('never delivers twice when LINE accepted the message but the response was lost', async () => {
    const { line, agent } = await setup();
    const lead = await lineLead();
    line.failNext(1, new LineApiError('LINE request failed: timeout', null, true), {
      afterAccept: true,
    });

    const res = await agent.post(`/api/leads/${lead.id}/messages`).send({ text: 'ส่งครั้งเดียว' });

    expect(messageSchema.parse(res.body).status).toBe('SENT');
    expect(line.sent).toHaveLength(1); // retry ด้วย key เดิม → LINE ไม่ส่งซ้ำ
    const row = await prisma.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(row.attempts).toBe(2);
  });

  it('does not retry errors that retrying cannot fix', async () => {
    const { line, agent } = await setup();
    const lead = await lineLead();
    line.failNext(1, new LineApiError('LINE push 400: Invalid reply token', 400, false));

    const res = await agent.post(`/api/leads/${lead.id}/messages`).send({ text: 'ข้อความ' });

    expect(messageSchema.parse(res.body)).toMatchObject({
      status: 'FAILED',
      lastError: 'LINE push 400: Invalid reply token',
    });
    const row = await prisma.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(row.attempts).toBe(1);
  });
});
