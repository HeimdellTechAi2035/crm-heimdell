import { z } from 'zod';

export const CheckModeSchema = z.enum(['quick', 'full', 'preflight']);
export const CheckStatusSchema = z.enum(['running', 'completed', 'failed']);
export const CheckCategorySchema = z.enum([
  'database',
  'migrations',
  'api',
  'auth',
  'rbac',
  'web',
  'websocket',
  'queue',
  'redis',
  'storage',
  'oauth',
  'email',
  'sms',
  'twilio',
  'webhooks',
  'ai',
  'search',
  'reporting',
  'backups',
]);
export const CheckResultStatusSchema = z.enum(['pass', 'warn', 'fail']);

export const StartDiagnosticsRunSchema = z.object({
  mode: CheckModeSchema,
  testMode: z.boolean().optional().default(false),
});

export const CheckResultSchema = z.object({
  id: z.string(),
  systemCheckRunId: z.string(),
  category: CheckCategorySchema,
  checkName: z.string(),
  status: CheckResultStatusSchema,
  durationMs: z.number(),
  detailsJson: z.record(z.any()).nullable(),
  recommendation: z.string().nullable(),
  evidence: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SystemCheckRunSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  startedByUserId: z.string(),
  mode: CheckModeSchema,
  status: CheckStatusSchema,
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  summaryJson: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SystemCheckRunWithResultsSchema = SystemCheckRunSchema.extend({
  results: z.array(CheckResultSchema),
});

export type CheckMode = z.infer<typeof CheckModeSchema>;
export type CheckStatus = z.infer<typeof CheckStatusSchema>;
export type CheckCategory = z.infer<typeof CheckCategorySchema>;
export type CheckResultStatus = z.infer<typeof CheckResultStatusSchema>;
export type StartDiagnosticsRun = z.infer<typeof StartDiagnosticsRunSchema>;
export type CheckResult = z.infer<typeof CheckResultSchema>;
export type SystemCheckRun = z.infer<typeof SystemCheckRunSchema>;
export type SystemCheckRunWithResults = z.infer<typeof SystemCheckRunWithResultsSchema>;

export interface CheckExecutionContext {
  runId: string;
  mode: CheckMode;
  testMode: boolean;
  userId: string;
  organizationId?: string;
}

export interface CheckExecutionResult {
  category: CheckCategory;
  checkName: string;
  status: CheckResultStatus;
  durationMs: number;
  details?: Record<string, any>;
  recommendation?: string;
  evidence?: string;
}
