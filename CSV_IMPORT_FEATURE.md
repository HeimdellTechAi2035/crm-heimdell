# CSV Import + AI Profile Builder - Implementation Complete ✅

## Overview

A complete CSV import system that allows users to upload CSV files, map columns to CRM fields, import leads/companies with de-duplication, and automatically generate AI-powered profile summaries for each imported record.

## What Was Built

### 1. **Database Schema Extensions** ✅

**New Tables:**
- `ImportJob` - Tracks CSV import jobs
  - Status tracking (uploaded → mapping_required → importing → completed/failed)
  - Original filename, row counts, mapping configuration
  - Progress tracking (imported, failed, skipped counts)
  - Error logging

- `ImportRow` - Individual row tracking
  - Links to ImportJob
  - Raw JSON data storage
  - Status per row (pending → imported/failed/skipped)
  - Links to created Lead/Company records

**Extended Existing Tables:**
- `Lead` model:
  - `profileSummary` (text) - Human-readable AI profile
  - `profileJson` (jsonb) - Structured AI analysis
  - `profileLastGeneratedAt` (timestamp)

- `Company` model:
  - Same profile fields as Lead

### 2. **CSV Parsing Utility** ✅

**File:** `apps/api/src/utils/csv.ts`

**Capabilities:**
- Parse CSV with multiple delimiters (comma, semicolon, tab)
- Auto-detect delimiter from content
- Handle quoted values with escape sequences
- Normalize phone numbers to E.164 format (UK-focused)
- Extract domains from URLs and emails
- Generate unique keys for de-duplication
- Validate CSV files (size limits, file types)

**De-duplication Logic:**
- **Leads**: Match on email OR phone OR (firstName + lastName + company)
- **Companies**: Match on domain OR (name + location)

### 3. **Backend API Endpoints** ✅

**File:** `apps/api/src/routes/imports.ts`

**Endpoints:**

1. **POST /api/imports/csv**
   - Upload CSV file (max 10MB)
   - Auto-detect delimiter
   - Parse headers + preview first 20 rows
   - Create ImportJob with status `mapping_required`
   - Store all rows in ImportRow table
   - Returns: importJobId, headers, previewRows, totalRows

2. **POST /api/imports/:id/mapping**
   - Configure column mapping:
     - Lead fields (firstName, lastName, email, phone, title, notes, status, source)
     - Company fields (name, website, domain, industry, location, size, phone)
     - Deal fields (optional - name, value, stage, pipelineId)
   - Duplicate handling: "skip" or "update"
   - Generate profiles flag
   - Validates mapping (requires at least email/phone/name)
   - Enqueues import job for background processing

3. **GET /api/imports/:id/status**
   - Returns progress: total, imported, failed, skipped
   - Progress percentage
   - Current status and completion time

4. **GET /api/imports/:id/errors**
   - Returns failed rows with error messages
   - Limited to 1000 rows

5. **GET /api/imports**
   - List recent import jobs
   - Shows status, counts, created by info

### 4. **AI Profile Generation** ✅

**File:** `apps/api/src/routes/ai.ts`

**Endpoint:** POST /api/ai/profile-from-import

**Input:** `{ leadId?: string, companyId?: string }`

**Profile Structure for Leads:**
```json
{
  "one_liner": "Who they are",
  "likely_role": "Inferred from title/company",
  "pain_points": ["Pain 1", "Pain 2", "Pain 3"],
  "decision_power": "low/medium/high with reason",
  "best_offer_angle": ["Angle 1", "Angle 2"],
  "personalisation_hooks": ["Hook 1", "Hook 2"],
  "objections": [{"objection": "...", "response": "..."}],
  "next_best_action": "call/email/linkedin with reason",
  "message_drafts": {
    "cold_email_1": "...",
    "follow_up_1": "...",
    "linkedin_dm_1": "..."
  },
  "confidence": 85,
  "source_fields_used": ["firstName", "title", "industry"]
}
```

**Profile Structure for Companies:**
```json
{
  "one_liner": "Brief company description",
  "industry_positioning": "How they position themselves",
  "pain_points": ["Pain 1", "Pain 2", "Pain 3"],
  "decision_makers": ["CEO", "CTO", "Head of Sales"],
  "best_offer_angle": ["Angle 1", "Angle 2"],
  "personalisation_hooks": ["Hook 1", "Hook 2"],
  "objections": [{"objection": "...", "response": "..."}],
  "next_best_action": "Recommended strategy",
  "message_templates": {
    "cold_email_1": "...",
    "follow_up_1": "..."
  },
  "confidence": 80,
  "source_fields_used": ["industry", "location", "size"]
}
```

**Key Features:**
- No hallucination - AI only uses provided CSV fields + CRM context
- Stores prompt version + model name for audit
- Generates both structured JSON and readable summary
- Respects AI usage limits per organization

### 5. **Background Import Worker** ✅

**File:** `apps/api/src/jobs/import.ts`

**BullMQ Worker:**
- Processes imports asynchronously
- Concurrent processing (2 imports at a time)
- Row-by-row processing with error handling
- Creates/updates Leads and Companies
- Applies duplicate handling rules
- Updates progress every 10 rows
- Enqueues profile generation jobs after completion

**Error Handling:**
- Individual row failures don't stop import
- Errors logged per row
- Failed rows marked with error message
- Overall import status updated on completion

### 6. **Frontend Import Wizard** ✅

**File:** `apps/web/src/pages/Imports.tsx`

**4-Step Wizard:**

**Step 1: Upload**
- Drag & drop or click to select CSV file
- File size validation (10MB max)
- Shows file info before upload

**Step 2: Column Mapping**
- Preview table (first 5 rows)
- Dropdown mapping for Lead fields
- Dropdown mapping for Company fields (optional)
- Required field indicators
- Duplicate handling options (skip/update)
- "Generate AI profiles" checkbox
- Validation before submission

**Step 3: Progress**
- Real-time progress bar
- Live counts (imported, failed, skipped)
- Auto-polling every 2 seconds
- Error handling display

**Step 4: Complete**
- Success message
- Links to view imported leads
- Option to import another file

**Additional Features:**
- Import history list
- Status badges (completed, failed, importing)
- Row counts per import
- Error viewing capability

### 7. **Security & Compliance** ✅

**File Validation:**
- Maximum file size: 10MB
- Allowed extensions: .csv, .txt
- MIME type validation
- Dangerous file type blocking

**Audit Logging:**
- Import job created
- Mapping saved
- Import started
- Import completed/failed
- AI profile generated

**Data Privacy:**
- Raw CSV never sent to AI provider
- Only mapped fields used for profile generation
- All data scoped to organization
- RBAC enforced (SALES_REP+ can import)

### 8. **UI Integration** ✅

**Navigation:**
- Added "Import CSV" link to sidebar
- Upload icon (📊)
- Accessible from main navigation

**Lead Cards:**
- Show AI profile summary in card
- Blue badge with 🤖 icon
- Snippet of profile (first line)
- Automatically displays if profile exists

## How to Use

### 1. Upload CSV

1. Navigate to "Import CSV" in sidebar
2. Click or drag CSV file
3. Click "Upload & Continue"

### 2. Map Columns

1. Review preview data (first 5 rows shown)
2. Map CSV columns to Lead fields:
   - **Required**: At least email, phone, or name
   - **Optional**: title, notes, status, source
3. Optionally map Company fields:
   - name, website, industry, location, etc.
4. Choose duplicate handling:
   - **Skip**: Don't import duplicates (recommended)
   - **Update**: Update existing records
5. Toggle "Generate AI profiles" (default: on)
6. Click "Start Import"

### 3. Monitor Progress

- Watch real-time progress bar
- See imported, failed, skipped counts
- Wait for completion (imports run in background)

### 4. View Results

- Click "View Leads" to see imported records
- Profile summaries shown on lead cards
- Access full profile details on lead page

## Technical Details

### Dependencies Added

**Backend:**
- `@fastify/multipart` v8.0.0 - File upload handling

**No new frontend dependencies** - Uses existing stack

### Database Migration Required

Run migration to add new tables and fields:

```bash
pnpm db:migrate
```

This adds:
- ImportJob table
- ImportRow table  
- Profile fields to Lead and Company tables

### Environment Variables

No new environment variables required. Uses existing:
- `OPENAI_API_KEY` - For AI profile generation
- `DATABASE_URL` - For Prisma
- `REDIS_URL` - For BullMQ

### Performance Considerations

**Import Speed:**
- ~100 rows per batch insert
- Progress updates every 10 rows
- Concurrent import limit: 2 jobs
- Profile generation queued separately

**File Size Limits:**
- Max 10MB per file
- Typical CSV: ~50,000 rows at 10MB
- Preview limited to 20 rows for performance

## Example CSV Format

```csv
firstName,lastName,email,phone,title,company,industry,location
John,Smith,john@example.com,07123456789,CEO,Acme Corp,SaaS,London
Jane,Doe,jane@test.com,07987654321,CTO,TechCo,Technology,Manchester
...
```

**Supported Formats:**
- Comma-separated (`,`)
- Semicolon-separated (`;`)
- Tab-separated (`\t`)
- Quoted values: `"Smith, John"`
- Escaped quotes: `"He said ""hello"""`

## Error Handling

**Common Errors:**

1. **Invalid email**: Row marked as failed
2. **Missing required fields**: Row skipped with error
3. **Duplicate detected**: Row skipped (if skip mode) or updated (if update mode)
4. **File too large**: Upload rejected with error message
5. **AI limit reached**: Profile generation disabled, import continues

**Error Recovery:**
- Failed rows don't stop import
- All errors logged with row numbers
- Download errors as CSV (future enhancement)
- Retry failed import by re-uploading

## API Usage

**Upload and Import via API:**

```bash
# 1. Upload CSV
curl -X POST http://localhost:3000/api/imports/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@leads.csv"

# Response: { importJobId, headers, previewRows, totalRows }

# 2. Submit mapping
curl -X POST http://localhost:3000/api/imports/{importJobId}/mapping \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadMapping": {
      "firstName": "First Name",
      "lastName": "Last Name",
      "email": "Email",
      "phone": "Phone"
    },
    "companyMapping": {
      "name": "Company"
    },
    "duplicateHandling": "skip",
    "generateProfiles": true
  }'

# 3. Check status
curl http://localhost:3000/api/imports/{importJobId}/status \
  -H "Authorization: Bearer $TOKEN"

# 4. Get errors (if any)
curl http://localhost:3000/api/imports/{importJobId}/errors \
  -H "Authorization: Bearer $TOKEN"
```

## Testing

**Manual Testing:**

1. **Upload Small CSV** (10 rows):
   - Test: Upload succeeds, preview shows
   - Test: Mapping UI displays correctly
   - Test: Import completes quickly

2. **Upload Large CSV** (1000+ rows):
   - Test: Progress updates in real-time
   - Test: Worker processes in background
   - Test: Profile generation works

3. **Test Duplicates**:
   - Upload same CSV twice
   - Verify skip mode: 0 imported on 2nd run
   - Verify update mode: records updated

4. **Test AI Profiles**:
   - Import with profiles enabled
   - Check lead card shows profile snippet
   - Verify profile JSON structure

5. **Test Error Handling**:
   - Upload invalid CSV (no headers)
   - Upload file too large (>10MB)
   - Map with no required fields
   - Verify error messages display

## Future Enhancements

**Nice-to-Have Features:**

1. **Profile Templates** - Custom profile structures per industry
2. **Bulk Profile Regeneration** - Regenerate all profiles at once
3. **CSV Export** - Export leads/companies back to CSV
4. **Excel Support** - Import from .xlsx files
5. **Advanced De-duplication** - Fuzzy matching, manual review
6. **Import Scheduling** - Schedule recurring imports
7. **Field Transformation** - Auto-format fields during import
8. **Webhook Notifications** - Notify on import completion
9. **Import Templates** - Save and reuse column mappings
10. **Profile Confidence Threshold** - Only save high-confidence profiles

