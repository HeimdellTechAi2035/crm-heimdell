/**
 * Heimdell CRM — Email Routes
 *
 * Sender account CRUD + test send + send logs.
 * Mounted at /api/integrations/email.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { encrypt } from '../lib/crypto.js';
import { sendEmail, SENDER_ALLOWLIST, invalidateTransport } from '../services/email-smtp.js';
import { actorFromUser } from '../middleware/audit.js';

// ─── Schemas ────────────────────────────────────────────────

const createSenderSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean().default(true),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),      // plaintext — encrypted before storage
  dailyLimit: z.number().int().min(1).max(10000).default(100),
});

const updateSenderSchema = z.object({
  displayName: z.string().optional(),
  isActive: z.boolean().optional(),
  dailyLimit: z.number().int().min(1).max(10000).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().min(1).optional(),  // if updating password
});

const testSendSchema = z.object({
  senderEmail: z.string().email(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(5000),
});

// ─── Routes ─────────────────────────────────────────────────

export async function emailRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /**
   * GET /api/integrations/email/senders
   *
   * List all sender accounts. Never returns encrypted credentials.
   */
  app.get('/senders', async () => {
    const senders = await prisma.senderAccount.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        isActive: true,
        dailyLimit: true,
        sentToday: true,
        lastResetAt: true,
        createdAt: true,
        updatedAt: true,
        // Never: smtpPassEncrypted
      },
    });

    return { senders };
  });

  /**
   * POST /api/integrations/email/senders
   *
   * Create a sender account. ADMIN only. Email must be on the allowlist.
   */
  app.post('/senders', {
    preHandler: authorize('ADMIN'),
  }, async (request, reply) => {
    const body = createSenderSchema.parse(request.body);

    // Allowlist check
    if (!SENDER_ALLOWLIST.has(body.email)) {
      return reply.code(403).send({
        error: `Email ${body.email} is not on the sender allowlist`,
        allowlist: Array.from(SENDER_ALLOWLIST),
      });
    }

    // Check duplicate
    const existing = await prisma.senderAccount.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: `Sender ${body.email} already exists` });
    }

    const sender = await prisma.senderAccount.create({
      data: {
        email: body.email,
        displayName: body.displayName,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpSecure: body.smtpSecure,
        smtpUser: body.smtpUser,
        smtpPassEncrypted: encrypt(body.smtpPass),
        dailyLimit: body.dailyLimit,
      },
    });

    return reply.code(201).send({
      id: sender.id,
      email: sender.email,
      displayName: sender.displayName,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      isActive: sender.isActive,
      dailyLimit: sender.dailyLimit,
    });
  });

  /**
   * PATCH /api/integrations/email/senders/:id
   *
   * Update sender account. ADMIN only.
   * Supports: activate/deactivate, limit change, credential rotation.
   */
  app.patch<{ Params: { id: string } }>('/senders/:id', {
    preHandler: authorize('ADMIN'),
  }, async (request, reply) => {
    const { id } = request.params;
    const body = updateSenderSchema.parse(request.body);

    const existing = await prisma.senderAccount.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Sender not found' });

    const data: any = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.dailyLimit !== undefined) data.dailyLimit = body.dailyLimit;
    if (body.smtpHost !== undefined) data.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) data.smtpPort = body.smtpPort;
    if (body.smtpSecure !== undefined) data.smtpSecure = body.smtpSecure;
    if (body.smtpUser !== undefined) data.smtpUser = body.smtpUser;
    if (body.smtpPass !== undefined) {
      data.smtpPassEncrypted = encrypt(body.smtpPass);
      invalidateTransport(existing.email);
    }

    const sender = await prisma.senderAccount.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        isActive: true,
        dailyLimit: true,
        sentToday: true,
        updatedAt: true,
      },
    });

    return { sender };
  });

  /**
   * POST /api/integrations/email/test-send
   *
   * Send a test email. ADMIN or OPERATOR. Uses the specified sender account.
   */
  app.post('/test-send', {
    preHandler: authorize('ADMIN', 'OPERATOR'),
  }, async (request, reply) => {
    const user = request.user!;
    const body = testSendSchema.parse(request.body);

    const result = await sendEmail({
      senderEmail: body.senderEmail,
      to: body.to,
      subject: body.subject,
      text: body.text,
      actor: actorFromUser(user),
    });

    if (!result.ok) {
      return reply.code(422).send(result);
    }

    return result;
  });

  /**
   * GET /api/integrations/email/logs
   *
   * View email send logs. Optional filter by senderEmail or leadId.
   */
  app.get('/logs', async (request) => {
    const query = request.query as any;

    const where: any = {};
    if (query.senderEmail) where.senderEmail = query.senderEmail;
    if (query.leadId) where.leadId = query.leadId;

    const logs = await prisma.emailSendLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { logs };
  });

  /**
   * GET /api/integrations/email/allowlist
   *
   * Return the hard-coded sender allowlist (so UI can show it).
   */
  app.get('/allowlist', async () => {
    return { allowlist: Array.from(SENDER_ALLOWLIST) };
  });
}
