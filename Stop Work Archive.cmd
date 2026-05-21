@echo off
setlocal EnableExtensions

pushd "%~dp0"
if errorlevel 1 (
  echo Failed to enter project directory:
  echo %~dp0
  echo.
  echo If this is a WSL path, open the project from Windows Terminal inside WSL and run:
  echo   ./stop-dev.sh
  pause
  exit /b 1
)

call ".\stop-dev.bat"
set "EXIT_CODE=%ERRORLEVEL%"
popd
pause
exit /b %EXIT_CODE%
