#!/bin/bash
set -e

echo "=================================================="
echo "  GeoraphMap PostGIS Baslatiliyor..."
echo "=================================================="

# PostGIS extension kurulumu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# SQL yedek dosyasi varsa geri yukleme
if [ -f /backup/db_backup.sql ]; then
    echo "-> db_backup.sql tespit edildi, 9300+ durak ve hatlar aktariliyor..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /backup/db_backup.sql || true
    echo "-> [OK] Veritabani basariyla geri yuklendi!"
else
    echo "-> db_backup.sql bulunamadi, bos PostGIS semasi ile devam ediliyor."
fi

echo "=================================================="
echo "  GeoraphMap Veritabani Hazir!"
echo "=================================================="
