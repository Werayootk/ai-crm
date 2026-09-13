'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Query } from './api';
import { api } from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  users: ['users'] as const,
  leads: ['leads'] as const,
  leadList: (query: Query) => ['leads', 'list', query] as const,
  pipeline: (ownerId: string) => ['leads', 'pipeline', ownerId] as const,
  lead: (id: string) => ['lead', id] as const,
  timeline: (id: string) => ['lead', id, 'timeline'] as const,
  companies: ['companies'] as const,
  company: (id: string) => ['company', id] as const,
  contacts: ['contacts'] as const,
  contact: (id: string) => ['contact', id] as const,
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.auth.me, staleTime: 5 * 60_000 });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: api.users.list, staleTime: 5 * 60_000 });
}

export function useLeadList(query: Query, options: { limit?: number } = {}) {
  const limit = options.limit ?? 25;
  return useInfiniteQuery({
    queryKey: queryKeys.leadList({ ...query, limit }),
    queryFn: ({ pageParam }) => api.leads.list({ ...query, limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useLead(id: string) {
  return useQuery({ queryKey: queryKeys.lead(id), queryFn: () => api.leads.get(id) });
}

export function useTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.timeline(id),
    queryFn: ({ pageParam }) => api.leads.timeline(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** หลังแก้ lead: รายการ, pipeline, หน้า detail/timeline และหน้า contact/company ที่แสดง lead ต้อง refresh */
export function useInvalidateLeads() {
  const queryClient = useQueryClient();
  return (leadId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
      leadId ? queryClient.invalidateQueries({ queryKey: queryKeys.lead(leadId) }) : null,
      queryClient.invalidateQueries({ queryKey: ['contact'] }),
      queryClient.invalidateQueries({ queryKey: ['company'] }),
    ]);
}

export function useChangeStage(leadId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: (input: {
      stage: Parameters<typeof api.leads.changeStage>[1]['stage'];
      lostReason?: string;
    }) => api.leads.changeStage(leadId, input),
    onSuccess: () => invalidate(leadId),
  });
}
