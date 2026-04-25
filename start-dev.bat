@echo off
setlocal
cd /d "%~dp0"

set "ComSpec=%SystemRoot%\System32\cmd.exe"
set "PATH=%SystemRoot%\System32;%PATH%"
set "WEB_URL=http://127.0.0.1:53173"
set "API_URL=http://localhost:3000"
set "API_HEALTH_STARTUP_TIMEOUT_MS=120000"
set "API_HEALTH_RESTART_GRACE_MS=30000"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found on PATH. Install or start Docker Desktop first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH. Install Node.js and npm first.
  pause
  exit /b 1
)

echo [1/4] Starting PostgreSQL container...
docker compose up -d postgres
if errorlevel 1 (
  echo Failed to start PostgreSQL. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo [2/4] Installing dependencies...
if exist node_modules goto npm_install
if not exist package-lock.json goto npm_install

call npm ci
if errorlevel 1 (
  echo npm ci failed. Falling back to npm install...
  goto npm_install
)
goto deps_done

:npm_install
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

:deps_done

echo [3/4] Applying Prisma migrations...
call npm run db:migrate:deploy
if errorlevel 1 (
  echo Prisma migration failed.
  pause
  exit /b 1
)

echo [4/4] Starting web and api...
echo Web: %WEB_URL%
echo API: %API_URL%/health
echo Swagger: %API_URL%/docs
start "" "%WEB_URL%"
call npm run dev

set "DEV_EXIT=%ERRORLEVEL%"

echo.
if not "%DEV_EXIT%"=="0" (
  echo Dev server failed.
  pause
  exit /b %DEV_EXIT%
)

echo Dev server stopped.
pause
endlocal
