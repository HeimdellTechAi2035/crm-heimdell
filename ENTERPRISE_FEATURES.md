# Heimdell CRM - Enterprise Features Guide

## Overview

This document describes the enterprise-grade features implemented in Heimdell CRM to support multi-brand operations, accountability, compliance, and operational excellence.

---

## 1. Multi-Brand / Business Units

### What It Does
Allows managing multiple brands/companies under one CRM umbrella with isolated data and configurations.

### API Endpoints

```
GET    /api/business-units              # List all business units
GET    /api/business-units/active       # List active units only
GET    /api/business-units/:id          # Get single unit
POST   /api/business-units              # Create unit (ADMIN only)
PATCH  /api/business-units/:id          # Update unit (ADMIN only)
DELETE /api/business-units/:id          # Deactivate unit (ADMIN only)
GET    /api/business-units/:id/stats    # Get unit statistics
```

### Data Model
- Each Business Unit has: name, slug, timezone, country, default pipeline/email/phone
- Leads, Deals, Companies, Activities, Tasks, Sequences, Templates can be assigned to a Business Unit
- Filter all views by active business unit

### Usage

**Create a Business Unit:**
```json
POST /api/business-units
{
  "name": "Brand Alpha",
  "slug": "alpha",
  "timezone": "Europe/London",
  "country": "GB"
}
```

**Filter Leads by Business Unit:**
```
GET /api/leads?businessUnitId=<id>
```

---

## 2. Field-Level History & Reason Codes

### What It Does
Tracks every field change with who changed it, when, and optionally why (reason code + note).

### API Endpoints

```
GET /api/field-history/:entityType/:entityId              # Get all changes for entity
GET /api/field-history/:entityType/:entityId/:fieldName   # Get changes for specific field
GET /api/field-history/recent                             # Get recent changes (admin view)
```

### Data Model
- Tracks: entity type, entity ID, field name, old value, new value, changed by user, reason code, note, timestamp

### Usage

**Get Deal Stage Changes:**
```
GET /api/field-history/deal/clxxxx123/stageId
```

**Track a Field Change (programmatic):**
```typescript
import { trackFieldChange } from './routes/field-history';

await trackFieldChange({
  organizationId: user.organizationId,
  entityType: 'deal',
  entityId: dealId,
  fieldName: 'stageId',
  oldValue: oldStageId,
  newValue: newStageId,
  changedByUserId: user.id,
  reasonCode: 'progressed',
  note: 'Qualified after discovery call'
});
```

---

## 3. Email Identities & Deliverability

