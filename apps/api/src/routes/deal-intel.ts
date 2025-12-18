import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function dealIntelRoutes(app: FastifyInstance) {
  // Get deal intel
  app.get<{ Params: { dealId: string } }>('/api/deals/:dealId/intel', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { dealId } = request.params;

    // Verify deal ownership
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        organizationId: user.organizationId
      }
    });

    if (!deal) {
      return reply.code(404).send({ error: 'Deal not found' });
    }

    const intel = await prisma.dealIntel.findUnique({
      where: { dealId }
    });

    return { intel: intel || null };
  });

  // Create or update deal intel
  app.put<{ Params: { dealId: string } }>('/api/deals/:dealId/intel', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { dealId } = request.params;
    const data = request.body as any;

    // Verify deal ownership
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        organizationId: user.organizationId
      }
    });

    if (!deal) {
      return reply.code(404).send({ error: 'Deal not found' });
    }

    const intel = await prisma.dealIntel.upsert({
      where: { dealId },
      create: {
        dealId,
        organizationId: user.organizationId,
        decisionMaker: data.decisionMaker,
        keyPainPoints: data.keyPainPoints,
        objections: data.objections,
        whatWorked: data.whatWorked,
        whatFailed: data.whatFailed,
        competitors: data.competitors,
        pricingNotes: data.pricingNotes,
        nextStepCommitment: data.nextStepCommitment
      },
      update: data
    });

    return { intel };
  });

  // Get win/loss review
  app.get<{ Params: { dealId: string } }>('/api/deals/:dealId/win-loss', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { dealId } = request.params;

    const review = await prisma.winLossReview.findUnique({
      where: { dealId },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return { review: review || null };
  });

  // Create win/loss review (required when deal closes)
  app.post<{ Params: { dealId: string } }>('/api/deals/:dealId/win-loss', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { dealId } = request.params;
    const data = request.body as any;

    // Verify deal ownership and that it's closed
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        organizationId: user.organizationId,
        status: { in: ['won', 'lost'] }
      }
    });

    if (!deal) {
      return reply.code(404).send({ error: 'Deal not found or not closed' });
    }

    // Check if review already exists
    const existing = await prisma.winLossReview.findUnique({
      where: { dealId }
    });

    if (existing) {
      return reply.code(400).send({ error: 'Win/Loss review already exists' });
    }

    const review = await prisma.winLossReview.create({
      data: {
        dealId,
        organizationId: user.organizationId,
        outcome: data.outcome, // 'won' or 'lost'
        primaryReasonCode: data.primaryReasonCode,
        notes: data.notes,
        learned: data.learned,
        createdByUserId: user.id
      }
    });

    return { review };
  });

  // Get win/loss patterns (for Copilot and analytics)
  app.get('/api/deals/win-loss/patterns', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { businessUnitId, outcome } = request.query as any;

    const where: any = {
      organizationId: user.organizationId
    };

    if (outcome) {
      where.outcome = outcome;
    }

    if (businessUnitId) {
      where.deal = {
        businessUnitId
      };
    }

    const reviews = await prisma.winLossReview.findMany({
      where,
      include: {
        deal: {
          select: {
            title: true,
            value: true,
            stage: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    // Aggregate by reason code
    const reasonCodeCounts: Record<string, number> = {};
    reviews.forEach(review => {
      reasonCodeCounts[review.primaryReasonCode] =
        (reasonCodeCounts[review.primaryReasonCode] || 0) + 1;
    });

    return {
      reviews,
      patterns: {
        reasonCodeCounts,
        totalReviews: reviews.length
      }
    };
  });
}
