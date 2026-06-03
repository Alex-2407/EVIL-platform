@echo off
title EVIL URL Scanner Backend
echo.
echo Starting EVIL URL Scanner Backend in a new window...
echo.
cd /d "%~dp0.."
start "EVIL Backend" cmd /k "node js\server.js"
exit
