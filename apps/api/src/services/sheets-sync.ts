/**
 * Heimdell CRM — Google Sheets Sync-In Service
 *
 * Reads leads from a configured Google Sheet and creates/updates them
 * in the database. Idempotent: uses company + keyDecisionMaker as dedup key.
 *
 * Phase 1: sync-in (read) only. Sync-out is Phase 2.
 */

import { google, sheets_v4 } from 'googleapis';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog, SYSTEM_ACTOR } from '../middleware/audit.js';
import type { SheetsSyncConfig, Prisma } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

/** Column mapping: lead field name → sheet column letter */
export type ColumnMapping = Record<string, string>;

interface SyncResult {
  syncLogId: string;
  status: 'success' | 'failed' | 'partial';
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsSkipped: number;
  errors: { row: number; error: string }[];
  dryRun: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

/** Convert column letter (A, B, ..., Z, AA, AB) to 0-based index */
function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** Extract a cell value from a row using column letter */
function getCellByCol(row: string[], colLetter: string): string | undefined {
  const idx = colLetterToIndex(colLetter.toUpperCase());
  return idx < row.length ? row[idx]?.trim() || undefined : undefined;
}

// ─── Known lead fields and their parsers ─────────────────────

const FIELD_PARSERS: Record<string, (val: string) => unknown> = {
  company: (v) => v,
  key_decision_maker: (v) => v,
  role: (v) => v || null,
  website: (v) => v || null,
  facebook_clean: (v) => v || null,
  insta_clean: (v) => v || null,
  linkedin_clean: (v) => v || null,
  emails: (v) => v.split(',').map((e) => e.trim()).filter(Boolean),
  number: (v) => v || null,
  mobile_valid: (v) => ['true', '1', 'yes', 'y'].includes(v.toLowerCase()),
  notes: (v) => v || null,
};

/** Map sheet field names to Prisma field names */
const FIELD_NAME_MAP: Record<string, string> = {
  company: 'company',
  key_decision_maker: 'keyDecisionMaker',
  role: 'role',
  website: 'website',
  facebook_clean: 'facebookClean',
  insta_clean: 'instaClean',
  linkedin_clean: 'linkedinClean',
  emails: 'emails',
  number: 'number',
  mobile_valid: 'mobileValid',
  notes: 'notes',
};

// ─── Core Sync Function ─────────────────────────────────────

/**
 * Execute a sync-in from Google Sheets.
 *
 * @param configId - ID of the SheetsSyncConfig to use
 * @param dryRun - If true, don't write to DB, just report what would happen
 * @param actor - Who triggered this sync
 */
export async function syncInFromSheets(
  configId: string,
  dryRun: boolean = false,
  actor: string = SYSTEM_ACTOR,
): Promise<SyncResult> {
  // Load config
  const config = await prisma.sheetsSyncConfig.findUnique({
    where: { id: configId },
  });

  if (!config) throw new Error(`Sync config ${configId} not found`);
  if (!config.isActive) throw new Error(`Sync config ${configId} is inactive`);
  if (!config.serviceAccountJson) throw new Error('No service account credentials configured');

  const columnMapping = config.columnMapping as ColumnMapping;

  // Create sync log entry
  const syncLog = await prisma.sheetsSyncLog.create({
    data: {
      configId,
      direction: 'in',
      status: 'running',
      dryRun,
    },
  });

  const errors: { row: number; error: string }[] = [];
  let rowsProcessed = 0;
  let rowsCreated = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  try {
    // Authenticate with Google Sheets API
    const credentials = config.serviceAccountJson as Record<string, string>;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Read all rows from the configured tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `${config.tabName}`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      // No data rows (first row is header)
      await finalizeSyncLog(syncLog.id, 'success', { rowsProcessed: 0, rowsCreated: 0, rowsUpdated: 0, rowsSkipped: 0, errors: [] });
      return { syncLogId: syncLog.id, status: 'success', rowsProcessed: 0, rowsCreated: 0, rowsUpdated: 0, rowsSkipped: 0, errors: [], dryRun };
    }

    // Skip header row (index 0), process data rows
    for (let i = 1; i < rows.length; i++) {
      rowsProcessed++;
      const row = rows[i];

      try {
        // Extract fields according to column mapping
        const extracted: Record<string, unknown> = {};

        for (const [fieldName, colLetter] of Object.entries(columnMapping)) {
          const rawValue = getCellByCol(row, colLetter);
          if (rawValue === undefined) continue;

          const parser = FIELD_PARSERS[fieldName];
          const prismaField = FIELD_NAME_MAP[fieldName];
          if (parser && prismaField) {
            extracted[prismaField] = parser(rawValue);
          }
        }

        // Validate required fields
        if (!extracted.company || !extracted.keyDecisionMaker) {
          errors.push({ row: i + 1, error: 'Missing required field: company or key_decision_maker' });
          rowsSkipped++;
          continue;
        }

        if (dryRun) {
          // Check if it would be create or update
          const existing = await prisma.lead.findFirst({
            where: {
              organizationId: config.organizationId,
              company: extracted.company as string,
              keyDecisionMaker: extracted.keyDecisionMaker as string,
            },
          });
          if (existing) rowsUpdated++;
          else rowsCreated++;
          continue;
        }

        // Upsert: dedup on company + keyDecisionMaker within org
        const existing = await prisma.lead.findFirst({
          where: {
            organizationId: config.organizationId,
            company: extracted.company as string,
            keyDecisionMaker: extracted.keyDecisionMaker as string,
          },
        });

        if (existing) {
          // Update existing lead (only non-pipeline fields)
          const updateData: Prisma.LeadUpdateInput = {};
          for (const [key, value] of Object.entries(extracted)) {
            // Don't overwrite pipeline state fields
            if (['status', 'nextAction', 'nextActionDueUtc', 'outcome', 'qualified'].includes(key)) continue;
            (updateData as any)[key] = value;
          }
          updateData.sheetsSyncedAt = new Date();
          updateData.sheetsRowIndex = i;

          await prisma.lead.update({
            where: { id: existing.id },
            data: updateData,
          });

          await writeAuditLog({
            leadId: existing.id,
            organizationId: config.organizationId,
            actor,
            action: 'sheets_sync_in',
            before: null,
            after: { sheetsRow: i + 1, fieldsUpdated: Object.keys(updateData) },
            source: 'sync',
          });

          rowsUpdated++;
        } else {
          // Create new lead
          const lead = await prisma.lead.create({
            data: {
              organizationId: config.organizationId,
              company: extracted.company as string,
              keyDecisionMaker: extracted.keyDecisionMaker as string,
              role: (extracted.role as string) ?? null,
              website: (extracted.website as string) ?? null,
              facebookClean: (extracted.facebookClean as string) ?? null,
              instaClean: (extracted.instaClean as string) ?? null,
              linkedinClean: (extracted.linkedinClean as string) ?? null,
              emails: (extracted.emails as string[]) ?? [],
              number: (extracted.number as string) ?? null,
              mobileValid: (extracted.mobileValid as boolean) ?? false,
              notes: (extracted.notes as string) ?? null,
              status: 'NEW',
              nextAction: 'first_touch',
              sheetsRowIndex: i,
              sheetsSyncedAt: new Date(),
            },
          });

          await writeAuditLog({
            leadId: lead.id,
            organizationId: config.organizationId,
            actor,
            action: 'sheets_sync_in',
            before: null,
            after: { sheetsRow: i + 1, action: 'created' },
            source: 'sync',
          });

          rowsCreated++;
        }
      } catch (rowError: any) {
        errors.push({ row: i + 1, error: rowError.message ?? String(rowError) });
        rowsSkipped++;
      }
    }

    const status = errors.length > 0 ? 'partial' : 'success';
    await finalizeSyncLog(syncLog.id, status, { rowsProcessed, rowsCreated, rowsUpdated, rowsSkipped, errors });

    // Update lastSyncAt on config
    await prisma.sheetsSyncConfig.update({
      where: { id: configId },
      data: { lastSyncAt: new Date() },
    });

    return { syncLogId: syncLog.id, status, rowsProcessed, rowsCreated, rowsUpdated, rowsSkipped, errors, dryRun };
  } catch (error: any) {
    await finalizeSyncLog(syncLog.id, 'failed', { rowsProcessed, rowsCreated, rowsUpdated, rowsSkipped, errors: [{ row: 0, error: error.message }] });
    return {
      syncLogId: syncLog.id,
      status: 'failed',
      rowsProcessed,
      rowsCreated,
      rowsUpdated,
      rowsSkipped,
      errors: [{ row: 0, error: error.message }],
      dryRun,
    };
  }
}

// ─── Internal Helpers ────────────────────────────────────────

async function finalizeSyncLog(
  id: string,
  status: string,
  data: { rowsProcessed: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; errors: unknown[] },
) {
  await prisma.sheetsSyncLog.update({
    where: { id },
    data: {
      status,
      rowsProcessed: data.rowsProcessed,
      rowsCreated: data.rowsCreated,
      rowsUpdated: data.rowsUpdated,
      rowsSkipped: data.rowsSkipped,
      errors: data.errors as any,
      completedAt: new Date(),
    },
  });
}
