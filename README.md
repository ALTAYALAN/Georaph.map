<p align="center">
  <img src="geo-client/public/logo.png" alt="Georaph.map Logo" width="120" />
</p>

# Georaph.map - Coğrafi Konum ve Mekan Yönetim Platformu

Georaph.map, **.NET Web API** ve **React (OpenLayers & PrimeReact)** kullanılarak geliştirilmiş, PostGIS coğrafi veritabanı destekli, JWT kimlik doğrulamalı ve gelişmiş GIS (Coğrafi Bilgi Sistemleri) özelliklerine sahip bir web uygulamasıdır.

---

## Öne Çıkan Özellikler

### Canlı Araç Simülasyonu & SignalR Gerçek Zamanlı Takip (Real-Time Transit)
- **Operatör ve Admin Simülasyon Başlatma:** Haritada veya listede bir güzergaha tıklandığında *"Simülasyonu Başlat"* butonu ile ilk duraktan son durağa gerçekçi araç hareketi başlatma (Yetki kısıtlaması: Sadece Admin ve Operatör).
- **SignalR İki Yönlü Veri Yayını (`/hubs/simulation`):** WebSocket altyapısıyla her 850 ms'de bir dinamik interpolasyonlu enlem, boylam, pusula açısı (`bearing`), hız ve tamamlanma yüzdesi yayını.
- **İstemci Canlı Araç Takibi (Auto-Pan Follow Mode):** Kullanıcıların güzergah kartından *"Takip Et"* butonu ile aracı canlı kamera takibine alabilmesi ve *"Takibi Bırak"* ile takipten çıkabilmesi.
- **Canlı Telemetri ve Yüzde Tamamlanma (%X) Kartı:** Hareket eden araca tıklandığında açılan popup; güzergahın yüzde kaçının tamamlandığını (`%X Tamamlandı` renkli progress bar), son geçilen durağı, sıradaki durağı ve hız telemetrisini anlık gösterir.

### Kimlik Doğrulama & Oturum Yönetimi
- **JWT (JSON Web Token)** tabanlı güvenli kimlik doğrulama.
- **10 Dakikalık Oturum Takibi**: Canlı geri sayım sayacı ve otomatik oturum sonlandırma.
- **Geçiş Animasyonu**: Giriş yapıldığında 0.5 saniyelik eğrisel yörünge animasyonu ile haritaya akıcı geçiş.
- **Dark Glassmorphism Tasarımı**: Modern gece temalı giriş ekranı arayüzü.

### OpenLayers Çizim ve Mekansal İşlemler (GIS)
- **POI (Point of Interest / tbl_poi)**: Operatör ve Admin'ler için harita üzerinden kategori, mesai saatleri ve açıklama bilgisiyle ilgi noktası kaydetme.
- **Hiyerarşik Kategori Sistemi (`tbl_poi_category`)**: Üst-Alt (Parent-Child) ilişkisine sahip hiyerarşik POI kategorilendirme mimarisi (Örn: *Yeme-İçme → Restoran, Kafe*).
- **Nokta (Point / tbl_point)**: Harita tıklaması veya dinamik konum aracı ile nokta verisi kaydetme.
- **Çizgi (LineString / tbl_line)**: Serbest hat ve vektör çizgi çizimi, veritabanına aktarımı.
- **Poligon (Polygon / tbl_polygon)**: Alan ve bölge sınır çizimi, veritabanına aktarımı.
- **Veri Yalıtımı ve Rubberband Temizliği**: Çizim esnasında menü etkileşimlerinin haritaya yansımasını önleyen olay yalıtımı (`e.stopPropagation()`) ve canlı fare takip uzantısı temizliği (`finishDrawing()`).

### Coğrafi Veri Formatı & Projeksiyon Yönetimi
- **WKT (Well-Known Text)**: Veri okuma, yazma ve transferinde standart WKT formatı kullanımı (`WKTReader` / `WKTWriter`).
- **Projeksiyon Dönüşümü**: Haritadaki Web Mercator (`EPSG:3857`) ile PostgreSQL / PostGIS veritabanındaki WGS84 (`EPSG:4326`) koordinat projeksiyonları arasında otomatik dönüşüm.

