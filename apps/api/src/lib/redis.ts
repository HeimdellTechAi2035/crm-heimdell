import Redis from 'ioredis';
import { config } from '../config.js';

let redis: Redis | null = null;

try {
  if (config.features.redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });
  }
} catch (err) {
  console.warn('Redis not available:', (err as Error).message);
  redis = null;
}

export { redis };
