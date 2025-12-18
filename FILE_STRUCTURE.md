# Heimdall CRM - Complete File Structure

```
heimdall-crm/
│
├── 📄 START_HERE.md                    👈 **READ THIS FIRST!**
├── 📄 GETTING_STARTED.md               Quick start guide for new users
├── 📄 README.md                        Project overview and reference
├── 📄 PROJECT_STATUS.md                What's built, what's next
├── 📄 SETUP.md                         Comprehensive setup + troubleshooting
├── 📄 CONTRIBUTING.md                  Development guidelines
│
├── ⚡ quickstart.ps1                   Automated setup script (Windows)
├── 🔍 verify-setup.ps1                 Check your environment
│
├── 📦 package.json                     Root workspace config
├── 📦 pnpm-workspace.yaml              Monorepo setup
├── 🐳 docker-compose.yml               PostgreSQL + Redis containers
├── 🚫 .gitignore                       Git exclusions
├── 📄 .env.example                     Root environment template
│
├── .github/
│   └── workflows/
│       └── ci.yml                      GitHub Actions CI pipeline
│
└── apps/
    │
    ├── api/                            🔌 Backend API (Fastify)
    │   ├── 📦 package.json
    │   ├── 📦 tsconfig.json
    │   ├── 📄 .env.example             Backend environment template
    │   │
    │   ├── prisma/
    │   │   ├── schema.prisma           📊 Database schema (20+ models)
    │   │   ├── seed.ts                 🌱 Demo data generator
    │   │   └── migrations/             🗄️ Database migrations
    │   │
    │   └── src/
    │       ├── 🚀 index.ts             Server entry point
    │       ├── 🏗️ app.ts                Fastify app setup
    │       ├── ⚙️ config.ts              Environment config
    │       │
    │       ├── routes/                 🛣️ API Endpoints
    │       │   ├── auth.ts             Register, Login, Refresh
    │       │   ├── leads.ts            Lead CRUD + search
    │       │   ├── companies.ts        Company management
    │       │   ├── deals.ts            Deal pipeline
    │       │   ├── activities.ts       Timeline (notes, calls, emails)
    │       │   ├── tasks.ts            Task management
    │       │   ├── ai.ts               🤖 AI features (4 endpoints)
    │       │   ├── pipelines.ts        Pipeline + board view
    │       │   ├── sequences.ts        Email sequence automation
    │       │   └── dashboard.ts        Analytics + metrics
    │       │
    │       ├── middleware/             🛡️ Middleware
    │       │   ├── auth.ts             JWT + RBAC
    │       │   └── audit.ts            Change tracking
    │       │
    │       ├── jobs/                   ⏰ Background Workers
    │       │   ├── sequence.ts         Email automation
    │       │   └── digest.ts           Daily digest emails
    │       │
    │       ├── lib/                    📚 Utilities
    │       │   ├── prisma.ts           Database client
    │       │   ├── redis.ts            Redis client
    │       │   ├── openai.ts           OpenAI client
    │       │   └── email.ts            Email sender
    │       │
    │       ├── utils/                  🔧 Helpers
    │       │   └── password.ts         Bcrypt hashing
    │       │
    │       └── tests/                  🧪 Tests
    │           └── api.test.ts         Auth + Leads tests
    │
    └── web/                            💻 Frontend (React)
        ├── 📦 package.json
        ├── 📦 tsconfig.json
        ├── 📦 tsconfig.node.json
        ├── 📦 vite.config.ts           Build configuration
        ├── 📦 tailwind.config.js       Styling config
        ├── 📦 postcss.config.js        CSS processing
        ├── 📄 .env.example             Frontend environment template
        ├── 📄 index.html               HTML entry point
        │
        ├── public/                     Static assets
        │   └── vite.svg
        │
        └── src/
            ├── 🚀 main.tsx             React entry point
            ├── 🏗️ App.tsx               Router + auth guards
            ├── 🎨 index.css             Global styles + Tailwind
            │
            ├── pages/                  📄 Route Components
            │   ├── Login.tsx           ✅ Login form
            │   ├── Dashboard.tsx       ✅ Metrics dashboard
            │   └── Leads.tsx           ✅ Lead list + search
            │
            ├── components/             🧩 UI Components
            │   ├── Layout.tsx          App shell with sidebar
            │   │
            │   └── ui/                 shadcn/ui components
            │       ├── button.tsx      Button variants
            │       ├── input.tsx       Form inputs
            │       └── card.tsx        Card layouts
            │
            ├── lib/                    📚 Utilities
            │   ├── api.ts              🔌 API client (61 endpoints)
            │   └── utils.ts            Helpers (cn, formatters)
            │
            └── store/                  💾 State Management
                └── auth.ts             Zustand auth store
```

---

## 📂 Key Directories Explained

### `/apps/api` - Backend
The Fastify REST API with all business logic.

**Start here for backend work:**
- `src/routes/` - All API endpoints
- `prisma/schema.prisma` - Database structure
- `src/lib/` - Reusable clients and utilities

### `/apps/web` - Frontend
The React SPA that users interact with.

**Start here for frontend work:**
- `src/pages/` - Route components
- `src/components/` - Reusable UI components
- `src/lib/api.ts` - API client with all endpoints

### `/prisma` - Database
Database schema, migrations, and seed data.

