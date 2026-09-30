@echo off
setlocal
title GeoraphMap - Tum Sistemi Baslat
cd /d "%~dp0"

echo ========================================================
echo        GEORAPHMAP SISTEMI BASLATILIYOR
echo ========================================================
echo.

:: 1. Veritabani Kontrolu
echo [1/3] Veritabani Kontrol Ediliyor...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo       Docker algilandi. PostGIS veritabani baslatiliyor...
    docker compose up -d geomap-db
) else (
    echo       Docker algilanmadi veya kapali. Yerel PostgreSQL portu 5432 kullanilacak.
)

:: 2. Backend API (.NET) Baslat
echo.
echo [2/3] Backend API baslatiliyor - Port 5041...
start "GeoraphMap API" /D "%~dp0GeoraphMap.API" cmd /k "dotnet run"

:: 3. Frontend Client (React) Baslat
echo.
echo [3/3] Frontend Client baslatiliyor - Port 5173...
start "GeoraphMap Client" /D "%~dp0geo-client" cmd /k "npm run dev"

echo.
echo ========================================================
echo   TUM SERVISLER BASLATILDI!
echo   - Web Harita Arayuzu: http://localhost:5173
echo   - Backend API:        http://localhost:5041
echo   - PostGIS Veritabani: localhost:5432
echo ========================================================
echo.
echo [BILGI] Backend ve Frontend ayri pencerelerde calismaktadir.
echo Sistemi kapatmak istediginizde durdur.bat calistirabilirsiniz.
echo.
pause
