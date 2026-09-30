@echo off
title GeoraphMap - Tum Sistemi Baslat

cd /d "%~dp0"

echo ========================================================
echo        GEORAPHMAP SISTEMI BASLATILIYOR
echo ========================================================
echo.

:: 1. Veritabani (Docker veya Yerel PostgreSQL) Kontrolu
echo [1/4] Veritabani (PostgreSQL / Docker) Kontrol Ediliyor...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo       Docker algilandi, PostGIS veritabani baslatiliyor...
    docker compose up -d geomap-db >nul 2>&1
) else (
    echo       Docker bulunamadi veya kapali, yerel PostgreSQL portu kullanilacak.
)

:: 2. GeoServer'i Baslat
echo.
echo [2/4] GeoServer Servisi Kontrol Ediliyor...
sc config GeoServer start= demand >nul 2>&1
sc query GeoServer | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo       [OK] GeoServer zaten calisiyor.
) else (
    echo       GeoServer servisi baslatilmaya calisiliyor...
    net start GeoServer >nul 2>&1
    if %errorlevel% equ 0 (
        echo       [OK] GeoServer basariyla baslatildi.
    ) else (
        echo       [BILGI] GeoServer servisi bulunamadi (WMS haric diger ozellikler normal calisir).
    )
)

:: 3. Backend API (.NET) Baslat
echo.
echo [3/4] Backend API (.NET) Baslatiliyor...
start "GeoraphMap API" cmd /k "cd /d "%~dp0GeoraphMap.API" && dotnet run"

:: 4. Frontend Client (React) Baslat
echo.
echo [4/4] Frontend Client (React) Baslatiliyor...
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
