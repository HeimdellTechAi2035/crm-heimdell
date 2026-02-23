/**
 * Heimdell CRM — Deterministic Lead Status Transition Engine
 *
 * Pure state machine. No AI, no guessing.
 * Every transition has explicit preconditions and side-effects.
 */

import { LeadStatus, Lead, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// ─── Types ──────────────────────────────────────────────────

export interface TransitionResult {
  success: boolean;
  lead?: Lead;
  /** All status changes applied (includes auto-chains) */
  transitions?: { from: LeadStatus; to: LeadStatus }[];
  error?: string;
}

interface TransitionSideEffects {
  nextAction: string | null;
  nextActionDueUtc: Date | null;
  outcome?: string;
  qualified?: boolean;
}

interface TransitionRule {
  precondition: (lead: Lead) => { ok: boolean; reason?: string };
  sideEffects: (lead: Lead) => Partial<TransitionSideEffects>;
}

interface AutoChain {
  nextStatus: (lead: Lead) => LeadStatus;
  sideEffects: (lead: Lead) => Partial<TransitionSideEffects>;
}

// ─── Helpers ────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

// ─── Allowed Transition Map ─────────────────────────────────

/** All valid from→to transitions. REPLIED and NOT_INTERESTED are special interrupts. */
const TRANSITION_MAP: Record<LeadStatus, LeadStatus[]> = {
  NEW:            ['CONTACTED_1', 'REPLIED', 'NOT_INTERESTED'],
  CONTACTED_1:    ['WAITING_D2', 'REPLIED', 'NOT_INTERESTED'],
  WAITING_D2:     ['CALL_DUE', 'REPLIED', 'NOT_INTERESTED'],
  CALL_DUE:       ['CALLED', 'REPLIED', 'NOT_INTERESTED'],
  CALLED:         ['WAITING_D1', 'REPLIED', 'NOT_INTERESTED'],
  WAITING_D1:     ['CONTACTED_2', 'REPLIED', 'NOT_INTERESTED'],
  CONTACTED_2:    ['WA_VOICE_DUE', 'COMPLETED', 'REPLIED', 'NOT_INTERESTED'],
  WA_VOICE_DUE:   ['COMPLETED', 'REPLIED', 'NOT_INTERESTED'],
  REPLIED:        ['QUALIFIED', 'NOT_INTERESTED'],
  QUALIFIED:      ['COMPLETED'],
  NOT_INTERESTED: ['COMPLETED'],
  COMPLETED:      [],
};

// ─── Preconditions & Side-effects Per Transition ─────────────

/** Key format: "FROM→TO" */
const RULES: Record<string, TransitionRule> = {
  // Step 1: First touch done
  'NEW→CONTACTED_1': {
    precondition: (lead) => ({
      ok: lead.emailSent1 === true,
      reason: 'email_sent_1 must be true before advancing to CONTACTED_1',
    }),
    sideEffects: () => ({
      nextAction: 'wait_for_call_window',
      nextActionDueUtc: addDays(new Date(), 2),
    }),
  },

  // Auto-chain: CONTACTED_1 → WAITING_D2 (immediate)
  'CONTACTED_1→WAITING_D2': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({
      nextAction: 'call',
      nextActionDueUtc: addDays(new Date(), 2),
    }),
  },

  // Scheduler: 2 days elapsed
  'WAITING_D2→CALL_DUE': {
    precondition: (lead) => {
      if (!lead.lastActionUtc) return { ok: false, reason: 'last_action_utc is not set' };
      return {
        ok: daysSince(lead.lastActionUtc) >= 2,
        reason: `Only ${daysSince(lead.lastActionUtc).toFixed(1)} days elapsed, need 2`,
      };
    },
    sideEffects: () => ({
      nextAction: 'call_lead',
      nextActionDueUtc: null, // due now
    }),
  },

  // Step 2: Call done
  'CALL_DUE→CALLED': {
    precondition: (lead) => ({
      ok: lead.callDone === true,
      reason: 'call_done must be true before advancing to CALLED',
    }),
    sideEffects: () => ({
      nextAction: 'wait_for_followup_window',
      nextActionDueUtc: addDays(new Date(), 1),
    }),
  },

  // Auto-chain: CALLED → WAITING_D1 (immediate)
  'CALLED→WAITING_D1': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({
      nextAction: 'follow_up_email_dm',
      nextActionDueUtc: addDays(new Date(), 1),
    }),
  },

  // Step 3: Follow-up done (after 1-day wait)
  'WAITING_D1→CONTACTED_2': {
    precondition: (lead) => {
      if (!lead.emailSent2) return { ok: false, reason: 'email_sent_2 must be true' };
      if (!lead.lastActionUtc) return { ok: false, reason: 'last_action_utc is not set' };
      if (daysSince(lead.lastActionUtc) < 1) {
        return { ok: false, reason: `Only ${daysSince(lead.lastActionUtc).toFixed(1)} days elapsed, need 1` };
      }
      return { ok: true };
    },
    sideEffects: () => ({
      nextAction: 'wa_voice_note_or_complete',
      nextActionDueUtc: addDays(new Date(), 1),
    }),
  },

  // Step 4a: WhatsApp voice note due (only if mobile_valid)
  'CONTACTED_2→WA_VOICE_DUE': {
    precondition: (lead) => ({
      ok: lead.mobileValid === true,
      reason: 'mobile_valid must be true for WA voice step',
    }),
    sideEffects: () => ({
      nextAction: 'send_wa_voice_note',
      nextActionDueUtc: null,
    }),
  },

  // Step 4b: Skip WA if no mobile
  'CONTACTED_2→COMPLETED': {
    precondition: (lead) => ({
      ok: lead.mobileValid === false,
      reason: 'mobile_valid must be false to skip WA step',
    }),
    sideEffects: () => ({
      nextAction: null,
      nextActionDueUtc: null,
      outcome: 'pipeline_complete_no_mobile',
    }),
  },

  // WA voice sent → complete
  'WA_VOICE_DUE→COMPLETED': {
    precondition: (lead) => ({
      ok: lead.waVoiceSent === true,
      reason: 'wa_voice_sent must be true before completing',
    }),
    sideEffects: () => ({
      nextAction: null,
      nextActionDueUtc: null,
      outcome: 'pipeline_complete',
    }),
  },

  // ── Interrupt: REPLIED (from any active status) ──

  'NEW→REPLIED':          { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'CONTACTED_1→REPLIED':  { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'WAITING_D2→REPLIED':   { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'CALL_DUE→REPLIED':     { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'CALLED→REPLIED':       { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'WAITING_D1→REPLIED':   { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'CONTACTED_2→REPLIED':  { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },
  'WA_VOICE_DUE→REPLIED': { precondition: (l) => ({ ok: !!l.repliedAtUtc, reason: 'replied_at_utc must be set' }), sideEffects: () => ({ nextAction: 'qualify_lead', nextActionDueUtc: null }) },

  // ── Classification ──

  'REPLIED→QUALIFIED': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: true }),
  },
  'REPLIED→NOT_INTERESTED': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }),
  },

  // ── Interrupt: NOT_INTERESTED (from any active status) ──

  'NEW→NOT_INTERESTED':          { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'CONTACTED_1→NOT_INTERESTED':  { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'WAITING_D2→NOT_INTERESTED':   { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'CALL_DUE→NOT_INTERESTED':     { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'CALLED→NOT_INTERESTED':       { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'WAITING_D1→NOT_INTERESTED':   { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'CONTACTED_2→NOT_INTERESTED':  { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },
  'WA_VOICE_DUE→NOT_INTERESTED': { precondition: () => ({ ok: true }), sideEffects: () => ({ nextAction: 'close_out', nextActionDueUtc: null, qualified: false }) },

  'QUALIFIED→COMPLETED': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({ nextAction: null, nextActionDueUtc: null, outcome: 'qualified_complete' }),
  },
  'NOT_INTERESTED→COMPLETED': {
    precondition: () => ({ ok: true }),
    sideEffects: () => ({ nextAction: null, nextActionDueUtc: null, outcome: 'not_interested_complete' }),
  },
};

// ─── Auto-Chains ─────────────────────────────────────────────

/**
 * After entering these statuses, immediately chain to the next status.
 * The user calls advance(CONTACTED_1) and gets WAITING_D2 as a bonus.
 */
const AUTO_CHAINS: Partial<Record<LeadStatus, AutoChain>> = {
  CONTACTED_1: {
    nextStatus: () => 'WAITING_D2',
    sideEffects: () => ({
      nextAction: 'call',
      nextActionDueUtc: addDays(new Date(), 2),
    }),
  },
  CALLED: {
    nextStatus: () => 'WAITING_D1',
    sideEffects: () => ({
      nextAction: 'follow_up_email_dm',
      nextActionDueUtc: addDays(new Date(), 1),
    }),
  },
  CONTACTED_2: {
    nextStatus: (lead) => (lead.mobileValid ? 'WA_VOICE_DUE' : 'COMPLETED'),
    sideEffects: (lead) =>
      lead.mobileValid
        ? { nextAction: 'send_wa_voice_note', nextActionDueUtc: null }
        : { nextAction: null, nextActionDueUtc: null, outcome: 'pipeline_complete_no_mobile' },
  },
};

// ─── Core Engine ─────────────────────────────────────────────

/**
 * Check if a transition is allowed without executing it.
 */
export function canTransition(
  lead: Lead,
  targetStatus: LeadStatus,
): { allowed: boolean; reason?: string } {
  const from = lead.status;
  const allowed = TRANSITION_MAP[from];

  if (!allowed || !allowed.includes(targetStatus)) {
    return { allowed: false, reason: `Transition ${from} → ${targetStatus} is not allowed` };
  }

  const ruleKey = `${from}→${targetStatus}`;
  const rule = RULES[ruleKey];
  if (!rule) {
    return { allowed: false, reason: `No rule defined for ${ruleKey}` };
  }

  const check = rule.precondition(lead);
  if (!check.ok) {
    return { allowed: false, reason: check.reason };
  }

  return { allowed: true };
}

/**
 * Advance a lead to the target status, applying preconditions,
 * side-effects, audit logs, and auto-chains — all in one transaction.
 */
export async function advanceLead(
  leadId: string,
  targetStatus: LeadStatus,
  actor: string,
  source: 'api' | 'agent' | 'sync' | 'scheduler',
): Promise<TransitionResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, error: 'Lead not found' };

  // Validate the first transition
  const check = canTransition(lead, targetStatus);
  if (!check.allowed) {
    return { success: false, error: check.reason };
  }

  const transitions: { from: LeadStatus; to: LeadStatus }[] = [];

  // Build all operations (transition + auto-chains) for a single transaction
  const result = await prisma.$transaction(async (tx) => {
    let currentLead = lead;
    let currentTarget = targetStatus;
    let iteration = 0;
    const MAX_CHAINS = 3; // safety limit

    while (iteration < MAX_CHAINS) {
      iteration++;
      const ruleKey = `${currentLead.status}→${currentTarget}`;
      const rule = RULES[ruleKey]!;

      const effects = rule.sideEffects(currentLead);
      const fromStatus = currentLead.status;

      // Build update data
      const updateData: Prisma.LeadUpdateInput = {
        status: currentTarget,
        lastActionUtc: new Date(),
      };
      if (effects.nextAction !== undefined) updateData.nextAction = effects.nextAction;
      if (effects.nextActionDueUtc !== undefined) updateData.nextActionDueUtc = effects.nextActionDueUtc;
      if (effects.outcome !== undefined) updateData.outcome = effects.outcome;
      if (effects.qualified !== undefined) updateData.qualified = effects.qualified;

      // Apply transition
      currentLead = await tx.lead.update({
        where: { id: leadId },
        data: updateData,
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          leadId,
          organizationId: currentLead.organizationId,
          actor,
          action: 'status_change',
          before: { status: fromStatus },
          after: { status: currentTarget, ...effects },
          source,
        },
      });

      transitions.push({ from: fromStatus, to: currentTarget });

      // Check for auto-chain
      const chain = AUTO_CHAINS[currentTarget];
      if (chain) {
        const nextStatus = chain.nextStatus(currentLead);
        // Only auto-chain if the chain rule exists and is valid
        const chainRuleKey = `${currentTarget}→${nextStatus}`;
        if (RULES[chainRuleKey]) {
          currentTarget = nextStatus;
          continue;
        }
      }

      break; // No more chains
    }

    return currentLead;
  });

  return { success: true, lead: result, transitions };
}

/**
 * Get leads whose scheduled action is due (for scheduler/cron).
 * Returns leads in WAITING_D2 or WAITING_D1 whose timer has expired.
 */
export async function getDueLeads(organizationId?: string): Promise<Lead[]> {
  const now = new Date();
  const where: Prisma.LeadWhereInput = {
    status: { in: ['WAITING_D2', 'WAITING_D1'] },
    nextActionDueUtc: { lte: now },
  };
  if (organizationId) where.organizationId = organizationId;

  return prisma.lead.findMany({ where, orderBy: { nextActionDueUtc: 'asc' } });
}

/**
 * Get a human-readable description of what's needed to advance.
 */
export function getNextSteps(lead: Lead): {
  currentStatus: LeadStatus;
  possibleTransitions: { to: LeadStatus; allowed: boolean; reason?: string }[];
} {
  const from = lead.status;
  const targets = TRANSITION_MAP[from] || [];

  return {
    currentStatus: from,
    possibleTransitions: targets.map((to) => {
      const check = canTransition(lead, to);
      return { to, allowed: check.allowed, reason: check.reason };
    }),
  };
}

// ─── Action Flag Definitions ─────────────────────────────────

/**
 * Maps action names to the lead boolean field they set.
 * Used by POST /api/leads/:id/actions
 */
export const ACTION_FLAG_MAP: Record<string, keyof Lead> = {
  send_email_1:  'emailSent1',
  send_dm_li_1:  'dmLiSent1',
  send_dm_fb_1:  'dmFbSent1',
  send_dm_ig_1:  'dmIgSent1',
  call_done:     'callDone',
  send_email_2:  'emailSent2',
  send_dm_2:     'dmSent2',
  send_wa_voice: 'waVoiceSent',
  mark_replied:  'repliedAtUtc' as keyof Lead, // special: sets DateTime, not boolean
};
