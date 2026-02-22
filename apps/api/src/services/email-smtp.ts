/**
 * Heimdell CRM — Direct SMTP Email Service
 *
 * Sends email via per-sender SMTP accounts stored in the database.
 * - Validates sender is active and on the allowlist
 * - Enforces daily send limit (auto-resets at midnight UTC)
 * - Writes EmailSendLog for every attempt
 * - Creates audit trail entries
 * - Returns structured success/error
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { writeAuditLog } from '../middleware/audit.js';

// ─── Sender Email Allowlist ─────────────────────────────────

export const SENDER_ALLOWLIST = new Set([
  'admin@remoteability.org',
  'andrew@remoteability.org',
  'andrewadmin@remoteability.org',
  'contact@remoteability.org',
  'phillip@remoteability.org',
  'sales@remoteability.org',
  'thomas@remoteability.org',
]);

// ─── Types ──────────────────────────────────────────────────

export interface SendEmailRequest {
  senderAccountId?: string;  // look up by ID
  senderEmail?: string;      // or by email
  to: string;
  subject: string;
  text: string;
  html?: string;
  leadId?: string;
  actor: string;             // "user:<id>" | "agent:<keyName>" | "system"
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  logId?: string;
}

// ─── Transport Cache ────────────────────────────────────────

const transportCache = new Map<string, Transporter>();

function getTransport(host: string, port: number, secure: boolean, user: string, pass: string): Transporter {
  const cacheKey = `${host}:${port}:${user}`;
  const cached = transportCache.get(cacheKey);
  if (cached) return cached;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: {
      rejectUnauthorized: true,
    },
  });

  transportCache.set(cacheKey, transport);
  return transport;
}

/**
 * Invalidate a cached transport (e.g. when credentials change).
 */
export function invalidateTransport(email: string) {
  for (const [key] of transportCache) {
    if (key.endsWith(`:${email}`)) {
      transportCache.delete(key);
    }
  }
}

// ─── Core send function ─────────────────────────────────────

export async function sendEmail(req: SendEmailRequest): Promise<SendEmailResult> {
  // 1. Resolve sender account
  const sender = req.senderAccountId
    ? await prisma.senderAccount.findUnique({ where: { id: req.senderAccountId } })
    : req.senderEmail
      ? await prisma.senderAccount.findUnique({ where: { email: req.senderEmail } })
      : null;

  if (!sender) {
    return { ok: false, error: 'Sender account not found' };
  }

  // 2. Allowlist check
  if (!SENDER_ALLOWLIST.has(sender.email)) {
    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'FAILED',
        error: `Sender ${sender.email} is not on the allowlist`,
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });
    return { ok: false, error: `Sender ${sender.email} is not on the allowlist`, logId: logEntry.id };
  }

  // 3. Active check
  if (!sender.isActive) {
    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'FAILED',
        error: `Sender ${sender.email} is inactive`,
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });
    return { ok: false, error: `Sender ${sender.email} is inactive`, logId: logEntry.id };
  }

  // 4. Daily limit check (with auto-reset at midnight UTC)
  const now = new Date();
  const lastReset = sender.lastResetAt;
  const isNewDay = lastReset.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);

  let currentSentToday = sender.sentToday;
  if (isNewDay) {
    await prisma.senderAccount.update({
      where: { id: sender.id },
      data: { sentToday: 0, lastResetAt: now },
    });
    currentSentToday = 0;
  }

  if (currentSentToday >= sender.dailyLimit) {
    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'FAILED',
        error: `Daily limit reached (${sender.dailyLimit})`,
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });
    return { ok: false, error: `Daily limit reached (${sender.dailyLimit})`, logId: logEntry.id };
  }

  // 5. Decrypt SMTP password and send
  let smtpPass: string;
  try {
    smtpPass = decrypt(sender.smtpPassEncrypted);
  } catch (err) {
    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'FAILED',
        error: 'Failed to decrypt SMTP credentials',
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });
    return { ok: false, error: 'Failed to decrypt SMTP credentials', logId: logEntry.id };
  }

  const transport = getTransport(
    sender.smtpHost,
    sender.smtpPort,
    sender.smtpSecure,
    sender.smtpUser,
    smtpPass,
  );

  const fromAddress = sender.displayName
    ? `"${sender.displayName}" <${sender.email}>`
    : sender.email;

  try {
    const info = await transport.sendMail({
      from: fromAddress,
      to: req.to,
      subject: req.subject,
      text: req.text,
      html: req.html || undefined,
    });

    // 6. Log success
    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'SENT',
        providerMessageId: info.messageId,
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });

    // 7. Increment daily counter
    await prisma.senderAccount.update({
      where: { id: sender.id },
      data: { sentToday: { increment: 1 } },
    });

    // 8. Audit log (if lead is associated)
    if (req.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: req.leadId } });
      if (lead) {
        await writeAuditLog({
          leadId: req.leadId,
          organizationId: lead.organizationId,
          actor: req.actor,
          action: 'EMAIL_SENT',
          before: null,
          after: {
            senderEmail: sender.email,
            toEmail: req.to,
            subject: req.subject,
            messageId: info.messageId,
          },
          source: req.actor.startsWith('agent:') ? 'agent' : 'api',
        });
      }
    }

    return { ok: true, messageId: info.messageId, logId: logEntry.id };

  } catch (err: any) {
    // Invalidate transport on auth failure
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      invalidateTransport(sender.email);
    }

    const errorMsg = err.message || 'Unknown SMTP error';

    const logEntry = await prisma.emailSendLog.create({
      data: {
        senderEmail: sender.email,
        toEmail: req.to,
        subject: req.subject,
        bodyPreview: req.text.substring(0, 300),
        status: 'FAILED',
        error: errorMsg,
        actor: req.actor,
        leadId: req.leadId ?? null,
      },
    });

    // Audit log failure (if lead is associated)
    if (req.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: req.leadId } });
      if (lead) {
        await writeAuditLog({
          leadId: req.leadId,
          organizationId: lead.organizationId,
          actor: req.actor,
          action: 'EMAIL_SEND_FAILED',
          before: null,
          after: {
            senderEmail: sender.email,
            toEmail: req.to,
            subject: req.subject,
            error: errorMsg,
          },
          source: req.actor.startsWith('agent:') ? 'agent' : 'api',
        });
      }
    }

    return { ok: false, error: errorMsg, logId: logEntry.id };
  }
}
