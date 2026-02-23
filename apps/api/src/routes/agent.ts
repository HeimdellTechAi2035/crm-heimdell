/**
 * Heimdell CRM — Hardened Agent API Routes (OpenClaw Production)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Auth:          API key (Bearer hmdl_xxx)                    ║
 * ║  Idempotency:   Idempotency-Key header (24h dedup)           ║
 * ║  Observability: x-request-id, structured logs per action     ║
 * ║  Transition:    Deterministic action→status map              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, requirePermission, generateApiKey } from '../middleware/agent-auth.js';
import { advanceLead, getNextSteps, ACTION_FLAG_MAP, canTransition } from '../lib/transitions.js';
import { writeAuditLog, diffLead } from '../middleware/audit.js';
import { sendEmail } from '../services/email-smtp.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { idempotencyCheck, idempotencyStore } from '../lib/idempotency.js';
import { LeadStatus, Prisma, Lead } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════
//  Canonical Status Enum
// ═══════════════════════════════════════════════════════════════

const CANONICAL_STATUSES = [
  'NEW', 'CONTACTED_1', 'WAITING_D2', 'CALL_DUE', 'CALLED',
  'WAITING_D1', 'CONTACTED_2', 'WA_VOICE_DUE', 'REPLIED',
  'QUALIFIED', 'NOT_INTERESTED', 'COMPLETED',
] as const;

type CanonicalStatus = typeof CANONICAL_STATUSES[number];

// ═══════════════════════════════════════════════════════════════
//  Action → Deterministic Transition Map
// ═══════════════════════════════════════════════════════════════

const AGENT_ACTIONS = [
  'send_email_1', 'send_dm_li_1', 'send_dm_fb_1', 'send_dm_ig_1',
  'call_done', 'send_email_2', 'send_dm_2', 'send_wa_voice',
  'mark_replied', 'mark_qualified', 'mark_not_interested',
] as const;

type AgentAction = typeof AGENT_ACTIONS[number];

/**
 * Each action maps to:
 *   - allowedFrom: statuses from which this action can be performed
 *   - targetStatus: the status the lead transitions to (or null if no transition)
 *   - flag: the boolean field set on the lead (if any)
 */
interface ActionTransitionRule {
  allowedFrom: LeadStatus[];
  targetStatus: LeadStatus | null;
  flag: keyof Lead | null;
}

const ACTION_TRANSITION_MAP: Record<AgentAction, ActionTransitionRule> = {
  send_email_1: {
    allowedFrom: ['NEW'],
    targetStatus: 'CONTACTED_1',
    flag: 'emailSent1',
  },
  send_dm_li_1: {
    allowedFrom: ['NEW'],
    targetStatus: 'CONTACTED_1',
    flag: 'dmLiSent1',
  },
  send_dm_fb_1: {
    allowedFrom: ['NEW'],
    targetStatus: 'CONTACTED_1',
    flag: 'dmFbSent1',
  },
  send_dm_ig_1: {
    allowedFrom: ['NEW'],
    targetStatus: 'CONTACTED_1',
    flag: 'dmIgSent1',
  },
  call_done: {
    allowedFrom: ['CALL_DUE'],
    targetStatus: 'CALLED',
    flag: 'callDone',
  },
  send_email_2: {
    allowedFrom: ['WAITING_D1'],
    targetStatus: 'CONTACTED_2',
    flag: 'emailSent2',
  },
  send_dm_2: {
    allowedFrom: ['WAITING_D1'],
    targetStatus: 'CONTACTED_2',
    flag: 'dmSent2',
  },
  send_wa_voice: {
    allowedFrom: ['WA_VOICE_DUE'],
    targetStatus: 'COMPLETED',
    flag: 'waVoiceSent',
  },
  mark_replied: {
    allowedFrom: ['NEW', 'CONTACTED_1', 'WAITING_D2', 'CALL_DUE', 'CALLED', 'WAITING_D1', 'CONTACTED_2', 'WA_VOICE_DUE'],
    targetStatus: 'REPLIED',
    flag: null, // sets repliedAtUtc instead
  },
  mark_qualified: {
    allowedFrom: ['REPLIED'],
    targetStatus: 'QUALIFIED',
    flag: null,
  },
  mark_not_interested: {
    allowedFrom: ['NEW', 'CONTACTED_1', 'WAITING_D2', 'CALL_DUE', 'CALLED', 'WAITING_D1', 'CONTACTED_2', 'WA_VOICE_DUE', 'REPLIED'],
    targetStatus: 'NOT_INTERESTED',
    flag: null,
  },
};

