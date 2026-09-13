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
  let failAfterAccept = false;

  const accept = (to: string, text: string, retryKey: string) => {
    if (acceptedKeys.has(retryKey)) return;
    acceptedKeys.add(retryKey);
    sent.push({ to, text, retryKey });
  };

  const client: LineClient & {
    sent: SentLineMessage[];
    /**
     * ให้ n ครั้งถัดไปล้มด้วย error ที่กำหนด (default = 503 ลองซ้ำได้)
     * afterAccept: LINE รับข้อความไปแล้วแต่คำตอบหายระหว่างทาง (เช่น timeout)
     */
    failNext: (times: number, error?: LineApiError, options?: { afterAccept?: boolean }) => void;
  } = {
    mode: 'mock',
    sent,
    failNext(times, error, options) {
      failuresLeft = times;
      if (error) failure = error;
      failAfterAccept = options?.afterAccept ?? false;
    },
    pushText(to, text, retryKey) {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        if (failAfterAccept) accept(to, text, retryKey);
        return Promise.reject(failure);
      }
      accept(to, text, retryKey);
      return Promise.resolve();
    },
    getProfile(userId) {
      return Promise.resolve({ displayName: `LINE ${userId.slice(-4)}` });
    },
  };
  return client;
}
