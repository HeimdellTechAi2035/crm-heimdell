# Quick Setup Guide - CSV Import Feature

## 1. Install Dependencies

```bash
cd apps/api
pnpm install
```

This will install the new `@fastify/multipart` package.

## 2. Run Database Migration

```bash
pnpm db:migrate
```

This creates:
- `import_jobs` table
- `import_rows` table
- Adds `profile_summary`, `profile_json`, `profile_last_generated_at` to `leads` and `companies`

## 3. Start the Services

```bash
# In root directory
pnpm dev
```

This starts:
- API server with import routes on port 3000
- Import worker (BullMQ)
- Web app on port 5173

## 4. Test the Feature

### Option A: Use the UI

1. Open http://localhost:5173
2. Login with demo account
3. Click "Import CSV" in sidebar
4. Upload the sample CSV (see below)
5. Map columns
6. Watch it import!

### Option B: Use the API

```bash
# Upload CSV
curl -X POST http://localhost:3000/api/imports/csv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@sample_leads.csv"

# Configure mapping
curl -X POST http://localhost:3000/api/imports/IMPORT_ID/mapping \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadMapping": {
      "firstName": "First Name",
      "lastName": "Last Name",
      "email": "Email",
      "phone": "Phone",
      "title": "Job Title"
    },
    "companyMapping": {
      "name": "Company",
      "industry": "Industry"
    },
    "duplicateHandling": "skip",
    "generateProfiles": true
  }'

# Check status
curl http://localhost:3000/api/imports/IMPORT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Sample CSV File

Create `sample_leads.csv`:

```csv
First Name,Last Name,Email,Phone,Job Title,Company,Industry,Location
John,Smith,john.smith@acmecorp.co.uk,07700900123,CEO,Acme Corp,SaaS,London
Sarah,Johnson,sarah.j@techstart.io,07700900124,CTO,TechStart,Technology,Manchester
Michael,Brown,m.brown@consulting.com,07700900125,Director,Brown Consulting,Consulting,Birmingham
Emma,Wilson,emma@designstudio.uk,07700900126,Founder,Wilson Design,Creative,Leeds
David,Taylor,david.taylor@finance.co.uk,07700900127,CFO,Taylor Finance,Finance,Edinburgh
Lisa,Anderson,l.anderson@marketing.com,07700900128,Head of Marketing,Anderson Marketing,Marketing,Bristol
James,Thomas,james@property.co.uk,07700900129,Managing Director,Thomas Property,Real Estate,Cardiff
Sophie,Roberts,sophie.r@legal.com,07700900130,Partner,Roberts Legal,Legal,Glasgow
Tom,Walker,tom@garage.co.uk,07700900131,Owner,Walker's Garage,Automotive,Liverpool
Rachel,White,rachel@restaurant.co.uk,07700900132,Manager,White's Restaurant,Hospitality,Newcastle
```

## What Happens During Import

1. **Upload** (instant):
   - File validated (size, type)
   - CSV parsed, delimiter auto-detected
   - Preview rows extracted
   - All rows stored in `import_rows` table
   - ImportJob created with status `mapping_required`

2. **Mapping** (instant):
   - User maps columns to CRM fields
   - Mapping validated (requires email/phone/name)
   - Import job queued for processing
   - Status changes to `importing`

3. **Processing** (background, ~1-5 minutes depending on size):
   - Worker picks up job from queue
   - Processes rows one by one:
     - Creates/updates companies (if mapped)
     - Creates/updates leads
     - Handles duplicates based on settings
     - Records errors for failed rows
   - Updates progress every 10 rows
   - Marks job as `completed` or `failed`

4. **Profile Generation** (background, ~2-10 minutes):
   - Separate worker generates AI profiles
   - One profile per lead/company
   - Structured JSON + readable summary
   - Stored in `profile_json` and `profile_summary` fields

## Verification

After import completes:

1. **Check Import Status**:
   ```bash
   curl http://localhost:3000/api/imports/IMPORT_ID/status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

   Should show:
   ```json
   {
     "status": "completed",
     "totalRows": 10,
     "importedCount": 10,
     "failedCount": 0,
     "skippedCount": 0,
     "progress": 100
   }
   ```

2. **Check Leads Were Created**:
   ```bash
   curl http://localhost:3000/api/leads \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check Profile Was Generated**:
   ```bash
   curl http://localhost:3000/api/leads/LEAD_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

   Should include:
   ```json
   {
     "profileSummary": "...",
     "profileJson": { 
       "one_liner": "...",
       "pain_points": [...],
       "next_best_action": "..."
     },
     "profileLastGeneratedAt": "2025-12-16T..."
   }
   ```

4. **Check UI**:
   - Go to Leads page
   - See blue "🤖 AI Profile" badges on lead cards
   - Click lead to see full profile

## Troubleshooting

### "Import job not found"
- Check you're using the correct import_job_id
- Ensure you're authenticated with the right organization

### "Import stuck in 'importing'"
- Check API logs for worker errors
- Verify Redis is running: `docker ps | grep redis`
- Restart worker: `pnpm dev` (restarts all services)

### "No profiles generated"
- Check OpenAI API key is set in `.env`
- Check AI usage limit hasn't been reached
- Check API logs for OpenAI errors

### "Duplicates not detected"
- Email matching is case-insensitive and exact
- Phone matching uses normalized E.164 format
- Name+company matching is less strict
- Use "update" mode to overwrite existing records

## Performance Notes

**Import Speed:**
- Small CSV (10-100 rows): 5-15 seconds
- Medium CSV (1000 rows): 1-3 minutes
- Large CSV (10,000 rows): 10-30 minutes

**Profile Generation Speed:**
- ~1-2 seconds per profile
- Runs in background, doesn't block import
- Concurrent generation (multiple profiles at once)

**Redis Queue:**
- Import jobs: Concurrency 2
- Profile jobs: Concurrency 5 (default)

## What to Expect

✅ **It works:** Upload → Map → Import → Profiles generated
✅ **It's fast:** Small imports complete in seconds
✅ **It's reliable:** Errors don't crash the whole import
✅ **It's smart:** De-duplication prevents doubles
✅ **It's useful:** AI profiles give real insights

---

**Ready to test?** Upload `sample_leads.csv` and watch the magic happen! 🚀
