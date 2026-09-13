import { LineApiError, type LineClient } from './line-client';

export interface SentLineMessage {
  to: string;
  text: string;
  retryKey: string;
}

/**
 * LINE จำลองในหน่วยความจำ — ใช้ใน test และตอนทดลองบนเครื่องโดยไม่มี LINE channel
 * พฤติกรรมเหมือนของจริงในเรื่องที่สำคัญ: retryKey เดิมที่ส่งสำเร็จแล้วจะไม่ถูกส่งซ้ำ
 */
export function createMockLineClient() {
  const sent: SentLineMessage[] = [];
  const acceptedKeys = new Set<string>();
  let failuresLeft = 0;
  let failure: LineApiError = new LineApiError('LINE API unavailable (mock)', 503, true);

  const client: LineClient & {
    sent: SentLineMessage[];
    /** ให้ n ครั้งถัดไปล้มด้วย error ที่กำหนด (default = 503 ลองซ้ำได้) */
    failNext: (times: number, error?: LineApiError) => void;
  } = {
    mode: 'mock',
    sent,
    failNext(times, error) {
      failuresLeft = times;
      if (error) failure = error;
    },
    pushText(to, text, retryKey) {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return Promise.reject(failure);
      }
      if (!acceptedKeys.has(retryKey)) {
        acceptedKeys.add(retryKey);
        sent.push({ to, text, retryKey });
      }
      return Promise.resolve();
    },
    getProfile(userId) {
      return Promise.resolve({ displayName: `LINE ${userId.slice(-4)}` });
    },
  };
  return client;
}
