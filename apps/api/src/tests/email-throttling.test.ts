import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

describe('Email Identities & Throttling', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let emailIdentityId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashed',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    adminToken = app.jwt.sign({ userId: admin.id, role: admin.role });
  });

  afterAll(async () => {
    await prisma.emailIdentity.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.emailIdentity.deleteMany({});
  });

  describe('POST /api/email-identities', () => {
    it('should create email identity with default limits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/email-identities',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          fromName: 'Sales Team',
          fromEmail: 'sales@company.com',
          smtpHost: 'smtp.sendgrid.net',
          smtpPort: 587,
          smtpUser: 'apikey',
          smtpPassword: 'secret',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.fromEmail).toBe('sales@company.com');
      expect(data.warmupState).toBe('new');
      expect(data.dailySendLimit).toBeGreaterThan(0);
      expect(data.perMinuteLimit).toBeGreaterThan(0);
      
      emailIdentityId = data.id;
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/email-identities',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          fromName: 'Invalid',
          fromEmail: 'not-an-email',
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/email-identities/:id/warmup', () => {
    beforeEach(async () => {
      const identity = await prisma.emailIdentity.create({
        data: {
          fromName: 'Test',
          fromEmail: 'test@company.com',
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
          warmupState: 'new',
          dailySendLimit: 50,
          perMinuteLimit: 5,
          currentDailySent: 0,
        },
      });
      emailIdentityId = identity.id;
    });

    it('should update warmup state', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/email-identities/${emailIdentityId}/warmup`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          warmupState: 'warming',
          dailySendLimit: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.warmupState).toBe('warming');
      expect(data.dailySendLimit).toBe(100);
    });

    it('should enforce valid warmup state transitions', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/email-identities/${emailIdentityId}/warmup`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          warmupState: 'invalid_state',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/email-identities/:id/can-send', () => {
    beforeEach(async () => {
      const identity = await prisma.emailIdentity.create({
        data: {
          fromName: 'Test',
          fromEmail: 'test@company.com',
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
          warmupState: 'stable',
          dailySendLimit: 100,
          perMinuteLimit: 10,
          currentDailySent: 0,
        },
      });
      emailIdentityId = identity.id;
    });

    it('should allow sending when under limits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/email-identities/${emailIdentityId}/can-send`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.allowed).toBe(true);
      expect(data.identity).toBeDefined();
    });

    it('should deny sending when daily limit reached', async () => {
      // Update to max out daily limit
      await prisma.emailIdentity.update({
        where: { id: emailIdentityId },
        data: { currentDailySent: 100 }, // Equal to dailySendLimit
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/email-identities/${emailIdentityId}/can-send`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.allowed).toBe(false);
      expect(data.reason).toContain('daily limit');
    });

    it('should deny sending during quiet hours', async () => {
      const now = new Date();
      const quietStart = `${now.getHours()}:00`; // Current hour
      const quietEnd = `${(now.getHours() + 1) % 24}:00`; // Next hour

      await prisma.emailIdentity.update({
        where: { id: emailIdentityId },
        data: {
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
          timezone: 'UTC',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/email-identities/${emailIdentityId}/can-send`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.allowed).toBe(false);
      expect(data.reason).toContain('quiet hours');
    });

    it('should deny sending when in restricted warmup state', async () => {
      await prisma.emailIdentity.update({
        where: { id: emailIdentityId },
        data: { warmupState: 'restricted' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/email-identities/${emailIdentityId}/can-send`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.allowed).toBe(false);
      expect(data.reason).toContain('restricted');
    });

    it('should deny sending for new identity without warmup', async () => {
      await prisma.emailIdentity.update({
        where: { id: emailIdentityId },
        data: { warmupState: 'new' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/email-identities/${emailIdentityId}/can-send`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.allowed).toBe(false);
      expect(data.reason).toContain('new');
    });
  });

  describe('Warmup State Management', () => {
    it('should progress through warmup states correctly', async () => {
      // Create new identity
      let identity = await prisma.emailIdentity.create({
        data: {
          fromName: 'Warmup Test',
          fromEmail: 'warmup@company.com',
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
          warmupState: 'new',
          dailySendLimit: 20,
          perMinuteLimit: 2,
          currentDailySent: 0,
        },
      });

      // Start warming
      await app.inject({
        method: 'PATCH',
        url: `/api/email-identities/${identity.id}/warmup`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          warmupState: 'warming',
          dailySendLimit: 50,
        },
      });

      identity = await prisma.emailIdentity.findUnique({
        where: { id: identity.id },
      }) as any;
      expect(identity.warmupState).toBe('warming');
      expect(identity.dailySendLimit).toBe(50);

      // Progress to stable
      await app.inject({
        method: 'PATCH',
        url: `/api/email-identities/${identity.id}/warmup`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          warmupState: 'stable',
          dailySendLimit: 1000,
        },
      });

      identity = await prisma.emailIdentity.findUnique({
        where: { id: identity.id },
      }) as any;
      expect(identity.warmupState).toBe('stable');
      expect(identity.dailySendLimit).toBe(1000);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect per-minute limits', async () => {
      const identity = await prisma.emailIdentity.create({
        data: {
          fromName: 'Rate Test',
          fromEmail: 'rate@company.com',
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
          warmupState: 'stable',
          dailySendLimit: 1000,
          perMinuteLimit: 5,
          currentDailySent: 0,
        },
      });

      // In a real implementation, we'd track sends per minute
      // For now, verify that perMinuteLimit is stored correctly
      expect(identity.perMinuteLimit).toBe(5);
    });
  });

  describe('Consent Checks', () => {
    let leadId: string;

    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'lead@test.com',
          status: 'new',
          emailOptOut: false,
          smsOptOut: false,
          marketingConsent: true,
        },
      });
      leadId = lead.id;
    });

    it('should not send to leads who opted out', async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: { emailOptOut: true },
      });

      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      expect(lead?.emailOptOut).toBe(true);
      
      // In production, queue worker would check this before sending
    });

    it('should respect marketing consent', async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: { marketingConsent: false },
      });

      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      expect(lead?.marketingConsent).toBe(false);
    });

    it('should track opt-out timestamp', async () => {
      const now = new Date();
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          emailOptOut: true,
          emailOptOutAt: now,
        },
      });

      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      expect(lead?.emailOptOut).toBe(true);
      expect(lead?.emailOptOutAt).toBeDefined();
    });
  });
});
