import { apiErrorResponseSchema, webhookEventListSchema, webhookEventSchema } from '@ai-crm/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TEST_LINE_SECRET,
  createTestApp,
  createUser,
  loginAs,
  silentLogger,
  type TestApp,
} from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { generateSuggestions } from '../ai/suggestions.service';
import { LineApiError } from './line-client';
import { createMockLineClient } from './mock-line-client';
import { signLineBody } from './signature';
import { createWebhookProcessor, type WebhookProcessorDeps } from './webhook-processor';
import { processWebhookEvent } from './webhook.service';

// ───────── Required test #3: LINE webhook security / idempotency ─────────

const prisma = createTestPrisma();

beforeAll(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

let sequence = 0;

function newLineUserId(): string {
  return `U${randomBytes(16).toString('hex')}`;
}

/** event ข้อความตามรูปแบบ webhook ของ LINE */
function messageEvent(
  options: {
    userId?: string;
    eventId?: string;
    messageId?: string;
    text?: string;
    messageType?: string;
    redelivery?: boolean;
  } = {},
) {
  sequence += 1;
  const messageType = options.messageType ?? 'text';
  return {
    type: 'message',
    mode: 'active',
    timestamp: Date.now(),
    source: { type: 'user', userId: options.userId ?? newLineUserId() },
    webhookEventId: options.eventId ?? `01JTEST${Date.now()}${sequence}`,
    deliveryContext: { isRedelivery: options.redelivery ?? false },
    replyToken: 'reply-token-not-used',
    message: {
      id: options.messageId ?? `${Date.now()}${sequence}`,
      type: messageType,
      ...(messageType === 'text'
        ? { text: options.text ?? 'สวัสดีครับ สนใจทำเว็บไซต์ใหม่', quoteToken: 'q' }
        : {}),
    },
  };
}

function webhookBody(...events: object[]) {
  return { destination: 'U0000000000000000000000000000bot0', events };
}

/** ส่ง body แบบ string ตรงตัว — ลายเซ็นต้องคิดจาก byte เดียวกับที่ส่ง */
function postWebhook(app: TestApp, body: object, signature?: string) {
  const raw = JSON.stringify(body);
  return request(app)
    .post('/api/webhooks/line')
    .set('content-type', 'application/json')
    .set('x-line-signature', signature ?? signLineBody(raw, TEST_LINE_SECRET))
    .send(raw);
}

/** app + LINE จำลอง + คิวที่ให้ AI (กติกาสำรอง) ร่างคำตอบเหมือนตอนรันจริง */
async function lineStack(options: Pick<WebhookProcessorDeps, 'processEvent'> = {}) {
  const line = createMockLineClient();
  const webhooks = createWebhookProcessor({
    prisma,
    logger: silentLogger,
    line,
    requestDraft: async (leadId) => {
      const copilot = { provider: null, timeoutMs: 1_000 };
      await generateSuggestions({ prisma, logger: silentLogger, copilot, line }, leadId, null);
    },
    ...options,
  });
  const app = await createTestApp(prisma, { line, webhooks });
  return { app, line, webhooks };
}

async function counts() {
  return {
    events: await prisma.webhookEvent.count(),
    messages: await prisma.message.count(),
    contacts: await prisma.contact.count(),
    leads: await prisma.lead.count(),
  };
}

describe('LINE webhook security', () => {
  it('rejects a request signed with the wrong secret and stores nothing', async () => {
    const { app } = await lineStack();
    const body = webhookBody(messageEvent());
    const before = await counts();

    const res = await postWebhook(
      app,
      body,
      signLineBody(JSON.stringify(body), 'someone-elses-secret'),
    );

    expect(res.status).toBe(401);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('INVALID_SIGNATURE');
    expect(await counts()).toEqual(before);
  });

  it('rejects a missing signature and a body changed after signing', async () => {
    const { app } = await lineStack();
    const original = webhookBody(messageEvent({ text: 'ขอราคา 10,000 บาท' }));
    const tampered = webhookBody(messageEvent({ text: 'ขอราคา 90,000 บาท' }));
    const before = await counts();

    const missing = await request(app)
      .post('/api/webhooks/line')
      .set('content-type', 'application/json')
      .send(JSON.stringify(original));
    const changed = await postWebhook(
      app,
      tampered,
      signLineBody(JSON.stringify(original), TEST_LINE_SECRET),
    );
    const garbage = await postWebhook(app, original, 'not-base64-and-wrong-length');

    expect([missing.status, changed.status, garbage.status]).toEqual([401, 401, 401]);
    expect(await counts()).toEqual(before);
  });

  it('is closed (503) until a channel secret is configured', async () => {
    const app = await createTestApp(prisma, { lineChannelSecret: null });
    const res = await postWebhook(app, webhookBody(messageEvent()));
    expect(res.status).toBe(503);
  });

  it('answers the console Verify request (no events) with 200', async () => {
    const { app } = await lineStack();
    const res = await postWebhook(app, webhookBody());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: 0, duplicates: 0 });
  });

  it('rejects invalid JSON even when the signature matches', async () => {
    const { app } = await lineStack();
    const raw = '{"destination":"x","events":[';
    const res = await request(app)
      .post('/api/webhooks/line')
      .set('content-type', 'application/json')
      .set('x-line-signature', signLineBody(raw, TEST_LINE_SECRET))
      .send(raw);
    expect(res.status).toBe(400);
  });
});

