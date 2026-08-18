@echo off
title GeoraphMap Quick Launcher

echo ========================================================
echo   GeoraphMap Uygulamasi Baslatiliyor...
echo ========================================================
echo.

echo [1/2] Backend API (.NET 9) Baslatiliyor...
start "GeoraphMap API" cmd /k "cd /d "%~dp0GeoraphMap.API" && dotnet run"

echo [2/2] Frontend Client (React) Baslatiliyor...
start "GeoraphMap Client" cmd /k "cd /d "%~dp0geo-client" && npm run dev"

echo.
echo ========================================================
echo   Her iki servis ayri pencerelerde baslatildi!
echo   - Backend API:  http://localhost:5041
echo   - Frontend App: http://localhost:5173
echo ========================================================
echo.
ping 127.0.0.1 -n 3 > nul
