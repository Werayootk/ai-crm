import type { PublicLeadInput } from '@ai-crm/shared';
import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client';

const OPEN_STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL'] as const;

/**
 * ฟอร์ม "ติดต่อเรา" → Contact (ตาม email) → lead ที่ยังเปิดอยู่ หรือ lead ใหม่ source=WEBSITE (ยังไม่มีเจ้าของ)
 * → ข้อความ WEB_FORM ใน timeline — ไม่แก้ข้อมูล contact เดิมจาก input สาธารณะ (กันคนอื่นมาเขียนทับ)
 */
export async function submitPublicLead(
  deps: { prisma: PrismaClient; logger: Logger },
  input: PublicLeadInput,
): Promise<void> {
  if (input.website) {
    // บอต: ตอบเหมือนสำเร็จ ไม่บันทึก (ไม่บอกว่าจับได้)
    deps.logger.info('public lead ignored: honeypot filled');
    return;
  }

  const result = await deps.prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findUnique({
      where: { email: input.email },
      select: { id: true, companyId: true },
    });
    const contact =
      existing ??
      (await tx.contact.create({
        data: { name: input.name, email: input.email, phone: input.phone ?? null },
        select: { id: true, companyId: true },
      }));

    const open = await tx.lead.findFirst({
      where: { contactId: contact.id, stage: { in: [...OPEN_STAGES] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    let leadId = open?.id;
    const now = new Date();
    if (!leadId) {
      const lead = await tx.lead.create({
        data: {
          title: `ติดต่อผ่านเว็บไซต์ — ${input.company ?? input.name}`,
          source: 'WEBSITE',
          stage: 'NEW',
          contactId: contact.id,
          companyId: contact.companyId,
        },
        select: { id: true },
      });
      leadId = lead.id;
      await tx.activity.create({
        data: {
          leadId,
          type: 'SYSTEM',
          body: 'สร้าง lead จากฟอร์มหน้าเว็บไซต์',
          createdAt: new Date(now.getTime() - 1),
        },
      });
    }

    // สิ่งที่ผู้กรอกบอกมา (ชื่อ / บริษัท / เบอร์) เก็บไว้ในข้อความ ให้ทีมขายตรวจเองก่อนแก้ข้อมูล contact
    const details = [
      `ชื่อ: ${input.name}`,
      input.company ? `บริษัท: ${input.company}` : null,
      input.phone ? `โทร: ${input.phone}` : null,
    ].filter(Boolean);
    await tx.message.create({
      data: {
        leadId,
        contactId: contact.id,
        direction: 'INBOUND',
        channel: 'WEB_FORM',
        status: 'RECEIVED',
        text: `${input.message}\n\n— ${details.join(' · ')}`,
        createdAt: now,
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { updatedAt: now } });
    return { leadId, contactId: contact.id, newContact: !existing, newLead: !open };
  });

  deps.logger.info(result, 'public lead received');
}
