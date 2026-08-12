# Georaph.map - Coğrafi Konum ve Mekan Yönetim Platformu

Georaph.map, **.NET Web API** ve **React (OpenLayers & PrimeReact)** kullanılarak geliştirilmiş, PostGIS coğrafi veritabanı destekli, JWT kimlik doğrulamalı ve gelişmiş GIS (Coğrafi Bilgi Sistemleri) özelliklerine sahip bir web uygulamasıdır.

---

## 🌟 Öne Çıkan Özellikler

### 🔐 Kimlik Doğrulama & Oturum Yönetimi
- **JWT (JSON Web Token)** tabanlı güvenli kimlik doğrulama.
- **10 Dakikalık Oturum Takibi**: Canlı geri sayım sayacı ve otomatik oturum sonlandırma.
- **Geçiş Animasyonu**: Giriş yapıldığında 0.5 saniyelik eğrisel yörünge animasyonu ile haritaya akıcı geçiş.
- **Dark Glassmorphism Tasarımı**: Modern gece temalı giriş ekranı arayüzü.

### 🗺️ OpenLayers Çizim ve Mekansal İşlemler (GIS)
- **Nokta (Point / tbl_point)**: Harita tıklaması veya dinamik konum aracı ile nokta verisi kaydetme.
- **Çizgi (LineString / tbl_line)**: Serbest hat ve vektör çizgi çizimi, veritabanına aktarımı.
- **Poligon (Polygon / tbl_polygon)**: Alan ve bölge sınır çizimi, veritabanına aktarımı.
- **Veri Yalıtımı ve Rubberband Temizliği**: Çizim esnasında menü etkileşimlerinin haritaya yansımasını önleyen olay yalıtımı (`e.stopPropagation()`) ve canlı fare takip uzantısı temizliği (`finishDrawing()`).

### 📐 Coğrafi Veri Formatı & Projeksiyon Yönetimi
- **WKT (Well-Known Text)**: Veri okuma, yazma ve transferinde standart WKT formatı kullanımı (`WKTReader` / `WKTWriter`).
- **Projeksiyon Dönüşümü**: Haritadaki Web Mercator (`EPSG:3857`) ile PostgreSQL / PostGIS veritabanındaki WGS84 (`EPSG:4326`) koordinat projeksiyonları arasında otomatik dönüşüm.

### 🎨 Kullanıcı Deneyimi (UX) & PrimeReact Entegrasyonu
- **PrimeReact Bileşenleri**: Toast bildirimleri ve silme onay modalı (`Dialog`).
- **Error Prevention (Silme Onayı)**: Konum veya çizim silme işlemlerinden önce uyarı penceresi.
- **Birleşik Kayıtlı Menü**: Kayıtlı konumlar ve çizimler tek sekmeli panel altında görsel simgelerle listelenir.
- **Sade Vektörel İkonlar**: SVG formatında sadeleştirilmiş arayüz elemanları ve çöp kutusu ikonları.

---

## 🛠️ Teknolojiler

* **Backend:** .NET 9 Web API, Entity Framework Core, PostgreSQL, PostGIS, NetTopologySuite
* **Frontend:** React (Vite), OpenLayers (`ol`), PrimeReact (`primereact`), PrimeIcons
* **Güvenlik:** JWT (JSON Web Token), BCrypt Password Hashing

---

## 🗄️ Veritabanı Tablo Yapısı

- `tbl_user`: Kullanıcı hesapları (`id`, `username`, `password_hash`, `is_active`, `is_deleted`, `modified_date`)
- `tbl_place`: Konum verileri (`id`, `name`, `wkt`, `longitude`, `latitude`, `modified_date`)
- `tbl_point`: Nokta katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_line`: Çizgi katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)
- `tbl_polygon`: Poligon katmanı (`id`, `name`, `wkt`, `geometry`, `modified_date`)

---

## 🚀 Kurulum ve Çalıştırma

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

## 📄 Lisans
Bu proje geliştirme ve eğitim amaçlı tasarlanmıştır. Tüm hakları saklıdır.