#!/usr/bin/env powershell
<#
.SYNOPSIS
    Test tutti i servizi del progetto EVIL
#>

Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔍 VERIFICA SERVIZI - TOTAL EVIL SYSTEM" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5000"
$results = @()

# Test 1: Health Check
Write-Host "[1/8] Test Health Check..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Health Check";
        Status = "✅ OK";
        Code = $response.StatusCode;
        Time = "$(Get-Date -Format 'HH:mm:ss')"
    }
    Write-Host "      ✅ API Health: Online" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Health Check";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Achievements Endpoint
Write-Host "[2/8] Test Achievements..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/achievements" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Achievements API";
        Status = "✅ OK";
        Code = $response.StatusCode;
    }
    Write-Host "      ✅ Achievements endpoint loaded" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Achievements API";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Home Page
Write-Host "[3/8] Test Home Page..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Home Page";
        Status = "✅ OK";
        Code = $response.StatusCode;
        Size = "$($response.Content.Length) bytes"
    }
    Write-Host "      ✅ Home page served ($($response.StatusCode))" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Home Page";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Login Page
Write-Host "[4/8] Test Login Page..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/login.html" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Login Page";
        Status = "✅ OK";
        Code = $response.StatusCode;
    }
    Write-Host "      ✅ Login page served" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Login Page";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Progress Manager Script
Write-Host "[5/8] Test Progress Manager..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/js/progress-manager.js" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Progress Manager JS";
        Status = "✅ OK";
        Code = $response.StatusCode;
        Size = "$($response.Content.Length) bytes"
    }
    Write-Host "      ✅ Progress manager script available" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Progress Manager JS";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Auth Manager Script
Write-Host "[6/8] Test Auth Manager..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/js/auth-manager.js" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "Auth Manager JS";
        Status = "✅ OK";
        Code = $response.StatusCode;
    }
    Write-Host "      ✅ Auth manager script available" -ForegroundColor Green
} catch {
    $results += @{
        Service = "Auth Manager JS";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: CSS Files
Write-Host "[7/8] Test CSS Resources..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/style.css" -UseBasicParsing -TimeoutSec 5
    $results += @{
        Service = "CSS Resources";
        Status = "✅ OK";
        Code = $response.StatusCode;
    }
    Write-Host "      ✅ CSS resources loaded" -ForegroundColor Green
} catch {
    $results += @{
        Service = "CSS Resources";
        Status = "❌ FAILED";
        Error = $_.Exception.Message;
    }
    Write-Host "      ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Static Assets
Write-Host "[8/8] Test Static Assets..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/assets" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 301) {
        $results += @{
            Service = "Static Assets";
            Status = "✅ OK";
            Code = $response.StatusCode;
        }
        Write-Host "      ✅ Assets folder accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "      ⚠️  Assets check (may be expected)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RISULTATI VERIFICA" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$okCount = ($results | Where-Object { $_.Status -like "✅*" }).Count
$failCount = ($results | Where-Object { $_.Status -like "❌*" }).Count

foreach ($result in $results) {
    $statusColor = if ($result.Status -like "✅*") { "Green" } else { "Red" }
    Write-Host "$($result.Status) - $($result.Service) (Code: $($result.Code))" -ForegroundColor $statusColor
}

Write-Host ""
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Servizi Online: $okCount" -ForegroundColor Green
Write-Host "❌ Servizi Offline: $failCount" -ForegroundColor Red
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "✅ TUTTI I SERVIZI FUNZIONANO CORRETTAMENTE!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  $failCount servizio/i offline" -ForegroundColor Yellow
    Write-Host ""
}