// ═══════════════════════════════════════════════════════════════
//  Structured Logger
// ═══════════════════════════════════════════════════════════════

function agentLog(level: 'info' | 'warn' | 'error', data: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    service: 'heimdell-agent',
    level,
    ...data,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ═══════════════════════════════════════════════════════════════
//  Schemas
// ═══════════════════════════════════════════════════════════════

const agentUpdateLeadSchema = z.object({
  notes: z.string().optional(),
  emails: z.array(z.string().email()).optional(),
  number: z.string().optional(),
  mobileValid: z.boolean().optional(),
  facebookClean: z.string().optional(),
  instaClean: z.string().optional(),
  linkedinClean: z.string().optional(),
}).strict();

const agentActionSchema = z.object({
  action: z.enum(AGENT_ACTIONS),
  notes: z.string().optional(),
});

const agentAdvanceSchema = z.object({
  targetStatus: z.nativeEnum(LeadStatus),
});

const agentCreateLeadSchema = z.object({
  company: z.string().min(1),
  keyDecisionMaker: z.string().min(1),
  role: z.string().optional(),
  website: z.string().optional(),
  emails: z.array(z.string().email()).default([]),
  number: z.string().optional(),
  mobileValid: z.boolean().default(false),
  facebookClean: z.string().optional(),
  instaClean: z.string().optional(),
  linkedinClean: z.string().optional(),
  notes: z.string().optional(),
});

const agentBulkCreateSchema = z.object({
  leads: z.array(agentCreateLeadSchema).min(1).max(100),
});

const agentEmailSchema = z.object({
  leadId: z.string().optional(),
  senderEmail: z.string().email(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(50000),
  html: z.string().optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'update', 'transition', 'note'])).default(['read', 'update', 'transition', 'note']),
});

// ═══════════════════════════════════════════════════════════════
//  Agent Routes (API Key auth)
// ═══════════════════════════════════════════════════════════════

