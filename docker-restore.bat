@echo off
title GeoraphMap - Docker Veritabanini Geri Yukle (Restore)
cd /d "%~dp0"
echo ========================================================
echo        DOCKER VERITABANI GERI YUKLEME (RESTORE)
echo ========================================================
echo.

if not exist "%~dp0db_backup.sql" (
    echo [HATA] db_backup.sql dosyasi bulunamadi!
    pause
    exit /b 1
)

echo [1/4] Docker PostGIS konteyneri kontrol ediliyor...
docker exec geomap-postgis psql -U postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Konteyner calismiyor, baslatiliyor...
    docker compose up -d geomap-db
    timeout /t 5 /nobreak >nul
)

echo.
echo [2/4] db_backup.sql dosyasi konteyner icine kopyalaniyor...
docker cp "%~dp0db_backup.sql" geomap-postgis:/tmp/db_backup.sql

echo.
echo [3/4] Eski sema temizlenip PostGIS sifirlaniyor...
docker exec geomap-postgis psql -U postgres -c "CREATE DATABASE \"Geo\";" >nul 2>&1
docker exec geomap-postgis psql -U postgres -d Geo -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public; CREATE EXTENSION IF NOT EXISTS postgis;" >nul 2>&1

echo.
echo [4/4] 9339 Durak, 547 Hat ve Deniz Sinirlari yukleniyor...
docker exec geomap-postgis psql -U postgres -d Geo -q -f /tmp/db_backup.sql

echo.
echo ========================================================
echo   YUKLENEN VERILERIN SAYILARI:
echo ========================================================
docker exec geomap-postgis psql -U postgres -d Geo -c "SELECT 'tbl_stop (Duraklar)' as tablo, count(*) as toplam FROM tbl_stop UNION ALL SELECT 'tbl_route (Hatlar)', count(*) FROM tbl_route UNION ALL SELECT 'tbl_polygon (Deniz/Bolge)', count(*) FROM tbl_polygon UNION ALL SELECT 'tbl_poi (POI)', count(*) FROM tbl_poi;"

echo.
echo ========================================================
echo   [TEBRIKLER] Tum veriler basariyla Docker'a aktarildi!
echo   DBeaver'da F5 (Refresh) yaparak tablolari gorebilirsiniz.
echo ========================================================
echo.
pause
