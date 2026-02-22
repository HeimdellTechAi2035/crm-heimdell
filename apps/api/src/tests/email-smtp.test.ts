/**
 * Heimdell CRM — Email SMTP Service Tests
 *
 * Tests for:
 * 1. Blocked sender (not on allowlist)
 * 2. Inactive sender
 * 3. Daily limit exceeded
 * 4. Successful send path
 * 5. Failure path with log created
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────

// Mock prisma
const mockPrisma = {
  senderAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  emailSendLog: {
    create: vi.fn().mockResolvedValue({ id: 'log-1' }),
  },
  lead: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock crypto
vi.mock('../lib/crypto.js', () => ({
  encrypt: (text: string) => `encrypted:${text}`,
  decrypt: (cipher: string) => {
    if (cipher.startsWith('encrypted:')) return cipher.slice(10);
    if (cipher === 'bad-cipher') throw new Error('Decryption failed');
    return 'password123';
  },
}));

// Mock nodemailer
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

// Lazy import to ensure mocks are in place
const { sendEmail, SENDER_ALLOWLIST } = await import('../services/email-smtp.js');

// ─── Helpers ────────────────────────────────────────────────

function makeSender(overrides: any = {}) {
  return {
    id: 'sender-1',
    email: 'andrew@remoteability.org',
    displayName: 'Andrew',
    smtpHost: 'smtp.livemail.co.uk',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'andrew@remoteability.org',
    smtpPassEncrypted: 'encrypted:password123',
    isActive: true,
    dailyLimit: 100,
    sentToday: 0,
    lastResetAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('SMTP Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.emailSendLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.senderAccount.update.mockResolvedValue({});
    mockPrisma.lead.findUnique.mockResolvedValue(null);
  });

  // Test 1: Blocked sender (not on allowlist)
  describe('blocked sender', () => {
    it('rejects a sender email not on the allowlist', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(
        makeSender({ email: 'hacker@evil.com' })
      );

      const result = await sendEmail({
        senderEmail: 'hacker@evil.com',
        to: 'victim@example.com',
        subject: 'Test',
        text: 'Hello',
        actor: 'user:u1',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not on the allowlist');
      expect(mockPrisma.emailSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            senderEmail: 'hacker@evil.com',
          }),
        })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('has the correct allowlist entries', () => {
      expect(SENDER_ALLOWLIST.has('andrew@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('admin@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('sales@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('thomas@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('phillip@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('contact@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('andrewadmin@remoteability.org')).toBe(true);
      expect(SENDER_ALLOWLIST.has('random@other.com')).toBe(false);
    });
  });

  // Test 2: Inactive sender
  describe('inactive sender', () => {
    it('rejects an inactive sender account', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(
        makeSender({ isActive: false })
      );

      const result = await sendEmail({
        senderEmail: 'andrew@remoteability.org',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
        actor: 'user:u1',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('inactive');
      expect(mockPrisma.emailSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // Test 3: Daily limit exceeded
  describe('daily limit exceeded', () => {
    it('rejects when sentToday >= dailyLimit', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(
        makeSender({ sentToday: 100, dailyLimit: 100 })
      );

      const result = await sendEmail({
        senderEmail: 'andrew@remoteability.org',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
        actor: 'user:u1',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Daily limit reached');
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // Test 4: Successful send
  describe('successful send', () => {
    it('sends email, creates log, increments counter, returns messageId', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(makeSender());
      mockSendMail.mockResolvedValue({ messageId: '<msg-123@smtp.livemail.co.uk>' });

      const result = await sendEmail({
        senderEmail: 'andrew@remoteability.org',
        to: 'recipient@example.com',
        subject: 'Outreach 1',
        text: 'Hello from Heimdell',
        actor: 'agent:OpenClaw',
      });

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('<msg-123@smtp.livemail.co.uk>');

      // Log was created with SENT status
      expect(mockPrisma.emailSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SENT',
            providerMessageId: '<msg-123@smtp.livemail.co.uk>',
          }),
        })
      );

      // Counter incremented
      expect(mockPrisma.senderAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sender-1' },
          data: { sentToday: { increment: 1 } },
        })
      );
    });

    it('creates audit log when leadId is provided', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(makeSender());
      mockSendMail.mockResolvedValue({ messageId: '<msg-456@smtp>' });
      mockPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
      });

      const result = await sendEmail({
        senderEmail: 'andrew@remoteability.org',
        to: 'lead@company.com',
        subject: 'Follow up',
        text: 'Hi there',
        leadId: 'lead-1',
        actor: 'agent:OpenClaw',
      });

      expect(result.ok).toBe(true);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  // Test 5: Failure path with log
  describe('SMTP failure', () => {
    it('returns error and creates FAILED log when SMTP rejects', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(makeSender());
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await sendEmail({
        senderEmail: 'andrew@remoteability.org',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
        actor: 'user:u1',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Connection refused');

      // FAILED log created
      expect(mockPrisma.emailSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Connection refused',
          }),
        })
      );
    });

    it('returns error when sender not found', async () => {
      mockPrisma.senderAccount.findUnique.mockResolvedValue(null);

      const result = await sendEmail({
        senderEmail: 'nobody@remoteability.org',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
        actor: 'user:u1',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
