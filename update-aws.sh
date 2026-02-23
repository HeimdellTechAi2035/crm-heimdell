#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Heimdell CRM — Update Script (AWS EC2)
#
#  Run as: sudo bash update-aws.sh
#  Pulls latest code, installs deps, migrates DB, restarts app
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

INSTALL_DIR="/opt/heimdell-crm"

echo "═══ Updating Heimdell CRM ═══"

cd "${INSTALL_DIR}"

echo "[1/4] Pulling latest code..."
git pull origin main

echo "[2/4] Installing dependencies..."
pnpm install

echo "[3/4] Running database migrations..."
cd apps/api
npx prisma generate
npx prisma migrate deploy
cd "${INSTALL_DIR}"

echo "[4/4] Restarting application..."
pm2 restart heimdell-api

echo ""
echo "✅ Update complete!"
pm2 status
