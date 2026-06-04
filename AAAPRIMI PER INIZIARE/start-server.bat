@echo off
title EVIL - Avvio server
cd /d "%~dp0.."
echo.
echo Avvio EVIL Suite (npm start)...
echo Apri http://localhost:5000 quando il server e' pronto.
echo.
start "EVIL Backend" cmd /k "npm start"
exit