### Kullanıcı Deneyimi (UX) & PrimeReact Entegrasyonu
- **POI Bilgi Paneli (Info Card / Popup)**: Haritadaki veya listedeki POI'ye tıklandığında kategori rozeti, mesai saatleri, ekleyen kullanıcı ve koordinatları gösteren modern bilgi kartı.
- **PrimeReact Bileşenleri**: Toast bildirimleri ve silme onay modalı (`Dialog`).
- **Error Prevention (Silme Onayı)**: Konum veya çizim silme işlemlerinden önce uyarı penceresi.
- **Birleşik Kayıtlı Menü**: Kayıtlı konumlar, POI'ler ve çizimler tek sekmeli panel altında görsel simgelerle listelenir.
- **Sade Vektörel İkonlar**: SVG formatında sadeleştirilmiş arayüz elemanları ve çöp kutusu ikonları.

---

## Teknolojiler

* **Backend:** .NET 9 Web API, Entity Framework Core, PostgreSQL, PostGIS, NetTopologySuite
* **Frontend:** React (Vite), OpenLayers (`ol`), PrimeReact (`primereact`), PrimeIcons
* **Güvenlik:** JWT (JSON Web Token), BCrypt Password Hashing

---

### Editör İşbirliği & Yetkilendirme (Collaborations & Roles)
- **Editörler Arası İşbirliği (`tbl_editor_collaboration`)**: Editör kullanıcılarının bir diğer editöre işbirliği isteği göndermesi, kabul/reddetmesi ve harita üzerindeki çizimlerini karşılıklı görüntüleyip kırılma noktalarını düzenleyebilmesi/silebilmesi.
- **Misafir (Viewer / Salt-Okunur) Girişi**: Şifresiz misafir girişi ile haritadaki tüm çizimlerin salt-okunur (izleyici) modda görüntülenebilmesi.
- **Dinamik Harita Filtreleme Toolbar**: Zoom butonları yanında tür ve editör bazlı dinamik şekil filtreleme menüsü.
- **Gelişmiş Kırılma Noktası Düzenleme (Vertex Modify)**: Haritada şekil kırılma noktaları düzenlenirken çakışmayı önleyen otomatik ötelemeli pop-up ve yüzer kontrol çubuğu (`↩ Geri Al`, `↪ İleri Al`, `✓ Kaydet`, `✕ Vazgeç`).

### Admin Paneli, Rol Sıralaması ve POI Yönetimi
- **POI & Hiyerarşik Kategori Yönetimi**: Eklenen tüm POI'lerin listesi, oluşturan kullanıcı bilgisi, arama/filtreleme, hiyerarşik ağaç üzerinden yeni ana/alt kategori ekleme ve düzenleme.
- **Yetki Hiyerarşisi Sıralaması (`Admin > Editör > Viewer`)**: Kullanıcı listesi hem veritabanı API servisinde hem de istemci tarafında strictly yetki önceliğine göre sıralanır.
- **Varsayılan "Viewer" Rolü**: Yeni kayıt olan kullanıcılar veritabanı seeder'ı ve `RegisterAsync` mantığı ile otomatik olarak "Viewer" (Görüntüleyici) rolü atanarak başlatılır.
- **Sade İkonlu Buton Standartları**: Düzenle tuşları `34x34px` transparan mavi ikon buton, Silme tuşları `36x36px` transparan kırmızı ikon buton olarak en sağa sabitlenmiştir.
- **Tablo Sütun Düzeni**: `ID | Kullanıcı Adı | Rol | Durum | Yetki | E-Posta | Telefon | İşlemler` sıralamasına tam uyum.
- **Görsel Bütünlük ve Neon Temizliği**: Tüm kalkan/şimşek ikonları ve neon parlamalar kaldırılmış, mat flat kurumsal görünüm uygulanmıştır.

---

## Veritabanı Tablo Yapısı

- `tbl_user`: Kullanıcı hesapları (`id`, `username`, `password_hash`, `is_active`, `is_deleted`, `modified_date`)
- `tbl_poi_category`: Hiyerarşik POI kategorileri (`id`, `name`, `description`, `icon`, `color`, `parent_id`, `is_active`, `is_deleted`, `created_date`)
- `tbl_poi`: İlgi noktaları (POI) (`id`, `name`, `description`, `category_id`, `working_hours`, `wkt`, `geometry`, `user_id`, `is_active`, `is_deleted`, `created_date`)
- `tbl_editor_collaboration`: Editör işbirliği ve davet verileri (`id`, `sender_user_id`, `receiver_user_id`, `status`, `requested_date`)
- `tbl_place`: Konum verileri (`id`, `name`, `wkt`, `longitude`, `latitude`, `modified_date`)
- `tbl_point`: Nokta katmanı (`id`, `name`, `wkt`, `geometry`, `inserted_user_id`, `modified_date`)
- `tbl_line`: Çizgi katmanı (`id`, `name`, `wkt`, `geometry`, `inserted_user_id`, `modified_date`)
- `tbl_polygon`: Poligon katmanı (`id`, `name`, `wkt`, `geometry`, `inserted_user_id`, `modified_date`)
- `tbl_city`: Şehir ve il sınır poligonları (`id`, `plate`, `name`, `region`, `geometry`, `wkt`)