### What It Does
- Manage multiple sending identities with SMTP credentials
- Enforce daily/per-minute send limits
- Warmup state tracking (new, warming, stable, restricted)
- Quiet hours enforcement (don't send during off-hours)

### API Endpoints

```
GET  /api/email-identities                     # List identities
POST /api/email-identities                     # Create identity (ADMIN/MANAGER)
PATCH /api/email-identities/:id/warmup         # Update warmup state (ADMIN)
POST /api/email-identities/:id/can-send        # Check if sending allowed
```

### Data Model
- from_name, from_email, SMTP credentials (encrypted)
- daily_send_limit, per_minute_limit
- quiet_hours_start, quiet_hours_end, timezone
- warmup_state: new | warming | stable | restricted

### Usage

**Create Email Identity:**
```json
POST /api/email-identities
{
  "fromName": "Sales Team",
  "fromEmail": "sales@example.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "sales@example.com",
  "smtpPass": "password",
  "dailySendLimit": 100,
  "perMinuteLimit": 10,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

**Check If Can Send:**
```json
POST /api/email-identities/:id/can-send
Response:
{
  "canSend": false,
  "reason": "Within quiet hours",
  "retryAfter": "08:00"
}
```

---

## 4. Decision Memory (Deal Intel & Win/Loss Reviews)

### What It Does
- Store structured intel on every deal: decision makers, pain points, objections, competitors
- Require Win/Loss review when deals close
- Surface patterns for Copilot recommendations

### API Endpoints

```
GET  /api/deals/:dealId/intel             # Get deal intel
PUT  /api/deals/:dealId/intel             # Create/update intel
GET  /api/deals/:dealId/win-loss          # Get win/loss review
POST /api/deals/:dealId/win-loss          # Create win/loss review
GET  /api/deals/win-loss/patterns         # Get aggregated patterns
```

### Data Model

**DealIntel:**
- decision_maker, key_pain_points, objections, what_worked, what_failed, competitors, pricing_notes, next_step_commitment

**WinLossReview:**
- outcome (won/lost), primary_reason_code, notes, learned, created_by_user

### Usage

**Add Deal Intel:**
```json
PUT /api/deals/:dealId/intel
{
  "decisionMaker": "CTO Sarah Johnson",
  "keyPainPoints": ["Manual data entry", "Poor reporting"],
  "objections": ["Price too high", "Needs board approval"],
  "competitors": ["Salesforce", "HubSpot"]
}
```

**Create Win/Loss Review:**
```json
POST /api/deals/:dealId/win-loss
{
  "outcome": "won",
  "primaryReasonCode": "best_price",
  "notes": "Beat competitors on pricing and features",
  "learned": "Emphasize data migration support earlier"
}
```

---

## 5. Forecasting

### What It Does
- Calculate pipeline value, expected value (weighted by stage probability), probable value (weighted by historical conversion rates)
- Detect stale deals (no activity in X days)
- Configure custom stage probabilities per pipeline

### API Endpoints

```
GET  /api/forecasting/pipeline            # Get forecast
GET  /api/forecasting/stale-deals         # Get stale deals
POST /api/forecasting/stage-probability   # Configure stage probability
GET  /api/forecasting/conversion-rates    # Get historical conversion rates
```

### Usage

**Get Forecast:**
```
GET /api/forecasting/pipeline?pipelineId=clxxx&businessUnitId=clyyy&startDate=2025-01-01&endDate=2025-03-31

Response:
{
  "forecast": {
    "pipelineValue": 500000,
    "expectedValue": 350000,
    "probableValue": 280000,
    "dealsCount": 25,
    "dealsByStage": {...}
  }
}
```

**Get Stale Deals:**
```
GET /api/forecasting/stale-deals?daysInactive=14

Response:
{
  "staleDeals": [
    {
      "id": "clxxx",
      "title": "Acme Corp Deal",
      "daysSinceUpdate": 21,
      "value": 50000,
      ...
    }
  ]
}
```

---

## 6. RBAC & Permission Policies

### What It Does
- Define granular policies: field-level visibility, export restrictions, stage change restrictions, approval workflows
- Central policy engine checks permissions before sensitive actions

### Data Model
- Policy: name, role, action (view_field, edit_field, export_data, change_stage, mark_won_lost), resource, condition

### Usage

**Policy Engine:**
```typescript
import { policyEngine } from '../lib/policy-engine';

const canMarkWon = await policyEngine.canMarkWonLost({
  userId: user.id,
  organizationId: user.organizationId,
  role: user.role
}, dealValue);

if (!canMarkWon.allowed) {
  return reply.code(403).send({ error: canMarkWon.reason });
}
```

**Example Policies:**
- SALES_REP cannot export all leads
- SALES_REP cannot view deal_value field
- Only MANAGER/ADMIN can mark deals Won/Lost

---

## 7. Observability & Health Monitoring

### What It Does
- Health endpoints for liveness/readiness checks
- Queue job tracking and failure monitoring
- System alerts with severity levels
- Webhook event logging

### API Endpoints

```
GET  /health                           # Basic health check (public)
GET  /health/detailed                  # Detailed health (ADMIN)
GET  /health/workers                   # Queue worker status (ADMIN)
GET  /api/system/alerts                # List system alerts
POST /api/system/alerts                # Create alert
POST /api/system/alerts/:id/acknowledge # Acknowledge alert
GET  /api/system/webhook-events        # List webhook events
GET  /api/system/webhook-events/failed # List failed webhooks
GET  /api/system/stats                 # System stats dashboard
```

### Usage

**Health Check:**
```
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-12-16T10:00:00Z",
  "uptime": 12345
}
```

**System Stats:**
```
GET /api/system/stats

