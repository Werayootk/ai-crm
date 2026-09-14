import {
  apiErrorResponseSchema,
  leadDetailSchema,
  leadListItemSchema,
  pageSchema,
  pipelineSummarySchema,
  timelinePageSchema,
  type AuthUser,
  type LeadStage,
} from '@ai-crm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCompany, createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { auditedChanges } from './leads.service';

const prisma = createTestPrisma();
const app = await createTestApp(prisma);
const leadPageSchema = pageSchema(leadListItemSchema);
let sales: AuthUser;
let otherSales: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma, { name: 'Sales One' });
  otherSales = await createUser(prisma, { name: 'Sales Two' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function error(res: request.Response) {
  return apiErrorResponseSchema.parse(res.body).error;
}

// ───────── Required test #1: core CRM flow ─────────

describe('core CRM flow', () => {
  it('creates a lead, enforces stage rules, and records every stage change in the timeline', async () => {
    const company = await createCompany(prisma, { name: 'บริษัท ทดสอบโฟลว์ จำกัด' });
    const agent = await loginAs(app, sales);

    // 1) สร้าง lead พร้อม contact ใหม่ในคำขอเดียว
    const created = await agent.post('/api/leads').send({
      title: 'เว็บไซต์ใหม่ — บริษัท ทดสอบโฟลว์',
      value: 250_000.555,
      contact: { name: 'คุณทดสอบ', email: 'Flow@Test.local', companyId: company.id },
    });
    expect(created.status).toBe(201);
    const lead = leadDetailSchema.parse(created.body);
    expect(lead).toMatchObject({
      stage: 'NEW',
      source: 'MANUAL',
      value: 250_000.56,
      owner: { id: sales.id },
      company: { id: company.id },
      contact: { email: 'flow@test.local' },
    });
    const moveTo = (stage: LeadStage, lostReason?: string) =>
      agent.patch(`/api/leads/${lead.id}/stage`).send({ stage, lostReason });

    // 2) ข้าม stage ผิดกติกา → 409 พร้อมบอก stage ที่ไปได้
    const skip = await moveTo('WON');
    expect(skip.status).toBe(409);
    expect(error(skip)).toMatchObject({
      code: 'CONFLICT',
      details: { from: 'NEW', to: 'WON', allowed: ['QUALIFIED', 'PROPOSAL', 'LOST'] },
    });

    // 3) LOST ต้องมีเหตุผล → 400
    const lostWithoutReason = await moveTo('LOST');
    expect(lostWithoutReason.status).toBe(400);
    expect(error(lostWithoutReason).details).toEqual({
      issues: [
        { path: 'lostReason', message: 'lostReason is required when moving a lead to LOST' },
      ],
    });

    // 4) เดินตามกติกา NEW → QUALIFIED → PROPOSAL → WON
    for (const stage of ['QUALIFIED', 'PROPOSAL', 'WON'] as const) {
      const res = await moveTo(stage);
      expect(res.status).toBe(200);
      expect(leadDetailSchema.parse(res.body).stage).toBe(stage);
    }

    // 5) ข้อมูลมาจาก DB (refresh แล้วยังอยู่) และ WON เป็นสถานะสุดท้าย
    const reloaded = leadDetailSchema.parse((await agent.get(`/api/leads/${lead.id}`)).body);
    expect(reloaded.stage).toBe('WON');
    expect(reloaded.closedAt).not.toBeNull();
    expect((await moveTo('NEW')).status).toBe(409);

    // 6) timeline มี STAGE_CHANGE ครบทุกขั้น พร้อมผู้ที่ทำ (ใหม่ → เก่า)
    const timeline = timelinePageSchema.parse(
      (await agent.get(`/api/leads/${lead.id}/timeline`)).body,
    );
    const stageChanges = timeline.items.filter(
      (item) => item.kind === 'activity' && item.type === 'STAGE_CHANGE',
    );
    expect(stageChanges.map((item) => (item.kind === 'activity' ? item.metadata : null))).toEqual([
      { from: 'PROPOSAL', to: 'WON' },
      { from: 'QUALIFIED', to: 'PROPOSAL' },
      { from: 'NEW', to: 'QUALIFIED' },
    ]);
    expect(
      stageChanges.every((item) => item.kind === 'activity' && item.actor?.id === sales.id),
    ).toBe(true);
    expect(timeline.items.at(-1)).toMatchObject({ kind: 'activity', type: 'SYSTEM' });
  });

  it('closes a lead as LOST with a reason, then reopens it as NEW with the close data cleared', async () => {
    const contact = await createContact(prisma);
    const row = await createLeadRow(prisma, { contactId: contact.id, stage: 'QUALIFIED' });
    const agent = await loginAs(app, sales);

    const lost = await agent
      .patch(`/api/leads/${row.id}/stage`)
      .send({ stage: 'LOST', lostReason: 'งบประมาณไม่พอ' });
    expect(leadDetailSchema.parse(lost.body)).toMatchObject({
      stage: 'LOST',
      lostReason: 'งบประมาณไม่พอ',
    });

    const reopened = await agent.patch(`/api/leads/${row.id}/stage`).send({ stage: 'NEW' });
    expect(leadDetailSchema.parse(reopened.body)).toMatchObject({
      stage: 'NEW',
      lostReason: null,
      closedAt: null,
    });
  });

  it('rejects moving a lead to the stage it is already in', async () => {
    const contact = await createContact(prisma);
    const row = await createLeadRow(prisma, { contactId: contact.id });
    const agent = await loginAs(app, sales);
    const res = await agent.patch(`/api/leads/${row.id}/stage`).send({ stage: 'NEW' });
    expect(res.status).toBe(409);
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
    expect((await request(app).post('/api/leads').send({})).status).toBe(401);
  });
});

// ───────── create validation ─────────

describe('POST /api/leads', () => {
  it('links an existing contact and defaults the company to the contact company', async () => {
    const company = await createCompany(prisma);
    const contact = await createContact(prisma, { companyId: company.id });
    const agent = await loginAs(app, sales);
    const res = await agent
      .post('/api/leads')
      .send({ title: 'Existing contact', contactId: contact.id });
    expect(res.status).toBe(201);
    expect(leadDetailSchema.parse(res.body)).toMatchObject({
      contact: { id: contact.id },
      company: { id: company.id },
    });
  });

  it('rejects unknown contact, company or owner with field-level errors', async () => {
    const contact = await createContact(prisma);
    const agent = await loginAs(app, sales);
    const cases = [
      [{ title: 'x', contactId: 'missing' }, 'contactId'],
      [{ title: 'x', contactId: contact.id, companyId: 'missing' }, 'companyId'],
      [{ title: 'x', contactId: contact.id, ownerId: 'missing' }, 'ownerId'],
    ] as const;
    for (const [body, path] of cases) {
      const res = await agent.post('/api/leads').send(body);
      expect(res.status).toBe(400);
      expect(error(res).details).toEqual({ issues: [expect.objectContaining({ path })] });
    }
  });
});

// ───────── list / search / filter / pagination ─────────

describe('GET /api/leads', () => {
  const prefix = 'ListCase';
  let unassignedLeadId: string;

  beforeAll(async () => {
    const company = await createCompany(prisma, { name: `${prefix} Holdings` });
    const contact = await createContact(prisma, {
      name: `${prefix} Person`,
      companyId: company.id,
    });
    const make = (
      title: string,
      extra: Parameters<typeof createLeadRow>[1] extends infer T ? Partial<T> : never,
    ) => createLeadRow(prisma, { contactId: contact.id, title: `${prefix} ${title}`, ...extra });

    await make('alpha', {
      stage: 'NEW',
      ownerId: sales.id,
      score: 20,
      value: 100_000,
      source: 'WEBSITE',
    });
    await make('bravo', {
      stage: 'QUALIFIED',
      ownerId: sales.id,
      score: 70,
      value: 900_000,
      source: 'LINE',
    });
    await make('charlie', {
      stage: 'PROPOSAL',
      ownerId: otherSales.id,
      score: 85,
      value: null,
      companyId: company.id,
    });
    unassignedLeadId = (
      await make('delta', {
        stage: 'NEW',
        ownerId: null,
        score: null,
        value: 50_000,
        source: 'LINE',
      })
    ).id;
  });

  async function list(query: Record<string, string>) {
    const agent = await loginAs(app, sales);
    const res = await agent.get('/api/leads').query({ q: prefix, ...query });
    expect(res.status).toBe(200);
    return leadPageSchema.parse(res.body);
  }

  const titles = (page: { items: { title: string }[] }) =>
    page.items.map((item) => item.title.replace(`${prefix} `, '')).sort();

  it('searches across title, contact name and the lead company name (case-insensitive)', async () => {
    const agent = await loginAs(app, sales);
    const search = async (q: string) =>
      leadPageSchema.parse((await agent.get('/api/leads').query({ q })).body);

    expect((await search('listcase alpha')).items.map((item) => item.title)).toEqual([
      `${prefix} alpha`,
    ]);
    expect((await search('listcase person')).total).toBe(4); // ชื่อ contact
    // ชื่อบริษัทค้นจากบริษัทที่ผูกกับ lead — มีแค่ charlie ที่ผูกไว้
    expect(titles(await search('LISTCASE HOLDINGS'))).toEqual(['charlie']);
  });

  it('filters by stage list, owner (me / unassigned / id), source and minimum score', async () => {
    expect(titles(await list({ stage: 'NEW,PROPOSAL' }))).toEqual(['alpha', 'charlie', 'delta']);
    expect(titles(await list({ ownerId: 'me' }))).toEqual(['alpha', 'bravo']);
    expect(titles(await list({ ownerId: 'unassigned' }))).toEqual(['delta']);
    expect(titles(await list({ ownerId: otherSales.id }))).toEqual(['charlie']);
    expect(titles(await list({ source: 'LINE' }))).toEqual(['bravo', 'delta']);
    expect(titles(await list({ minScore: '70' }))).toEqual(['bravo', 'charlie']);
    const unassigned = await list({ ownerId: 'unassigned' });
    expect(unassigned.items[0]).toMatchObject({ id: unassignedLeadId, owner: null });
  });

  it('sorts by value with empty values last and paginates with a cursor', async () => {
    const first = await list({ sort: 'value', order: 'desc', limit: '2' });
    expect(first.items.map((item) => item.value)).toEqual([900_000, 100_000]);
    expect(first.nextCursor).not.toBeNull();

    const second = await list({
      sort: 'value',
      order: 'desc',
      limit: '2',
      cursor: first.nextCursor ?? '',
    });
    expect(second.items.map((item) => item.value)).toEqual([50_000, null]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(4);
  });

  it('rejects invalid filters with 400', async () => {
    const agent = await loginAs(app, sales);
    const res = await agent.get('/api/leads').query({ stage: 'NEW,BOGUS', limit: '1000' });
    expect(res.status).toBe(400);
    expect(error(res).code).toBe('VALIDATION_ERROR');
  });
});

// ───────── pipeline ─────────

describe('GET /api/leads/pipeline', () => {
  it('counts leads and sums value per stage, including empty stages', async () => {
    const owner = await createUser(prisma, { name: 'Pipeline Owner' });
    const contact = await createContact(prisma);
    await createLeadRow(prisma, {
      contactId: contact.id,
      ownerId: owner.id,
      stage: 'NEW',
      value: 1_000,
    });
    await createLeadRow(prisma, {
      contactId: contact.id,
      ownerId: owner.id,
      stage: 'NEW',
      value: 2_500.5,
    });
    await createLeadRow(prisma, {
      contactId: contact.id,
      ownerId: owner.id,
      stage: 'WON',
      value: null,
    });

    const agent = await loginAs(app, sales);
    const res = await agent.get('/api/leads/pipeline').query({ ownerId: owner.id });
    expect(pipelineSummarySchema.parse(res.body).stages).toEqual([
      { stage: 'NEW', count: 2, totalValue: 3_500.5 },
      { stage: 'QUALIFIED', count: 0, totalValue: 0 },
      { stage: 'PROPOSAL', count: 0, totalValue: 0 },
      { stage: 'WON', count: 1, totalValue: 0 },
      { stage: 'LOST', count: 0, totalValue: 0 },
    ]);
  });
});

// ───────── update + audit ─────────

describe('PATCH /api/leads/:id', () => {
  it('records who changed owner, score or value — but not title-only edits', async () => {
    const contact = await createContact(prisma);
    const row = await createLeadRow(prisma, {
      contactId: contact.id,
      ownerId: sales.id,
      score: 40,
    });
    const agent = await loginAs(app, sales);

    const titleOnly = await agent.patch(`/api/leads/${row.id}`).send({ title: 'Renamed' });
    expect(titleOnly.status).toBe(200);

    const audited = await agent
      .patch(`/api/leads/${row.id}`)
      .send({ ownerId: otherSales.id, score: 75, summary: 'ลูกค้าพร้อมตัดสินใจ' });
    expect(leadDetailSchema.parse(audited.body)).toMatchObject({
      owner: { id: otherSales.id },
      score: 75,
      summary: 'ลูกค้าพร้อมตัดสินใจ',
    });

    const activities = await prisma.activity.findMany({
      where: { leadId: row.id, type: 'SYSTEM' },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      actorId: sales.id,
      metadata: {
        changes: {
          ownerId: { from: sales.id, to: otherSales.id },
          score: { from: 40, to: 75 },
        },
      },
    });
  });

  it('rejects an inactive owner, an empty body and an unknown lead', async () => {
    const contact = await createContact(prisma);
    const row = await createLeadRow(prisma, { contactId: contact.id });
    const inactive = await createUser(prisma, { isActive: false });
    const agent = await loginAs(app, sales);

    expect((await agent.patch(`/api/leads/${row.id}`).send({ ownerId: inactive.id })).status).toBe(
      400,
    );
    expect((await agent.patch(`/api/leads/${row.id}`).send({})).status).toBe(400);
    expect((await agent.patch('/api/leads/missing').send({ title: 'x' })).status).toBe(404);
  });
});

describe('auditedChanges', () => {
  it('reports only fields that were sent and actually changed', () => {
    expect(
      auditedChanges(
        { ownerId: 'a', score: 10, value: 100 },
        { ownerId: 'a', score: 20, value: undefined },
      ),
    ).toEqual({ score: { from: 10, to: 20 } });
  });

  it('treats clearing a value as a change', () => {
    expect(auditedChanges({ ownerId: 'a', score: null, value: 100 }, { value: null })).toEqual({
      value: { from: 100, to: null },
    });
  });
});
