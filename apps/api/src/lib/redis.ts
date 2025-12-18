import { config } from '../config.js';

// Mock Redis client for when Redis is disabled
const mockRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  keys: async () => [],
  quit: async () => 'OK',
  on: () => {},
  connect: async () => {},
} as any;

let redisClient: any = null;

if (config.features.redis) {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    redisClient.on('error', (err: any) => {
      console.warn('⚠️  Redis error:', err.message);
    });

    // Try to connect
    redisClient.connect().catch(() => {
      console.warn('⚠️  Redis connection failed - falling back to mock');
      redisClient = mockRedis;
    });
  } catch (err) {
    console.warn('⚠️  Redis initialization failed - using mock client');
    redisClient = mockRedis;
  }
} else {
  console.log('ℹ️  Redis disabled - using mock client');
  redisClient = mockRedis;
}

export const redis = redisClient;

