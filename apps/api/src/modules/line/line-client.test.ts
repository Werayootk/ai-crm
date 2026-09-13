import { describe, expect, it } from 'vitest';
import { createHttpLineClient } from './http-line-client';
import { LineApiError } from './line-client';
import { signLineBody, verifyLineSignature } from './signature';

describe('LINE signature', () => {
  const secret = 'channel-secret-for-test';
  const body = Buffer.from('{"destination":"U1","events":[{"message":{"text":"สวัสดี\\n"}}]}');

  it('accepts the signature LINE would send for the exact body', () => {
    expect(verifyLineSignature(body, signLineBody(body, secret), secret)).toBe(true);
  });

  it('rejects another secret, a changed body, and malformed or missing signatures', () => {
    const signature = signLineBody(body, secret);
    expect(verifyLineSignature(body, signLineBody(body, 'other-secret'), secret)).toBe(false);
    expect(verifyLineSignature(Buffer.from(`${body.toString()} `), signature, secret)).toBe(false);
    expect(verifyLineSignature(body, 'short', secret)).toBe(false);
    expect(verifyLineSignature(body, undefined, secret)).toBe(false);
  });
});

interface Captured {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

function clientWith(respond: (captured: Captured) => Promise<Response> | Response) {
  const calls: Captured[] = [];
  const client = createHttpLineClient({
    channelAccessToken: 'token-for-test',
    timeoutMs: 50,
    fetch: (input, init) => {
      const captured: Captured = {
        url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      };
      calls.push(captured);
      return Promise.resolve(respond(captured));
    },
  });
  return { client, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('HTTP LINE client', () => {
  it('pushes a text message with the bearer token and the retry key', async () => {
    const { client, calls } = clientWith(() => json(200, { sentMessages: [] }));

    await client.pushText('U123', 'สวัสดีครับ', '123e4567-e89b-12d3-a456-426614174000');

    expect(calls).toEqual([
      {
        url: 'https://api.line.me/v2/bot/message/push',
        method: 'POST',
        headers: {
          authorization: 'Bearer token-for-test',
          'content-type': 'application/json',
          'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
        },
        body: { to: 'U123', messages: [{ type: 'text', text: 'สวัสดีครับ' }] },
      },
    ]);
  });

  it('treats 409 (retry key already accepted) as delivered', async () => {
    const { client } = clientWith(() =>
      json(409, { message: 'The retry key is already accepted' }),
    );
    await expect(client.pushText('U123', 'hi', 'key')).resolves.toBeUndefined();
  });

  it('marks 5xx and network failures as retryable, 4xx as final', async () => {
    const server = clientWith(() => json(500, { message: 'Internal error' })).client;
    const bad = clientWith(() => json(400, { message: 'The request body has 1 error(s)' })).client;
    const offline = createHttpLineClient({
      channelAccessToken: 't',
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    });

    await expect(server.pushText('U1', 'x', 'k')).rejects.toMatchObject({
      status: 500,
      retryable: true,
      message: 'LINE push 500: Internal error',
    });
    await expect(bad.pushText('U1', 'x', 'k')).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
    const error = await offline.pushText('U1', 'x', 'k').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LineApiError);
    expect(error).toMatchObject({ status: null, retryable: true });
  });

  it('gives up waiting after the timeout and allows a retry', async () => {
    const hanging = createHttpLineClient({
      channelAccessToken: 't',
      timeoutMs: 20,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('The operation timed out')),
          );
        }),
    });
    await expect(hanging.pushText('U1', 'x', 'k')).rejects.toMatchObject({ retryable: true });
  });

  it('reads the profile display name and returns null for unknown users', async () => {
    const found = clientWith(() =>
      json(200, { userId: 'U1', displayName: 'คุณเอ', language: 'th' }),
    );
    const missing = clientWith(() => json(404, { message: 'Not found' }));

    await expect(found.client.getProfile('U1')).resolves.toEqual({ displayName: 'คุณเอ' });
    expect(found.calls[0]?.url).toBe('https://api.line.me/v2/bot/profile/U1');
    await expect(missing.client.getProfile('U2')).resolves.toBeNull();
  });
});
