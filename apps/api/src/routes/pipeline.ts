import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { advanceLead, getDueLeads, getNextSteps } from '../lib/transitions.js';
import { actorFromUser } from '../middleware/audit.js';
import { LeadStatus } from '@prisma/client';

// ─── Schemas ────────────────────────────────────────────────

const advanceSchema = z.object({
  targetStatus: z.nativeEnum(LeadStatus),
});

// ─── Routes ─────────────────────────────────────────────────

export async function pipelineRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /**
   * POST /api/pipeline/advance/:id
   *
   * Advance a lead to the next status. Validates transition rules,
   * applies preconditions, executes side-effects & auto-chains,
   * and writes audit logs — all atomically.
   */
  app.post<{ Params: { id: string } }>('/advance/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;
    const { targetStatus } = advanceSchema.parse(request.body);

    // Verify lead belongs to this org
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const result = await advanceLead(
      id,
      targetStatus,
      actorFromUser(user),
      'api',
    );

    if (!result.success) {
      return reply.code(422).send({
        error: 'Transition rejected',
        reason: result.error,
        currentStatus: lead.status,
        requestedStatus: targetStatus,
      });
    }

    return {
      lead: result.lead,
      transitions: result.transitions,
      message: `Advanced through ${result.transitions!.length} transition(s)`,
    };
  });

  /**
   * GET /api/pipeline/due
   *
   * Returns leads whose scheduled action is overdue (for operator dashboard).
   * The scheduler also uses this to find leads to auto-advance.
   */
  app.get('/due', async (request) => {
    const user = request.user!;

    const dueLeads = await getDueLeads(user.organizationId);

    return {
      count: dueLeads.length,
      leads: dueLeads.map((lead) => ({
        id: lead.id,
        company: lead.company,
        keyDecisionMaker: lead.keyDecisionMaker,
        status: lead.status,
        nextAction: lead.nextAction,
        nextActionDueUtc: lead.nextActionDueUtc,
        ownerId: lead.ownerId,
      })),
    };
  });

  /**
   * GET /api/pipeline/status/:id
   *
   * Show current status of a lead and what transitions are possible/why not.
   */
  app.get<{ Params: { id: string } }>('/status/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const steps = getNextSteps(lead);

    return {
      leadId: lead.id,
      company: lead.company,
      ...steps,
      actionFlags: {
        emailSent1: lead.emailSent1,
        dmLiSent1: lead.dmLiSent1,
        dmFbSent1: lead.dmFbSent1,
        dmIgSent1: lead.dmIgSent1,
        callDone: lead.callDone,
        emailSent2: lead.emailSent2,
        dmSent2: lead.dmSent2,
        waVoiceSent: lead.waVoiceSent,
        repliedAtUtc: lead.repliedAtUtc,
      },
    };
  });

  /**
   * POST /api/pipeline/scheduler-tick
   *
   * Called by cron/scheduler to advance WAITING leads whose timer expired.
   * Requires ADMIN or OPERATOR role.
   */
  app.post('/scheduler-tick', async (request, reply) => {
    const user = request.user!;
    if (!['ADMIN', 'OPERATOR'].includes(user.role)) {
      return reply.code(403).send({ error: 'Only ADMIN/OPERATOR can trigger scheduler' });
    }

    const dueLeads = await getDueLeads(user.organizationId);
    const results: { id: string; from: string; to: string; success: boolean; error?: string }[] = [];

    for (const lead of dueLeads) {
      // Determine target based on current waiting status
      let targetStatus: LeadStatus | null = null;
      if (lead.status === 'WAITING_D2') targetStatus = 'CALL_DUE';
      if (lead.status === 'WAITING_D1') targetStatus = 'CONTACTED_2';

      if (!targetStatus) continue;

      const result = await advanceLead(lead.id, targetStatus, 'system', 'scheduler');
      results.push({
        id: lead.id,
        from: lead.status,
        to: targetStatus,
        success: result.success,
        error: result.error,
      });
    }

    return {
      processed: results.length,
      results,
    };
  });
}
