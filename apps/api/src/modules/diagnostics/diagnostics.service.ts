import { prisma } from '../../lib/prisma.js';
import {
  CheckExecutionContext,
  CheckExecutionResult,
  CheckMode,
} from './diagnostics.schemas.js';
import { runDatabaseChecks } from './checks/database.checks.js';
import { runApiAuthChecks, runWebChecks } from './checks/api-auth.checks.js';
import {
  runInfrastructureChecks,
  runStorageChecks,
} from './checks/infrastructure.checks.js';
import {
  runIntegrationChecks,
  runSMSChecks,
} from './checks/integration.checks.js';
import {
  runAIChecks,
  runSearchChecks,
  runReportingChecks,
  runBackupChecks,
} from './checks/ai-search-reporting.checks.js';

export class DiagnosticsService {
  /**
   * Start a new diagnostics run
   */
  async startRun(
    organizationId: string,
    userId: string,
    mode: CheckMode,
    testMode: boolean = false
  ) {
    // Create the run record
    const run = await prisma.systemCheckRun.create({
      data: {
        organizationId,
        userId,
        mode,
        status: 'running',
        summaryJson: {},
      },
    });

    // Execute checks asynchronously
    this.executeChecks(run.id, organizationId, userId, mode, testMode).catch(
      (error) => {
        console.error('Diagnostics run failed:', error);
        // Update run status to failed
        prisma.systemCheckRun
          .update({
            where: { id: run.id },
            data: {
              status: 'failed',
              summaryJson: {
                error: error.message,
                failedAt: new Date().toISOString(),
              },
            },
          })
          .catch(console.error);
      }
    );

    return run;
  }

