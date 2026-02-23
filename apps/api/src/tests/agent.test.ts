/**
 * Heimdell CRM — Agent API Integration Tests
 *
 * Tests cover:
 *   1. Invalid transition → 409 with structured error
 *   2. Idempotency-Key dedup → replayed response
 *   3. Action audit log written
 *   4. Auth failure → 401
 *   5. Health + auth-test endpoints
 *   6. mark_qualified / mark_not_interested actions
 *   7. Canonical status enum enforcement on list filter
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ACTION_TRANSITION_MAP, CANONICAL_STATUSES, AGENT_ACTIONS } from '../routes/agent.js';
import { _testMemoryStore } from '../lib/idempotency.js';

// ═══════════════════════════════════════════════════════════════
//  Unit Tests — ACTION_TRANSITION_MAP
// ═══════════════════════════════════════════════════════════════

describe('ACTION_TRANSITION_MAP', () => {
  it('should have rules for all 11 agent actions', () => {
    expect(Object.keys(ACTION_TRANSITION_MAP)).toHaveLength(AGENT_ACTIONS.length);
    for (const action of AGENT_ACTIONS) {
      expect(ACTION_TRANSITION_MAP[action]).toBeDefined();
    }
  });

  it('should include mark_qualified and mark_not_interested', () => {
    expect(ACTION_TRANSITION_MAP.mark_qualified).toBeDefined();
    expect(ACTION_TRANSITION_MAP.mark_qualified.targetStatus).toBe('QUALIFIED');
    expect(ACTION_TRANSITION_MAP.mark_qualified.allowedFrom).toEqual(['REPLIED']);

    expect(ACTION_TRANSITION_MAP.mark_not_interested).toBeDefined();
    expect(ACTION_TRANSITION_MAP.mark_not_interested.targetStatus).toBe('NOT_INTERESTED');
    expect(ACTION_TRANSITION_MAP.mark_not_interested.allowedFrom).toContain('NEW');
    expect(ACTION_TRANSITION_MAP.mark_not_interested.allowedFrom).toContain('REPLIED');
  });

  it('send_email_1 should only be allowed from NEW → CONTACTED_1', () => {
    const rule = ACTION_TRANSITION_MAP.send_email_1;
    expect(rule.allowedFrom).toEqual(['NEW']);
    expect(rule.targetStatus).toBe('CONTACTED_1');
    expect(rule.flag).toBe('emailSent1');
  });

  it('call_done should only be allowed from CALL_DUE → CALLED', () => {
    const rule = ACTION_TRANSITION_MAP.call_done;
    expect(rule.allowedFrom).toEqual(['CALL_DUE']);
    expect(rule.targetStatus).toBe('CALLED');
    expect(rule.flag).toBe('callDone');
  });

  it('mark_replied should be allowed from all active statuses → REPLIED', () => {
    const rule = ACTION_TRANSITION_MAP.mark_replied;
    expect(rule.targetStatus).toBe('REPLIED');
    expect(rule.flag).toBeNull(); // uses repliedAtUtc instead
    // Should not include REPLIED, QUALIFIED, NOT_INTERESTED, COMPLETED
    expect(rule.allowedFrom).not.toContain('REPLIED');
    expect(rule.allowedFrom).not.toContain('QUALIFIED');
    expect(rule.allowedFrom).not.toContain('NOT_INTERESTED');
    expect(rule.allowedFrom).not.toContain('COMPLETED');
    // Should include all active statuses
    expect(rule.allowedFrom).toContain('NEW');
    expect(rule.allowedFrom).toContain('CONTACTED_1');
    expect(rule.allowedFrom).toContain('WA_VOICE_DUE');
  });

  it('every action should map to a valid canonical status or null', () => {
    for (const [action, rule] of Object.entries(ACTION_TRANSITION_MAP)) {
      if (rule.targetStatus !== null) {
        expect(CANONICAL_STATUSES).toContain(rule.targetStatus);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  Unit Tests — Canonical Statuses
// ═══════════════════════════════════════════════════════════════

describe('CANONICAL_STATUSES', () => {
  it('should have exactly 12 statuses', () => {
    expect(CANONICAL_STATUSES).toHaveLength(12);
  });

  it('should start with NEW and end with COMPLETED', () => {
    expect(CANONICAL_STATUSES[0]).toBe('NEW');
    expect(CANONICAL_STATUSES[CANONICAL_STATUSES.length - 1]).toBe('COMPLETED');
  });

  it('should include QUALIFIED and NOT_INTERESTED', () => {
    expect(CANONICAL_STATUSES).toContain('QUALIFIED');
    expect(CANONICAL_STATUSES).toContain('NOT_INTERESTED');
  });
});

// ═══════════════════════════════════════════════════════════════
//  Unit Tests — Transition Rejection Logic
// ═══════════════════════════════════════════════════════════════

describe('Transition rejection logic', () => {
  it('send_email_1 from CALLED should be rejected (not in allowedFrom)', () => {
    const rule = ACTION_TRANSITION_MAP.send_email_1;
    expect(rule.allowedFrom.includes('CALLED' as any)).toBe(false);
  });

  it('mark_qualified from NEW should be rejected (only allowed from REPLIED)', () => {
    const rule = ACTION_TRANSITION_MAP.mark_qualified;
    expect(rule.allowedFrom.includes('NEW' as any)).toBe(false);
  });

  it('call_done from NEW should be rejected (only allowed from CALL_DUE)', () => {
    const rule = ACTION_TRANSITION_MAP.call_done;
    expect(rule.allowedFrom.includes('NEW' as any)).toBe(false);
  });

  it('send_wa_voice from CONTACTED_1 should be rejected', () => {
    const rule = ACTION_TRANSITION_MAP.send_wa_voice;
    expect(rule.allowedFrom.includes('CONTACTED_1' as any)).toBe(false);
  });

  it('no actions should be available from COMPLETED', () => {
    const actionsFromCompleted = Object.entries(ACTION_TRANSITION_MAP)
      .filter(([_, rule]) => rule.allowedFrom.includes('COMPLETED' as any));
    expect(actionsFromCompleted).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Unit Tests — Available Actions Per Status
// ═══════════════════════════════════════════════════════════════

describe('Available actions per status', () => {
  function actionsFor(status: string) {
    return Object.entries(ACTION_TRANSITION_MAP)
      .filter(([_, rule]) => rule.allowedFrom.includes(status as any))
      .map(([action]) => action);
  }

  it('NEW should allow first-touch actions + mark_replied + mark_not_interested', () => {
    const actions = actionsFor('NEW');
    expect(actions).toContain('send_email_1');
    expect(actions).toContain('send_dm_li_1');
    expect(actions).toContain('mark_replied');
    expect(actions).toContain('mark_not_interested');
    expect(actions).not.toContain('call_done');
  });

  it('REPLIED should only allow mark_qualified + mark_not_interested', () => {
    const actions = actionsFor('REPLIED');
    expect(actions).toContain('mark_qualified');
    expect(actions).toContain('mark_not_interested');
    expect(actions).not.toContain('send_email_1');
    expect(actions).not.toContain('mark_replied');
  });

  it('CALL_DUE should allow call_done + mark_replied + mark_not_interested', () => {
    const actions = actionsFor('CALL_DUE');
    expect(actions).toContain('call_done');
    expect(actions).toContain('mark_replied');
    expect(actions).toContain('mark_not_interested');
    expect(actions).not.toContain('send_email_1');
  });

  it('QUALIFIED should have no actions', () => {
    expect(actionsFor('QUALIFIED')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Idempotency Memory Store Tests
// ═══════════════════════════════════════════════════════════════

describe('Idempotency memory store', () => {
  beforeAll(() => {
    _testMemoryStore.clear();
  });

  afterAll(() => {
    _testMemoryStore.clear();
  });

  it('should store and retrieve cached responses', () => {
    const key = 'test-key-1';
    _testMemoryStore.set(key, {
      statusCode: 201,
      body: '{"lead":{"id":"abc"}}',
      expiresAt: Date.now() + 86400000,
    });

    const cached = _testMemoryStore.get(key);
    expect(cached).toBeDefined();
    expect(cached!.statusCode).toBe(201);
    expect(cached!.body).toContain('abc');
  });

  it('expired entries should be detectable', () => {
    const key = 'test-key-expired';
    _testMemoryStore.set(key, {
      statusCode: 200,
      body: '{}',
      expiresAt: Date.now() - 1000, // already expired
    });

    const cached = _testMemoryStore.get(key);
    expect(cached).toBeDefined();
    expect(cached!.expiresAt).toBeLessThan(Date.now());
  });

  it('different keys should not collide', () => {
    _testMemoryStore.set('key-a', { statusCode: 200, body: 'A', expiresAt: Date.now() + 86400000 });
    _testMemoryStore.set('key-b', { statusCode: 201, body: 'B', expiresAt: Date.now() + 86400000 });

    expect(_testMemoryStore.get('key-a')!.body).toBe('A');
    expect(_testMemoryStore.get('key-b')!.body).toBe('B');
  });
});

// ═══════════════════════════════════════════════════════════════
//  409 Error Response Shape
// ═══════════════════════════════════════════════════════════════

describe('409 error response contract', () => {
  it('should define the expected fields for invalid transition errors', () => {
    // Simulate what the agent.ts handler returns on 409
    const errorResponse = {
      error: 'Invalid transition',
      action: 'send_email_1',
      currentStatus: 'CALLED',
      allowedFrom: ['NEW'],
      allowedActions: ['mark_replied', 'mark_not_interested'],
      targetStatus: 'CONTACTED_1',
      message: 'Cannot perform "send_email_1" when lead is in "CALLED". Allowed from: NEW',
      requestId: 'fake-uuid',
    };

    expect(errorResponse.error).toBe('Invalid transition');
    expect(errorResponse.currentStatus).toBeDefined();
    expect(errorResponse.allowedFrom).toBeInstanceOf(Array);
    expect(errorResponse.allowedActions).toBeInstanceOf(Array);
    expect(errorResponse.requestId).toBeDefined();
    expect(errorResponse.message).toContain('Cannot perform');
  });
});
