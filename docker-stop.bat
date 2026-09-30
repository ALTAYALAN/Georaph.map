@echo off
title GeoraphMap - Docker PostGIS Durdur
cd /d "%~dp0"
echo PostGIS konteyneri durduruluyor...
docker compose down
echo.
echo ========================================================
echo   [OK] PostGIS veritabani konteyneri durduruldu.
echo ========================================================
echo.
pause
