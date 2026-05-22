@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "INSTALLER=%SCRIPT_DIR%scripts\windows\install-shortcuts.ps1"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo Windows PowerShell was not found.
  pause
  exit /b 1
)

if not exist "%INSTALLER%" (
  echo Shortcut installer was not found:
  echo %INSTALLER%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%" -ProjectRoot "%SCRIPT_DIR%"
set "INSTALL_EXIT=%ERRORLEVEL%"

echo.
if not "%INSTALL_EXIT%"=="0" (
  echo Failed to install Work Archive shortcuts. Exit code: %INSTALL_EXIT%
  pause
  exit /b %INSTALL_EXIT%
)

echo Use the new Desktop shortcuts for daily start and stop.
pause
exit /b 0
