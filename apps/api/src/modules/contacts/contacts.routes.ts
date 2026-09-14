import {
  contactCreateInputSchema,
  contactListQuerySchema,
  contactUpdateInputSchema,
  idParamsSchema,
  type ContactDetail,
} from '@ai-crm/shared';
import { Router } from 'express';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound } from '../../http/errors';
import { cursorArgs, toPage } from '../../http/pagination';
import { route } from '../../http/route';
import { contactSelect, leadListSelect, toContact, toLeadListItem } from '../mappers';
import { assertCompanyExists, conflict, withPrismaErrors } from '../references';

const emailTaken = () => conflict('Another contact already uses this email', 'email');

export function createContactsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    '/contacts',
    route({ auth: 'user', query: contactListQuerySchema }, async ({ res, query }) => {
      const where: Prisma.ContactWhereInput = {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.hasLine === undefined
          ? {}
          : { lineUserId: query.hasLine ? { not: null } : null }),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
                { phone: { contains: query.q } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          select: contactSelect,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: query.limit + 1,
          ...cursorArgs(query.cursor),
        }),
        prisma.contact.count({ where }),
      ]);
      res.json(toPage(rows, query.limit, total, toContact));
    }),
  );

  router.post(
    '/contacts',
    route({ auth: 'user', body: contactCreateInputSchema }, async ({ res, body }) => {
      if (body.companyId) await assertCompanyExists(prisma, body.companyId, 'companyId');
      const row = await withPrismaErrors(
        prisma.contact.create({ data: body, select: contactSelect }),
        { P2002: emailTaken },
      );
      res.status(201).json(toContact(row));
    }),
  );

  router.get(
    '/contacts/:id',
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params }) => {
      const row = await prisma.contact.findUnique({
        where: { id: params.id },
        select: {
          ...contactSelect,
          leads: { select: leadListSelect, orderBy: { updatedAt: 'desc' }, take: 100 },
        },
      });
      if (!row) throw notFound('Contact');
      res.json({ ...toContact(row), leads: row.leads.map(toLeadListItem) } satisfies ContactDetail);
    }),
  );

  router.patch(
    '/contacts/:id',
    route(
      { auth: 'user', params: idParamsSchema, body: contactUpdateInputSchema },
      async ({ res, params, body }) => {
        if (body.companyId) await assertCompanyExists(prisma, body.companyId, 'companyId');
        const row = await withPrismaErrors(
          prisma.contact.update({ where: { id: params.id }, data: body, select: contactSelect }),
          { P2002: emailTaken, P2025: () => notFound('Contact') },
        );
        res.json(toContact(row));
      },
    ),
  );

  router.delete(
    '/contacts/:id',
    route({ auth: 'admin', params: idParamsSchema }, async ({ req, res, params }) => {
      await withPrismaErrors(prisma.contact.delete({ where: { id: params.id } }), {
        P2025: () => notFound('Contact'),
        P2003: () =>
          new HttpError(
            409,
            'CONFLICT',
            'Contact still has leads or messages — it cannot be deleted',
          ),
      });
      req.log.info({ contactId: params.id }, 'contact deleted');
      res.status(204).end();
    }),
  );

  return router;
}
