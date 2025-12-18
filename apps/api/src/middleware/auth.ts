import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    // Type assertion since JWT adds user property
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (roles.length > 0 && !roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

// Alias for backward compatibility
export const requireRole = authorize;

// Register authenticate decorator
export function registerAuthDecorator(app: any) {
  app.decorate('authenticate', authenticate);
}

