'use client';

import { LINE_TEXT_MAX, messageCreateInputSchema, type MessageCreateInput } from '@ai-crm/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, CardHeader, Field, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, validate, type FieldErrors } from '@/lib/form';
import { useHealth, useInvalidateLeads } from '@/lib/queries';

/** คนพิมพ์ตอบลูกค้าทาง LINE เอง (ไม่ผ่าน AI) — แสดงเฉพาะ contact ที่เชื่อม LINE แล้ว */
export function LineComposer({ leadId }: { leadId: string }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const health = useHealth();
  const invalidate = useInvalidateLeads();
  const toast = useToast();
  const send = useMutation({
    mutationFn: (input: MessageCreateInput) => api.messages.send(leadId, input),
    onSuccess: async (message) => {
      setText('');
      setErrors({});
      if (message.status === 'FAILED') {
        toast.error(
          `ส่งไม่สำเร็จ: ${message.lastError ?? 'ไม่ทราบสาเหตุ'} — กดส่งอีกครั้งได้ใน timeline`,
        );
      } else {
        toast.success('ส่งทาง LINE แล้ว');
      }
      await invalidate(leadId);
    },
    onError: (error) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else toast.error(errorMessage(error));
    },
  });
  const mock = health.data?.line === 'mock';

  return (
    <Card>
      <CardHeader
        title="ตอบลูกค้าทาง LINE"
        action={
          mock ? (
            <Badge className="bg-amber-50 text-amber-800 ring-amber-200">โหมดจำลอง</Badge>
          ) : null
        }
      />
      <form
        noValidate
        className="space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const result = validate(messageCreateInputSchema, { text });
          setErrors(result.ok ? {} : result.errors);
          if (result.ok) send.mutate(result.data);
        }}
      >
        <Field label="ข้อความ" htmlFor="line-text" error={errors.text}>
          <Textarea
            id="line-text"
            maxLength={LINE_TEXT_MAX}
            placeholder="พิมพ์ข้อความถึงลูกค้า…"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={errors.text ? true : undefined}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {mock
              ? 'ตอนนี้ระบบใช้ LINE จำลอง — ข้อความจะไม่ถึงลูกค้าจริง'
              : `${text.length.toLocaleString()} / ${LINE_TEXT_MAX.toLocaleString()} ตัวอักษร`}
          </p>
          <Button type="submit" loading={send.isPending}>
            ส่งทาง LINE
          </Button>
        </div>
      </form>
    </Card>
  );
}
