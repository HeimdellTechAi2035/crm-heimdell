import {
  CheckExecutionContext,
  CheckExecutionResult,
} from '../diagnostics.schemas.js';

// ─── AI Checks ──────────────────────────────────────────

export async function runAIChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  results.push(await checkAIConnectivity(context));

  if (context.mode === 'full') {
    results.push(await checkAIModelAvailability(context));
  }

  return results;
}

async function checkAIConnectivity(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();

  try {
    const { config } = await import('../../../config.js');

    if (!config.openai.apiKey || config.openai.apiKey === 'sk-placeholder') {
      return {
        category: 'ai',
        checkName: 'ai_connectivity',
        status: 'warn',
        durationMs: Date.now() - startTime,
        details: { configured: false },
        recommendation: 'OpenAI API key is not configured. AI features will use mock responses.',
        evidence: 'OPENAI_API_KEY environment variable not set',
      };
    }

    if (context.testMode) {
      return {
        category: 'ai',
        checkName: 'ai_connectivity',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: { configured: true, testMode: true },
        evidence: 'OpenAI API key is configured (test mode — no actual API call)',
      };
    }

    // Real connectivity test
    const { openai } = await import('../../../lib/openai.js');
    await openai.models.list();

    return {
      category: 'ai',
      checkName: 'ai_connectivity',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: { configured: true, connected: true },
      evidence: 'Successfully connected to OpenAI API',
    };
  } catch (error: any) {
    return {
      category: 'ai',
      checkName: 'ai_connectivity',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: { error: error.message },
      recommendation: 'Check that OPENAI_API_KEY is valid and has sufficient credits.',
      evidence: `OpenAI API error: ${error.message}`,
    };
  }
}

async function checkAIModelAvailability(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();

  try {
    const { config } = await import('../../../config.js');
    const model = config.openai.model;

    return {
      category: 'ai',
      checkName: 'ai_model_availability',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: { model, configured: true },
      evidence: `AI model configured: ${model}`,
    };
  } catch (error: any) {
    return {
      category: 'ai',
      checkName: 'ai_model_availability',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: { error: error.message },
      recommendation: 'Verify the OPENAI_MODEL environment variable is set correctly.',
      evidence: error.message,
    };
  }
}

// ─── Search Checks ──────────────────────────────────────

export async function runSearchChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  results.push(await checkSearchFunctionality(context));

  return results;
}

async function checkSearchFunctionality(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();

  try {
    const { prisma } = await import('../../../lib/prisma.js');

    if (context.testMode) {
      return {
        category: 'search',
        checkName: 'search_functionality',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: { testMode: true },
        evidence: 'Search uses PostgreSQL ILIKE — available by default',
      };
    }

    // Test that text search works via a simple query
    await prisma.lead.findMany({
      where: {
        email: { contains: 'test', mode: 'insensitive' },
      },
      take: 1,
    });

    return {
      category: 'search',
      checkName: 'search_functionality',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: { engine: 'postgresql_ilike' },
      evidence: 'Text search query executed successfully',
    };
  } catch (error: any) {
    return {
      category: 'search',
      checkName: 'search_functionality',
      status: 'warn',
      durationMs: Date.now() - startTime,
      details: { error: error.message },
      recommendation: 'Search relies on database connectivity. Ensure the database is accessible.',
      evidence: error.message,
    };
  }
}

// ─── Reporting Checks ───────────────────────────────────

export async function runReportingChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  results.push(await checkReportingQueries(context));

  return results;
}

async function checkReportingQueries(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();

  try {
    const { prisma } = await import('../../../lib/prisma.js');

    if (context.testMode) {
      return {
        category: 'reporting',
        checkName: 'reporting_queries',
        status: 'pass',
        durationMs: Date.now() - startTime,
        details: { testMode: true },
        evidence: 'Reporting uses raw SQL aggregations — test mode skipped actual queries',
      };
    }

    // Test that aggregation queries work
    await prisma.deal.aggregate({
      _sum: { value: true },
      _count: { id: true },
    });

    return {
      category: 'reporting',
      checkName: 'reporting_queries',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: { aggregationsWorking: true },
      evidence: 'Dashboard aggregation queries executed successfully',
    };
  } catch (error: any) {
    return {
      category: 'reporting',
      checkName: 'reporting_queries',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: { error: error.message },
      recommendation: 'Reporting requires database access. Ensure database is running and migrations are applied.',
      evidence: error.message,
    };
  }
}

// ─── Backup Checks ──────────────────────────────────────

export async function runBackupChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];

  results.push(await checkBackupConfiguration(context));

  return results;
}

async function checkBackupConfiguration(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();

  // Backups are typically configured externally (pg_dump cron, cloud provider, etc.)
  // We just check if the concept is acknowledged
  return {
    category: 'backups',
    checkName: 'backup_configuration',
    status: 'warn',
    durationMs: Date.now() - startTime,
    details: {
      configured: false,
      note: 'Automated backup verification not yet implemented',
    },
    recommendation:
      'Configure automated PostgreSQL backups using pg_dump, WAL archiving, or your cloud provider\'s backup service. Verify backups are tested regularly.',
    evidence: 'No backup verification endpoint configured',
  };
}
