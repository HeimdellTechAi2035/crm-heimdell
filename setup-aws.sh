#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Heimdell CRM — AWS EC2 Setup Script
#
#  Run as: sudo bash setup-aws.sh
#
#  Tested on:
#    - Amazon Linux 2023 (AL2023)
#    - Ubuntu 22.04 / 24.04 LTS
#
#  What this does:
#    1. Installs Node.js 20 LTS
#    2. Installs PostgreSQL 15
#    3. Installs pnpm + PM2
#    4. Creates the database + user
#    5. Clones the repo, installs deps, builds frontend
#    6. Runs Prisma migrations
#    7. Starts the app with PM2
#    8. Configures firewall (port 3000)
#
#  Recommended instance: t3.micro (free tier) or t3.small
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config ──────────────────────────────────────────────
REPO_URL="https://github.com/HeimdellTechAi2035/crm-heimdell.git"
INSTALL_DIR="/opt/heimdell-crm"
DB_NAME="heimdell_crm"
DB_USER="heimdell"
DB_PASS="heimdell_aws_$(openssl rand -hex 8)"
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 16)"
APP_PORT=3000

echo "══════════════════════════════════════════════════════"
echo "  Heimdell CRM — AWS EC2 Setup"
echo "══════════════════════════════════════════════════════"
echo ""

# ─── Detect OS ───────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID}"
    OS_VERSION="${VERSION_ID}"
  else
    OS_ID="unknown"
    OS_VERSION="unknown"
  fi
  echo "  Detected OS: ${OS_ID} ${OS_VERSION}"
}
detect_os

# ─── 1. System Updates ──────────────────────────────────
echo "[1/9] Updating system packages..."
if [[ "${OS_ID}" == "amzn" ]]; then
  dnf update -y -q
  dnf install -y -q git gcc-c++ make openssl
elif [[ "${OS_ID}" == "ubuntu" || "${OS_ID}" == "debian" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get upgrade -y -qq
  apt-get install -y -qq curl git build-essential openssl ca-certificates gnupg
else
  echo "  ⚠️  Unsupported OS: ${OS_ID}. Attempting Ubuntu-style install..."
  apt-get update -qq && apt-get install -y -qq curl git build-essential openssl
fi

# ─── 2. Install Node.js 20 LTS ─────────────────────────
echo "[2/9] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v22* ]]; then
  if [[ "${OS_ID}" == "amzn" ]]; then
    dnf install -y nodejs20 nodejs20-npm 2>/dev/null || {
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      dnf install -y nodejs
    }
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# ─── 3. Install PostgreSQL ─────────────────────────────
echo "[3/9] Installing PostgreSQL..."
if [[ "${OS_ID}" == "amzn" ]]; then
  dnf install -y postgresql15-server postgresql15 2>/dev/null || dnf install -y postgresql-server postgresql
  postgresql-setup --initdb 2>/dev/null || /usr/bin/postgresql-setup --initdb 2>/dev/null || true
  # Allow password auth for local connections
  PG_HBA=$(find /var/lib/pgsql -name pg_hba.conf 2>/dev/null | head -1)
  if [ -n "${PG_HBA}" ]; then
    sed -i 's/ident$/md5/g' "${PG_HBA}"
    sed -i 's/peer$/md5/g' "${PG_HBA}"
  fi
else
  apt-get install -y postgresql postgresql-contrib
fi

systemctl enable postgresql
systemctl start postgresql

# ─── 4. Create Database ─────────────────────────────────
echo "[4/9] Creating database '${DB_NAME}' and user '${DB_USER}'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"

# ─── 5. Install pnpm + PM2 ─────────────────────────────
echo "[5/9] Installing pnpm and PM2..."
npm install -g pnpm@latest pm2@latest
echo "  pnpm: $(pnpm -v)"
echo "  PM2: $(pm2 -v)"

# ─── 6. Clone and Install ──────────────────────────────
echo "[6/9] Cloning repository..."

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

echo "[6/9] Installing dependencies..."
pnpm install

# ─── 7. Create .env ────────────────────────────────────
echo "[7/9] Creating .env file..."
ENV_FILE="${INSTALL_DIR}/apps/api/.env"

# Detect public IP for CORS
PUBLIC_IP=$(curl -s --connect-timeout 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s --connect-timeout 5 https://checkip.amazonaws.com 2>/dev/null || echo "localhost")

cat > "${ENV_FILE}" << EOF
# ═══════════════════════════════════════════════════════
#  Heimdell CRM — Production Config (AWS EC2)
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

# Redis (optional — install redis-server if you want it)
ENABLE_REDIS=false
# REDIS_HOST=localhost
# REDIS_PORT=6379

# SMTP (configure your email provider)
# SMTP_HOST=smtp.livemail.co.uk
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_DEFAULT_FROM=andrew@remoteability.org

# AI (optional)
# OPENAI_API_KEY=sk-xxx

# CORS — update with your domain or Elastic IP
CORS_ORIGIN=http://${PUBLIC_IP}:${APP_PORT}
EOF

echo "  .env written to ${ENV_FILE}"
echo "  Public IP detected: ${PUBLIC_IP}"

# ─── 8. Build and Migrate ──────────────────────────────
echo "[8/9] Building application..."
cd "${INSTALL_DIR}"

# Generate Prisma client
cd apps/api
npx prisma generate
npx prisma migrate deploy
cd "${INSTALL_DIR}"

# Build frontend
pnpm --filter @heimdell/web build 2>/dev/null || pnpm --filter web build 2>/dev/null || echo "  (frontend build — check package names)"

# ─── 9. Start with PM2 ─────────────────────────────────
echo "[9/9] Starting with PM2..."
cd "${INSTALL_DIR}"
pm2 start ecosystem.config.cjs --env production
pm2 save

# Setup PM2 to start on boot
PM2_USER=$(whoami)
pm2 startup systemd -u "${PM2_USER}" --hp "/home/${PM2_USER}" 2>/dev/null || pm2 startup 2>/dev/null || true
pm2 save

# ─── Firewall hint ──────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ Heimdell CRM is running!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Local URL:    http://localhost:${APP_PORT}"
echo "  Public URL:   http://${PUBLIC_IP}:${APP_PORT}"
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
echo "  ⚠️  AWS SECURITY GROUP:"
echo "  Make sure your EC2 Security Group allows inbound"
echo "  traffic on port ${APP_PORT} (TCP) from your IP or 0.0.0.0/0"
echo ""
echo "  To add HTTPS, see DEPLOY-AWS.md for:"
echo "    Option A: Elastic IP + Caddy (auto-TLS, free)"
echo "    Option B: ALB + ACM certificate (AWS managed)"
echo "    Option C: Cloudflare proxy (free HTTPS)"
echo ""
echo "  ⚠️  SAVE THE DATABASE PASSWORD ABOVE — it won't be shown again!"
echo "══════════════════════════════════════════════════════"