describe('LINE webhook processing', () => {
  it('maps a new LINE user to a contact and an unassigned lead, then drafts a reply that waits for approval', async () => {
    const { app, line, webhooks } = await lineStack();
    const userId = newLineUserId();
    const event = messageEvent({ userId, text: 'สนใจทำระบบจองคิวออนไลน์ครับ' });

    const res = await postWebhook(app, webhookBody(event));
    expect(res.status).toBe(200);
    await webhooks.idle();

    const stored = await prisma.webhookEvent.findUniqueOrThrow({
      where: { eventId: event.webhookEventId },
    });
    expect(stored).toMatchObject({ status: 'PROCESSED', attempts: 1, lineUserId: userId });
    expect(stored.payload).toMatchObject({ replyToken: 'reply-token-not-used' }); // เก็บ event ดิบครบ

    const contact = await prisma.contact.findUniqueOrThrow({ where: { lineUserId: userId } });
    expect(contact.name).toBe(`LINE ${userId.slice(-4)}`); // ชื่อจากโปรไฟล์ LINE (จำลอง)
    const lead = await prisma.lead.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(lead).toMatchObject({ source: 'LINE', stage: 'NEW', ownerId: null });

    const message = await prisma.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(message).toMatchObject({
      direction: 'INBOUND',
      status: 'RECEIVED',
      text: 'สนใจทำระบบจองคิวออนไลน์ครับ',
      lineMessageId: event.message.id,
      webhookEventId: stored.id,
      createdAt: new Date(event.timestamp), // เวลาที่ลูกค้าส่งจริง
    });
    const created = await prisma.activity.findFirstOrThrow({
      where: { leadId: lead.id, type: 'SYSTEM' },
    });
    expect(created.actorId).toBeNull();
    expect(created.createdAt.getTime()).toBeLessThan(message.createdAt.getTime()); // timeline: สร้าง lead → ข้อความ

    // AI ร่างไว้ให้เท่านั้น — ยังไม่มีอะไรส่งออกไปหาลูกค้า
    const drafts = await prisma.aiSuggestion.findMany({ where: { leadId: lead.id } });
    expect(drafts.map((draft) => draft.type).sort()).toEqual([
      'LINE_REPLY',
      'NEXT_ACTION',
      'QUALIFICATION',
    ]);
    expect(
      drafts.every((draft) => draft.status === 'PENDING' && draft.requestedById === null),
    ).toBe(true);
    expect(await prisma.message.count({ where: { leadId: lead.id, direction: 'OUTBOUND' } })).toBe(
      0,
    );
    expect(line.sent).toHaveLength(0);
  });

  it('still records the message when the LINE profile cannot be read', async () => {
    const line = createMockLineClient();
    line.getProfile = () => Promise.reject(new LineApiError('LINE profile 500: down', 500, true));
    const webhooks = createWebhookProcessor({
      prisma,
      logger: silentLogger,
      line,
      requestDraft: null,
    });
    const app = await createTestApp(prisma, { line, webhooks });
    const userId = newLineUserId();

    await postWebhook(app, webhookBody(messageEvent({ userId, text: 'ติดต่อกลับด้วยครับ' })));
    await webhooks.idle();

    const contact = await prisma.contact.findUniqueOrThrow({ where: { lineUserId: userId } });
    expect(contact).toMatchObject({
      name: `ลูกค้า LINE …${userId.slice(-4)}`,
      lineDisplayName: null,
    });
    expect(await prisma.message.count({ where: { contactId: contact.id } })).toBe(1);
  });

  it('stores and processes an event only once when LINE delivers it again (even concurrently)', async () => {
    const { app, webhooks } = await lineStack();
    const event = messageEvent();
    const redelivered = { ...event, deliveryContext: { isRedelivery: true } };

    const responses = await Promise.all([
      postWebhook(app, webhookBody(event)),
      postWebhook(app, webhookBody(redelivered)),
    ]);
    const later = await postWebhook(app, webhookBody(redelivered));
    await webhooks.idle();

    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    expect(later.body).toEqual({ received: 1, duplicates: 1 });
    expect(await prisma.webhookEvent.count({ where: { eventId: event.webhookEventId } })).toBe(1);
    expect(await prisma.message.count({ where: { lineMessageId: event.message.id } })).toBe(1);
  });

  it('ignores the same LINE message arriving under a different event id', async () => {
    const { app, webhooks } = await lineStack();
    const first = messageEvent();
    const second = messageEvent({ userId: first.source.userId, messageId: first.message.id });

    await postWebhook(app, webhookBody(first));
    await postWebhook(app, webhookBody(second));
    await webhooks.idle();

    expect(await prisma.message.count({ where: { lineMessageId: first.message.id } })).toBe(1);
    expect(
      await prisma.webhookEvent.findUniqueOrThrow({ where: { eventId: second.webhookEventId } }),
    ).toMatchObject({ status: 'IGNORED', lastError: 'Duplicate LINE message' });
  });

  it('keeps later messages from the same user on the same contact and open lead', async () => {
    const { app, webhooks } = await lineStack();
    const userId = newLineUserId();

    await postWebhook(app, webhookBody(messageEvent({ userId, text: 'ข้อความแรก' })));
    await postWebhook(
      app,
      webhookBody(
        messageEvent({ userId, text: 'ข้อความที่สอง' }),
        messageEvent({ userId, messageType: 'sticker' }),
      ),
    );
    await webhooks.idle();

    const contacts = await prisma.contact.findMany({ where: { lineUserId: userId } });
    expect(contacts).toHaveLength(1);
    const leads = await prisma.lead.findMany({ where: { contactId: contacts[0]?.id } });
    expect(leads).toHaveLength(1);
    const texts = await prisma.message.findMany({
      where: { leadId: leads[0]?.id },
      orderBy: { createdAt: 'asc' },
      select: { text: true },
    });
    expect(texts.map((message) => message.text)).toEqual([
      'ข้อความแรก',
      'ข้อความที่สอง',
      '[สติกเกอร์]',
    ]);
  });

  it('opens a new lead when the previous one is closed', async () => {
    const { app, webhooks } = await lineStack();
    const userId = newLineUserId();
    await postWebhook(app, webhookBody(messageEvent({ userId })));
    await webhooks.idle();
    const contact = await prisma.contact.findUniqueOrThrow({ where: { lineUserId: userId } });
    await prisma.lead.updateMany({
      where: { contactId: contact.id },
      data: { stage: 'LOST', lostReason: 'ไม่มีงบ', closedAt: new Date() },
    });

    await postWebhook(app, webhookBody(messageEvent({ userId, text: 'กลับมาสนใจอีกครั้ง' })));
    await webhooks.idle();

    const leads = await prisma.lead.findMany({ where: { contactId: contact.id } });
    expect(leads.map((lead) => lead.stage).sort()).toEqual(['LOST', 'NEW']);
  });

  it('keeps unsupported events for inspection, and links a follower without creating a lead', async () => {
    const { app, webhooks } = await lineStack();
    const userId = newLineUserId();
    const base = {
      timestamp: Date.now(),
      mode: 'active',
      source: { type: 'user', userId },
      deliveryContext: { isRedelivery: false },
    };
    const follow = { ...base, type: 'follow', webhookEventId: `01JFOLLOW${Date.now()}` };
    const unfollow = { ...base, type: 'unfollow', webhookEventId: `01JUNFOLLOW${Date.now()}` };

    await postWebhook(app, webhookBody(follow, unfollow));
    await webhooks.idle();

    const statuses = await prisma.webhookEvent.findMany({
      where: { eventId: { in: [follow.webhookEventId, unfollow.webhookEventId] } },
      orderBy: { type: 'asc' },
      select: { type: true, status: true },
    });
    expect(statuses).toEqual([
      { type: 'follow', status: 'PROCESSED' },
      { type: 'unfollow', status: 'IGNORED' },
    ]);
    const contact = await prisma.contact.findUniqueOrThrow({ where: { lineUserId: userId } });
    expect(await prisma.lead.count({ where: { contactId: contact.id } })).toBe(0);
  });
});

