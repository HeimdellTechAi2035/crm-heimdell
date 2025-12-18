import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * Copilot Daily Focus Routes
 * 
 * Returns a prioritized "morning briefing" with actionable items:
 * - Stale deals needing attention
 * - Hot leads (high score, recent activity)
 * - Tasks due today
 * - Opportunities based on win/loss patterns
 */

interface DailyFocusItem {
  type: 'stale_deal' | 'hot_lead' | 'task_due' | 'opportunity';
  priority: number; // 1-100, higher = more urgent
  title: string;
  description: string;
  entityId: string;
  entityType: string;
  actionProposal?: string;
  metadata?: Record<string, any>;
}

const copilotDailyFocusRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/copilot/daily-focus
   * Returns prioritized action items for the day
   */
  fastify.get<{
    Querystring: {
      business_unit_id?: string;
      user_id?: string;
      limit?: number;
    };
  }>('/daily-focus', async (request, reply) => {
    const { business_unit_id, user_id, limit = 20 } = request.query;
    const items: DailyFocusItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      // 1. Stale Deals (high priority if > 14 days without activity)
      const staleDeals = await prisma.deal.findMany({
        where: {
          businessUnitId: business_unit_id || undefined,
          stage: { not: 'won' },
          closedAt: null,
          updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        include: {
          pipeline: true,
          company: true,
        },
        take: 10,
        orderBy: { updatedAt: 'asc' },
      });

      for (const deal of staleDeals) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - deal.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        const priority = Math.min(95, 60 + daysSinceUpdate);

        items.push({
          type: 'stale_deal',
          priority,
          title: `Stale Deal: ${deal.title}`,
          description: `No activity for ${daysSinceUpdate} days. ${deal.company?.name || 'Unknown company'}`,
          entityId: deal.id,
          entityType: 'deal',
          actionProposal: 'Send a check-in email or schedule a follow-up call',
          metadata: {
            value: deal.value,
            stage: deal.stage,
            daysSinceUpdate,
            companyName: deal.company?.name,
          },
        });
      }

      // 2. Hot Leads (high score + recent activity)
      const hotLeads = await prisma.lead.findMany({
        where: {
          businessUnitId: business_unit_id || undefined,
          status: { notIn: ['lost', 'converted'] },
          score: { gte: 70 },
          lastContactedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
        include: {
          company: true,
        },
        take: 10,
        orderBy: [{ score: 'desc' }, { lastContactedAt: 'desc' }],
      });

      for (const lead of hotLeads) {
        const priority = Math.min(90, lead.score || 70);

        items.push({
          type: 'hot_lead',
          priority,
          title: `Hot Lead: ${lead.firstName} ${lead.lastName}`,
          description: `Score: ${lead.score}. ${lead.company?.name || 'No company'}. Last contact: ${lead.lastContactedAt?.toLocaleDateString() || 'N/A'}`,
          entityId: lead.id,
          entityType: 'lead',
          actionProposal: 'High engagement - propose a demo or send pricing',
          metadata: {
            score: lead.score,
            email: lead.email,
            phone: lead.phone,
            companyName: lead.company?.name,
            lastContactedAt: lead.lastContactedAt,
          },
        });
      }

      // 3. Tasks Due Today
      const tasksDue = await prisma.task.findMany({
        where: {
          businessUnitId: business_unit_id || undefined,
          assignedToId: user_id || undefined,
          status: { not: 'done' },
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          lead: true,
          deal: true,
          company: true,
        },
        take: 15,
        orderBy: { dueDate: 'asc' },
      });

      for (const task of tasksDue) {
        const isOverdue = task.dueDate && task.dueDate < new Date();
        const priority = isOverdue ? 98 : 75;

        const relatedEntity = task.lead
          ? `Lead: ${task.lead.firstName} ${task.lead.lastName}`
          : task.deal
          ? `Deal: ${task.deal.title}`
          : task.company
          ? `Company: ${task.company.name}`
          : 'No related entity';

        items.push({
          type: 'task_due',
          priority,
          title: `Task: ${task.title}`,
          description: `${isOverdue ? '⚠️ OVERDUE' : 'Due today'}. ${relatedEntity}`,
          entityId: task.id,
          entityType: 'task',
          actionProposal: `Complete: ${task.description || task.title}`,
          metadata: {
            dueDate: task.dueDate,
            isOverdue,
            leadId: task.leadId,
            dealId: task.dealId,
            companyId: task.companyId,
          },
        });
      }

      // 4. Opportunities from Win/Loss Patterns
      // Find deals in stages with high win rates that haven't been updated recently
      const recentWins = await prisma.winLossReview.findMany({
        where: {
          outcome: 'won',
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        include: {
          deal: true,
        },
        take: 50,
      });

      // Identify common patterns in recent wins
      const winningStages = new Map<string, number>();
      for (const win of recentWins) {
        if (win.deal) {
          const count = winningStages.get(win.deal.stage) || 0;
          winningStages.set(win.deal.stage, count + 1);
        }
      }

      // Find deals in those winning stages
      const topWinningStages = Array.from(winningStages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([stage]) => stage);

      if (topWinningStages.length > 0) {
        const opportunityDeals = await prisma.deal.findMany({
          where: {
            businessUnitId: business_unit_id || undefined,
            stage: { in: topWinningStages },
            closedAt: null,
            updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          include: {
            company: true,
          },
          take: 5,
          orderBy: { value: 'desc' },
        });

        for (const deal of opportunityDeals) {
          items.push({
            type: 'opportunity',
            priority: 70,
            title: `Opportunity: ${deal.title}`,
            description: `In high-conversion stage "${deal.stage}". Recent wins show strong close rate.`,
            entityId: deal.id,
            entityType: 'deal',
            actionProposal: 'Push for close - this stage has high win rate',
            metadata: {
              value: deal.value,
              stage: deal.stage,
              companyName: deal.company?.name,
            },
          });
        }
      }

      // Sort by priority descending and limit results
      items.sort((a, b) => b.priority - a.priority);
      const limitedItems = items.slice(0, limit);

      return reply.send({
        generatedAt: new Date().toISOString(),
        businessUnitId: business_unit_id || null,
        userId: user_id || null,
        totalItems: limitedItems.length,
        items: limitedItems,
        summary: {
          staleDealCount: items.filter((i) => i.type === 'stale_deal').length,
          hotLeadCount: items.filter((i) => i.type === 'hot_lead').length,
          tasksDueCount: items.filter((i) => i.type === 'task_due').length,
          opportunityCount: items.filter((i) => i.type === 'opportunity').length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate daily focus' });
    }
  });

  /**
   * GET /api/copilot/smart-suggestions/:entityType/:entityId
   * Get contextual AI suggestions for a specific entity
   */
  fastify.get<{
    Params: {
      entityType: string;
      entityId: string;
    };
  }>('/smart-suggestions/:entityType/:entityId', async (request, reply) => {
    const { entityType, entityId } = request.params;

    try {
      const suggestions: Array<{
        title: string;
        description: string;
        action: string;
        confidence: number;
      }> = [];

      if (entityType === 'deal') {
        const deal = await prisma.deal.findUnique({
          where: { id: entityId },
          include: {
            dealIntel: true,
            winLossReview: true,
            company: true,
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        });

        if (!deal) {
          return reply.code(404).send({ error: 'Deal not found' });
        }

        // Suggestion 1: If no activity in 7 days
        const daysSinceActivity =
          deal.activities.length > 0
            ? Math.floor(
                (Date.now() - deal.activities[0].createdAt.getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            : 999;

        if (daysSinceActivity > 7) {
          suggestions.push({
            title: 'Schedule Follow-up',
            description: `No activity for ${daysSinceActivity} days. Risk of deal going cold.`,
            action: 'create_task',
            confidence: 0.85,
          });
        }

        // Suggestion 2: If deal intel has objections
        if (deal.dealIntel?.objections && deal.dealIntel.objections.length > 0) {
          suggestions.push({
            title: 'Address Objections',
            description: `${deal.dealIntel.objections.length} unresolved objections documented.`,
            action: 'view_playbook',
            confidence: 0.9,
          });
        }

        // Suggestion 3: If high value and no intel
        if (deal.value && deal.value > 50000 && !deal.dealIntel) {
          suggestions.push({
            title: 'Capture Deal Intelligence',
            description: 'High-value deal missing key intel (decision makers, pain points).',
            action: 'add_intel',
            confidence: 0.95,
          });
        }
      } else if (entityType === 'lead') {
        const lead = await prisma.lead.findUnique({
          where: { id: entityId },
          include: {
            company: true,
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        });

        if (!lead) {
          return reply.code(404).send({ error: 'Lead not found' });
        }

        // Suggestion 1: High score, no recent contact
        if (
          lead.score &&
          lead.score > 70 &&
          (!lead.lastContactedAt ||
            Date.now() - lead.lastContactedAt.getTime() > 2 * 24 * 60 * 60 * 1000)
        ) {
          suggestions.push({
            title: 'Contact Hot Lead',
            description: `Score: ${lead.score}. Strike while the iron is hot!`,
            action: 'send_email',
            confidence: 0.92,
          });
        }

        // Suggestion 2: Lead has company but no company enrichment
        if (lead.company && !lead.company.industry) {
          suggestions.push({
            title: 'Enrich Company Data',
            description: 'Company profile is incomplete. Add industry, size, revenue.',
            action: 'enrich_company',
            confidence: 0.75,
          });
        }
      }

      return reply.send({
        entityType,
        entityId,
        suggestions,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate suggestions' });
    }
  });
};

export default copilotDailyFocusRoutes;
