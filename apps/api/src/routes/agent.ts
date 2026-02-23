/**
 * Heimdell CRM — Agent API Routes
 *
 * Endpoints for OpenClaw and other external agents to interact with leads.
 * Authenticated via API key (not JWT).
 *
 * All endpoints scoped to the API key's organization.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, requirePermission, generateApiKey } from '../middleware/agent-auth.js';
import { advanceLead, getNextSteps, ACTION_FLAG_MAP } from '../lib/transitions.js';
import { writeAuditLog, diffLead } from '../middleware/audit.js';
import { sendEmail } from '../services/email-smtp.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';
import { LeadStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';

// ─── Schemas ────────────────────────────────────────────────

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
  action: z.enum([
    'send_email_1',
    'send_dm_li_1',
    'send_dm_fb_1',
    'send_dm_ig_1',
    'call_done',
    'send_email_2',
    'send_dm_2',
    'send_wa_voice',
    'mark_replied',
  ]),
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

// ─── Agent Routes (API Key auth) ────────────────────────────

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateAgent);

  /**
   * GET /api/agent/leads — List leads with optional filters.
   */
  app.get('/leads', {
    preHandler: requirePermission('read'),
  }, async (request) => {
    const agent = request.agent!;
    const query = request.query as any;

    const where: Prisma.LeadWhereInput = {
      organizationId: agent.organizationId,
    };
    if (query.status) where.status = query.status as LeadStatus;
    if (query.dueBefore) where.nextActionDueUtc = { lte: new Date(query.dueBefore) };

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { nextActionDueUtc: 'asc' },
      take: 100,
    });

    return { leads, count: leads.length };
  });

  /**
   * POST /api/agent/leads — Create a new lead.
   */
  app.post('/leads', {
    preHandler: requirePermission('update'),
  }, async (request, reply) => {
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

    return reply.code(201).send({ lead });
  });

  /**
   * POST /api/agent/leads/bulk — Create multiple leads at once (max 100).
   */
  app.post('/leads/bulk', {
    preHandler: requirePermission('update'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { leads: leadsData } = agentBulkCreateSchema.parse(request.body);

    const created: any[] = [];
    const errors: any[] = [];

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

    return reply.code(201).send({ created: created.length, errors: errors.length, leads: created, failures: errors });
  });

  /**
   * GET /api/agent/leads/:id — Get a single lead with pipeline status.
   */
  app.get<{ Params: { id: string } }>('/leads/:id', {
    preHandler: requirePermission('read'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const steps = getNextSteps(lead);
    return { lead, pipeline: steps };
  });

  /**
   * PATCH /api/agent/leads/:id — Update non-pipeline fields.
   */
  app.patch<{ Params: { id: string } }>('/leads/:id', {
    preHandler: requirePermission('update'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;
    const updates = agentUpdateLeadSchema.parse(request.body);

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!existing) return reply.code(404).send({ error: 'Lead not found' });

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

    return { lead };
  });

  /**
   * POST /api/agent/leads/:id/actions — Log an outreach action.
   */
  app.post<{ Params: { id: string } }>('/leads/:id/actions', {
    preHandler: requirePermission('note'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;
    const { action, notes } = agentActionSchema.parse(request.body);

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!existing) return reply.code(404).send({ error: 'Lead not found' });

    const flagField = ACTION_FLAG_MAP[action];
    if (!flagField) return reply.code(400).send({ error: `Unknown action: ${action}` });

    const updateData: Prisma.LeadUpdateInput = { lastActionUtc: new Date() };

    if (action === 'mark_replied') {
      if (existing.repliedAtUtc) return reply.code(409).send({ error: 'Already replied' });
      updateData.repliedAtUtc = new Date();
    } else {
      if ((existing as any)[flagField] === true) return reply.code(409).send({ error: `${action} already recorded` });
      (updateData as any)[flagField] = true;
    }

    if (notes) {
      updateData.notes = existing.notes
        ? `${existing.notes}\n[${new Date().toISOString()}] agent:${action}: ${notes}`
        : `[${new Date().toISOString()}] agent:${action}: ${notes}`;
    }

    const lead = await prisma.lead.update({ where: { id }, data: updateData });

    await writeAuditLog({
      leadId: lead.id,
      organizationId: agent.organizationId,
      actor: agent.actor,
      action: 'action_logged',
      before: { [String(flagField)]: (existing as any)[flagField] },
      after: { [String(flagField)]: action === 'mark_replied' ? lead.repliedAtUtc : true, action },
      source: 'agent',
    });

    return { lead, actionRecorded: action };
  });

  /**
   * POST /api/agent/leads/:id/advance — Advance pipeline status.
   */
  app.post<{ Params: { id: string } }>('/leads/:id/advance', {
    preHandler: requirePermission('transition'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const { id } = request.params;
    const { targetStatus } = agentAdvanceSchema.parse(request.body);

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: agent.organizationId },
    });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const result = await advanceLead(id, targetStatus, agent.actor, 'agent');
    if (!result.success) {
      return reply.code(422).send({
        error: 'Transition rejected',
        reason: result.error,
        currentStatus: lead.status,
      });
    }

    return { lead: result.lead, transitions: result.transitions };
  });

  /**
   * POST /api/agent/email/send — Send an email via the agent API.
   * Requires 'note' permission (covers outreach actions).
   */
  app.post('/email/send', {
    preHandler: requirePermission('note'),
  }, async (request, reply) => {
    const agent = request.agent!;
    const body = agentEmailSchema.parse(request.body);

    // If leadId provided, verify org ownership
    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, organizationId: agent.organizationId },
      });
      if (!lead) return reply.code(404).send({ error: 'Lead not found' });
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

    if (!result.ok) {
      return reply.code(422).send(result);
    }

    return result;
  });
}

// ─── API Key Management Routes (JWT auth, ADMIN only) ────────

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /**
   * POST /api/api-keys — Generate a new API key.
   * Returns the raw key ONCE. Store it securely.
   */
  app.post('/', {
    preHandler: authorize('ADMIN'),
  }, async (request, reply) => {
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
      key: raw, // Only returned once
      prefix,
      name,
      permissions,
      warning: 'Store this key securely. It cannot be retrieved again.',
    });
  });

  /**
   * GET /api/api-keys — List all API keys (prefix only, no raw key).
   */
  app.get('/', async (request) => {
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

  /**
   * DELETE /api/api-keys/:id — Revoke an API key.
   */
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
