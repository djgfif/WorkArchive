@echo off
setlocal
cd /d "%~dp0..\.."

echo Stopping Docker Compose services...
docker compose stop web api postgres

echo Done.
pause
endlocal
