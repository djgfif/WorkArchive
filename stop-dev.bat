@echo off
setlocal
cd /d "%~dp0"

echo Stopping PostgreSQL container...
docker compose stop postgres

echo Done.
pause
endlocal
