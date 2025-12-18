import {
  CheckExecutionContext,
  CheckExecutionResult,
} from '../diagnostics.schemas.js';

export async function runInfrastructureChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  // Check 1: Redis connectivity
  results.push(await checkRedisConnectivity(context));

  // Check 2: WebSocket endpoint
  results.push(await checkWebSocketEndpoint(context));

  // Check 3: Queue system (only in full mode)
  if (context.mode === 'full') {
    results.push(await checkQueueSystem(context));
  }

  return results;
}

async function checkRedisConnectivity(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    const { redis } = await import('../../../lib/redis.js');
    
    if (!redis) {
      return {
        category: 'redis',
        checkName: 'redis_connectivity',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: {
          configured: false,
        },
        recommendation: 'Redis is not configured. Caching and background jobs will not work',
        evidence: 'Redis client not available',
      };
    }
    
    // Test ping
    const pong = await redis.ping();
    
    if (pong !== 'PONG') {
      throw new Error('Redis ping did not return PONG');
    }
    
    // Test set/get
    const testKey = `diagnostics:test:${context.runId}`;
    await redis.set(testKey, 'test-value', 'EX', 10);
    const getValue = await redis.get(testKey);
    await redis.del(testKey);
    
    if (getValue !== 'test-value') {
      throw new Error('Redis set/get test failed');
    }
    
    return {
      category: 'redis',
      checkName: 'redis_connectivity',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        connected: true,
        pingSuccessful: true,
        setGetSuccessful: true,
      },
      evidence: 'Redis is connected and operational',
    };
  } catch (error: any) {
    return {
      category: 'redis',
      checkName: 'redis_connectivity',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        connected: false,
        error: error.message,
      },
      recommendation: 'Check REDIS_URL environment variable and ensure Redis server is running',
      evidence: `Redis connection failed: ${error.message}`,
    };
  }
}

async function checkWebSocketEndpoint(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // WebSocket checks would require actual WS connection in real implementation
    // For now, just verify configuration
    
    const wsConfigured = process.env.WS_PORT || process.env.PORT;
    
    if (!wsConfigured) {
      return {
        category: 'websocket',
        checkName: 'websocket_endpoint',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: {
          configured: false,
        },
        recommendation: 'WebSocket port not configured',
        evidence: 'WebSocket configuration missing',
      };
    }
    
    return {
      category: 'websocket',
      checkName: 'websocket_endpoint',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        configured: true,
        port: wsConfigured,
      },
      evidence: 'WebSocket endpoint is configured',
    };
  } catch (error: any) {
    return {
      category: 'websocket',
      checkName: 'websocket_endpoint',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to verify WebSocket configuration',
      evidence: `Error: ${error.message}`,
    };
  }
}

async function checkQueueSystem(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if queue system is configured
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      return {
        category: 'queue',
        checkName: 'queue_system',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: {
          configured: false,
        },
        recommendation: 'BullMQ requires Redis. Set REDIS_URL environment variable',
        evidence: 'Queue system not configured (Redis URL missing)',
      };
    }
    
    // In test mode, try to enqueue a test job
    if (context.testMode) {
      // Import queue module (would need to create this)
      // For now, just verify configuration
      
      return {
        category: 'queue',
        checkName: 'queue_system',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: {
          configured: true,
          testMode: true,
        },
        evidence: 'Queue system is configured',
      };
    }
    
    return {
      category: 'queue',
      checkName: 'queue_system',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        configured: true,
        redisConfigured: true,
      },
      evidence: 'Queue system configuration looks good',
    };
  } catch (error: any) {
    return {
      category: 'queue',
      checkName: 'queue_system',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Check BullMQ and Redis configuration',
      evidence: `Queue system check failed: ${error.message}`,
    };
  }
}

export async function runStorageChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  // Check: File storage configuration
  results.push(await checkStorageConfiguration(context));

  return results;
}

async function checkStorageConfiguration(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    const storageType = process.env.STORAGE_TYPE || 'local';
    
    const details: Record<string, any> = {
      type: storageType,
    };
    
    if (storageType === 's3') {
      const s3Bucket = process.env.S3_BUCKET;
      const s3Region = process.env.S3_REGION;
      const s3Configured = !!(s3Bucket && s3Region);
      
      details.s3Bucket = s3Bucket;
      details.s3Region = s3Region;
      details.configured = s3Configured;
      
      if (!s3Configured) {
        return {
          category: 'storage',
          checkName: 'storage_configuration',
          status: 'fail',
          durationMs: Date.now() - startTime,
          details,
          recommendation: 'Set S3_BUCKET and S3_REGION environment variables',
          evidence: 'S3 storage is configured but missing required settings',
        };
      }
    } else if (storageType === 'local') {
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      details.uploadDir = uploadDir;
    }
    
    return {
      category: 'storage',
      checkName: 'storage_configuration',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details,
      evidence: `Storage configured as ${storageType}`,
    };
  } catch (error: any) {
    return {
      category: 'storage',
      checkName: 'storage_configuration',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to verify storage configuration',
      evidence: `Error: ${error.message}`,
    };
  }
}
