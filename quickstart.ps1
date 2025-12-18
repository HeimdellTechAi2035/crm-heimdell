# Heimdell CRM - Quick Start Script

param(
    [switch]$SkipInstall,
    [switch]$SkipDocker,
    [switch]$SkipMigrate,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║         🏠 Heimdell CRM - Quick Start                 ║" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Install dependencies
if (-not $SkipInstall) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Setup environment files
Write-Host "⚙️  Setting up environment files..." -ForegroundColor Cyan

if (-not (Test-Path "apps\api\.env")) {
    Copy-Item "apps\api\.env.example" "apps\api\.env"
    Write-Host "✓ Created apps\api\.env" -ForegroundColor Green
    Write-Host "⚠️  Please edit apps\api\.env and add your OpenAI API key!" -ForegroundColor Yellow
} else {
    Write-Host "✓ apps\api\.env already exists" -ForegroundColor Green
}

if (-not (Test-Path "apps\web\.env")) {
    Copy-Item "apps\web\.env.example" "apps\web\.env"
    Write-Host "✓ Created apps\web\.env" -ForegroundColor Green
} else {
    Write-Host "✓ apps\web\.env already exists" -ForegroundColor Green
}
Write-Host ""

# Start Docker containers
if (-not $SkipDocker) {
    Write-Host "🐳 Starting Docker containers..." -ForegroundColor Cyan
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start Docker containers" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Docker containers started" -ForegroundColor Green
    Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Write-Host ""
}

# Run migrations
if (-not $SkipMigrate) {
    Write-Host "🗄️  Running database migrations..." -ForegroundColor Cyan
    Set-Location "apps\api"
    pnpm db:migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to run migrations" -ForegroundColor Red
        Set-Location "..\..\"
        exit 1
    }
    Set-Location "..\..\"
    Write-Host "✓ Database migrated" -ForegroundColor Green
    Write-Host ""
}

# Seed database
if (-not $SkipSeed) {
    Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
    Set-Location "apps\api"
    pnpm db:seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to seed database" -ForegroundColor Red
        Set-Location "..\..\"
        exit 1
    }
    Set-Location "..\..\"
    Write-Host "✓ Database seeded" -ForegroundColor Green
    Write-Host ""
}

Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "║              ✅ Setup Complete!                        ║" -ForegroundColor Green
Write-Host "║                                                       ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 To start the development servers, run:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   pnpm dev" -ForegroundColor White
Write-Host ""
Write-Host "Then visit:" -ForegroundColor Cyan
Write-Host "   • Web App:  http://localhost:5173" -ForegroundColor White
Write-Host "   • API:      http://localhost:3000" -ForegroundColor White
Write-Host "   • API Docs: http://localhost:3000/docs" -ForegroundColor White
Write-Host ""
Write-Host "📧 Demo accounts:" -ForegroundColor Cyan
Write-Host "   • Admin:   admin@heimdell.com / admin123" -ForegroundColor White
Write-Host "   • Manager: manager@heimdell.com / manager123" -ForegroundColor White
Write-Host "   • Rep:     rep@heimdell.com / rep123" -ForegroundColor White
Write-Host ""
Write-Host "📖 See SETUP.md for more information" -ForegroundColor Yellow
Write-Host ""
