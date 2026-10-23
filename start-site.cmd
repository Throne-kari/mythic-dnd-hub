@echo off
cd /d "%~dp0"
node server.mjs --public-only
pause
