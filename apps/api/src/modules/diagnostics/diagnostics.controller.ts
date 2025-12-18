import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { diagnosticsService } from './diagnostics.service.js';
import { requireAdmin, requireAdminOnly } from './diagnostics.permissions.js';
import {
  StartDiagnosticsRunSchema,
  CheckModeSchema,
} from './diagnostics.schemas.js';

export async function diagnosticsRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/diagnostics/runs
   * Start a new diagnostics run
   */
  fastify.post(
    '/runs',
    {
      preHandler: requireAdminOnly,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { mode, testMode } = request.body as { mode: any; testMode?: boolean };
      const user = (request as any).user;

      const run = await diagnosticsService.startRun(
        user.organizationId,
        user.id,
        mode,
        testMode || false
      );

      return reply.code(200).send({
        id: run.id,
        mode: run.mode,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
      });
    }
  );

  /**
   * GET /api/diagnostics/runs
   * Get all diagnostics runs for organization
   */
  fastify.get(
    '/runs',
    {
      preHandler: requireAdmin,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const user = (request as any).user;
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit) : 10;

      const runs = await diagnosticsService.getRuns(user.organizationId, limit);

      return reply.code(200).send({
        runs: runs.map((run: any) => ({
          id: run.id,
          mode: run.mode,
          status: run.status,
          summary: run.summaryJson,
          createdAt: run.createdAt.toISOString(),
          user: {
            id: run.user.id,
            name: run.user.name,
            email: run.user.email,
          },
        })),
      });
    }
  );

  /**
   * GET /api/diagnostics/runs/:id
   * Get a specific diagnostics run
   */
  fastify.get(
    '/runs/:id',
    {
      preHandler: requireAdmin,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };

      const run = await diagnosticsService.getRun(id);

      if (!run) {
        return reply.code(404).send({
          error: 'Diagnostics run not found',
        });
      }

      return reply.code(200).send({
        id: run.id,
        mode: run.mode,
        status: run.status,
        summary: run.summaryJson,
        createdAt: run.createdAt.toISOString(),
        organization: {
          id: run.organization.id,
          name: run.organization.name,
        },
        user: {
          id: run.user.id,
          name: run.user.name,
          email: run.user.email,
        },
      });
    }
  );

  /**
   * GET /api/diagnostics/runs/:id/results
   * Get results for a specific diagnostics run
   */
  fastify.get(
    '/runs/:id/results',
    {
      preHandler: requireAdmin,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };

      const results = await diagnosticsService.getResults(id);

      return reply.code(200).send({
        results: results.map((result: any) => ({
          id: result.id,
          category: result.category,
          checkName: result.checkName,
          status: result.status,
          durationMs: result.durationMs,
          details: result.detailsJson,
          recommendation: result.recommendation,
          evidence: result.evidence,
          createdAt: result.createdAt.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /api/diagnostics/runs/:id/retry-failed
   * Retry only failed checks from a run
   */
  fastify.post(
    '/runs/:id/retry-failed',
    {
      preHandler: requireAdminOnly,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;

      try {
        const run = await diagnosticsService.retryFailedChecks(
          id,
          user.organizationId,
          user.id
        );

        return reply.code(200).send({
          id: run.id,
          mode: run.mode,
          status: run.status,
          createdAt: run.createdAt.toISOString(),
        });
      } catch (error: any) {
        return reply.code(400).send({
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /api/diagnostics/checks/:checkName/run
   * Run a single check by name
   */
  fastify.post(
    '/checks/:checkName/run',
    {
      preHandler: requireAdminOnly,
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { checkName } = request.params as { checkName: string };
      const { testMode } = request.body as { testMode?: boolean };
      const user = (request as any).user;

      const run = await diagnosticsService.runSingleCheck(
        checkName,
        user.organizationId,
        user.id,
        testMode || false
      );

      return reply.code(200).send({
        id: run.id,
        mode: run.mode,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
      });
    }
  );

  /**
   * GET /api/diagnostics/health
   * Quick health check endpoint (no auth required)
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
}
