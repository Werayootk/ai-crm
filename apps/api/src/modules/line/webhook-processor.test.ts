import { afterAll, describe, expect, it } from 'vitest';
import { silentLogger } from '../../../test/helpers';
import { createTestPrisma } from '../../../test/test-db';
import { createMockLineClient } from './mock-line-client';
import { createWebhookProcessor } from './webhook-processor';

// ส่วนคิวล้วนๆ — processEvent ถูกแทนด้วยตัวจำลอง จึงไม่แตะ DB
const prisma = createTestPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('webhook processor queue', () => {
  it('processes events one at a time in arrival order', async () => {
    const order: string[] = [];
    let running = 0;
    const processor = createWebhookProcessor({
      prisma,
      logger: silentLogger,
      line: createMockLineClient(),
      requestDraft: null,
      processEvent: async (_deps, id) => {
        running += 1;
        expect(running).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(id);
        running -= 1;
        return { draftLeadId: null };
      },
    });

    void processor.enqueue(['a', 'b']);
    void processor.enqueue(['c']);
    await processor.idle();

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('coalesces AI drafts for a lead while one is still running', async () => {
    const drafts: string[] = [];
    let release: () => void = () => undefined;
    const firstDraftStarted = new Promise<void>((started) => {
      release = started;
    });
    let unblock: () => void = () => undefined;
    const gate = new Promise<void>((open) => {
      unblock = open;
    });

    const processor = createWebhookProcessor({
      prisma,
      logger: silentLogger,
      line: createMockLineClient(),
      requestDraft: async (leadId) => {
        drafts.push(leadId);
        if (drafts.length === 1) {
          release();
          await gate; // ร่างแรกยังไม่เสร็จ ขณะที่ข้อความใหม่เข้ามาอีก 3 ข้อความ
        }
      },
      processEvent: () => Promise.resolve({ draftLeadId: 'lead-1' }),
    });

    void processor.enqueue(['m1']);
    await firstDraftStarted;
    await processor.enqueue(['m2', 'm3', 'm4']);
    unblock();
    await processor.idle();

    // ร่างแรก + ร่างอีกรอบเดียวที่เห็นทุกข้อความ (ไม่ใช่ 4 รอบ)
    expect(drafts).toEqual(['lead-1', 'lead-1']);
  });
});
