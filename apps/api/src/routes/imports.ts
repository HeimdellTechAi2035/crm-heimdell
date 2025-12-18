/**
 * CSV Import Routes
 * Handles CSV file upload, column mapping, and import job management
 * Supports DEV_TEST_MODE with in-memory mock database
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { mockDb } from '../lib/mock-db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  parseCSV,
  detectDelimiter,
  validateCsvFile,
  isValidEmail,
  normalizePhone,
  extractDomain,
} from '../utils/csv.js';
import { importQueue } from '../jobs/import.js';

// Check if we should use mock DB
const useMockDb = config.devTestMode && !config.features.database;

// ==================== Schemas ====================

const uploadCsvSchema = z.object({});

const mappingConfigSchema = z.object({
  duplicateHandling: z.enum(['skip', 'update']).default('skip'),
  leadMapping: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    title: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    source: z.string().optional(),
  }).optional(),
  companyMapping: z.object({
    name: z.string().optional(),
    website: z.string().optional(),
    domain: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  dealMapping: z.object({
    name: z.string().optional(),
    value: z.string().optional(),
    stage: z.string().optional(),
    pipelineId: z.string().optional(),
  }).optional(),
  generateProfiles: z.boolean().default(true),
});

const importParamsSchema = z.object({
  id: z.string(),
});

// ==================== Helper Functions ====================

function getMappedValue(row: Record<string, any>, columnName: string | undefined): string | undefined {
  if (!columnName) return undefined;
  const value = row[columnName];
  return value !== undefined && value !== null && value !== '' ? String(value).trim() : undefined;
}

async function processImportInMemory(
  importJobId: string,
  mapping: z.infer<typeof mappingConfigSchema>,
  user: any
) {
  const job = mockDb.getImportJob(importJobId);
  if (!job) return;

  const rows = mockDb.getImportRowsByJobId(importJobId);
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const rawData = row.rawJson;
      let companyId: string | undefined;

      // Create company if mapped
      if (mapping.companyMapping?.name) {
        const companyName = getMappedValue(rawData, mapping.companyMapping.name);
        if (companyName) {
          let company = mockDb.findCompanyByName(user.organizationId, companyName);
          
          if (!company) {
            const website = getMappedValue(rawData, mapping.companyMapping.website);
            const domain = website ? extractDomain(website) : getMappedValue(rawData, mapping.companyMapping.domain);
            
            company = mockDb.createCompany({
              organizationId: user.organizationId,
              name: companyName,
              website,
              domain,
              industry: getMappedValue(rawData, mapping.companyMapping.industry),
              location: getMappedValue(rawData, mapping.companyMapping.location),
              size: getMappedValue(rawData, mapping.companyMapping.size),
              phone: getMappedValue(rawData, mapping.companyMapping.phone),
              ownerId: user.id,
            });
          }
          companyId = company.id;
        }
      }

      // Create lead if mapped
      if (mapping.leadMapping) {
        const email = getMappedValue(rawData, mapping.leadMapping.email);
        const firstName = getMappedValue(rawData, mapping.leadMapping.firstName) || 'Unknown';
        const lastName = getMappedValue(rawData, mapping.leadMapping.lastName) || '';

        if (email && mapping.duplicateHandling === 'skip') {
          const existingLead = mockDb.findLeadByEmail(user.organizationId, email);
          if (existingLead) {
            mockDb.updateImportRow(row.id, { status: 'success' });
            successCount++;
            continue;
          }
        }

        mockDb.createLead({
          organizationId: user.organizationId,
          companyId,
          firstName,
          lastName,
          email,
          phone: normalizePhone(getMappedValue(rawData, mapping.leadMapping.phone)),
          title: getMappedValue(rawData, mapping.leadMapping.title),
          status: getMappedValue(rawData, mapping.leadMapping.status) || 'NEW',
          source: getMappedValue(rawData, mapping.leadMapping.source) || 'CSV Import',
          notes: getMappedValue(rawData, mapping.leadMapping.notes),
          ownerId: user.id,
        });
      }

      mockDb.updateImportRow(row.id, { status: 'success' });
      successCount++;
    } catch (error: any) {
      mockDb.updateImportRow(row.id, { status: 'error', error: error.message });
      errorCount++;
    }
  }

  mockDb.updateImportJob(importJobId, {
    status: 'completed',
    successCount,
    errorCount,
    processedCount: successCount + errorCount,
  });

  console.log(`[Mock Import] Completed: ${successCount} success, ${errorCount} errors`);
}

// ==================== Routes ====================

export default async function importsRoutes(app: FastifyInstance) {
  // Upload CSV and parse headers
  app.post(
    '/api/imports/csv',
    {
      onRequest: [authenticate, authorize('SALES_REP', 'ADMIN')],
    },
    async (request, reply) => {
      try {
        // Get uploaded file
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: 'No file uploaded' });
        }

        // Validate file
        const validation = validateCsvFile({
          filename: data.filename,
          size: 0, // We'll check as we read
          mimetype: data.mimetype,
        });

        if (!validation.valid) {
          return reply.code(400).send({ error: validation.error });
        }

        // Read file content
        const chunks: Buffer[] = [];
        let totalSize = 0;
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB

        for await (const chunk of data.file) {
          totalSize += chunk.length;
          if (totalSize > MAX_SIZE) {
            return reply.code(400).send({
              error: 'File size exceeds maximum allowed size of 10MB',
            });
          }
          chunks.push(chunk);
        }

        const content = Buffer.concat(chunks).toString('utf-8');

        // Auto-detect delimiter
        const delimiter = detectDelimiter(content);

        // Parse CSV (preview only - first 20 rows)
        const parsed = parseCSV(content, {
          delimiter,
          maxPreviewRows: 20,
        });

        if (parsed.headers.length === 0) {
          return reply.code(400).send({ error: 'CSV file has no headers' });
        }

        // Count total rows (for full file)
        const allRows = parseCSV(content, { delimiter });

        let importJob: any;

        if (useMockDb) {
          // Use mock database in DEV_TEST_MODE
          console.log('[DEV_TEST_MODE] Using mock database for CSV import');
          
          importJob = mockDb.createImportJob({
            organizationId: (request.user as any).organizationId,
            createdByUserId: (request.user as any).id,
            status: 'mapping_required',
            originalFilename: data.filename,
            rowCount: allRows.rowCount,
          });

          // Store rows in mock database
          const importRows = allRows.rows.map((row, index) => ({
            importJobId: importJob.id,
            rowNumber: index + 1,
            rawJson: row,
            status: 'pending' as const,
          }));

          mockDb.createImportRows(importRows);
          
          mockDb.createAuditLog({
            action: 'created',
            entityType: 'import_job',
            entityId: importJob.id,
            changes: { filename: data.filename, rowCount: allRows.rowCount },
            userId: (request.user as any).id,
            organizationId: (request.user as any).organizationId,
          });
        } else {
          // Create import job in real database
          importJob = await prisma.importJob.create({
            data: {
              organizationId: (request.user as any).organizationId,
              createdByUserId: (request.user as any).id,
              status: 'mapping_required',
              originalFilename: data.filename,
              rowCount: allRows.rowCount,
            },
          });

          // Store all rows in import_rows table
          const importRows = allRows.rows.map((row, index) => ({
            importJobId: importJob.id,
            rowNumber: index + 1,
            rawJson: row,
            status: 'pending' as const,
          }));

          // Batch insert rows (in chunks to avoid query size limits)
          const CHUNK_SIZE = 100;
          for (let i = 0; i < importRows.length; i += CHUNK_SIZE) {
            const chunk = importRows.slice(i, i + CHUNK_SIZE);
            await prisma.importRow.createMany({
              data: chunk,
            });
          }

          // Create audit log
          await prisma.auditLog.create({
            data: {
              action: 'created',
              entityType: 'import_job',
              entityId: importJob.id,
              changes: {
                filename: data.filename,
                rowCount: allRows.rowCount,
              },
              userId: (request.user as any).id,
              organizationId: (request.user as any).organizationId,
            },
          });
        }

        return {
          importJobId: importJob.id,
          headers: parsed.headers,
          previewRows: parsed.rows,
          totalRows: allRows.rowCount,
          delimiter,
        };
      } catch (error: any) {
        console.error('CSV upload error:', error);
        return reply.code(500).send({ error: error.message || 'Failed to upload CSV' });
      }
    }
  );

  // Configure column mapping and start import
  app.post<{ Params: z.infer<typeof importParamsSchema> }>(
    '/api/imports/:id/mapping',
    {
      onRequest: [authenticate, authorize('SALES_REP', 'ADMIN')],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            duplicateHandling: { type: 'string', enum: ['skip', 'update'] },
            leadMapping: { type: 'object' },
            companyMapping: { type: 'object' },
            dealMapping: { type: 'object' },
            generateProfiles: { type: 'boolean' }
          }
        }
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const mapping = request.body as z.infer<typeof mappingConfigSchema>;

      // Validate mapping has at least one entity type
      if (!mapping.leadMapping && !mapping.companyMapping) {
        return reply.code(400).send({
          error: 'Must map at least lead or company fields',
        });
      }

      // Validate lead mapping has minimum required fields
      if (mapping.leadMapping) {
        const hasEmail = mapping.leadMapping.email;
        const hasPhone = mapping.leadMapping.phone;
        const hasName = mapping.leadMapping.firstName || mapping.leadMapping.lastName;

        if (!hasEmail && !hasPhone && !hasName) {
          return reply.code(400).send({
            error: 'Lead mapping must include at least email, phone, or name',
          });
        }
      }

      if (useMockDb) {
        const importJob = mockDb.getImportJob(id);
        
        if (!importJob || importJob.organizationId !== (request.user as any).organizationId) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        if (importJob.status !== 'mapping_required') {
          return reply.code(400).send({ error: 'Import job is not in correct state for mapping' });
        }

        mockDb.updateImportJob(id, {
          mapping,
          status: 'processing',
        });

        // Process import synchronously in DEV_TEST_MODE
        await processImportInMemory(id, mapping, request.user);

        return { message: 'Import completed', importJobId: id };
      } else {
        // Get import job from real database
        const importJob = await prisma.importJob.findFirst({
          where: {
            id,
            organizationId: (request.user as any).organizationId,
          },
        });

        if (!importJob) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        if (importJob.status !== 'mapping_required' && importJob.status !== 'uploaded') {
          return reply.code(400).send({ error: 'Import job is not in correct state for mapping' });
        }

        // Update import job with mapping
        await prisma.importJob.update({
          where: { id },
          data: {
            mappingJson: mapping as any,
            status: 'importing',
            updatedAt: new Date(),
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            action: 'updated',
            entityType: 'import_job',
            entityId: importJob.id,
            changes: {
              mapping,
              status: 'importing',
            },
            userId: (request.user as any).id,
            organizationId: (request.user as any).organizationId,
          },
        });

        // Enqueue import job for processing
        await importQueue.add('process-import', {
          importJobId: id,
          organizationId: (request.user as any).organizationId,
          userId: (request.user as any).id,
        });

        return {
          message: 'Import started',
          importJobId: id,
        };
      }
    }
  );

  // Get import status
  app.get<{ Params: z.infer<typeof importParamsSchema> }>(
    '/api/imports/:id/status',
    {
      onRequest: [authenticate, authorize('SALES_REP', 'ADMIN')],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      if (useMockDb) {
        const importJob = mockDb.getImportJob(id);
        
        if (!importJob || importJob.organizationId !== (request.user as any).organizationId) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        return {
          id: importJob.id,
          status: importJob.status,
          originalFilename: importJob.originalFilename,
          totalRows: importJob.rowCount,
          importedCount: importJob.successCount,
          failedCount: importJob.errorCount,
          skippedCount: 0,
          progress: importJob.rowCount > 0
            ? Math.round((importJob.processedCount / importJob.rowCount) * 100)
            : 0,
          createdAt: importJob.createdAt,
          completedAt: importJob.status === 'completed' ? importJob.updatedAt : null,
          errorLog: importJob.errorLog,
        };
      } else {
        const importJob = await prisma.importJob.findFirst({
          where: {
            id,
            organizationId: (request.user as any).organizationId,
          },
          include: {
            _count: {
              select: {
                rows: true,
              },
            },
          },
        });

        if (!importJob) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        return {
          id: importJob.id,
          status: importJob.status,
          originalFilename: importJob.originalFilename,
          totalRows: importJob.rowCount,
          importedCount: importJob.importedCount,
          failedCount: importJob.failedCount,
          skippedCount: importJob.skippedCount,
          progress: importJob.rowCount > 0
            ? Math.round(((importJob.importedCount + importJob.failedCount + importJob.skippedCount) / importJob.rowCount) * 100)
            : 0,
          createdAt: importJob.createdAt,
          completedAt: importJob.completedAt,
          errorLog: importJob.errorLog,
        };
      }
    }
  );

  // Get import errors
  app.get<{ Params: z.infer<typeof importParamsSchema> }>(
    '/api/imports/:id/errors',
    {
      onRequest: [authenticate, authorize('SALES_REP', 'ADMIN')],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      if (useMockDb) {
        const importJob = mockDb.getImportJob(id);
        
        if (!importJob || importJob.organizationId !== (request.user as any).organizationId) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        const rows = mockDb.getImportRowsByJobId(id);
        const failedRows = rows.filter(r => r.status === 'error');

        return {
          importJobId: id,
          failedCount: failedRows.length,
          errors: failedRows.map(row => ({
            rowNumber: row.rowNumber,
            data: row.rawJson,
            error: row.error,
          })),
        };
      } else {
        const importJob = await prisma.importJob.findFirst({
          where: {
            id,
            organizationId: (request.user as any).organizationId,
          },
        });

        if (!importJob) {
          return reply.code(404).send({ error: 'Import job not found' });
        }

        // Get failed rows
        const failedRows = await prisma.importRow.findMany({
          where: {
            importJobId: id,
            status: 'failed',
          },
          orderBy: {
            rowNumber: 'asc',
          },
          take: 1000, // Limit to prevent huge responses
        });

        return {
          importJobId: id,
          failedCount: failedRows.length,
          errors: failedRows.map((row: any) => ({
            rowNumber: row.rowNumber,
            data: row.rawJson,
            error: row.error,
          })),
        };
      }
    }
  );

  // List import jobs
  app.get(
    '/api/imports',
    {
      onRequest: [authenticate, authorize('SALES_REP', 'ADMIN')],
    },
    async (request, reply) => {
      if (useMockDb) {
        const importJobs = mockDb.listImportJobs((request.user as any).organizationId);
        
        return {
          imports: importJobs.map(job => ({
            id: job.id,
            status: job.status,
            originalFilename: job.originalFilename,
            rowCount: job.rowCount,
            importedCount: job.successCount,
            failedCount: job.errorCount,
            skippedCount: 0,
            createdBy: { firstName: 'Admin', lastName: 'User', email: 'admin@example.com' },
            createdAt: job.createdAt,
            completedAt: job.status === 'completed' ? job.updatedAt : null,
          })),
        };
      } else {
        const importJobs = await prisma.importJob.findMany({
          where: {
            organizationId: (request.user as any).organizationId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
          include: {
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        return {
          imports: importJobs.map((job: any) => ({
            id: job.id,
            status: job.status,
            originalFilename: job.originalFilename,
            rowCount: job.rowCount,
            importedCount: job.importedCount,
            failedCount: job.failedCount,
            skippedCount: job.skippedCount,
            createdBy: job.createdBy,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
          })),
        };
      }
    }
  );
}
