/**
 * Heimdell CRM — Idempotency Middleware
 *
 * Supports `Idempotency-Key` header on mutating agent requests.
 * Uses Redis (if available) or in-memory Map with TTL for 24h dedup.
 *
 * Flow:
 *   1. Extract Idempotency-Key header
 *   2. If key exists in store → return cached response immediately
 *   3. Otherwise, execute handler, store response, return
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from './redis.js';
import { createHash } from 'crypto';

const TTL_SECONDS = 86400; // 24 hours

// ─── In-memory fallback when Redis is unavailable ────────────

interface CachedResponse {
  statusCode: number;
  body: string;
  expiresAt: number;
}

const memoryStore = new Map<string, CachedResponse>();

// Periodically clean expired entries (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of memoryStore) {
    if (val.expiresAt < now) memoryStore.delete(key);
  }
}, 600_000).unref();

// ─── Store Operations ────────────────────────────────────────

async function getIdempotencyResult(key: string): Promise<CachedResponse | null> {
  if (redis) {
    try {
      const raw = await redis.get(`idem:${key}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback to memory
    }
  }
  const entry = memoryStore.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry;
  if (entry) memoryStore.delete(key);
  return null;
}

async function setIdempotencyResult(key: string, statusCode: number, body: string): Promise<void> {
  const entry: CachedResponse = { statusCode, body, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  if (redis) {
    try {
      await redis.set(`idem:${key}`, JSON.stringify(entry), 'EX', TTL_SECONDS);
      return;
    } catch {
      // fallback to memory
    }
  }
  memoryStore.set(key, entry);
}

// ─── Fastify Hook ────────────────────────────────────────────

/**
 * Create an idempotency preHandler hook for Fastify.
 * Add to any mutating route: { preHandler: [authenticateAgent, idempotencyCheck] }
 *
 * If the Idempotency-Key header is present and matches a stored response,
 * the cached response is returned immediately with X-Idempotent-Replayed: true.
 *
 * If no header is present, request proceeds normally (idempotency is opt-in).
 */
export async function idempotencyCheck(request: FastifyRequest, reply: FastifyReply) {
  const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
  if (!idempotencyKey) return; // Opt-in — no key means normal processing

  // Namespace key by agent org to prevent cross-org collisions
  const orgId = request.agent?.organizationId ?? 'unknown';
  const compositeKey = createHash('sha256')
    .update(`${orgId}:${idempotencyKey}`)
    .digest('hex');

  const cached = await getIdempotencyResult(compositeKey);
  if (cached) {
    reply
      .code(cached.statusCode)
      .header('X-Idempotent-Replayed', 'true')
      .header('Content-Type', 'application/json')
      .send(cached.body);
    return;
  }

  // Store the composite key for post-serialization hook
  (request as any)._idempotencyCompositeKey = compositeKey;
}

/**
 * onSend hook to capture and store response for idempotency replay.
 * Register this at the plugin level: app.addHook('onSend', idempotencyStore)
 */
export async function idempotencyStore(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: string,
): Promise<string> {
  const compositeKey = (request as any)._idempotencyCompositeKey as string | undefined;
  if (!compositeKey) return payload;

  // Only cache successful responses (2xx)
  if (reply.statusCode >= 200 && reply.statusCode < 300) {
    await setIdempotencyResult(compositeKey, reply.statusCode, payload);
  }

  return payload;
}

export { memoryStore as _testMemoryStore };
