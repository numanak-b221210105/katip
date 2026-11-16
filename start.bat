@echo off
REM Kâtip: install and start the dev server (Windows)
cd /d "%~dp0"
if not exist node_modules call npm install
npm run dev -- --open