export async function agentRoutes(app: FastifyInstance) {
  // ─── Global hooks ───────────────────────────────────────

  // Authenticate all agent routes
  app.addHook('preHandler', authenticateAgent);

  // Inject x-request-id on every response
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const reqId = (request.headers['x-request-id'] as string) || randomUUID();
    (request as any).requestId = reqId;
    reply.header('x-request-id', reqId);
  });

  // Idempotency store hook (captures response for replay)
  app.addHook('onSend', idempotencyStore);

  // ═════════════════════════════════════════════════════════
  //  Health & Auth Test
  // ═════════════════════════════════════════════════════════

  /**
   * GET /api/agent/health
   * Health check — returns service info + canonical statuses/actions.
   */
  app.get('/health', async (request: FastifyRequest) => {
    const agent = request.agent!;
    return {
      status: 'ok',
      service: 'heimdell-agent-api',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      organization: agent.organizationId,
      statuses: CANONICAL_STATUSES,
      actions: AGENT_ACTIONS,
    };
  });

  /**
   * GET /api/agent/auth-test
   * Validates the API key and returns the agent context.
   */
  app.get('/auth-test', async (request: FastifyRequest) => {
    const agent = request.agent!;
    return {
      authenticated: true,
      agent: {
        keyName: agent.keyName,
        organizationId: agent.organizationId,
        permissions: agent.permissions,
        actor: agent.actor,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // ═════════════════════════════════════════════════════════
  //  Lead CRUD
  // ═════════════════════════════════════════════════════════

  /**
   * GET /api/agent/leads — List leads with optional filters.
   *
   * Query params: status, dueBefore, limit (max 100)
   */
  app.get('/leads', {
    preHandler: requirePermission('read'),
  }, async (request: FastifyRequest) => {
    const agent = request.agent!;
    const query = request.query as any;

    const where: Prisma.LeadWhereInput = {
      organizationId: agent.organizationId,
    };
    if (query.status) {
      if (!CANONICAL_STATUSES.includes(query.status)) {
        throw { statusCode: 400, message: `Invalid status: ${query.status}. Must be one of: ${CANONICAL_STATUSES.join(', ')}` };
      }
      where.status = query.status as LeadStatus;
    }
    if (query.dueBefore) where.nextActionDueUtc = { lte: new Date(query.dueBefore) };

    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 100);

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { nextActionDueUtc: 'asc' },
      take: limit,
    });

    agentLog('info', { event: 'leads_listed', actor: agent.actor, count: leads.length, filter: query.status ?? 'all' });

    return { leads, count: leads.length };
  });

  /**
   * POST /api/agent/leads — Create a new lead.
   */
  app.post('/leads', {
    preHandler: [requirePermission('update'), idempotencyCheck],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = request.agent!;
    const data = agentCreateLeadSchema.parse(request.body);

    const lead = await prisma.lead.create({
      data: {
        organizationId: agent.organizationId,
        company: data.company,
        keyDecisionMaker: data.keyDecisionMaker,
        role: data.role,
        website: data.website,
        emails: data.emails,
        number: data.number,
        mobileValid: data.mobileValid,
        facebookClean: data.facebookClean,
        instaClean: data.instaClean,
        linkedinClean: data.linkedinClean,
        notes: data.notes,
        status: 'NEW',
        nextAction: 'Send first outreach (DM or email)',
        nextActionDueUtc: new Date(),
      },
    });

    await writeAuditLog({
      leadId: lead.id,
      organizationId: agent.organizationId,
      actor: agent.actor,
      action: 'lead_created',
      before: null,
      after: { company: lead.company, keyDecisionMaker: lead.keyDecisionMaker, status: 'NEW' },
      source: 'agent',
    });

    agentLog('info', {
      event: 'lead_created',
      actor: agent.actor,
      leadId: lead.id,
      company: lead.company,
    });

    return reply.code(201).send({ lead });
  });

  /**
   * POST /api/agent/leads/bulk — Create multiple leads (max 100).
   */
  app.post('/leads/bulk', {
    preHandler: [requirePermission('update'), idempotencyCheck],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = request.agent!;
    const { leads: leadsData } = agentBulkCreateSchema.parse(request.body);

    const created: Lead[] = [];
    const errors: { company: string; error: string }[] = [];

    for (const data of leadsData) {
      try {
        const lead = await prisma.lead.create({
          data: {
            organizationId: agent.organizationId,
            company: data.company,
            keyDecisionMaker: data.keyDecisionMaker,
            role: data.role,
            website: data.website,
            emails: data.emails,
            number: data.number,
            mobileValid: data.mobileValid,
            facebookClean: data.facebookClean,
            instaClean: data.instaClean,
            linkedinClean: data.linkedinClean,
            notes: data.notes,
            status: 'NEW',
            nextAction: 'Send first outreach (DM or email)',
            nextActionDueUtc: new Date(),
          },
        });

        await writeAuditLog({
          leadId: lead.id,
          organizationId: agent.organizationId,
          actor: agent.actor,
          action: 'lead_created',
          before: null,
          after: { company: lead.company, keyDecisionMaker: lead.keyDecisionMaker, status: 'NEW' },
          source: 'agent',
        });

        created.push(lead);
      } catch (err: any) {
        errors.push({ company: data.company, error: err.message });
      }
    }

    agentLog('info', {
      event: 'leads_bulk_created',
      actor: agent.actor,
      created: created.length,
      errors: errors.length,
    });

    return reply.code(201).send({
      created: created.length,
      errors: errors.length,
      leads: created,
      failures: errors,
    });
  });

  /**
   * GET /api/agent/leads/:id — Get lead detail + pipeline state + available actions.
   */
  app.get<{ Params: { id: string } }>('/leads/:id', {
    preHandler: requirePermission('read'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found', leadId: id });

    const steps = getNextSteps(lead);

    // Compute which agent actions are available from current status
    const availableActions = Object.entries(ACTION_TRANSITION_MAP)
      .filter(([_, rule]) => rule.allowedFrom.includes(lead.status))
      .map(([action, rule]) => ({
        action,
        targetStatus: rule.targetStatus,
      }));

    return { lead, pipeline: steps, availableActions };
  });

  /**
   * PATCH /api/agent/leads/:id — Update non-pipeline fields.
   */
  app.patch<{ Params: { id: string } }>('/leads/:id', {
    preHandler: [requirePermission('update'), idempotencyCheck],
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;
    const updates = agentUpdateLeadSchema.parse(request.body);

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!existing) return reply.code(404).send({ error: 'Lead not found', leadId: id });

    const lead = await prisma.lead.update({
      where: { id },
      data: updates,
    });

    const { before, after } = diffLead(existing, lead, Object.keys(updates));
    if (Object.keys(after).length > 0) {
      await writeAuditLog({
        leadId: lead.id,
        organizationId: agent.organizationId,
        actor: agent.actor,
        action: 'field_update',
        before,
        after,
        source: 'agent',
      });
    }

    agentLog('info', {
      event: 'lead_updated',
      actor: agent.actor,
      leadId: id,
      fields: Object.keys(updates),
    });

    return { lead };
  });

  // ═════════════════════════════════════════════════════════
  //  PRIMARY TRANSITION PATH: POST /leads/:id/actions
  // ═════════════════════════════════════════════════════════

  /**
   * POST /api/agent/leads/:id/actions
   *
   * THE primary way for OpenClaw to move leads through the pipeline.
   * Each action deterministically maps to a status transition.
   *
   * Returns 409 with clear JSON if the transition is invalid.
   * Supports Idempotency-Key header for safe retries.
   */
  app.post<{ Params: { id: string } }>('/leads/:id/actions', {
    preHandler: [requirePermission('note'), idempotencyCheck],
  }, async (request, reply) => {
    const agent = request.agent!;
    const reqId = (request as any).requestId ?? randomUUID();
    const { id } = request.params;
    const { action, notes } = agentActionSchema.parse(request.body);

    // ── Fetch lead ──
    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!existing) {
      return reply.code(404).send({
        error: 'Lead not found',
        leadId: id,
        requestId: reqId,
      });
    }

    const statusBefore = existing.status;

    // ── Validate action against transition map ──
    const rule = ACTION_TRANSITION_MAP[action];
    if (!rule) {
      return reply.code(400).send({
        error: 'Unknown action',
        action,
        validActions: [...AGENT_ACTIONS],
        requestId: reqId,
      });
    }

    if (!rule.allowedFrom.includes(existing.status)) {
      // Compute which actions ARE allowed from the current status
      const allowedActions = Object.entries(ACTION_TRANSITION_MAP)
        .filter(([_, r]) => r.allowedFrom.includes(existing.status))
        .map(([a]) => a);

      agentLog('warn', {
        event: 'transition_rejected',
        actor: agent.actor,
        leadId: id,
        action,
        statusBefore,
        reason: `Action "${action}" not allowed from status "${existing.status}"`,
        allowedActions,
      });

      return reply.code(409).send({
        error: 'Invalid transition',
        action,
        currentStatus: existing.status,
        allowedFrom: rule.allowedFrom,
        allowedActions,
        targetStatus: rule.targetStatus,
        message: `Cannot perform "${action}" when lead is in "${existing.status}". Allowed from: ${rule.allowedFrom.join(', ')}`,
        requestId: reqId,
      });
    }

    // ── Build update data ──
    const updateData: Prisma.LeadUpdateInput = { lastActionUtc: new Date() };

    // Set the action flag if applicable
    if (rule.flag) {
      if ((existing as any)[rule.flag] === true) {
        return reply.code(409).send({
          error: 'Action already recorded',
          action,
          flag: rule.flag,
          message: `"${action}" has already been recorded for this lead`,
          requestId: reqId,
        });
      }
      (updateData as any)[rule.flag] = true;
    }

    // Special handling for mark_replied
    if (action === 'mark_replied') {
      if (existing.repliedAtUtc) {
        return reply.code(409).send({
          error: 'Already replied',
          repliedAt: existing.repliedAtUtc,
          message: 'This lead has already been marked as replied',
          requestId: reqId,
        });
      }
      updateData.repliedAtUtc = new Date();
    }

    // Special handling for mark_qualified
    if (action === 'mark_qualified') {
      (updateData as any).qualified = true;
    }

    // Append notes
    if (notes) {
      const timestamp = new Date().toISOString();
      updateData.notes = existing.notes
        ? `${existing.notes}\n[${timestamp}] ${agent.actor}:${action}: ${notes}`
        : `[${timestamp}] ${agent.actor}:${action}: ${notes}`;
    }

    // ── Apply flag/notes BEFORE transition so preconditions see updated values ──
    await prisma.lead.update({ where: { id }, data: updateData });

    // ── Execute transition if mapped ──
    let statusAfter = statusBefore;
    let transitions: { from: LeadStatus; to: LeadStatus }[] = [];

    if (rule.targetStatus) {
      // Use the transition engine for full side-effects + auto-chains
      const result = await advanceLead(id, rule.targetStatus, agent.actor, 'agent');
      if (!result.success) {
        return reply.code(409).send({
          error: 'Transition engine rejected',
          action,
          reason: result.error,
          currentStatus: existing.status,
          targetStatus: rule.targetStatus,
          requestId: reqId,
        });
      }

      statusAfter = result.lead!.status;
      transitions = result.transitions ?? [];
    }

    // ── Write audit log for the action itself ──
    await writeAuditLog({
      leadId: id,
      organizationId: agent.organizationId,
      actor: agent.actor,
      action: 'action_logged',
      before: { status: statusBefore, flag: rule.flag ? (existing as any)[rule.flag] : null },
      after: { status: statusAfter, action, flag: rule.flag ?? null },
      source: 'agent',
    });

    // ── Structured log ──
    agentLog('info', {
      event: 'action_executed',
      requestId: reqId,
      actor: agent.actor,
      leadId: id,
      action,
      statusBefore,
      statusAfter,
      transitions,
    });

    // ── Fetch final lead state ──
    const updatedLead = await prisma.lead.findUnique({ where: { id } });

    return {
      lead: updatedLead,
      action,
      statusBefore,
      statusAfter,
      transitions,
      requestId: reqId,
    };
  });

  // ═════════════════════════════════════════════════════════
  //  Direct Advance (still available, but /actions is primary)
  // ═════════════════════════════════════════════════════════

  /**
   * POST /api/agent/leads/:id/advance
   * Direct status transition. Use /actions instead for most cases.
   */
  app.post<{ Params: { id: string } }>('/leads/:id/advance', {
    preHandler: [requirePermission('transition'), idempotencyCheck],
  }, async (request, reply) => {
    const agent = request.agent!;
    const reqId = (request as any).requestId ?? randomUUID();
    const { id } = request.params;
    const { targetStatus } = agentAdvanceSchema.parse(request.body);

    if (!CANONICAL_STATUSES.includes(targetStatus as any)) {
      return reply.code(400).send({
        error: 'Invalid status',
        targetStatus,
        validStatuses: [...CANONICAL_STATUSES],
        requestId: reqId,
      });
    }

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found', leadId: id, requestId: reqId });

    const statusBefore = lead.status;
    const result = await advanceLead(id, targetStatus, agent.actor, 'agent');

    if (!result.success) {
      agentLog('warn', {
        event: 'advance_rejected',
        actor: agent.actor,
        leadId: id,
        statusBefore,
        targetStatus,
        reason: result.error,
      });

      return reply.code(409).send({
        error: 'Transition rejected',
        reason: result.error,
        currentStatus: lead.status,
        targetStatus,
        requestId: reqId,
      });
    }

    agentLog('info', {
      event: 'lead_advanced',
      requestId: reqId,
      actor: agent.actor,
      leadId: id,
      statusBefore,
      statusAfter: result.lead!.status,
      transitions: result.transitions,
    });

    return {
      lead: result.lead,
      transitions: result.transitions,
      requestId: reqId,
    };
  });

  // ═════════════════════════════════════════════════════════
  //  Email Send
  // ═════════════════════════════════════════════════════════

  /**
   * POST /api/agent/email/send — Send email via SMTP.
   */
  app.post('/email/send', {
    preHandler: [requirePermission('note'), idempotencyCheck],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = request.agent!;
    const reqId = (request as any).requestId ?? randomUUID();
    const body = agentEmailSchema.parse(request.body);

    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, organizationId: agent.organizationId },
      });
      if (!lead) return reply.code(404).send({ error: 'Lead not found', leadId: body.leadId, requestId: reqId });
    }

    const result = await sendEmail({
      senderEmail: body.senderEmail,
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      leadId: body.leadId,
      actor: agent.actor,
    });

    agentLog('info', {
      event: 'email_sent',
      requestId: reqId,
      actor: agent.actor,
      to: body.to,
      leadId: body.leadId,
      ok: result.ok,
    });

    if (!result.ok) {
      return reply.code(422).send({ ...result, requestId: reqId });
    }

    return { ...result, requestId: reqId };
  });

  // ═════════════════════════════════════════════════════════
  //  Schema / Spec Endpoint
  // ═════════════════════════════════════════════════════════

  /**
   * GET /api/agent/openapi — Returns the OpenAPI spec for agent routes.
   */
  app.get('/openapi', async () => {
    return OPENAPI_SPEC;
  });
}

