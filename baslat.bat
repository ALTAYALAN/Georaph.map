@echo off
title GeoraphMap - Tum Sistemi Baslat

:: Yonetici yetkisi kontrolu ve otomatik yukseltme (GeoServer servisini yonetebilmek icin)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yonetici yetkisi isteniyor...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ========================================================
echo        GEORAPHMAP SISTEMI BASLATILIYOR
echo ========================================================
echo.

:: 1. GeoServer'i Baslat
echo [1/3] GeoServer Servisi Kontrol Ediliyor...
sc config GeoServer start= demand >nul 2>&1
sc query GeoServer | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo       [OK] GeoServer zaten calisiyor.
) else (
    echo       GeoServer servisi baslatiliyor, lutfen bekleyin...
    net start GeoServer >nul 2>&1
    if %errorlevel% equ 0 (
        echo       [OK] GeoServer basariyla baslatildi.
    ) else (
        echo       [!] GeoServer baslatilamadi veya servis bulunamadi.
    )
)

:: 2. Backend API (.NET) Baslat
echo.
echo [2/3] Backend API (.NET) Baslatiliyor...
start "GeoraphMap API" cmd /k "cd /d "%~dp0GeoraphMap.API" && dotnet run"

:: 3. Frontend Client (React) Baslat
echo.
echo [3/3] Frontend Client (React) Baslatiliyor...
start "GeoraphMap Client" cmd /k "cd /d "%~dp0geo-client" && npm run dev"

echo.
echo ========================================================
echo   TUM SERVISLER BASARIYLA CALISIYOR!
echo   - Web Harita Arayuzu: http://localhost:5173
echo   - Backend API:        http://localhost:5041
echo   - GeoServer:          http://localhost:8080/geoserver
echo ========================================================
echo.
echo [!] Calismayi bitirdiginizde GeoServer dahil TUM SISTEMI
echo     kapatip RAM'i bosaltmak icin bu pencerede BIR TUSA BASIN...
echo.
pause > nul

call "%~dp0durdur.bat"
