import type { Logger } from 'pino';
import {
  processWebhookEvent,
  type ProcessResult,
  type WebhookServiceDeps,
} from './webhook.service';

/** รอก่อนประมวลผลซ้ำหลังล้มครั้งที่ 1, 2, 3, 4 — ล้มครั้งที่ 5 เลิกลองเอง (admin สั่งซ้ำได้) */
export const WEBHOOK_RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;
/** event ที่ค้างสถานะ RECEIVED นานเกินนี้ = process ตายระหว่างทำ → เก็บมาทำใหม่ */
const STALE_RECEIVED_MS = 2 * 60_000;

export interface WebhookProcessorDeps extends WebhookServiceDeps {
  /** ให้ AI ร่างคำตอบเมื่อมีข้อความเข้า — null = ปิด */
  requestDraft: ((leadId: string) => Promise<void>) | null;
  /** เปลี่ยนได้ใน test เพื่อจำลองการประมวลผลล้ม */
  processEvent?: (deps: WebhookServiceDeps, id: string) => Promise<ProcessResult>;
  now?: () => Date;
}

export interface WebhookProcessor {
  /** ประมวลผลทีละ event ตามลำดับที่เข้าคิว — resolve เมื่อ id ชุดนี้เสร็จ (ไม่ throw) */
  enqueue(ids: readonly string[]): Promise<void>;
  /** เข้าคิว event ที่ถึงเวลา retry และ event ที่ค้าง — คืนจำนวนที่เข้าคิว */
  enqueueDue(): Promise<number>;
  /** รอจนคิวและงานร่าง AI ว่าง (test / ตอนปิด server) */
  idle(): Promise<void>;
}

/**
 * คิวในหน่วยความจำของ process เดียว — พอสำหรับ MVP ที่รัน api instance เดียว
 * งานไม่หายเมื่อ process ตาย เพราะ event อยู่ใน DB แล้ว (enqueueDue เก็บกลับมาทำ)
 */
export function createWebhookProcessor(deps: WebhookProcessorDeps): WebhookProcessor {
  const processEvent = deps.processEvent ?? processWebhookEvent;
  const now = deps.now ?? (() => new Date());
  const inFlight = new Set<Promise<void>>();
  const drafts = new Map<string, { again: boolean }>();
  let chain: Promise<void> = Promise.resolve();

  function track(task: Promise<void>): Promise<void> {
    inFlight.add(task);
    void task.then(() => inFlight.delete(task));
    return task;
  }

  async function recordFailure(id: string, error: unknown): Promise<void> {
    const current = await deps.prisma.webhookEvent.findUnique({
      where: { id },
      select: { attempts: true },
    });
    if (!current) return;
    const attempts = current.attempts + 1;
    const delay = WEBHOOK_RETRY_BACKOFF_MS[attempts - 1];
    const nextRetryAt = delay === undefined ? null : new Date(now().getTime() + delay);
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await deps.prisma.webhookEvent.update({
      where: { id },
      data: { status: 'FAILED', attempts, lastError, nextRetryAt },
    });
    deps.logger.error(
      { err: error, webhookEventRowId: id, attempts, nextRetryAt },
      'line webhook event failed',
    );
  }

  /** ข้อความเข้ารัวๆ → ร่างรอบเดียวที่เห็นทุกข้อความ แทนการเรียก AI ทุกข้อความ */
  function requestDraft(leadId: string): void {
    const draft = deps.requestDraft;
    if (!draft) return;
    const running = drafts.get(leadId);
    if (running) {
      running.again = true;
      return;
    }
    const state = { again: false };
    drafts.set(leadId, state);
    void track(
      (async () => {
        do {
          state.again = false;
          try {
            await draft(leadId);
          } catch (error) {
            deps.logger.warn({ err: error, leadId }, 'auto ai draft failed');
          }
        } while (state.again);
        drafts.delete(leadId);
      })(),
    );
  }

  async function processOne(id: string): Promise<void> {
    try {
      const result = await processEvent(deps, id);
      if (result.draftLeadId) requestDraft(result.draftLeadId);
    } catch (error) {
      await recordFailure(id, error).catch((recordError: unknown) => {
        deps.logger.error({ err: recordError, webhookEventRowId: id }, 'could not record failure');
      });
    }
  }

  function enqueue(ids: readonly string[]): Promise<void> {
    chain = chain.then(async () => {
      for (const id of ids) await processOne(id);
    });
    return track(chain);
  }

  return {
    enqueue,

    async enqueueDue() {
      const at = now();
      const due = await deps.prisma.webhookEvent.findMany({
        where: {
          OR: [
            { status: 'FAILED', nextRetryAt: { lte: at } },
            { status: 'RECEIVED', receivedAt: { lte: new Date(at.getTime() - STALE_RECEIVED_MS) } },
          ],
        },
        orderBy: { receivedAt: 'asc' },
        select: { id: true },
        take: 50,
      });
      if (due.length > 0) void enqueue(due.map((event) => event.id));
      return due.length;
    },

    async idle() {
      while (inFlight.size > 0) await Promise.all([...inFlight]);
    },
  };
}

/** ตรวจ event ที่ต้อง retry เป็นระยะ (และทันทีตอน start เพื่อเก็บงานที่ค้างจาก process ก่อน) */
export function startWebhookRetryWorker(
  processor: WebhookProcessor,
  logger: Logger,
  intervalMs = 30_000,
): () => void {
  const tick = () => {
    processor
      .enqueueDue()
      .then((count) => {
        if (count > 0) logger.info({ count }, 'retrying line webhook events');
      })
      .catch((error: unknown) => logger.error({ err: error }, 'webhook retry sweep failed'));
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