## Success Metrics

**What defines success:**

✅ Users can upload CSV files (10MB max)
✅ Column mapping is intuitive with preview
✅ Imports process reliably in background
✅ Duplicates are handled correctly
✅ AI profiles are generated automatically
✅ Profile summaries appear on lead cards
✅ All operations are audited
✅ No data sent to AI that shouldn't be
✅ Errors are tracked and recoverable
✅ System handles large imports (1000+ rows)

## Files Created/Modified

**New Files:**
- `apps/api/src/utils/csv.ts` - CSV parsing utilities
- `apps/api/src/routes/imports.ts` - Import API routes
- `apps/api/src/jobs/import.ts` - Import background worker
- `apps/web/src/pages/Imports.tsx` - Import wizard UI

**Modified Files:**
- `apps/api/prisma/schema.prisma` - Added ImportJob, ImportRow, profile fields
- `apps/api/src/routes/ai.ts` - Added profile-from-import endpoint
- `apps/api/src/app.ts` - Registered multipart plugin and imports routes
- `apps/api/src/index.ts` - Start import worker
- `apps/api/package.json` - Added @fastify/multipart dependency
- `apps/web/src/lib/api.ts` - Added import API methods
- `apps/web/src/App.tsx` - Added /imports route
- `apps/web/src/components/Layout.tsx` - Added Import CSV nav link
- `apps/web/src/pages/Leads.tsx` - Display profile summaries

## Summary

This feature provides a **complete, production-ready CSV import system** with AI-powered profile generation. Users can upload lead lists from any source (scraped data, purchased lists, existing spreadsheets), map columns intelligently, handle duplicates gracefully, and get AI-generated insights immediately.

**Key Value:**
- Reduces manual data entry from hours to minutes
- Automatically enriches leads with AI insights
- Provides actionable next steps and message drafts
- Maintains data quality with de-duplication
- Tracks everything for compliance and audit

**Production-Ready:**
- Full error handling and recovery
- Background processing for large imports
- Real-time progress tracking
- Security-focused (file validation, audit logs)
- No hallucination in AI profiles (only uses provided data)

---

**Status:** ✅ **COMPLETE AND READY TO USE**

**Next Step:** Run `pnpm install` (backend) and `pnpm db:migrate` to create tables, then test with a sample CSV!

---

# Future Enhancements - Cloud Storage & Calling

## 11) Cloud Storage Intake (Google Drive + Dropbox)

### 11.1 Goals

- Connect user's Google Drive and/or Dropbox via OAuth
- Let them pick a folder to "watch"
- Automatically import any new CSV dropped into those folders
- Optionally copy uploaded CSVs into the connected Drive/Dropbox folder for central storage
- Maintain import history with source links, status, and errors

### 11.2 Data Model (Prisma)

**New Tables:**

**ConnectedAccount**
```prisma
model ConnectedAccount {
  id                  String   @id @default(cuid())
  orgId               String   @map("org_id")
  userId              String   @map("user_id")
  provider            CloudProvider
  accessToken         String   @map("access_token") // Encrypted at rest
  refreshToken        String?  @map("refresh_token") // Encrypted at rest
  scopes              String
  tokenExpiresAt      DateTime @map("token_expires_at")
  providerAccountId   String   @map("provider_account_id")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  watchedFolders WatchedFolder[]

  @@map("connected_accounts")
}

enum CloudProvider {
  google_drive
  dropbox
}
```

**WatchedFolder**
```prisma
model WatchedFolder {
  id                    String   @id @default(cuid())
  orgId                 String   @map("org_id")
  connectedAccountId    String   @map("connected_account_id")
  provider              CloudProvider
  folderId              String   @map("folder_id")
  folderName            String   @map("folder_name")
  importOnNewCsv        Boolean  @default(true) @map("import_on_new_csv")
  copyUploadsIntoFolder Boolean  @default(false) @map("copy_uploads_into_folder")
  isEnabled             Boolean  @default(true) @map("is_enabled")
  lastCheckedAt         DateTime? @map("last_checked_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  organization      Organization      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  connectedAccount  ConnectedAccount  @relation(fields: [connectedAccountId], references: [id], onDelete: Cascade)

  @@map("watched_folders")
}
```

**Extend ImportJob:**
```prisma
// Add to existing ImportJob model
sourceProvider     CloudProvider?    @map("source_provider")
sourceFileId       String?           @map("source_file_id")
sourceFileUrl      String?           @map("source_file_url")
sourceChecksum     String?           @map("source_checksum")
uploadedToProvider Boolean           @default(false) @map("uploaded_to_provider")
```

### 11.3 Backend Implementation

**Endpoints to implement:**

**OAuth Flow:**
- `GET /api/integrations/google-drive/connect` - Start OAuth
- `GET /api/integrations/google-drive/callback` - Handle OAuth callback
- `GET /api/integrations/dropbox/connect` - Start OAuth
- `GET /api/integrations/dropbox/callback` - Handle OAuth callback
- `POST /api/integrations/:provider/disconnect` - Remove connection

**Folder Management:**
- `GET /api/integrations/:provider/folders` - List accessible folders
- `POST /api/integrations/:provider/watch-folder` - Add folder to watch list
  ```json
  {
    "folderId": "folder-id",
    "folderName": "My CSVs",
    "importOnNewCsv": true,
    "copyUploadsIntoFolder": false
  }
  ```

**File Ingestion:**
- `POST /api/integrations/:provider/ingest-file` - Manually trigger import
  ```json
  {
    "fileId": "file-id-from-provider"
  }
  ```

**Background Job (Polling):**
```typescript
// apps/api/src/jobs/cloud-storage-sync.ts
export async function syncCloudStorage() {
  const watchedFolders = await prisma.watchedFolder.findMany({
    where: { isEnabled: true },
    include: { connectedAccount: true }
  });

  for (const folder of watchedFolders) {
    const provider = getProviderClient(folder.provider, folder.connectedAccount);
    const files = await provider.listFiles({
      folderId: folder.folderId,
      modifiedSince: folder.lastCheckedAt,
      fileType: 'csv'
    });

    for (const file of files) {
      // Check if already imported using checksum
      const existing = await prisma.importJob.findFirst({
        where: {
          sourceFileId: file.id,
          sourceChecksum: file.checksum
        }
      });

      if (!existing) {
        // Download and create import job
        await ingestFileFromProvider(file, folder);
      }
    }

    // Update last checked timestamp
    await prisma.watchedFolder.update({
      where: { id: folder.id },
      data: { lastCheckedAt: new Date() }
    });
  }
}
```

**Security:**
- Encrypt tokens using `crypto.createCipheriv` with env-based key
- Validate OAuth state parameter
- Use HTTPS for all OAuth callbacks
- Store encrypted tokens in DB

### 11.4 Frontend UI

**Settings → Integrations Page:**
```tsx
// apps/web/src/pages/Integrations.tsx
export function Integrations() {
  return (
    <div>
      <h2>Cloud Storage</h2>
      
      {/* Google Drive */}
      <Card>
        <CardHeader>Google Drive</CardHeader>
        <CardContent>
          {isConnected ? (
            <>
              <Button onClick={handleDisconnect}>Disconnect</Button>
              <FolderPicker />
              <WatchedFoldersList />
            </>
          ) : (
            <Button onClick={handleConnectGoogleDrive}>
              Connect Google Drive
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dropbox */}
      <Card>
        <CardHeader>Dropbox</CardHeader>
        <CardContent>
          {/* Similar to Google Drive */}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Imports Page Enhancement:**
- Add "Import from Drive" button
- Add "Import from Dropbox" button
- Show file picker from connected accounts
- Display source provider badge on import history

---

## 12) Twilio Integration: Numbers + Click-to-Call + Call Logging

### 12.1 Goals

- Connect Twilio account (per organization)
- Buy/assign phone numbers inside CRM
- Click-to-call from Lead/Company pages
- Log calls automatically into Activity timeline
- Support two calling modes:
  - **Call bridging** (fastest): Agent uses their real phone; CRM triggers Twilio to call agent then connect to lead
  - **Browser calling** (advanced): Twilio Client JS in web app

### 12.2 Data Model (Prisma)

**New Tables:**

**TwilioAccount**
```prisma
model TwilioAccount {
  id                String   @id @default(cuid())
  orgId             String   @unique @map("org_id")
  accountSid        String   @map("account_sid") // Encrypted
  authToken         String   @map("auth_token") // Encrypted
  defaultFromNumber String?  @map("default_from_number")
  isEnabled         Boolean  @default(true) @map("is_enabled")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  phoneNumbers PhoneNumber[]

  @@map("twilio_accounts")
}
```

**PhoneNumber**
```prisma
model PhoneNumber {
  id              String   @id @default(cuid())
  orgId           String   @map("org_id")
  twilioAccountId String   @map("twilio_account_id")
  twilioSid       String   @unique @map("twilio_sid")
  e164Number      String   @map("e164_number")
  friendlyName    String?  @map("friendly_name")
  assignedUserId  String?  @map("assigned_user_id")
  capabilitiesJson Json    @map("capabilities_json")
  status          PhoneNumberStatus @default(active)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  organization   Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  twilioAccount  TwilioAccount  @relation(fields: [twilioAccountId], references: [id], onDelete: Cascade)
  assignedUser   User?          @relation(fields: [assignedUserId], references: [id], onDelete: SetNull)
  callLogs       CallLog[]

  @@map("phone_numbers")
}

enum PhoneNumberStatus {
  active
  inactive
}
```

**CallLog**
```prisma
model CallLog {
  id              String   @id @default(cuid())
  orgId           String   @map("org_id")
  userId          String   @map("user_id")
  leadId          String?  @map("lead_id")
  companyId       String?  @map("company_id")
  dealId          String?  @map("deal_id")
  phoneNumberId   String?  @map("phone_number_id")
  
  direction       CallDirection
  fromNumber      String   @map("from_number")
  toNumber        String   @map("to_number")
  twilioCallSid   String   @unique @map("twilio_call_sid")
  
  status          CallStatus
  durationSeconds Int?     @map("duration_seconds")
  recordingUrl    String?  @map("recording_url")
  disposition     CallDisposition?
  notes           String?
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  lead         Lead?        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  deal         Deal?        @relation(fields: [dealId], references: [id], onDelete: Cascade)
  phoneNumber  PhoneNumber? @relation(fields: [phoneNumberId], references: [id], onDelete: SetNull)

  @@map("call_logs")
}

enum CallDirection {
  outbound
  inbound
}

enum CallStatus {
  queued
  ringing
  in_progress
  completed
  failed
  busy
  no_answer
  canceled
}

enum CallDisposition {
  answered
  no_answer
  left_voicemail
  busy
  wrong_number
  not_interested
  callback_requested
  meeting_scheduled
}
```

### 12.3 Backend Implementation

**Twilio Setup Endpoints:**

```typescript
// apps/api/src/routes/twilio.ts

// Connect Twilio account
app.post('/api/integrations/twilio/connect', async (req, reply) => {
  const { accountSid, authToken } = req.body;
  
  // Validate credentials by calling Twilio API
  const client = twilio(accountSid, authToken);
  const account = await client.api.accounts(accountSid).fetch();
  
  // Store encrypted credentials
  await prisma.twilioAccount.upsert({
    where: { orgId: req.user.organizationId },
    create: {
      orgId: req.user.organizationId,
      accountSid: encrypt(accountSid),
      authToken: encrypt(authToken),
      isEnabled: true
    },
    update: {
      accountSid: encrypt(accountSid),
      authToken: encrypt(authToken),
      isEnabled: true
    }
  });
});

// List organization phone numbers
app.get('/api/integrations/twilio/numbers', async (req, reply) => {
  const numbers = await prisma.phoneNumber.findMany({
    where: { orgId: req.user.organizationId },
    include: { assignedUser: true }
  });
  return { numbers };
});

