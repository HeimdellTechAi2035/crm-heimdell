@echo off
echo ==========================================
echo   Heimdell CRM - Offline Mode Startup
echo ==========================================
echo.
echo Prerequisites: Docker Desktop must be running!
echo.

cd /d "%~dp0"

echo [1/5] Starting PostgreSQL database...
docker-compose up -d postgres
if %errorlevel% neq 0 (
    echo ERROR: Failed to start PostgreSQL. Is Docker running?
    pause
    exit /b 1
)

echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak > nul

echo.
echo [2/5] Installing dependencies...
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/5] Generating Prisma client...
cd apps\api
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)

echo.
echo [4/5] Setting up database schema...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERROR: Failed to setup database
    pause
    exit /b 1
)

echo.
echo [5/5] Seeding database with sample data...
call npx tsx prisma/seed.ts
if %errorlevel% neq 0 (
    echo WARNING: Seeding may have failed (database might already have data)
)

cd ..\..

echo.
echo ==========================================
echo   Starting Heimdell CRM (Offline Mode)
echo ==========================================
echo.
echo   API:     http://localhost:3000
echo   Web:     http://localhost:5173
echo   Docs:    http://localhost:3000/docs
echo.
echo   Login:   admin@heimdell.com / admin123
echo.
echo   Press Ctrl+C to stop
echo ==========================================
echo.

call pnpm dev
