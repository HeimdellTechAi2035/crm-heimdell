import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function emailIdentitiesRoutes(app: FastifyInstance) {
  // List email identities
  app.get('/api/email-identities', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { businessUnitId } = request.query as any;

    const where: any = {
      organizationId: user.organizationId
    };

    if (businessUnitId) {
      where.businessUnitId = businessUnitId;
    }

    const identities = await prisma.emailIdentity.findMany({
      where,
      select: {
        id: true,
        businessUnitId: true,
        fromName: true,
        fromEmail: true,
        dailySendLimit: true,
        perMinuteLimit: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        timezone: true,
        warmupState: true,
        isActive: true,
        createdAt: true
        // Exclude smtp credentials
      },
      orderBy: {
        fromEmail: 'asc'
      }
    });

    return { identities };
  });

  // Create email identity (ADMIN/MANAGER only)
  app.post('/api/email-identities', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = request.body as any;

    // Validate unique from_email per org
    const existing = await prisma.emailIdentity.findFirst({
      where: {
        organizationId: user.organizationId,
        fromEmail: data.fromEmail
      }
    });

    if (existing) {
      return reply.code(400).send({ error: 'Email identity already exists' });
    }

    // TODO: Encrypt smtpPass before storing
    const identity = await prisma.emailIdentity.create({
      data: {
        organizationId: user.organizationId,
        businessUnitId: data.businessUnitId || null,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: data.smtpPass, // Encrypt this!
        dailySendLimit: data.dailySendLimit || 100,
        perMinuteLimit: data.perMinuteLimit || 10,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        timezone: data.timezone || 'Europe/London'
      }
    });

    return { identity };
  });

  // Update warmup state (ADMIN only)
  app.patch<{ Params: { id: string } }>('/api/email-identities/:id/warmup', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;
    const { warmupState } = request.body as any;

    const identity = await prisma.emailIdentity.findFirst({
      where: { id, organizationId: user.organizationId }
    });

    if (!identity) {
      return reply.code(404).send({ error: 'Email identity not found' });
    }

    const updated = await prisma.emailIdentity.update({
      where: { id },
      data: { warmupState }
    });

    return { identity: updated };
  });

  // Check if sending is allowed (internal endpoint for queue worker)
  app.post<{ Params: { id: string } }>('/api/email-identities/:id/can-send', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    const identity = await prisma.emailIdentity.findFirst({
      where: { id, organizationId: user.organizationId }
    });

    if (!identity) {
      return reply.code(404).send({ error: 'Email identity not found' });
    }

    // Check if restricted
    if (identity.warmupState === 'restricted') {
      return {
        canSend: false,
        reason: 'Warmup state is restricted'
      };
    }

    // Check quiet hours
    const now = new Date();
    const currentHour = now.toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: identity.timezone
    });

    if (identity.quietHoursStart && identity.quietHoursEnd) {
      if (
        currentHour >= identity.quietHoursStart &&
        currentHour <= identity.quietHoursEnd
      ) {
        return {
          canSend: false,
          reason: 'Within quiet hours',
          retryAfter: identity.quietHoursEnd
        };
      }
    }

    // TODO: Check daily send limit from queue job counts

    return {
      canSend: true
    };
  });
}
