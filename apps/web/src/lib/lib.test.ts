import { describe, expect, it } from 'vitest';
import { toSearchParams } from './api';
import { formatMoney, formatRelative, initials } from './format';
import {
  DEFAULT_LEAD_FILTERS,
  leadFiltersToQuery,
  parseLeadFilters,
  serializeLeadFilters,
} from './lead-filters';
import { HOME_PATH, loginPath, safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('keeps internal paths including query strings', () => {
    expect(safeNextPath('/leads/abc?tab=timeline')).toBe('/leads/abc?tab=timeline');
  });

  it.each([
    ['absolute URL', 'https://evil.example/phish'],
    ['protocol-relative URL', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['javascript URL', 'javascript:alert(1)'],
    ['login loop', '/login?next=/leads'],
    ['missing', null],
  ])('falls back to home for %s', (_label, value) => {
    expect(safeNextPath(value)).toBe(HOME_PATH);
  });

  it('builds an encoded login redirect', () => {
    expect(loginPath('/leads?stage=NEW,WON')).toBe('/login?next=%2Fleads%3Fstage%3DNEW%2CWON');
  });
});

describe('lead filters in the URL', () => {
  it('round-trips filters and keeps the URL short for defaults', () => {
    const filters = {
      ...DEFAULT_LEAD_FILTERS,
      q: 'สยาม',
      stages: ['NEW' as const, 'PROPOSAL' as const],
      owner: 'me',
      sort: 'value' as const,
    };
    const search = serializeLeadFilters(filters);
    expect(parseLeadFilters(new URLSearchParams(search))).toEqual(filters);
    expect(serializeLeadFilters(DEFAULT_LEAD_FILTERS)).toBe('');
  });

  it('drops unknown or duplicated values from a hand-edited URL', () => {
    const parsed = parseLeadFilters(
      new URLSearchParams('stage=NEW,BOGUS,NEW&source=FAX&sort=__proto__&order=sideways'),
    );
    expect(parsed).toEqual({ ...DEFAULT_LEAD_FILTERS, stages: ['NEW'] });
  });

  it('maps filters onto the API query', () => {
    expect(
      leadFiltersToQuery({ ...DEFAULT_LEAD_FILTERS, owner: 'unassigned', source: 'LINE' }),
    ).toMatchObject({ ownerId: 'unassigned', source: 'LINE', stage: [] });
  });
});

describe('toSearchParams', () => {
  it('skips empty values and joins lists', () => {
    expect(
      toSearchParams({ q: '', stage: ['NEW', 'WON'], limit: 20, cursor: undefined, owner: null }),
    ).toBe('?stage=NEW%2CWON&limit=20');
    expect(toSearchParams({ stage: [] })).toBe('');
  });
});

describe('format', () => {
  it('formats baht without decimals and shows a dash for missing values', () => {
    expect(formatMoney(1_250_000)).toContain('1,250,000');
    expect(formatMoney(null)).toBe('—');
  });

  it('describes recent times relatively and old ones as a date', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(formatRelative('2026-09-13T11:59:30.000Z', now)).toBe('เมื่อสักครู่');
    expect(formatRelative('2026-09-13T11:15:00.000Z', now)).toBe('45 นาทีที่แล้ว');
    expect(formatRelative('2026-09-10T12:00:00.000Z', now)).toBe('3 วันที่แล้ว');
    expect(formatRelative('2026-07-01T12:00:00.000Z', now)).not.toContain('ที่แล้ว');
  });

  it('builds initials from up to two words', () => {
    expect(initials('สมชาย ใจดี')).toBe('สใ');
    expect(initials('Admin')).toBe('A');
  });
});
