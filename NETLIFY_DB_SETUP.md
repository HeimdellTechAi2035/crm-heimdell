# Netlify DB Integration

This document describes how to set up and use the Netlify DB (Neon Postgres) integration for Heimdell CRM.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│   Netlify Functions          │────▶│   Neon Postgres  │
│   (React)       │     │   /.netlify/functions/*      │     │   (DATABASE_URL) │
│                 │     │                              │     │                  │
│   NO DB SECRETS │     │   @netlify/neon              │     │   All data       │
│   NO DIRECT DB  │     │   validateUser()             │     │   Multi-tenant   │
└─────────────────┘     └──────────────────────────────┘     └──────────────────┘
```

## Security Rules (NON-NEGOTIABLE)

1. **Frontend NEVER connects to Postgres directly**
2. **Frontend has NO database secrets**
3. **ALL DB operations go through Netlify Functions**
4. **All queries filter by `user_id` for multi-tenant isolation**

## Setup

### 1. Create Neon Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy the connection string (DATABASE_URL)

### 2. Run Schema

Connect to your Neon database and run:

```bash
psql "YOUR_DATABASE_URL" -f netlify/db/schema.sql
```

Or copy the contents of [netlify/db/schema.sql](netlify/db/schema.sql) into the Neon SQL Editor.

### 3. Configure Netlify

**Option A: Via Netlify Dashboard**
1. Go to Site Settings → Environment Variables
2. Add `DATABASE_URL` with your Neon connection string

**Option B: Via Netlify CLI**
```bash
netlify env:set DATABASE_URL "postgresql://..."
```

**Option C: Netlify Neon Integration**
1. Go to Site Settings → Integrations
2. Add Neon integration
3. DATABASE_URL is auto-configured

### 4. Local Development

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Then run:

```bash
npm install
npx netlify dev
```

The app will be available at `http://localhost:8888`

## API Endpoints

All endpoints are under `/.netlify/functions/`

### Import CSV
```http
POST /.netlify/functions/import_csv
Content-Type: application/json

{
  "email": "user@example.com",
  "csv_text": "company_name,website,phone\n..."
}
```

Response:
```json
{
  "success": true,
  "import_job_id": "uuid",
  "total": 100,
  "companies_created": 80,
  "companies_updated": 20,
  "leads_created": 100,
  "deals_created": 100,
  "errors": []
}
```

### List Companies
```http
GET /.netlify/functions/list_companies?search=abc&limit=50
X-User-Email: user@example.com
```

### List Leads
```http
GET /.netlify/functions/list_leads?status=new
X-User-Email: user@example.com
```

### List Deals
```http
GET /.netlify/functions/list_deals?stage=qualified
X-User-Email: user@example.com
```

### Get Pipelines
```http
GET /.netlify/functions/pipelines
X-User-Email: user@example.com
```

### Upsert Company
```http
POST /.netlify/functions/company_upsert
Content-Type: application/json
X-User-Email: user@example.com

{
  "name": "Acme Corp",
  "website": "https://acme.com",
  "phone": "123-456-7890"
}
```

### Create Lead
```http
POST /.netlify/functions/lead_create
Content-Type: application/json
X-User-Email: user@example.com

{
  "company_id": "uuid",
  "status": "new",
  "source": "manual"
}
```

### Create Deal
```http
POST /.netlify/functions/deal_create
Content-Type: application/json
X-User-Email: user@example.com

{
  "company_id": "uuid",
  "title": "Big Deal",
  "stage": "qualified",
  "value": 10000
}
```

### Update Deal
```http
POST /.netlify/functions/deal_update
Content-Type: application/json
X-User-Email: user@example.com

{
  "deal_id": "uuid",
  "stage": "won",
  "value": 15000
}
```

### Delete Entity
```http
POST /.netlify/functions/delete
Content-Type: application/json
X-User-Email: user@example.com

{
  "type": "company",
  "id": "uuid"
}
```

## CSV Column Mapping

The import function automatically maps these CSV columns:

| CSV Column | Database Field |
|------------|----------------|
| `place/name`, `company_name`, `name` | `companies.name` |
| `place/website_url`, `website` | `companies.website` |
| `place/phone`, `phone` | `companies.phone` |
| `place/address`, `address` | `companies.address` |
| `place/ranking`, `ranking` | `companies.ranking` |
| `market`, `market_share` | `companies.market` |
| `place/review_count`, `reviews` | `companies.review_count` |
| `place/ave_review_rating`, `rating` | `companies.review_rating` |
| `place/main_category`, `category` | `companies.main_category` |

**Unknown columns are stored in the `meta` JSONB field - NO DATA IS LOST.**

## Duplicate Handling

Companies are unique per user by normalized name:
- "Acme Corp" and "ACME CORP" are the same company
- "Acme Corp Ltd" and "Acme Corp" are the same company
- Company suffixes (Ltd, LLC, Inc) are ignored for matching

When a duplicate is found:
- Company is UPDATED (not duplicated)
- New fields overwrite old fields (unless new value is empty)
- Meta fields are merged

## File Structure

```
netlify/
├── db/
│   └── schema.sql          # Database schema
└── functions/
    ├── lib/
    │   ├── auth.mjs        # User validation (PLACEHOLDER - replace with real auth)
    │   ├── csv-parser.mjs  # CSV parsing utilities
    │   ├── db.mjs          # Database connection using @netlify/neon
    │   └── response.mjs    # CORS and response helpers
    ├── company_upsert.mjs  # Create/update company
    ├── deal_create.mjs     # Create deal
    ├── deal_update.mjs     # Update deal stage/value
    ├── delete.mjs          # Delete company/lead/deal
    ├── import_csv.mjs      # Bulk CSV import
    ├── lead_create.mjs     # Create lead
    ├── list_companies.mjs  # List companies with filters
    ├── list_deals.mjs      # List deals with filters
    ├── list_leads.mjs      # List leads with filters
    └── pipelines.mjs       # Get pipeline stages
```

## Authentication

The `validateUser()` function in `lib/auth.mjs` is a **PLACEHOLDER**.

Currently it:
- Accepts `user_id` or `email` from request body/headers
- Auto-creates users if email is provided
- Uses `X-User-Email` or `X-User-Id` headers

**For production, replace with:**
- JWT verification
- Supabase auth token validation
- Session cookie validation
- API key validation

## Testing Locally

1. Start the dev server:
```bash
npx netlify dev
```

2. Test the import endpoint:
```bash
curl -X POST http://localhost:8888/.netlify/functions/import_csv \
  -H "Content-Type: application/json" \
  -H "X-User-Email: test@example.com" \
  -d '{"csv_text": "place/name,place/phone\nAcme Corp,123-456-7890"}'
```

3. List companies:
```bash
curl http://localhost:8888/.netlify/functions/list_companies \
  -H "X-User-Email: test@example.com"
```

## Deployment

1. Push to your connected Git repository
2. Netlify auto-deploys
3. Ensure DATABASE_URL is set in environment variables

Or deploy manually:
```bash
netlify deploy --prod
```
