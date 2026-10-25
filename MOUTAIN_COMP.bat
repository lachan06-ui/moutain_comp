@echo off
cd /d "%~dp0"
start "" "http://localhost:8080"
npx -y http-server . -p 8080
pause