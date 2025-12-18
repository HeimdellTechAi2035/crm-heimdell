import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';

const createLeadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

const updateLeadSchema = createLeadSchema.partial();

export async function leadRoutes(fastify: FastifyInstance) {
  // List leads
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { search, status, ownerId, companyId, page = '1', limit = '50' } = request.query as any;
    
    const where: any = {
      organizationId: (request.user as any).organizationId,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;
    if (companyId) where.companyId = companyId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.lead.count({ where }),
    ]);

    reply.send({
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  });

  // Get lead by ID
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findFirst({
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
            email: true,
          },
        },
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
        deals: {
          include: {
            stage: true,
            pipeline: true,
          },
        },
        customFieldValues: {
          include: {
            customField: true,
          },
        },
      },
    });

    if (!lead) {
      return reply.code(404).send({ error: 'Lead not found' });
    }

    reply.send({ lead });
  });

  // Create lead
  fastify.post('/', {
    preHandler: [authenticate, auditMiddleware('lead')],
  }, async (request, reply) => {
    try {
      const data = createLeadSchema.parse(request.body);

      const lead = await prisma.lead.create({
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
              email: true,
            },
          },
          company: true,
        },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          type: 'STATUS_CHANGE',
          subject: 'Lead created',
          body: `Lead ${lead.email} created`,
          leadId: lead.id,
          userId: (request.user as any).id,
          organizationId: (request.user as any).organizationId,
        },
      });

      reply.code(201).send({ lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create lead error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update lead
  fastify.patch('/:id', {
    preHandler: [authenticate, auditMiddleware('lead')],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateLeadSchema.parse(request.body);

      const existing = await prisma.lead.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      const lead = await prisma.lead.update({
        where: { id },
        data,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          company: true,
        },
      });

      // Create activity for status change
      if (data.status && data.status !== existing.status) {
        await prisma.activity.create({
          data: {
            type: 'STATUS_CHANGE',
            subject: 'Status changed',
            body: `Status changed from ${existing.status} to ${data.status}`,
            leadId: lead.id,
            userId: (request.user as any).id,
            organizationId: (request.user as any).organizationId,
          },
        });
      }

      reply.send({ lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Update lead error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete lead
  fastify.delete('/:id', {
    preHandler: [authenticate, auditMiddleware('lead')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
    });

    if (!lead) {
      return reply.code(404).send({ error: 'Lead not found' });
    }

    await prisma.lead.delete({
      where: { id },
    });

    reply.send({ success: true });
  });
}


