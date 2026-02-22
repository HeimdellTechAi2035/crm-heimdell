/**
 * Heimdell CRM — Google Sheets Sync-Out Service
 *
 * Writes lead data from the database back to a configured Google Sheet.
 * Used for reporting, sharing with external teams, or mirroring.
 *
 * Idempotent: uses sheetsRowIndex to update existing rows.
 */

import { google } from 'googleapis';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog, SYSTEM_ACTOR } from '../middleware/audit.js';
import type { Lead, SheetsSyncConfig } from '@prisma/client';
import type { ColumnMapping } from './sheets-sync.js';

// ─── Types ──────────────────────────────────────────────────

interface SyncOutResult {
  syncLogId: string;
  status: 'success' | 'failed' | 'partial';
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  errors: { leadId: string; error: string }[];
}

// ─── Field Serializers ──────────────────────────────────────

const FIELD_SERIALIZERS: Record<string, (lead: Lead) => string> = {
  company: (l) => l.company,
  key_decision_maker: (l) => l.keyDecisionMaker,
  role: (l) => l.role ?? '',
  website: (l) => l.website ?? '',
  facebook_clean: (l) => l.facebookClean ?? '',
  insta_clean: (l) => l.instaClean ?? '',
  linkedin_clean: (l) => l.linkedinClean ?? '',
  emails: (l) => l.emails.join(', '),
  number: (l) => l.number ?? '',
  mobile_valid: (l) => l.mobileValid ? 'Yes' : 'No',
  status: (l) => l.status,
  next_action: (l) => l.nextAction ?? '',
  next_action_due: (l) => l.nextActionDueUtc?.toISOString() ?? '',
  outcome: (l) => l.outcome ?? '',
  notes: (l) => l.notes ?? '',
  qualified: (l) => l.qualified ? 'Yes' : 'No',
  // Action flags
  dm_li_sent_1: (l) => l.dmLiSent1 ? 'Yes' : '',
  dm_fb_sent_1: (l) => l.dmFbSent1 ? 'Yes' : '',
  dm_ig_sent_1: (l) => l.dmIgSent1 ? 'Yes' : '',
  email_sent_1: (l) => l.emailSent1 ? 'Yes' : '',
  call_done: (l) => l.callDone ? 'Yes' : '',
  email_sent_2: (l) => l.emailSent2 ? 'Yes' : '',
  dm_sent_2: (l) => l.dmSent2 ? 'Yes' : '',
  wa_voice_sent: (l) => l.waVoiceSent ? 'Yes' : '',
  replied_at: (l) => l.repliedAtUtc?.toISOString() ?? '',
};

// ─── Helpers ────────────────────────────────────────────────

/** Convert 0-based index to column letter (0=A, 25=Z, 26=AA) */
function indexToColLetter(index: number): string {
  let col = '';
  let num = index;
  while (num >= 0) {
    col = String.fromCharCode((num % 26) + 65) + col;
    num = Math.floor(num / 26) - 1;
  }
  return col;
}

/** Convert column letter to 0-based index */
function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** Build a row array from a lead and column mapping */
function buildRowFromLead(lead: Lead, mapping: ColumnMapping): { row: string[]; maxCol: number } {
  let maxCol = 0;
  const cells: { index: number; value: string }[] = [];

  for (const [fieldName, colLetter] of Object.entries(mapping)) {
    const serializer = FIELD_SERIALIZERS[fieldName];
    if (!serializer) continue;

    const colIdx = colLetterToIndex(colLetter.toUpperCase());
    if (colIdx > maxCol) maxCol = colIdx;
    cells.push({ index: colIdx, value: serializer(lead) });
  }

  const row = new Array(maxCol + 1).fill('');
  for (const cell of cells) {
    row[cell.index] = cell.value;
  }

  return { row, maxCol };
}

// ─── Core Sync-Out Function ─────────────────────────────────

export async function syncOutToSheets(
  configId: string,
  actor: string = SYSTEM_ACTOR,
): Promise<SyncOutResult> {
  const config = await prisma.sheetsSyncConfig.findUnique({
    where: { id: configId },
  });

  if (!config) throw new Error(`Sync config ${configId} not found`);
  if (!config.isActive) throw new Error(`Sync config ${configId} is inactive`);
  if (!config.serviceAccountJson) throw new Error('No service account credentials configured');

  const columnMapping = config.columnMapping as ColumnMapping;

  // Create sync log
  const syncLog = await prisma.sheetsSyncLog.create({
    data: {
      configId,
      direction: 'out',
      status: 'running',
      dryRun: false,
    },
  });

  const errors: { leadId: string; error: string }[] = [];
  let rowsProcessed = 0;
  let rowsCreated = 0;
  let rowsUpdated = 0;

  try {
    // Auth
    const credentials = config.serviceAccountJson as Record<string, string>;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all leads for this org
    const leads = await prisma.lead.findMany({
      where: { organizationId: config.organizationId },
      orderBy: { createdAt: 'asc' },
    });

    // Read existing sheet to find header row + last row
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `${config.tabName}`,
    });
    const existingRows = existingData.data.values || [];
    const nextEmptyRow = existingRows.length + 1; // 1-indexed

    // Batch updates for existing rows, batch appends for new
    const updateRequests: { range: string; values: string[][] }[] = [];
    const newRows: string[][] = [];
    let newRowCounter = 0;

    for (const lead of leads) {
      rowsProcessed++;

      try {
        const { row } = buildRowFromLead(lead, columnMapping);

        if (lead.sheetsRowIndex !== null && lead.sheetsRowIndex !== undefined) {
          // Update existing row (sheetsRowIndex is 0-based data row, +2 for header)
          const sheetRow = lead.sheetsRowIndex + 2; // +1 for 1-indexing, +1 for header
          const range = `${config.tabName}!A${sheetRow}`;

          updateRequests.push({ range, values: [row] });
          rowsUpdated++;
        } else {
          // New lead — append
          newRows.push(row);

          // Track the row index for future syncs
          const rowIndex = nextEmptyRow + newRowCounter - 1; // 0-based data index
          await prisma.lead.update({
            where: { id: lead.id },
            data: { sheetsRowIndex: rowIndex, sheetsSyncedAt: new Date() },
          });

          newRowCounter++;
          rowsCreated++;
        }
      } catch (err: any) {
        errors.push({ leadId: lead.id, error: err.message });
      }
    }

    // Execute batch updates
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: config.sheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateRequests,
        },
      });
    }

    // Append new rows
    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: `${config.tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: newRows },
      });
    }

    const status = errors.length > 0 ? 'partial' : 'success';

    await prisma.sheetsSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        rowsProcessed,
        rowsCreated,
        rowsUpdated,
        errors: errors as any,
        completedAt: new Date(),
      },
    });

    await prisma.sheetsSyncConfig.update({
      where: { id: configId },
      data: { lastSyncAt: new Date() },
    });

    return { syncLogId: syncLog.id, status, rowsProcessed, rowsCreated, rowsUpdated, errors };
  } catch (error: any) {
    await prisma.sheetsSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        errors: [{ leadId: '', error: error.message }] as any,
        completedAt: new Date(),
      },
    });

    return {
      syncLogId: syncLog.id,
      status: 'failed',
      rowsProcessed,
      rowsCreated,
      rowsUpdated,
      errors: [{ leadId: '', error: error.message }],
    };
  }
}
