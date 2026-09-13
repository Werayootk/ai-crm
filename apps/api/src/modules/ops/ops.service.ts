import type { OpsSummary } from '@ai-crm/shared';
import type { PrismaClient } from '../../generated/prisma/client';

const DAY_MS = 86_400_000;
const STUCK_MS = 5 * 60_000;

/**
 * ตัวเลขที่ควร alert (ดู docs/monitoring.md) — นับจาก DB ตรงๆ ไม่มี state ในหน่วยความจำ
 * AI นับจาก suggestion ประเภท QUALIFICATION เพราะการขอคำแนะนำ 1 ครั้งสร้างประเภทนี้ 1 รายการเสมอ
 */
export async function getOpsSummary(prisma: PrismaClient, now = new Date()): Promise<OpsSummary> {
  const since = new Date(now.getTime() - DAY_MS);
  const aiWindow = { type: 'QUALIFICATION' as const, createdAt: { gte: since } };

  const [
    failedEvents,
    gaveUpEvents,
    stuckEvents,
    failedMessages,
    requests,
    fallbacks,
    latency,
    pendingApprovals,
    unassignedNew,
  ] = await Promise.all([
    prisma.webhookEvent.count({ where: { status: 'FAILED', nextRetryAt: { not: null } } }),
    prisma.webhookEvent.count({ where: { status: 'FAILED', nextRetryAt: null } }),
    prisma.webhookEvent.count({
      where: { status: 'RECEIVED', receivedAt: { lte: new Date(now.getTime() - STUCK_MS) } },
    }),
    prisma.message.count({ where: { direction: 'OUTBOUND', status: 'FAILED' } }),
    prisma.aiSuggestion.count({ where: aiWindow }),
    prisma.aiSuggestion.count({ where: { ...aiWindow, source: 'FALLBACK' } }),
    prisma.aiSuggestion.aggregate({
      where: { ...aiWindow, source: 'LLM' },
      _avg: { latencyMs: true },
    }),
    prisma.aiSuggestion.count({ where: { status: 'PENDING' } }),
    prisma.lead.count({ where: { stage: 'NEW', ownerId: null } }),
  ]);

  const avg = latency._avg.latencyMs;
  return {
    since: since.toISOString(),
    line: { failedEvents, gaveUpEvents, stuckEvents, failedMessages },
    ai: {
      requests,
      fallbackRate: requests === 0 ? null : Math.round((fallbacks / requests) * 1_000) / 1_000,
      avgLlmLatencyMs: avg === null ? null : Math.round(avg),
      pendingApprovals,
    },
    leads: { unassignedNew },
  };
}
