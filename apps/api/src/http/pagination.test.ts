import { describe, expect, it } from 'vitest';
import { HttpError } from './errors';
import { decodeTimeCursor, encodeTimeCursor, toPage } from './pagination';

describe('toPage', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns a next cursor when there are more rows than the limit', () => {
    expect(toPage(rows, 2, 10, (row) => row.id)).toEqual({
      items: ['a', 'b'],
      nextCursor: 'b',
      total: 10,
    });
  });

  it('returns no cursor on the last page', () => {
    expect(toPage(rows, 3, 3, (row) => row.id)).toEqual({
      items: ['a', 'b', 'c'],
      nextCursor: null,
      total: 3,
    });
  });
});

describe('time cursor', () => {
  it('round-trips createdAt and id', () => {
    const cursor = { createdAt: new Date('2026-09-13T12:00:00.000Z'), id: 'act_1' };
    expect(decodeTimeCursor(encodeTimeCursor(cursor))).toEqual(cursor);
  });

  it('rejects a tampered cursor with a validation error', () => {
    expect(() => decodeTimeCursor('not-a-cursor')).toThrow(HttpError);
    expect(() => decodeTimeCursor(Buffer.from('bad-date|x').toString('base64url'))).toThrow(
      /Invalid request query/,
    );
  });
});
