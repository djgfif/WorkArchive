@echo off
setlocal EnableExtensions

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo WSL was not found. Install WSL or run start-dev.bat from a Windows checkout.
  pause
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul 2>nul
call :resolve_wsl_project_dir "%SCRIPT_DIR%"
if "%PROJECT_DIR%"=="" (
  echo Failed to resolve this project directory for WSL:
  echo %SCRIPT_DIR%
  popd >nul 2>nul
  pause
  exit /b 1
)

set "DEV_MODE=%~1"
if "%DEV_MODE%"=="" set "DEV_MODE=compose"

if /i "%DEV_MODE%"=="compose" goto run_compose
if /i "%DEV_MODE%"=="host" goto run_host

echo Unknown dev mode "%DEV_MODE%".
echo Usage:
echo   Start Work Archive.cmd       Starts the full Docker Compose app stack.
echo   Start Work Archive.cmd host  Starts host-based Vite/API dev servers.
popd >nul 2>nul
pause
exit /b 1

:run_compose
echo Starting Work Archive through WSL...
wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "WORK_ARCHIVE_SKIP_OPEN=1 ./start-dev.sh compose"
set "DEV_EXIT=%ERRORLEVEL%"
if not "%DEV_EXIT%"=="0" goto failed

echo.
echo Checking Windows localhost access...
curl.exe -fsS --max-time 5 -o NUL "http://localhost:8080"
set "WEB_URL_OK=%ERRORLEVEL%"
curl.exe -fsS --max-time 5 -o NUL "http://localhost:3000/health"
set "API_URL_OK=%ERRORLEVEL%"

if "%WEB_URL_OK%"=="0" if "%API_URL_OK%"=="0" (
  echo Opening Work Archive...
  start "" "http://localhost:8080"
  echo Work Archive is running.
  echo Web: http://localhost:8080
  echo API: http://localhost:3000/health
  popd >nul 2>nul
  pause
  exit /b 0
)

echo Work Archive started in WSL, but Windows cannot reach one or more localhost ports.
echo Checked endpoints:
echo   http://localhost:8080 result=%WEB_URL_OK%
echo   http://localhost:3000/health result=%API_URL_OK%
echo.
echo Services may still be running. Use Stop Work Archive.cmd to stop them.
popd >nul 2>nul
pause
exit /b 1

:run_host
echo Starting host dev mode through WSL...
start "" "http://127.0.0.1:53173"
wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "./start-dev.sh host"
set "DEV_EXIT=%ERRORLEVEL%"
if not "%DEV_EXIT%"=="0" goto failed

echo Dev server stopped.
popd >nul 2>nul
pause
exit /b 0

:failed
echo.
echo Work Archive failed to start. Exit code: %DEV_EXIT%
popd >nul 2>nul
pause
exit /b %DEV_EXIT%

:resolve_wsl_project_dir
set "INPUT_DIR=%~1"
set "PROJECT_DIR="

rem Explorer launches WSL files through a UNC path such as:
rem   \\wsl.localhost\Ubuntu\home\user\code\WorkArchive\
rem wslpath cannot reliably convert that path back from inside WSL, so handle
rem the UNC shape directly and fall back to wslpath for normal Windows paths.
set "UNC_DIR=%INPUT_DIR:\=/%"

if /i "%UNC_DIR:~0,16%"=="//wsl.localhost/" (
  set "UNC_REST=%UNC_DIR:~16%"
  goto resolve_unc
)

if /i "%UNC_DIR:~0,7%"=="//wsl$/" (
  set "UNC_REST=%UNC_DIR:~7%"
  goto resolve_unc
)

for /f "usebackq delims=" %%I in (`wsl.exe wslpath -a "%INPUT_DIR%." 2^>nul`) do set "PROJECT_DIR=%%I"
exit /b 0

:resolve_unc
for /f "tokens=1,* delims=/" %%A in ("%UNC_REST%") do set "PROJECT_DIR=/%%B"
if "%PROJECT_DIR:~-1%"=="/" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
exit /b 0
