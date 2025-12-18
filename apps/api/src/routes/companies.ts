import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';

const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

const updateCompanySchema = createCompanySchema.partial();

export async function companyRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { search, industry, ownerId, page = '1', limit = '50' } = request.query as any;
    
    const where: any = {
      organizationId: (request.user as any).organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (industry) where.industry = industry;
    if (ownerId) where.ownerId = ownerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              leads: true,
              deals: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.company.count({ where }),
    ]);

    reply.send({
      companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  });

  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const company = await prisma.company.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        leads: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deals: {
          include: {
            stage: true,
            pipeline: true,
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!company) {
      return reply.code(404).send({ error: 'Company not found' });
    }

    reply.send({ company });
  });

  fastify.post('/', {
    preHandler: [authenticate, auditMiddleware('company')],
  }, async (request, reply) => {
    try {
      const data = createCompanySchema.parse(request.body);

      const company = await prisma.company.create({
        data: {
          ...data,
          ownerId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      reply.code(201).send({ company });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create company error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch('/:id', {
    preHandler: [authenticate, auditMiddleware('company')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateCompanySchema.parse(request.body);

      const existing = await prisma.company.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Company not found' });
      }

      const company = await prisma.company.update({
        where: { id },
        data,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      reply.send({ company });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/:id', {
    preHandler: [authenticate, auditMiddleware('company')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const company = await prisma.company.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
    });

    if (!company) {
      return reply.code(404).send({ error: 'Company not found' });
    }

    await prisma.company.delete({
      where: { id },
    });

    reply.send({ success: true });
  });
}