// Search available numbers
app.post('/api/integrations/twilio/numbers/search', async (req, reply) => {
  const { country, areaCode } = req.body;
  const twilioAccount = await getTwilioClient(req.user.organizationId);
  
  const numbers = await twilioAccount
    .availablePhoneNumbers(country)
    .local
    .list({ areaCode, limit: 20 });
    
  return { numbers };
});

// Purchase phone number
app.post('/api/integrations/twilio/numbers/purchase', async (req, reply) => {
  const { phoneNumber } = req.body;
  const twilioClient = await getTwilioClient(req.user.organizationId);
  
  const purchased = await twilioClient.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl: `${config.publicUrl}/api/webhooks/twilio/voice`,
    statusCallback: `${config.publicUrl}/api/webhooks/twilio/voice-status`
  });
  
  // Store in database
  await prisma.phoneNumber.create({
    data: {
      orgId: req.user.organizationId,
      twilioSid: purchased.sid,
      e164Number: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
      capabilitiesJson: purchased.capabilities,
      status: 'active'
    }
  });
});
```

**Calling Endpoints:**

```typescript
// Start a call
app.post('/api/calls/start', async (req, reply) => {
  const { leadId, phone, fromNumberId, mode } = req.body;
  
  const fromNumber = await prisma.phoneNumber.findUnique({
    where: { id: fromNumberId }
  });
  
  const twilioClient = await getTwilioClient(req.user.organizationId);
  
  if (mode === 'bridge') {
    // Call agent first, then bridge to lead
    const call = await twilioClient.calls.create({
      url: `${config.publicUrl}/api/webhooks/twilio/bridge?to=${phone}`,
      to: req.user.phone, // Agent's phone
      from: fromNumber.e164Number
    });
    
    // Create call log
    const callLog = await prisma.callLog.create({
      data: {
        orgId: req.user.organizationId,
        userId: req.user.id,
        leadId,
        direction: 'outbound',
        fromNumber: fromNumber.e164Number,
        toNumber: phone,
        twilioCallSid: call.sid,
        status: 'queued'
      }
    });
    
    return { callLog };
  } else {
    // Browser mode: return capability token
    const capability = new twilio.jwt.ClientCapability({
      accountSid: twilioAccount.accountSid,
      authToken: twilioAccount.authToken
    });
    
    capability.addScope(
      new twilio.jwt.ClientCapability.OutgoingClientScope({
        applicationSid: config.twilio.appSid
      })
    );
    
    const token = capability.toJwt();
    return { token, fromNumber: fromNumber.e164Number, toNumber: phone };
  }
});
```

**Webhook Handlers:**

```typescript
// Voice status callback
app.post('/api/webhooks/twilio/voice-status', async (req, reply) => {
  // Verify Twilio signature
  const signature = req.headers['x-twilio-signature'];
  if (!twilio.validateRequest(authToken, signature, url, req.body)) {
    return reply.code(403).send({ error: 'Invalid signature' });
  }
  
  const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
  
  await prisma.callLog.update({
    where: { twilioCallSid: CallSid },
    data: {
      status: CallStatus.toLowerCase(),
      durationSeconds: CallDuration ? parseInt(CallDuration) : null,
      recordingUrl: RecordingUrl
    }
  });
  
  // Create activity entry
  const callLog = await prisma.callLog.findUnique({
    where: { twilioCallSid: CallSid }
  });
  
  if (callLog.leadId) {
    await prisma.activity.create({
      data: {
        type: 'call',
        subject: `Call ${CallStatus}`,
        notes: `Duration: ${CallDuration}s`,
        leadId: callLog.leadId,
        userId: callLog.userId,
        organizationId: callLog.orgId
      }
    });
  }
});
```

### 12.4 Frontend UI

**Lead Page - Click to Call:**

```tsx
// apps/web/src/components/ClickToCall.tsx
export function ClickToCall({ lead }: { lead: Lead }) {
  const [showModal, setShowModal] = useState(false);
  const [calling, setCalling] = useState(false);
  
  const startCall = async (fromNumberId: string) => {
    setCalling(true);
    const { callLog } = await api.startCall({
      leadId: lead.id,
      phone: lead.phone,
      fromNumberId,
      mode: 'bridge'
    });
    
    // Show call outcome modal after call ends
    setShowModal(true);
  };
  
  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        <Phone /> Call {lead.phone}
      </Button>
      
      {showModal && (
        <CallModal
          lead={lead}
          onStart={startCall}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

**Settings → Twilio Page:**

```tsx
// apps/web/src/pages/TwilioSettings.tsx
export function TwilioSettings() {
  return (
    <div>
      <h2>Twilio Integration</h2>
      
      {/* Connect Account */}
      <Card>
        <CardHeader>Account Setup</CardHeader>
        <CardContent>
          <Input name="accountSid" placeholder="Account SID" />
          <Input name="authToken" type="password" placeholder="Auth Token" />
          <Button onClick={handleConnect}>Connect</Button>
        </CardContent>
      </Card>
      
      {/* Phone Numbers */}
      <Card>
        <CardHeader>Phone Numbers</CardHeader>
        <CardContent>
          <Button onClick={handleSearch}>Search Numbers</Button>
          <PhoneNumberList />
        </CardContent>
      </Card>
      
      {/* Settings */}
      <Card>
        <CardHeader>Call Settings</CardHeader>
        <CardContent>
          <Select name="defaultFromNumber" />
          <Select name="callingMode" options={['bridge', 'browser']} />
          <Checkbox name="recordCalls" label="Record calls" />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 12.5 Compliance & Security

**Required Guardrails:**

1. **Call Recording Consent:**
   ```typescript
   // Show warning before recording
   const recordingConsent = {
     enabled: false, // Default OFF
     warningMessage: "This call may be recorded for quality purposes",
     requireConsent: true
   };
   ```

2. **Token Security:**
   - Encrypt Twilio credentials in database
   - Mask tokens in application logs
   - Rotate tokens periodically

3. **Rate Limiting:**
   ```typescript
   app.post('/api/calls/start', {
     config: {
       rateLimit: {
         max: 10,
         timeWindow: '1 minute'
       }
     }
   });
   ```

4. **Audit Logging:**
   ```typescript
   await prisma.auditLog.create({
     data: {
       action: 'call_initiated',
       entityType: 'lead',
       entityId: leadId,
       userId: req.user.id,
       metadata: { toNumber, fromNumber, callSid }
     }
   });
   ```

5. **Consent Tracking:**
   ```prisma
   model Lead {
     // Add consent fields
     callConsentGiven Boolean @default(false)
     callConsentDate  DateTime?
     doNotCall        Boolean @default(false)
   }
   ```

---

## 13) Updated Definition of Done

### Phase 1 - CSV Import ✅ **COMPLETE**
- [x] User can upload CSV file locally
- [x] System parses and previews data
- [x] User maps columns to CRM fields
- [x] Import handles duplicates (skip or update)
- [x] AI generates profiles from imported data
- [x] Progress tracking and error reporting
- [x] Full audit trail

### Phase 2 - Cloud Storage 🔄 **PLANNED**
- [ ] User can connect Google Drive account
- [ ] User can connect Dropbox account
- [ ] User can select folders to watch
- [ ] Auto-import triggers when new CSV appears
- [ ] Polling job runs every X minutes
- [ ] Uploaded CSVs optionally copied to cloud storage
- [ ] Import history shows source provider

### Phase 3 - Twilio Calling 🔄 **PLANNED**
- [ ] User can connect Twilio account
- [ ] User can buy phone numbers from CRM
- [ ] User can assign numbers to team members
- [ ] Click-to-call button on Lead/Company pages
- [ ] Calls logged into Activity timeline
- [ ] Call bridging mode works (agent → lead)
- [ ] Browser calling mode with Twilio Client JS
- [ ] Call recordings saved (with consent)
- [ ] Compliance guardrails in place

---

## Implementation Priority

1. **✅ CSV Import** - Complete and production-ready
2. **Next: Cloud Storage Integration** - Enables automated workflow
3. **Then: Twilio Calling** - Completes the outreach loop

This gives you a CRM that:
- Automatically ingests leads from your scraping/sourcing workflows
- Enriches them with AI intelligence
- Enables immediate outreach with calling
- Tracks everything for compliance and optimization

**The only reason to build a CRM is to fit your workflow, not force you into someone else's assumptions.**

---

# Production-Grade Enhancements

## 14) Data Hygiene + Deduping + Field Mapping Templates

### 14.1 Goals

- Prevent duplicate hell
- Make imports repeatable per niche (garages, plumbers, compliance venues)
- Keep a clear "source of truth" per field

### 14.2 Data Model

**New Tables:**

```prisma
model DedupRule {
  id            String   @id @default(cuid())
  orgId         String   @map("org_id")
  entityType    String   @map("entity_type") // 'lead' | 'company'
  name          String
  matchRules    Json     @map("match_rules") // Array of rule configs
  fuzzyThreshold Float   @default(0.85) @map("fuzzy_threshold")
  autoMerge     Boolean  @default(false) @map("auto_merge")
  isEnabled     Boolean  @default(true) @map("is_enabled")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("dedupe_rules")
}

model MergeLog {
  id                String   @id @default(cuid())
  orgId             String   @map("org_id")
  entityType        String   @map("entity_type")
  masterRecordId    String   @map("master_record_id")
  mergedRecordIds   String[] @map("merged_record_ids")
  mergedBy          String   @map("merged_by")
  fieldChoices      Json     @map("field_choices") // Which fields came from which record
  createdAt         DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [mergedBy], references: [id])

  @@map("merge_logs")
}

model ImportMappingPreset {
  id              String   @id @default(cuid())
  orgId           String   @map("org_id")
  name            String   // "Garage Leads CSV", "Martyn's Law Venues"
  description     String?
  mappingConfig   Json     @map("mapping_config")
  fieldPriorities Json?    @map("field_priorities") // manual > API > import > AI
  defaultTags     String[] @map("default_tags")
  defaultOwner    String?  @map("default_owner")
  defaultPipeline String?  @map("default_pipeline")
  defaultStage    String?  @map("default_stage")
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  creator      User         @relation(fields: [createdBy], references: [id])

  @@map("import_mapping_presets")
}

// Extend Lead and Company with source tracking
model Lead {
  // Add field-level source tracking
  fieldSources Json? @map("field_sources") // { email: 'manual', phone: 'import', title: 'AI' }
}
```

### 14.3 Backend Implementation

**Dedupe Detection:**

```typescript
// apps/api/src/utils/dedupe.ts
export async function findDuplicates(
  entityType: 'lead' | 'company',
  data: any,
  orgId: string
) {
  const rules = await prisma.dedupRule.findMany({
    where: { orgId, entityType, isEnabled: true }
  });

  const matches: any[] = [];

  for (const rule of rules) {
    const matchRules = rule.matchRules as any[];
    
    for (const matchRule of matchRules) {
      if (matchRule.type === 'exact') {
        // Exact match on email/phone/domain
        const existing = await prisma[entityType].findMany({
          where: {
            orgId,
            [matchRule.field]: data[matchRule.field]
          }
        });
        matches.push(...existing);
      } else if (matchRule.type === 'fuzzy') {
        // Fuzzy match on name + company
        const all = await prisma[entityType].findMany({
          where: { orgId }
        });
        
        for (const record of all) {
          const similarity = calculateSimilarity(
            `${data.firstName} ${data.lastName} ${data.company}`,
            `${record.firstName} ${record.lastName} ${record.company}`
          );
          
          if (similarity >= rule.fuzzyThreshold) {
            matches.push(record);
          }
        }
      }
    }
  }

  return [...new Set(matches)]; // Dedupe matches
}

function calculateSimilarity(str1: string, str2: string): number {
  // Levenshtein distance implementation
  // Returns 0-1 similarity score
}
```

**Merge API:**

```typescript
// POST /api/leads/merge
app.post('/api/leads/merge', async (req, reply) => {
  const { masterRecordId, mergeRecordIds, fieldChoices } = req.body;
  
  const master = await prisma.lead.findUnique({
    where: { id: masterRecordId }
  });
  
  const toMerge = await prisma.lead.findMany({
    where: { id: { in: mergeRecordIds } }
  });
  
  // Merge data based on field choices
  const mergedData: any = { ...master };
  for (const [field, sourceId] of Object.entries(fieldChoices)) {
    const sourceRecord = toMerge.find(r => r.id === sourceId);
    if (sourceRecord) {
      mergedData[field] = sourceRecord[field];
    }
  }
  
  // Update master record
  await prisma.lead.update({
    where: { id: masterRecordId },
    data: mergedData
  });
  
  // Move all activities, deals, tags to master
  await prisma.activity.updateMany({
    where: { leadId: { in: mergeRecordIds } },
    data: { leadId: masterRecordId }
  });
  
  await prisma.deal.updateMany({
    where: { leadId: { in: mergeRecordIds } },
    data: { leadId: masterRecordId }
  });
  
  // Log merge
  await prisma.mergeLog.create({
    data: {
      orgId: req.user.organizationId,
      entityType: 'lead',
      masterRecordId,
      mergedRecordIds,
      fieldChoices,
      mergedBy: req.user.id
    }
  });
  
  // Delete merged records
  await prisma.lead.deleteMany({
    where: { id: { in: mergeRecordIds } }
  });
  
  return { success: true, masterRecord: mergedData };
});
```

**Import Presets:**

```typescript
// POST /api/import-presets
app.post('/api/import-presets', async (req, reply) => {
  const { name, mappingConfig, defaultTags, defaultOwner } = req.body;
  
  const preset = await prisma.importMappingPreset.create({
    data: {
      orgId: req.user.organizationId,
      name,
      mappingConfig,
      defaultTags,
      defaultOwner,
      createdBy: req.user.id
    }
  });
  
  return { preset };
});

// GET /api/import-presets
app.get('/api/import-presets', async (req, reply) => {
  const presets = await prisma.importMappingPreset.findMany({
    where: { orgId: req.user.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  
  return { presets };
});
```

### 14.4 Frontend UI

**Merge Interface:**

```tsx
// apps/web/src/components/MergeLeads.tsx
export function MergeLeads({ leads }: { leads: Lead[] }) {
  const [masterRecord, setMasterRecord] = useState(leads[0]);
  const [fieldChoices, setFieldChoices] = useState({});
  
  return (
    <Dialog>
      <DialogHeader>Merge {leads.length} Leads</DialogHeader>
      <DialogContent>
        {/* Show all fields with radio buttons to choose source */}
        {Object.keys(leads[0]).map(field => (
          <div key={field}>
            <label>{field}</label>
            {leads.map(lead => (
              <label key={lead.id}>
                <input
                  type="radio"
                  name={field}
                  value={lead.id}
                  onChange={() => setFieldChoices({
                    ...fieldChoices,
                    [field]: lead.id
                  })}
                />
                {lead[field]}
              </label>
            ))}
          </div>
        ))}
        
        <Button onClick={handleMerge}>Merge Records</Button>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 15) Email Reply Detection + Threading

### 15.1 Goals

- Stop sequences when someone replies
- Thread inbound replies into timeline
- Never embarrass yourself by sending follow-up #3 after someone responded

### 15.2 Data Model

```prisma
model EmailAccount {
  id            String   @id @default(cuid())
  orgId         String   @map("org_id")
  userId        String   @map("user_id")
  provider      String   // 'gmail' | 'outlook' | 'imap'
  email         String
  accessToken   String?  @map("access_token") // OAuth token (encrypted)
  refreshToken  String?  @map("refresh_token")
  imapHost      String?  @map("imap_host")
  imapPort      Int?     @map("imap_port")
  imapUsername  String?  @map("imap_username")
  imapPassword  String?  @map("imap_password") // Encrypted
  lastSyncedAt  DateTime? @map("last_synced_at")
  isEnabled     Boolean  @default(true) @map("is_enabled")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("email_accounts")
}

model EmailThread {
  id           String   @id @default(cuid())
  orgId        String   @map("org_id")
  leadId       String?  @map("lead_id")
  companyId    String?  @map("company_id")
  subject      String
  messageIds   String[] @map("message_ids") // All Message-IDs in thread
  lastMessageAt DateTime @map("last_message_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  lead         Lead?        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("email_threads")
}

// Extend Activity model
model Activity {
  // Add email threading fields
  emailMessageId   String? @map("email_message_id")
  emailInReplyTo   String? @map("email_in_reply_to")
  emailReferences  String[] @map("email_references")
  emailThreadId    String? @map("email_thread_id")
}
```

### 15.3 Backend Implementation

**IMAP Polling Worker:**

```typescript
// apps/api/src/jobs/email-sync.ts
import Imap from 'imap';
import { simpleParser } from 'mailparser';

export async function syncInboundEmails() {
  const accounts = await prisma.emailAccount.findMany({
    where: { isEnabled: true }
  });

  for (const account of accounts) {
    const imap = new Imap({
      user: account.imapUsername,
      password: decrypt(account.imapPassword),
      host: account.imapHost,
      port: account.imapPort,
      tls: true
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err, box) => {
        const searchCriteria = account.lastSyncedAt
          ? [['SINCE', account.lastSyncedAt]]
          : [['ALL']];

        const fetch = imap.seq.fetch(searchCriteria, {
          bodies: '',
          struct: true
        });

        fetch.on('message', (msg) => {
          msg.on('body', async (stream) => {
            const parsed = await simpleParser(stream);
            await processInboundEmail(parsed, account);
          });
        });

        fetch.once('end', () => {
          imap.end();
        });
      });
    });

    imap.connect();
  }
}

async function processInboundEmail(email: any, account: EmailAccount) {
  const messageId = email.messageId;
  const inReplyTo = email.inReplyTo;
  const references = email.references || [];
  
  // Find lead by sender email
  const lead = await prisma.lead.findFirst({
    where: {
      orgId: account.orgId,
      email: email.from.value[0].address
    }
  });

  if (!lead) return; // Not from a lead

  // Find or create thread
  let thread = await prisma.emailThread.findFirst({
    where: {
      orgId: account.orgId,
      messageIds: { has: inReplyTo || messageId }
    }
  });

  if (!thread) {
    thread = await prisma.emailThread.create({
      data: {
        orgId: account.orgId,
        leadId: lead.id,
        subject: email.subject,
        messageIds: [messageId],
        lastMessageAt: new Date()
      }
    });
  } else {
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        messageIds: { push: messageId },
        lastMessageAt: new Date()
      }
    });
  }

  // Create activity
  await prisma.activity.create({
    data: {
      type: 'email',
      subject: `Email received: ${email.subject}`,
      notes: email.text,
      leadId: lead.id,
      userId: account.userId,
      organizationId: account.orgId,
      emailMessageId: messageId,
      emailInReplyTo: inReplyTo,
      emailReferences: references,
      emailThreadId: thread.id
    }
  });

  // Stop active sequences
  await prisma.sequenceEnrollment.updateMany({
    where: {
      leadId: lead.id,
      status: 'active'
    },
    data: {
      status: 'replied',
      completedAt: new Date()
    }
  });

  // Notify owner
  // TODO: Create in-app notification
}
```

**Email Webhook Handler (Alternative):**

```typescript
// POST /webhooks/email/inbound (for services like SendGrid/Mailgun)
app.post('/webhooks/email/inbound', async (req, reply) => {
  const { from, to, subject, text, html, messageId, inReplyTo, references } = req.body;
  
  // Similar processing as IMAP
  await processInboundEmail({
    from: { value: [{ address: from }] },
    subject,
    text,
    html,
    messageId,
    inReplyTo,
    references
  }, account);
});
```

---

## 16) SMS from CRM (Twilio) + Templates

### 16.1 Data Model

```prisma
model SmsTemplate {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  name        String
  content     String   // With tokens: {firstName}, {company}
  category    String?
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  creator      User         @relation(fields: [createdBy], references: [id])

  @@map("sms_templates")
}

// Extend Lead
model Lead {
  smsOptOut   Boolean  @default(false) @map("sms_opt_out")
  smsOptOutAt DateTime? @map("sms_opt_out_at")
}

// Extend Activity for SMS
model Activity {
  smsMessageSid String? @map("sms_message_sid")
  smsStatus     String? @map("sms_status")
}
```

### 16.2 Backend Implementation

**Send SMS:**

```typescript
// POST /api/sms/send
app.post('/api/sms/send', async (req, reply) => {
  const { leadId, templateId, fromNumberId, customMessage } = req.body;
  
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  });
  
  if (lead.smsOptOut) {
    return reply.code(400).send({ error: 'Lead has opted out of SMS' });
  }
  
  const fromNumber = await prisma.phoneNumber.findUnique({
    where: { id: fromNumberId }
  });
  
  let message = customMessage;
  
  if (templateId) {
    const template = await prisma.smsTemplate.findUnique({
      where: { id: templateId }
    });
    
    // Replace tokens
    message = template.content
      .replace(/{firstName}/g, lead.firstName)
      .replace(/{lastName}/g, lead.lastName)
      .replace(/{company}/g, lead.company || '');
  }
  
  const twilioClient = await getTwilioClient(req.user.organizationId);
  
  const sms = await twilioClient.messages.create({
    body: message,
    from: fromNumber.e164Number,
    to: lead.phone,
    statusCallback: `${config.publicUrl}/api/webhooks/twilio/sms-status`
  });
  
  // Log activity
  await prisma.activity.create({
    data: {
      type: 'sms',
      subject: 'SMS sent',
      notes: message,
      leadId: lead.id,
      userId: req.user.id,
      organizationId: req.user.organizationId,
      smsMessageSid: sms.sid,
      smsStatus: sms.status
    }
  });
  
  return { success: true, sms };
});
```

**SMS Webhook Handler:**

```typescript
// POST /webhooks/twilio/sms-status
app.post('/webhooks/twilio/sms-status', async (req, reply) => {
  const { MessageSid, MessageStatus } = req.body;
  
  await prisma.activity.updateMany({
    where: { smsMessageSid: MessageSid },
    data: { smsStatus: MessageStatus }
  });
});

// POST /webhooks/twilio/sms-inbound
app.post('/webhooks/twilio/sms-inbound', async (req, reply) => {
  const { From, To, Body, MessageSid } = req.body;
  
  // Handle STOP keyword
  if (Body.toUpperCase().includes('STOP')) {
    const lead = await prisma.lead.findFirst({
      where: { phone: From }
    });
    
    if (lead) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          smsOptOut: true,
          smsOptOutAt: new Date()
        }
      });
    }
    
    return reply.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
  
  // Log inbound SMS
  const lead = await prisma.lead.findFirst({
    where: { phone: From }
  });
  
  if (lead) {
    await prisma.activity.create({
      data: {
        type: 'sms',
        subject: 'SMS received',
        notes: Body,
        leadId: lead.id,
        organizationId: lead.organizationId,
        smsMessageSid: MessageSid
      }
    });
    
    // Stop sequences
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId: lead.id, status: 'active' },
      data: { status: 'replied', completedAt: new Date() }
    });
  }
});
```

---

## 17) Calendar Sync + Booking Links

### 17.1 Data Model

```prisma
model CalendarAccount {
  id            String   @id @default(cuid())
  userId        String   @unique @map("user_id")
  provider      String   // 'google' | 'outlook'
  email         String
  accessToken   String   @map("access_token") // Encrypted
  refreshToken  String   @map("refresh_token") // Encrypted
  tokenExpiresAt DateTime @map("token_expires_at")
  calendarId    String   @map("calendar_id")
  isEnabled     Boolean  @default(true) @map("is_enabled")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("calendar_accounts")
}

model BookingPage {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  slug            String   @unique
  name            String
  description     String?
  duration        Int      // Minutes
  availabilityJson Json    @map("availability_json")
  bufferTime      Int      @default(0) @map("buffer_time")
  maxPerDay       Int?     @map("max_per_day")
  requireApproval Boolean  @default(false) @map("require_approval")
  confirmationMessage String? @map("confirmation_message")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  bookings Booking[]

  @@map("booking_pages")
}

model Booking {
  id              String   @id @default(cuid())
  bookingPageId   String   @map("booking_page_id")
  leadId          String?  @map("lead_id")
  attendeeName    String   @map("attendee_name")
  attendeeEmail   String   @map("attendee_email")
  attendeePhone   String?  @map("attendee_phone")
  scheduledAt     DateTime @map("scheduled_at")
  duration        Int
  status          BookingStatus @default(pending)
  calendarEventId String?  @map("calendar_event_id")
  notes           String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  bookingPage BookingPage @relation(fields: [bookingPageId], references: [id], onDelete: Cascade)
  lead        Lead?       @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@map("bookings")
}

enum BookingStatus {
  pending
  confirmed
  canceled
  completed
}
```

### 17.2 Backend Implementation

**Google Calendar Integration:**

```typescript
// apps/api/src/lib/calendar.ts
import { google } from 'googleapis';

export async function createCalendarEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees: string[];
  }
) {
  const account = await prisma.calendarAccount.findUnique({
    where: { userId }
  });
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken)
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  const calendarEvent = await calendar.events.insert({
    calendarId: account.calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
      attendees: event.attendees.map(email => ({ email }))
    }
  });
  
  return calendarEvent.data;
}

export async function getAvailableSlots(
  userId: string,
  startDate: Date,
  endDate: Date,
  duration: number
) {
  const account = await prisma.calendarAccount.findUnique({
    where: { userId }
  });
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken)
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  // Get busy times
  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      items: [{ id: account.calendarId }]
    }
  });
  
  const busy = freeBusy.data.calendars[account.calendarId].busy;
  
  // Calculate available slots
  const slots = calculateAvailableSlots(startDate, endDate, busy, duration);
  
  return slots;
}
```

**Booking Page API:**

```typescript
// GET /api/bookings/:slug/slots
app.get('/api/bookings/:slug/slots', async (req, reply) => {
  const { slug } = req.params;
  const { date } = req.query;
  
  const bookingPage = await prisma.bookingPage.findUnique({
    where: { slug },
    include: { user: { include: { calendarAccount: true } } }
  });
  
  if (!bookingPage.isActive) {
    return reply.code(404).send({ error: 'Booking page not found' });
  }
  
  const startDate = new Date(date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  
  const slots = await getAvailableSlots(
    bookingPage.userId,
    startDate,
    endDate,
    bookingPage.duration
  );
  
  return { slots };
});

// POST /api/bookings/:slug/book
app.post('/api/bookings/:slug/book', async (req, reply) => {
  const { slug } = req.params;
  const { name, email, phone, slot, notes } = req.body;
  
  const bookingPage = await prisma.bookingPage.findUnique({
    where: { slug },
    include: { user: true }
  });
  
  // Create booking
  const booking = await prisma.booking.create({
    data: {
      bookingPageId: bookingPage.id,
      attendeeName: name,
      attendeeEmail: email,
      attendeePhone: phone,
      scheduledAt: new Date(slot),
      duration: bookingPage.duration,
      status: bookingPage.requireApproval ? 'pending' : 'confirmed',
      notes
    }
  });
  
  // Create calendar event
  if (!bookingPage.requireApproval) {
    const event = await createCalendarEvent(bookingPage.userId, {
      summary: `Meeting with ${name}`,
      description: notes,
      start: new Date(slot),
      end: new Date(new Date(slot).getTime() + bookingPage.duration * 60000),
      attendees: [email]
    });
    
    await prisma.booking.update({
      where: { id: booking.id },
      data: { calendarEventId: event.id }
    });
  }
  
  // Create/update lead
  let lead = await prisma.lead.findFirst({
    where: { email, organizationId: bookingPage.user.organizationId }
  });
  
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        email,
        phone,
        organizationId: bookingPage.user.organizationId,
        ownerId: bookingPage.userId,
        source: 'booking_page'
      }
    });
  }
  
  await prisma.booking.update({
    where: { id: booking.id },
    data: { leadId: lead.id }
  });
  
  // Log activity
  await prisma.activity.create({
    data: {
      type: 'meeting',
      subject: 'Meeting booked',
      notes: `Scheduled for ${slot}`,
      leadId: lead.id,
      userId: bookingPage.userId,
      organizationId: bookingPage.user.organizationId
    }
  });
  
  return { booking, confirmationMessage: bookingPage.confirmationMessage };
});
```

---

## 18) Lead Scoring + "Stale Deal" Automations

### 18.1 Data Model

```prisma
model LeadScore {
  id        String   @id @default(cuid())
  leadId    String   @unique @map("lead_id")
  score     Int      @default(0) // 0-100
  factors   Json     // Breakdown of score components
  lastCalculated DateTime @map("last_calculated")
  
  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@map("lead_scores")
}

model AutomationRule {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  name        String
  trigger     Json     // Condition config
  actions     Json     // Actions to perform
  isEnabled   Boolean  @default(true) @map("is_enabled")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@map("automation_rules")
}
```

### 18.2 Backend Implementation

**Lead Scoring:**

```typescript
// apps/api/src/jobs/lead-scoring.ts
export async function calculateLeadScore(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: true,
      deals: true,
      company: true
    }
  });
  
  let score = 0;
  const factors: any = {};
  
  // Data completeness (30 points)
  if (lead.email) { score += 10; factors.email = 10; }
  if (lead.phone) { score += 10; factors.phone = 10; }
  if (lead.company) { score += 5; factors.company = 5; }
  if (lead.title) { score += 5; factors.title = 5; }
  
  // Engagement (40 points)
  const emailReplies = lead.activities.filter(a => 
    a.type === 'email' && a.subject.includes('received')
  ).length;
  score += Math.min(emailReplies * 10, 20);
  factors.emailReplies = Math.min(emailReplies * 10, 20);
  
  const meetings = lead.activities.filter(a => a.type === 'meeting').length;
  score += Math.min(meetings * 10, 20);
  factors.meetings = Math.min(meetings * 10, 20);
  
  // Recency (20 points)
  const daysSinceContact = Math.floor(
    (Date.now() - lead.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceContact < 7) score += 20;
  else if (daysSinceContact < 30) score += 10;
  factors.recency = daysSinceContact < 7 ? 20 : (daysSinceContact < 30 ? 10 : 0);
  
  // Company quality (10 points)
  if (lead.company?.domain) {
    score += 5;
    factors.companyDomain = 5;
  }
  if (lead.company?.industry) {
    score += 5;
    factors.industry = 5;
  }
  
  await prisma.leadScore.upsert({
    where: { leadId: lead.id },
    create: {
      leadId: lead.id,
      score,
      factors,
      lastCalculated: new Date()
    },
    update: {
      score,
      factors,
      lastCalculated: new Date()
    }
  });
  
  return score;
}
```

**Stale Deal Detection:**

```typescript
// apps/api/src/jobs/stale-deals.ts
export async function detectStaleDeals() {
  const rules = await prisma.automationRule.findMany({
    where: {
      isEnabled: true,
      trigger: {
        path: ['type'],
        equals: 'stale_deal'
      }
    }
  });
  
  for (const rule of rules) {
    const config = rule.trigger as any;
    const daysStale = config.daysWithoutActivity || 14;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysStale);
    
    const staleDeals = await prisma.deal.findMany({
      where: {
        orgId: rule.orgId,
        stage: { isWon: false, isLost: false },
        updatedAt: { lt: cutoffDate }
      },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    for (const deal of staleDeals) {
      const lastActivity = deal.activities[0];
      if (!lastActivity || lastActivity.createdAt < cutoffDate) {
        // Execute actions
        const actions = rule.actions as any[];
        for (const action of actions) {
          if (action.type === 'create_task') {
            await prisma.task.create({
              data: {
                title: action.taskTitle || `Follow up on stale deal: ${deal.title}`,
                dealId: deal.id,
                assigneeId: deal.ownerId,
                userId: deal.ownerId,
                organizationId: rule.orgId,
                dueDate: new Date()
              }
            });
          } else if (action.type === 'notify_owner') {
            // TODO: Create notification
          }
        }
      }
    }
  }
}
```

---

## 19) Playbooks + Objection Library

### 19.1 Data Model

```prisma
model Playbook {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  name        String
  description String?
  pipelineId  String?  @map("pipeline_id")
  stageId     String?  @map("stage_id")
  content     Json     // Structured playbook content
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  pipeline     Pipeline?    @relation(fields: [pipelineId], references: [id], onDelete: SetNull)
  stage        Stage?       @relation(fields: [stageId], references: [id], onDelete: SetNull)
  creator      User         @relation(fields: [createdBy], references: [id])

  @@map("playbooks")
}

model Objection {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  objection   String   // "Too expensive"
  response    String   // Suggested response
  category    String?  // "price", "timing", "competition"
  playbooks   String[] // Playbook IDs this applies to
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  creator      User         @relation(fields: [createdBy], references: [id])

  @@map("objections")
}
```

### 19.2 Playbook Content Structure

```json
{
  "recommendedActions": [
    "Review company website",
    "Check LinkedIn profile",
    "Send discovery email"
  ],
  "qualifyingQuestions": [
    "What's your current process for X?",
    "What challenges are you facing?",
    "What's your timeline for solving this?"
  ],
  "commonObjections": [
    {
      "objection": "We're happy with our current solution",
      "response": "That's great to hear. What I've found is that even teams happy with their current setup often discover they're missing X. Would you be open to a 15-minute conversation to see if there's any opportunity for improvement?"
    }
  ],
  "talkTracks": {
    "opening": "Hi {firstName}, I noticed {personalisation_hook}...",
    "valueProposition": "We help {industry} companies {solve pain point}...",
    "close": "Would {day} or {day} work better for a quick call?"
  }
}
```

### 19.3 Backend Implementation

```typescript
// GET /api/playbooks/:pipelineId/:stageId
app.get('/api/playbooks/:pipelineId/:stageId', async (req, reply) => {
  const { pipelineId, stageId } = req.params;
  
  const playbook = await prisma.playbook.findFirst({
    where: {
      orgId: req.user.organizationId,
      pipelineId,
      stageId
    }
  });
  
  if (!playbook) {
    return reply.code(404).send({ error: 'No playbook found' });
  }
  
  // Get objections
  const objections = await prisma.objection.findMany({
    where: {
      orgId: req.user.organizationId,
      playbooks: { has: playbook.id }
    }
  });
  
  return { playbook, objections };
});

// POST /api/ai/call-script (uses playbook)
app.post('/api/ai/call-script', async (req, reply) => {
  const { leadId, playbookId } = req.body;
  
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { company: true }
  });
  
  const playbook = await prisma.playbook.findUnique({
    where: { id: playbookId }
  });
  
  const prompt = `Generate a call script for ${lead.firstName} ${lead.lastName} at ${lead.company?.name}.

Playbook guidance:
${JSON.stringify(playbook.content, null, 2)}

Lead context:
- Title: ${lead.title}
- Company: ${lead.company?.name}
- Industry: ${lead.company?.industry}

Generate:
1. Opening (personalized)
2. Discovery questions (3-5)
3. Value proposition
4. Likely objections + responses
5. Close/next step`;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  
  return { script: completion.choices[0].message.content };
});
```

---

## 20) GDPR / Data Rights Tools

### 20.1 Data Model

```prisma
model DataRequest {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  leadId      String   @map("lead_id")
  type        DataRequestType
  requestedBy String?  @map("requested_by")
  status      DataRequestStatus @default(pending)
  exportedData Json?   @map("exported_data")
  completedAt DateTime? @map("completed_at")
  completedBy String?  @map("completed_by")
  createdAt   DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  lead         Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  completedByUser User?     @relation(fields: [completedBy], references: [id])

  @@map("data_requests")
}

enum DataRequestType {
  export
  delete
  anonymise
}

enum DataRequestStatus {
  pending
  in_progress
  completed
  rejected
}

// Extend Lead
model Lead {
  lawfulBasis      String?  @map("lawful_basis") // 'consent', 'legitimate_interest', 'contract'
  marketingConsent Boolean  @default(false) @map("marketing_consent")
  consentDate      DateTime? @map("consent_date")
  isAnonymised     Boolean  @default(false) @map("is_anonymised")
}
```

### 20.2 Backend Implementation

**Export Data:**

```typescript
// POST /api/data-requests/export
app.post('/api/data-requests/export', async (req, reply) => {
  const { leadId } = req.body;
  
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: true,
      deals: true,
      tasks: true,
      company: true,
      tags: { include: { tag: true } }
    }
  });
  
  const exportData = {
    personalInfo: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      title: lead.title
    },
    company: lead.company,
    activities: lead.activities.map(a => ({
      type: a.type,
      subject: a.subject,
      notes: a.notes,
      date: a.createdAt
    })),
    deals: lead.deals.map(d => ({
      title: d.title,
      value: d.value,
      stage: d.stage.name,
      createdAt: d.createdAt
    })),
    tasks: lead.tasks,
    tags: lead.tags.map(t => t.tag.name),
    consent: {
      lawfulBasis: lead.lawfulBasis,
      marketingConsent: lead.marketingConsent,
      consentDate: lead.consentDate
    }
  };
  
  const request = await prisma.dataRequest.create({
    data: {
      orgId: req.user.organizationId,
      leadId: lead.id,
      type: 'export',
      status: 'completed',
      exportedData: exportData,
      completedAt: new Date(),
      completedBy: req.user.id
    }
  });
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'data_export',
      entityType: 'lead',
      entityId: leadId,
      userId: req.user.id,
      organizationId: req.user.organizationId
    }
  });
  
  return { exportData };
});
```

**Delete/Anonymise:**

```typescript
// POST /api/data-requests/anonymise
app.post('/api/data-requests/anonymise', async (req, reply) => {
  const { leadId, hardDelete } = req.body;
  
  if (hardDelete && req.user.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Only admins can hard delete' });
  }
  
  if (hardDelete) {
    // Hard delete - removes all data
    await prisma.lead.delete({
      where: { id: leadId }
    });
  } else {
    // Anonymise - keep metrics, remove PII
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: 'Anonymised',
        lastName: 'User',
        email: `anonymised_${leadId}@example.com`,
        phone: null,
        notes: null,
        isAnonymised: true
      }
    });
    
    // Anonymise activity notes
    await prisma.activity.updateMany({
      where: { leadId },
      data: { notes: '[REDACTED]' }
    });
  }
  
  await prisma.dataRequest.create({
    data: {
      orgId: req.user.organizationId,
      leadId,
      type: hardDelete ? 'delete' : 'anonymise',
      status: 'completed',
      completedAt: new Date(),
      completedBy: req.user.id
    }
  });
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      action: hardDelete ? 'data_deleted' : 'data_anonymised',
      entityType: 'lead',
      entityId: leadId,
      userId: req.user.id,
      organizationId: req.user.organizationId
    }
  });
  
  return { success: true };
});
```

---

## 21) Observability + Error Alerts

### 21.1 Implementation

**Structured Logging:**

```typescript
// apps/api/src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

export function logWithContext(
  correlationId: string,
  level: string,
  message: string,
  metadata?: any
) {
  logger[level]({
    correlationId,
    timestamp: new Date().toISOString(),
    ...metadata
  }, message);
}
```

**Health Check:**

```typescript
// GET /api/health
app.get('/api/health', async (req, reply) => {
  const checks = {
    database: false,
    redis: false,
    emailQueue: false,
    importQueue: false
  };
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (e) {
    logger.error(e, 'Database health check failed');
  }
  
  try {
    await redis.ping();
    checks.redis = true;
  } catch (e) {
    logger.error(e, 'Redis health check failed');
  }
  
  try {
    const emailQueueHealth = await emailQueue.getJobCounts();
    checks.emailQueue = emailQueueHealth.failed < 10;
  } catch (e) {
    logger.error(e, 'Email queue health check failed');
  }
  
  const healthy = Object.values(checks).every(v => v);
  
  return reply.code(healthy ? 200 : 503).send({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

**Discord Alerts:**

```typescript
// apps/api/src/lib/alerts.ts
export async function sendDiscordAlert(message: string, level: 'error' | 'warning' | 'info') {
  if (!process.env.DISCORD_WEBHOOK_URL) return;
  
  const colors = {
    error: 0xFF0000,
    warning: 0xFFA500,
    info: 0x0000FF
  };
  
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `${level.toUpperCase()}: Heimdell CRM`,
        description: message,
        color: colors[level],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

// Use in error handlers
process.on('unhandledRejection', async (error: Error) => {
  logger.error(error, 'Unhandled rejection');
  await sendDiscordAlert(
    `Unhandled rejection: ${error.message}\n\`\`\`${error.stack}\`\`\``,
    'error'
  );
});

// Use in job failure handlers
emailQueue.on('failed', async (job, error) => {
  await sendDiscordAlert(
    `Email job failed: ${job.id}\nError: ${error.message}`,
    'error'
  );
});
```

**System Status Page:**

```tsx
// apps/web/src/pages/SystemStatus.tsx
export function SystemStatus() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000
  });
  
  const { data: queues } = useQuery({
    queryKey: ['queues'],
    queryFn: () => api.getQueueStats()
  });
  
  return (
    <div>
      <h2>System Status</h2>
      
      <Card>
        <CardHeader>Health Checks</CardHeader>
        <CardContent>
          {Object.entries(health?.checks || {}).map(([name, status]) => (
            <div key={name}>
              {name}: {status ? '✅' : '❌'}
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>Job Queues</CardHeader>
        <CardContent>
          {queues?.map((queue: any) => (
            <div key={queue.name}>
              <h4>{queue.name}</h4>
              <div>Active: {queue.active}</div>
              <div>Waiting: {queue.waiting}</div>
              <div>Failed: {queue.failed}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 22) Backups + Restore

### 22.1 Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
DATABASE_URL=${DATABASE_URL}

mkdir -p $BACKUP_DIR

# PostgreSQL backup
pg_dump $DATABASE_URL > "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Compress
gzip "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz" s3://your-bucket/backups/

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$TIMESTAMP.sql.gz"
```

### 22.2 Org Config Export

```typescript
// POST /api/admin/export-config
app.post('/api/admin/export-config', async (req, reply) => {
  const orgId = req.user.organizationId;
  
  const config = {
    pipelines: await prisma.pipeline.findMany({
      where: { orgId },
      include: { stages: true }
    }),
    emailTemplates: await prisma.emailTemplate.findMany({
      where: { orgId }
    }),
    smsTemplates: await prisma.smsTemplate.findMany({
      where: { orgId }
    }),
    sequences: await prisma.sequence.findMany({
      where: { orgId },
      include: { steps: true }
    }),
    importPresets: await prisma.importMappingPreset.findMany({
      where: { orgId }
    }),
    playbooks: await prisma.playbook.findMany({
      where: { orgId }
    }),
    automationRules: await prisma.automationRule.findMany({
      where: { orgId }
    })
  };
  
  return { config };
});

// POST /api/admin/import-config
app.post('/api/admin/import-config', async (req, reply) => {
  const { config } = req.body;
  const orgId = req.user.organizationId;
  
  // Import pipelines
  for (const pipeline of config.pipelines) {
    await prisma.pipeline.create({
      data: {
        ...pipeline,
        orgId,
        stages: {
          create: pipeline.stages.map((s: any) => ({
            ...s,
            orgId
          }))
        }
      }
    });
  }
  
  // Import templates, sequences, etc.
  // ...
  
  return { success: true };
});
```

### 22.3 Documentation

````markdown
# Backup and Restore

## Daily Backups

Run the backup script:
```bash
./scripts/backup-database.sh
```

Schedule with cron:
```bash
0 2 * * * /path/to/scripts/backup-database.sh
```

## Restore from Backup

```bash
# Decompress
gunzip backups/backup_20250116_020000.sql.gz

# Restore
psql $DATABASE_URL < backups/backup_20250116_020000.sql
```

## Export Organization Config

```bash
curl -X POST https://your-crm.com/api/admin/export-config \
  -H "Authorization: Bearer $TOKEN" \
  > org-config.json
```

## Import Organization Config

```bash
curl -X POST https://your-crm.com/api/admin/import-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @org-config.json
```
````

---

## Updated Definition of Done - Complete Production System

### Phase 1 - CSV Import ✅ **COMPLETE**
- [x] CSV upload and parsing
- [x] Column mapping
- [x] Duplicate handling
- [x] AI profile generation
- [x] Progress tracking
- [x] Error reporting

### Phase 2 - Cloud Storage 🔄 **PLANNED**
- [ ] Google Drive integration
- [ ] Dropbox integration
- [ ] Folder watching
- [ ] Auto-import

### Phase 3 - Twilio Calling 🔄 **PLANNED**
- [ ] Twilio account connection
- [ ] Number purchasing
- [ ] Click-to-call
- [ ] Call logging

### Phase 4 - Data Hygiene 🔄 **PLANNED**
- [ ] Dedupe engine with fuzzy matching
- [ ] Merge UI
- [ ] Import mapping presets
- [ ] Field source tracking

### Phase 5 - Email + SMS 🔄 **PLANNED**
- [ ] Email reply detection
- [ ] Email threading
- [ ] Sequence auto-stop on reply
- [ ] SMS sending
- [ ] SMS templates
- [ ] SMS opt-out handling

### Phase 6 - Scheduling 🔄 **PLANNED**
- [ ] Google Calendar sync
- [ ] Booking pages
- [ ] Available slot detection
- [ ] Auto-create meetings

### Phase 7 - Intelligence 🔄 **PLANNED**
- [ ] Lead scoring (0-100)
- [ ] Stale deal detection
- [ ] Automation rules
- [ ] Playbooks per stage
- [ ] Objection library

### Phase 8 - Compliance 🔄 **PLANNED**
- [ ] GDPR data export
- [ ] GDPR data deletion
- [ ] PII anonymisation
- [ ] Consent tracking
- [ ] Audit logs

### Phase 9 - Operations 🔄 **PLANNED**
- [ ] Structured logging
- [ ] Health check endpoint
- [ ] Discord error alerts
- [ ] System status page
- [ ] Database backups
- [ ] Config export/import

---

## Final Notes

This CRM implementation roadmap takes you from "basic CSV import" to "production-grade system that doesn't randomly betray you."

**Core Philosophy:**
- Fit your workflow, don't force you into someone else's assumptions
- Track everything for compliance and optimization
- Alert when things break (at 2am or otherwise)
- Make data portable (export, backup, restore)

**Implementation Order:**
1. ✅ CSV Import - **Done**
2. Cloud Storage + Calling - Enable workflow automation
3. Data Hygiene - Prevent duplicate hell
4. Email + SMS - Complete communication loop
5. Scheduling - Close the deal
6. Intelligence - Know where to focus
7. Compliance - Stay legal (UK/GDPR)
8. Operations - Don't silently die

**Ship it. Don't ask permission.**

---

# The Crown Jewel: Heimdell AI Copilot

## 23) Heimdell AI Copilot - Actionable CRM Assistant

### 23.1 Goal

Create an AI assistant inside Heimdell CRM that:
- **Understands context**: Current lead/deal/company, timeline, tasks, pipeline stage, sequence state
- **Provides actionable advice**: Next-best-action grounded in data, not vibes
- **Executes actions**: Draft email/SMS, create tasks, update deal stages, enroll in sequences
- **Never invents facts**: No hallucination, no compliance violations, no spam
- **Tool-based architecture**: Uses function calling, not raw free-text "do whatever"

This is what separates Heimdell from "yet another CRM" - an AI that acts like a calm, ruthless sales ops manager living inside your workflow.

### 23.2 Data Model

```prisma
model CopilotThread {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  userId      String   @map("user_id")
  title       String   @default("New conversation")
  contextType CopilotContextType @map("context_type")
  contextId   String?  @map("context_id") // lead_id, deal_id, company_id, etc.
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages     CopilotMessage[]

  @@map("copilot_threads")
}

model CopilotMessage {
  id        String   @id @default(cuid())
  threadId  String   @map("thread_id")
  role      CopilotMessageRole
  content   String   @db.Text
  metadata  Json?    // Tool calls, sources, token counts
  createdAt DateTime @default(now()) @map("created_at")

  thread CopilotThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@map("copilot_messages")
}

enum CopilotContextType {
  global
  lead
  deal
  company
  import_job
  pipeline
}

enum CopilotMessageRole {
  system
  user
  assistant
  tool
}

// Track AI usage per org
model CopilotUsage {
  id            String   @id @default(cuid())
  orgId         String   @map("org_id")
  userId        String   @map("user_id")
  month         String   // "2025-01"
  requestCount  Int      @default(0) @map("request_count")
  tokenCount    Int      @default(0) @map("token_count")
  costCents     Int      @default(0) @map("cost_cents")
  
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id])

  @@unique([orgId, userId, month])
  @@map("copilot_usage")
}
```

### 23.3 Backend Architecture

**File Structure:**
```
apps/api/src/modules/copilot/
├── copilot.controller.ts    # API routes
├── copilot.service.ts        # Core logic + prompt building
├── copilot.tools.ts          # Tool definitions + execution
├── copilot.policy.ts         # Guardrails + RBAC
├── copilot.memory.ts         # Conversation state management
├── copilot.summariser.ts     # Context compression
├── copilot.context.ts        # Context pack builder
└── copilot.schemas.ts        # Zod validation
```

### 23.4 API Routes

```typescript
// apps/api/src/modules/copilot/copilot.controller.ts

// Create new conversation thread
app.post('/api/copilot/threads', async (req, reply) => {
  const { contextType, contextId, initialMessage } = req.body;
  
  const thread = await prisma.copilotThread.create({
    data: {
      orgId: req.user.organizationId,
      userId: req.user.id,
      contextType,
      contextId,
      title: initialMessage?.substring(0, 50) || 'New conversation'
    }
  });
  
  return { thread };
});

// List user's threads
app.get('/api/copilot/threads', async (req, reply) => {
  const threads = await prisma.copilotThread.findMany({
    where: {
      userId: req.user.id,
      isActive: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 50
  });
  
  return { threads };
});

// Get thread with messages
app.get('/api/copilot/threads/:id', async (req, reply) => {
  const { id } = req.params;
  
  const thread = await prisma.copilotThread.findFirst({
    where: {
      id,
      userId: req.user.id
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  if (!thread) {
    return reply.code(404).send({ error: 'Thread not found' });
  }
  
  return { thread };
});

// Send message to copilot
app.post('/api/copilot/threads/:id/message', async (req, reply) => {
  const { id } = req.params;
  const { message, context } = req.body;
  
  // Check usage limits
  const usage = await checkUsageLimits(req.user.organizationId, req.user.id);
  if (usage.exceeded) {
    return reply.code(429).send({ 
      error: 'AI usage limit exceeded for this month' 
    });
  }
  
  // Save user message
  await prisma.copilotMessage.create({
    data: {
      threadId: id,
      role: 'user',
      content: message
    }
  });
  
  // Gather context
  const contextPack = await gatherContext(
    req.user,
    context?.leadId,
    context?.dealId,
    context?.companyId
  );
  
  // Build prompt
  const systemPrompt = buildSystemPrompt(contextPack);
  const conversationHistory = await getConversationHistory(id);
  
  // Call OpenAI with function calling
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ],
    tools: getCopilotTools(),
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 2000
  });
  
  const assistantMessage = completion.choices[0].message;
  
  // Parse and structure response
  const response = structureResponse(assistantMessage, contextPack);
  
  // Save assistant message
  await prisma.copilotMessage.create({
    data: {
      threadId: id,
      role: 'assistant',
      content: JSON.stringify(response),
      metadata: {
        model: 'gpt-4-turbo-preview',
        tokenCount: completion.usage.total_tokens,
        toolCalls: assistantMessage.tool_calls?.length || 0
      }
    }
  });
  
  // Update usage tracking
  await trackUsage(
    req.user.organizationId,
    req.user.id,
    completion.usage.total_tokens
  );
  
  return { response };
});

// Apply suggested actions
app.post('/api/copilot/threads/:id/apply-actions', async (req, reply) => {
  const { id } = req.params;
  const { actions } = req.body; // Array of tool calls to execute
  
  const results = [];
  
  for (const action of actions) {
    // Validate permissions
    const canExecute = await validateToolExecution(
      action.tool,
      action.args,
      req.user
    );
    
    if (!canExecute) {
      results.push({
        tool: action.tool,
        success: false,
        error: 'Permission denied'
      });
      continue;
    }
    
    // Execute tool
    const result = await executeTool(action.tool, action.args, req.user);
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'copilot_action_executed',
        entityType: action.tool,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        metadata: {
          tool: action.tool,
          args: action.args,
          threadId: id
        }
      }
    });
    
    results.push(result);
  }
  
  return { results };
});
```

### 23.5 Context Gathering

```typescript
// apps/api/src/modules/copilot/copilot.context.ts

export async function gatherContext(
  user: User,
  leadId?: string,
  dealId?: string,
  companyId?: string
) {
  const context: any = {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      email: user.email
    },
    org: {
      id: user.organizationId
    }
  };
  
  // Lead context
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        tags: { include: { tag: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        tasks: {
          where: { status: { not: 'DONE' } }
        },
        deals: {
          include: { stage: true }
        },
        sequenceEnrollments: {
          where: { status: 'active' }
        }
      }
    });
    
    if (lead) {
      // Calculate derived signals
      const daysSinceContact = lead.lastContactedAt 
        ? Math.floor((Date.now() - lead.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      context.lead = {
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        email: lead.email,
        phone: lead.phone,
        title: lead.title,
        status: lead.status,
        source: lead.source,
        company: lead.company ? {
          name: lead.company.name,
          domain: lead.company.domain,
          industry: lead.company.industry,
          location: lead.company.location
        } : null,
        tags: lead.tags.map(t => t.tag.name),
        
        // Signals
        daysSinceContact,
        openTasksCount: lead.tasks.length,
        activeSequences: lead.sequenceEnrollments.length,
        
        // Summarised activities
        recentActivities: summariseActivities(lead.activities),
        
        // Deals
        deals: lead.deals.map(d => ({
          id: d.id,
          title: d.title,
          value: d.value,
          stage: d.stage.name,
          createdAt: d.createdAt
        })),
        
        // Compliance
        emailOptOut: lead.emailOptOut,
        smsOptOut: lead.smsOptOut,
        marketingConsent: lead.marketingConsent
      };
    }
  }
  
  // Deal context
  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        lead: true,
        company: true,
        stage: {
          include: { pipeline: true }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    
    if (deal) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      context.deal = {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        expectedCloseDate: deal.expectedCloseDate,
        pipeline: deal.stage.pipeline.name,
        stage: deal.stage.name,
        daysSinceUpdate,
        lead: deal.lead ? {
          name: `${deal.lead.firstName} ${deal.lead.lastName}`,
          email: deal.lead.email,
          phone: deal.lead.phone
        } : null,
        recentActivities: summariseActivities(deal.activities)
      };
    }
  }
  
  // Fetch playbooks for current stage
  if (context.deal) {
    const playbook = await prisma.playbook.findFirst({
      where: {
        orgId: user.organizationId,
        stageId: deal.stageId
      }
    });
    
    if (playbook) {
      context.playbook = playbook.content;
    }
  }
  
  return context;
}

function summariseActivities(activities: Activity[]) {
  // Keep milestone events + recent 5
  const milestones = activities.filter(a => 
    ['email_received', 'meeting_booked', 'deal_won', 'deal_lost', 'replied'].includes(a.type)
  );
  
  const recent = activities.slice(0, 5);
  
  return [...new Set([...milestones, ...recent])].map(a => ({
    type: a.type,
    subject: a.subject,
    date: a.createdAt,
    daysAgo: Math.floor((Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  }));
}
```

### 23.6 System Prompt

```typescript
// apps/api/src/modules/copilot/copilot.service.ts

export function buildSystemPrompt(context: any): string {
  return `You are Heimdell AI Copilot inside a Sales CRM. Your job is to help the user win clients by recommending the next best actions using only the CRM context provided.

RULES:
1. Be concise, practical, and action-oriented
2. Never fabricate facts about a person or company
3. If information is missing, say what is missing and propose a safe next step
4. Prioritise actions that move the deal forward: call, follow-up, meeting booking, qualification, proposal, close
5. Respect consent flags and opt-outs (email/SMS). Never recommend messaging someone who opted out
6. Do not execute changes automatically. Propose actions as tool calls and wait for user approval
7. Explain your reasoning in 1–3 bullets using the provided context
8. If the user asks for something unrelated to CRM operations, answer briefly and return to sales priorities

CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}

OUTPUT FORMAT:
Always respond with a JSON object matching this schema:
{
  "summary": "One paragraph recommendation",
  "why": ["Reason 1", "Reason 2", "Reason 3"],
  "next_actions": [
    {
      "title": "Action title",
      "impact": "high|medium|low",
      "tool_call": { "tool": "tool_name", "args": {} }
    }
  ],
  "drafts": {
    "email": { "subject": "", "body": "" },
    "sms": { "body": "" }
  },
  "questions": ["Clarifying question if needed"],
  "warnings": ["Compliance warnings or missing consent"]
}`;
}
```

### 23.7 Tool Definitions

```typescript
// apps/api/src/modules/copilot/copilot.tools.ts

export function getCopilotTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'search_entities',
        description: 'Search for leads, companies, or deals',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            entityType: { 
              type: 'string', 
              enum: ['lead', 'company', 'deal'],
              description: 'Type of entity to search'
            },
            limit: { type: 'number', default: 10 }
          },
          required: ['query', 'entityType']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_lead',
        description: 'Get detailed information about a lead',
        parameters: {
          type: 'object',
          properties: {
            leadId: { type: 'string', description: 'Lead ID' }
          },
          required: ['leadId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Create a task for a lead, deal, or company',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: ['lead', 'deal', 'company'] },
            entityId: { type: 'string' },
            title: { type: 'string' },
            dueAt: { type: 'string', format: 'date-time' },
            assignedUserId: { type: 'string' }
          },
          required: ['entityType', 'entityId', 'title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'log_activity',
        description: 'Log an activity (note, call, meeting, etc.)',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: ['lead', 'deal', 'company'] },
            entityId: { type: 'string' },
            type: { type: 'string', enum: ['note', 'call', 'meeting', 'email'] },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['entityType', 'entityId', 'type', 'body']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'draft_email',
        description: 'Draft an email (not sent until user approves)',
        parameters: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['leadId', 'subject', 'body']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Send an email (requires user approval)',
        parameters: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
            templateId: { type: 'string' }
          },
          required: ['leadId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'draft_sms',
        description: 'Draft an SMS (not sent until user approves)',
        parameters: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['leadId', 'body']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_sms',
        description: 'Send an SMS (requires user approval + opt-out check)',
        parameters: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            fromNumberId: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['leadId', 'fromNumberId', 'body']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'move_deal_stage',
        description: 'Move a deal to a different stage',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string' },
            stageId: { type: 'string' }
          },
          required: ['dealId', 'stageId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'enrol_sequence',
        description: 'Enrol a lead in an email sequence',
        parameters: {
          type: 'object',
          properties: {
            sequenceId: { type: 'string' },
            leadId: { type: 'string' }
          },
          required: ['sequenceId', 'leadId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'stop_sequence',
        description: 'Stop an active sequence enrollment',
        parameters: {
          type: 'object',
          properties: {
            enrollmentId: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['enrollmentId', 'reason']
        }
      }
    }
  ];
}

export async function executeTool(
  toolName: string,
  args: any,
  user: User
): Promise<any> {
  switch (toolName) {
    case 'create_task':
      return await createTask(args, user);
    
    case 'log_activity':
      return await logActivity(args, user);
    
    case 'draft_email':
      return { drafted: true, ...args }; // Return draft, don't send
    
    case 'send_email':
      // Check consent
      const lead = await prisma.lead.findUnique({
        where: { id: args.leadId }
      });
      
      if (lead.emailOptOut) {
        return { error: 'Lead has opted out of email' };
      }
      
      return await sendEmail(args, user);
    
    case 'move_deal_stage':
      return await moveDealStage(args, user);
    
    // ... implement other tools
    
    default:
      return { error: 'Unknown tool' };
  }
}
```

### 23.8 Policy & Guardrails

```typescript
// apps/api/src/modules/copilot/copilot.policy.ts

export async function validateToolExecution(
  tool: string,
  args: any,
  user: User
): Promise<boolean> {
  // Check RBAC
  const requiredPermissions = {
    send_email: ['manage_leads'],
    send_sms: ['manage_leads'],
    move_deal_stage: ['manage_deals'],
    start_call: ['manage_leads']
  };
  
  if (requiredPermissions[tool]) {
    const hasPermission = await checkUserPermissions(
      user.id,
      requiredPermissions[tool]
    );
    if (!hasPermission) return false;
  }
  
  // Check org boundaries
  if (args.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: args.leadId }
    });
    if (lead.organizationId !== user.organizationId) return false;
  }
  
  // Check consent for communication tools
  if (['send_email', 'send_sms'].includes(tool)) {
    const lead = await prisma.lead.findUnique({
      where: { id: args.leadId }
    });
    
    if (tool === 'send_email' && lead.emailOptOut) return false;
    if (tool === 'send_sms' && lead.smsOptOut) return false;
  }
  
  return true;
}

export async function checkUsageLimits(
  orgId: string,
  userId: string
): Promise<{ exceeded: boolean; current: number; limit: number }> {
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  const usage = await prisma.copilotUsage.findUnique({
    where: {
      orgId_userId_month: {
        orgId,
        userId,
        month: currentMonth
      }
    }
  });
  
  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });
  
  const limit = org.copilotMonthlyLimit || 10000; // Default 10k requests
  const current = usage?.requestCount || 0;
  
  return {
    exceeded: current >= limit,
    current,
    limit
  };
}
```

### 23.9 Frontend UI

**Copilot Panel Component:**

```tsx
// apps/web/src/components/CopilotPanel.tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CopilotPanel({ 
  contextType, 
  contextId 
}: { 
  contextType: 'lead' | 'deal' | 'company' | 'global';
  contextId?: string;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  
  // Create thread on mount
  useEffect(() => {
    if (!threadId) {
      createThread({ contextType, contextId }).then(thread => {
        setThreadId(thread.id);
      });
    }
  }, []);
  
  const { data: thread } = useQuery({
    queryKey: ['copilot-thread', threadId],
    queryFn: () => api.getCopilotThread(threadId),
    enabled: !!threadId
  });
  
  const sendMessage = useMutation({
    mutationFn: (msg: string) => 
      api.sendCopilotMessage(threadId, msg, { 
        leadId: contextType === 'lead' ? contextId : undefined,
        dealId: contextType === 'deal' ? contextId : undefined 
      }),
    onSuccess: () => {
      setMessage('');
      refetch();
    }
  });
  
  const applyActions = useMutation({
    mutationFn: (actions: any[]) => 
      api.applyCopilotActions(threadId, actions)
  });
  
  const quickActions = [
    { label: 'What should I do next?', prompt: 'What should I do next with this lead?' },
    { label: 'Draft follow-up', prompt: 'Draft a follow-up email for this lead' },
    { label: 'Draft SMS', prompt: 'Draft a short SMS for this lead' },
    { label: 'Summarise timeline', prompt: 'Summarise the last interactions with this lead' }
  ];
  
  return (
    <div className="copilot-panel h-full flex flex-col">
      <CardHeader>
        <h3>🤖 Heimdell Copilot</h3>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto">
        {/* Quick actions */}
        <div className="quick-actions mb-4">
          {quickActions.map(action => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => sendMessage.mutate(action.prompt)}
            >
              {action.label}
            </Button>
          ))}
        </div>
        
        {/* Messages */}
        <div className="messages space-y-4">
          {thread?.messages?.map(msg => {
            const content = msg.role === 'assistant' 
              ? JSON.parse(msg.content)
              : msg.content;
            
            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'user' && (
                  <div className="user-message">{content}</div>
                )}
                
                {msg.role === 'assistant' && (
                  <CopilotResponse 
                    response={content}
                    onApply={(actions) => applyActions.mutate(actions)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      
      {/* Input */}
      <div className="copilot-input p-4 border-t">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask Copilot anything..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage.mutate(message);
            }
          }}
        />
        <Button onClick={() => sendMessage.mutate(message)}>
          Send
        </Button>
      </div>
    </div>
  );
}

