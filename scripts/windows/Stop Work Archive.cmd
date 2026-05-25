@echo off
setlocal EnableExtensions

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo WSL was not found. Install WSL or run stop-dev.bat from a Windows checkout.
  pause
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\..\"
call :resolve_wsl_project_dir "%REPO_ROOT%"
if "%PROJECT_DIR%"=="" (
  echo Failed to resolve this project directory for WSL:
  echo %REPO_ROOT%
  pause
  exit /b 1
)

wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "./stop-dev.sh"
set "DEV_EXIT=%ERRORLEVEL%"

if not "%DEV_EXIT%"=="0" (
  echo.
  echo Work Archive stop failed. Exit code: %DEV_EXIT%
  pause
  exit /b %DEV_EXIT%
)

pause
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
