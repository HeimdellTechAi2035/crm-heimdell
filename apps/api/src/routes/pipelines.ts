import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function pipelineRoutes(fastify: FastifyInstance) {
  // Get all pipelines
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const pipelines = await prisma.pipeline.findMany({
      where: {
        organizationId: (request.user as any).organizationId,
      },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            _count: {
              select: { deals: true },
            },
          },
        },
        _count: {
          select: { deals: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    reply.send({ pipelines });
  });

  // Get pipeline board (deals by stage)
  fastify.get('/:id/board', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            deals: {
              where: { status: 'open' },
              include: {
                owner: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                lead: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!pipeline) {
      return reply.code(404).send({ error: 'Pipeline not found' });
    }

    reply.send({ pipeline });
  });
}


