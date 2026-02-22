import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from './config.js';

// Phase 1 routes
import { authRoutes } from './routes/auth.js';
import { leadRoutes } from './routes/leads.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { integrationRoutes } from './routes/integrations.js';

// Phase 2 routes
import { agentRoutes, apiKeyRoutes } from './routes/agent.js';

// Phase 3 routes
import { emailRoutes } from './routes/email.js';

// Phase 2+ routes (commented out — old CRM models removed from schema)
// import { companyRoutes } from './routes/companies.js';
// import { dealRoutes } from './routes/deals.js';
// import { activityRoutes } from './routes/activities.js';
// import { taskRoutes } from './routes/tasks.js';
// import { sequenceRoutes } from './routes/sequences.js';
// import { aiRoutes } from './routes/ai.js';
// import { dashboardRoutes } from './routes/dashboard.js';
// import businessUnitsRoutes from './routes/business-units.js';
// import copilotDailyFocusRoutes from './routes/copilot-daily-focus.js';
// import dealIntelRoutes from './routes/deal-intel.js';
// import emailIdentitiesRoutes from './routes/email-identities.js';
// import fieldHistoryRoutes from './routes/field-history.js';
// import forecastingRoutes from './routes/forecasting.js';
// import gdprRoutes from './routes/gdpr.js';
// import healthRoutes from './routes/health.js';
// import importsRoutes from './routes/imports.js';
// import knowledgeBaseRoutes from './routes/knowledge.js';
// import { diagnosticsRoutes } from './modules/diagnostics/diagnostics.controller.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ─── Plugins ──────────────────────────────────────────

  await app.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.accessExpiresIn,
    },
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  // ─── Routes ───────────────────────────────────────────

  // Phase 1: Auth, Leads, Pipeline, Integrations
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(leadRoutes, { prefix: '/api/leads' });
  await app.register(pipelineRoutes, { prefix: '/api/pipeline' });
  await app.register(integrationRoutes, { prefix: '/api/integrations' });

  // Phase 2: Agent API (API key auth) + Key Management (JWT auth)
  await app.register(agentRoutes, { prefix: '/api/agent' });
  await app.register(apiKeyRoutes, { prefix: '/api/api-keys' });

  // Phase 3: Direct SMTP Email
  await app.register(emailRoutes, { prefix: '/api/integrations/email' });

  // Phase 2+ routes (disabled until schema models are rebuilt)
  // await app.register(companyRoutes, { prefix: '/api/companies' });
  // await app.register(dealRoutes, { prefix: '/api/deals' });
  // await app.register(activityRoutes, { prefix: '/api/activities' });
  // await app.register(taskRoutes, { prefix: '/api/tasks' });
  // await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  // await app.register(sequenceRoutes, { prefix: '/api/sequences' });
  // await app.register(aiRoutes, { prefix: '/api/ai' });
  // await app.register(businessUnitsRoutes, { prefix: '/api/business-units' });
  // await app.register(diagnosticsRoutes, { prefix: '/api/diagnostics' });

  // ─── Health check root ────────────────────────────────

  app.get('/api/ping', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ─── Serve frontend static files in production ────────

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistPath = path.resolve(__dirname, '../../web/dist');

  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: any non-API route serves index.html
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

// ─── Start ────────────────────────────────────────────────

async function start() {
  try {
    const app = await buildServer();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`\n🚀 Heimdell CRM API running at http://localhost:${config.port}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   AI features: ${config.features.ai ? 'enabled' : 'disabled (no OPENAI_API_KEY)'}`);
    console.log(`   Database: ${config.features.database ? 'enabled' : 'disabled'}`);
    console.log('');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { buildServer };
