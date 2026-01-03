# Heimdall CRM 🏠 (Offline Edition)

> **🎉 Personal Use Version** - Runs completely offline with no external dependencies!

A Close.com-style Sales CRM that runs entirely on your local machine. No cloud APIs, no external services - just you and your data.

## 🚀 Quick Start (Offline Mode)

```bash
# Just run this!
start-offline.bat
```

This will:
1. Install dependencies
2. Set up SQLite database
3. Start the API and Web servers

**Login credentials:**
- Admin: `admin@heimdell.com` / `admin123`
- Manager: `manager@heimdell.com` / `manager123`
- Sales Rep: `rep@heimdell.com` / `rep123`

## ✨ Features

### Core CRM Functionality
- 📋 **Leads Management** - Capture, qualify, and track leads through your sales process
- 🏢 **Companies** - Organize leads by company with full relationship tracking
- 💰 **Deals & Pipeline** - Visual Kanban board with customizable stages
- 📝 **Activities Timeline** - Complete history of notes, calls, emails, and meetings
- ✅ **Tasks** - Due dates, assignments, and automatic reminders
- 🏷️ **Tags & Custom Fields** - Flexible data organization
- 📧 **Email Templates** - Reusable templates with personalization tokens

### 🤖 Mock AI Sales Agent (Offline)
- **Lead Enrichment**: Generates mock data for testing
- **Next Best Action**: Sample suggestions for next steps
- **Sequence Generator**: Mock multi-step outreach sequences
- **Call Summaries**: Transform notes into structured summaries
- ⚠️ *Note: AI features use mock responses in offline mode*

### ⚡ Automation (In-Memory)
- **Email Sequences**: Logged locally (not actually sent)
- **Activity Logging**: Automatic timeline updates
- **In-Memory Queue**: Background job processing without Redis

### 🔐 Security
- **JWT Authentication**: Access + refresh token pattern
- **RBAC**: Admin, Manager, and Sales Rep roles
- **Rate Limiting**: Protection against abuse
- **Audit Logs**: Complete activity tracking

### 📊 Reporting
- **Dashboard**: Real-time metrics
  - New leads, contacted leads, deals created
  - Pipeline value, won deals, win rate
  - Average time to close
- **Stage Conversion**: Track conversion rates
- **Rep Activity**: Monitor team performance

## 🛠️ Tech Stack (Offline Mode)

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Fastify (fast, low overhead)
- **Database**: SQLite (local file, no server needed)
- **Queue**: In-memory (no Redis required)
- **Validation**: Zod schemas
- **API Docs**: OpenAPI/Swagger
- **Real-time**: WebSocket support

### Frontend
- **Framework**: React 18 with TypeScript
- **Build**: Vite (fast HMR)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: TanStack Query (server) + Zustand (client)
- **Routing**: React Router v6

### AI & Communications
- **AI**: OpenAI GPT-4 Turbo
- **Email**: SMTP via nodemailer (provider-agnostic)
- **Optional**: Twilio integration ready

## 🚀 Quick Start

### ⚡ Fastest Way (Windows)

```powershell
.\quickstart.ps1
```

This automated script will set up everything in ~2 minutes.

### 📖 Step-by-Step Guide

**New to the project?** Start here: **[GETTING_STARTED.md](./GETTING_STARTED.md)**

**Need help?** See: **[SETUP.md](./SETUP.md)** for comprehensive setup guide and troubleshooting.

### Access the Application

After setup completes:

- 🌐 **Web App**: http://localhost:5173
- 🔌 **API**: http://localhost:3000
- 📚 **API Docs**: http://localhost:3000/docs

### Demo Accounts

Login with:
- 👤 **Sales Rep**: `rep@heimdell.com` / `rep123`
- 👤 **Manager**: `manager@heimdell.com` / `manager123`
- 👤 **Admin**: `admin@heimdell.com` / `admin123`

## 📁 Project Structure

```
heimdell-crm/
├── apps/
│   ├── api/                      # Backend API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema (20+ models)
│   │   │   └── seed.ts           # Demo data
│   │   ├── src/
│   │   │   ├── routes/           # API endpoints
│   │   │   ├── jobs/             # BullMQ workers
│   │   │   ├── middleware/       # Auth, RBAC, audit
│   │   │   └── lib/              # Clients (Prisma, Redis, OpenAI)
│   │   └── tests/                # Vitest tests
│   │
│   └── web/                      # Frontend SPA
│       ├── src/
│       │   ├── components/       # UI components
│       │   ├── pages/            # Route pages
│       │   ├── lib/              # API client
│       │   └── store/            # Zustand state
│       └── vite.config.ts
│
├── docker-compose.yml            # PostgreSQL + Redis
├── verify-setup.ps1              # Check prerequisites
├── quickstart.ps1                # Automated setup
└── README.md
```

## 🧪 Development

```bash
# Start dev servers (API + Web)
pnpm dev

# Run all tests
pnpm test

# Lint code
pnpm lint

# Build for production
pnpm build

# Database commands
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed demo data
pnpm db:studio        # Open Prisma Studio
pnpm db:reset         # Reset database
```

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Comprehensive setup guide with troubleshooting
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development standards and PR process
- **[API Docs](http://localhost:3000/docs)** - OpenAPI/Swagger (when running)

## 🔑 Key API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Current user

### CRM
- `GET /api/leads` - List leads (paginated, filtered)
- `POST /api/leads` - Create lead
- `PATCH /api/leads/:id` - Update lead
- `GET /api/companies` - List companies
- `GET /api/deals` - List deals
- `POST /api/deals/:id/move` - Move to stage
- `POST /api/deals/:id/close` - Mark won/lost

### AI Features
- `POST /api/ai/enrich` - AI lead enrichment
- `POST /api/ai/next-action` - Get AI suggestion
- `POST /api/ai/generate-sequence` - Create sequence
- `POST /api/ai/summarize-call` - Summarize notes

### Analytics
- `GET /api/dashboard/metrics` - Key metrics
- `GET /api/pipelines/:id/board` - Kanban data

## 🚢 Production Deployment

### Checklist

- [ ] Set strong JWT secrets (32+ chars)
- [ ] Use production PostgreSQL instance
- [ ] Configure Redis persistence
- [ ] Add OpenAI API key with limits
- [ ] Set up SMTP provider (SendGrid, etc.)
- [ ] Enable CORS for your domain
- [ ] Set up SSL/TLS
- [ ] Configure monitoring
- [ ] Run migrations: `pnpm db:migrate`
- [ ] Build: `pnpm build`

See [SETUP.md](./SETUP.md) for detailed deployment guide.

## 🆘 Common Issues

**OpenAI API Errors**: Verify key is valid and has remaining credits

**Database Connection**: Check Docker is running: `docker ps`

**Port in Use**: Kill existing process on port 3000/5173

**Email Not Sending**: For Gmail, use App Password instead of account password

For detailed troubleshooting, see [SETUP.md](./SETUP.md).

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style guidelines
- Commit conventions
- Pull request process

## 📝 License

MIT License - See LICENSE file for details

---

**Built for sales teams who want to close more deals faster** 🚀
