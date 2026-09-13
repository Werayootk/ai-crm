import { apiErrorResponseSchema } from '@ai-crm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';

const prisma = createTestPrisma();
let app: TestApp;
let sequence = 0;

beforeAll(async () => {
  await truncateAll(prisma);
  app = await createTestApp(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function form(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    name: 'คุณเว็บ ทดสอบ',
    email: `web${sequence}-${Date.now()}@example.com`,
    phone: '081-234-5678',
    company: 'บริษัท ทดสอบฟอร์ม จำกัด',
    message: 'สนใจทำเว็บไซต์องค์กรใหม่ ขอใบเสนอราคาครับ',
    consent: true,
    ...overrides,
  };
}

describe('public lead form', () => {
  it('creates a contact, an unassigned WEBSITE lead and the message without exposing ids', async () => {
    const input = form();

    const res = await request(app).post('/api/public/leads').send(input);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });
    const contact = await prisma.contact.findUniqueOrThrow({ where: { email: input.email } });
    const lead = await prisma.lead.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(lead).toMatchObject({
      source: 'WEBSITE',
      stage: 'NEW',
      ownerId: null,
      title: 'ติดต่อผ่านเว็บไซต์ — บริษัท ทดสอบฟอร์ม จำกัด',
    });
    const message = await prisma.message.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(message).toMatchObject({ direction: 'INBOUND', channel: 'WEB_FORM' });
    expect(message.text).toContain('สนใจทำเว็บไซต์องค์กรใหม่');
    expect(message.text).toContain('โทร: 081-234-5678');
  });

  it('adds a second submission to the same contact and open lead without overwriting the contact', async () => {
    const input = form();
    await request(app).post('/api/public/leads').send(input);

    const again = await request(app)
      .post('/api/public/leads')
      .send({ ...input, name: 'ชื่อที่คนอื่นพิมพ์มา', email: input.email.toUpperCase() });

    expect(again.status).toBe(201);
    const contacts = await prisma.contact.findMany({ where: { email: input.email } });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe('คุณเว็บ ทดสอบ');
    const leads = await prisma.lead.findMany({ where: { contactId: contacts[0]?.id } });
    expect(leads).toHaveLength(1);
    expect(await prisma.message.count({ where: { leadId: leads[0]?.id } })).toBe(2);
  });

  it('pretends to accept bots that fill the hidden field, but stores nothing', async () => {
    const input = form({ website: 'http://spam.example' });

    const res = await request(app).post('/api/public/leads').send(input);

    expect(res.status).toBe(201);
    expect(await prisma.contact.count({ where: { email: input.email } })).toBe(0);
  });

  it('requires consent and valid fields, and rejects unknown fields', async () => {
    const noConsent = await request(app)
      .post('/api/public/leads')
      .send(form({ consent: false }));
    const badEmail = await request(app)
      .post('/api/public/leads')
      .send(form({ email: 'not-an-email' }));
    const extra = await request(app)
      .post('/api/public/leads')
      .send(form({ ownerId: 'someone' }));

    expect([noConsent.status, badEmail.status, extra.status]).toEqual([400, 400, 400]);
    const paths = apiErrorResponseSchema.parse(noConsent.body).error.details;
    expect(JSON.stringify(paths)).toContain('consent');
  });

  it('limits submissions per IP', async () => {
    const limited = await createTestApp(prisma, {
      publicRateLimit: { windowMs: 60_000, limit: 2 },
    });

    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await request(limited).post('/api/public/leads').send(form())).status);
    }

    expect(statuses).toEqual([201, 201, 429]);
  });
});
