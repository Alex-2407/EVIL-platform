@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EVIL - piattaforma locale

echo ========================================================
echo    EVIL - piattaforma didattica di cybersecurity
echo    Avvio in locale (http://localhost:5000)
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js non e' installato.
  echo     Scarica e installa Node.js 22 LTS da https://nodejs.org
  echo     poi fai di nuovo doppio clic su questo file.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJ=%%v
if %NODEMAJ% LSS 20 (
  echo [!] Attenzione: hai Node.js v%NODEMAJ%. Consigliato Node.js 22.
  echo.
)

if not exist ".env" (
  echo [*] Prima configurazione: genero .env e i segreti di sicurezza...
  node scripts\setup-local.js
  echo.
)

echo [*] Preparo la home...
node scripts\build-home-css.js

echo [*] Avvio il server. Il sito si aprira' da solo nel browser.
echo     Per fermarlo: chiudi questa finestra oppure premi CTRL+C.
echo.
start "" /b cmd /c scripts\apri-browser.bat
node js\server.js

echo.
echo Server terminato.
pause
