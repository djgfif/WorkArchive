@echo off
setlocal
cd /d "%~dp0"

set "ComSpec=%SystemRoot%\System32\cmd.exe"
set "PATH=%SystemRoot%\System32;%PATH%"

echo [1/4] Starting PostgreSQL container...
docker compose up -d postgres
if errorlevel 1 (
  echo Failed to start PostgreSQL. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo [2/4] Installing dependencies if needed...
if not exist node_modules (
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo [3/4] Applying Prisma migrations...
call npm run db:migrate:deploy
if errorlevel 1 (
  echo Prisma migration failed.
  pause
  exit /b 1
)

echo [4/4] Starting web and api...
start "" "http://localhost:5173"
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
