/**
 * Heimdell CRM — API Key Authentication Middleware
 *
 * Authenticates OpenClaw agent requests via `Authorization: Bearer hmdl_xxxxx`.
 * Looks up the hashed key, verifies the org, attaches context to the request.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createHash } from 'crypto';

// ─── Types ──────────────────────────────────────────────────

export interface AgentContext {
  apiKeyId: string;
  keyName: string;
  organizationId: string;
  permissions: string[];
  actor: string; // "agent:<keyName>"
}

declare module 'fastify' {
  interface FastifyRequest {
    agent?: AgentContext;
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Hash a raw API key to match against stored keyHash */
function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Generate a new API key: returns { raw, hash, prefix } */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let random = '';
  for (let i = 0; i < 40; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  const raw = `hmdl_${random}`;
  const prefix = raw.substring(0, 13); // "hmdl_" + 8 chars
  const hash = hashApiKey(raw);
  return { raw, hash, prefix };
}

// ─── Middleware ──────────────────────────────────────────────

/**
 * Authenticate agent requests via API key.
 * Expects: Authorization: Bearer hmdl_xxxxx
 *
 * Attaches `request.agent` on success.
 */
export async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer hmdl_')) {
    return reply.code(401).send({ error: 'Missing or invalid API key' });
  }

  const rawKey = authHeader.substring(7); // Remove "Bearer "
  const keyHash = hashApiKey(rawKey);

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey || !apiKey.isActive) {
      return reply.code(401).send({ error: 'Invalid or inactive API key' });
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {}); // non-blocking

    request.agent = {
      apiKeyId: apiKey.id,
      keyName: apiKey.name,
      organizationId: apiKey.organizationId,
      permissions: apiKey.permissions,
      actor: `agent:${apiKey.name}`,
    };
  } catch (error) {
    console.error('[agent-auth] Error:', error);
    return reply.code(500).send({ error: 'Auth check failed' });
  }
}

/**
 * Permission check factory for agent routes.
 * Usage: requirePermission('transition', 'update')
 */
export function requirePermission(...requiredPerms: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.agent) {
      return reply.code(401).send({ error: 'Agent context missing' });
    }

    const missing = requiredPerms.filter((p) => !request.agent!.permissions.includes(p));
    if (missing.length > 0) {
      return reply.code(403).send({
        error: `Insufficient permissions. Missing: ${missing.join(', ')}`,
      });
    }
  };
}
