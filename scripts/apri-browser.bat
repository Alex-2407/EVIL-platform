@echo off
rem Attende qualche secondo che il server sia pronto, poi apre il browser.
ping -n 5 127.0.0.1 >nul
start "" http://localhost:5000
