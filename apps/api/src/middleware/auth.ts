import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  organizationId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Authentication middleware — verifies JWT and attaches user to request.
 * Used as a preHandler on protected routes.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<AuthenticatedUser>();
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

/**
 * Authorization middleware factory — checks user role.
 * Usage: authorize('ADMIN', 'MANAGER')
 */
export function authorize(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // authenticate must run first
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden — insufficient permissions' });
    }
  };
}
