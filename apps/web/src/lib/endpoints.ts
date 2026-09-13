import type {
  activityCreateInputSchema,
  AiSuggestionApproveInput,
  AiSuggestionRejectInput,
  AiSuggestionStatus,
  companyCreateInputSchema,
  companyUpdateInputSchema,
  contactCreateInputSchema,
  contactUpdateInputSchema,
  leadCreateInputSchema,
  leadStageChangeInputSchema,
  leadUpdateInputSchema,
  loginInputSchema,
  MessageCreateInput,
} from '@ai-crm/shared';
import {
  activitySchema,
  aiSuggestionDecisionSchema,
  aiSuggestionListSchema,
  authResponseSchema,
  companyDetailSchema,
  companySchema,
  contactDetailSchema,
  contactSchema,
  healthResponseSchema,
  leadDetailSchema,
  leadListItemSchema,
  messageSchema,
  pageSchema,
  pipelineSummarySchema,
  timelinePageSchema,
  userListResponseSchema,
} from '@ai-crm/shared';
import type { z } from 'zod';
import { apiGet, apiSend, apiSendNoContent, type Query } from './api';

const leadPageSchema = pageSchema(leadListItemSchema);
const companyPageSchema = pageSchema(companySchema);
const contactPageSchema = pageSchema(contactSchema);

/** request body ใช้ type ฝั่ง input ของ schema (ก่อน transform) */
type Input<S extends z.ZodType> = z.input<S>;

export const api = {
  health: () => apiGet(healthResponseSchema, '/health'),
  auth: {
    me: () => apiGet(authResponseSchema, '/auth/me'),
    login: (body: Input<typeof loginInputSchema>) =>
      apiSend(authResponseSchema, 'POST', '/auth/login', body),
    logout: () => apiSendNoContent('POST', '/auth/logout'),
  },
  users: {
    list: () => apiGet(userListResponseSchema, '/users'),
  },
  leads: {
    list: (query: Query) => apiGet(leadPageSchema, '/leads', query),
    pipeline: (query: Query) => apiGet(pipelineSummarySchema, '/leads/pipeline', query),
    get: (id: string) => apiGet(leadDetailSchema, `/leads/${id}`),
    create: (body: Input<typeof leadCreateInputSchema>) =>
      apiSend(leadDetailSchema, 'POST', '/leads', body),
    update: (id: string, body: Input<typeof leadUpdateInputSchema>) =>
      apiSend(leadDetailSchema, 'PATCH', `/leads/${id}`, body),
    changeStage: (id: string, body: Input<typeof leadStageChangeInputSchema>) =>
      apiSend(leadDetailSchema, 'PATCH', `/leads/${id}/stage`, body),
    timeline: (id: string, cursor?: string) =>
      apiGet(timelinePageSchema, `/leads/${id}/timeline`, { limit: 30, cursor }),
    addActivity: (id: string, body: Input<typeof activityCreateInputSchema>) =>
      apiSend(activitySchema, 'POST', `/leads/${id}/activities`, body),
  },
  activities: {
    complete: (id: string) => apiSend(activitySchema, 'PATCH', `/activities/${id}/complete`),
  },
  ai: {
    /** ขอคำแนะนำใหม่ — อาจใช้เวลาหลายวินาที (ตามเวลาตอบของ AI) */
    ask: (leadId: string) =>
      apiSend(aiSuggestionListSchema, 'POST', `/leads/${leadId}/ai-suggestions`),
    list: (leadId: string, status?: AiSuggestionStatus) =>
      apiGet(aiSuggestionListSchema, `/leads/${leadId}/ai-suggestions`, { status }),
    approve: (id: string, body: AiSuggestionApproveInput) =>
      apiSend(aiSuggestionDecisionSchema, 'POST', `/ai-suggestions/${id}/approve`, body),
    reject: (id: string, body: AiSuggestionRejectInput) =>
      apiSend(aiSuggestionDecisionSchema, 'POST', `/ai-suggestions/${id}/reject`, body),
  },
  messages: {
    /** คนพิมพ์ตอบทาง LINE เอง — คืนข้อความพร้อมสถานะ SENT / FAILED */
    send: (leadId: string, body: MessageCreateInput) =>
      apiSend(messageSchema, 'POST', `/leads/${leadId}/messages`, body),
    retry: (id: string) => apiSend(messageSchema, 'POST', `/messages/${id}/retry`),
  },
  companies: {
    list: (query: Query) => apiGet(companyPageSchema, '/companies', query),
    get: (id: string) => apiGet(companyDetailSchema, `/companies/${id}`),
    create: (body: Input<typeof companyCreateInputSchema>) =>
      apiSend(companySchema, 'POST', '/companies', body),
    update: (id: string, body: Input<typeof companyUpdateInputSchema>) =>
      apiSend(companySchema, 'PATCH', `/companies/${id}`, body),
    remove: (id: string) => apiSendNoContent('DELETE', `/companies/${id}`),
  },
  contacts: {
    list: (query: Query) => apiGet(contactPageSchema, '/contacts', query),
    get: (id: string) => apiGet(contactDetailSchema, `/contacts/${id}`),
    create: (body: Input<typeof contactCreateInputSchema>) =>
      apiSend(contactSchema, 'POST', '/contacts', body),
    update: (id: string, body: Input<typeof contactUpdateInputSchema>) =>
      apiSend(contactSchema, 'PATCH', `/contacts/${id}`, body),
    remove: (id: string) => apiSendNoContent('DELETE', `/contacts/${id}`),
  },
};
