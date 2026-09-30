@echo off
title GeoraphMap - Docker PostGIS Baslat
cd /d "%~dp0"
echo ========================================================
echo        GEORAPHMAP DOCKER VERITABANI BASLATICI
echo ========================================================
echo.
echo PostGIS konteyneri arka planda baslatiliyor...
docker compose up -d geomap-db
if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   [OK] PostGIS veritabani konteyneri calisiyor!
    echo   Port: 5432 ^| Veritabani: Geo ^| Kullanici: postgres
    echo ========================================================
) else (
    echo.
    echo [HATA] Docker baslatilamadi. Docker Desktop'in calistigindan emin olun.
)
echo.
pause
