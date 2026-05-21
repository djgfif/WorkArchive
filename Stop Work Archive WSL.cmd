@echo off
setlocal EnableExtensions

set "PROJECT_DIR=/home/gkho0/code/WorkArchive"
set "RUN_CMD=cd %PROJECT_DIR% && docker compose stop web api postgres && echo. && echo Work Archive stopped. && echo. && read -n 1 -s -r -p 'Press any key to close this window...'"

where wt.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" wt.exe wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
  exit /b 0
)

start "" wsl.exe --cd "%PROJECT_DIR%" -- bash -lc "%RUN_CMD%"
exit /b 0
