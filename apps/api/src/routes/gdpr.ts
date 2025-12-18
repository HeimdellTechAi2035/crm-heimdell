import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function gdprRoutes(app: FastifyInstance) {
  // Request data export for a lead
  app.post<{ Params: { leadId: string } }>('/api/gdpr/export/:leadId', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { leadId } = request.params;

    // Verify lead ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId: user.organizationId
      }
    });

    if (!lead) {
      return reply.code(404).send({ error: 'Lead not found' });
    }

    // Create export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        organizationId: user.organizationId,
        leadId,
        requestedByUserId: user.id,
        status: 'requested'
      }
    });

    // In production, trigger background job to generate export
    // For now, generate immediately
    const exportData = await generateLeadExport(leadId);

    // In production, upload to S3 and store URL
    const exportUrl = `/exports/${exportRequest.id}.json`;

    await prisma.dataExportRequest.update({
      where: { id: exportRequest.id },
      data: {
        status: 'completed',
        exportUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'gdpr_export',
        entityType: 'lead',
        entityId: leadId,
        userId: user.id,
        organizationId: user.organizationId
      }
    });

    return {
      exportRequest: {
        id: exportRequest.id,
        exportUrl,
        exportData // In production, don't return data directly
      }
    };
  });

  // Anonymize a lead (GDPR right to erasure)
  app.post<{ Params: { leadId: string } }>('/api/gdpr/anonymize/:leadId', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { leadId } = request.params;

    // Verify lead ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId: user.organizationId
      }
    });

    if (!lead) {
      return reply.code(404).send({ error: 'Lead not found' });
    }

    // Anonymize lead data (irreversible)
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: 'Anonymized',
        lastName: 'User',
        email: `anonymized-${leadId}@example.com`,
        phone: null,
        title: null,
        notes: '[Data anonymized per GDPR request]',
        profileSummary: null,
        profileJson: null,
        lawfulBasisNote: 'Data anonymized'
      }
    });

    // Anonymize activities
    await prisma.activity.updateMany({
      where: { leadId },
      data: {
        subject: '[Anonymized]',
        body: '[Content anonymized per GDPR request]'
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'gdpr_anonymize',
        entityType: 'lead',
        entityId: leadId,
        userId: user.id,
        organizationId: user.organizationId,
        changes: { reason: 'GDPR right to erasure' }
      }
    });

    return {
      success: true,
      message: 'Lead data has been anonymized'
    };
  });

  // Hard delete a lead (ADMIN only, with confirmation)
  app.delete<{
    Params: { leadId: string };
    Querystring: { confirm: string }
  }>('/api/gdpr/delete/:leadId', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { leadId } = request.params;
    const { confirm } = request.query;

    if (confirm !== 'DELETE') {
      return reply.code(400).send({
        error: 'Confirmation required. Add ?confirm=DELETE to URL'
      });
    }

    // Verify lead ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId: user.organizationId
      }
    });

    if (!lead) {
      return reply.code(404).send({ error: 'Lead not found' });
    }

    // Audit log BEFORE deletion
    await prisma.auditLog.create({
      data: {
        action: 'gdpr_hard_delete',
        entityType: 'lead',
        entityId: leadId,
        userId: user.id,
        organizationId: user.organizationId,
        changes: {
          email: lead.email,
          name: `${lead.firstName} ${lead.lastName}`,
          reason: 'GDPR hard delete'
        }
      }
    });

    // Hard delete (cascades to activities, tasks, etc.)
    await prisma.lead.delete({
      where: { id: leadId }
    });

    return {
      success: true,
      message: 'Lead permanently deleted'
    };
  });

  // Get retention settings
  app.get('/api/gdpr/retention-settings', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;

    const settings = await prisma.retentionSettings.findUnique({
      where: { organizationId: user.organizationId }
    });

    return {
      settings: settings || {
        autoDeleteImportsAfterDays: null,
        anonymizeInactiveLeadsAfterMonths: null,
        isEnabled: false
      }
    };
  });

  // Update retention settings
  app.put('/api/gdpr/retention-settings', {
    preHandler: [authenticate, authorize(['ADMIN'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = request.body as any;

    const settings = await prisma.retentionSettings.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        autoDeleteImportsAfterDays: data.autoDeleteImportsAfterDays,
        anonymizeInactiveLeadsAfterMonths: data.anonymizeInactiveLeadsAfterMonths,
        isEnabled: data.isEnabled || false
      },
      update: data
    });

    return { settings };
  });
}

// Helper function to generate complete lead export
async function generateLeadExport(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: true,
      tasks: true,
      deals: true,
      tags: {
        include: {
          tag: true
        }
      },
      customFieldValues: {
        include: {
          customField: true
        }
      }
    }
  });

  return {
    lead,
    exportedAt: new Date().toISOString(),
    format: 'JSON'
  };
}
