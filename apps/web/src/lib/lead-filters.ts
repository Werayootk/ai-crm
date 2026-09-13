import {
  LEAD_SORT_FIELDS,
  LEAD_SOURCES,
  LEAD_STAGES,
  type LeadSource,
  type LeadStage,
} from '@ai-crm/shared';
import type { Query } from './api';

export type LeadSort = (typeof LEAD_SORT_FIELDS)[number];

export interface LeadFilters {
  q: string;
  stages: LeadStage[];
  /** 'me' | 'unassigned' | user id — ว่าง = ทุกคน */
  owner: string;
  source: LeadSource | '';
  sort: LeadSort;
  order: 'asc' | 'desc';
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  q: '',
  stages: [],
  owner: '',
  source: '',
  sort: 'updatedAt',
  order: 'desc',
};

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** อ่าน filter จาก URL — ค่าที่ไม่รู้จักถูกทิ้ง (URL แก้มือได้ จึงไม่เชื่อ) */
export function parseLeadFilters(params: URLSearchParams): LeadFilters {
  const stages = (params.get('stage') ?? '')
    .split(',')
    .map((stage) => LEAD_STAGES.find((candidate) => candidate === stage))
    .filter((stage): stage is LeadStage => stage !== undefined);
  return {
    q: params.get('q')?.trim() ?? '',
    stages: [...new Set(stages)],
    owner: params.get('owner')?.trim() ?? '',
    source: pick<LeadSource | ''>(params.get('source'), LEAD_SOURCES, ''),
    sort: pick(params.get('sort'), LEAD_SORT_FIELDS, DEFAULT_LEAD_FILTERS.sort),
    order: pick(params.get('order'), ['asc', 'desc'] as const, DEFAULT_LEAD_FILTERS.order),
  };
}

/** เขียน filter กลับเป็น URL — เก็บเฉพาะค่าที่ต่างจาก default ให้ URL สั้น */
export function serializeLeadFilters(filters: LeadFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.stages.length > 0) params.set('stage', filters.stages.join(','));
  if (filters.owner) params.set('owner', filters.owner);
  if (filters.source) params.set('source', filters.source);
  if (filters.sort !== DEFAULT_LEAD_FILTERS.sort) params.set('sort', filters.sort);
  if (filters.order !== DEFAULT_LEAD_FILTERS.order) params.set('order', filters.order);
  return params.toString();
}

/** แปลงเป็น query ของ GET /api/leads */
export function leadFiltersToQuery(filters: LeadFilters): Query {
  return {
    q: filters.q,
    stage: filters.stages,
    ownerId: filters.owner,
    source: filters.source,
    sort: filters.sort,
    order: filters.order,
  };
}
