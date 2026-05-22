@echo off
setlocal EnableExtensions

for /f "usebackq delims=" %%I in (`wsl.exe wslpath -a "%~dp0"`) do set "PROJECT_DIR=%%I"
set "RUN_CMD=cd %PROJECT_DIR% && docker compose stop web api postgres && echo. && echo Work Archive stopped. && echo. && read -n 1 -s -r -p 'Press any key to close this window...'"

where wt.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" wt.exe wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
  exit /b 0
)

start "" wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
exit /b 0
