import {
  companyCreateInputSchema,
  companyListQuerySchema,
  companyUpdateInputSchema,
  idParamsSchema,
  type CompanyDetail,
} from '@ai-crm/shared';
import { Router } from 'express';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound } from '../../http/errors';
import { cursorArgs, toPage } from '../../http/pagination';
import { route } from '../../http/route';
import {
  companySelect,
  contactSelect,
  leadListSelect,
  toCompany,
  toContact,
  toLeadListItem,
} from '../mappers';
import { conflict, withPrismaErrors } from '../references';

const DETAIL_RELATION_LIMIT = 100;
const domainTaken = () => conflict('Another company already uses this domain', 'domain');

export function createCompaniesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    '/companies',
    route({ auth: 'user', query: companyListQuerySchema }, async ({ res, query }) => {
      const where: Prisma.CompanyWhereInput = query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { domain: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {};
      const [rows, total] = await Promise.all([
        prisma.company.findMany({
          where,
          select: companySelect,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: query.limit + 1,
          ...cursorArgs(query.cursor),
        }),
        prisma.company.count({ where }),
      ]);
      res.json(toPage(rows, query.limit, total, toCompany));
    }),
  );

  router.post(
    '/companies',
    route({ auth: 'user', body: companyCreateInputSchema }, async ({ res, body }) => {
      const row = await withPrismaErrors(
        prisma.company.create({ data: body, select: companySelect }),
        { P2002: domainTaken },
      );
      res.status(201).json(toCompany(row));
    }),
  );

  router.get(
    '/companies/:id',
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params }) => {
      const row = await prisma.company.findUnique({
        where: { id: params.id },
        select: {
          ...companySelect,
          contacts: {
            select: contactSelect,
            orderBy: { name: 'asc' },
            take: DETAIL_RELATION_LIMIT,
          },
          leads: {
            select: leadListSelect,
            orderBy: { updatedAt: 'desc' },
            take: DETAIL_RELATION_LIMIT,
          },
        },
      });
      if (!row) throw notFound('Company');
      res.json({
        ...toCompany(row),
        contacts: row.contacts.map(toContact),
        leads: row.leads.map(toLeadListItem),
      } satisfies CompanyDetail);
    }),
  );

  router.patch(
    '/companies/:id',
    route(
      { auth: 'user', params: idParamsSchema, body: companyUpdateInputSchema },
      async ({ res, params, body }) => {
        const row = await withPrismaErrors(
          prisma.company.update({ where: { id: params.id }, data: body, select: companySelect }),
          { P2002: domainTaken, P2025: () => notFound('Company') },
        );
        res.json(toCompany(row));
      },
    ),
  );

  router.delete(
    '/companies/:id',
    route({ auth: 'admin', params: idParamsSchema }, async ({ req, res, params }) => {
      await withPrismaErrors(prisma.company.delete({ where: { id: params.id } }), {
        P2025: () => notFound('Company'),
        P2003: () =>
          new HttpError(
            409,
            'CONFLICT',
            'Company still has contacts or leads — reassign them first',
          ),
      });
      req.log.info({ companyId: params.id }, 'company deleted');
      res.status(204).end();
    }),
  );

  return router;
}
