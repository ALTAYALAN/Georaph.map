@echo off
setlocal EnableDelayedExpansion
title GeoraphMap - Veritabani Yedek Alma (Backup)

echo ========================================================
echo        GEORAPHMAP VERITABANI YEDEK ALMA ARACI
echo ========================================================
echo.

set "DUMP_FILE=%~dp0db_backup.dump"

set "PG_DUMP_EXE="
where pg_dump >nul 2>&1
if %errorlevel% equ 0 set "PG_DUMP_EXE=pg_dump"

if not defined PG_DUMP_EXE (
    for %%v in (18 17 16 15 14 13) do (
        if exist "C:\Program Files\PostgreSQL\%%v\bin\pg_dump.exe" (
            if not defined PG_DUMP_EXE set "PG_DUMP_EXE=C:\Program Files\PostgreSQL\%%v\bin\pg_dump.exe"
        )
    )
)

if not defined PG_DUMP_EXE (
    echo [UYARI] PostgreSQL otomatik bulunamadi.
    echo Lutfen PostgreSQL bin yolunu girin. Ornek: C:\Program Files\PostgreSQL\18\bin
    set /p PG_USER_BIN="Yol: "
    if exist "!PG_USER_BIN!\pg_dump.exe" set "PG_DUMP_EXE=!PG_USER_BIN!\pg_dump.exe"
)

if not defined PG_DUMP_EXE (
    echo [HATA] pg_dump.exe bulunamadi!
    pause
    exit /b 1
)

set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=postgres"
set "PGDATABASE=Geo"

echo Hedef: %PGDATABASE% veritabani yedegi aliniyor...
echo Program: %PG_DUMP_EXE%
echo.

set "PGPASSWORD=14111201"
set /p USER_PASS="PostgreSQL '%PGUSER%' sifresi (Varsayilan 14111201 icin Enter): "
if not "%USER_PASS%"=="" set "PGPASSWORD=%USER_PASS%"

echo.
echo Yedek aliniyor, lutfen bekleyin...
"%PG_DUMP_EXE%" -U %PGUSER% -h %PGHOST% -p %PGPORT% -d %PGDATABASE% -F c -b -v -f "%DUMP_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   [OK] Yedek basariyla alindi!
    echo   Dosya: %DUMP_FILE%
    echo   Artik bu dosyayi git'e pushlayabilirsiniz.
    echo ========================================================
) else (
    echo.
    echo [!] Yedek alma sirasinda bir hata olustu.
)
echo.
pause
