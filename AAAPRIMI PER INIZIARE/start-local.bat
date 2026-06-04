@echo off
title EVIL - Sviluppo locale
cd /d "%~dp0.."

echo.
echo =========================================
echo   EVIL - Avvio sviluppo LOCALE
echo =========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] Node.js non installato.
  echo Scaricalo da https://nodejs.org/ ^(versione LTS^)
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [*] Prima installazione: npm install...
  call npm install
  if errorlevel 1 (
    echo [ERRORE] npm install fallito.
    pause
    exit /b 1
  )
)

echo [*] Configurazione .env locale...
node scripts\setup-local.js
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo [*] Server in avvio su http://localhost:5000
echo [*] Apri SOLO questo indirizzo nel browser.
echo [*] Ctrl+Shift+R per ricaricare senza cache.
echo [*] Ctrl+C per fermare.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000/"

npm start
