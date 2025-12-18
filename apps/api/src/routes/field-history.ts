import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function fieldHistoryRoutes(app: FastifyInstance) {
  // Get field change history for an entity
  app.get<{
    Params: { entityType: string; entityId: string }
  }>('/api/field-history/:entityType/:entityId', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { entityType, entityId } = request.params;

    const changes = await prisma.fieldChange.findMany({
      where: {
        organizationId: user.organizationId,
        entityType,
        entityId
      },
      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    return { changes };
  });

  // Get field changes for a specific field
  app.get<{
    Params: { entityType: string; entityId: string; fieldName: string }
  }>('/api/field-history/:entityType/:entityId/:fieldName', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { entityType, entityId, fieldName } = request.params;

    const changes = await prisma.fieldChange.findMany({
      where: {
        organizationId: user.organizationId,
        entityType,
        entityId,
        fieldName
      },
      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { changes };
  });

  // Get recent changes across the organization (admin view)
  app.get('/api/field-history/recent', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { limit = 50 } = request.query as any;

    const changes = await prisma.fieldChange.findMany({
      where: {
        organizationId: user.organizationId
      },
      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    return { changes };
  });
}

// Helper function to track field changes
export async function trackFieldChange(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changedByUserId: string;
  reasonCode?: string;
  note?: string;
}) {
  return prisma.fieldChange.create({
    data: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      fieldName: params.fieldName,
      oldValue: params.oldValue,
      newValue: params.newValue,
      changedByUserId: params.changedByUserId,
      reasonCode: params.reasonCode,
      note: params.note
    }
  });
}
