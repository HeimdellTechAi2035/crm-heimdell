# CRM Heimdell - Complete Dependency Setup Script
# Run this script AFTER installing Node.js from https://nodejs.org/

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CRM Heimdell - Dependency Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Install the LTS version (v20.x or higher)" -ForegroundColor White
    Write-Host "3. Restart PowerShell after installation" -ForegroundColor White
    Write-Host "4. Run this script again" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pnpm is installed
Write-Host ""
Write-Host "Checking for pnpm..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm found: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ pnpm installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
}

# Navigate to project root
Write-Host ""
Write-Host "Navigating to project directory..." -ForegroundColor Yellow
Set-Location "c:\Users\andre\OneDrive\Desktop\crm heimdell"
Write-Host "✓ In project root" -ForegroundColor Green

# Install root dependencies
Write-Host ""
Write-Host "Installing root dependencies..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Root dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install root dependencies" -ForegroundColor Red
    exit 1
}

# Install API dependencies
Write-Host ""
Write-Host "Installing API dependencies..." -ForegroundColor Yellow
Set-Location "apps/api"
pnpm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ API dependencies installed (including @fastify/multipart)" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install API dependencies" -ForegroundColor Red
    exit 1
}

# Install Web dependencies
Write-Host ""
Write-Host "Installing Web dependencies..." -ForegroundColor Yellow
Set-Location "../web"
pnpm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Web dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Web dependencies" -ForegroundColor Red
    exit 1
}

# Back to root for database migration
Write-Host ""
Write-Host "Returning to project root..." -ForegroundColor Yellow
Set-Location "../.."

# Run database migration
Write-Host ""
Write-Host "Running database migration..." -ForegroundColor Yellow
Write-Host "(This will create ImportJob, ImportRow tables and add profile fields)" -ForegroundColor Cyan
pnpm db:migrate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database migration completed" -ForegroundColor Green
} else {
    Write-Host "✗ Database migration failed" -ForegroundColor Red
    Write-Host "  Make sure your database is running and .env is configured" -ForegroundColor Yellow
    exit 1
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was installed:" -ForegroundColor Yellow
Write-Host "  ✓ pnpm (package manager)" -ForegroundColor White
Write-Host "  ✓ Root workspace dependencies" -ForegroundColor White
Write-Host "  ✓ API dependencies (@fastify/multipart + all others)" -ForegroundColor White
Write-Host "  ✓ Web dependencies" -ForegroundColor White
Write-Host "  ✓ Database tables (import_jobs, import_rows)" -ForegroundColor White
Write-Host "  ✓ Profile fields (on leads and companies)" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the dev servers:" -ForegroundColor White
Write-Host "     pnpm dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Open the app:" -ForegroundColor White
Write-Host "     http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Test the CSV import:" -ForegroundColor White
Write-Host "     - Click 'Import CSV' in the sidebar" -ForegroundColor White
Write-Host "     - Upload: sample_leads.csv" -ForegroundColor White
Write-Host "     - Map columns and start import" -ForegroundColor White
Write-Host "     - Watch 15 leads get imported with AI profiles!" -ForegroundColor White
Write-Host ""
Write-Host "Ready to go! 🚀" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
