'use client';

import { leadUpdateInputSchema, type LeadDetail } from '@ai-crm/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { z } from 'zod';
import { Dialog } from '@/components/dialog';
import { useToast } from '@/components/toast';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, numberOrNull, validate, type FieldErrors } from '@/lib/form';
import { useInvalidateLeads, useUsers } from '@/lib/queries';

function EditForm({ lead, onDone }: { lead: LeadDetail; onDone: () => void }) {
  const users = useUsers();
  const invalidate = useInvalidateLeads();
  const toast = useToast();
  const [title, setTitle] = useState(lead.title);
  const [value, setValue] = useState(lead.value?.toString() ?? '');
  const [score, setScore] = useState(lead.score?.toString() ?? '');
  const [ownerId, setOwnerId] = useState(lead.owner?.id ?? '');
  const [summary, setSummary] = useState(lead.summary ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useMutation({
    mutationFn: (input: z.input<typeof leadUpdateInputSchema>) => api.leads.update(lead.id, input),
    onSuccess: async () => {
      toast.success('บันทึกแล้ว');
      await invalidate(lead.id);
      onDone();
    },
    onError: (error) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else toast.error(errorMessage(error));
    },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        // ส่งทุก field — API บันทึก audit เฉพาะ field ที่ค่าเปลี่ยนจริง
        const result = validate(leadUpdateInputSchema, {
          title,
          value: numberOrNull(value),
          score: numberOrNull(score),
          ownerId: ownerId || null,
          summary,
        });
        setErrors(result.ok ? {} : result.errors);
        if (result.ok) save.mutate(result.data);
      }}
    >
      <Field label="ชื่อ lead" htmlFor="edit-title" error={errors.title}>
        <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="มูลค่าดีล (บาท)" htmlFor="edit-value" error={errors.value}>
          <Input
            id="edit-value"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="คะแนน (0–100)" htmlFor="edit-score" error={errors.score}>
          <Input
            id="edit-score"
            inputMode="numeric"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </Field>
      </div>
      <Field label="ผู้รับผิดชอบ" htmlFor="edit-owner" error={errors.ownerId}>
        <Select
          id="edit-owner"
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
        >
          <option value="">ยังไม่มีผู้รับผิดชอบ</option>
          {users.data?.items.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="สรุป" htmlFor="edit-summary" error={errors.summary}>
        <Textarea
          id="edit-summary"
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button type="submit" loading={save.isPending}>
          บันทึก
        </Button>
      </div>
    </form>
  );
}

export function LeadEditDialog({
  lead,
  open,
  onClose,
}: {
  lead: LeadDetail;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="แก้ไข lead">
      <EditForm lead={lead} onDone={onClose} />
    </Dialog>
  );
}
