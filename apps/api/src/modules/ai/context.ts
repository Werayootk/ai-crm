import type { CopilotInput } from '@ai-crm/shared';
import type { PrismaClient } from '../../generated/prisma/client';
import { notFound } from '../../http/errors';

const DAY_MS = 86_400_000;
const ACTIVITY_LIMIT = 10;
const MESSAGE_LIMIT = 20;

function truncate(text: string | null, max: number): string | null {
  if (text === null) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * สร้าง context ให้ crm-copilot จาก DB — เลือกเฉพาะ field ที่จำเป็น
 * ไม่ส่ง email / เบอร์โทร / LINE userId ของลูกค้าให้ AI (PII minimization)
 */
export async function buildCopilotInput(
  prisma: PrismaClient,
  leadId: string,
  now: Date = new Date(),
): Promise<CopilotInput> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      title: true,
      stage: true,
      source: true,
      value: true,
      score: true,
      ownerId: true,
      stageChangedAt: true,
      createdAt: true,
      contact: { select: { name: true, jobTitle: true, lineUserId: true } },
      company: { select: { name: true, industry: true, employeeCount: true } },
      activities: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ACTIVITY_LIMIT,
        select: { type: true, body: true, createdAt: true },
      },
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MESSAGE_LIMIT,
        select: { direction: true, channel: true, text: true, createdAt: true },
      },
    },
  });
  if (!lead) throw notFound('Lead');

  const daysSince = (date: Date) =>
    Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));

  return {
    now: now.toISOString(),
    lead: {
      title: lead.title,
      stage: lead.stage,
      source: lead.source,
      value: lead.value === null ? null : lead.value.toNumber(),
      confirmedScore: lead.score,
      daysInStage: daysSince(lead.stageChangedAt),
      ageDays: daysSince(lead.createdAt),
      hasOwner: lead.ownerId !== null,
    },
    contact: {
      name: lead.contact.name,
      jobTitle: lead.contact.jobTitle,
      hasLine: lead.contact.lineUserId !== null,
    },
    company: lead.company,
    activities: lead.activities.reverse().map((activity) => ({
      type: activity.type,
      body: truncate(activity.body, 500),
      at: activity.createdAt.toISOString(),
    })),
    messages: lead.messages.reverse().map((message) => ({
      direction: message.direction,
      channel: message.channel,
      text: truncate(message.text, 1_000) ?? '',
      at: message.createdAt.toISOString(),
    })),
  };
}
