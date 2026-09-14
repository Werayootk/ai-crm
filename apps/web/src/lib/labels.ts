import type { ActivityType, LeadSource, LeadStage, MessageStatus } from '@ai-crm/shared';

export const STAGE_META: Record<
  LeadStage,
  { label: string; hint: string; badge: string; dot: string }
> = {
  NEW: {
    label: 'New',
    hint: 'ยังไม่ได้คัดกรอง',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
  },
  QUALIFIED: {
    label: 'Qualified',
    hint: 'ผ่านการคัดกรองแล้ว',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
  },
  PROPOSAL: {
    label: 'Proposal',
    hint: 'ส่งข้อเสนอแล้ว',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
  },
  WON: {
    label: 'Won',
    hint: 'ปิดการขายได้',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  LOST: {
    label: 'Lost',
    hint: 'ไม่ได้งาน',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
  },
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  WEBSITE: 'เว็บไซต์',
  MANUAL: 'ทีมขายบันทึก',
  LINE: 'LINE OA',
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: 'บันทึก',
  CALL: 'โทร',
  MEETING: 'ประชุม',
  TASK: 'งานที่ต้องทำ',
  STAGE_CHANGE: 'เปลี่ยน stage',
  AI_APPROVED: 'อนุมัติข้อเสนอ AI',
  AI_REJECTED: 'ปฏิเสธข้อเสนอ AI',
  SYSTEM: 'ระบบ',
};

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  RECEIVED: 'ได้รับ',
  QUEUED: 'รอส่ง',
  SENT: 'ส่งแล้ว',
  FAILED: 'ส่งไม่สำเร็จ',
};
