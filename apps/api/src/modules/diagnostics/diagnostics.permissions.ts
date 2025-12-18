import { FastifyRequest } from 'fastify';

export function requireAdmin(request: FastifyRequest) {
  const user = (request as any).user;
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Admin or Manager role required for diagnostics');
  }
  
  return user;
}

export function requireAdminOnly(request: FastifyRequest) {
  const user = (request as any).user;
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (user.role !== 'ADMIN') {
    throw new Error('Admin role required');
  }
  
  return user;
}
