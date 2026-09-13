import {
  idParamsSchema,
  messageCreateInputSchema,
  webhookEventListQuerySchema,
  type WebhookEventList,
} from '@ai-crm/shared';
import { Router } from 'express';
import { route } from '../../http/route';
import { retryMessage, sendLineMessage } from './messages.service';
import type { OutboundDeps } from './outbound';
import type { WebhookProcessor } from './webhook-processor';
import { listWebhookEvents, retryWebhookEvent } from './webhook-events.service';

/** ส่งข้อความ LINE ที่คนเขียนเอง + เครื่องมือ admin สำหรับ webhook event */
export function createLineRouter(deps: OutboundDeps & { processor: WebhookProcessor }): Router {
  const router = Router();

  router.post(
    '/leads/:id/messages',
    route(
      { auth: 'user', params: idParamsSchema, body: messageCreateInputSchema },
      async ({ res, params, body, user }) => {
        res.status(201).json(await sendLineMessage(deps, params.id, body, user));
      },
    ),
  );

  router.post(
    '/messages/:id/retry',
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params, user }) => {
      res.json(await retryMessage(deps, params.id, user));
    }),
  );

  router.get(
    '/webhook-events',
    route({ auth: 'admin', query: webhookEventListQuerySchema }, async ({ res, query }) => {
      const items = await listWebhookEvents(deps.prisma, query);
      res.json({ items } satisfies WebhookEventList);
    }),
  );

  router.post(
    '/webhook-events/:id/retry',
    route({ auth: 'admin', params: idParamsSchema }, async ({ req, res, params, user }) => {
      const event = await retryWebhookEvent(deps.prisma, deps.processor, params.id);
      req.log.info({ webhookEventRowId: params.id, actorId: user.id }, 'webhook event retried');
      res.json(event);
    }),
  );

  return router;
}
