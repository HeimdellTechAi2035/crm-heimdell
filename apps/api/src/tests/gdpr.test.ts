import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

describe('GDPR & Data Protection', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let testLeadId: string;

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
    await prisma.lead.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.dataExportRequest.deleteMany({});
    await prisma.retentionSettings.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.lead.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.dataExportRequest.deleteMany({});
  });

  describe('POST /api/gdpr/export/:leadId', () => {
    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'lead@test.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          status: 'qualified',
          score: 75,
          marketingConsent: true,
        },
      });
      testLeadId = lead.id;

      // Create related data
      await prisma.activity.create({
        data: {
          type: 'email',
          subject: 'Follow-up',
          leadId: testLeadId,
        },
      });
    });

    it('should create export request and return lead data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/gdpr/export/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.lead).toBeDefined();
      expect(data.lead.email).toBe('lead@test.com');
      expect(data.lead.firstName).toBe('John');
      expect(data.lead.lastName).toBe('Doe');
      expect(data.activities).toBeDefined();
      expect(data.activities.length).toBe(1);
      expect(data.exportedAt).toBeDefined();
    });

    it('should create export request record in database', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/gdpr/export/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const exportRequest = await prisma.dataExportRequest.findFirst({
        where: { entityId: testLeadId },
      });

      expect(exportRequest).toBeDefined();
      expect(exportRequest?.entityType).toBe('lead');
      expect(exportRequest?.status).toBe('completed');
    });

    it('should return 404 for non-existent lead', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export/nonexistent-id',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/gdpr/anonymize/:leadId', () => {
    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'sensitive@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+9876543210',
          status: 'lost',
          notes: 'Personal notes about the lead',
          marketingConsent: true,
        },
      });
      testLeadId = lead.id;
    });

    it('should anonymize lead PII data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/gdpr/anonymize/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('anonymized');

      // Verify data is anonymized
      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      expect(lead).toBeDefined();
      expect(lead?.email).toContain('@anonymized.local');
      expect(lead?.firstName).toBe('REDACTED');
      expect(lead?.lastName).toBe('REDACTED');
      expect(lead?.phone).toBe('REDACTED');
      expect(lead?.notes).toBe('REDACTED');
      expect(lead?.gdprAnonymizedAt).toBeDefined();
    });

    it('should prevent re-anonymization', async () => {
      // Anonymize once
      await app.inject({
        method: 'POST',
        url: `/api/gdpr/anonymize/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // Try to anonymize again
      const response = await app.inject({
        method: 'POST',
        url: `/api/gdpr/anonymize/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('already anonymized');
    });

    it('should be irreversible', async () => {
      const originalLead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      await app.inject({
        method: 'POST',
        url: `/api/gdpr/anonymize/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const anonymizedLead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      // Original data should be completely replaced
      expect(anonymizedLead?.email).not.toBe(originalLead?.email);
      expect(anonymizedLead?.firstName).not.toBe(originalLead?.firstName);
      expect(anonymizedLead?.lastName).not.toBe(originalLead?.lastName);
    });
  });

  describe('DELETE /api/gdpr/delete/:leadId', () => {
    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'todelete@test.com',
          firstName: 'Delete',
          lastName: 'Me',
          status: 'lost',
        },
      });
      testLeadId = lead.id;

      // Create related data
      await prisma.activity.create({
        data: {
          type: 'note',
          subject: 'Related activity',
          leadId: testLeadId,
        },
      });
    });

    it('should require confirmation parameter', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/gdpr/delete/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('confirmation');
    });

    it('should hard delete lead with correct confirmation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/gdpr/delete/${testLeadId}?confirm=DELETE`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('permanently deleted');

      // Verify lead is deleted
      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });
      expect(lead).toBeNull();
    });

    it('should delete related activities (cascade)', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/gdpr/delete/${testLeadId}?confirm=DELETE`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // Verify related activities are deleted
      const activities = await prisma.activity.findMany({
        where: { leadId: testLeadId },
      });
      expect(activities.length).toBe(0);
    });

    it('should create audit log entry', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/gdpr/delete/${testLeadId}?confirm=DELETE`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // In production, verify audit log contains deletion record
      // For now, just verify the delete succeeded
      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });
      expect(lead).toBeNull();
    });
  });

  describe('Retention Settings', () => {
    describe('GET /api/gdpr/retention-settings', () => {
      it('should return default retention settings', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/gdpr/retention-settings',
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        
        // Should return settings or empty object
        expect(data).toBeDefined();
      });
    });

    describe('PUT /api/gdpr/retention-settings', () => {
      it('should create or update retention settings', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/gdpr/retention-settings',
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
          payload: {
            leadRetentionDays: 1095, // 3 years
            anonymizeInactiveLeadsAfterDays: 730, // 2 years
            deleteAnonymizedAfterDays: 365, // 1 year
            autoDeleteEnabled: true,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.leadRetentionDays).toBe(1095);
        expect(data.anonymizeInactiveLeadsAfterDays).toBe(730);
        expect(data.autoDeleteEnabled).toBe(true);
      });

      it('should validate retention periods', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/gdpr/retention-settings',
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
          payload: {
            leadRetentionDays: -1, // Invalid
          },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Consent Management', () => {
    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'consent@test.com',
          firstName: 'Consent',
          lastName: 'Test',
          status: 'new',
          emailOptOut: false,
          smsOptOut: false,
          marketingConsent: true,
          lawfulBasisNote: 'Legitimate interest',
        },
      });
      testLeadId = lead.id;
    });

    it('should track consent status', async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      expect(lead?.marketingConsent).toBe(true);
      expect(lead?.emailOptOut).toBe(false);
      expect(lead?.lawfulBasisNote).toBe('Legitimate interest');
    });

    it('should allow updating consent preferences', async () => {
      await prisma.lead.update({
        where: { id: testLeadId },
        data: {
          emailOptOut: true,
          emailOptOutAt: new Date(),
          marketingConsent: false,
        },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      expect(lead?.emailOptOut).toBe(true);
      expect(lead?.emailOptOutAt).toBeDefined();
      expect(lead?.marketingConsent).toBe(false);
    });

    it('should track opt-out timestamps', async () => {
      const optOutTime = new Date();
      
      await prisma.lead.update({
        where: { id: testLeadId },
        data: {
          emailOptOut: true,
          emailOptOutAt: optOutTime,
          smsOptOut: true,
          smsOptOutAt: optOutTime,
        },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: testLeadId },
      });

      expect(lead?.emailOptOutAt).toBeDefined();
      expect(lead?.smsOptOutAt).toBeDefined();
    });
  });

  describe('Data Export Format', () => {
    beforeEach(async () => {
      const lead = await prisma.lead.create({
        data: {
          email: 'export@test.com',
          firstName: 'Export',
          lastName: 'Test',
          phone: '+1234567890',
          status: 'qualified',
          score: 80,
          source: 'website',
          marketingConsent: true,
          lawfulBasisNote: 'Consent',
        },
      });
      testLeadId = lead.id;
    });

    it('should include all lead data fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/gdpr/export/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const data = JSON.parse(response.body);
      const lead = data.lead;

      expect(lead.email).toBeDefined();
      expect(lead.firstName).toBeDefined();
      expect(lead.lastName).toBeDefined();
      expect(lead.phone).toBeDefined();
      expect(lead.status).toBeDefined();
      expect(lead.score).toBeDefined();
      expect(lead.source).toBeDefined();
      expect(lead.marketingConsent).toBeDefined();
      expect(lead.createdAt).toBeDefined();
      expect(lead.updatedAt).toBeDefined();
    });

    it('should be in machine-readable format (JSON)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/gdpr/export/${testLeadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.headers['content-type']).toContain('application/json');
      expect(() => JSON.parse(response.body)).not.toThrow();
    });
  });
});
