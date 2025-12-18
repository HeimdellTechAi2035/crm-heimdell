-- CreateEnum
CREATE TYPE "WarmupState" AS ENUM ('new', 'warming', 'stable', 'restricted');

-- CreateEnum
CREATE TYPE "WinLossOutcome" AS ENUM ('won', 'lost');

-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('view_field', 'edit_field', 'export_data', 'change_stage', 'approve_discount', 'mark_won_lost');

-- CreateEnum
CREATE TYPE "ArticleVisibility" AS ENUM ('public', 'internal');

-- CreateEnum
CREATE TYPE "CopilotContextType" AS ENUM ('global', 'lead', 'deal', 'company', 'import_job', 'pipeline');

-- CreateEnum
CREATE TYPE "CopilotMessageRole" AS ENUM ('system', 'user', 'assistant', 'tool');

-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('waiting', 'active', 'completed', 'failed', 'delayed');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('requested', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "default_pipeline_id" TEXT,
    "default_email_identity_id" TEXT,
    "default_twilio_number_id" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "country" TEXT NOT NULL DEFAULT 'GB',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_changes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "changed_by_user_id" TEXT NOT NULL,
    "reason_code" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_unit_id" TEXT,
    "from_name" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass" TEXT NOT NULL,
    "daily_send_limit" INTEGER NOT NULL DEFAULT 100,
    "per_minute_limit" INTEGER NOT NULL DEFAULT 10,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "warmup_state" "WarmupState" NOT NULL DEFAULT 'new',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_intel" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "decision_maker" TEXT,
    "key_pain_points" JSONB,
    "objections" JSONB,
    "what_worked" TEXT,
    "what_failed" TEXT,
    "competitors" JSONB,
    "pricing_notes" TEXT,
    "next_step_commitment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_intel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "win_loss_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "outcome" "WinLossOutcome" NOT NULL,
    "primary_reason_code" TEXT NOT NULL,
    "notes" TEXT,
    "learned" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "win_loss_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_probabilities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "historical_close_rate" DOUBLE PRECISION,
    "last_computed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_probabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" "UserRole" NOT NULL,
    "action" "PolicyAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "condition" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_unit_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "visibility" "ArticleVisibility" NOT NULL DEFAULT 'internal',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_playbooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_unit_id" TEXT,
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "checklist_items" JSONB NOT NULL,
    "qualifying_questions" JSONB,
    "objections_responses" JSONB,
    "approved_templates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_threads" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "context_type" "CopilotContextType" NOT NULL,
    "context_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_usage" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "copilot_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "QueueJobStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failed_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'requested',
    "export_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auto_delete_imports_after_days" INTEGER,
    "anonymize_inactive_leads_after_months" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "business_unit_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "email_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "sms_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "email_opt_out_at" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "sms_opt_out_at" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "lawful_basis_note" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "activities" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "sequences" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN "business_unit_id" TEXT;

-- AlterTable
ALTER TABLE "import_jobs" ADD COLUMN "business_unit_id" TEXT;

-- CreateIndex
CREATE INDEX "business_units_organization_id_idx" ON "business_units"("organization_id");
CREATE INDEX "business_units_is_active_idx" ON "business_units"("is_active");
CREATE UNIQUE INDEX "business_units_organization_id_slug_key" ON "business_units"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "field_changes_organization_id_idx" ON "field_changes"("organization_id");
CREATE INDEX "field_changes_entity_type_entity_id_idx" ON "field_changes"("entity_type", "entity_id");
CREATE INDEX "field_changes_changed_by_user_id_idx" ON "field_changes"("changed_by_user_id");
CREATE INDEX "field_changes_created_at_idx" ON "field_changes"("created_at");

-- CreateIndex
CREATE INDEX "email_identities_organization_id_idx" ON "email_identities"("organization_id");
CREATE INDEX "email_identities_business_unit_id_idx" ON "email_identities"("business_unit_id");
CREATE INDEX "email_identities_is_active_idx" ON "email_identities"("is_active");
CREATE UNIQUE INDEX "email_identities_organization_id_from_email_key" ON "email_identities"("organization_id", "from_email");

-- CreateIndex
CREATE INDEX "deal_intel_organization_id_idx" ON "deal_intel"("organization_id");
CREATE INDEX "deal_intel_deal_id_idx" ON "deal_intel"("deal_id");
CREATE UNIQUE INDEX "deal_intel_deal_id_key" ON "deal_intel"("deal_id");

-- CreateIndex
CREATE INDEX "win_loss_reviews_organization_id_idx" ON "win_loss_reviews"("organization_id");
CREATE INDEX "win_loss_reviews_deal_id_idx" ON "win_loss_reviews"("deal_id");
CREATE INDEX "win_loss_reviews_outcome_idx" ON "win_loss_reviews"("outcome");
CREATE INDEX "win_loss_reviews_primary_reason_code_idx" ON "win_loss_reviews"("primary_reason_code");
CREATE UNIQUE INDEX "win_loss_reviews_deal_id_key" ON "win_loss_reviews"("deal_id");

-- CreateIndex
CREATE INDEX "stage_probabilities_organization_id_idx" ON "stage_probabilities"("organization_id");
CREATE INDEX "stage_probabilities_pipeline_id_idx" ON "stage_probabilities"("pipeline_id");
CREATE UNIQUE INDEX "stage_probabilities_organization_id_pipeline_id_stage_id_key" ON "stage_probabilities"("organization_id", "pipeline_id", "stage_id");

-- CreateIndex
CREATE INDEX "permission_policies_organization_id_idx" ON "permission_policies"("organization_id");
CREATE INDEX "permission_policies_role_idx" ON "permission_policies"("role");
CREATE INDEX "permission_policies_action_idx" ON "permission_policies"("action");
CREATE INDEX "permission_policies_is_active_idx" ON "permission_policies"("is_active");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_idx" ON "knowledge_articles"("organization_id");
CREATE INDEX "knowledge_articles_business_unit_id_idx" ON "knowledge_articles"("business_unit_id");
CREATE INDEX "knowledge_articles_is_published_idx" ON "knowledge_articles"("is_published");

-- CreateIndex
CREATE INDEX "stage_playbooks_organization_id_idx" ON "stage_playbooks"("organization_id");
CREATE INDEX "stage_playbooks_business_unit_id_idx" ON "stage_playbooks"("business_unit_id");
CREATE INDEX "stage_playbooks_pipeline_id_idx" ON "stage_playbooks"("pipeline_id");
CREATE UNIQUE INDEX "stage_playbooks_organization_id_pipeline_id_stage_id_key" ON "stage_playbooks"("organization_id", "pipeline_id", "stage_id");

-- CreateIndex
CREATE INDEX "copilot_threads_org_id_idx" ON "copilot_threads"("org_id");
CREATE INDEX "copilot_threads_user_id_idx" ON "copilot_threads"("user_id");
CREATE INDEX "copilot_threads_is_active_idx" ON "copilot_threads"("is_active");

-- CreateIndex
CREATE INDEX "copilot_messages_thread_id_idx" ON "copilot_messages"("thread_id");

-- CreateIndex
CREATE INDEX "copilot_usage_org_id_idx" ON "copilot_usage"("org_id");
CREATE INDEX "copilot_usage_user_id_idx" ON "copilot_usage"("user_id");
CREATE UNIQUE INDEX "copilot_usage_org_id_user_id_month_key" ON "copilot_usage"("org_id", "user_id", "month");

-- CreateIndex
CREATE INDEX "queue_jobs_queue_name_idx" ON "queue_jobs"("queue_name");
CREATE INDEX "queue_jobs_status_idx" ON "queue_jobs"("status");
CREATE INDEX "queue_jobs_created_at_idx" ON "queue_jobs"("created_at");
CREATE UNIQUE INDEX "queue_jobs_queue_name_job_id_key" ON "queue_jobs"("queue_name", "job_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events"("processed");
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");
CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "system_alerts_alert_type_idx" ON "system_alerts"("alert_type");
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts"("severity");
CREATE INDEX "system_alerts_acknowledged_idx" ON "system_alerts"("acknowledged");
CREATE INDEX "system_alerts_created_at_idx" ON "system_alerts"("created_at");

-- CreateIndex
CREATE INDEX "data_export_requests_organization_id_idx" ON "data_export_requests"("organization_id");
CREATE INDEX "data_export_requests_lead_id_idx" ON "data_export_requests"("lead_id");
CREATE INDEX "data_export_requests_status_idx" ON "data_export_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "retention_settings_organization_id_key" ON "retention_settings"("organization_id");

-- CreateIndex
CREATE INDEX "leads_business_unit_id_idx" ON "leads"("business_unit_id");

-- CreateIndex
CREATE INDEX "companies_business_unit_id_idx" ON "companies"("business_unit_id");

-- CreateIndex
CREATE INDEX "deals_business_unit_id_idx" ON "deals"("business_unit_id");

-- CreateIndex
CREATE INDEX "activities_business_unit_id_idx" ON "activities"("business_unit_id");

-- CreateIndex
CREATE INDEX "tasks_business_unit_id_idx" ON "tasks"("business_unit_id");

-- CreateIndex
CREATE INDEX "sequences_business_unit_id_idx" ON "sequences"("business_unit_id");

-- CreateIndex
CREATE INDEX "email_templates_business_unit_id_idx" ON "email_templates"("business_unit_id");

-- CreateIndex
CREATE INDEX "import_jobs_business_unit_id_idx" ON "import_jobs"("business_unit_id");

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_changes" ADD CONSTRAINT "field_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_changes" ADD CONSTRAINT "field_changes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_identities" ADD CONSTRAINT "email_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_identities" ADD CONSTRAINT "email_identities_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_intel" ADD CONSTRAINT "deal_intel_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_intel" ADD CONSTRAINT "deal_intel_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_loss_reviews" ADD CONSTRAINT "win_loss_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_loss_reviews" ADD CONSTRAINT "win_loss_reviews_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_loss_reviews" ADD CONSTRAINT "win_loss_reviews_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_probabilities" ADD CONSTRAINT "stage_probabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_policies" ADD CONSTRAINT "permission_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_playbooks" ADD CONSTRAINT "stage_playbooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_playbooks" ADD CONSTRAINT "stage_playbooks_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "copilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_usage" ADD CONSTRAINT "copilot_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_settings" ADD CONSTRAINT "retention_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
