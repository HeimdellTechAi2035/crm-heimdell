import { config } from './config.js';
import { buildApp } from './app.js';
import { startSequenceWorker } from './jobs/sequence.js';
import { startDigestWorker, scheduleDailyDigests } from './jobs/digest.js';
import { importWorker } from './jobs/import.js';

async function start() {
  try {
    const app = await buildApp();

    // Start background workers (uses in-memory queue if Redis disabled)
    if (config.features.redis) {
      console.log('📊 Starting background workers with Redis...');
    } else {
      console.log('📊 Starting background workers (in-memory mode, no Redis)...');
    }
    
    startSequenceWorker();
    startDigestWorker();
    console.log('✅ Background workers ready');

    // Schedule daily digests (only in production)
    if (config.nodeEnv === 'production') {
      await scheduleDailyDigests();
    }

    await app.listen({ port: config.port, host: '0.0.0.0' });

    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           🏠 Heimdell CRM API Server                  ║
║                                                       ║
║   Server:    http://localhost:${config.port}                   ║
║   API Docs:  http://localhost:${config.port}/docs             ║
║   WebSocket: ws://localhost:${config.port}/ws                 ║
║                                                       ║
║   Environment: ${config.nodeEnv.toUpperCase().padEnd(37)}    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

