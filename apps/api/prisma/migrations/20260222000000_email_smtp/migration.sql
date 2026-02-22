-- Phase 3: Direct SMTP email sending
-- Add SenderAccount and EmailSendLog models

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "sender_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "daily_limit" INTEGER NOT NULL DEFAULT 100,
    "sent_today" INTEGER NOT NULL DEFAULT 0,
    "last_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_send_logs" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "sender_email" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sender_accounts_email_key" ON "sender_accounts"("email");

-- CreateIndex
CREATE INDEX "email_send_logs_lead_id_idx" ON "email_send_logs"("lead_id");

-- CreateIndex
CREATE INDEX "email_send_logs_sender_email_created_at_idx" ON "email_send_logs"("sender_email", "created_at");

-- AddForeignKey
ALTER TABLE "email_send_logs" ADD CONSTRAINT "email_send_logs_sender_email_fkey" FOREIGN KEY ("sender_email") REFERENCES "sender_accounts"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
