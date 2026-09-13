'use client';

import type { AiSuggestion, AiSuggestionApproveInput, CopilotFlag } from '@ai-crm/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/dialog';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, cx, Field, Input, Spinner, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { formatDate } from '@/lib/format';
import { queryKeys, useInvalidateLeads } from '@/lib/queries';

const FLAG_TEXT: Record<CopilotFlag, string> = {
  PROMPT_INJECTION_SUSPECTED: 'ข้อความลูกค้ามีลักษณะพยายามสั่งระบบ — ตรวจคำแนะนำให้ดีก่อนอนุมัติ',
  PRICE_REQUEST: 'ลูกค้าถามเรื่องราคา — อย่ายืนยันตัวเลขจนกว่าจะมีใบเสนอราคา',
  MISSING_INFO: 'ข้อมูลของ lead ยังน้อย — คะแนนอาจคลาดเคลื่อน',
  NEGATIVE_SENTIMENT: 'ลูกค้ามีท่าทีไม่พอใจ',
  REPLY_REPLACED_BY_GUARDRAIL:
    'ร่างเดิมของ AI มีราคาหรือข้อผูกมัดที่ทีมไม่ได้ให้ ระบบเปลี่ยนเป็นข้อความกลางแล้ว',
};

const FALLBACK_TEXT: Record<string, string> = {
  no_api_key: 'ยังไม่ได้ตั้งค่า AI (ไม่มี API key)',
  timeout: 'AI ตอบช้าเกินกำหนด',
  provider_error: 'ติดต่อ AI ไม่ได้',
  refusal: 'AI ปฏิเสธคำขอ',
  invalid_output: 'คำตอบของ AI ไม่ถูกรูปแบบ',
};

const CONFIDENCE_TEXT = {
  low: 'ความมั่นใจต่ำ',
  medium: 'ความมั่นใจปานกลาง',
  high: 'ความมั่นใจสูง',
};

