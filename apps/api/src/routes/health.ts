import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function healthRoutes(app: FastifyInstance) {
  // Basic health check (public)
  app.get('/health', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      };
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Detailed health check (requires auth)
  app.get('/health/detailed', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const checks: Record<string, any> = {};

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy' };
    } catch (error: any) {
      checks.database = { status: 'unhealthy', error: error.message };
    }

    // Queue jobs check
    try {
      const queueStats = await prisma.queueJob.groupBy({
        by: ['status'],
        _count: true
      });

      checks.queue = {
        status: 'healthy',
        stats: queueStats
      };
    } catch (error: any) {
      checks.queue = { status: 'unhealthy', error: error.message };
    }

    // Recent errors
    try {
      const recentErrors = await prisma.systemAlert.count({
        where: {
          severity: { in: ['error', 'critical'] },
          acknowledged: false,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      checks.alerts = {
        status: recentErrors > 10 ? 'warning' : 'healthy',
        unacknowledgedErrors: recentErrors
      };
    } catch (error: any) {
      checks.alerts = { status: 'unknown', error: error.message };
    }

    const overallStatus = Object.values(checks).every(
      check => check.status === 'healthy'
    ) ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks
    };
  });

  // Queue worker status
  app.get('/health/workers', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    // Get queue stats by queue name
    const queueStats = await prisma.queueJob.groupBy({
      by: ['queueName', 'status'],
      _count: true,
      orderBy: {
        queueName: 'asc'
      }
    });

    // Get recent failed jobs
    const recentFailures = await prisma.queueJob.findMany({
      where: {
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    return {
      queueStats,
      recentFailures,
      timestamp: new Date().toISOString()
    };
  });

  // System alerts
  app.get('/api/system/alerts', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const { acknowledged, severity } = request.query as any;

    const where: any = {};

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    if (severity) {
      where.severity = severity;
    }

    const alerts = await prisma.systemAlert.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    return { alerts };
  });

  // Create system alert (internal use)
  app.post('/api/system/alerts', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const data = request.body as any;

    const alert = await prisma.systemAlert.create({
      data: {
        alertType: data.alertType,
        severity: data.severity,
        message: data.message,
        metadata: data.metadata
      }
    });

    // In production, send to Discord/Slack webhook here
    if (data.severity === 'critical' || data.severity === 'error') {
      // await sendDiscordAlert(alert);
    }

    return { alert };
  });

  // Acknowledge alert
  app.post<{ Params: { id: string } }>('/api/system/alerts/:id/acknowledge', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const { id } = request.params;

    const alert = await prisma.systemAlert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date()
      }
    });

    return { alert };
  });

  // Webhook events log
  app.get('/api/system/webhook-events', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const { provider, processed } = request.query as any;

    const where: any = {};

    if (provider) {
      where.provider = provider;
    }

    if (processed !== undefined) {
      where.processed = processed === 'true';
    }

    const events = await prisma.webhookEvent.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    return { events };
  });

  // Get failed webhook events
  app.get('/api/system/webhook-events/failed', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const events = await prisma.webhookEvent.findMany({
      where: {
        OR: [
          { signatureValid: false },
          {
            processed: true,
            errorMessage: { not: null }
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return { failedEvents: events };
  });

  // System stats dashboard
  app.get('/api/system/stats', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;

    // Run stats queries in parallel
    const [
      leadsCount,
      dealsCount,
      activeSequences,
      pendingImports,
      queueDepth,
      unacknowledgedAlerts
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId: user.organizationId } }),
      prisma.deal.count({
        where: {
          organizationId: user.organizationId,
          status: 'open'
        }
      }),
      prisma.sequenceEnrollment.count({
        where: {
          status: 'ACTIVE',
          sequence: {
            organizationId: user.organizationId
          }
        }
      }),
      prisma.importJob.count({
        where: {
          organizationId: user.organizationId,
          status: { in: ['uploaded', 'mapping_required', 'importing'] }
        }
      }),
      prisma.queueJob.count({
        where: {
          status: { in: ['waiting', 'active'] }
        }
      }),
      prisma.systemAlert.count({
        where: {
          acknowledged: false,
          severity: { in: ['error', 'critical'] }
        }
      })
    ]);

    return {
      stats: {
        leadsCount,
        dealsCount,
        activeSequences,
        pendingImports,
        queueDepth,
        unacknowledgedAlerts
      },
      timestamp: new Date().toISOString()
    };
  });
}
