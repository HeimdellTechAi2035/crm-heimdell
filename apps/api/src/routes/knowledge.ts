import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
}

export default async function knowledgeBaseRoutes(app: FastifyInstance) {
  // Search knowledge articles
  app.get('/api/knowledge/articles', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { search, businessUnitId, isPublished } = request.query as any;

    const where: any = {
      organizationId: user.organizationId
    };

    if (businessUnitId) {
      where.businessUnitId = businessUnitId;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished === 'true';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ];
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return { articles };
  });

  // Get single article
  app.get<{ Params: { id: string } }>('/api/knowledge/articles/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    const article = await prisma.knowledgeArticle.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!article) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    return { article };
  });

  // Create article (ADMIN/MANAGER only)
  app.post('/api/knowledge/articles', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const data = request.body as any;

    const article = await prisma.knowledgeArticle.create({
      data: {
        organizationId: user.organizationId,
        businessUnitId: data.businessUnitId,
        title: data.title,
        body: data.body,
        tags: data.tags || [],
        visibility: data.visibility || 'internal',
        isPublished: data.isPublished || false
      }
    });

    return { article };
  });

  // Update article
  app.patch<{ Params: { id: string } }>('/api/knowledge/articles/:id', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;
    const data = request.body as any;

    const article = await prisma.knowledgeArticle.findFirst({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    if (!article) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data
    });

    return { article: updated };
  });

  // Delete article
  app.delete<{ Params: { id: string } }>('/api/knowledge/articles/:id', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { id } = request.params;

    await prisma.knowledgeArticle.deleteMany({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    return { success: true };
  });

  // Get stage playbook
  app.get<{
    Querystring: { pipelineId: string; stageId: string }
  }>('/api/knowledge/playbooks', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { pipelineId, stageId } = request.query;

    const playbook = await prisma.stagePlaybook.findFirst({
      where: {
        organizationId: user.organizationId,
        pipelineId,
        stageId
      }
    });

    return { playbook: playbook || null };
  });

  // Create/update stage playbook
  app.put<{
    Querystring: { pipelineId: string; stageId: string }
  }>('/api/knowledge/playbooks', {
    preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
  }, async (request, reply) => {
    const user = request.user as AuthenticatedUser;
    const { pipelineId, stageId } = request.query;
    const data = request.body as any;

    const playbook = await prisma.stagePlaybook.upsert({
      where: {
        organizationId_pipelineId_stageId: {
          organizationId: user.organizationId,
          pipelineId,
          stageId
        }
      },
      create: {
        organizationId: user.organizationId,
        businessUnitId: data.businessUnitId,
        pipelineId,
        stageId,
        checklistItems: data.checklistItems || [],
        qualifyingQuestions: data.qualifyingQuestions,
        objectionsResponses: data.objectionsResponses,
        approvedTemplates: data.approvedTemplates
      },
      update: data
    });

    return { playbook };
  });
}