**Important files:**
- `schema.prisma` - Define models here
- `seed.ts` - Demo data generation

### `/routes` - API Endpoints
Each file is a feature module.

**Pattern:**
```typescript
// Each route file exports a plugin function
export default async function leadsRoutes(app: FastifyInstance) {
  // Define endpoints
  app.get('/api/leads', { /* ... */ }, handler)
  app.post('/api/leads', { /* ... */ }, handler)
}
```

### `/jobs` - Background Workers
BullMQ workers for async processing.

**Current workers:**
- `sequence.ts` - Sends scheduled emails
- `digest.ts` - Daily summary emails

### `/pages` - Frontend Routes
Each file is a page component.

**Pattern:**
```typescript
export default function LeadsPage() {
  // Use TanStack Query for data
  const { data } = useQuery({ /* ... */ })
  
  // Render UI
  return <div>...</div>
}
```

---

## 📊 Statistics

### Files Created: ~70
- Backend: ~30 files
- Frontend: ~25 files  
- Config/Docs: ~15 files

### Lines of Code: ~6,700
- Backend TypeScript: ~3,500
- Frontend TypeScript: ~2,000
- SQL/Prisma: ~500
- Config/Docs: ~700

### API Endpoints: 61
- Auth: 5
- Leads: 9
- Companies: 6
- Deals: 8
- Activities: 6
- Tasks: 8
- AI: 4
- Pipelines: 4
- Sequences: 7
- Dashboard: 4

### Database Models: 20+
Organizations, Users, Leads, Companies, Deals, Pipelines, Stages, Activities, Tasks, Tags, Custom Fields, Email Templates, Sequences, AI Artifacts, Audit Logs, etc.

---

## 🎯 Where to Start

### First Time?
1. Read **[START_HERE.md](./START_HERE.md)**
2. Run `.\quickstart.ps1`
3. Open http://localhost:5173
4. Explore the demo data

### Want to Code?

**Backend Development:**
1. Open `apps/api/src/routes/` to see endpoints
2. Check `apps/api/prisma/schema.prisma` for models
3. Run `pnpm db:studio` to visualize data

**Frontend Development:**
1. Open `apps/web/src/pages/` to see pages
2. Check `apps/web/src/lib/api.ts` for API calls
3. Look at `apps/web/src/components/` for UI

**Add New Feature:**
1. Define model in `prisma/schema.prisma`
2. Create route in `apps/api/src/routes/`
3. Add endpoint to `apps/web/src/lib/api.ts`
4. Create page in `apps/web/src/pages/`

---

## 🔑 Most Important Files

### Configuration
- `docker-compose.yml` - Start infrastructure
- `apps/api/.env` - Backend config (DB, OpenAI, SMTP)
- `apps/web/.env` - Frontend config (API URL)

### Backend Core
- `apps/api/prisma/schema.prisma` - Database structure
- `apps/api/src/app.ts` - Fastify setup
- `apps/api/src/routes/auth.ts` - Authentication
- `apps/api/src/middleware/auth.ts` - JWT + RBAC

### Frontend Core
- `apps/web/src/App.tsx` - Router and auth
- `apps/web/src/lib/api.ts` - API client
- `apps/web/src/store/auth.ts` - Auth state
- `apps/web/src/components/Layout.tsx` - App shell

### Development
- `package.json` - Root scripts
- `pnpm-workspace.yaml` - Monorepo config
- `.github/workflows/ci.yml` - CI pipeline

### Documentation
- `START_HERE.md` - Complete overview
- `GETTING_STARTED.md` - Quick start
- `SETUP.md` - Detailed setup guide
- `PROJECT_STATUS.md` - Feature status
- `CONTRIBUTING.md` - Dev guidelines

---

## 🛠️ Common Tasks

### Add New API Endpoint

1. **Define in route file** (`apps/api/src/routes/leads.ts`):
```typescript
app.get('/api/leads/:id', {
  onRequest: [app.authenticate, requireRole(['SALES_REP'])],
  schema: { /* Zod validation */ }
}, async (request, reply) => {
  // Implementation
})
```

2. **Add to API client** (`apps/web/src/lib/api.ts`):
```typescript
async getLead(id: string) {
  return this.get<Lead>(`/api/leads/${id}`)
}
```

3. **Use in frontend** (`apps/web/src/pages/Leads.tsx`):
```typescript
const { data: lead } = useQuery({
  queryKey: ['lead', id],
  queryFn: () => api.getLead(id)
})
```

### Add New Database Model

1. **Update schema** (`apps/api/prisma/schema.prisma`):
```prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  
  @@map("my_models")
}
```

2. **Create migration**:
```bash
pnpm db:migrate
```

3. **Use in code**:
```typescript
const items = await prisma.myModel.findMany()
```

### Add New Page

1. **Create page file** (`apps/web/src/pages/MyPage.tsx`):
```typescript
export default function MyPage() {
  return <div>My Page</div>
}
```

2. **Add route** (`apps/web/src/App.tsx`):
```typescript
<Route path="/my-page" element={<MyPage />} />
```

3. **Add to sidebar** (`apps/web/src/components/Layout.tsx`):
```typescript
<Link to="/my-page">My Page</Link>
```

---

**Navigation Guide Complete!** 🗺️

Use this file as a reference when exploring the codebase.

For setup help, see **[START_HERE.md](./START_HERE.md)**
