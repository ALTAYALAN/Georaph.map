@echo off
setlocal EnableDelayedExpansion
title GeoraphMap - Veritabani Geri Yukleme (Restore)

echo ========================================================
echo        GEORAPHMAP VERITABANI GERI YUKLEME ARACI
echo ========================================================
echo.

set "DUMP_FILE=%~dp0db_backup.dump"
if not exist "%DUMP_FILE%" (
    echo [HATA] Yedek dosyasi bulunamadi: %DUMP_FILE%
    echo Lutfen db_backup.dump dosyasinin bu betik ile ayni klasorde oldugundan emin olun.
    pause
    exit /b 1
)

set "PG_RESTORE_EXE="
set "PG_PSQL_EXE="

where pg_restore >nul 2>&1
if %errorlevel% equ 0 (
    set "PG_RESTORE_EXE=pg_restore"
    set "PG_PSQL_EXE=psql"
)

if not defined PG_RESTORE_EXE (
    for %%v in (18 17 16 15 14 13) do (
        if exist "C:\Program Files\PostgreSQL\%%v\bin\pg_restore.exe" (
            if not defined PG_RESTORE_EXE (
                set "PG_RESTORE_EXE=C:\Program Files\PostgreSQL\%%v\bin\pg_restore.exe"
                set "PG_PSQL_EXE=C:\Program Files\PostgreSQL\%%v\bin\psql.exe"
            )
        )
    )
)

if not defined PG_RESTORE_EXE (
    echo [UYARI] PostgreSQL otomatik bulunamadi.
    echo Lutfen PostgreSQL bin yolunu girin. Ornek: C:\Program Files\PostgreSQL\18\bin
    set /p PG_USER_BIN="Yol: "
    if exist "!PG_USER_BIN!\pg_restore.exe" (
        set "PG_RESTORE_EXE=!PG_USER_BIN!\pg_restore.exe"
        set "PG_PSQL_EXE=!PG_USER_BIN!\psql.exe"
    )
)

if not defined PG_RESTORE_EXE (
    echo [HATA] pg_restore.exe bulunamadi!
    pause
    exit /b 1
)

set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=postgres"
set "PGDATABASE=Geo"

echo Hedef Sunucu: %PGHOST%:%PGPORT%
echo Hedef DB:     %PGDATABASE%
echo Kullanici:    %PGUSER%
echo Program:      %PG_RESTORE_EXE%
echo.

set "PGPASSWORD=14111201"
set /p USER_PASS="PostgreSQL '%PGUSER%' sifresi (Varsayilan 14111201 icin Enter): "
if not "%USER_PASS%"=="" set "PGPASSWORD=%USER_PASS%"

echo.
echo [1/3] 'Geo' veritabani kontrol ediliyor...
"%PG_PSQL_EXE%" -U %PGUSER% -h %PGHOST% -p %PGPORT% -c "CREATE DATABASE \"Geo\";" >nul 2>&1

echo [2/3] PostGIS eklentisi aktiflestiriliyor...
"%PG_PSQL_EXE%" -U %PGUSER% -h %PGHOST% -p %PGPORT% -d %PGDATABASE% -c "CREATE EXTENSION IF NOT EXISTS postgis;" >nul 2>&1

echo [3/3] Yedek dosyasi geri yukleniyor, lutfen bekleyin...
"%PG_RESTORE_EXE%" -U %PGUSER% -h %PGHOST% -p %PGPORT% -d %PGDATABASE% --clean --if-exists --no-owner --no-privileges -v "%DUMP_FILE%" >nul 2>&1

echo.
echo ========================================================
echo   [TEBRIKLER] Veritabani basariyla geri yuklendi!
echo   'Geo' veritabani kullanima hazir.
echo   Artik 'start.bat' ile projeyi calistirabilirsiniz.
echo ========================================================
echo.
pause
