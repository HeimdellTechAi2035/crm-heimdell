# Deploying Heimdell CRM

## Quick Fix for TypeScript Errors

The 30 remaining TypeScript errors are because the database tables don't exist yet. You need to run the database migration first:

### Step 1: Setup PostgreSQL

You have 3 options:

**Option A: Use Supabase (Recommended for Netlify)**
1. Go to https://supabase.com and create a free account
2. Create a new project
3. Get your database connection string from Settings → Database
4. Update `.env` files with the connection string

**Option B: Use Neon (Alternative)**
1. Go to https://neon.tech and create a free account
2. Create a new project
3. Get your connection string
4. Update `.env` files

**Option C: Local PostgreSQL**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install and note your password
3. Your connection string will be: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/heimdell_crm`

### Step 2: Update Environment Variables

**For API** (`apps/api/.env`):
```env
DATABASE_URL="postgresql://YOUR_CONNECTION_STRING"
JWT_SECRET="your-super-secret-jwt-key-change-this"
REDIS_URL="redis://localhost:6379"

# Optional services
OPENAI_API_KEY="your-openai-key"
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**For Web** (`apps/web/.env`):
```env
VITE_API_URL="https://your-api-url.com"
```

### Step 3: Run Database Migration

```bash
cd apps/api
pnpm install
npx prisma generate
npx prisma db push
```

This will:
- Create all database tables
- Fix all TypeScript errors
- Make the diagnostics system work

### Step 4: Start Locally

Double-click `startup.bat` or run:
```bash
pnpm install
cd apps/api && pnpm dev &
cd apps/web && pnpm dev
```

## Deploying to Netlify

### Frontend (Web)

1. **Build the frontend:**
   ```bash
   cd apps/web
   pnpm build
   ```

2. **Deploy to Netlify:**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Set build settings:
     - **Base directory**: `apps/web`
     - **Build command**: `pnpm build`
     - **Publish directory**: `apps/web/dist`
   - Add environment variable:
     - `VITE_API_URL`: Your API URL (from next step)

### Backend (API)

**Netlify doesn't support Node.js backend servers.** You need to use one of these:

**Option A: Railway (Recommended)**
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Set root directory: `apps/api`
5. Railway will auto-detect Node.js
6. Add environment variables (DATABASE_URL, JWT_SECRET, etc.)
7. Copy the provided URL for your frontend

**Option B: Render**
1. Go to https://render.com
2. Click "New" → "Web Service"
3. Connect your repository
4. Set:
   - **Root Directory**: `apps/api`
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
5. Add environment variables
6. Copy the provided URL

**Option C: Vercel**
1. Go to https://vercel.com
2. Import your repository
3. Set root directory: `apps/api`
4. Add environment variables
5. Copy the provided URL

### Update Frontend with API URL

After deploying your API:
1. Copy the API URL
2. Go to Netlify → Your site → Site settings → Environment variables
3. Update `VITE_API_URL` with your API URL
4. Redeploy the site

## GitHub Setup

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Heimdell CRM"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/heimdell-crm.git
git branch -M main
git push -u origin main
```

## Production Checklist

Before deploying to production:

- [ ] Run `npx prisma db push` with your production database
- [ ] Set strong `JWT_SECRET` (generate with `openssl rand -base64 32`)
- [ ] Configure SMTP for emails
- [ ] Set up Redis (Railway/Render have add-ons)
- [ ] Configure OpenAI API key for AI features
- [ ] Set CORS origins in API config
- [ ] Enable rate limiting
- [ ] Set up SSL certificates (handled by hosting platforms)
- [ ] Configure backup strategy for database

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Ensure database allows connections from your IP
- For Supabase: Enable "Direct Connection" in settings

### "Module not found" errors
- Run `pnpm install` in both `apps/api` and `apps/web`
- Run `npx prisma generate` in `apps/api`

### "systemCheckRun does not exist" errors
- Run database migration: `npx prisma db push`
- Or create tables: `npx prisma migrate deploy`

### TypeScript errors about unknown types
- Run `pnpm install` to get all types
- Restart your IDE/VS Code

## Cost Breakdown (Free Tier)

- **Supabase**: Free (500MB database, 2GB bandwidth)
- **Railway**: Free ($5 credit/month, ~550 hours)
- **Netlify**: Free (100GB bandwidth)
- **GitHub**: Free (unlimited public repositories)

**Total: $0/month** for development and small teams!

## Need Help?

- Check [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup
- Read [DIAGNOSTICS.md](./DIAGNOSTICS.md) for system diagnostics
- See [README.md](./README.md) for full feature list
