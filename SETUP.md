# Heimdell CRM - Setup Guide

This guide will help you get Heimdell CRM up and running in minutes.

## Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher (install with `npm install -g pnpm`)
- **Docker** and **Docker Compose**
- **OpenAI API key** (get one at https://platform.openai.com)

## Quick Start

### 1. Install Dependencies

```powershell
pnpm install
```

### 2. Start Infrastructure

Start PostgreSQL and Redis using Docker:

```powershell
docker-compose up -d
```

Wait 30 seconds for services to be ready.

### 3. Configure Environment

#### Backend Configuration

Copy the example environment file:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Edit `apps/api/.env` and set your values:

- **DATABASE_URL**: Already configured for Docker
- **REDIS_URL**: Already configured for Docker
- **JWT_SECRET**: Change to a random string (important for production!)
- **JWT_REFRESH_SECRET**: Change to a different random string
- **OPENAI_API_KEY**: Your OpenAI API key (required for AI features)
- **SMTP_***: Your email provider settings (for sending emails)

For Gmail SMTP:
- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=587
- SMTP_USER=your-email@gmail.com
- SMTP_PASSWORD=your-app-password (not your regular password!)

#### Frontend Configuration

```powershell
Copy-Item apps\web\.env.example apps\web\.env
```

The default values should work if running locally.

### 4. Initialize Database

Run migrations:

```powershell
pnpm db:migrate
```

Seed with demo data:

```powershell
pnpm db:seed
```

### 5. Start Development Servers

```powershell
pnpm dev
```

This starts:
- **API Server**: http://localhost:3000
- **Web App**: http://localhost:5173
- **API Docs**: http://localhost:3000/docs

## Demo Accounts

After seeding, you can login with:

- **Admin**: admin@heimdell.com / admin123
- **Manager**: manager@heimdell.com / manager123
- **Sales Rep**: rep@heimdell.com / rep123

## Project Structure

```
heimdell-crm/
├── apps/
│   ├── api/              # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── jobs/     # BullMQ workers
│   │   │   ├── lib/      # Shared utilities
│   │   │   └── middleware/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── web/              # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── lib/
│       │   └── store/
│       └── index.html
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Features Overview

### Core CRM
- ✅ Leads management
- ✅ Companies
- ✅ Deals with pipeline stages
- ✅ Activities timeline
- ✅ Tasks with due dates
- ✅ Tags and custom fields
- ✅ Email templates

### AI Features
- ✅ Lead/Company enrichment (AI-generated insights)
- ✅ Next best action suggestions
- ✅ Email sequence generation
- ✅ Call summary AI assistant

### Automation
- ✅ Email sequences with scheduling
- ✅ Daily digest emails
- ✅ Automatic activity logging

### Security
- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting
- ✅ Audit logs

### Reporting
- ✅ Dashboard with key metrics
- ✅ Win rate and conversion tracking
- ✅ Pipeline value analytics

## Using AI Features

### 1. Lead Enrichment

On a lead detail page, click "Enrich with AI" to get:
- Company summary
- Pain points
- Sales angle suggestions
- Email templates
- Call scripts

### 2. Next Best Action

Click "Suggest Next Step" on a lead/deal to get AI recommendations on:
- What to do next (email, call, task)
- Draft messages
- Timing recommendations

### 3. Sequence Generator

Create automated outreach sequences:
- Specify your goal
- AI generates 5-step sequence
- Mix of emails and tasks
- Personalization tokens included

### 4. Call Summaries

After a call, paste your rough notes and AI will:
- Create structured summary
- Extract objections
- Identify commitments
- Generate follow-up tasks

## Development Commands

```powershell
# Install dependencies
pnpm install

# Start dev servers (both API and Web)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Database commands
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed demo data
pnpm db:studio       # Open Prisma Studio

# Individual app commands
cd apps/api
pnpm dev            # Start only API

cd apps/web
pnpm dev            # Start only frontend
```

## Troubleshooting

### Database connection fails
- Ensure Docker is running
- Check containers: `docker-compose ps`
- Restart: `docker-compose restart`

### Port already in use
- API (3000) or Web (5173) ports may be taken
- Change in `.env` files and restart

### AI features not working
- Verify OPENAI_API_KEY in `apps/api/.env`
- Check API key is valid and has credits
- See API logs for detailed errors

### Email sending fails
- SMTP settings must be correct
- For Gmail, use App Password, not regular password
- Enable "Less secure app access" if needed

## Production Deployment

### Environment Variables

Set all environment variables properly:
- Change JWT secrets to strong random strings
- Use production database
- Configure production SMTP
- Set NODE_ENV=production

### Build

```powershell
pnpm build
```

### Run Migrations

```powershell
cd apps/api
pnpm db:migrate:prod
```

### Start

```powershell
# API
cd apps/api
pnpm start

# Web (build and serve with nginx/vercel/netlify)
cd apps/web
# Use built files from dist/
```

## API Documentation

Visit http://localhost:3000/docs when the API is running to see full OpenAPI/Swagger documentation.

## Support

For issues or questions:
1. Check this guide
2. Review API logs
3. Check database with `pnpm db:studio`

## License

MIT
