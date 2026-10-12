@echo off
title AURA Desktop Companion
where node >nul 2>nul || (echo Node.js is required. Install it from https://nodejs.org and run this again. & start https://nodejs.org & pause & exit /b)
cd /d "%~dp0"
if not exist aura-companion.mjs powershell -NoProfile -Command "Invoke-WebRequest https://aura-si.lovable.app/companion/aura-companion.mjs -OutFile aura-companion.mjs"
node aura-companion.mjs
pause
