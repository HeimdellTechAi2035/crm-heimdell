import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sequenceQueue } from '../jobs/sequence.js';

const createSequenceSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  steps: z.array(z.object({
    type: z.enum(['EMAIL', 'TASK', 'WAIT']),
    delayDays: z.number(),
    emailTemplateId: z.string().optional(),
    taskDescription: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
  })),
});

const enrollLeadSchema = z.object({
  leadId: z.string(),
});

export async function sequenceRoutes(fastify: FastifyInstance) {
  // List sequences
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const sequences = await prisma.sequence.findMany({
      where: {
        organizationId: (request.user as any).organizationId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
          include: {
            emailTemplate: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    reply.send({ sequences });
  });

  // Get sequence by ID
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const sequence = await prisma.sequence.findFirst({
      where: {
        id,
        organizationId: (request.user as any).organizationId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
          include: {
            emailTemplate: true,
          },
        },
        enrollments: {
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!sequence) {
      return reply.code(404).send({ error: 'Sequence not found' });
    }

    reply.send({ sequence });
  });

  // Create sequence
  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = createSequenceSchema.parse(request.body);

      // Create email templates for steps that need them
      const stepsWithTemplates = await Promise.all(
        data.steps.map(async (step, index) => {
          if (step.type === 'EMAIL' && step.subject && step.body && !step.emailTemplateId) {
            const template = await prisma.emailTemplate.create({
              data: {
                name: `${data.name} - Step ${index + 1}`,
                subject: step.subject,
                body: step.body,
                organizationId: (request.user as any).organizationId,
              },
            });
            return {
              ...step,
              emailTemplateId: template.id,
            };
          }
          return step;
        })
      );

      const sequence = await prisma.sequence.create({
        data: {
          name: data.name,
          goal: data.goal,
          organizationId: (request.user as any).organizationId,
          steps: {
            create: stepsWithTemplates.map((step, index) => ({
              position: index,
              type: step.type,
              delayDays: step.delayDays,
              emailTemplateId: step.emailTemplateId,
              taskDescription: step.taskDescription,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { position: 'asc' },
          },
        },
      });

      reply.code(201).send({ sequence });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Create sequence error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Enroll lead in sequence
  fastify.post('/:id/enroll', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = enrollLeadSchema.parse(request.body);

      const sequence = await prisma.sequence.findFirst({
        where: {
          id,
          organizationId: (request.user as any).organizationId,
          isActive: true,
        },
        include: {
          steps: {
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!sequence) {
        return reply.code(404).send({ error: 'Sequence not found or inactive' });
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: data.leadId,
          organizationId: (request.user as any).organizationId,
        },
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Check if already enrolled
      const existing = await prisma.sequenceEnrollment.findUnique({
        where: {
          sequenceId_leadId: {
            sequenceId: id,
            leadId: data.leadId,
          },
        },
      });

      if (existing && existing.status === 'ACTIVE') {
        return reply.code(400).send({ error: 'Lead already enrolled in this sequence' });
      }

      const firstStep = sequence.steps[0];
      const nextActionAt = new Date();
      nextActionAt.setDate(nextActionAt.getDate() + firstStep.delayDays);

      const enrollment = await prisma.sequenceEnrollment.create({
        data: {
          sequenceId: id,
          leadId: data.leadId,
          currentStep: 0,
          nextActionAt,
        },
      });

      // Add to queue
      await sequenceQueue.add('process-enrollment', {
        enrollmentId: enrollment.id,
      }, {
        delay: firstStep.delayDays * 24 * 60 * 60 * 1000,
      });

      reply.code(201).send({ enrollment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Enroll lead error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unenroll lead from sequence
  fastify.post('/:id/unenroll/:leadId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id, leadId } = request.params as { id: string; leadId: string };

    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: {
        sequenceId: id,
        leadId,
        sequence: {
          organizationId: (request.user as any).organizationId,
        },
      },
    });

    if (!enrollment) {
      return reply.code(404).send({ error: 'Enrollment not found' });
    }

    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'STOPPED',
        completedAt: new Date(),
      },
    });

    reply.send({ success: true });
  });
}