// ═══════════════════════════════════════════════════════════════
//  API Key Management Routes (JWT auth, ADMIN only)
// ═══════════════════════════════════════════════════════════════

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', {
    preHandler: authorize('ADMIN'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { name, permissions } = createApiKeySchema.parse(request.body);

    const { raw, hash, prefix } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        organizationId: user.organizationId,
        name,
        keyHash: hash,
        prefix,
        permissions,
      },
    });

    return reply.code(201).send({
      key: raw,
      prefix,
      name,
      permissions,
      warning: 'Store this key securely. It cannot be retrieved again.',
    });
  });

  app.get('/', async (request: FastifyRequest) => {
    const user = request.user!;

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { keys };
  });

  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: authorize('ADMIN'),
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;

    const key = await prisma.apiKey.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!key) return reply.code(404).send({ error: 'API key not found' });

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: `API key "${key.name}" revoked` };
  });
}

// ═══════════════════════════════════════════════════════════════
//  OpenAPI Spec (inline)
// ═══════════════════════════════════════════════════════════════

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Heimdell CRM Agent API',
    version: '2.0.0',
    description: 'Deterministic outreach pipeline API for OpenClaw and external agents.',
  },
  servers: [{ url: '/api/agent' }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key prefixed with hmdl_',
      },
    },
    schemas: {
      LeadStatus: {
        type: 'string',
        enum: [...CANONICAL_STATUSES],
      },
      AgentAction: {
        type: 'string',
        enum: [...AGENT_ACTIONS],
        description: 'Deterministic action names that map to pipeline transitions',
      },
      Lead: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          company: { type: 'string' },
          keyDecisionMaker: { type: 'string' },
          status: { $ref: '#/components/schemas/LeadStatus' },
          emails: { type: 'array', items: { type: 'string' } },
          number: { type: 'string', nullable: true },
          nextAction: { type: 'string', nullable: true },
          nextActionDueUtc: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ActionRequest: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { $ref: '#/components/schemas/AgentAction' },
          notes: { type: 'string', description: 'Optional note to append to the lead' },
        },
      },
      ActionResponse: {
        type: 'object',
        properties: {
          lead: { $ref: '#/components/schemas/Lead' },
          action: { type: 'string' },
          statusBefore: { $ref: '#/components/schemas/LeadStatus' },
          statusAfter: { $ref: '#/components/schemas/LeadStatus' },
          transitions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { $ref: '#/components/schemas/LeadStatus' },
                to: { $ref: '#/components/schemas/LeadStatus' },
              },
            },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          currentStatus: { $ref: '#/components/schemas/LeadStatus' },
          allowedFrom: { type: 'array', items: { $ref: '#/components/schemas/LeadStatus' } },
          allowedActions: { type: 'array', items: { type: 'string' } },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      CreateLeadRequest: {
        type: 'object',
        required: ['company', 'keyDecisionMaker'],
        properties: {
          company: { type: 'string' },
          keyDecisionMaker: { type: 'string' },
          role: { type: 'string' },
          website: { type: 'string' },
          emails: { type: 'array', items: { type: 'string', format: 'email' } },
          number: { type: 'string' },
          mobileValid: { type: 'boolean' },
          facebookClean: { type: 'string' },
          instaClean: { type: 'string' },
          linkedinClean: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
    parameters: {
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Unique key for idempotent requests. Same key returns cached response for 24h.',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        operationId: 'agentHealth',
        responses: { '200': { description: 'Service healthy, returns canonical statuses and actions' } },
      },
    },
    '/auth-test': {
      get: {
        summary: 'Validate API key',
        operationId: 'agentAuthTest',
        responses: {
          '200': { description: 'API key valid — returns agent context' },
          '401': { description: 'Invalid or missing API key' },
        },
      },
    },
    '/leads': {
      get: {
        summary: 'List leads',
        operationId: 'listLeads',
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/LeadStatus' } },
          { name: 'dueBefore', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100, default: 100 } },
        ],
        responses: { '200': { description: 'Leads list' } },
      },
      post: {
        summary: 'Create a lead',
        operationId: 'createLead',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateLeadRequest' } } },
        },
        responses: { '201': { description: 'Lead created' } },
      },
    },
    '/leads/bulk': {
      post: {
        summary: 'Bulk create leads (max 100)',
        operationId: 'bulkCreateLeads',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  leads: { type: 'array', items: { $ref: '#/components/schemas/CreateLeadRequest' }, maxItems: 100 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Leads created' } },
      },
    },
    '/leads/{id}': {
      get: {
        summary: 'Get lead detail + available actions',
        operationId: 'getLead',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Lead detail with pipeline state and available actions' },
          '404': { description: 'Lead not found' },
        },
      },
      patch: {
        summary: 'Update lead fields (non-pipeline)',
        operationId: 'updateLead',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/IdempotencyKey' },
        ],
        responses: {
          '200': { description: 'Lead updated' },
          '404': { description: 'Lead not found' },
        },
      },
    },
    '/leads/{id}/actions': {
      post: {
        summary: 'Execute an outreach action (PRIMARY transition path)',
        operationId: 'executeAction',
        description: 'The primary way to move leads through the pipeline. Each action deterministically maps to a status transition via ACTION_TRANSITION_MAP. Returns 409 with structured error JSON if the transition is invalid, including the list of currently-allowed actions.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/IdempotencyKey' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ActionRequest' },
              examples: {
                sendEmail: { summary: 'Send first email', value: { action: 'send_email_1', notes: 'Sent intro about SEO audit' } },
                markReplied: { summary: 'Mark as replied', value: { action: 'mark_replied', notes: 'Replied interested in proposal' } },
                markQualified: { summary: 'Qualify lead', value: { action: 'mark_qualified', notes: 'Booked discovery call' } },
                markNotInterested: { summary: 'Mark not interested', value: { action: 'mark_not_interested', notes: 'Wrong ICP' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Action executed — returns lead, transition chain, and requestId',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ActionResponse' } } },
          },
          '404': { description: 'Lead not found' },
          '409': {
            description: 'Invalid transition — includes currentStatus, allowedActions, reason',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/leads/{id}/advance': {
      post: {
        summary: 'Direct status transition (use /actions instead for most cases)',
        operationId: 'advanceLead',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/IdempotencyKey' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetStatus'],
                properties: { targetStatus: { $ref: '#/components/schemas/LeadStatus' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Lead advanced' },
          '409': { description: 'Transition rejected' },
        },
      },
    },
    '/email/send': {
      post: {
        summary: 'Send email via SMTP',
        operationId: 'sendEmail',
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        responses: {
          '200': { description: 'Email sent' },
          '422': { description: 'Email sending failed' },
        },
      },
    },
    '/openapi': {
      get: {
        summary: 'Get OpenAPI spec for agent routes',
        operationId: 'getOpenApiSpec',
        responses: { '200': { description: 'OpenAPI 3.0 spec JSON' } },
      },
    },
  },
};

// Export for testing
export { ACTION_TRANSITION_MAP, CANONICAL_STATUSES, AGENT_ACTIONS };
