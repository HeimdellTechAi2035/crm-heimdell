import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { leadRoutes } from './routes/leads.js';
import { companyRoutes } from './routes/companies.js';
import { dealRoutes } from './routes/deals.js';
import { activityRoutes } from './routes/activities.js';
import { taskRoutes } from './routes/tasks.js';
import { aiRoutes } from './routes/ai.js';
import { pipelineRoutes } from './routes/pipelines.js';
import { sequenceRoutes } from './routes/sequences.js';
import { dashboardRoutes } from './routes/dashboard.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: config.nodeEnv === 'development',
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Heimdell CRM API',
        description: 'Close-style Sales CRM with AI',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  await fastify.register(websocket);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(leadRoutes, { prefix: '/api/leads' });
  await fastify.register(companyRoutes, { prefix: '/api/companies' });
  await fastify.register(dealRoutes, { prefix: '/api/deals' });
  await fastify.register(activityRoutes, { prefix: '/api/activities' });
  await fastify.register(taskRoutes, { prefix: '/api/tasks' });
  await fastify.register(aiRoutes, { prefix: '/api/ai' });
  await fastify.register(pipelineRoutes, { prefix: '/api/pipelines' });
  await fastify.register(sequenceRoutes, { prefix: '/api/sequences' });
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  
  // Import routes (with multipart support)
  const importsRoutes = (await import('./routes/imports.js')).default;
  await fastify.register(importsRoutes);

  // Enterprise features
  const businessUnitsRoutes = (await import('./routes/business-units.js')).default;
  await fastify.register(businessUnitsRoutes);

  const fieldHistoryRoutes = (await import('./routes/field-history.js')).default;
  await fastify.register(fieldHistoryRoutes);

  const emailIdentitiesRoutes = (await import('./routes/email-identities.js')).default;
  await fastify.register(emailIdentitiesRoutes);

  const dealIntelRoutes = (await import('./routes/deal-intel.js')).default;
  await fastify.register(dealIntelRoutes);

  const forecastingRoutes = (await import('./routes/forecasting.js')).default;
  await fastify.register(forecastingRoutes);

  const knowledgeRoutes = (await import('./routes/knowledge.js')).default;
  await fastify.register(knowledgeRoutes);

  const gdprRoutes = (await import('./routes/gdpr.js')).default;
  await fastify.register(gdprRoutes);

  const healthRoutes = (await import('./routes/health.js')).default;
  await fastify.register(healthRoutes);

  const copilotDailyFocusRoutes = (await import('./routes/copilot-daily-focus.js')).default;
  await fastify.register(copilotDailyFocusRoutes, { prefix: '/api/copilot' });

  const { diagnosticsRoutes } = await import('./modules/diagnostics/diagnostics.controller.js');
  await fastify.register(diagnosticsRoutes, { prefix: '/api/diagnostics' });

  // WebSocket for real-time updates
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      connection.socket.on('message', (message: any) => {
        // Echo back for now - in production, handle subscriptions
        connection.socket.send(message);
      });
    });
  });

  return fastify;
}

