/**
 * Import Job Worker
 * Processes CSV imports in the background
 */

import { config } from '../config.js';
import { createQueue, IJobQueue } from '../lib/queue.js';
import { prisma } from '../lib/prisma.js';
import {
  generateLeadKey,
  generateCompanyKey,
  isValidEmail,
  normalizePhone,
  extractDomain,
} from '../utils/csv.js';

interface ImportJobData {
  importJobId: string;
  organizationId: string;
  userId: string;
}

// Create queue (Redis or in-memory based on config)
export const importQueue: IJobQueue = createQueue(
  'imports',
  config.features.redis,
  config.redis.url
);

/**
 * Process import job
 */
async function processImport(job: any) {
  const { importJobId, organizationId, userId } = job.data;

  console.log(`[Import Worker] Processing import job ${importJobId}`);

  try {
    // Get import job
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      throw new Error('Import job not found');
    }

    const mapping = importJob.mappingJson as any;

    // Get all pending rows
    const rows = await prisma.importRow.findMany({
      where: {
        importJobId,
        status: 'pending',
      },
      orderBy: {
        rowNumber: 'asc',
      },
    });

    console.log(`[Import Worker] Processing ${rows.length} rows`);

    let imported = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const data = row.rawJson as Record<string, string>;

        // Process based on mapping
        let leadId: string | undefined;
        let companyId: string | undefined;

        // Create or update company first (if mapped)
        if (mapping.companyMapping) {
          const result = await processCompanyRow(data, mapping.companyMapping, organizationId, userId, mapping.duplicateHandling);
          companyId = result.id;
          if (result.skipped) {
            skipped++;
            await prisma.importRow.update({
              where: { id: row.id },
              data: { status: 'skipped', error: 'Duplicate company' },
            });
            continue;
          }
        }

        // Create or update lead (if mapped)
        if (mapping.leadMapping) {
          const result = await processLeadRow(data, mapping.leadMapping, organizationId, userId, companyId, mapping.duplicateHandling);
          leadId = result.id;
          if (result.skipped) {
            skipped++;
            await prisma.importRow.update({
              where: { id: row.id },
              data: { status: 'skipped', error: 'Duplicate lead' },
            });
            continue;
          }
        }

        // Mark row as imported
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: 'imported',
            createdLeadId: leadId,
            createdCompanyId: companyId,
          },
        });

        imported++;

        // Update progress every 10 rows
        if (imported % 10 === 0) {
          await prisma.importJob.update({
            where: { id: importJobId },
            data: {
              importedCount: imported,
              failedCount: failed,
              skippedCount: skipped,
            },
          });
        }
      } catch (error: any) {
        console.error(`[Import Worker] Error processing row ${row.rowNumber}:`, error);
        failed++;

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            error: error.message || 'Unknown error',
          },
        });
      }
    }

    // Mark job as completed
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'completed',
        importedCount: imported,
        failedCount: failed,
        skippedCount: skipped,
        completedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'completed',
        entityType: 'import_job',
        entityId: importJobId,
        changes: {
          imported,
          failed,
          skipped,
        },
        userId,
        organizationId,
      },
    });

    // If profile generation is enabled, enqueue profile generation jobs
    if (mapping.generateProfiles) {
      const importedRows = await prisma.importRow.findMany({
        where: {
          importJobId,
          status: 'imported',
        },
        select: {
          createdLeadId: true,
          createdCompanyId: true,
        },
      });

      for (const row of importedRows) {
        if (row.createdLeadId) {
          await profileQueue.add('generate-profile', {
            leadId: row.createdLeadId,
            organizationId,
          });
        }
        if (row.createdCompanyId) {
          await profileQueue.add('generate-profile', {
            companyId: row.createdCompanyId,
            organizationId,
          });
        }
      }
    }

    console.log(`[Import Worker] Completed import job ${importJobId}: ${imported} imported, ${failed} failed, ${skipped} skipped`);
  } catch (error: any) {
    console.error(`[Import Worker] Fatal error processing import job ${importJobId}:`, error);

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'failed',
        errorLog: error.message || 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Process company row
 */
async function processCompanyRow(
  data: Record<string, string>,
  mapping: any,
  organizationId: string,
  userId: string,
  duplicateHandling: 'skip' | 'update'
): Promise<{ id: string; skipped: boolean }> {
  const companyData: any = {
    name: data[mapping.name] || 'Unknown Company',
    website: data[mapping.website],
    domain: data[mapping.domain] || (data[mapping.website] ? extractDomain(data[mapping.website]) : null),
    industry: data[mapping.industry],
    location: data[mapping.location],
    size: data[mapping.size],
    phone: data[mapping.phone],
    ownerId: userId,
    organizationId,
  };

  // Check for duplicates
  const keys = generateCompanyKey(companyData);

  if (keys.length > 0) {
    // Check domain first
    if (companyData.domain) {
      const existing = await prisma.company.findFirst({
        where: {
          organizationId,
          domain: companyData.domain,
        },
      });

      if (existing) {
        if (duplicateHandling === 'skip') {
          return { id: existing.id, skipped: true };
        } else {
          // Update existing
          const updated = await prisma.company.update({
            where: { id: existing.id },
            data: {
              ...companyData,
              updatedAt: new Date(),
            },
          });
          return { id: updated.id, skipped: false };
        }
      }
    }

    // Check name + location
    if (companyData.name && companyData.location) {
      const existing = await prisma.company.findFirst({
        where: {
          organizationId,
          name: {
            contains: companyData.name,
            mode: 'insensitive',
          },
          location: companyData.location,
        },
      });

      if (existing) {
        if (duplicateHandling === 'skip') {
          return { id: existing.id, skipped: true };
        } else {
          const updated = await prisma.company.update({
            where: { id: existing.id },
            data: {
              ...companyData,
              updatedAt: new Date(),
            },
          });
          return { id: updated.id, skipped: false };
        }
      }
    }
  }

  // Create new company
  const company = await prisma.company.create({
    data: companyData,
  });

  return { id: company.id, skipped: false };
}

/**
 * Process lead row
 */
async function processLeadRow(
  data: Record<string, string>,
  mapping: any,
  organizationId: string,
  userId: string,
  companyId: string | undefined,
  duplicateHandling: 'skip' | 'update'
): Promise<{ id: string; skipped: boolean }> {
  const leadData: any = {
    email: data[mapping.email] || '',
    firstName: data[mapping.firstName],
    lastName: data[mapping.lastName],
    phone: data[mapping.phone],
    title: data[mapping.title],
    notes: data[mapping.notes],
    status: data[mapping.status] || 'new',
    source: data[mapping.source] || 'csv_import',
    companyId,
    ownerId: userId,
    organizationId,
  };

  // Validate email if provided
  if (leadData.email && !isValidEmail(leadData.email)) {
    throw new Error(`Invalid email: ${leadData.email}`);
  }

  // Normalize phone if provided
  if (leadData.phone) {
    const { normalized } = normalizePhone(leadData.phone);
    if (normalized) {
      leadData.phone = normalized;
    }
  }

  // Check for duplicates
  const keys = generateLeadKey(leadData);

  if (keys.length > 0 && leadData.email) {
    // Check email first
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId,
        email: leadData.email,
      },
    });

    if (existing) {
      if (duplicateHandling === 'skip') {
        return { id: existing.id, skipped: true };
      } else {
        // Update existing
        const updated = await prisma.lead.update({
          where: { id: existing.id },
          data: {
            ...leadData,
            updatedAt: new Date(),
          },
        });
        return { id: updated.id, skipped: false };
      }
    }
  }

  // Create new lead
  const lead = await prisma.lead.create({
    data: leadData,
  });

  return { id: lead.id, skipped: false };
}

// Register processor
importQueue.registerProcessor('process-import', processImport);

// Profile generation queue
export const profileQueue: IJobQueue = createQueue(
  'profiles',
  config.features.redis,
  config.redis.url
);

