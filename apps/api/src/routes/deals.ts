import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';

const createDealSchema = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  currency: z.string().optional(),
  pipelineId: z.string(),
  stageId: z.string(),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
});

const updateDealSchema = createDealSchema.partial();

const moveDealSchema = z.object({
  stageId: z.string(),
});

const closeDealSchema = z.object({
  status: z.enum(['won', 'lost']),
  lostReason: z.string().optional(),
});

export async function dealRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { search, status, pipelineId, stageId, ownerId, page = '1', limit = '50' } = request.query as any;
    
    const where: any = {
      organizationId: (request.user as any).organizationId,
    };

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    if (status) where.status = status;
    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (ownerId) where.ownerId = ownerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          pipeline: true,
          stage: true,
          lead: true,
          company: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.deal.count({ where }),
    ]);

    reply.send({
      deals,
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

    const deal = await prisma.deal.findFirst({
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
        pipeline: {
          include: {
            stages: {
              orderBy: { position: 'asc' },
            },
          },
        },
        stage: true,
        lead: true,
        company: true,
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
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { dueDate: 'asc' },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!deal) {
      return reply.code(404).send({ error: 'Deal not found' });
    }

    reply.send({ deal });
  });

  fastify.post('/', {
    preHandler: [authenticate, auditMiddleware('deal')],
  }, async (request, reply) => {
    try {
      const data = createDealSchema.parse(request.body);

      const deal = await prisma.deal.create({
        data: {
          ...data,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
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
          pipeline: true,
          stage: true,
          lead: true,
          company: true,
        },
      });

      await prisma.activity.create({
        data: {
          type: 'STATUS_CHANGE',
          subject: 'Deal created',
          body: `Deal "${deal.title}" created`,
          dealId: deal.id,
          userId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.code(201).send({ deal });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create deal error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch('/:id', {
    preHandler: [authenticate, auditMiddleware('deal')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateDealSchema.parse(request.body);

      const existing = await prisma.deal.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Deal not found' });
      }

      const deal = await prisma.deal.update({
        where: { id },
        data: {
          ...data,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          pipeline: true,
          stage: true,
          lead: true,
          company: true,
        },
      });

      reply.send({ deal });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Move deal to different stage
  fastify.post('/:id/move', {
    preHandler: [authenticate, auditMiddleware('deal')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = moveDealSchema.parse(request.body);

      const deal = await prisma.deal.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
        include: {
          stage: true,
        },
      });

      if (!deal) {
        return reply.code(404).send({ error: 'Deal not found' });
      }

      const newStage = await prisma.stage.findUnique({
        where: { id: data.stageId },
      });

      if (!newStage) {
        return reply.code(404).send({ error: 'Stage not found' });
      }

      const updated = await prisma.deal.update({
        where: { id },
        data: {
          stageId: data.stageId,
        },
        include: {
          stage: true,
          pipeline: true,
        },
      });

      await prisma.activity.create({
        data: {
          type: 'STATUS_CHANGE',
          subject: 'Deal stage changed',
          body: `Moved from ${deal.stage.name} to ${newStage.name}`,
          dealId: deal.id,
          userId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({ deal: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Close deal (won/lost)
  fastify.post('/:id/close', {
    preHandler: [authenticate, auditMiddleware('deal')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = closeDealSchema.parse(request.body);

      const deal = await prisma.deal.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!deal) {
        return reply.code(404).send({ error: 'Deal not found' });
      }

      const updated = await prisma.deal.update({
        where: { id },
        data: {
          status: data.status,
          lostReason: data.lostReason,
          closedAt: new Date(),
        },
        include: {
          stage: true,
          pipeline: true,
        },
      });

      await prisma.activity.create({
        data: {
          type: 'STATUS_CHANGE',
          subject: `Deal ${data.status}`,
          body: data.status === 'lost' && data.lostReason 
            ? `Deal lost: ${data.lostReason}` 
            : `Deal ${data.status}`,
          dealId: deal.id,
          userId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.send({ deal: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/:id', {
    preHandler: [authenticate, auditMiddleware('deal')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const deal = await prisma.deal.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
    });

    if (!deal) {
      return reply.code(404).send({ error: 'Deal not found' });
    }

    await prisma.deal.delete({
      where: { id },
    });

    reply.send({ success: true });
  });
}


