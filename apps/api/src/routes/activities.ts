import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';


const createActivitySchema = z.object({
  type: z.enum(['NOTE', 'EMAIL', 'CALL', 'MEETING', 'STATUS_CHANGE', 'CALL_NOTE']),
  subject: z.string().optional(),
  body: z.string().optional(),
  metadata: z.any().optional(),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export async function activityRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { leadId, companyId, dealId, type, page = '1', limit = '50' } = request.query as any;
    
    const where: any = {
      organizationId: (request.user as any).organizationId,
    };

    if (leadId) where.leadId = leadId;
    if (companyId) where.companyId = companyId;
    if (dealId) where.dealId = dealId;
    if (type) where.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          lead: {
            select: {
              id: true,
              email: true,
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
          deal: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.activity.count({ where }),
    ]);

    reply.send({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  });

  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = createActivitySchema.parse(request.body);

      const activity = await prisma.activity.create({
        data: {
          ...data,
          type: data.type as any,
          userId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          lead: true,
          company: true,
          deal: true,
        },
      });

      // Update last contacted for lead
      if (data.leadId && ['EMAIL', 'CALL', 'MEETING'].includes(data.type)) {
        await prisma.lead.update({
          where: { id: data.leadId },
          data: { lastContactedAt: new Date() },
        });
      }

      reply.code(201).send({ activity });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create activity error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}


