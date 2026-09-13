import {
  apiErrorResponseSchema,
  contactDetailSchema,
  contactSchema,
  pageSchema,
  type AuthUser,
} from '@ai-crm/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCompany, createContact, createLeadRow } from '../../../test/fixtures';
import { createTestApp, createUser, loginAs } from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';

const prisma = createTestPrisma();
const app = createTestApp(prisma);
const contactPageSchema = pageSchema(contactSchema);
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

describe('contacts', () => {
  it('creates a contact with a normalised email linked to a company', async () => {
    const company = await createCompany(prisma, { name: 'Linked Co' });
    const agent = await loginAs(app, sales);
    const res = await agent.post('/api/contacts').send({
      name: 'คุณมานี มีสุข',
      email: 'Manee@Example.CO.TH',
      phone: '081-234-5678',
      companyId: company.id,
    });
    expect(res.status).toBe(201);
    expect(contactSchema.parse(res.body)).toMatchObject({
      email: 'manee@example.co.th',
      company: { id: company.id, name: 'Linked Co' },
      line: { linked: false, displayName: null },
    });
  });

  it('rejects an unknown company with a field-level 400 and a duplicate email with 409', async () => {
    const agent = await loginAs(app, sales);
    const unknownCompany = await agent
      .post('/api/contacts')
      .send({ name: 'A', companyId: 'missing' });
    expect(unknownCompany.status).toBe(400);
    expect(apiErrorResponseSchema.parse(unknownCompany.body).error.details).toEqual({
      issues: [{ path: 'companyId', message: 'Company not found' }],
    });

    await agent.post('/api/contacts').send({ name: 'First', email: 'same@test.local' });
    const duplicate = await agent
      .post('/api/contacts')
      .send({ name: 'Second', email: 'SAME@test.local' });
    expect(duplicate.status).toBe(409);
  });

  it('filters by LINE link without exposing the raw LINE user id', async () => {
    const lineUserId = 'U0123456789abcdef0123456789abcdef';
    const linked = await createContact(prisma, { name: 'LineFilter linked', lineUserId });
    await createContact(prisma, { name: 'LineFilter plain' });
    const agent = await loginAs(app, sales);

    const res = await agent.get('/api/contacts').query({ q: 'LineFilter', hasLine: 'true' });
    const page = contactPageSchema.parse(res.body);
    expect(page.items.map((item) => item.id)).toEqual([linked.id]);
    expect(page.items[0]?.line.linked).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(lineUserId);

    const withoutLine = contactPageSchema.parse(
      (await agent.get('/api/contacts').query({ q: 'LineFilter', hasLine: 'false' })).body,
    );
    expect(withoutLine.items.map((item) => item.name)).toEqual(['LineFilter plain']);
  });

  it('searches by phone number', async () => {
    const contact = await createContact(prisma, { name: 'Phone Search', phone: '0899990000' });
    const agent = await loginAs(app, sales);
    const page = contactPageSchema.parse(
      (await agent.get('/api/contacts').query({ q: '89999' })).body,
    );
    expect(page.items.map((item) => item.id)).toContain(contact.id);
  });

  it('shows the contact with their leads, and updates fields', async () => {
    const contact = await createContact(prisma);
    await createLeadRow(prisma, { contactId: contact.id, title: 'Detail lead' });
    const agent = await loginAs(app, sales);

    const detail = contactDetailSchema.parse((await agent.get(`/api/contacts/${contact.id}`)).body);
    expect(detail.leads.map((lead) => lead.title)).toEqual(['Detail lead']);

    const updated = await agent
      .patch(`/api/contacts/${contact.id}`)
      .send({ jobTitle: 'CMO', phone: '' });
    expect(contactSchema.parse(updated.body)).toMatchObject({ jobTitle: 'CMO', phone: null });
  });

  it('lets only admins delete, and refuses to delete a contact that has leads', async () => {
    const withLead = await createContact(prisma);
    await createLeadRow(prisma, { contactId: withLead.id });
    const alone = await createContact(prisma);
    const salesAgent = await loginAs(app, sales);
    const adminAgent = await loginAs(app, admin);

    expect((await salesAgent.delete(`/api/contacts/${alone.id}`)).status).toBe(403);
    expect((await adminAgent.delete(`/api/contacts/${withLead.id}`)).status).toBe(409);
    expect((await adminAgent.delete(`/api/contacts/${alone.id}`)).status).toBe(204);
  });
});
