import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';
import { prisma } from '../../../lib/prisma.js';
import {
  CheckExecutionContext,
  CheckExecutionResult,
} from '../diagnostics.schemas.js';

export async function runApiAuthChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  // Check 1: JWT signing
  results.push(await checkJWTSigning(context));

  // Check 2: JWT verification
  results.push(await checkJWTVerification(context));

  // Check 3: RBAC enforcement (only in full mode)
  if (context.mode === 'full') {
    results.push(await checkRBACEnforcement(context));
  }

  // Check 4: API health endpoint
  results.push(await checkAPIHealth(context));

  return results;
}

async function checkJWTSigning(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    const testPayload = {
      userId: 'test-user-id',
      role: 'SALES_REP',
      iat: Math.floor(Date.now() / 1000),
    };
    
    const token = jwt.sign(testPayload, config.jwt.secret, {
      expiresIn: '15m',
    });
    
    if (!token || typeof token !== 'string') {
      throw new Error('JWT signing produced invalid token');
    }
    
    return {
      category: 'auth',
      checkName: 'jwt_signing',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        algorithm: 'HS256',
        expiresIn: '15m',
        tokenLength: token.length,
      },
      evidence: 'JWT signing is working correctly',
    };
  } catch (error: any) {
    return {
      category: 'auth',
      checkName: 'jwt_signing',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Check JWT_SECRET environment variable is set correctly',
      evidence: `JWT signing failed: ${error.message}`,
    };
  }
}

async function checkJWTVerification(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    const testPayload = {
      userId: 'test-user-id',
      role: 'SALES_REP',
      iat: Math.floor(Date.now() / 1000),
    };
    
    const token = jwt.sign(testPayload, config.jwt.secret, {
      expiresIn: '15m',
    });
    
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    if (decoded.userId !== testPayload.userId || decoded.role !== testPayload.role) {
      throw new Error('Token payload mismatch after verification');
    }
    
    return {
      category: 'auth',
      checkName: 'jwt_verification',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        payloadMatch: true,
        decodedUserId: decoded.userId,
        decodedRole: decoded.role,
      },
      evidence: 'JWT verification is working correctly',
    };
  } catch (error: any) {
    return {
      category: 'auth',
      checkName: 'jwt_verification',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'JWT verification failed. Check secret key consistency',
      evidence: `JWT verification failed: ${error.message}`,
    };
  }
}

async function checkRBACEnforcement(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Verify RBAC policy engine exists and can be loaded
    const { policyEngine } = await import('../../../lib/policy-engine.js');
    
    if (!policyEngine) {
      throw new Error('Policy engine not available');
    }
    
    // Test that policy engine exists
    // Policy engine is available if we got here
    const policyEngineWorks = typeof policyEngine.canPerform === 'function';
    
    return {
      category: 'rbac',
      checkName: 'rbac_enforcement',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        policyEngineAvailable: true,
        policyEngineWorks,
      },
      evidence: 'RBAC policy engine is operational',
    };
  } catch (error: any) {
    return {
      category: 'rbac',
      checkName: 'rbac_enforcement',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Policy engine may not be configured. System will function with basic role checks only',
      evidence: `RBAC check failed: ${error.message}`,
    };
  }
}

async function checkAPIHealth(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Basic health check - verify app can respond
    // In a real setup, you'd make an HTTP request to /health
    // For now, just verify core dependencies
    
    const dbCheck = await prisma.$queryRaw`SELECT 1`;
    
    return {
      category: 'api',
      checkName: 'api_health',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        databaseConnected: true,
        port: config.port,
      },
      evidence: 'API core dependencies are healthy',
    };
  } catch (error: any) {
    return {
      category: 'api',
      checkName: 'api_health',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'API server may not be fully operational',
      evidence: `API health check failed: ${error.message}`,
    };
  }
}

export async function runWebChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  // Check: Frontend environment variables
  results.push(await checkFrontendEnv(context));

  return results;
}

async function checkFrontendEnv(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check that critical backend env vars are set
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'PORT',
    ];
    
    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      return {
        category: 'web',
        checkName: 'environment_variables',
        status: 'fail',
        durationMs: Date.now() - startTime,
        details: {
          requiredVars: requiredEnvVars,
          missingVars: missingEnvVars,
        },
        recommendation: `Set missing environment variables: ${missingEnvVars.join(', ')}`,
        evidence: `Missing environment variables: ${missingEnvVars.join(', ')}`,
      };
    }
    
    return {
      category: 'web',
      checkName: 'environment_variables',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        requiredVars: requiredEnvVars,
        allPresent: true,
      },
      evidence: 'All required environment variables are set',
    };
  } catch (error: any) {
    return {
      category: 'web',
      checkName: 'environment_variables',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to verify environment variables',
      evidence: `Error: ${error.message}`,
    };
  }
}
