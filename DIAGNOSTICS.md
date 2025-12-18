# System Diagnostics & Health Monitoring

Heimdell CRM includes a comprehensive diagnostics system that verifies every module is correctly wired, secure, and operational.

## Overview

The diagnostics system runs automated checks across 20+ categories including:

- **Database**: Connectivity, tables, indexes, query performance, migrations
- **API & Auth**: JWT signing/verification, RBAC enforcement, API health
- **Infrastructure**: Redis, WebSocket, Queue system, Storage (S3/local)
- **Integrations**: Email SMTP/IMAP, Twilio, SMS opt-out, CSV imports, OAuth
- **AI & Search**: OpenAI configuration, Copilot tools, search functionality
- **Reporting**: Dashboard metrics, forecast calculations
- **Backups**: Backup configuration and provider setup

## Quick Start

### Running Diagnostics from UI

1. Navigate to **Admin → Diagnostics** (`/admin/diagnostics`)
2. Click one of the run modes:
   - **Quick Check**: Essential checks only (~30 seconds)
   - **Full Check**: All checks including backups (~2 minutes)
   - **Preflight (Test Mode)**: Safe verification with no side effects

### Running Diagnostics from API

```bash
# Start a quick diagnostics run
curl -X POST http://localhost:3000/api/diagnostics/runs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "quick", "testMode": false}'

# Get results
curl http://localhost:3000/api/diagnostics/runs/RUN_ID/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Check Modes

### Quick Mode
- Database connectivity and critical tables
- API health and auth functionality
- Redis and queue connectivity
- ~30 checks, completes in <1 minute
- **Use for**: Regular health monitoring, pre-deployment checks

### Full Mode
- All Quick mode checks
- Storage configuration (S3/local)
- OAuth integrations
- Backup configuration
- AI and search functionality
- ~50+ checks, completes in 1-2 minutes
- **Use for**: Comprehensive audits, troubleshooting

### Preflight Mode (Test Mode)
- Same checks as Full mode
- **Safe mode**: No side effects, no emails sent, no SMS
- Uses test data and dry-run operations
- **Use for**: Development, CI/CD pipelines, pre-production verification

## Check Categories

### Database Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `database_connectivity` | Tests Prisma connection | Connection succeeds |
| `required_tables` | Verifies 14+ core tables exist | All tables present |
| `critical_indexes` | Checks 7 key indexes | All indexes exist |
| `query_latency` | Measures count/join performance | <500ms for test queries |
| `migrations_status` | Verifies migrations applied | No pending migrations |

**Common Issues:**
- **Failed connectivity**: Check `DATABASE_URL` in `.env`
- **Missing tables**: Run `pnpm db:push` or `pnpm db:migrate`
- **Missing indexes**: Re-apply migrations with `pnpm db:migrate deploy`

### API & Auth Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `jwt_signing` | Tests JWT token creation | Token generated successfully |
| `jwt_verification` | Tests token validation | Token verifies correctly |
| `rbac_enforcement` | Tests policy engine | Policies enforce correctly |
| `api_health` | Tests core API dependencies | All deps available |
| `frontend_env` | Verifies UI environment vars | VITE_API_URL set |

**Common Issues:**
- **JWT signing failed**: Check `JWT_SECRET` in `.env`
- **RBAC failed**: Verify policy-engine module is working
- **Frontend env missing**: Set `VITE_API_URL` in `apps/web/.env`

### Infrastructure Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `redis_connectivity` | Tests Redis ping + set/get | Connection + ops succeed |
| `websocket_endpoint` | Verifies WS config | WS_URL configured |
| `queue_system` | Tests BullMQ + Redis | Queue connection works |
| `storage_configuration` | Validates S3 or local storage | Storage type configured |

**Common Issues:**
- **Redis connection failed**: Check `REDIS_URL` in `.env`, ensure Redis is running
- **Queue system failed**: Redis must be running for BullMQ
- **Storage not configured**: Set `STORAGE_TYPE=s3` or `STORAGE_TYPE=local`

### Integration Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `email_configuration` | Verifies SMTP/IMAP setup | Email identity configured |
| `twilio_configuration` | Tests Twilio credentials | SID, token, phone configured |
| `csv_import_pipeline` | Tests CSV parsing | Parser available |
| `oauth_integrations` | Checks Google/Dropbox OAuth | At least one configured |
| `sms_optout_handling` | Verifies opt-out fields | Fields exist in schema |

**Common Issues:**
- **Email not configured**: Add email identity in Settings
- **Twilio missing**: Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **CSV parse failed**: Check `apps/api/src/utils/csv.ts` implementation

### AI & Search Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `openai_configuration` | Validates OpenAI API key | Key present and valid format |
| `copilot_tools` | Verifies Copilot endpoints | Routes registered |
| `search_functionality` | Tests search queries | Lead/company search works |

**Common Issues:**
- **OpenAI key invalid**: Check `OPENAI_API_KEY` format (should start with `sk-`)
- **Search failed**: Check database indexes on search fields

### Reporting Checks
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `dashboard_metrics` | Tests count queries | Counts succeed |
| `forecast_calculations` | Tests weighted pipeline | Calculations complete |

### Backup Checks (Full Mode Only)
| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| `backup_configuration` | Verifies backup setup | Backup enabled + provider set |

**Common Issues:**
- **Backups not enabled**: Set `BACKUP_ENABLED=true` and `BACKUP_PROVIDER=s3`

## Understanding Results

### Status Types
- **PASS** ✓ - Check completed successfully, component operational
- **WARN** ⚠ - Check passed but found potential issues or missing optional features
- **FAIL** ✗ - Check failed, component misconfigured or not operational

### Reading the Dashboard

#### Summary Stats
```
Total Checks: 45    Passed: 38    Warnings: 5    Failed: 2
```
- **Total Checks**: Number of checks run in this mode
- **Passed**: Components working correctly
- **Warnings**: Optional features missing or potential issues
- **Failed**: Critical issues requiring attention

#### Results Table
Each row shows:
- **Status**: Visual indicator (color-coded)
- **Category**: System area (database, api, infrastructure, etc.)
- **Check Name**: Specific check performed
- **Duration**: Time to complete check (ms)
- **Evidence**: Brief explanation of result
- **Details Button**: Expand for full details, recommendation, and raw data

### Interpreting Evidence
- `"Redis ping successful, set/get test passed"` - Component fully operational
- `"Twilio credentials not configured"` - Feature not set up (may be intentional)
- `"JWT signing failed: Invalid secret"` - Critical error requiring fix

### Recommendations
Failed and warned checks include actionable recommendations:
```
Recommendation: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable SMS/voice"
```

## Using Test Mode Safely

Test mode (`testMode: true`) ensures checks don't cause side effects:

### What Test Mode Does:
- ✅ Runs all connectivity checks
- ✅ Tests configuration parsing
- ✅ Validates credentials format
- ✅ Uses sample data for queries
- ❌ Does NOT send emails
- ❌ Does NOT send SMS
- ❌ Does NOT make phone calls
- ❌ Does NOT modify production data

### When to Use Test Mode:
1. **Development**: Verify setup without affecting production
2. **CI/CD**: Automated testing in pipelines
3. **Pre-production**: Validate configuration before going live
4. **Troubleshooting**: Safely test changes without side effects

## API Endpoints

### Start Diagnostics Run
```http
POST /api/diagnostics/runs
Authorization: Bearer {token}
Content-Type: application/json

