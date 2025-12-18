# Getting Started with Heimdell CRM

**Welcome!** This guide will get you up and running in minutes.

---

## ⚡ Quick Start (Automated)

**For Windows users**, run this PowerShell script:

```powershell
.\quickstart.ps1
```

This will:
- ✅ Install all dependencies
- ✅ Setup environment files
- ✅ Start Docker containers
- ✅ Run database migrations
- ✅ Seed demo data

**Then open**: http://localhost:5173

---

## 🔍 Prerequisites Checklist

Before you begin, make sure you have:

### Required

- [ ] **Node.js 18 or newer** - [Download here](https://nodejs.org/)
- [ ] **pnpm 8 or newer** - Install: `npm install -g pnpm`
- [ ] **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)

### Optional (for AI features)

- [ ] **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

### Optional (for email sequences)

- [ ] **SMTP Credentials** - Gmail, SendGrid, Postmark, etc.

**Verify your setup:**

```powershell
.\verify-setup.ps1
```

---

## 🚀 Manual Setup

If you prefer to run commands manually:

### Step 1: Install Dependencies

```bash
pnpm install
```

This installs packages for both the API and Web apps.

### Step 2: Configure Environment

```bash
# Backend configuration
cp apps/api/.env.example apps/api/.env

# Frontend configuration  
cp apps/web/.env.example apps/web/.env
```

**Edit `apps/api/.env`** and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-key-here
```

All other defaults work for local development!

### Step 3: Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

### Step 4: Setup Database

```bash
# Run migrations (creates tables)
pnpm db:migrate

# Seed demo data (optional but recommended)
pnpm db:seed
```

### Step 5: Start Development Servers

```bash
pnpm dev
```

This starts:
- **API** on http://localhost:3000
- **Web** on http://localhost:5173

---

## 🎯 What to Try First

### 1. Login to the Web App

Go to http://localhost:5173

**Demo accounts** (after running seed):
- Sales Rep: `rep@heimdell.com` / `rep123`
- Manager: `manager@heimdell.com` / `manager123`  
- Admin: `admin@heimdell.com` / `admin123`

### 2. Explore the Dashboard

You'll see:
- Lead metrics (new, contacted, qualified)
- Pipeline value
- Win rate
- Recent activity

### 3. Check Out Leads

Click **Leads** in the sidebar to see:
- List of demo leads
- Search functionality
- Lead cards with contact info

### 4. Try the API

Visit http://localhost:3000/docs for interactive API documentation.

Example API call:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rep@heimdell.com","password":"rep123"}'

# Get leads (use token from login response)
curl http://localhost:3000/api/leads \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Test AI Features (Requires OpenAI Key)

In the Web app:
1. Go to Leads
2. Click on a lead
3. Try the AI enrichment feature

Or via API:

```bash
curl -X POST http://localhost:3000/api/ai/enrich \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "...",
    "companyName": "Acme Corp",
    "website": "acme.com"
  }'
```

---

## 📚 Next Steps

### Learn the System

- [ ] Read [PROJECT_STATUS.md](./PROJECT_STATUS.md) for feature overview
- [ ] Browse [API documentation](http://localhost:3000/docs)
- [ ] Check database schema: `pnpm db:studio`

### Customize for Your Needs

- [ ] Update pipeline stages in Prisma Studio
- [ ] Add your own email templates
- [ ] Configure SMTP for email sequences
- [ ] Customize UI colors in `apps/web/tailwind.config.js`

### Start Building

- [ ] Create your first real lead
- [ ] Set up your pipeline stages
- [ ] Build an email sequence
- [ ] Try AI-generated outreach

---

## 🛠️ Useful Commands

### Development

```bash
pnpm dev              # Start both API and Web
pnpm dev:api          # Start API only
pnpm dev:web          # Start Web only
```

### Database

```bash
pnpm db:studio        # Open Prisma Studio (visual DB editor)
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed demo data
pnpm db:reset         # Reset database (⚠️ deletes all data!)
```

### Code Quality

```bash
pnpm lint             # Lint all code
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
```

### Production

```bash
pnpm build            # Build both apps for production
pnpm start            # Start production servers
```

---

## 🔧 Common Issues

### Port Already in Use

If you see "Port 3000 is already in use":

```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace PID)
taskkill /PID <PID> /F
```

### Docker Not Starting

Make sure Docker Desktop is running. Check:

```bash
docker ps
```

You should see PostgreSQL and Redis containers.

### OpenAI API Errors

- Check your API key is valid
- Verify you have credits: https://platform.openai.com/usage
- Default rate limit: 10,000 calls/month

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# View logs
docker-compose logs postgres

# Restart containers
docker-compose restart
```

### "Module not found" Errors

```bash
# Clean install
rm -rf node_modules apps/*/node_modules
pnpm install
```

---

## 📖 Documentation

- **[README.md](./README.md)** - Project overview and quick reference
- **[SETUP.md](./SETUP.md)** - Comprehensive setup guide with troubleshooting
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - What's implemented, what's next
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development guidelines

---

## 🎓 Architecture Overview

### Backend (apps/api)

```
src/
├── routes/           # API endpoints (auth, leads, deals, etc.)
├── jobs/             # Background workers (sequences, digests)
├── middleware/       # Auth, RBAC, audit logging
└── lib/              # Clients (Prisma, Redis, OpenAI, Email)
```

**Key Technologies**: Fastify, Prisma, PostgreSQL, Redis, BullMQ

### Frontend (apps/web)

```
src/
├── pages/            # Route components (Dashboard, Leads, etc.)
├── components/       # Reusable UI components
├── lib/              # API client, utilities
└── store/            # Zustand state management
```

**Key Technologies**: React, Vite, Tailwind, TanStack Query

---

## 🤝 Need Help?

1. **Check the docs**: [SETUP.md](./SETUP.md) has detailed troubleshooting
2. **View API docs**: http://localhost:3000/docs
3. **Check logs**: 
   - API logs in your terminal
   - Docker logs: `docker-compose logs -f`
4. **Run verification**: `.\verify-setup.ps1`

---

## ✅ Success Checklist

You'll know everything is working when:

- [ ] `docker ps` shows postgres and redis containers running
- [ ] http://localhost:3000/health returns `{"status":"ok"}`
- [ ] http://localhost:3000/docs shows API documentation
- [ ] http://localhost:5173 shows login page
- [ ] You can login with demo account
- [ ] Dashboard shows metrics and activity
- [ ] Leads page shows list of demo leads

**If all boxes are checked, you're ready to build! 🎉**

---

**Happy selling!** 🚀

For questions or issues, check [SETUP.md](./SETUP.md) or open an issue on GitHub.
