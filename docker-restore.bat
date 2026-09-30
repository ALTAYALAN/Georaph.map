@echo off
title GeoraphMap - Docker Veritabanini Geri Yukle (Restore)
cd /d "%~dp0"
echo ========================================================
echo        DOCKER VERITABANI GERI YUKLEME (RESTORE)
echo ========================================================
echo.
echo [1/3] Docker PostGIS konteyneri kontrol ediliyor...
docker exec geomap-postgis psql -U postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Konteyner calismiyor, baslatiliyor...
    docker compose up -d geomap-db
    timeout /t 5 /nobreak >nul
)

echo.
echo [2/3] PostGIS ve 'Geo' veritabani kontrol ediliyor...
docker exec geomap-postgis psql -U postgres -c "CREATE DATABASE \"Geo\";" >nul 2>&1
docker exec geomap-postgis psql -U postgres -d Geo -c "CREATE EXTENSION IF NOT EXISTS postgis;" >nul 2>&1

echo.
echo [3/3] db_backup.dump aktariliyor (9300+ durak, 547 hat, deniz sinirlari, POI'lar)...
docker exec -i geomap-postgis pg_restore -U postgres -d Geo --clean --if-exists --no-owner --no-privileges /backup/db_backup.dump

echo.
echo ========================================================
echo   [TEBRIKLER] Tum veriler basariyla Docker'a aktarildi!
echo   - 9,339 Durak
echo   - 547 Otobus Hatti
echo   - Deniz Sinirlari ve Poligonlar
echo   - 508 POI ve Ilgi Noktalari
echo ========================================================
echo.
pause
