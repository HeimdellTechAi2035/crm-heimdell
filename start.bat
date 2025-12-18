@echo off
REM Heimdell CRM - Quick Launcher
cls
echo.
echo ========================================
echo    Starting Heimdell CRM...
echo ========================================
echo.

REM Start API server on port 3000
echo [1/2] Starting API server (port 3000)...
start "Heimdell API" cmd /k "cd /d ""%~dp0apps\api"" && pnpm dev"

REM Wait a bit for API to start
timeout /t 5 /nobreak >nul

REM Start Web server on port 5173
echo [2/2] Starting Web server (port 5173)...
start "Heimdell Web" cmd /k "cd /d ""%~dp0apps\web"" && pnpm dev"

echo.
echo [INFO] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

REM Open the app in default browser
echo [INFO] Opening browser...
start "" "http://localhost:5173"

echo.
echo ========================================
echo    Heimdell CRM is Running!
echo ========================================
echo.
echo   Login:    admin / admin123
echo.
echo   API:      http://localhost:3000
echo   Web App:  http://localhost:5173
echo.
echo   Close the server windows to stop.
echo.
echo ========================================
pause
