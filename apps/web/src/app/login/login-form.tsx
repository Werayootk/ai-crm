'use client';

import { loginInputSchema } from '@ai-crm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { validate, type FieldErrors } from '@/lib/form';
import { safeNextPath } from '@/lib/navigation';
import { queryKeys } from '@/lib/queries';

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (error.status === 429) return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
    return error.message;
  }
  return 'เข้าสู่ระบบไม่สำเร็จ';
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const login = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      router.replace(safeNextPath(searchParams.get('next')));
    },
  });

  function submit() {
    const result = validate(loginInputSchema, { email, password });
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) login.mutate(result.data);
  }

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="อีเมล" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
          />
        </Field>
        <Field label="รหัสผ่าน" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
          />
        </Field>
        {login.isError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {loginErrorMessage(login.error)}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={login.isPending}>
          เข้าสู่ระบบ
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        บัญชี demo: admin@demo.local, sales01@demo.local … sales19@demo.local
      </p>
    </Card>
  );
}
