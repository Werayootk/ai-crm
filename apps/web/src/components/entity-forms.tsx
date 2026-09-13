'use client';

import {
  companyCreateInputSchema,
  contactCreateInputSchema,
  type Company,
  type Contact,
  type EntityRef,
} from '@ai-crm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { z } from 'zod';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, numberOrNull, validate, type FieldErrors } from '@/lib/form';
import { EntityPicker } from './entity-picker';
import { useToast } from './toast';
import { Button, Field, Input } from './ui';

function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const toast = useToast();
  return {
    errors,
    setErrors,
    /** 400 ที่บอก field → ใต้ field, อย่างอื่น (เช่น 409 ซ้ำ) ถ้ามี issue ก็แสดงใต้ field เหมือนกัน */
    onError: (error: unknown) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else toast.error(errorMessage(error));
    },
  };
}

function FormActions({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </div>
  );
}

// ───────── contact ─────────

export function ContactForm({
  contact,
  onSaved,
  onCancel,
}: {
  /** ไม่ส่ง = สร้างใหม่ */
  contact?: Contact;
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { errors, setErrors, onError } = useFieldErrors();
  const [values, setValues] = useState({
    name: contact?.name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    jobTitle: contact?.jobTitle ?? '',
  });
  const [company, setCompany] = useState<EntityRef | null>(contact?.company ?? null);

  const save = useMutation({
    mutationFn: (input: z.input<typeof contactCreateInputSchema>) =>
      contact ? api.contacts.update(contact.id, input) : api.contacts.create(input),
    onSuccess: async (saved) => {
      toast.success(contact ? 'บันทึกแล้ว' : 'เพิ่มผู้ติดต่อแล้ว');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['contact'] }),
        queryClient.invalidateQueries({ queryKey: ['company'] }),
      ]);
      onSaved(saved);
    },
    onError,
  });

  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
    'aria-invalid': errors[field] ? true : undefined,
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validate(contactCreateInputSchema, {
          ...values,
          companyId: company?.id ?? null,
        });
        setErrors(result.ok ? {} : result.errors);
        if (result.ok) save.mutate(result.data);
      }}
    >
      <Field label="ชื่อ" htmlFor="contact-form-name" error={errors.name}>
        <Input id="contact-form-name" {...bind('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="อีเมล" htmlFor="contact-form-email" error={errors.email}>
          <Input id="contact-form-email" type="email" {...bind('email')} />
        </Field>
        <Field label="เบอร์โทร" htmlFor="contact-form-phone" error={errors.phone}>
          <Input id="contact-form-phone" inputMode="tel" {...bind('phone')} />
        </Field>
      </div>
      <Field label="ตำแหน่ง" htmlFor="contact-form-job" error={errors.jobTitle}>
        <Input id="contact-form-job" {...bind('jobTitle')} />
      </Field>
      <Field label="บริษัท" htmlFor="contact-form-company" error={errors.companyId}>
        <EntityPicker
          kind="company"
          id="contact-form-company"
          value={company}
          onChange={setCompany}
        />
      </Field>
      <FormActions
        pending={save.isPending}
        onCancel={onCancel}
        label={contact ? 'บันทึก' : 'เพิ่มผู้ติดต่อ'}
      />
    </form>
  );
}

// ───────── company ─────────

export function CompanyForm({
  company,
  onSaved,
  onCancel,
}: {
  company?: Company;
  onSaved: (company: Company) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { errors, setErrors, onError } = useFieldErrors();
  const [values, setValues] = useState({
    name: company?.name ?? '',
    domain: company?.domain ?? '',
    industry: company?.industry ?? '',
    employeeCount: company?.employeeCount?.toString() ?? '',
  });

  const save = useMutation({
    mutationFn: (input: z.input<typeof companyCreateInputSchema>) =>
      company ? api.companies.update(company.id, input) : api.companies.create(input),
    onSuccess: async (saved) => {
      toast.success(company ? 'บันทึกแล้ว' : 'เพิ่มบริษัทแล้ว');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
        queryClient.invalidateQueries({ queryKey: ['company'] }),
      ]);
      onSaved(saved);
    },
    onError,
  });

  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
    'aria-invalid': errors[field] ? true : undefined,
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validate(companyCreateInputSchema, {
          ...values,
          employeeCount: numberOrNull(values.employeeCount),
        });
        setErrors(result.ok ? {} : result.errors);
        if (result.ok) save.mutate(result.data);
      }}
    >
      <Field label="ชื่อบริษัท" htmlFor="company-form-name" error={errors.name}>
        <Input id="company-form-name" {...bind('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="โดเมน"
          htmlFor="company-form-domain"
          error={errors.domain}
          hint="เช่น example.co.th"
        >
          <Input id="company-form-domain" {...bind('domain')} />
        </Field>
        <Field label="อุตสาหกรรม" htmlFor="company-form-industry" error={errors.industry}>
          <Input id="company-form-industry" {...bind('industry')} />
        </Field>
      </div>
      <Field label="จำนวนพนักงาน" htmlFor="company-form-size" error={errors.employeeCount}>
        <Input id="company-form-size" inputMode="numeric" {...bind('employeeCount')} />
      </Field>
      <FormActions
        pending={save.isPending}
        onCancel={onCancel}
        label={company ? 'บันทึก' : 'เพิ่มบริษัท'}
      />
    </form>
  );
}
