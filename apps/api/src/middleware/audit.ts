import { prisma } from '../lib/prisma.js';
import type { Lead } from '@prisma/client';

/**
 * Heimdell Audit Logger — immutable, append-only audit trail.
 *
 * Every mutation to a lead is recorded with:
 *   actor, action, before, after, timestamp_utc, source
 *
 * This is NOT a Fastify middleware hook — it's called explicitly
 * from route handlers and the transition engine for precise control.
 */

export type AuditSource = 'api' | 'agent' | 'sync' | 'scheduler';

export interface AuditEntry {
  leadId: string;
  organizationId: string;
  actor: string;          // "user:<id>" | "system" | "agent:<key_name>"
  action: string;         // "status_change" | "field_update" | "action_logged" | "sheets_sync_in"
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  source: AuditSource;
}

/**
 * Write a single audit log entry. Never throws — logs errors to console.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        leadId: entry.leadId,
        organizationId: entry.organizationId,
        actor: entry.actor,
        action: entry.action,
        before: entry.before ?? undefined,
        after: entry.after ?? undefined,
        source: entry.source,
        timestampUtc: new Date(),
      },
    });
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error);
  }
}

/**
 * Compute a diff of changed fields between old and new lead objects.
 * Returns { before: { field: oldVal }, after: { field: newVal } } for changed fields only.
 */
export function diffLead(
  oldLead: Partial<Lead>,
  newLead: Partial<Lead>,
  fields?: string[],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const keysToCheck = fields ?? Object.keys(newLead);

  for (const key of keysToCheck) {
    const oldVal = (oldLead as any)[key];
    const newVal = (newLead as any)[key];

    // Skip undefined (not provided) and identical values
    if (newVal === undefined) continue;
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    before[key] = oldVal ?? null;
    after[key] = newVal;
  }

  return { before, after };
}

/**
 * Build the actor string from a user object or system identifier.
 */
export function actorFromUser(user: { id: string }): string {
  return `user:${user.id}`;
}

export function actorFromAgent(keyName: string): string {
  return `agent:${keyName}`;
}

export const SYSTEM_ACTOR = 'system';