  /**
   * Execute all diagnostic checks
   */
  private async executeChecks(
    runId: string,
    organizationId: string,
    userId: string,
    mode: CheckMode,
    testMode: boolean
  ) {
    const context: CheckExecutionContext = {
      runId,
      organizationId,
      userId,
      mode,
      testMode,
    };

    const allResults: CheckExecutionResult[] = [];

    try {
      // Run checks in parallel where safe
      const checkGroups = await Promise.allSettled([
        // Group 1: Database and core infrastructure
        this.runCheckGroup('database', () => runDatabaseChecks(context)),

        // Group 2: API and Auth
        this.runCheckGroup('api-auth', () => runApiAuthChecks(context)),

        // Group 3: Web frontend
        this.runCheckGroup('web', () => runWebChecks(context)),

        // Group 4: Infrastructure (Redis, Queue, Storage, WebSocket)
        this.runCheckGroup('infrastructure', async () => {
          const infraResults = await runInfrastructureChecks(context);
          const storageResults = await runStorageChecks(context);
          return [...infraResults, ...storageResults];
        }),

        // Group 5: Integrations (Email, Twilio, CSV, OAuth, SMS)
        this.runCheckGroup('integrations', async () => {
          const integrationResults = await runIntegrationChecks(context);
          const smsResults = await runSMSChecks(context);
          return [...integrationResults, ...smsResults];
        }),

        // Group 6: AI and Search
        this.runCheckGroup('ai-search', async () => {
          const aiResults = await runAIChecks(context);
          const searchResults = await runSearchChecks(context);
          return [...aiResults, ...searchResults];
        }),

        // Group 7: Reporting and Backups
        this.runCheckGroup('reporting-backups', async () => {
          const reportingResults = await runReportingChecks(context);
          const backupResults = await runBackupChecks(context);
          return [...reportingResults, ...backupResults];
        }),
      ]);

      // Collect results from all groups
      for (const result of checkGroups) {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          // Log group failure but continue
          console.error('Check group failed:', result.reason);
        }
      }

      // Save all results to database
      await this.saveResults(runId, allResults);

      // Calculate summary
      const summary = this.calculateSummary(allResults);

      // Update run status
      await prisma.systemCheckRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          summaryJson: summary,
        },
      });
    } catch (error: any) {
      console.error('Diagnostics execution failed:', error);
      throw error;
    }
  }

  /**
   * Run a group of checks with error isolation
   */
  private async runCheckGroup(
    groupName: string,
    checkFn: () => Promise<CheckExecutionResult[]>
  ): Promise<CheckExecutionResult[]> {
    try {
      return await checkFn();
    } catch (error: any) {
      console.error(`Check group "${groupName}" failed:`, error);
      return [
        {
          category: 'database',
          checkName: `${groupName}_group_error`,
          status: 'fail',
          durationMs: 0,
          details: {
            error: error.message,
            groupName,
          },
          recommendation: `Check group "${groupName}" encountered an error`,
          evidence: error.message,
        },
      ];
    }
  }

  /**
   * Save check results to database
   */
  private async saveResults(
    runId: string,
    results: CheckExecutionResult[]
  ): Promise<void> {
    const createPromises = results.map((result) =>
      prisma.systemCheckResult.create({
        data: {
          runId,
          category: result.category,
          checkName: result.checkName,
          status: result.status,
          durationMs: result.durationMs,
          detailsJson: result.details || {},
          recommendation: result.recommendation || null,
          evidence: result.evidence || null,
        },
      })
    );

    await Promise.all(createPromises);
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: CheckExecutionResult[]): Record<string, any> {
    const summary: Record<string, any> = {
      totalChecks: results.length,
      passed: 0,
      warned: 0,
      failed: 0,
      totalDurationMs: 0,
      byCategory: {} as Record<string, any>,
    };

    for (const result of results) {
      // Count by status
      if (result.status === 'pass') summary.passed++;
      else if (result.status === 'warn') summary.warned++;
      else if (result.status === 'fail') summary.failed++;

      // Sum duration
      summary.totalDurationMs += result.durationMs;

      // Group by category
      if (!summary.byCategory[result.category]) {
        summary.byCategory[result.category] = {
          total: 0,
          passed: 0,
          warned: 0,
          failed: 0,
        };
      }
      summary.byCategory[result.category].total++;
      if (result.status === 'pass') summary.byCategory[result.category].passed++;
      else if (result.status === 'warn') summary.byCategory[result.category].warned++;
      else if (result.status === 'fail') summary.byCategory[result.category].failed++;
    }

    return summary;
  }

  /**
   * Get a diagnostics run by ID
   */
  async getRun(runId: string) {
    return prisma.systemCheckRun.findUnique({
      where: { id: runId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get all diagnostics runs for an organization
   */
  async getRuns(organizationId: string, limit: number = 10) {
    return prisma.systemCheckRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get results for a specific run
   */
  async getResults(runId: string) {
    return prisma.systemCheckResult.findMany({
      where: { runId },
      orderBy: [
        { category: 'asc' },
        { status: 'desc' }, // Failed first, then warned, then passed
        { checkName: 'asc' },
      ],
    });
  }

  /**
   * Retry only failed checks from a previous run
   */
  async retryFailedChecks(
    previousRunId: string,
    organizationId: string,
    userId: string
  ) {
    // Get failed checks from previous run
    const failedResults = await prisma.systemCheckResult.findMany({
      where: {
        runId: previousRunId,
        status: 'fail',
      },
    });

    if (failedResults.length === 0) {
      throw new Error('No failed checks to retry');
    }

    // Create new run
    const run = await prisma.systemCheckRun.create({
      data: {
        organizationId,
        userId,
        mode: 'quick', // Always use quick mode for retries
        status: 'running',
        summaryJson: {
          retryOf: previousRunId,
          failedChecksToRetry: failedResults.length,
        },
      },
    });

    // TODO: Implement selective check retry logic
    // For now, just mark as completed
    await prisma.systemCheckRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        summaryJson: {
          retryOf: previousRunId,
          message: 'Retry functionality coming soon',
        },
      },
    });

    return run;
  }

  /**
   * Run a single check by name
   */
  async runSingleCheck(
    checkName: string,
    organizationId: string,
    userId: string,
    testMode: boolean = false
  ) {
    // Create a quick run for single check
    const run = await prisma.systemCheckRun.create({
      data: {
        organizationId,
        userId,
        mode: 'quick',
        status: 'running',
        summaryJson: {
          singleCheck: checkName,
        },
      },
    });

    // TODO: Implement single check execution
    // For now, just mark as completed
    await prisma.systemCheckRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        summaryJson: {
          singleCheck: checkName,
          message: 'Single check execution coming soon',
        },
      },
    });

    return run;
  }
}

export const diagnosticsService = new DiagnosticsService();
