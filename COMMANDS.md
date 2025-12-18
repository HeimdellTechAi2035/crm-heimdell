# Heimdall CRM - Command Reference

Quick reference for all commands you'll need.

---

## ⚡ Quick Start

```powershell
# Automated setup (does everything)
.\quickstart.ps1

# Verify environment
.\verify-setup.ps1
```

---

## 📦 Installation

```bash
# Install all dependencies (root + both apps)
pnpm install

# Install for specific app
pnpm --filter api install
pnpm --filter web install
```

---

## 🚀 Development

### Start Servers

```bash
# Start both API and Web
pnpm dev

# Start only API (port 3000)
pnpm dev:api

# Start only Web (port 5173)
pnpm dev:web
```

**URLs:**
- Web: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/docs
- Health: http://localhost:3000/health

### Stop Servers

Press `Ctrl+C` in the terminal running `pnpm dev`

---

## 🐳 Docker

### Start Infrastructure

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### Check Status

```bash
# List running containers
docker ps

# Should see:
# - heimdall-postgres
# - heimdall-redis
```

### Troubleshooting

```bash
# Restart containers
docker-compose restart

# Rebuild and restart
docker-compose up -d --build

# View container details
docker inspect heimdall-postgres
```

---

## 🗄️ Database

### Migrations

```bash
# Create and run migration
pnpm db:migrate

# Create migration without running
pnpm db:migrate:create

# Deploy migrations (production)
pnpm db:migrate:deploy

# View migration status
pnpm db:migrate:status
```

### Data Management

```bash
# Open Prisma Studio (visual DB editor)
pnpm db:studio

# Seed demo data
pnpm db:seed

# Reset database (⚠️ deletes all data!)
pnpm db:reset

# Generate Prisma Client (after schema changes)
pnpm db:generate
```

### Direct Database Access

```bash
# Connect with psql
psql postgresql://crm:crm123@localhost:5432/heimdall

# Or using Docker
docker exec -it heimdall-postgres psql -U crm -d heimdall
```

**Useful SQL commands:**
```sql
-- List tables
\dt

-- Describe table
\d leads

-- Count records
SELECT COUNT(*) FROM leads;

-- Exit
\q
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run API tests only
pnpm --filter api test

# Run Web tests only
pnpm --filter web test

# Run specific test file
pnpm --filter api test src/tests/api.test.ts

# Run with coverage
pnpm test -- --coverage
```

---

## 🔍 Linting & Formatting

```bash
# Lint all code
pnpm lint

# Lint specific app
pnpm --filter api lint
pnpm --filter web lint

# Auto-fix issues
pnpm lint -- --fix
```

---

## 🏗️ Building

```bash
# Build all apps for production
pnpm build

# Build specific app
pnpm --filter api build
pnpm --filter web build

# Clean build artifacts
rm -rf apps/*/dist apps/*/build
```

---

## 🚢 Production

### Start Production Servers

```bash
# Build first
pnpm build

# Start API
cd apps/api
node dist/index.js

# Start Web (serve static files)
cd apps/web
npx serve -s dist
```

### Environment Setup

```bash
# Copy production templates
cp apps/api/.env.example apps/api/.env.production
cp apps/web/.env.example apps/web/.env.production

# Edit with production values
# - Strong JWT secrets (32+ chars)
# - Production database URL
# - Production Redis URL
# - OpenAI API key
# - SMTP credentials
```

### Database

```bash
# Run migrations (production)
DATABASE_URL="your-prod-url" pnpm db:migrate:deploy

# Seed initial data (optional)
DATABASE_URL="your-prod-url" pnpm db:seed
```

---

## 🔧 Workspace Commands

### Clean

```bash
# Remove node_modules
rm -rf node_modules apps/*/node_modules

# Remove build artifacts
rm -rf apps/*/dist apps/*/build

# Remove lock file
rm pnpm-lock.yaml

# Full clean
rm -rf node_modules apps/*/node_modules pnpm-lock.yaml apps/*/dist
pnpm install
```

### Update Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update all to latest
pnpm update

# Update specific package
pnpm update fastify

# Update to latest (⚠️ may break)
pnpm update --latest
```

---

## 📊 Monitoring

### Check Health

```bash
# API health check
curl http://localhost:3000/health

# Should return: {"status":"ok"}
```

### View Logs

**API logs:** Watch the terminal running `pnpm dev:api`

**Docker logs:**
```bash
# PostgreSQL
docker-compose logs -f postgres

