import { prisma } from '../../../lib/prisma.js';
import {
  CheckExecutionContext,
  CheckExecutionResult,
  CheckResultStatus,
} from '../diagnostics.schemas.js';

export async function runDatabaseChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  // Check 1: Database connectivity
  results.push(await checkDatabaseConnectivity(context));

  // Check 2: Tables exist
  results.push(await checkRequiredTables(context));

  // Check 3: Indexes exist
  results.push(await checkCriticalIndexes(context));

  // Check 4: Query latency
  results.push(await checkQueryLatency(context));

  // Check 5: Migrations status (only in full mode)
  if (context.mode === 'full') {
    results.push(await checkMigrationsStatus(context));
  }

  return results;
}

async function checkDatabaseConnectivity(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      category: 'database',
      checkName: 'database_connectivity',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        connected: true,
        provider: 'postgresql',
      },
      evidence: 'Successfully connected to PostgreSQL database',
    };
  } catch (error: any) {
    return {
      category: 'database',
      checkName: 'database_connectivity',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        connected: false,
        error: error.message,
      },
      recommendation: 'Check DATABASE_URL environment variable and ensure PostgreSQL is running',
      evidence: `Connection error: ${error.message}`,
    };
  }
}

async function checkRequiredTables(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  const requiredTables = [
    'users',
    'organizations',
    'leads',
    'companies',
    'deals',
    'activities',
    'tasks',
    'pipelines',
    'sequences',
    'email_templates',
    'import_jobs',
    'business_units',
    'system_check_runs',
    'system_check_results',
  ];

  try {
    const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    const existingTables = new Set(result.map((r) => r.tablename));
    const missingTables = requiredTables.filter((t) => !existingTables.has(t));
    
    if (missingTables.length === 0) {
      return {
        category: 'database',
        checkName: 'required_tables',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: {
          checkedTables: requiredTables.length,
          existingTables: existingTables.size,
          missingTables: [],
        },
        evidence: `All ${requiredTables.length} required tables exist`,
      };
    } else {
      return {
        category: 'database',
        checkName: 'required_tables',
        status: 'fail',
        durationMs: Date.now() - startTime,
        details: {
          checkedTables: requiredTables.length,
          existingTables: existingTables.size,
          missingTables,
        },
        recommendation: 'Run: pnpm prisma migrate deploy',
        evidence: `Missing tables: ${missingTables.join(', ')}`,
      };
    }
  } catch (error: any) {
    return {
      category: 'database',
      checkName: 'required_tables',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Check database permissions and schema access',
      evidence: `Error checking tables: ${error.message}`,
    };
  }
}

async function checkCriticalIndexes(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  const criticalIndexes = [
    { table: 'leads', column: 'email' },
    { table: 'leads', column: 'organization_id' },
    { table: 'companies', column: 'domain' },
    { table: 'companies', column: 'organization_id' },
    { table: 'deals', column: 'pipeline_id' },
    { table: 'activities', column: 'lead_id' },
    { table: 'tasks', column: 'assigned_to_id' },
  ];

  try {
    const result = await prisma.$queryRaw<Array<{ tablename: string; indexname: string; indexdef: string }>>`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    
    const existingIndexes = result.map((r) => ({
      table: r.tablename,
      def: r.indexdef.toLowerCase(),
    }));
    
    const missingIndexes: string[] = [];
    
    for (const idx of criticalIndexes) {
      const hasIndex = existingIndexes.some(
        (ei) => ei.table === idx.table && ei.def.includes(idx.column)
      );
      
      if (!hasIndex) {
        missingIndexes.push(`${idx.table}.${idx.column}`);
      }
    }
    
    if (missingIndexes.length === 0) {
      return {
        category: 'database',
        checkName: 'critical_indexes',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: {
          checkedIndexes: criticalIndexes.length,
          missingIndexes: [],
        },
        evidence: `All ${criticalIndexes.length} critical indexes exist`,
      };
    } else {
      return {
        category: 'database',
        checkName: 'critical_indexes',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: {
          checkedIndexes: criticalIndexes.length,
          missingIndexes,
        },
        recommendation: 'Consider adding indexes for better query performance',
        evidence: `Missing indexes on: ${missingIndexes.join(', ')}`,
      };
    }
  } catch (error: any) {
    return {
      category: 'database',
      checkName: 'critical_indexes',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to verify indexes, but system may still function',
      evidence: `Error checking indexes: ${error.message}`,
    };
  }
}

async function checkQueryLatency(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Test a simple count query
    const countStart = Date.now();
    await prisma.user.count();
    const countLatency = Date.now() - countStart;
    
    // Test a join query
    const joinStart = Date.now();
    await prisma.lead.findFirst({
      include: { company: true, owner: true },
    });
    const joinLatency = Date.now() - joinStart;
    
    const avgLatency = (countLatency + joinLatency) / 2;
    
    let status: CheckResultStatus = 'pass';
    let recommendation: string | undefined;
    
    if (avgLatency > 500) {
      status = 'fail';
      recommendation = 'Database queries are very slow. Check database server resources and network latency';
    } else if (avgLatency > 200) {
      status = 'warn';
      recommendation = 'Database queries are slower than expected. Consider optimizing or scaling database';
    }
    
    return {
      category: 'database',
      checkName: 'query_latency',
      status,
      durationMs: Date.now() - startTime,
      details: {
        countQueryMs: countLatency,
        joinQueryMs: joinLatency,
        averageMs: avgLatency,
      },
      recommendation,
      evidence: `Average query latency: ${avgLatency}ms (count: ${countLatency}ms, join: ${joinLatency}ms)`,
    };
  } catch (error: any) {
    return {
      category: 'database',
      checkName: 'query_latency',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to measure query latency',
      evidence: `Error: ${error.message}`,
    };
  }
}

async function checkMigrationsStatus(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if _prisma_migrations table exists
    const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
    `;
    
    if (result.length === 0) {
      return {
        category: 'migrations',
        checkName: 'migrations_status',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: {
          migrationsTableExists: false,
        },
        recommendation: 'Run: pnpm prisma migrate deploy',
        evidence: 'Migrations table does not exist. Database may not be initialized.',
      };
    }
    
    // Get applied migrations
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC
    `;
    
    const appliedMigrations = migrations.filter((m) => m.finished_at && !m.rolled_back_at);
    const failedMigrations = migrations.filter((m) => !m.finished_at || m.rolled_back_at);
    
    if (failedMigrations.length > 0) {
      return {
        category: 'migrations',
        checkName: 'migrations_status',
        status: 'fail',
        durationMs: Date.now() - startTime,
        details: {
          appliedMigrations: appliedMigrations.length,
          failedMigrations: failedMigrations.map((m) => m.migration_name),
        },
        recommendation: 'Fix failed migrations: pnpm prisma migrate resolve --rolled-back <migration_name>',
        evidence: `${failedMigrations.length} failed migrations detected`,
      };
    }
    
    return {
      category: 'migrations',
      checkName: 'migrations_status',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: {
        appliedMigrations: appliedMigrations.length,
        latestMigration: appliedMigrations[0]?.migration_name || 'none',
      },
      evidence: `${appliedMigrations.length} migrations applied successfully`,
    };
  } catch (error: any) {
    return {
      category: 'migrations',
      checkName: 'migrations_status',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: {
        error: error.message,
      },
      recommendation: 'Unable to verify migrations status',
      evidence: `Error: ${error.message}`,
    };
  }
}
