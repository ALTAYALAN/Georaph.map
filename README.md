<p align="center">
  <img src="geo-client/public/logo.png" alt="Georaph.map Logo" width="120" />
</p>

# Georaph.map - Coğrafi Konum ve Mekan Yönetim Platformu

Georaph.map, **.NET Web API** ve **React (OpenLayers & PrimeReact)** kullanılarak geliştirilmiş, PostGIS coğrafi veritabanı destekli, JWT kimlik doğrulamalı ve gelişmiş GIS (Coğrafi Bilgi Sistemleri) özelliklerine sahip bir web uygulamasıdır.

---

## Öne Çıkan Özellikler

### Kimlik Doğrulama & Oturum Yönetimi
- **JWT (JSON Web Token)** tabanlı güvenli kimlik doğrulama.
- **10 Dakikalık Oturum Takibi**: Canlı geri sayım sayacı ve otomatik oturum sonlandırma.
- **Geçiş Animasyonu**: Giriş yapıldığında 0.5 saniyelik eğrisel yörünge animasyonu ile haritaya akıcı geçiş.
- **Dark Glassmorphism Tasarımı**: Modern gece temalı giriş ekranı arayüzü.

### OpenLayers Çizim ve Mekansal İşlemler (GIS)
- **Nokta (Point / tbl_point)**: Harita tıklaması veya dinamik konum aracı ile nokta verisi kaydetme.
- **Çizgi (LineString / tbl_line)**: Serbest hat ve vektör çizgi çizimi, veritabanına aktarımı.
- **Poligon (Polygon / tbl_polygon)**: Alan ve bölge sınır çizimi, veritabanına aktarımı.
- **Veri Yalıtımı ve Rubberband Temizliği**: Çizim esnasında menü etkileşimlerinin haritaya yansımasını önleyen olay yalıtımı (`e.stopPropagation()`) ve canlı fare takip uzantısı temizliği (`finishDrawing()`).

### Coğrafi Veri Formatı & Projeksiyon Yönetimi
- **WKT (Well-Known Text)**: Veri okuma, yazma ve transferinde standart WKT formatı kullanımı (`WKTReader` / `WKTWriter`).
- **Projeksiyon Dönüşümü**: Haritadaki Web Mercator (`EPSG:3857`) ile PostgreSQL / PostGIS veritabanındaki WGS84 (`EPSG:4326`) koordinat projeksiyonları arasında otomatik dönüşüm.

### Kullanıcı Deneyimi (UX) & PrimeReact Entegrasyonu
- **PrimeReact Bileşenleri**: Toast bildirimleri ve silme onay modalı (`Dialog`).
- **Error Prevention (Silme Onayı)**: Konum veya çizim silme işlemlerinden önce uyarı penceresi.
- **Birleşik Kayıtlı Menü**: Kayıtlı konumlar ve çizimler tek sekmeli panel altında görsel simgelerle listelenir.
- **Sade Vektörel İkonlar**: SVG formatında sadeleştirilmiş arayüz elemanları ve çöp kutusu ikonları.

---

## Teknolojiler

* **Backend:** .NET 9 Web API, Entity Framework Core, PostgreSQL, PostGIS, NetTopologySuite
* **Frontend:** React (Vite), OpenLayers (`ol`), PrimeReact (`primereact`), PrimeIcons
* **Güvenlik:** JWT (JSON Web Token), BCrypt Password Hashing

---

## Veritabanı Tablo Yapısı

- `tbl_user`: Kullanıcı hesapları (`id`, `username`, `password_hash`, `is_active`, `is_deleted`, `modified_date`)
- `tbl_place`: Konum verileri (`id`, `name`, `wkt`, `longitude`, `latitude`, `modified_date`)
- `tbl_point`: Nokta katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_line`: Çizgi katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_polygon`: Poligon katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)

---

## Kurulum ve Çalıştırma

### 1. Backend (API) Başlatma
```bash
cd GeoraphMap.API
dotnet run
```
*Backend API: `http://localhost:5041`*

### 2. Frontend (React) Başlatma
```bash
cd geo-client
npm install
npm run dev
```
*Frontend İstemci: `http://localhost:5173`*

---

<br />

---

# Georaph.map - Geographic Location & Spatial Management Platform

Georaph.map is a GIS (Geographic Information System) web application built using **.NET Web API** and **React (OpenLayers & PrimeReact)**, backed by a PostGIS spatial database, featuring JWT authentication and rich interactive mapping tools.

---

## Key Features

### Authentication & Session Management
- **JWT (JSON Web Token)** secure authentication mechanism.
- **10-Minute Session Control**: Real-time countdown timer and automatic logout mechanism.
- **Smooth Transition Animation**: 0.5-second curved trajectory animation for seamless entry into the map.
- **Dark Glassmorphism UI**: Modern night-themed login backdrop and UI components.

### OpenLayers Drawing & Spatial Operations (GIS)
- **Point (tbl_point)**: Save location pins via map click or location input tool.
- **Line (LineString / tbl_line)**: Draw freehand lines and vector paths, saving directly to spatial database.
- **Polygon (tbl_polygon)**: Draw boundary areas and regions, saving directly to spatial database.
- **Event Isolation & Rubberband Cleanup**: Prevent accidental map clicks while interacting with floating menus (`e.stopPropagation()`) and dynamic cursor line extension cleanup (`finishDrawing()`).

### Spatial Data Formats & Projection Management
- **WKT (Well-Known Text)**: Standardized WKT format for reading, writing, and transferring spatial geometry (`WKTReader` / `WKTWriter`).
- **Projection Transformation**: Automatic transformation between map Web Mercator (`EPSG:3857`) and spatial database WGS84 (`EPSG:4326`) coordinate reference systems.

### User Experience (UX) & PrimeReact Integration
- **PrimeReact Components**: Toast notifications and confirmation dialogs (`Dialog`).
- **Error Prevention (Delete Confirmation)**: Warning modals before deleting any saved location or drawing.
- **Unified Saved List**: Single panel listing saved locations and drawings with visual SVG type icons.
- **Minimal Vector Icons**: Clean SVG format trash and action icons.

---

## Technology Stack

* **Backend:** .NET 9 Web API, Entity Framework Core, PostgreSQL, PostGIS, NetTopologySuite
* **Frontend:** React (Vite), OpenLayers (`ol`), PrimeReact (`primereact`), PrimeIcons
* **Security:** JWT (JSON Web Token), BCrypt Password Hashing

---

## Database Schema

- `tbl_user`: User accounts (`id`, `username`, `password_hash`, `is_active`, `is_deleted`, `modified_date`)
- `tbl_place`: Place coordinates (`id`, `name`, `wkt`, `longitude`, `latitude`, `modified_date`)
- `tbl_point`: Point layer (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_line`: Line layer (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_polygon`: Polygon layer (`id`, `name`, `wkt`, `geometry`, `modified_date`)

---

## Getting Started

### 1. Backend (API) Launch
```bash
cd GeoraphMap.API
dotnet run
```
*Backend API: `http://localhost:5041`*

### 2. Frontend (React) Launch
```bash
cd geo-client
npm install
npm run dev
```
*Frontend Client: `http://localhost:5173`*

---

## License
Designed for educational and development purposes. All rights reserved.