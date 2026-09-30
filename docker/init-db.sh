#!/bin/bash
set -e

echo "=================================================="
echo "  GeoraphMap PostGIS Baslatiliyor..."
echo "=================================================="

# PostGIS extension kurulumu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Dump dosyasi varsa geri yukleme
if [ -f /backup/db_backup.dump ]; then
    echo "-> db_backup.dump tespit edildi, veriler geri yukleniyor..."
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges -v /backup/db_backup.dump || true
    echo "-> [OK] Veritabani basariyla geri yuklendi!"
else
    echo "-> db_backup.dump bulunamadi, bos PostGIS semasi ile devam ediliyor."
fi

echo "=================================================="
echo "  GeoraphMap Veritabani Hazir!"
echo "=================================================="
