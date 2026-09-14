/** error จาก LINE Messaging API — `retryable` บอกว่าลองซ้ำแล้วมีโอกาสสำเร็จหรือไม่ */
export class LineApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LineApiError';
  }
}

export interface LineProfile {
  displayName: string;
}

/**
 * ช่องทางส่ง / อ่านข้อมูลจาก LINE — มี 2 แบบ: mock (test / local) และ live (Phase 5)
 * ส่งข้อความผ่าน Push API พร้อม X-Line-Retry-Key: ส่ง key เดิมซ้ำ LINE จะไม่ส่งซ้ำให้ลูกค้า
 */
export interface LineClient {
  readonly mode: 'mock' | 'live';
  pushText(to: string, text: string, retryKey: string): Promise<void>;
  getProfile(userId: string): Promise<LineProfile | null>;
}
