@echo off
REM Test script for EVIL services
REM Tests all main endpoints and services

setlocal enabledelayedexpansion
set BASE_URL=http://localhost:5000

echo.
echo ════════════════════════════════════════════
echo 🔍 VERIFICA SERVIZI - TOTAL EVIL SYSTEM
echo ════════════════════════════════════════════
echo.

set ONLINE=0
set OFFLINE=0

REM Test 1: Health Check
echo [1/8] Test Health Check...
curl -s -o nul -w "      %%{http_code}" %BASE_URL%/api/health > temp_health.txt
set /p HEALTH_CODE=<temp_health.txt
if %HEALTH_CODE% equ 200 (
    echo ✅ API Health: Online
    set /a ONLINE+=1
) else (
    echo ❌ Health Check Failed
    set /a OFFLINE+=1
)
del temp_health.txt

REM Test 2: Home Page
echo [2/8] Test Home Page...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/ > temp_home.txt
set /p HOME_CODE=<temp_home.txt
if %HOME_CODE:~-3% equ 200 (
    echo ✅ Home page served
    set /a ONLINE+=1
) else (
    echo ❌ Home page failed
    set /a OFFLINE+=1
)
del temp_home.txt

REM Test 3: Login Page
echo [3/8] Test Login Page...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/login.html > temp_login.txt
set /p LOGIN_CODE=<temp_login.txt
if %LOGIN_CODE:~-3% equ 200 (
    echo ✅ Login page served
    set /a ONLINE+=1
) else (
    echo ❌ Login page failed
    set /a OFFLINE+=1
)
del temp_login.txt

REM Test 4: Progress Manager
echo [4/8] Test Progress Manager...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/js/progress-manager.js > temp_pm.txt
set /p PM_CODE=<temp_pm.txt
if %PM_CODE:~-3% equ 200 (
    echo ✅ Progress Manager available
    set /a ONLINE+=1
) else (
    echo ❌ Progress Manager failed
    set /a OFFLINE+=1
)
del temp_pm.txt

REM Test 5: Auth Manager
echo [5/8] Test Auth Manager...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/js/auth-manager.js > temp_auth.txt
set /p AUTH_CODE=<temp_auth.txt
if %AUTH_CODE:~-3% equ 200 (
    echo ✅ Auth Manager available
    set /a ONLINE+=1
) else (
    echo ❌ Auth Manager failed
    set /a OFFLINE+=1
)
del temp_auth.txt

REM Test 6: CSS Resources
echo [6/8] Test CSS Resources...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/style.css > temp_css.txt
set /p CSS_CODE=<temp_css.txt
if %CSS_CODE:~-3% equ 200 (
    echo ✅ CSS Resources available
    set /a ONLINE+=1
) else (
    echo ❌ CSS Resources failed
    set /a OFFLINE+=1
)
del temp_css.txt

REM Test 7: Security Check Page
echo [7/8] Test Security Check Page...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/security-check.html > temp_sec.txt
set /p SEC_CODE=<temp_sec.txt
if %SEC_CODE:~-3% equ 200 (
    echo ✅ Security Check page served
    set /a ONLINE+=1
) else (
    echo ❌ Security Check page failed
    set /a OFFLINE+=1
)
del temp_sec.txt

REM Test 8: Attacks Map
echo [8/8] Test Attacks Map...
curl -s -o nul -w "      Status: %%{http_code}" %BASE_URL%/attacks-map.html > temp_map.txt
set /p MAP_CODE=<temp_map.txt
if %MAP_CODE:~-3% equ 200 (
    echo ✅ Attacks Map page served
    set /a ONLINE+=1
) else (
    echo ❌ Attacks Map failed
    set /a OFFLINE+=1
)
del temp_map.txt

echo.
echo ════════════════════════════════════════════
echo 📊 RISULTATI VERIFICA
echo ════════════════════════════════════════════
echo.
echo ✅ Servizi Online: %ONLINE%
echo ❌ Servizi Offline: %OFFLINE%
echo.

if %OFFLINE% equ 0 (
    echo ✅ TUTTI I SERVIZI FUNZIONANO CORRETTAMENTE!
) else (
    echo ⚠️  %OFFLINE% servizio/i offline
)

echo.
echo ════════════════════════════════════════════
pause
