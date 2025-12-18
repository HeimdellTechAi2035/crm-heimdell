import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { startDate, endDate } = request.query as any;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orgId = (request.user as any).organizationId;

    // Get metrics in parallel
    const [
      newLeads,
      contactedLeads,
      dealsCreated,
      dealsWon,
      dealsLost,
      totalDealValue,
      wonDealValue,
      avgTimeToClose,
      leadsPerDay,
      repActivity,
      taskStats,
      stageConversion,
    ] = await Promise.all([
      // New leads count
      prisma.lead.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lte: end },
        },
      }),

      // Contacted leads count
      prisma.lead.count({
        where: {
          organizationId: orgId,
          lastContactedAt: { gte: start, lte: end },
        },
      }),

      // Deals created
      prisma.deal.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lte: end },
        },
      }),

      // Deals won
      prisma.deal.count({
        where: {
          organizationId: orgId,
          status: 'won',
          closedAt: { gte: start, lte: end },
        },
      }),

      // Deals lost
      prisma.deal.count({
        where: {
          organizationId: orgId,
          status: 'lost',
          closedAt: { gte: start, lte: end },
        },
      }),

      // Total deal value (open + won)
      prisma.deal.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lte: end },
        },
        _sum: { value: true },
      }),

      // Won deal value
      prisma.deal.aggregate({
        where: {
          organizationId: orgId,
          status: 'won',
          closedAt: { gte: start, lte: end },
        },
        _sum: { value: true },
      }),

      // Average time to close (in days)
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) as avg_days
        FROM deals
        WHERE organization_id = ${orgId}
          AND status = 'won'
          AND closed_at >= ${start}
          AND closed_at <= ${end}
      `,

      // Leads created per day
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM leads
        WHERE organization_id = ${orgId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,

      // Rep activity counts
      prisma.activity.groupBy({
        by: ['userId'],
        where: {
          organizationId: orgId,
          createdAt: { gte: start, lte: end },
        },
        _count: { id: true },
      }),

      // Task stats
      prisma.task.groupBy({
        by: ['status'],
        where: {
          organizationId: orgId,
        },
        _count: { id: true },
      }),

      // Stage conversion rates
      prisma.$queryRaw`
        SELECT 
          s.name as stage_name,
          s.position,
          COUNT(DISTINCT d.id) as deal_count,
          COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) as won_count
        FROM stages s
        LEFT JOIN deals d ON d.stage_id = s.id AND d.organization_id = ${orgId}
        WHERE s.pipeline_id IN (
          SELECT id FROM pipelines WHERE organization_id = ${orgId}
        )
        GROUP BY s.id, s.name, s.position
        ORDER BY s.position
      `,
    ]);

    // Get user names for rep activity
    const userIds = repActivity.map((r: any) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const repActivityWithNames = repActivity.map((r: any) => ({
      user: users.find((u: any) => u.id === r.userId),
      activityCount: r._count.id,
    }));

    const metrics = {
      overview: {
        newLeads,
        contactedLeads,
        dealsCreated,
        dealsWon,
        dealsLost,
        totalPipelineValue: totalDealValue._sum.value || 0,
        wonValue: wonDealValue._sum.value || 0,
        avgTimeToClose: (avgTimeToClose as any)[0]?.avg_days || 0,
        winRate: dealsCreated > 0 ? (dealsWon / dealsCreated) * 100 : 0,
      },
      leadsPerDay,
      repActivity: repActivityWithNames,
      taskStats: {
        todo: taskStats.find((t: any) => t.status === 'TODO')?._count.id || 0,
        inProgress: taskStats.find((t: any) => t.status === 'IN_PROGRESS')?._count.id || 0,
        done: taskStats.find((t: any) => t.status === 'DONE')?._count.id || 0,
        cancelled: taskStats.find((t: any) => t.status === 'CANCELLED')?._count.id || 0,
      },
      stageConversion,
    };

    reply.send({ metrics, period: { start, end } });
  });
}