Response:
{
  "stats": {
    "leadsCount": 1250,
    "dealsCount": 85,
    "queueDepth": 12,
    "unacknowledgedAlerts": 2
  }
}
```

---

## 8. Knowledge Base & Playbooks

### What It Does
- Store internal knowledge articles (with Markdown support)
- Define stage-specific playbooks with checklists, qualifying questions, objection responses

### API Endpoints

```
GET    /api/knowledge/articles         # Search articles
GET    /api/knowledge/articles/:id     # Get article
POST   /api/knowledge/articles         # Create article (ADMIN/MANAGER)
PATCH  /api/knowledge/articles/:id     # Update article
DELETE /api/knowledge/articles/:id     # Delete article
GET    /api/knowledge/playbooks        # Get playbook for stage
PUT    /api/knowledge/playbooks        # Create/update playbook
```

### Usage

**Create Knowledge Article:**
```json
POST /api/knowledge/articles
{
  "title": "How to Handle Price Objections",
  "body": "## Strategy\n\n1. Acknowledge concern...",
  "tags": ["sales", "objections"],
  "visibility": "internal",
  "isPublished": true
}
```

**Create Stage Playbook:**
```json
PUT /api/knowledge/playbooks?pipelineId=clxxx&stageId=clyyy
{
  "checklistItems": [
    "Qualify budget",
    "Identify decision makers",
    "Schedule demo"
  ],
  "qualifyingQuestions": [
    "What's your current process?",
    "What's your timeline?"
  ],
  "objectionsResponses": {
    "too_expensive": "Let me show you ROI calculations..."
  }
}
```

---

## 9. GDPR & Data Protection

### What It Does
- Export all lead data (JSON/CSV)
- Anonymize leads (irreversible PII redaction)
- Hard delete leads (with confirmation + audit log)
- Retention settings (auto-delete imports, anonymize inactive leads)

### API Endpoints

```
POST /api/gdpr/export/:leadId           # Export lead data
POST /api/gdpr/anonymize/:leadId        # Anonymize lead (ADMIN)
DELETE /api/gdpr/delete/:leadId?confirm=DELETE # Hard delete (ADMIN)
GET  /api/gdpr/retention-settings       # Get retention settings
PUT  /api/gdpr/retention-settings       # Update retention settings
```

### Usage

**Export Lead Data:**
```
POST /api/gdpr/export/:leadId

Response:
{
  "exportRequest": {
    "id": "clxxx",
    "exportUrl": "/exports/clxxx.json",
    "exportData": {...}
  }
}
```

**Anonymize Lead:**
```
POST /api/gdpr/anonymize/:leadId

Response:
{
  "success": true,
  "message": "Lead data has been anonymized"
}
```

**Set Retention Policy:**
```json
PUT /api/gdpr/retention-settings
{
  "autoDeleteImportsAfterDays": 90,
  "anonymizeInactiveLeadsAfterMonths": 24,
  "isEnabled": true
}
```

---

## 10. Operational Runbooks

### Starting the System

1. **Start Docker containers:**
   ```powershell
   docker-compose up -d
   ```

2. **Run migrations:**
   ```powershell
   cd apps/api
   npx prisma migrate deploy
   ```

3. **Start API server:**
   ```powershell
   cd apps/api
   pnpm dev
   ```

4. **Start frontend:**
   ```powershell
   cd apps/web
   pnpm dev
   ```

### Monitoring

**Check Health:**
```
curl http://localhost:3001/health
curl http://localhost:3001/health/detailed (requires auth)
```

**Check Queue Status:**
```
curl http://localhost:3001/health/workers
```

**View System Alerts:**
```
GET /api/system/alerts?acknowledged=false&severity=error
```

### Troubleshooting

**Queue Jobs Stuck:**
```sql
-- Check failed jobs
SELECT * FROM queue_jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20;

-- Retry a job (update to 'waiting')
UPDATE queue_jobs SET status = 'waiting', attempts = 0 WHERE id = 'xxx';
```

**Email Not Sending:**
1. Check warmup state: `GET /api/email-identities`
2. Check quiet hours
3. Check daily send limit
4. Verify SMTP credentials

**Stale Deals Piling Up:**
```
GET /api/forecasting/stale-deals?daysInactive=7
```
Review and close or update stale deals.

### Backup & Restore

**Database Backup:**
```powershell
docker exec -t heimdell-postgres pg_dump -U postgres heimdell_crm > backup.sql
```

**Database Restore:**
```powershell
docker exec -i heimdell-postgres psql -U postgres heimdell_crm < backup.sql
```

---

## Next Steps

1. Implement frontend UI for all enterprise features
2. Add comprehensive unit tests
3. Set up Discord webhook alerts for critical errors
4. Configure nightly jobs for historical conversion rate computation
5. Implement Copilot daily-focus endpoint
6. Add spam-risk heuristics for email composer
7. Set up idempotency keys for webhook processing

---

## Support

For issues, see troubleshooting section or check system alerts:
```
GET /api/system/alerts?acknowledged=false
```
