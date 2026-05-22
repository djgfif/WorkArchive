@echo off
setlocal EnableExtensions

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo WSL was not found. Install WSL or run stop-dev.bat from a Windows checkout.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`wsl.exe wslpath -a "%~dp0."`) do set "PROJECT_DIR=%%I"
if "%PROJECT_DIR%"=="" (
  echo Failed to resolve this project directory for WSL:
  echo %~dp0
  pause
  exit /b 1
)

set "RUN_CMD=./stop-dev.sh; status=$?; echo; read -n 1 -s -r -p 'Press any key to close this window...'; exit $status"

where wt.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" wt.exe wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
  exit /b 0
)

start "" wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
exit /b 0
