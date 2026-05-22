@echo off
setlocal EnableExtensions

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo WSL was not found. Install WSL or run start-dev.bat from a Windows checkout.
  pause
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
call :resolve_wsl_project_dir "%SCRIPT_DIR%"
if "%PROJECT_DIR%"=="" (
  echo Failed to resolve this project directory for WSL:
  echo %SCRIPT_DIR%
  pause
  exit /b 1
)

set "RUN_CMD=./start-dev.sh %*; status=$?; echo; read -n 1 -s -r -p 'Press any key to close this window...'; exit $status"

where wt.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" wt.exe wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
  exit /b 0
)

start "" wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
exit /b 0

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
