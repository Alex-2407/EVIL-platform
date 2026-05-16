@echo off
REM Stop EVIL Server
color 0C
cls

echo.
echo =========================================
echo  TERMINAZIONE SERVER EVIL
echo =========================================
echo.

tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [*] Processo Node.js trovato...
    echo [*] Chiusura in corso...
    taskkill /IM node.exe /F
    timeout /t 2 /nobreak
    echo.
    echo [+] Server fermato con successo!
    echo.
) else (
    echo [!] Nessun processo Node.js trovato
    echo [!] Il server non è in esecuzione
    echo.
)

pause
