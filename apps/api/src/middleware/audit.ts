import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function auditLog(
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  organizationId: string,
  changes?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        organizationId,
        changes,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export function auditMiddleware(entityType: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const originalSend = reply.send.bind(reply);
    
    reply.send = function (payload: any) {
      if (reply.statusCode >= 200 && reply.statusCode < 300 && request.user) {
        const action = request.method === 'POST' ? 'created' : 
                      request.method === 'PUT' || request.method === 'PATCH' ? 'updated' : 
                      request.method === 'DELETE' ? 'deleted' : 'accessed';
        
        const entityId = (request.params as any)?.id || payload?.id;
        
        if (entityId && action !== 'accessed') {
          auditLog(
            action,
            entityType,
            entityId,
            (request.user as any).id,
            (request.user as any).organizationId,
            request.body
          ).catch(console.error);
        }
      }
      
      return originalSend(payload);
    };
  };
}

