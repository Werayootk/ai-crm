'use client';

import type { AuthUser } from '@ai-crm/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { initials } from '@/lib/format';
import { beginLogout } from '@/lib/navigation';
import { useMe } from '@/lib/queries';
import { Button, cx, ErrorState, Loading } from './ui';

const NAV = [
  { href: '/leads', label: 'Leads' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/companies', label: 'Companies' },
];

const CurrentUserContext = createContext<AuthUser | null>(null);

/** ผู้ใช้ที่ login อยู่ — ใช้ได้เฉพาะใต้ AppShell */
export function useCurrentUser(): AuthUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside <AppShell>');
  return user;
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const logout = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      beginLogout();
      // โหลดหน้าใหม่ทั้งหน้า: ทิ้งข้อมูลทุกอย่างในหน่วยความจำ (คนถัดไปบนเครื่องเดียวกันไม่เห็น)
      // และไม่มี query ค้างที่ refetch แล้วได้ 401 ซ้อนกับการ redirect (เคยเจอตอนทดสอบ production build)
      window.location.replace('/login');
    },
  });

  // 401 ถูกพาไปหน้า login โดย QueryCache แล้ว — ตรงนี้แสดงระหว่างรอ
  if (me.isPending) return <Loading label="กำลังตรวจสอบการเข้าสู่ระบบ…" />;
  if (me.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  const user = me.data.user;

  return (
    <CurrentUserContext.Provider value={user}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        {/* มือถือ: แถวบน = โลโก้ + ผู้ใช้, แถวล่าง = เมนูเต็มความกว้าง / จอกว้าง: แถวเดียว */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 px-4 sm:flex-nowrap sm:px-6">
          <Link
            href="/leads"
            className="py-3 text-base font-semibold tracking-tight text-slate-900"
          >
            AI CRM
          </Link>
          <nav
            className="order-last -mb-px flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1"
            aria-label="เมนูหลัก"
          >
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium sm:py-3.5',
                    active
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden size-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 sm:flex"
              title={`${user.name} (${user.role})`}
              aria-hidden="true"
            >
              {initials(user.name)}
            </span>
            <span className="hidden max-w-40 truncate text-sm text-slate-600 md:inline">
              {user.name}
            </span>
            <Button variant="ghost" onClick={() => logout.mutate()} loading={logout.isPending}>
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </CurrentUserContext.Provider>
  );
}
