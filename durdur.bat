@echo off
title GeoraphMap - Tum Sistemi Durdur

:: Yonetici yetkisi kontrolu ve otomatik yukseltme (GeoServer servisini durdurabilmek icin)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yonetici yetkisi isteniyor...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ========================================================
echo        GEORAPHMAP SISTEMI DURDURULUYOR
echo ========================================================
echo.

:: 1. Backend API'yi Kapat (Port 5041)
echo [1/3] Backend API Kapatiliyor...
powershell -NoProfile -Command "Get-Process -Name 'GeoraphMap.API' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5041 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
taskkill /F /T /IM GeoraphMap.API.exe >nul 2>&1

:: 2. Frontend Client'i Kapat (Port 5173)
echo [2/3] Frontend Client Kapatiliyor...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: 3. GeoServer Servisini Durdur
echo [3/3] GeoServer Servisi Durduruluyor...
sc query GeoServer | find "RUNNING" >nul
if %errorlevel% equ 0 (
    net stop GeoServer >nul 2>&1
    echo       [OK] GeoServer servisi durduruldu.
) else (
    echo       [OK] GeoServer zaten kapali.
)

:: Konsol pencerelerini temizle
powershell -NoProfile -Command "Get-Process -Name 'cmd' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*GeoraphMap*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo.
echo ========================================================
echo   TUM SISTEM KAPATILDI, RAM TAMAMEN BOSALTILDI!
echo ========================================================
echo.
timeout /t 3 > nul
