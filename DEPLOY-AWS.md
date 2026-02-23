# Heimdell CRM — AWS EC2 Deployment Guide

## Recommended Instance

| Size | vCPU | RAM | Cost | Notes |
|------|------|-----|------|-------|
| **t3.micro** | 2 | 1 GB | **Free tier** (750h/mo for 12 months) | Tight but works |
| **t3.small** | 2 | 2 GB | ~$15/mo | Comfortable — recommended |
| t3.medium | 2 | 4 GB | ~$30/mo | Overkill unless you add Redis + AI |

---

## Step 1: Launch an EC2 Instance

1. Go to [EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:

| Setting | Value |
|---------|-------|
| Name | `heimdell-crm` |
| AMI | **Ubuntu 24.04 LTS** (or Amazon Linux 2023) |
| Instance type | `t3.small` (or `t3.micro` for free tier) |
| Key pair | Create new or select existing |
| Network | Default VPC |
| Storage | 20 GB gp3 |

4. **Security Group** — create a new one named `heimdell-sg` with these inbound rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | My IP | SSH access |
| Custom TCP | 3000 | 0.0.0.0/0 | CRM app (temporary, replace with 443 later) |
| HTTPS | 443 | 0.0.0.0/0 | After setting up TLS |

5. Click **Launch Instance**

---

## Step 2: SSH In and Run Setup

```bash
# Connect (replace with your key and public IP)
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2-PUBLIC-IP>

# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/HeimdellTechAi2035/crm-heimdell/main/setup-aws.sh | sudo bash
```

The script takes ~5 minutes and installs everything automatically. At the end it prints your **database password** — save it.

---

## Step 3: Verify It's Running

```bash
# Check PM2
pm2 status

# Test locally
curl http://localhost:3000/api/ping

# Test from your browser
# http://<EC2-PUBLIC-IP>:3000
```

Login: `andrew@heimdell.tech` / `Heimtec2026@!?@`

---

## Step 4: Add HTTPS (Choose One)

### Option A: Caddy Reverse Proxy (Easiest — Auto TLS)

Requires: a domain pointing to your EC2 Elastic IP.

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Configure Caddy
sudo tee /etc/caddy/Caddyfile << 'EOF'
crm.heimdell.tech {
    reverse_proxy localhost:3000
}
EOF

# Start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
```

Caddy automatically gets a Let's Encrypt certificate. Update your `.env`:

```bash
sudo sed -i 's|CORS_ORIGIN=.*|CORS_ORIGIN=https://crm.heimdell.tech|' /opt/heimdell-crm/apps/api/.env
pm2 restart heimdell-api
```

### Option B: AWS ALB + ACM

1. Request a free SSL cert in **AWS Certificate Manager**
2. Create an **Application Load Balancer** pointing to your EC2
3. ALB listener: HTTPS 443 → target group → EC2:3000
4. Update Security Group: remove port 3000 public access, keep ALB access only

### Option C: Cloudflare Proxy (Free)

1. Add your domain to Cloudflare
2. Point DNS A record to your EC2 Elastic IP
3. Enable Cloudflare Proxy (orange cloud)
4. Set SSL mode to "Full"
5. Update CORS_ORIGIN in `.env` to your domain

---

## Step 5: Assign an Elastic IP (Recommended)

Without an Elastic IP, your public IP changes every time the instance stops.

```
EC2 Console → Elastic IPs → Allocate → Associate with your instance
```

Then update DNS records if using a domain.

---

## Step 6: Create an API Key for OpenClaw

```bash
# Get a JWT token
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

Save the `hmdl_` key — it can't be retrieved again.

---

## OpenClaw Agent Configuration

| Setting | Value |
|---------|-------|
| Base URL | `https://crm.heimdell.tech/api/agent` |
| Auth Header | `Authorization: Bearer hmdl_<your-key>` |
| OpenAPI Spec | `GET /api/agent/openapi` |
| Health Check | `GET /api/agent/health` |
| Auth Test | `GET /api/agent/auth-test` |

---

## Maintenance

```bash
# Update to latest code
curl -fsSL https://raw.githubusercontent.com/HeimdellTechAi2035/crm-heimdell/main/update-aws.sh | sudo bash
# Or locally:
sudo bash /opt/heimdell-crm/update-aws.sh

# PM2 commands
pm2 status                    # Check running
pm2 logs heimdell-api         # Live logs
pm2 restart heimdell-api      # Restart
pm2 monit                     # CPU/RAM monitor

# Database
sudo -u postgres psql -d heimdell_crm -c "SELECT count(*) FROM \"Lead\";"

# Disk / Memory
df -h
free -m
```

---

## Optional: Install Redis

Redis enables idempotency caching and future job queues:

```bash
# Ubuntu
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Amazon Linux
sudo dnf install -y redis6
sudo systemctl enable redis6
sudo systemctl start redis6

# Update .env
sudo sed -i 's/ENABLE_REDIS=false/ENABLE_REDIS=true/' /opt/heimdell-crm/apps/api/.env
pm2 restart heimdell-api
```

---

## Cost Optimization

| Tip | Savings |
|-----|---------|
| Use `t3.micro` inside free tier | Free for 12 months |
| Stop instance when not in use | Only pay when running |
| Use Reserved Instance (1-year) | ~40% discount on t3.small |
| Use Spot Instance for dev/test | Up to 90% off |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't connect on port 3000 | Check Security Group inbound rules |
| `npm install` runs out of memory | Create swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Prisma generate fails | Run `npx prisma generate` inside `apps/api/` |
| PostgreSQL won't start | `sudo systemctl status postgresql` — check auth in `pg_hba.conf` |
| PM2 not starting on boot | Run `pm2 startup` and follow instructions, then `pm2 save` |
| IP changed after restart | Assign an Elastic IP (see Step 5) |
