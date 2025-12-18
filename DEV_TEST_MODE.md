# DEV_TEST_MODE - No API Keys Required! 🚀

## Quick Start (No Setup Required)

Your Heimdell CRM is now configured to run **without any external dependencies**:

✅ **No Redis required** - Uses in-memory queues  
✅ **No OpenAI API key** - Returns mock AI responses  
✅ **No Twilio account** - SMS features disabled  
✅ **No database required initially** - Hardcoded admin login works  

### Run Immediately

1. **Double-click `start.bat`** in the project root
2. **Login with:**
   - Email: `admin`
   - Password: `admin123`

That's it! The CRM loads in your browser automatically.

---

## What Works in DEV_TEST_MODE

### ✅ Fully Functional
- **Login/Authentication** - Hardcoded admin account
- **UI/UX** - All pages and components
- **CSV Imports** - Upload and process lead lists
- **Pipelines** - Create and manage sales pipelines
- **Navigation** - All routes and features
- **Background Jobs** - In-memory queue processing

### 🔄 Mock Responses (UI still works)
- **AI Enrichment** - Returns sample company data
- **AI Next Action** - Suggests mock follow-ups
- **AI Sequence Generator** - Creates sample email sequences
- **AI Call Summary** - Generates mock summaries

### ❌ Disabled Features
- **Twilio SMS** - Requires API credentials
- **Google Drive Integration** - Requires OAuth
- **Dropbox Integration** - Requires OAuth
- **Email Sending** - Requires SMTP configuration

---

## Configuration

All settings are in [`apps/api/.env`](apps/api/.env):

```env
# Dev Mode Flags
DEV_TEST_MODE=true          # Auto-disables integrations without keys
REDIS_ENABLED=false         # Use in-memory queues
AI_ENABLED=false            # Return mock AI responses
TWILIO_ENABLED=false        # Disable SMS features
DRIVE_ENABLED=false         # Disable Google Drive
DROPBOX_ENABLED=false       # Disable Dropbox

# Login (hardcoded)
# Email: admin
# Password: admin123
```

---

## Adding Real API Keys (Optional)

Want to enable real AI features? Just add the keys:

### 1. Enable OpenAI

```env
AI_ENABLED=true
OPENAI_API_KEY=sk-your-key-here
```

### 2. Enable Redis (for production-like queues)

```bash
# Option A: Docker
docker run -d -p 6379:6379 redis:alpine

# Then in .env:
REDIS_ENABLED=true
```

### 3. Enable Twilio SMS

```env
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Diagnostic Warnings vs Errors

The diagnostics system now shows **WARN** instead of **FAIL** for disabled features:

- ⚠️ **Redis not available** - Expected in dev mode
- ⚠️ **AI key missing** - Mock responses will be used
- ⚠️ **Twilio disabled** - SMS features won't work

---

## Testing Features

### CSV Import Test

1. Go to **Imports** page
2. Upload [`sample_leads.csv`](sample_leads.csv)
3. Map columns → Start import
4. Check **Leads** page for imported data

### AI Features Test (Mock Mode)

1. Go to **Leads** page
2. Select a lead → Click **Enrich**
3. See mock enrichment data with `[MOCK]` prefix
4. Warnings will show: `["AI disabled: mock response"]`

### Pipeline Test

1. Go to **Pipelines** page
2. Create a new pipeline
3. Add stages (Lead → Qualified → Won)
4. Drag deals between stages

---

## Benefits of DEV_TEST_MODE

✨ **Instant Setup** - No credentials needed to start  
✨ **Offline Development** - Works without internet  
✨ **Fast Iteration** - No external API delays  
✨ **Cost-Free** - No OpenAI or Twilio charges  
✨ **Full UI Testing** - Every button and form works  

---

## Production Deployment

When ready to deploy:

1. **Database**: Set up PostgreSQL (Supabase recommended)
2. **Redis**: Use managed Redis (Upstash, Redis Cloud)
3. **API Keys**: Add OpenAI, Twilio credentials
4. **Set** `DEV_TEST_MODE=false`
5. **Deploy API**: Railway, Render, or Fly.io
6. **Deploy Frontend**: Netlify or Vercel

See [DEPLOY.md](DEPLOY.md) for full instructions.

---

## Troubleshooting

### "Failed to fetch" error
- Make sure both servers are running (API on port 3000, Web on port 5173)
- Check the terminal windows for errors
- Run `start.bat` again

### AI features not working
- Check console for `[MOCK]` prefix in responses
- Verify `AI_ENABLED=false` in `.env`
- This is expected behavior in dev mode!

### Import jobs not processing
- Jobs run inline (no delay) in dev mode
- Check browser console for errors
- Verify file is valid CSV format

---

## Next Steps

1. ✅ Test core features with mock data
2. ✅ Import sample leads
3. ✅ Explore UI/UX
4. 📝 Add real database for persistence
5. 🔑 Add API keys when ready for production features

**Happy Testing! 🎉**