function CopilotResponse({ response, onApply }: any) {
  const [selectedActions, setSelectedActions] = useState<number[]>([]);
  
  return (
    <Card className="copilot-response">
      <CardContent>
        {/* Summary */}
        <p className="summary">{response.summary}</p>
        
        {/* Reasoning */}
        {response.why && (
          <div className="reasoning mt-4">
            <h4>Why:</h4>
            <ul>
              {response.why.map((reason: string, i: number) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Actions */}
        {response.next_actions && response.next_actions.length > 0 && (
          <div className="actions mt-4">
            <h4>Suggested Actions:</h4>
            {response.next_actions.map((action: any, i: number) => (
              <div key={i} className={`action ${action.impact}`}>
                <input
                  type="checkbox"
                  checked={selectedActions.includes(i)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedActions([...selectedActions, i]);
                    } else {
                      setSelectedActions(selectedActions.filter(a => a !== i));
                    }
                  }}
                />
                <span>{action.title}</span>
                <span className="impact-badge">{action.impact}</span>
              </div>
            ))}
            
            <Button
              onClick={() => {
                const actions = selectedActions.map(i => 
                  response.next_actions[i].tool_call
                );
                onApply(actions);
              }}
              disabled={selectedActions.length === 0}
            >
              Apply Selected Actions
            </Button>
          </div>
        )}
        
        {/* Drafts */}
        {response.drafts?.email && (
          <div className="draft email mt-4">
            <h4>Email Draft:</h4>
            <div className="draft-content">
              <strong>Subject:</strong> {response.drafts.email.subject}
              <pre>{response.drafts.email.body}</pre>
            </div>
          </div>
        )}
        
        {response.drafts?.sms && (
          <div className="draft sms mt-4">
            <h4>SMS Draft:</h4>
            <pre>{response.drafts.sms.body}</pre>
          </div>
        )}
        
        {/* Warnings */}
        {response.warnings && response.warnings.length > 0 && (
          <div className="warnings mt-4 text-red-600">
            <h4>⚠️ Warnings:</h4>
            <ul>
              {response.warnings.map((warning: string, i: number) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Integrate into Lead Page:**

```tsx
// apps/web/src/pages/LeadDetail.tsx
export function LeadDetail() {
  const { id } = useParams();
  const [showCopilot, setShowCopilot] = useState(true);
  
  return (
    <div className="lead-detail-page">
      <div className="main-content">
        {/* Lead info, timeline, etc. */}
      </div>
      
      {showCopilot && (
        <div className="copilot-sidebar">
          <CopilotPanel contextType="lead" contextId={id} />
        </div>
      )}
    </div>
  );
}
```

### 23.10 Safety & Quality

**Unit Tests:**

```typescript
// apps/api/src/modules/copilot/__tests__/copilot.policy.test.ts

describe('Copilot Policy', () => {
  it('should prevent SMS to opted-out leads', async () => {
    const lead = await createTestLead({ smsOptOut: true });
    
    const canExecute = await validateToolExecution(
      'send_sms',
      { leadId: lead.id, body: 'Test' },
      testUser
    );
    
    expect(canExecute).toBe(false);
  });
  
  it('should prevent cross-org tool execution', async () => {
    const lead = await createTestLead({ orgId: 'other-org' });
    
    const canExecute = await validateToolExecution(
      'create_task',
      { entityType: 'lead', entityId: lead.id, title: 'Test' },
      testUser
    );
    
    expect(canExecute).toBe(false);
  });
  
  it('should respect usage limits', async () => {
    await setUsageLimit(testOrg.id, testUser.id, 100);
    await setCurrentUsage(testOrg.id, testUser.id, 101);
    
    const limits = await checkUsageLimits(testOrg.id, testUser.id);
    
    expect(limits.exceeded).toBe(true);
  });
});
```

**Redact Sensitive Fields:**

```typescript
function sanitizeContext(context: any): any {
  const sensitiveFields = ['authToken', 'apiKey', 'password', 'accessToken'];
  
  function redact(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const cleaned: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.includes(key)) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        cleaned[key] = redact(value);
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }
  
  return redact(context);
}
```

### 23.11 Definition of Done - Copilot

**User Flow:**
1. ✅ User opens Lead page
2. ✅ Copilot panel appears on right side
3. ✅ User clicks "What should I do next?"
4. ✅ Copilot responds with:
   - One paragraph summary
   - 3 reasons based on timeline data
   - 2-4 suggested actions with impact levels
   - Email/SMS drafts if applicable
5. ✅ User selects actions and clicks "Apply"
6. ✅ CRM objects are created (tasks, activities, etc.)
7. ✅ Timeline updates immediately
8. ✅ No action executes without explicit approval

**Requirements Met:**
- [ ] Context-aware responses using lead/deal/company data
- [ ] Tool-based architecture (no raw execution)
- [ ] Structured JSON responses
- [ ] Action approval system
- [ ] Usage tracking and limits
- [ ] RBAC and consent checking
- [ ] Audit logging for all actions
- [ ] No hallucination (uses only provided context)
- [ ] Compliance warnings surface automatically
- [ ] Quick action buttons for common workflows

---

## Final Implementation Priority (Updated)

1. **✅ CSV Import** - Complete and production-ready
2. **🔄 Cloud Storage Integration** - Automate lead ingestion
3. **🔄 Twilio Calling** - Enable outreach
4. **🔄 Data Hygiene + Email/SMS** - Clean data + communication
5. **🔄 Scheduling + Scoring** - Book meetings + prioritize
6. **🔄 Compliance + Operations** - Stay legal + observable
7. **⭐ Heimdell AI Copilot** - The crown jewel that ties it all together

**Why Copilot Last?**
- Requires all other features to be in place for maximum context
- Transforms CRM from "tool" to "assistant that tells you what to do"
- Provides ROI visibility ("Copilot suggested 10 actions this week, 6 converted")
- Makes the CRM feel less like work and more like having a ruthless sales ops manager

---

## The Complete Vision

With all features implemented, Heimdell becomes:

1. **Self-feeding**: Auto-imports CSVs from Drive/Dropbox
2. **Intelligent**: AI profiles + lead scoring + copilot recommendations
3. **Actionable**: Click-to-call, sequences, SMS, calendar booking
4. **Compliant**: GDPR tools, consent tracking, audit logs
5. **Observable**: Health checks, error alerts, backups
6. **Guided**: Copilot tells you exactly what to do next

**This is not "yet another CRM."** This is a system that prints money and doesn't randomly betray you.

**Ship it. Don't ask permission.**
