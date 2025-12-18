@echo off
cls
color 0A
title Heimdell CRM Startup

REM Change to script directory
cd /d "%~dp0"

echo.
echo ========================================
echo    HEIMDELL CRM - Auto Startup
echo ========================================
echo.
echo Current directory: %CD%
echo.

REM Check if node is installed
echo [CHECK] Looking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version

REM Check if pnpm is installed
echo [CHECK] Looking for pnpm...
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] pnpm not found, installing...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pnpm
        pause
        exit /b 1
    )
)

echo [OK] pnpm is installed
pnpm --version
echo.

REM Check if apps directory exists
echo [CHECK] Checking project structure...
if not exist "apps\api" (
    echo [ERROR] apps\api directory not found!
    echo Make sure you're running this from the project root directory.
    echo.
    pause
    exit /b 1
)

if not exist "apps\web" (
    echo [ERROR] apps\web directory not found!
    echo Make sure you're running this from the project root directory.
    echo.
    pause
    exit /b 1
)

echo [OK] Project structure valid
echo.

REM Install dependencies if node_modules doesn't exist in api
if not exist "apps\api\node_modules" (
    echo [INFO] Installing API dependencies...
    cd apps\api
    call pnpm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install API dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
    echo [OK] API dependencies installed
) else (
    echo [OK] API dependencies already installed
)

REM Install dependencies if node_modules doesn't exist in web
if not exist "apps\web\node_modules" (
    echo [INFO] Installing Web dependencies...
    cd apps\web
    call pnpm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Web dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
    echo [OK] Web dependencies installed
) else (
    echo [OK] Web dependencies already installed
)

echo.
echo [INFO] Checking environment files...

REM Check if .env files exist
if not exist "apps\api\.env" (
    echo [WARNING] apps\api\.env not found
    if exist "apps\api\.env.example" (
        echo [INFO] Copying .env.example to .env
        copy "apps\api\.env.example" "apps\api\.env" >nul
        echo [OK] Created apps\api\.env
    ) else (
        echo [WARNING] No .env.example found, creating basic .env
        echo DATABASE_URL="postgresql://postgres:password@localhost:5432/heimdell_crm" > "apps\api\.env"
        echo JWT_SECRET="change-this-secret-key" >> "apps\api\.env"
        echo [OK] Created basic apps\api\.env - UPDATE THE DATABASE_URL!
    )
)

if not exist "apps\web\.env" (
    echo [WARNING] apps\web\.env not found
    if exist "apps\web\.env.example" (
        echo [INFO] Copying .env.example to .env
        copy "apps\web\.env.example" "apps\web\.env" >nul
        echo [OK] Created apps\web\.env
    ) else (
        echo [INFO] Creating basic web .env
        echo VITE_API_URL=http://localhost:3000 > "apps\web\.env"
        echo [OK] Created apps\web\.env
    )
)

echo [OK] Environment files ready

echo.
echo ========================================
echo    Starting Services...
echo ========================================
echo.

REM Kill any existing instances
taskkill /FI "WINDOWTITLE eq Heimdell API*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Heimdell Web*" /F /T >nul 2>&1

REM Wait a moment
timeout /t 1 /nobreak >nul

REM Start API server
echo [1/2] Starting API server...
start "Heimdell API" cmd /k "cd /d "%~dp0apps\api" && color 0B && title Heimdell API Server && pnpm dev"

REM Start Web frontend immediately
echo [2/2] Starting Web frontend...
start "Heimdell Web" cmd /k "cd /d "%~dp0apps\web" && color 0E && title Heimdell Web Server && pnpm dev"

echo.
echo ========================================
echo    Services Started!
echo ========================================
echo.
echo [INFO] Servers are starting in separate windows...
echo [INFO] This may take 10-20 seconds...
echo.

REM Wait just 3 seconds then open browser
timeout /t 3 /nobreak >nul

echo [INFO] Opening browser...
echo       The app will load once servers are ready

REM Open browser with default browser
start http://localhost:5173

echo.
echo [OK] Browser opened!

echo.
echo ========================================
echo    Heimdell CRM is Running!
echo ========================================
echo.
echo    API Server:  http://localhost:3000
echo    Web App:     http://localhost:5173
echo.
echo    Check the other windows for logs
echo.
echo ========================================
echo.
echo Press any key to STOP all servers...
pause >nul

echo.
echo [INFO] Stopping servers...
taskkill /FI "WINDOWTITLE eq Heimdell API*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Heimdell Web*" /F /T >nul 2>&1

echo [OK] All servers stopped
echo.
echo Thank you for using Heimdell CRM!
timeout /t 2 /nobreak >nul
