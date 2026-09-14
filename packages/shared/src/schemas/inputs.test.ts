import { describe, expect, it } from 'vitest';
import { companyCreateInputSchema, companyUpdateInputSchema } from './company';
import { contactCreateInputSchema, contactListQuerySchema } from './contact';
import { leadCreateInputSchema, leadListQuerySchema } from './lead';
import { activityCreateInputSchema } from './timeline';

describe('contact input', () => {
  it('trims and lowercases email, and turns blank form fields into null', () => {
    const parsed = contactCreateInputSchema.parse({
      name: '  สมชาย ใจดี ',
      email: '  Somchai@Example.CO.TH ',
      phone: '',
      jobTitle: '   ',
    });
    expect(parsed).toEqual({
      name: 'สมชาย ใจดี',
      email: 'somchai@example.co.th',
      phone: null,
      jobTitle: null,
    });
  });

  it('rejects an invalid email or phone', () => {
    expect(contactCreateInputSchema.safeParse({ name: 'A', email: 'not-an-email' }).success).toBe(
      false,
    );
    expect(contactCreateInputSchema.safeParse({ name: 'A', phone: 'call me' }).success).toBe(false);
  });

  it('parses hasLine from the query string', () => {
    expect(contactListQuerySchema.parse({ hasLine: 'true' }).hasLine).toBe(true);
    expect(contactListQuerySchema.parse({ hasLine: 'false' }).hasLine).toBe(false);
    expect(contactListQuerySchema.safeParse({ hasLine: 'yes' }).success).toBe(false);
  });
});

describe('company input', () => {
  it('normalises the domain and rejects malformed ones', () => {
    expect(companyCreateInputSchema.parse({ name: 'ACME', domain: ' ACME.co.th ' }).domain).toBe(
      'acme.co.th',
    );
    expect(
      companyCreateInputSchema.safeParse({ name: 'ACME', domain: 'http://acme' }).success,
    ).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(companyUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(companyUpdateInputSchema.safeParse({ industry: null }).success).toBe(true);
  });
});

describe('lead input', () => {
  it('requires exactly one of contactId or an inline contact', () => {
    expect(leadCreateInputSchema.safeParse({ title: 'Deal' }).success).toBe(false);
    expect(
      leadCreateInputSchema.safeParse({ title: 'Deal', contactId: 'c1', contact: { name: 'A' } })
        .success,
    ).toBe(false);
    expect(leadCreateInputSchema.safeParse({ title: 'Deal', contactId: 'c1' }).success).toBe(true);
    expect(leadCreateInputSchema.safeParse({ title: 'Deal', contact: { name: 'A' } }).success).toBe(
      true,
    );
  });

  it('rejects out-of-range score and negative value', () => {
    expect(
      leadCreateInputSchema.safeParse({ title: 'D', contactId: 'c', score: 101 }).success,
    ).toBe(false);
    expect(leadCreateInputSchema.safeParse({ title: 'D', contactId: 'c', value: -5 }).success).toBe(
      false,
    );
  });

  it('parses list filters from repeated or comma-separated query params', () => {
    expect(leadListQuerySchema.parse({ stage: 'NEW,QUALIFIED' }).stage).toEqual([
      'NEW',
      'QUALIFIED',
    ]);
    expect(leadListQuerySchema.parse({ stage: ['NEW', 'WON'] }).stage).toEqual(['NEW', 'WON']);
    expect(leadListQuerySchema.safeParse({ stage: 'NEW,BOGUS' }).success).toBe(false);
  });

  it('applies pagination and sort defaults and treats a blank search as no search', () => {
    expect(leadListQuerySchema.parse({ q: '  ' })).toMatchObject({
      q: undefined,
      limit: 50,
      sort: 'updatedAt',
      order: 'desc',
    });
    expect(leadListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('activity input', () => {
  it('only allows dueAt on TASK activities', () => {
    const dueAt = '2026-10-01T09:00:00.000Z';
    expect(
      activityCreateInputSchema.safeParse({ type: 'TASK', body: 'ส่งใบเสนอราคา', dueAt }).success,
    ).toBe(true);
    expect(activityCreateInputSchema.safeParse({ type: 'NOTE', body: 'note', dueAt }).success).toBe(
      false,
    );
  });

  it('does not accept system-only activity types', () => {
    expect(activityCreateInputSchema.safeParse({ type: 'STAGE_CHANGE', body: 'x' }).success).toBe(
      false,
    );
  });
});
