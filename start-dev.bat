@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ComSpec=%SystemRoot%\System32\cmd.exe"
set "PATH=%SystemRoot%\System32;%PATH%"
set "DEV_MODE=%~1"
set "HOST_WEB_URL=http://127.0.0.1:53173"
set "COMPOSE_WEB_URL=http://localhost:8080"
set "API_URL=http://localhost:3000"
set "API_HEALTH_STARTUP_TIMEOUT_MS=120000"
set "API_HEALTH_RESTART_GRACE_MS=30000"

if "%DEV_MODE%"=="" set "DEV_MODE=compose"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found on PATH. Install or start Docker Desktop first.
  pause
  exit /b 1
)

if /i "%DEV_MODE%"=="compose" goto compose_mode
if /i "%DEV_MODE%"=="host" goto host_mode

echo Unknown dev mode "%DEV_MODE%".
echo Usage:
echo   start-dev.bat       Starts the full Docker Compose app stack.
echo   start-dev.bat host  Starts host-based Vite/API dev servers, requiring 127.0.0.1:5432.
pause
exit /b 1

:compose_mode
echo [1/4] Starting Docker Compose app stack...
echo Web: %COMPOSE_WEB_URL%
echo API: %API_URL%/health
echo Swagger: %API_URL%/docs
echo.
echo Note: This mode runs PostgreSQL, API, migrations, and web inside Docker.
echo It does not depend on Windows reaching PostgreSQL at 127.0.0.1:5432.
call docker compose up -d --build

set "DEV_EXIT=%ERRORLEVEL%"

echo.
if not "%DEV_EXIT%"=="0" (
  echo Docker Compose app stack failed.
  pause
  exit /b %DEV_EXIT%
)

echo [2/4] Waiting for API health...
set /a WAIT_SECONDS=0

:wait_api_health
set "API_HEALTH="
for /f "usebackq delims=" %%H in (`docker inspect -f "{{.State.Health.Status}}" work-archive-api 2^>nul`) do set "API_HEALTH=%%H"
if /i "!API_HEALTH!"=="healthy" goto api_healthy
if !WAIT_SECONDS! geq 120 (
  echo API did not become healthy within 120 seconds.
  docker compose ps
  echo.
  echo Recent API logs:
  docker compose logs --tail=80 api
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
set /a WAIT_SECONDS+=2
goto wait_api_health

:api_healthy
echo API container is healthy.

echo [3/4] Checking Windows localhost access...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$client = [Net.Sockets.TcpClient]::new(); $async = $client.BeginConnect('127.0.0.1', 8080, $null, $null); if (-not $async.AsyncWaitHandle.WaitOne(3000)) { $client.Close(); exit 1 }; try { $client.EndConnect($async); $client.Close(); exit 0 } catch { $client.Close(); exit 1 }"
set "WEB_PORT_OK=%ERRORLEVEL%"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$client = [Net.Sockets.TcpClient]::new(); $async = $client.BeginConnect('127.0.0.1', 3000, $null, $null); if (-not $async.AsyncWaitHandle.WaitOne(3000)) { $client.Close(); exit 1 }; try { $client.EndConnect($async); $client.Close(); exit 0 } catch { $client.Close(); exit 1 }"
set "API_PORT_OK=%ERRORLEVEL%"

if "%WEB_PORT_OK%"=="0" if "%API_PORT_OK%"=="0" goto open_browser

echo Docker Compose is healthy, but Windows cannot reach one or more localhost ports.
echo This usually means WSL/Docker Desktop port forwarding is broken.
echo Current endpoints are reachable inside WSL/Docker, but not from Windows Chrome:
echo   Web: %COMPOSE_WEB_URL%
echo   API: %API_URL%/health
echo.
echo Checked ports:
echo   127.0.0.1:8080 result=%WEB_PORT_OK%
echo   127.0.0.1:3000 result=%API_PORT_OK%
echo.
echo System-level fix to consider:
echo   Change %%USERPROFILE%%\.wslconfig from networkingMode=mirrored to networkingMode=nat,
echo   add localhostForwarding=true, then run wsl --shutdown and restart Docker Desktop.
echo.
echo Services are still running. Use stop-dev.bat to stop them.
pause
endlocal
exit /b 1

:open_browser
echo [4/4] Opening browser...
start "" "%COMPOSE_WEB_URL%"
echo Docker Compose app stack is running.
echo Use stop-dev.bat to stop it.
pause
endlocal
exit /b 0

:host_mode
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH. Install Node.js and npm first.
  pause
  exit /b 1
)

echo [1/5] Starting PostgreSQL container...
docker compose up -d postgres
if errorlevel 1 (
  echo Failed to start PostgreSQL. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo [2/5] Checking PostgreSQL host port...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$client = [Net.Sockets.TcpClient]::new(); $async = $client.BeginConnect('127.0.0.1', 5432, $null, $null); if (-not $async.AsyncWaitHandle.WaitOne(3000)) { $client.Close(); exit 1 }; try { $client.EndConnect($async); $client.Close(); exit 0 } catch { $client.Close(); exit 1 }"
if errorlevel 1 (
  echo This Windows session cannot reach PostgreSQL at 127.0.0.1:5432.
  echo Host dev mode requires Docker Desktop localhost port forwarding to work.
  echo Run start-dev.bat without arguments to use the Docker Compose app stack instead.
  pause
  exit /b 1
)

echo [3/5] Installing dependencies...
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

echo [4/5] Applying Prisma migrations...
call npm run db:migrate:deploy
if errorlevel 1 (
  echo Prisma migration failed.
  pause
  exit /b 1
)

echo [5/5] Starting host-based web and api dev servers...
echo Web: %HOST_WEB_URL%
echo API: %API_URL%/health
echo Swagger: %API_URL%/docs
start "" "%HOST_WEB_URL%"
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
exit /b 0
