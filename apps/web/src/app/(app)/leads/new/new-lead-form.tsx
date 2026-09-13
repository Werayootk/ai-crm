'use client';

import { leadCreateInputSchema, type EntityRef } from '@ai-crm/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { z } from 'zod';
import { useCurrentUser } from '@/components/app-shell';
import { EntityPicker } from '@/components/entity-picker';
import { useToast } from '@/components/toast';
import { Button, Card, cx, Field, Input, PageHeader, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, numberOrNull, validate, type FieldErrors } from '@/lib/form';
import { queryKeys, useInvalidateLeads, useUsers } from '@/lib/queries';

type ContactMode = 'existing' | 'new';

export function NewLeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetContactId = searchParams.get('contactId');
  const me = useCurrentUser();
  const users = useUsers();
  const toast = useToast();
  const invalidate = useInvalidateLeads();

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [ownerId, setOwnerId] = useState(me.id);
  const [mode, setMode] = useState<ContactMode>('existing');
  const [contact, setContact] = useState<EntityRef | null>(null);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', jobTitle: '' });
  const [company, setCompany] = useState<EntityRef | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  // มาจากหน้า contact (?contactId=) → เลือก contact นั้นไว้ให้
  const preset = useQuery({
    queryKey: queryKeys.contact(presetContactId ?? ''),
    queryFn: () => api.contacts.get(presetContactId ?? ''),
    enabled: presetContactId !== null,
  });
  const selectedContact =
    contact ??
    (preset.data && mode === 'existing' ? { id: preset.data.id, name: preset.data.name } : null);

  const create = useMutation({
    mutationFn: (input: z.input<typeof leadCreateInputSchema>) => api.leads.create(input),
    onSuccess: async (lead) => {
      toast.success('สร้าง lead แล้ว');
      await invalidate();
      router.push(`/leads/${lead.id}`);
    },
    onError: (error) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else toast.error(errorMessage(error));
    },
  });

  function submit() {
    const result = validate(leadCreateInputSchema, {
      title,
      value: numberOrNull(value),
      ownerId: ownerId || null,
      ...(mode === 'existing'
        ? { contactId: selectedContact?.id }
        : { contact: { ...newContact, companyId: company?.id ?? null } }),
    });
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) create.mutate(result.data);
  }

  const setNewContactField =
    (field: keyof typeof newContact) => (event: { target: { value: string } }) =>
      setNewContact((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <PageHeader title="สร้าง lead" description="บันทึกโอกาสขายใหม่ที่ได้จากการติดต่อโดยตรง" />
      <Card className="max-w-2xl p-5">
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field
            label="ชื่อ lead"
            htmlFor="lead-title"
            error={errors.title}
            hint="เช่น ปรับปรุงเว็บไซต์ — บริษัท ABC"
          >
            <Input
              id="lead-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={errors.title ? true : undefined}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="มูลค่าดีลโดยประมาณ (บาท)" htmlFor="lead-value" error={errors.value}>
              <Input
                id="lead-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
            <Field label="ผู้รับผิดชอบ" htmlFor="lead-owner" error={errors.ownerId}>
              <Select
                id="lead-owner"
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                <option value="">ยังไม่มีผู้รับผิดชอบ</option>
                {users.data?.items.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                    {user.id === me.id ? ' (ฉัน)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700">ผู้ติดต่อ</legend>
            <div className="inline-flex rounded-md bg-slate-100 p-1" role="radiogroup">
              {(['existing', 'new'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={mode === option}
                  onClick={() => setMode(option)}
                  className={cx(
                    'rounded px-3 py-1.5 text-sm',
                    mode === option
                      ? 'bg-white font-medium text-slate-900 shadow-sm'
                      : 'text-slate-600',
                  )}
                >
                  {option === 'existing' ? 'เลือกจากที่มีอยู่' : 'เพิ่มผู้ติดต่อใหม่'}
                </button>
              ))}
            </div>

            {mode === 'existing' ? (
              <Field
                label="ค้นหาผู้ติดต่อ"
                htmlFor="lead-contact"
                error={errors.contactId ? 'กรุณาเลือกผู้ติดต่อ' : undefined}
              >
                <EntityPicker
                  kind="contact"
                  id="lead-contact"
                  value={selectedContact}
                  onChange={setContact}
                  invalid={Boolean(errors.contactId)}
                />
              </Field>
            ) : (
              <div className="grid gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-2">
                <Field label="ชื่อ" htmlFor="contact-name" error={errors['contact.name']}>
                  <Input
                    id="contact-name"
                    value={newContact.name}
                    onChange={setNewContactField('name')}
                  />
                </Field>
                <Field label="ตำแหน่ง" htmlFor="contact-job" error={errors['contact.jobTitle']}>
                  <Input
                    id="contact-job"
                    value={newContact.jobTitle}
                    onChange={setNewContactField('jobTitle')}
                  />
                </Field>
                <Field label="อีเมล" htmlFor="contact-email" error={errors['contact.email']}>
                  <Input
                    id="contact-email"
                    type="email"
                    value={newContact.email}
                    onChange={setNewContactField('email')}
                  />
                </Field>
                <Field label="เบอร์โทร" htmlFor="contact-phone" error={errors['contact.phone']}>
                  <Input
                    id="contact-phone"
                    inputMode="tel"
                    value={newContact.phone}
                    onChange={setNewContactField('phone')}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="บริษัท (ถ้ามี)"
                    htmlFor="contact-company"
                    error={errors['contact.companyId']}
                  >
                    <EntityPicker
                      kind="company"
                      id="contact-company"
                      value={company}
                      onChange={setCompany}
                    />
                  </Field>
                </div>
              </div>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>
              ยกเลิก
            </Button>
            <Button type="submit" loading={create.isPending}>
              สร้าง lead
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
