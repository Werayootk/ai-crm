'use client';

import { publicLeadInputSchema, type PublicLeadInput } from '@ai-crm/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, validate, type FieldErrors } from '@/lib/form';

const EMPTY = { name: '', email: '', phone: '', company: '', message: '', website: '' };

export function ContactForm() {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useMutation({
    mutationFn: (input: PublicLeadInput) => api.submitPublicLead(input),
    onError: (error) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
    },
  });
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  if (submit.isSuccess) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-medium text-slate-900">ได้รับข้อมูลแล้ว ขอบคุณครับ/ค่ะ</p>
        <p className="mt-2 text-sm text-slate-500">
          ทีมงานจะติดต่อกลับทางอีเมลหรือโทรศัพท์ที่ให้ไว้
        </p>
      </Card>
    );
  }

  const rateLimited = submit.error instanceof ApiError && submit.error.status === 429;

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const result = validate(publicLeadInputSchema, {
            ...values,
            website: values.website || undefined,
            consent,
          });
          setErrors(result.ok ? {} : result.errors);
          if (result.ok) submit.mutate(result.data);
        }}
      >
        <Field label="ชื่อ-นามสกุล" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            autoComplete="name"
            maxLength={200}
            value={values.name}
            onChange={(event) => set('name')(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="อีเมล" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => set('email')(event.target.value)}
              aria-invalid={errors.email ? true : undefined}
            />
          </Field>
          <Field label="เบอร์โทร (ไม่บังคับ)" htmlFor="phone" error={errors.phone}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => set('phone')(event.target.value)}
              aria-invalid={errors.phone ? true : undefined}
            />
          </Field>
        </div>
        <Field label="บริษัท (ไม่บังคับ)" htmlFor="company" error={errors.company}>
          <Input
            id="company"
            autoComplete="organization"
            maxLength={200}
            value={values.company}
            onChange={(event) => set('company')(event.target.value)}
            aria-invalid={errors.company ? true : undefined}
          />
        </Field>
        <Field label="สิ่งที่ต้องการ" htmlFor="message" error={errors.message}>
          <Textarea
            id="message"
            maxLength={2000}
            placeholder="เช่น อยากทำเว็บไซต์องค์กรใหม่ มี 5 หน้า เริ่มได้ภายในไตรมาสนี้"
            value={values.message}
            onChange={(event) => set('message')(event.target.value)}
            aria-invalid={errors.message ? true : undefined}
          />
        </Field>

        {/* honeypot: คนมองไม่เห็นและกดไปไม่ถึง — บอตที่กรอกทุกช่องจะถูกทิ้งเงียบๆ */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">เว็บไซต์</label>
          <input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(event) => set('website')(event.target.value)}
          />
        </div>

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
            />
            <span>ยินยอมให้ทีมงานเก็บข้อมูลนี้เพื่อติดต่อกลับเรื่องที่สอบถาม</span>
          </label>
          {errors.consent ? <p className="mt-1 text-xs text-rose-600">{errors.consent}</p> : null}
        </div>

        {submit.isError && !apiFieldErrors(submit.error) ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {rateLimited ? 'ส่งบ่อยเกินไป กรุณาลองใหม่ภายหลัง' : errorMessage(submit.error)}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={submit.isPending}>
          ส่งข้อมูล
        </Button>
      </form>
    </Card>
  );
}
