'use client';

import { allowedTransitions, type LeadStage } from '@ai-crm/shared';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { STAGE_META } from '@/lib/labels';
import { useChangeStage } from '@/lib/queries';
import { Dialog } from './dialog';
import { useToast } from './toast';
import { Badge, Button, Field, Select, Textarea } from './ui';

export function StageBadge({ stage }: { stage: LeadStage }) {
  const meta = STAGE_META[stage];
  return (
    <Badge className={meta.badge}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

const COMMON_LOST_REASONS = [
  'งบประมาณไม่พอ',
  'เลือกผู้ให้บริการรายอื่น',
  'โปรเจกต์ถูกเลื่อน',
  'ติดต่อลูกค้าไม่ได้',
  'ความต้องการไม่ตรงกับบริการ',
];

function LostReasonDialog({
  open,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  return (
    <Dialog open={open} onClose={onClose} title="ปิด lead เป็น Lost">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = reason.trim();
          if (!trimmed) {
            setError('กรุณาระบุเหตุผล — ใช้วิเคราะห์ว่าทำไมเสียงาน');
            return;
          }
          onConfirm(trimmed);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {COMMON_LOST_REASONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setReason(option);
                setError(undefined);
              }}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              {option}
            </button>
          ))}
        </div>
        <Field label="เหตุผล" htmlFor="lost-reason" error={error}>
          <Textarea
            id="lost-reason"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="danger" loading={pending}>
            ยืนยันปิดเป็น Lost
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** ปุ่ม/เมนูย้าย stage — แสดงเฉพาะ stage ที่กติกาอนุญาต (กติกาเดียวกับ API จาก packages/shared) */
export function StageActions({
  leadId,
  stage,
  compact = false,
}: {
  leadId: string;
  stage: LeadStage;
  compact?: boolean;
}) {
  const change = useChangeStage(leadId);
  const toast = useToast();
  const [lostOpen, setLostOpen] = useState(false);
  const allowed = allowedTransitions(stage);

  function move(to: LeadStage, lostReason?: string) {
    change.mutate(
      { stage: to, lostReason },
      {
        onSuccess: () => {
          setLostOpen(false);
          toast.success(`ย้ายไป ${STAGE_META[to].label} แล้ว`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  function choose(to: LeadStage) {
    if (to === 'LOST') setLostOpen(true);
    else move(to);
  }

  if (allowed.length === 0) {
    return <p className="text-xs text-slate-500">ปิดการขายแล้ว — ย้าย stage ไม่ได้</p>;
  }

  return (
    <>
      {compact ? (
        <Select
          compact
          aria-label="ย้าย stage"
          value=""
          disabled={change.isPending}
          onChange={(event) => {
            const to = allowed.find((candidate) => candidate === event.target.value);
            if (to) choose(to);
          }}
        >
          <option value="">ย้ายไป…</option>
          {allowed.map((to) => (
            <option key={to} value={to}>
              {STAGE_META[to].label}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.map((to) => (
            <Button
              key={to}
              variant={to === 'LOST' ? 'secondary' : 'primary'}
              className={to === 'LOST' ? 'text-rose-700' : undefined}
              loading={change.isPending && change.variables.stage === to}
              disabled={change.isPending}
              onClick={() => choose(to)}
            >
              {to === 'LOST' ? 'ปิดเป็น Lost' : `ย้ายไป ${STAGE_META[to].label}`}
            </Button>
          ))}
        </div>
      )}
      {/* mount เฉพาะตอนเปิด — หน้า pipeline มีการ์ดหลายสิบใบ ไม่ต้องมี <dialog> ค้างทุกใบ */}
      {lostOpen ? (
        <LostReasonDialog
          open
          pending={change.isPending}
          onClose={() => setLostOpen(false)}
          onConfirm={(reason) => move('LOST', reason)}
        />
      ) : null}
    </>
  );
}
