@echo off
title AURA Desktop Companion
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo AURA needs Node.js. Installing it now - please click "Yes" when Windows asks for permission...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
  where node >nul 2>nul || (echo Automatic install failed. Opening nodejs.org - install it and run this file again. & start https://nodejs.org & pause & exit /b)
)
if not exist aura-companion.mjs (
  echo Downloading AURA companion...
  powershell -NoProfile -Command "Invoke-WebRequest https://aura-si.lovable.app/companion/aura-companion.mjs -OutFile aura-companion.mjs"
)
start "" https://aura-si.lovable.app/desktop
node aura-companion.mjs
pause