describe('failed processing and retries', () => {
  /** ประมวลผลล้มครั้งแรก (จำลอง DB ล่มชั่วคราว) แล้วค่อยทำงานปกติ */
  function failingOnce() {
    let failed = false;
    return {
      processEvent: async (
        deps: Parameters<typeof processWebhookEvent>[0],
        id: string,
      ): ReturnType<typeof processWebhookEvent> => {
        if (!failed) {
          failed = true;
          throw new Error('database unavailable (simulated)');
        }
        return processWebhookEvent(deps, id);
      },
    };
  }

  it('marks the event FAILED with a retry time, and an admin can process it again', async () => {
    const { app, webhooks } = await lineStack(failingOnce());
    const event = messageEvent();
    const before = Date.now();

    expect((await postWebhook(app, webhookBody(event))).status).toBe(200); // ตอบ LINE ว่าได้รับแล้ว
    await webhooks.idle();

    const failed = await prisma.webhookEvent.findUniqueOrThrow({
      where: { eventId: event.webhookEventId },
    });
    expect(failed).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      lastError: 'database unavailable (simulated)',
    });
    expect(failed.nextRetryAt?.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(await prisma.message.count({ where: { lineMessageId: event.message.id } })).toBe(0);

    const sales = await loginAs(app, await createUser(prisma));
    expect((await sales.post(`/api/webhook-events/${failed.id}/retry`)).status).toBe(403);

    const admin = await loginAs(app, await createUser(prisma, { role: 'ADMIN' }));
    const retried = await admin.post(`/api/webhook-events/${failed.id}/retry`);
    expect(retried.status).toBe(200);
    const body = webhookEventSchema.parse(retried.body);
    expect(body).toMatchObject({ status: 'PROCESSED', attempts: 2, lastError: null });
    expect(body.leadId).toBeTruthy();
    expect(await prisma.message.count({ where: { lineMessageId: event.message.id } })).toBe(1);

    expect((await admin.post(`/api/webhook-events/${failed.id}/retry`)).status).toBe(409);
  });

  it('picks up events whose retry time has passed', async () => {
    const { app, webhooks } = await lineStack(failingOnce());
    const event = messageEvent();
    await postWebhook(app, webhookBody(event));
    await webhooks.idle();
    await prisma.webhookEvent.update({
      where: { eventId: event.webhookEventId },
      data: { nextRetryAt: new Date(Date.now() - 1_000) },
    });

    expect(await webhooks.enqueueDue()).toBe(1);
    await webhooks.idle();

    expect(
      await prisma.webhookEvent.findUniqueOrThrow({ where: { eventId: event.webhookEventId } }),
    ).toMatchObject({ status: 'PROCESSED', attempts: 2, nextRetryAt: null });
  });

  it('lists events for admins without exposing the raw payload or LINE user id', async () => {
    const { app } = await lineStack();
    const admin = await loginAs(app, await createUser(prisma, { role: 'ADMIN' }));

    const res = await admin.get('/api/webhook-events?status=PROCESSED&limit=5');

    expect(res.status).toBe(200);
    const list = webhookEventListSchema.parse(res.body);
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((item) => item.status === 'PROCESSED')).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/payload|lineUserId|replyToken/);
  });
});