# Redis
docker-compose logs -f redis

# Both
docker-compose logs -f
```

---

## 🔐 Authentication (API Testing)

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rep@heimdall.com",
    "password": "rep123"
  }'
```

**Save the tokens from response:**
```json
{
  "user": {...},
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Use Token

```bash
# Set token variable
TOKEN="your-access-token-here"

# Make authenticated request
curl http://localhost:3000/api/leads \
  -H "Authorization: Bearer $TOKEN"
```

### Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

---

## 🤖 AI Features (API Testing)

**Note:** Requires OpenAI API key in `.env`

### Lead Enrichment

```bash
curl -X POST http://localhost:3000/api/ai/enrich \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-id-here",
    "companyName": "Acme Corp",
    "website": "acme.com",
    "industry": "SaaS"
  }'
```

### Next Action Suggestion

```bash
curl -X POST http://localhost:3000/api/ai/next-action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-id-here",
    "dealId": "deal-id-here"
  }'
```

### Generate Sequence

```bash
curl -X POST http://localhost:3000/api/ai/generate-sequence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SaaS Outreach",
    "targetAudience": "B2B SaaS founders",
    "goal": "Book demo",
    "numberOfSteps": 5
  }'
```

### Summarize Call

```bash
curl -X POST http://localhost:3000/api/ai/summarize-call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-id-here",
    "rawNotes": "Discussed pricing. They want enterprise plan. Follow up next week."
  }'
```

---

## 🐛 Debugging

### Check Processes

```bash
# Find process on port 3000
netstat -ano | findstr :3000

# Find process on port 5173
netstat -ano | findstr :5173

# Kill process (Windows)
taskkill /PID <PID> /F

# Kill process (Unix)
kill -9 <PID>
```

### Environment Issues

```bash
# Print environment variables (API)
cd apps/api
node -e "require('dotenv').config(); console.log(process.env)"

# Check if OpenAI key is set
cd apps/api
node -e "require('dotenv').config(); console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set')"
```

### Database Issues

```bash
# Test connection
node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.\$connect()
    .then(() => console.log('✅ Connected'))
    .catch(err => console.error('❌ Error:', err))
    .finally(() => prisma.\$disconnect());
"

# Reset and reseed
pnpm db:reset
```

### Redis Issues

```bash
# Test Redis connection
docker exec -it heimdall-redis redis-cli ping
# Should return: PONG

# Check Redis keys
docker exec -it heimdall-redis redis-cli keys '*'

# Clear Redis
docker exec -it heimdall-redis redis-cli FLUSHALL
```

---

## 📱 Windows PowerShell Shortcuts

```powershell
# Create aliases (add to PowerShell profile)
function dev { pnpm dev }
function build { pnpm build }
function test { pnpm test }
function lint { pnpm lint }
function studio { pnpm db:studio }

# To edit profile:
notepad $PROFILE

# Reload profile:
. $PROFILE
```

---

## 🎯 Common Workflows

### Daily Development Start

```bash
# 1. Start Docker
docker-compose up -d

# 2. Start dev servers
pnpm dev

# 3. Open in browser
start http://localhost:5173
```

### After Pulling Changes

```bash
# 1. Install dependencies
pnpm install

# 2. Run migrations
pnpm db:migrate

# 3. Start dev
pnpm dev
```

### Before Committing

```bash
# 1. Lint code
pnpm lint

# 2. Run tests
pnpm test

# 3. Build to verify
pnpm build
```

### Deploying to Production

```bash
# 1. Build
pnpm build

# 2. Run migrations
DATABASE_URL="prod-url" pnpm db:migrate:deploy

# 3. Start servers
NODE_ENV=production node apps/api/dist/index.js
```

---

## 🆘 Emergency Commands

### Nothing Works

```bash
# Full reset
docker-compose down -v
rm -rf node_modules apps/*/node_modules
pnpm install
docker-compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### Database Corrupted

```bash
# Reset database
pnpm db:reset

# Or manual reset
docker-compose down -v
docker-compose up -d
# Wait 10 seconds
pnpm db:migrate
pnpm db:seed
```

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Unix
lsof -ti:3000 | xargs kill -9
```

---

## 📚 Learn More

- **Full Setup Guide**: [SETUP.md](./SETUP.md)
- **Getting Started**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Project Status**: [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- **File Structure**: [FILE_STRUCTURE.md](./FILE_STRUCTURE.md)

---

**Keep this file bookmarked for quick reference!** 📌
