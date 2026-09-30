@echo off
REM Ferma solo il server EVIL (il processo in ascolto sulla porta 5000).
REM Prima chiudeva TUTTI i processi node.exe del computer, anche quelli di altri programmi.
REM Get-NetTCPConnection funziona anche con Windows in italiano (netstat scrive "IN ASCOLTO").
color 0C
cls

set "EVIL_PORT=5000"

echo.
echo =========================================
echo  TERMINAZIONE SERVER EVIL (porta %EVIL_PORT%)
echo =========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort %EVIL_PORT% -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Host ('[*] Chiudo il processo ' + $_); Stop-Process -Id $_ -Force }; Write-Host '[+] Server fermato.' } else { Write-Host '[!] Nessun server in ascolto sulla porta %EVIL_PORT%.' }"

echo.
pause
