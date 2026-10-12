@echo off
title AURA Desktop
cd /d "%TEMP%"
if not exist "%LOCALAPPDATA%\AURA" mkdir "%LOCALAPPDATA%\AURA"
cd /d "%LOCALAPPDATA%\AURA"
echo.
echo   AURA Desktop - setting things up...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo   Installing Node.js - click "Yes" when Windows asks for permission...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
where node >nul 2>nul
if errorlevel 1 (
  if not exist "%ProgramFiles%\nodejs\node.exe" (
    echo   winget not available - downloading Node.js installer...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi -OutFile node.msi"
    powershell -NoProfile -Command "Start-Process msiexec -Verb RunAs -Wait -ArgumentList '/i','%CD%\node.msi','/qn'"
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
  )
)
echo   Downloading latest AURA companion...
powershell -NoProfile -Command "Invoke-WebRequest https://aura-si.lovable.app/companion/aura-companion.mjs -OutFile aura-companion.mjs"
start "" https://aura-si.lovable.app/desktop
"%ProgramFiles%\nodejs\node.exe" aura-companion.mjs 2>nul || node aura-companion.mjs
pause
