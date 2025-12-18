import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';


const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  assigneeId: z.string().optional(),
});

const updateTaskSchema = createTaskSchema.extend({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
}).partial();

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { 
      status, 
      assigneeId, 
      leadId, 
      companyId, 
      dealId, 
      overdue, 
      dueToday,
      page = '1', 
      limit = '50' 
    } = request.query as any;
    
    const where: any = {
      organizationId: (request.user as any).organizationId,
    };

    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (leadId) where.leadId = leadId;
    if (companyId) where.companyId = companyId;
    if (dealId) where.dealId = dealId;

    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'DONE' };
    }

    if (dueToday === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      where.dueDate = {
        gte: today,
        lt: tomorrow,
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          assignee: {
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
        orderBy: [
          { status: 'asc' },
          { dueDate: 'asc' },
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.task.count({ where }),
    ]);

    reply.send({
      tasks,
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
      const data = createTaskSchema.parse(request.body);

      const task = await prisma.task.create({
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          assigneeId: data.assigneeId || (request.user as any).id,
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
          assignee: {
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

      reply.code(201).send({ task });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create task error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateTaskSchema.parse(request.body);

      const existing = await prisma.task.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      const updateData: any = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      };

      if (data.status === 'DONE' && existing.status !== 'DONE') {
        updateData.completedAt = new Date();
      }

      const task = await prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          assignee: {
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

      reply.send({ task });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.task.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
    });

    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    await prisma.task.delete({
      where: { id },
    });

    reply.send({ success: true });
  });
}


