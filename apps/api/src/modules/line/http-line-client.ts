import { z } from 'zod';
import { LineApiError, type LineClient } from './line-client';

// รูปแบบตาม OpenAPI ของ LINE (github.com/line/line-openapi) และเอกสาร "Retrying an API request"

const LINE_API_URL = 'https://api.line.me';

const profileSchema = z.object({ displayName: z.string() });
const errorBodySchema = z.object({ message: z.string() });

export interface HttpLineClientOptions {
  channelAccessToken: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  baseUrl?: string;
}

/** LINE Messaging API จริง — ใช้เมื่อ LINE_MODE=live */
export function createHttpLineClient(options: HttpLineClientOptions): LineClient {
  const doFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? LINE_API_URL;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call(
    path: string,
    init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
  ): Promise<Response> {
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method: init.method,
        body: init.body,
        headers: { Authorization: `Bearer ${options.channelAccessToken}`, ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // network ล่ม / timeout: LINE แนะนำให้ลองซ้ำ (ด้วย retry key เดิม)
      const reason = error instanceof Error ? error.message : String(error);
      throw new LineApiError(`LINE request failed: ${reason}`, null, true);
    }
  }

  async function failure(res: Response, action: string): Promise<LineApiError> {
    const body: unknown = await res.json().catch(() => null);
    const parsed = errorBodySchema.safeParse(body);
    const detail = parsed.success ? parsed.data.message : res.statusText;
    // LINE: 5xx ลองซ้ำแล้วอาจสำเร็จ, 4xx ลองซ้ำไม่ช่วย
    return new LineApiError(
      `LINE ${action} ${res.status}: ${detail}`,
      res.status,
      res.status >= 500,
    );
  }

  return {
    mode: 'live',

    async pushText(to, text, retryKey) {
      const res = await call('/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Line-Retry-Key': retryKey },
        body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      });
      // 409 = retry key นี้ LINE รับไปแล้วในรอบก่อน (ข้อความถึงลูกค้าแล้ว) → ถือว่าส่งสำเร็จ
      if (res.ok || res.status === 409) {
        await res.body?.cancel();
        return;
      }
      throw await failure(res, 'push');
    },

    async getProfile(userId) {
      const res = await call(`/v2/bot/profile/${encodeURIComponent(userId)}`, { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok) throw await failure(res, 'profile');
      const parsed = profileSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new LineApiError('LINE profile response has an unexpected shape', res.status, false);
      }
      return { displayName: parsed.data.displayName };
    },
  };
}
