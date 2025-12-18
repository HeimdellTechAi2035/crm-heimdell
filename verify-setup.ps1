# Heimdell CRM - Setup Verification Script

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║         🏠 Heimdell CRM - Setup Verification          ║" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Node.js
Write-Host "Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    if ($nodeVersion -match "v(\d+)") {
        $major = [int]$matches[1]
        if ($major -ge 18) {
            Write-Host " ✓ $nodeVersion" -ForegroundColor Green
        } else {
            Write-Host " ✗ Version $nodeVersion found, but 18+ required" -ForegroundColor Red
            $allGood = $false
        }
    }
} catch {
    Write-Host " ✗ Not found" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org" -ForegroundColor Yellow
    $allGood = $false
}

# Check pnpm
Write-Host "Checking pnpm..." -NoNewline
try {
    $pnpmVersion = pnpm --version
    Write-Host " ✓ $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host " ✗ Not found" -ForegroundColor Red
    Write-Host "  Install with: npm install -g pnpm" -ForegroundColor Yellow
    $allGood = $false
}

# Check Docker
Write-Host "Checking Docker..." -NoNewline
try {
    $dockerVersion = docker --version
    Write-Host " ✓" -ForegroundColor Green
} catch {
    Write-Host " ✗ Not found" -ForegroundColor Red
    Write-Host "  Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    $allGood = $false
}

# Check if dependencies are installed
Write-Host "Checking dependencies..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✓ Installed" -ForegroundColor Green
} else {
    Write-Host " ✗ Not installed" -ForegroundColor Red
    Write-Host "  Run: pnpm install" -ForegroundColor Yellow
    $allGood = $false
}

# Check if Docker containers are running
Write-Host "Checking Docker containers..." -NoNewline
try {
    $containers = docker-compose ps --services --filter "status=running" 2>$null
    if ($containers -match "postgres" -and $containers -match "redis") {
        Write-Host " ✓ Running" -ForegroundColor Green
    } else {
        Write-Host " ✗ Not running" -ForegroundColor Yellow
        Write-Host "  Run: docker-compose up -d" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ✗ Cannot check" -ForegroundColor Yellow
}

# Check API .env
Write-Host "Checking API configuration..." -NoNewline
if (Test-Path "apps\api\.env") {
    $envContent = Get-Content "apps\api\.env" -Raw
    if ($envContent -match "OPENAI_API_KEY=sk-" -and $envContent -notmatch "your-openai-api-key") {
        Write-Host " ✓ Configured" -ForegroundColor Green
    } else {
        Write-Host " ⚠ Missing OpenAI key" -ForegroundColor Yellow
        Write-Host "  Edit apps\api\.env and add your OpenAI API key" -ForegroundColor Yellow
    }
} else {
    Write-Host " ✗ Not found" -ForegroundColor Red
    Write-Host "  Run: Copy-Item apps\api\.env.example apps\api\.env" -ForegroundColor Yellow
    $allGood = $false
}

# Check Web .env
Write-Host "Checking Web configuration..." -NoNewline
if (Test-Path "apps\web\.env") {
    Write-Host " ✓ Configured" -ForegroundColor Green
} else {
    Write-Host " ⚠ Not found (optional)" -ForegroundColor Yellow
    Write-Host "  Run: Copy-Item apps\web\.env.example apps\web\.env" -ForegroundColor Yellow
}

# Check if database is migrated
Write-Host "Checking database..." -NoNewline
if (Test-Path "apps\api\prisma\migrations") {
    $migrations = Get-ChildItem "apps\api\prisma\migrations" -Directory
    if ($migrations.Count -gt 0) {
        Write-Host " ✓ Migrations exist" -ForegroundColor Green
    } else {
        Write-Host " ⚠ No migrations" -ForegroundColor Yellow
        Write-Host "  Run: pnpm db:migrate" -ForegroundColor Yellow
    }
} else {
    Write-Host " ⚠ Not migrated" -ForegroundColor Yellow
    Write-Host "  Run: pnpm db:migrate" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($allGood) {
    Write-Host ""
    Write-Host "✅ All prerequisites met!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. docker-compose up -d" -ForegroundColor White
    Write-Host "  2. pnpm db:migrate" -ForegroundColor White
    Write-Host "  3. pnpm db:seed" -ForegroundColor White
    Write-Host "  4. pnpm dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Then visit:" -ForegroundColor Cyan
    Write-Host "  • Web App: http://localhost:5173" -ForegroundColor White
    Write-Host "  • API: http://localhost:3000" -ForegroundColor White
    Write-Host "  • API Docs: http://localhost:3000/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "Demo login: rep@heimdell.com / rep123" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "⚠️  Please resolve the issues above before proceeding." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See SETUP.md for detailed instructions." -ForegroundColor Cyan
}

Write-Host ""
