import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { authenticate } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  // Allow username-style logins in DEV (e.g. "admin")
  email: z.string().min(1),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'organizationName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          organizationName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);

      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        return reply.code(400).send({ error: 'Email already registered' });
      }

      const passwordHash = await hashPassword(data.password);

      const org = await prisma.organization.create({
        data: {
          name: data.organizationName,
        },
      });

      const user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'ADMIN',
          organizationId: org.id,
        },
      });

      // Organization is ready — no pipeline models in outreach CRM

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      const refreshToken = fastify.jwt.sign(
        { id: user.id },
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Register error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },  // No email format validation (allows "admin")
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);

      // Hardcoded admin account - always works even without database
      if (data.email === 'andrew@heimdell.tech' && data.password === 'Heimtec2026@!?@') {
        const token = fastify.jwt.sign({
          id: 'admin-hardcoded',
          email: 'andrew@heimdell.tech',
          role: 'ADMIN',
          organizationId: 'default-org',
        });

        const refreshToken = fastify.jwt.sign(
          { id: 'admin-hardcoded' },
          { expiresIn: '7d' }
        );

        return reply.send({
          user: {
            id: 'admin-hardcoded',
            email: 'andrew@heimdell.tech',
            firstName: 'Andrew',
            lastName: 'Heimdell',
            role: 'ADMIN',
            organizationId: 'default-org',
          },
          token,
          refreshToken,
        });
      }

      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await verifyPassword(data.password, user.passwordHash);

      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      const refreshToken = fastify.jwt.sign(
        { id: user.id },
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Login error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    try {
      const data = refreshSchema.parse(request.body);
      
      const decoded = fastify.jwt.verify(data.refreshToken) as { id: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      reply.send({ token });
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    // Handle hardcoded admin user that doesn't exist in DB
    if (userId === 'admin-hardcoded') {
      return reply.send({
        user: {
          id: 'admin-hardcoded',
          email: 'andrew@heimdell.tech',
          firstName: 'Andrew',
          lastName: 'Heimdell',
          role: 'ADMIN',
          organizationId: 'default-org',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    reply.send({ user });
  });

  // Logout (client handles token removal)
  fastify.post('/logout', {
    preHandler: authenticate,
  }, async (request, reply) => {
    reply.send({ success: true });
  });
}


