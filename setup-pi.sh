#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Heimdell CRM — Raspberry Pi 3 Setup Script
#
#  Run as: sudo bash setup-pi.sh
#
#  What this does:
#    1. Installs Node.js 20 LTS (ARM64)
#    2. Installs PostgreSQL 15
#    3. Installs pnpm + PM2
#    4. Creates the database + user
#    5. Clones the repo and builds everything
#    6. Runs Prisma migrations
#    7. Starts the app with PM2
#
#  Prerequisites:
#    - Raspberry Pi OS 64-bit (Bookworm recommended)
#    - Internet connection
#    - At least 512MB free RAM
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config ──────────────────────────────────────────────
REPO_URL="https://github.com/HeimdellTechAi2035/crm-heimdell.git"
INSTALL_DIR="/opt/heimdell-crm"
DB_NAME="heimdell_crm"
DB_USER="heimdell"
DB_PASS="heimdell_pi_$(openssl rand -hex 8)"
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 16)"
APP_PORT=3000

echo "══════════════════════════════════════════════════════"
echo "  Heimdell CRM — Raspberry Pi Setup"
echo "══════════════════════════════════════════════════════"
echo ""

# ─── 1. System Updates ──────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Node.js 20 LTS ─────────────────────────
echo "[2/8] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# ─── 3. Install PostgreSQL ─────────────────────────────
echo "[3/8] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user
echo "[3/8] Creating database '${DB_NAME}' and user '${DB_USER}'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"

# ─── 4. Install pnpm + PM2 ─────────────────────────────
echo "[4/8] Installing pnpm and PM2..."
npm install -g pnpm@latest pm2@latest
echo "  pnpm: $(pnpm -v)"
echo "  PM2: $(pm2 -v)"

# ─── 5. Clone and Build ────────────────────────────────
echo "[5/8] Cloning repository..."

# Create log directory for PM2
mkdir -p /var/log/heimdell

if [ -d "${INSTALL_DIR}" ]; then
  echo "  Directory exists — pulling latest..."
  cd "${INSTALL_DIR}"
  git pull origin main
else
  git clone "${REPO_URL}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
fi

# Install dependencies
echo "[5/8] Installing dependencies..."
pnpm install

# ─── 6. Create .env ────────────────────────────────────
echo "[6/8] Creating .env file..."
ENV_FILE="${INSTALL_DIR}/apps/api/.env"

cat > "${ENV_FILE}" << EOF
# ═══════════════════════════════════════════════════════
#  Heimdell CRM — Production Config (Raspberry Pi)
#  Generated: $(date -Iseconds)
# ═══════════════════════════════════════════════════════

NODE_ENV=production
PORT=${APP_PORT}
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

# Security
JWT_SECRET=${JWT_SECRET}
APP_ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Redis (optional — app works without it)
ENABLE_REDIS=false

# SMTP (configure your email provider)
# SMTP_HOST=smtp.livemail.co.uk
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_DEFAULT_FROM=andrew@remoteability.org

# AI (optional)
# OPENAI_API_KEY=sk-xxx

# CORS — update after setting up Cloudflare Tunnel
CORS_ORIGIN=http://localhost:${APP_PORT}
EOF

echo "  .env written to ${ENV_FILE}"

# ─── 7. Build and Migrate ──────────────────────────────
echo "[7/8] Building application..."
cd "${INSTALL_DIR}"

# Generate Prisma client for ARM64
cd apps/api
npx prisma generate
npx prisma migrate deploy
cd "${INSTALL_DIR}"

# Build frontend
pnpm --filter @heimdell/web build 2>/dev/null || pnpm --filter web build 2>/dev/null || echo "  (frontend build skipped — check package names)"

# Build API (TypeScript → JavaScript)
pnpm --filter @heimdell/api build 2>/dev/null || pnpm --filter api build 2>/dev/null || echo "  (api build skipped — using tsx)"

# ─── 8. Start with PM2 ─────────────────────────────────
echo "[8/8] Starting with PM2..."
cd "${INSTALL_DIR}"
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ Heimdell CRM is running!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Local URL:    http://localhost:${APP_PORT}"
echo "  LAN URL:      http://$(hostname -I | awk '{print $1}'):${APP_PORT}"
echo ""
echo "  Login:        andrew@heimdell.tech"
echo "  Password:     Heimtec2026@!?@"
echo ""
echo "  Database:     ${DB_NAME} (user: ${DB_USER})"
echo "  DB Password:  ${DB_PASS}"
echo ""
echo "  PM2 status:   pm2 status"
echo "  PM2 logs:     pm2 logs heimdell-api"
echo "  PM2 restart:  pm2 restart heimdell-api"
echo ""
echo "  .env file:    ${ENV_FILE}"
echo ""
echo "  NEXT STEPS:"
echo "  1. Install Cloudflare Tunnel to expose to the internet"
echo "     (see DEPLOY-PI.md for instructions)"
echo "  2. Update CORS_ORIGIN in .env with your tunnel URL"
echo "  3. Create an API key for OpenClaw:"
echo "     curl -X POST http://localhost:${APP_PORT}/api/api-keys \\"
echo "       -H 'Authorization: Bearer <jwt_token>' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"name\": \"openclaw-agent\"}'"
echo ""
echo "  ⚠️  SAVE THE DATABASE PASSWORD ABOVE — it won't be shown again!"
echo "══════════════════════════════════════════════════════"
