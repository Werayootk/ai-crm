import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = { DATABASE_URL: 'postgresql://user:pw@localhost:5432/db' };

describe('parseEnv', () => {
  it('applies defaults and coerces PORT', () => {
    expect(parseEnv({ ...valid, PORT: '5050' })).toEqual({
      NODE_ENV: 'development',
      PORT: 5050,
      LOG_LEVEL: 'info',
      DATABASE_URL: valid.DATABASE_URL,
    });
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres DATABASE_URL without echoing its value', () => {
    const secretish = 'mysql://admin:super-secret-pw@db.internal/crm';
    const run = () => parseEnv({ DATABASE_URL: secretish });
    expect(run).toThrow(/DATABASE_URL: must be a postgres/);
    expect(run).not.toThrow(/super-secret-pw/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });
});
