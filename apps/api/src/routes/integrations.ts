import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { syncInFromSheets } from '../services/sheets-sync.js';
import { syncOutToSheets } from '../services/sheets-sync-out.js';
import { actorFromUser } from '../middleware/audit.js';

// ─── Schemas ────────────────────────────────────────────────

const createSyncConfigSchema = z.object({
  sheetId: z.string().min(1),
  tabName: z.string().default('Sheet1'),
  columnMapping: z.record(z.string(), z.string()), // { "company": "A", "key_decision_maker": "B", ... }
  serviceAccountJson: z.object({
    client_email: z.string().email(),
    private_key: z.string().min(1),
  }).passthrough().optional(),
});

const syncInSchema = z.object({
  configId: z.string().min(1),
  dryRun: z.boolean().default(false),
});

// ─── Routes ─────────────────────────────────────────────────

export async function integrationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /**
   * POST /api/integrations/google-sheets/configs
   *
   * Create a Google Sheets sync configuration.
   * ADMIN only — sets up the sheet ID, tab, column mapping, and credentials.
   */
  app.post('/google-sheets/configs', {
    preHandler: authorize('ADMIN'),
  }, async (request, reply) => {
    const user = request.user!;
    const body = createSyncConfigSchema.parse(request.body);

    const config = await prisma.sheetsSyncConfig.create({
      data: {
        organizationId: user.organizationId,
        sheetId: body.sheetId,
        tabName: body.tabName,
        columnMapping: body.columnMapping,
        serviceAccountJson: body.serviceAccountJson ?? undefined,
      },
    });

    return reply.code(201).send({
      id: config.id,
      sheetId: config.sheetId,
      tabName: config.tabName,
      columnMapping: config.columnMapping,
      isActive: config.isActive,
      createdAt: config.createdAt,
    });
  });

  /**
   * GET /api/integrations/google-sheets/configs
   *
   * List all sync configs for the org.
   */
  app.get('/google-sheets/configs', async (request) => {
    const user = request.user!;

    const configs = await prisma.sheetsSyncConfig.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        sheetId: true,
        tabName: true,
        columnMapping: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        // Never expose serviceAccountJson
      },
    });

    return { configs };
  });

  /**
   * POST /api/integrations/google-sheets/sync-in
   *
   * Trigger a sync-in from Google Sheets. Reads the sheet and creates/updates leads.
   * Idempotent: deduplicates on company + key_decision_maker.
   * ADMIN or OPERATOR only.
   */
  app.post('/google-sheets/sync-in', {
    preHandler: authorize('ADMIN', 'OPERATOR'),
  }, async (request, reply) => {
    const user = request.user!;
    const { configId, dryRun } = syncInSchema.parse(request.body);

    // Verify config belongs to this org
    const config = await prisma.sheetsSyncConfig.findFirst({
      where: { id: configId, organizationId: user.organizationId },
    });
    if (!config) return reply.code(404).send({ error: 'Sync config not found' });

    const result = await syncInFromSheets(configId, dryRun, actorFromUser(user));

    const statusCode = result.status === 'failed' ? 500 : 200;
    return reply.code(statusCode).send(result);
  });

  /**
   * GET /api/integrations/google-sheets/sync-logs/:configId
   *
   * Get sync history for a config.
   */
  app.get<{ Params: { configId: string } }>('/google-sheets/sync-logs/:configId', async (request, reply) => {
    const user = request.user!;
    const { configId } = request.params;

    // Verify config ownership
    const config = await prisma.sheetsSyncConfig.findFirst({
      where: { id: configId, organizationId: user.organizationId },
    });
    if (!config) return reply.code(404).send({ error: 'Sync config not found' });

    const logs = await prisma.sheetsSyncLog.findMany({
      where: { configId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return { logs };
  });

  /**
   * POST /api/integrations/google-sheets/sync-out
   *
   * Write leads from the database back to Google Sheets.
   * Updates existing rows (by sheetsRowIndex) and appends new ones.
   * ADMIN or OPERATOR only.
   */
  app.post('/google-sheets/sync-out', {
    preHandler: authorize('ADMIN', 'OPERATOR'),
  }, async (request, reply) => {
    const user = request.user!;
    const { configId } = syncInSchema.parse(request.body); // reuse schema (just needs configId)

    const config = await prisma.sheetsSyncConfig.findFirst({
      where: { id: configId, organizationId: user.organizationId },
    });
    if (!config) return reply.code(404).send({ error: 'Sync config not found' });

    const result = await syncOutToSheets(configId, actorFromUser(user));

    const statusCode = result.status === 'failed' ? 500 : 200;
    return reply.code(statusCode).send(result);
  });
}
