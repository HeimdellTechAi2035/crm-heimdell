import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function forecastingRoutes(app: FastifyInstance) {
  // Get forecast for a pipeline
  app.get<{
    Querystring: {
      pipelineId?: string;
      businessUnitId?: string;
      ownerId?: string;
      startDate?: string;
      endDate?: string;
    }
  }>('/api/forecasting/pipeline', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { pipelineId, businessUnitId, ownerId, startDate, endDate } = request.query;

    const where: any = {
      organizationId: user.organizationId,
      status: 'open'
    };

    if (pipelineId) where.pipelineId = pipelineId;
    if (businessUnitId) where.businessUnitId = businessUnitId;
    if (ownerId) where.ownerId = ownerId;

    if (startDate && endDate) {
      where.expectedCloseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        stage: {
          include: {
            pipeline: true
          }
        }
      }
    });

    // Get stage probabilities
    const stageProbabilities = await prisma.stageProbability.findMany({
      where: {
        organizationId: user.organizationId
      }
    });

    const probabilityMap = new Map<string, number>();
    stageProbabilities.forEach(sp => {
      probabilityMap.set(sp.stageId, sp.probability);
    });

    // Calculate metrics
    let pipelineValue = 0;
    let expectedValue = 0;
    let probableValue = 0;

    deals.forEach(deal => {
      pipelineValue += deal.value;

      // Expected value (using configured stage probability)
      const stageProbability = probabilityMap.get(deal.stageId) || deal.stage.probability / 100;
      expectedValue += deal.value * stageProbability;

      // Probable value (using historical close rate if available)
      const stageProb = stageProbabilities.find(sp => sp.stageId === deal.stageId);
      const historicalRate = stageProb?.historicalCloseRate || stageProbability;
      probableValue += deal.value * historicalRate;
    });

    return {
      forecast: {
        pipelineValue,
        expectedValue,
        probableValue,
        dealsCount: deals.length,
        dealsByStage: groupByStage(deals)
      }
    };
  });

  // Get stale deals (for "reality check")
  app.get('/api/forecasting/stale-deals', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { daysInactive = 14, businessUnitId } = request.query as any;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(daysInactive));

    const where: any = {
      organizationId: user.organizationId,
      status: 'open',
      updatedAt: {
        lt: cutoffDate
      }
    };

    if (businessUnitId) {
      where.businessUnitId = businessUnitId;
    }

    const staleDeals = await prisma.deal.findMany({
      where,
      include: {
        stage: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        activities: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    return {
      staleDeals: staleDeals.map(deal => ({
        ...deal,
        daysSinceUpdate: Math.floor(
          (Date.now() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      }))
    };
  });

  // Configure stage probability
  app.post('/api/forecasting/stage-probability', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { pipelineId, stageId, probability } = request.body as any;

    const stageProbability = await prisma.stageProbability.upsert({
      where: {
        organizationId_pipelineId_stageId: {
          organizationId: user.organizationId,
          pipelineId,
          stageId
        }
      },
      create: {
        organizationId: user.organizationId,
        pipelineId,
        stageId,
        probability: Number(probability)
      },
      update: {
        probability: Number(probability)
      }
    });

    return { stageProbability };
  });

  // Get historical conversion rates (for nightly job to compute)
  app.get('/api/forecasting/conversion-rates', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { pipelineId, businessUnitId } = request.query as any;

    // This would be computed by a background job
    // For now, return configured probabilities
    const stageProbabilities = await prisma.stageProbability.findMany({
      where: {
        organizationId: user.organizationId,
        ...(pipelineId && { pipelineId })
      },
      include: {
        pipeline: {
          include: {
            stages: true
          }
        }
      }
    });

    return { conversionRates: stageProbabilities };
  });
}

function groupByStage(deals: any[]) {
  const groups: Record<string, { count: number; value: number; stageName: string }> = {};

  deals.forEach(deal => {
    const stageId = deal.stageId;
    if (!groups[stageId]) {
      groups[stageId] = {
        stageName: deal.stage.name,
        count: 0,
        value: 0
      };
    }
    groups[stageId].count++;
    groups[stageId].value += deal.value;
  });

  return groups;
}
