import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">AI CRM</p>
          <p className="mt-1 text-sm text-slate-500">เข้าสู่ระบบด้วยบัญชีของทีมขาย</p>
        </div>
        <Suspense fallback={<Loading />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
