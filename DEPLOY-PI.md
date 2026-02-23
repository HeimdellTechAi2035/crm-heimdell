# Heimdell CRM — Raspberry Pi 3 Deployment Guide

## Prerequisites

- **Raspberry Pi 3** (or newer) running **Raspberry Pi OS 64-bit** (Bookworm)
- MicroSD card (16GB+, Class 10)
- Ethernet or WiFi connection
- SSH access to the Pi

> ⚠️ You **must** use the **64-bit** OS. The 32-bit version won't work with Prisma ARM binaries.

---

## Quick Start (One Command)

SSH into your Pi and run:

```bash
curl -fsSL https://raw.githubusercontent.com/HeimdellTechAi2035/crm-heimdell/main/setup-pi.sh | sudo bash
```

Or clone first and run locally:

```bash
git clone https://github.com/HeimdellTechAi2035/crm-heimdell.git
cd crm-heimdell
sudo bash setup-pi.sh
```

The script installs everything: Node.js 20, PostgreSQL, pnpm, PM2, creates the database, builds the app, and starts it.

After it finishes you'll see the **database password** — **save it immediately**.

---

## Expose to the Internet (Cloudflare Tunnel)

OpenClaw needs to reach your Pi over the internet. **Cloudflare Tunnel** is the best free option — no port forwarding, no dynamic DNS, automatic HTTPS.

### Step 1: Create a Cloudflare account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (free)
3. Add your domain (e.g. `heimdell.tech`) or use a free `.cfargotunnel.com` subdomain

### Step 2: Install cloudflared on the Pi

```bash
# Download ARM64 binary
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# Verify
cloudflared --version
```

### Step 3: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser URL. Copy it to your PC, log in, and authorize.

### Step 4: Create the tunnel

```bash
# Create tunnel
cloudflared tunnel create heimdell-crm

# Note the tunnel UUID printed (e.g. a1b2c3d4-...)
```

### Step 5: Configure the tunnel

```bash
sudo mkdir -p /etc/cloudflared

sudo tee /etc/cloudflared/config.yml << 'EOF'
tunnel: heimdell-crm
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: crm.heimdell.tech
    service: http://localhost:3000
  - service: http_status:404
EOF
```

Replace:
- `<TUNNEL_UUID>` with your actual tunnel UUID
- `crm.heimdell.tech` with your domain/subdomain

### Step 6: Create DNS record

```bash
cloudflared tunnel route dns heimdell-crm crm.heimdell.tech
```

### Step 7: Start the tunnel as a service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### Step 8: Update CORS in .env

```bash
sudo nano /opt/heimdell-crm/apps/api/.env
```

Change:
```
CORS_ORIGIN=https://crm.heimdell.tech
```

Then restart:
```bash
cd /opt/heimdell-crm
pm2 restart heimdell-api
```

Your CRM is now live at `https://crm.heimdell.tech` 🎉

---

## Create an API Key for OpenClaw

```bash
# First, get a JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"andrew@heimdell.tech","password":"Heimtec2026@!?@"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Create the API key
curl -X POST http://localhost:3000/api/api-keys \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name": "openclaw-agent", "permissions": ["read","update","transition","note"]}'
```

Save the `key` value from the response — it starts with `hmdl_` and **cannot be retrieved again**.

---

## OpenClaw Agent Configuration

Give OpenClaw these details:

| Setting | Value |
|---------|-------|
| Base URL | `https://crm.heimdell.tech/api/agent` |
| Auth Header | `Authorization: Bearer hmdl_<your-key>` |
| OpenAPI Spec | `GET /api/agent/openapi` |
| Health Check | `GET /api/agent/health` |
| Auth Test | `GET /api/agent/auth-test` |

---

## Maintenance Commands

```bash
# Check status
pm2 status

# View logs (live)
pm2 logs heimdell-api

# Restart app
pm2 restart heimdell-api

# Update to latest code
cd /opt/heimdell-crm
git pull origin main
pnpm install
cd apps/api && npx prisma migrate deploy && cd ../..
pm2 restart heimdell-api

# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -d heimdell_crm -c "SELECT count(*) FROM \"Lead\";"

# Check disk space
df -h

# Check memory
free -m

# Check tunnel status
sudo systemctl status cloudflared
```

---

## Performance Tips for Pi 3

The Pi 3 has **1GB RAM**. To keep things running smooth:

1. **No Redis** — the app works fine without it (`ENABLE_REDIS=false`)
2. **No AI features** — skip the OpenAI API key to avoid memory-heavy calls
3. **One PM2 instance** — already configured in `ecosystem.config.cjs`
4. **Swap file** — add 1GB swap as a safety net:
   ```bash
   sudo dphys-swapfile swapoff
   sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```
5. **Log rotation** — prevent logs from filling the SD card:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 3
   ```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `prisma generate` fails | Make sure you're on 64-bit OS: `uname -m` should show `aarch64` |
| App won't start | Check logs: `pm2 logs heimdell-api --lines 50` |
| Database connection refused | `sudo systemctl start postgresql` |
| Tunnel not working | `sudo systemctl status cloudflared` and check `/etc/cloudflared/config.yml` |
| Out of memory | Add swap (see above), or reduce `max_memory_restart` in `ecosystem.config.cjs` |
| Permission denied | Run setup with `sudo`, or fix ownership: `sudo chown -R pi:pi /opt/heimdell-crm` |
