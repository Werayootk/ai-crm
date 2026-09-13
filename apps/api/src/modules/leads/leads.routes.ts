import {
  activityCreateInputSchema,
  idParamsSchema,
  leadCreateInputSchema,
  leadListQuerySchema,
  leadStageChangeInputSchema,
  leadUpdateInputSchema,
  paginationQuerySchema,
  pipelineQuerySchema,
} from '@ai-crm/shared';
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { route } from '../../http/route';
import {
  changeLeadStage,
  createLead,
  getLeadDetail,
  getPipeline,
  listLeads,
  updateLead,
} from './leads.service';
import { addActivity, completeTask, getTimeline } from './timeline.service';

export function createLeadsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    '/leads',
    route({ auth: 'user', query: leadListQuerySchema }, async ({ res, query, user }) => {
      res.json(await listLeads(prisma, query, user));
    }),
  );

  // ต้องประกาศก่อน /leads/:id ไม่งั้น "pipeline" จะถูกจับเป็น :id
  router.get(
    '/leads/pipeline',
    route({ auth: 'user', query: pipelineQuerySchema }, async ({ res, query, user }) => {
      res.json(await getPipeline(prisma, query.ownerId, user));
    }),
  );

  router.post(
    '/leads',
    route({ auth: 'user', body: leadCreateInputSchema }, async ({ req, res, body, user }) => {
      const lead = await createLead(prisma, body, user);
      req.log.info({ leadId: lead.id }, 'lead created');
      res.status(201).json(lead);
    }),
  );

  router.get(
    '/leads/:id',
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params }) => {
      res.json(await getLeadDetail(prisma, params.id));
    }),
  );

  router.patch(
    '/leads/:id',
    route(
      { auth: 'user', params: idParamsSchema, body: leadUpdateInputSchema },
      async ({ res, params, body, user }) => {
        res.json(await updateLead(prisma, params.id, body, user));
      },
    ),
  );

  router.patch(
    '/leads/:id/stage',
    route(
      { auth: 'user', params: idParamsSchema, body: leadStageChangeInputSchema },
      async ({ req, res, params, body, user }) => {
        const { lead, from } = await changeLeadStage(prisma, params.id, body, user);
        req.log.info({ leadId: lead.id, from, to: lead.stage }, 'lead stage changed');
        res.json(lead);
      },
    ),
  );

  router.get(
    '/leads/:id/timeline',
    route(
      { auth: 'user', params: idParamsSchema, query: paginationQuerySchema },
      async ({ res, params, query }) => {
        res.json(await getTimeline(prisma, params.id, query));
      },
    ),
  );

  router.post(
    '/leads/:id/activities',
    route(
      { auth: 'user', params: idParamsSchema, body: activityCreateInputSchema },
      async ({ res, params, body, user }) => {
        res.status(201).json(await addActivity(prisma, params.id, body, user));
      },
    ),
  );

  router.patch(
    '/activities/:id/complete',
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params }) => {
      res.json(await completeTask(prisma, params.id));
    }),
  );

  return router;
}