---

## Veritabanı Kurulumu ve Başka Cihaza Taşıma (Database Setup, Docker & Backup)

Projeyi GitHub'dan başka bir bilgisayara indirdiğinizde (`git clone`), veritabanını çalıştırmak için iki yöntem bulunmaktadır:

### Yöntem 1: Docker ile Tek Komutta Kurulum (En Kolay & Önerilen 🐳)
Yeni bilgisayarda PostgreSQL veya PostGIS kurulu olmasına gerek yoktur, sadece **Docker Desktop**'ın açık olması yeterlidir.

1. Proje kök dizininde terminali açıp şu komutu çalıştırın (veya **`docker-start.bat`** dosyasına çift tıklayın):
   ```bash
   docker compose up -d
   ```
2. PostGIS (`postgis/postgis:16-3.4`) konteyneri ayağa kalkarken `db_backup.dump` dosyasını **otomatik olarak** içe aktarır (`Geo` veritabanı, PostGIS eklentisi, POI'lar, güzergahlar ve kullanıcılar yüklenir).
3. Veritabanını durdurmak için:
   ```bash
   docker compose down
   ```
   *(veya **`docker-stop.bat`** dosyasına çift tıklayın)*

---

### Yöntem 2: Yerel PostgreSQL ile Geri Yükleme (Local Restore)
Eğer makinenizde PostgreSQL ve PostGIS kuruluysa:
1. Proje kök dizinindeki **`db_restore.bat`** dosyasına **çift tıklayın**.
   - Betik PostgreSQL aracını otomatik bulur.
   - `Geo` adında veritabanını oluşturur ve `PostGIS` eklentisini aktif eder.
   - `db_backup.dump` dosyasındaki tüm verileri eksiksiz geri yükler.
2. Eğer PostgreSQL şifreniz varsayılandan farklıysa, `GeoraphMap.API/appsettings.json` dosyasındaki şifreyi kendi şifrenizle güncelleyin.

---

### Güncel Veritabanı Yedeği Alma (Backup)
Haritada yeni veriler, POI'lar veya kullanıcılar oluşturduktan sonra güncel yedeği alıp GitHub'a yüklemek için:
- Proje kök dizinindeki **`db_backup.bat`** dosyasına çift tıklayın. Güncel veritabanı yedeğini `db_backup.dump` dosyasına otomatik yazar.

---

## Kurulum ve Çalıştırma

### Tek Tıkla Başlatma (En Kolay Yol)
Proje kök dizinindeki `start.bat` veya `baslat.bat` dosyasına **çift tıklayarak** hem **GeoServer**, hem **Backend (.NET Web API)** hem de **Frontend (React)** servislerini aynı anda otomatik olarak başlatabilirsiniz.

---

### Manuel Başlatma

#### 1. Backend (API) Başlatma
```bash
cd GeoraphMap.API
dotnet run
```
*Backend API: `http://localhost:5041`*

#### 2. Frontend (React) Başlatma
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

## Database Setup & Portability (Docker, Restore & Backup)

When cloning this project on another computer:

### Option 1: One-Command Setup with Docker (Recommended 🐳)
No need to install PostgreSQL or PostGIS locally. Only **Docker Desktop** is required.

1. Run the following command in the project root (or double-click **`docker-start.bat`**):
   ```bash
   docker compose up -d
   ```
2. The PostGIS (`postgis/postgis:16-3.4`) container will automatically initialize the `Geo` database and restore all schema, POIs, lines, and data from `db_backup.dump`.
3. To stop the database container:
   ```bash
   docker compose down
   ```
   *(or double-click **`docker-stop.bat`**)*

---

### Option 2: Local PostgreSQL Restore
If you prefer running a local PostgreSQL instance with PostGIS installed:
1. Double-click **`db_restore.bat`** in the repository root.
   - It automatically locates PostgreSQL tools (`pg_restore` and `psql`).
   - Creates the `Geo` database and enables the `PostGIS` extension.
   - Restores all tables, data, spatial geometries, POIs, and routes from `db_backup.dump`.
2. If your PostgreSQL password differs on the target machine, update `GeoraphMap.API/appsettings.json` accordingly.

---

### Exporting Fresh Database Backups
- Double-click **`db_backup.bat`** in the repository root anytime to export the latest PostgreSQL state into `db_backup.dump`.

---

## License
Designed for educational and development purposes. All rights reserved.
