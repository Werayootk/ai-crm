'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { isLoggingOut, loginPath } from '@/lib/navigation';

/** session หมดอายุ / ถูกปิดบัญชี → กลับไป login พร้อมจำหน้าปัจจุบัน (ยกเว้นอยู่หน้า login หรือกำลัง logout) */
function redirectOnUnauthenticated(error: Error): void {
  if (!(error instanceof ApiError) || error.status !== 401 || isLoggingOut()) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith('/login')) return;
  window.location.assign(loginPath(pathname + search));
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: redirectOnUnauthenticated }),
    mutationCache: new MutationCache({ onError: redirectOnUnauthenticated }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx เป็นความผิดของ request — ลองซ้ำไม่ช่วย
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