{
  "mode": "quick" | "full" | "preflight",
  "testMode": true | false
}
```

**Response:**
```json
{
  "id": "cm4abc123...",
  "mode": "quick",
  "status": "running",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Get All Runs
```http
GET /api/diagnostics/runs?limit=10
Authorization: Bearer {token}
```

### Get Run Details
```http
GET /api/diagnostics/runs/{id}
Authorization: Bearer {token}
```

### Get Run Results
```http
GET /api/diagnostics/runs/{id}/results
Authorization: Bearer {token}
```

### Retry Failed Checks
```http
POST /api/diagnostics/runs/{id}/retry-failed
Authorization: Bearer {token}
```

### Run Single Check
```http
POST /api/diagnostics/checks/{checkName}/run
Authorization: Bearer {token}
Content-Type: application/json

{
  "testMode": true
}
```

### Health Check (No Auth)
```http
GET /api/diagnostics/health
```

## Permissions

All diagnostics endpoints require **ADMIN** role except:
- `/api/diagnostics/health` - Public endpoint
- `/api/diagnostics/runs` (GET) - Requires ADMIN or MANAGER

Starting runs and running checks requires **ADMIN** only.

## Automation

### Schedule Regular Checks

Add to cron or scheduler:
```bash
# Run quick check daily at 6 AM
0 6 * * * curl -X POST https://your-domain.com/api/diagnostics/runs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"mode":"quick","testMode":false}'
```

### CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Run Diagnostics
  run: |
    RESULT=$(curl -X POST http://localhost:3000/api/diagnostics/runs \
      -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}" \
      -d '{"mode":"preflight","testMode":true}')
    
    RUN_ID=$(echo $RESULT | jq -r '.id')
    sleep 30
    
    curl http://localhost:3000/api/diagnostics/runs/$RUN_ID/results \
      -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

## Troubleshooting

### Run Never Completes
- Check API logs for errors
- Database connection issues may block checks
- Restart API server and retry

### All Checks Fail
- Verify `DATABASE_URL` is correct
- Ensure database is running
- Check API server has network access to dependencies

### Specific Check Always Fails
- Review check's recommendation
- Check environment variables
- Verify dependent services are running
- Review check source code in `apps/api/src/modules/diagnostics/checks/`

## Monitoring & Alerts

### Set Up Alerts

Monitor the `/api/diagnostics/health` endpoint:
```bash
# Simple uptime monitoring
*/5 * * * * curl -f https://your-domain.com/api/diagnostics/health || \
  echo "Health check failed" | mail -s "Alert" admin@example.com
```

### System Status Dashboard

Navigate to **Admin → System Status** (`/admin/system-status`) for:
- Real-time health indicators
- Component status grid
- Quick action buttons
- Auto-refresh every 30 seconds

## Development

### Adding New Checks

1. Create check function in appropriate file:
```typescript
// apps/api/src/modules/diagnostics/checks/your-category.checks.ts

export async function runYourChecks(
  context: CheckExecutionContext
): Promise<CheckExecutionResult[]> {
  const results: CheckExecutionResult[] = [];
  results.push(await checkYourFeature(context));
  return results;
}

async function checkYourFeature(
  context: CheckExecutionContext
): Promise<CheckExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Your check logic here
    
    return {
      category: 'your_category',
      checkName: 'your_feature',
      status: 'pass',
      durationMs: Date.now() - startTime,
      details: { /* your data */ },
      evidence: 'Feature is operational',
    };
  } catch (error: any) {
    return {
      category: 'your_category',
      checkName: 'your_feature',
      status: 'fail',
      durationMs: Date.now() - startTime,
      details: { error: error.message },
      recommendation: 'How to fix this',
      evidence: `Error: ${error.message}`,
    };
  }
}
```

2. Add to service execution:
```typescript
// apps/api/src/modules/diagnostics/diagnostics.service.ts

import { runYourChecks } from './checks/your-category.checks.js';

// Add to executeChecks() method
this.runCheckGroup('your-category', () => runYourChecks(context)),
```

3. Update category enum in schema:
```prisma
// apps/api/prisma/schema.prisma

enum CheckCategory {
  // ... existing categories
  your_category
}
```

## Support

For issues with diagnostics:
1. Check this documentation
2. Review API logs
3. Run diagnostics in test mode
4. Contact system administrator
