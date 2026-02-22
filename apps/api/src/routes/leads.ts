import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog, diffLead, actorFromUser } from '../middleware/audit.js';
import { ACTION_FLAG_MAP } from '../lib/transitions.js';
import { LeadStatus, Prisma } from '@prisma/client';

// --- Zod Schemas ---

const leadFilterSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  ownerId: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  hasDm: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const leadUpdateSchema = z.object({
  company: z.string().min(1).optional(),
  keyDecisionMaker: z.string().min(1).optional(),
  role: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  facebookClean: z.string().nullable().optional(),
  instaClean: z.string().nullable().optional(),
  linkedinClean: z.string().nullable().optional(),
  emails: z.array(z.string().email()).optional(),
  number: z.string().nullable().optional(),
  mobileValid: z.boolean().optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const leadCreateSchema = z.object({
  company: z.string().min(1),
  keyDecisionMaker: z.string().min(1),
  role: z.string().optional(),
  website: z.string().url().optional(),
  facebookClean: z.string().optional(),
  instaClean: z.string().optional(),
  linkedinClean: z.string().optional(),
  emails: z.array(z.string().email()).default([]),
  number: z.string().optional(),
  mobileValid: z.boolean().default(false),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
});

const actionSchema = z.object({
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

// --- Routes ---

export async function leadRoutes(app: FastifyInstance) {
  // All lead routes require authentication
  app.addHook('preHandler', authenticate);

  /**
   * GET /api/leads  List leads with filtering, search, pagination.
   */
  app.get('/', async (request, reply) => {
    const user = request.user!;
    const query = leadFilterSchema.parse(request.query);

    const where: Prisma.LeadWhereInput = {
      organizationId: user.organizationId,
    };

    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.dueBefore) where.nextActionDueUtc = { lte: new Date(query.dueBefore) };
    if (query.hasDm === 'true') {
      where.OR = [
        { dmLiSent1: true },
        { dmFbSent1: true },
        { dmIgSent1: true },
        { dmSent2: true },
      ];
    }
    if (query.search) {
      where.OR = [
        ...(where.OR || []),
        { company: { contains: query.search, mode: 'insensitive' } },
        { keyDecisionMaker: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [
          { nextActionDueUtc: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  /**
   * GET /api/leads/:id  Get single lead with audit trail.
   */
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        auditLogs: {
          orderBy: { timestampUtc: 'desc' },
          take: 50,
        },
      },
    });

    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    return lead;
  });

  /**
   * POST /api/leads  Create a new lead (status: NEW).
   */
  app.post('/', async (request, reply) => {
    const user = request.user!;
    const body = leadCreateSchema.parse(request.body);

    const lead = await prisma.lead.create({
      data: {
        ...body,
        organizationId: user.organizationId,
        status: 'NEW',
        nextAction: 'first_touch',
      },
    });

    await writeAuditLog({
      leadId: lead.id,
      organizationId: lead.organizationId,
      actor: actorFromUser(user),
      action: 'lead_created',
      before: null,
      after: { company: lead.company, keyDecisionMaker: lead.keyDecisionMaker },
      source: 'api',
    });

    return reply.code(201).send(lead);
  });

  /**
   * PATCH /api/leads/:id  Update lead fields (NOT status  use pipeline/advance).
   */
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;
    const updates = leadUpdateSchema.parse(request.body);

    // Fetch current lead for diff
    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId },
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
        organizationId: lead.organizationId,
        actor: actorFromUser(user),
        action: 'field_update',
        before,
        after,
        source: 'api',
      });
    }

    return lead;
  });

  /**
   * POST /api/leads/:id/actions  Log an outreach action (sets flag on lead).
   *
   * Body: { action: "send_email_1" | "call_done" | ..., notes?: string }
   *
   * This sets the boolean flag but does NOT advance the pipeline status.
   * Call POST /api/pipeline/advance/:id separately to move the lead forward.
   */
  app.post<{ Params: { id: string } }>('/:id/actions', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;
    const { action, notes } = actionSchema.parse(request.body);

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) return reply.code(404).send({ error: 'Lead not found' });

    // Build the update
    const flagField = ACTION_FLAG_MAP[action];
    if (!flagField) return reply.code(400).send({ error: `Unknown action: ${action}` });

    const updateData: Prisma.LeadUpdateInput = {
      lastActionUtc: new Date(),
    };

    if (action === 'mark_replied') {
      // Special: set DateTime instead of boolean
      if (existing.repliedAtUtc) {
        return reply.code(409).send({ error: 'Lead already marked as replied' });
      }
      updateData.repliedAtUtc = new Date();
    } else {
      // Standard boolean flag
      if ((existing as any)[flagField] === true) {
        return reply.code(409).send({ error: `Action ${action} already recorded` });
      }
      (updateData as any)[flagField] = true;
    }

    if (notes) {
      updateData.notes = existing.notes
        ? `${existing.notes}\n[${new Date().toISOString()}] ${action}: ${notes}`
        : `[${new Date().toISOString()}] ${action}: ${notes}`;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    await writeAuditLog({
      leadId: lead.id,
      organizationId: lead.organizationId,
      actor: actorFromUser(user),
      action: 'action_logged',
      before: { [String(flagField)]: (existing as any)[flagField] },
      after: { [String(flagField)]: action === 'mark_replied' ? lead.repliedAtUtc : true, action },
      source: 'api',
    });

    return { lead, actionRecorded: action };
  });

  /**
   * GET /api/leads/stats  Pipeline status counts for dashboard.
   */
  app.get('/stats', async (request) => {
    const user = request.user!;

    const counts = await prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId: user.organizationId },
      _count: true,
    });

    const total = await prisma.lead.count({
      where: { organizationId: user.organizationId },
    });

    const dueNow = await prisma.lead.count({
      where: {
        organizationId: user.organizationId,
        nextActionDueUtc: { lte: new Date() },
        status: { notIn: ['COMPLETED', 'REPLIED', 'QUALIFIED', 'NOT_INTERESTED'] },
      },
    });

    return {
      total,
      dueNow,
      byStatus: Object.fromEntries(
        counts.map((c) => [c.status, c._count]),
      ),
    };
  });
}