function SourceNote({ suggestion }: { suggestion: AiSuggestion }) {
  if (suggestion.source === 'LLM') {
    return (
      <p className="text-xs text-slate-500">
        ที่มา: {suggestion.aiModel}
        {suggestion.latencyMs === null
          ? ''
          : ` · ${(suggestion.latencyMs / 1000).toFixed(1)} วินาที`}
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-amber-800">
      <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Fallback</Badge>
      ใช้กติกาสำรอง: {FALLBACK_TEXT[suggestion.fallbackReason ?? ''] ?? suggestion.fallbackReason}
    </p>
  );
}

function Flags({ flags }: { flags: CopilotFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="space-y-1">
      {flags.map((flag) => (
        <li key={flag} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          ⚠ {FLAG_TEXT[flag]}
        </li>
      ))}
    </ul>
  );
}

function useDecision(suggestion: AiSuggestion, leadId: string) {
  const invalidate = useInvalidateLeads();
  const toast = useToast();
  const approve = useMutation({
    mutationFn: (input: AiSuggestionApproveInput) => api.ai.approve(suggestion.id, input),
    onSuccess: async (decision) => {
      if (decision.message?.status === 'FAILED') {
        toast.error('อนุมัติแล้ว แต่ส่ง LINE ไม่สำเร็จ — ดูสถานะใน timeline');
      } else {
        toast.success(decision.message ? 'อนุมัติและส่งข้อความแล้ว' : 'อนุมัติและบันทึกแล้ว');
      }
      await invalidate(leadId);
    },
    onError: async (error) => {
      toast.error(errorMessage(error));
      await invalidate(leadId);
    },
  });
  const reject = useMutation({
    mutationFn: (reason: string) => api.ai.reject(suggestion.id, { reason }),
    onSuccess: async () => {
      toast.success('ไม่ใช้คำแนะนำนี้แล้ว');
      await invalidate(leadId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return { approve, reject };
}

function SuggestionShell({
  title,
  suggestion,
  children,
  actions,
}: {
  title: string;
  suggestion: AiSuggestion;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Badge className="bg-white text-indigo-700 ring-indigo-200">
          รออนุมัติ — ยังไม่ถูกบันทึก
        </Badge>
      </div>
      {children}
      <SourceNote suggestion={suggestion} />
      <div className="flex flex-wrap justify-end gap-2">{actions}</div>
    </div>
  );
}

function RejectButton({
  onReject,
  pending,
}: {
  onReject: (reason: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={pending}>
        ไม่ใช้
      </Button>
      {open ? (
        <Dialog open onClose={() => setOpen(false)} title="ไม่ใช้คำแนะนำนี้">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onReject(reason.trim());
              setOpen(false);
            }}
          >
            <Field label="เหตุผล (ไม่บังคับ) — ช่วยให้ปรับปรุง AI ได้" htmlFor="reject-reason">
              <Textarea
                id="reject-reason"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="danger">
                ยืนยันไม่ใช้
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

function QualificationSuggestion({
  suggestion,
  leadId,
}: {
  suggestion: Extract<AiSuggestion, { type: 'QUALIFICATION' }>;
  leadId: string;
}) {
  const { approve, reject } = useDecision(suggestion, leadId);
  const [score, setScore] = useState(String(suggestion.payload.score));
  const [summary, setSummary] = useState(suggestion.payload.summary);
  const scoreNumber = Number(score);
  const scoreValid = Number.isInteger(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 100;
  const { payload } = suggestion;

  return (
    <SuggestionShell
      title="สรุปและคะแนน"
      suggestion={suggestion}
      actions={
        <>
          <RejectButton onReject={(reason) => reject.mutate(reason)} pending={reject.isPending} />
          <Button
            loading={approve.isPending}
            disabled={!scoreValid || summary.trim() === ''}
            onClick={() => approve.mutate({ score: scoreNumber, summary: summary.trim() })}
          >
            ยืนยันคะแนนและสรุป
          </Button>
        </>
      }
    >
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums text-slate-900">{payload.score}</span>
        <span className="text-xs text-slate-500">
          / 100 · {CONFIDENCE_TEXT[payload.confidence]}
        </span>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {payload.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <Flags flags={payload.flags} />
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field
          label="คะแนนที่จะบันทึก"
          htmlFor={`score-${suggestion.id}`}
          error={scoreValid ? undefined : 'ใส่ 0–100'}
        >
          <Input
            id={`score-${suggestion.id}`}
            inputMode="numeric"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </Field>
        <Field label="สรุปที่จะบันทึก" htmlFor={`summary-${suggestion.id}`}>
          <Textarea
            id={`summary-${suggestion.id}`}
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Field>
      </div>
    </SuggestionShell>
  );
}

function localDateInput(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function NextActionSuggestion({
  suggestion,
  leadId,
}: {
  suggestion: Extract<AiSuggestion, { type: 'NEXT_ACTION' }>;
  leadId: string;
}) {
  const { approve, reject } = useDecision(suggestion, leadId);
  const [action, setAction] = useState(suggestion.payload.action);
  const [due, setDue] = useState(localDateInput(suggestion.payload.dueInDays));

  return (
    <SuggestionShell
      title="สิ่งที่ควรทำต่อ"
      suggestion={suggestion}
      actions={
        <>
          <RejectButton onReject={(reason) => reject.mutate(reason)} pending={reject.isPending} />
          <Button
            loading={approve.isPending}
            disabled={action.trim() === '' || due === ''}
            onClick={() =>
              // 09:00 ตามเวลาเครื่องของผู้ใช้ในวันที่เลือก
              approve.mutate({
                action: action.trim(),
                dueAt: new Date(`${due}T09:00`).toISOString(),
              })
            }
          >
            สร้างเป็นงานที่ต้องทำ
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{suggestion.payload.rationale}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <Field label="งาน" htmlFor={`action-${suggestion.id}`}>
          <Input
            id={`action-${suggestion.id}`}
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />
        </Field>
        <Field
          label="กำหนด"
          htmlFor={`due-${suggestion.id}`}
          hint={formatDate(new Date(`${due}T09:00`).toISOString())}
        >
          <Input
            id={`due-${suggestion.id}`}
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </Field>
      </div>
    </SuggestionShell>
  );
}

function LineReplySuggestion({
  suggestion,
  leadId,
}: {
  suggestion: Extract<AiSuggestion, { type: 'LINE_REPLY' }>;
  leadId: string;
}) {
  const { approve, reject } = useDecision(suggestion, leadId);
  const [text, setText] = useState(suggestion.payload.text);

  return (
    <SuggestionShell
      title="ร่างข้อความตอบทาง LINE"
      suggestion={suggestion}
      actions={
        <>
          <RejectButton onReject={(reason) => reject.mutate(reason)} pending={reject.isPending} />
          <Button
            loading={approve.isPending}
            disabled={text.trim() === ''}
            onClick={() => approve.mutate({ text: text.trim() })}
          >
            อนุมัติและส่งทาง LINE
          </Button>
        </>
      }
    >
      <Flags flags={suggestion.payload.flags.filter((flag) => flag !== 'MISSING_INFO')} />
      <Field
        label="ข้อความ (แก้ได้ก่อนส่ง — เติมคำลงท้าย ครับ/ค่ะ เองได้)"
        htmlFor={`reply-${suggestion.id}`}
        hint={`${text.length}/1000 ตัวอักษร`}
      >
        <Textarea
          id={`reply-${suggestion.id}`}
          rows={4}
          maxLength={1000}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
    </SuggestionShell>
  );
}

const ORDER = { QUALIFICATION: 0, NEXT_ACTION: 1, LINE_REPLY: 2 } as const;

/** คำแนะนำจาก AI — ทุกอย่างเป็นข้อเสนอ ต้องกดอนุมัติก่อนถึงจะเขียนลง CRM หรือส่งออก */
export function AiPanel({ leadId }: { leadId: string }) {
  const toast = useToast();
  const invalidate = useInvalidateLeads();
  const pending = useQuery({
    queryKey: queryKeys.suggestions(leadId),
    queryFn: () => api.ai.list(leadId, 'PENDING'),
  });
  const ask = useMutation({
    mutationFn: () => api.ai.ask(leadId),
    onSuccess: async (result) => {
      const fallback = result.items[0]?.source === 'FALLBACK';
      toast.success(fallback ? 'ได้คำแนะนำจากกติกาสำรอง' : 'AI วิเคราะห์เสร็จแล้ว');
      await invalidate(leadId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const items = [...(pending.data?.items ?? [])].sort((a, b) => ORDER[a.type] - ORDER[b.type]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI Copilot</h2>
          <p className="text-xs text-slate-500">
            สรุป · ให้คะแนน · แนะนำสิ่งที่ควรทำ · ร่างข้อความตอบ LINE
          </p>
        </div>
        <Button
          variant={items.length > 0 ? 'secondary' : 'primary'}
          loading={ask.isPending}
          onClick={() => ask.mutate()}
        >
          {items.length > 0 ? 'ขอคำแนะนำใหม่' : 'ขอคำแนะนำจาก AI'}
        </Button>
      </div>

      {ask.isPending ? (
        <p
          className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600"
          role="status"
        >
          <Spinner className="size-4" /> AI กำลังอ่านข้อมูลของ lead นี้… อาจใช้เวลาสักครู่
        </p>
      ) : null}

      {pending.isPending ? null : items.length === 0 && !ask.isPending ? (
        <p className="text-sm text-slate-500">
          ยังไม่มีคำแนะนำที่รออนุมัติ — คำแนะนำทุกอย่างจะยังไม่ถูกบันทึกหรือส่งออก จนกว่าจะกดอนุมัติ
        </p>
      ) : (
        <div className={cx('space-y-3', ask.isPending && 'opacity-50')}>
          {items.map((suggestion) => {
            switch (suggestion.type) {
              case 'QUALIFICATION':
                return (
                  <QualificationSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    leadId={leadId}
                  />
                );
              case 'NEXT_ACTION':
                return (
                  <NextActionSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    leadId={leadId}
                  />
                );
              case 'LINE_REPLY':
                return (
                  <LineReplySuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    leadId={leadId}
                  />
                );
            }
          })}
        </div>
      )}
    </Card>
  );
}
