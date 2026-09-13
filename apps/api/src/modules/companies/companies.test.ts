import {
  apiErrorResponseSchema,
  companyDetailSchema,
  companySchema,
  pageSchema,
  type AuthUser,
} from '@ai-crm/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCompany, createContact } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';

const prisma = createTestPrisma();
const app = await createTestApp(prisma);
const companyPageSchema = pageSchema(companySchema);
let sales: AuthUser;
let admin: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma);
  admin = await createUser(prisma, { role: 'ADMIN' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('companies', () => {
  it('creates, reads, updates and finds a company', async () => {
    const agent = await loginAs(app, sales);
    const created = await agent
      .post('/api/companies')
      .send({ name: 'บริษัท ทดสอบ จำกัด', domain: ' Test-Co.EXAMPLE ', employeeCount: 120 });
    expect(created.status).toBe(201);
    const company = companySchema.parse(created.body);
    expect(company).toMatchObject({ domain: 'test-co.example', contactCount: 0, leadCount: 0 });

    const updated = await agent.patch(`/api/companies/${company.id}`).send({ industry: 'Retail' });
    expect(companySchema.parse(updated.body).industry).toBe('Retail');

    const found = companyPageSchema.parse(
      (await agent.get('/api/companies').query({ q: 'ทดสอบ' })).body,
    );
    expect(found.items.map((item) => item.id)).toEqual([company.id]);

    const detail = companyDetailSchema.parse(
      (await agent.get(`/api/companies/${company.id}`)).body,
    );
    expect(detail).toMatchObject({ id: company.id, contacts: [], leads: [] });
  });

  it('rejects a duplicate domain with 409 and invalid input with field-level 400', async () => {
    const agent = await loginAs(app, sales);
    await agent.post('/api/companies').send({ name: 'First', domain: 'dup.example' });

    const duplicate = await agent
      .post('/api/companies')
      .send({ name: 'Second', domain: 'DUP.example' });
    expect(duplicate.status).toBe(409);
    expect(apiErrorResponseSchema.parse(duplicate.body).error.details).toEqual({
      issues: [{ path: 'domain', message: 'Another company already uses this domain' }],
    });

    const invalid = await agent.post('/api/companies').send({ name: '', domain: 'not a domain' });
    expect(invalid.status).toBe(400);
    const issues = (
      apiErrorResponseSchema.parse(invalid.body).error.details as {
        issues: { path: string }[];
      }
    ).issues.map((issue) => issue.path);
    expect(issues).toEqual(expect.arrayContaining(['name', 'domain']));
  });

  it('pages through results with a cursor', async () => {
    for (const name of ['Paging A', 'Paging B', 'Paging C']) await createCompany(prisma, { name });
    const agent = await loginAs(app, sales);

    const first = companyPageSchema.parse(
      (await agent.get('/api/companies').query({ q: 'paging', limit: '2' })).body,
    );
    expect(first.items.map((item) => item.name)).toEqual(['Paging A', 'Paging B']);
    expect(first.total).toBe(3);

    const second = companyPageSchema.parse(
      (
        await agent
          .get('/api/companies')
          .query({ q: 'paging', limit: '2', cursor: first.nextCursor ?? '' })
      ).body,
    );
    expect(second.items.map((item) => item.name)).toEqual(['Paging C']);
    expect(second.nextCursor).toBeNull();
  });

  it('returns 404 for an unknown company', async () => {
    const agent = await loginAs(app, sales);
    expect((await agent.get('/api/companies/missing')).status).toBe(404);
    expect((await agent.patch('/api/companies/missing').send({ name: 'x' })).status).toBe(404);
  });

  it('lets only admins delete, and never deletes a company that still has contacts', async () => {
    const inUse = await createCompany(prisma);
    await createContact(prisma, { companyId: inUse.id });
    const empty = await createCompany(prisma);
    const salesAgent = await loginAs(app, sales);
    const adminAgent = await loginAs(app, admin);

    expect((await salesAgent.delete(`/api/companies/${empty.id}`)).status).toBe(403);
    expect((await adminAgent.delete(`/api/companies/${inUse.id}`)).status).toBe(409);
    expect((await adminAgent.delete(`/api/companies/${empty.id}`)).status).toBe(204);
    expect((await adminAgent.get(`/api/companies/${empty.id}`)).status).toBe(404);
  });
});
