import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function businessUnitsRoutes(app: FastifyInstance) {
  // Get all business units for organization
  app.get('/api/business-units', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;

    const units = await prisma.businessUnit.findMany({
      where: {
        organizationId: user.organizationId
      },
      orderBy: {
        name: 'asc'
      }
    });

    return { units };
  });

  // Get active business units only
  app.get('/api/business-units/active', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;

    const units = await prisma.businessUnit.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return { units };
  });

  // Get single business unit
  app.get<{ Params: { id: string } }>('/api/business-units/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    const unit = await prisma.businessUnit.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!unit) {
      return reply.code(404).send({ error: 'Business unit not found' });
    }

    return { unit };
  });

  // Create business unit (ADMIN only)
  app.post('/api/business-units', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { name, slug, timezone, country } = request.body as any;

    // Validate slug uniqueness
    const existing = await prisma.businessUnit.findFirst({
      where: {
        organizationId: user.organizationId,
        slug
      }
    });

    if (existing) {
      return reply.code(400).send({ error: 'Slug already in use' });
    }

    const unit = await prisma.businessUnit.create({
      data: {
        organizationId: user.organizationId,
        name,
        slug,
        timezone: timezone || 'Europe/London',
        country: country || 'GB'
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'created',
        entityType: 'business_unit',
        entityId: unit.id,
        userId: user.id,
        organizationId: user.organizationId,
        changes: { name, slug }
      }
    });

    return { unit };
  });

  // Update business unit (ADMIN only)
  app.patch<{ Params: { id: string } }>('/api/business-units/:id', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;
    const updateData = request.body as any;

    // Verify ownership
    const existing = await prisma.businessUnit.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Business unit not found' });
    }

    // If slug is being changed, check uniqueness
    if (updateData.slug && updateData.slug !== existing.slug) {
      const slugTaken = await prisma.businessUnit.findFirst({
        where: {
          organizationId: user.organizationId,
          slug: updateData.slug,
          NOT: { id }
        }
      });

      if (slugTaken) {
        return reply.code(400).send({ error: 'Slug already in use' });
      }
    }

    const unit = await prisma.businessUnit.update({
      where: { id },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'updated',
        entityType: 'business_unit',
        entityId: unit.id,
        userId: user.id,
        organizationId: user.organizationId,
        changes: { before: existing, after: unit }
      }
    });

    return { unit };
  });

  // Deactivate business unit (soft delete)
  app.delete<{ Params: { id: string } }>('/api/business-units/:id', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    const unit = await prisma.businessUnit.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!unit) {
      return reply.code(404).send({ error: 'Business unit not found' });
    }

    // Soft delete (deactivate)
    await prisma.businessUnit.update({
      where: { id },
      data: { isActive: false }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'deactivated',
        entityType: 'business_unit',
        entityId: id,
        userId: user.id,
        organizationId: user.organizationId
      }
    });

    return { success: true };
  });

  // Get stats for a business unit
  app.get<{ Params: { id: string } }>('/api/business-units/:id/stats', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    // Verify ownership
    const unit = await prisma.businessUnit.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!unit) {
      return reply.code(404).send({ error: 'Business unit not found' });
    }

    const [leadsCount, dealsCount, companiesCount, activitiesCount] = await Promise.all([
      prisma.lead.count({ where: { businessUnitId: id } }),
      prisma.deal.count({ where: { businessUnitId: id } }),
      prisma.company.count({ where: { businessUnitId: id } }),
      prisma.activity.count({ where: { businessUnitId: id } })
    ]);

    return {
      stats: {
        leadsCount,
        dealsCount,
        companiesCount,
        activitiesCount
      }
    };
  });
}
