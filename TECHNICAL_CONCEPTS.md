# GeoMap Projesi - Teknik Kavramlar ve Mimari Rehberi (Technical Concepts Guide)

Bu dosya, GeoMap projesinde kullanılan temel yazılım kavramlarını, mimari terimleri, coğrafi veri formatlarını ve API yapısını detaylı açıklamalar ve projedeki somut karşılıklarıyla açıklamak amacıyla oluşturulmuştur.

---

## 🌐 1. Endpoint (Erişim / İletişim Noktası) Nedir?

### 1.1 Tanım ve Çalışma Mantığı
**Endpoint**, ön yüzün (Frontend / React / Web Arayüzü) arka yüzdeki (Backend / C# Web API) belirli bir işlevi çalıştırmak veya veritabanına veri yazıp-okumak için ulaştığı **özel URL adresidir**.

* **Analoji (Restoran Örneği):** Siz (Frontend) masada otururken garsona menüdeki bir yemek kodunu söylersiniz. Garson (Endpoint / API) mutfağa (Backend / Veritabanı) gider, siparişi hazırlar ve size getirir.

### 1.2 Bir Endpoint'in Anatomisi
Her endpoint 2 temel bileşenden oluşur:
1. **HTTP Metodu (Eylem / Intent):**
   - `GET`: Veri okumak / getirmek için.
   - `POST`: Yeni veri oluşturmak / kaydetmek için.
   - `PUT`: Varolan bir veriyi güncellemek için.
   - `DELETE`: Veriyi silmek için.
2. **URL Yolu (Route):** Örneğin `/api/drawings/point`

### 1.3 GeoMap Projesindeki Endpoint Listesi

#### 📍 Çizim ve Geometri Endpoint'leri ([`DrawingsController.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.API/Controllers/DrawingsController.cs))
* **`GET /api/drawings`**: Veritabanındaki tüm Nokta, Çizgi ve Poligon kayıtlarını listeler.
* **`POST /api/drawings/point`**: Yeni bir Nokta coğrafi verisini `tbl_point` tablosuna kaydeder.
* **`POST /api/drawings/line`**: Yeni bir Çizgi coğrafi verisini `tbl_line` tablosuna kaydeder.
* **`POST /api/drawings/polygon`**: Yeni bir Poligon coğrafi verisini `tbl_polygon` tablosuna kaydeder.
* **`DELETE /api/drawings/{type}/{id}`**: Belirtilen çizimi (`point`, `line`, `polygon`) veritabanından siler.

#### 📊 Analiz Endpoint'leri ([`AnalysisController.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.API/Controllers/AnalysisController.cs))
* **`POST /api/analysis/inventory`**: Çizilen geçici poligonun WKT verisini alarak PostGIS `ST_Intersects` sorgusuyla altında kalan envanter kesişim sayısını hesaplar.

#### 🔑 Kimlik Doğrulama Endpoint'leri ([`AuthController.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.API/Controllers/AuthController.cs))
* **`POST /api/auth/login`**: Kullanıcı adı ve şifreyi doğrulayıp JWT Access Token üretir.

### 1.4 Controller Düzeyinde Standart Hata Yönetimi (Try-Catch & HTTP Status Codes)
Tüm API uç noktalarında (Endpoints) istemciye tutarlı ve güvenli hata yanıtları dönebilmek için standart `try-catch` blokları kullanılır:
- **`200 OK`**: İstek başarıyla işlendiğinde döner.
- **`400 BadRequest`**: İş mantığı veya doğrulama (validation) hatalarında (`ArgumentException`) açıklayıcı mesaj ile döner.
- **`404 NotFound`**: Aranan kaynak (çizim, mekan) veritabanında bulunamadığında döner.
- **`500 InternalServerError`**: Beklenmeyen sunucu istisnalarında (`Exception`) istemciye güvenli `Sunucu hatası: ...` formatında yanıt döner.

---

## 🗺️ 2. Coğrafi Veri Formatı ve Projeksiyon Yönetimi

### 2.1 WKT (Well-Known Text) Formatı Nedir?
Coğrafi şekillerin (geometrilerin) metin (text) formatında standart bir biçimde ifade edilmesini sağlayan yapıdır.

* **Nokta (Point):** `POINT(33.2433 38.9637)` (Boylam Enlem)
* **Çizgi (LineString):** `LINESTRING(33.1 38.1, 33.5 38.5, 34.0 39.0)`
* **Poligon (Polygon):** `POLYGON((33.0 38.0, 34.0 38.0, 34.0 39.0, 33.0 39.0, 33.0 38.0))`

### 2.2 Projeksiyon Sistemleri (EPSG:4326 vs EPSG:3857)
* **EPSG:4326 (WGS 84):** Dünya üzerindeki coğrafi enlem/boylam derece koordinat sistemidir. Veritabanında (PostgreSQL / PostGIS) veriler bu sistemle saklanır.
* **EPSG:3857 (Web Mercator):** Harita kütüphanelerinin (OpenLayers, Google Maps) haritayı düz bir 2D metre düzleminde çizmek için kullandığı harita projeksiyonudur.
* **Dönüşüm Süreci:**
  - Çizim yapıldığında: `EPSG:3857` (Harita) ➔ `EPSG:4326` (Veritabanı WKT).
  - Haritaya çizdirilirken: `EPSG:4326` (Veritabanı WKT) ➔ `EPSG:3857` (Harita).

---

## 🏗️ 3. Katmanlı Mimari (N-Tier Architecture)

Projemiz sorumlulukların ayrılması (Separation of Concerns) ilkesine göre 3 ana katmandan oluşur:

1. **`GeoraphMap.Core` (Çekirdek Katmanı):**
   - Veritabanı Entity modelleri (`User`, `PointFeature`, `LineFeature`, `PolygonFeature`).
   - DTO (Data Transfer Objects) sınıfları (`CreateDrawingDto`, `DrawingResponseDto`).
   - Servis Arayüzleri (Interfaces: `IDrawingService`, `IAnalysisService`).
2. **`GeoraphMap.Infrastructure` (Alt Yapı Katmanı):**
   - Veritabanı erişim katmanı (`AppDbContext`).
   - İş mantıklarının (Business Logic) kodlandığı servis sınıfları (`DrawingService`, `AnalysisService`).
   - NetTopologySuite ve PostGIS entegrasyonları.
3. **`GeoraphMap.API` (Sunucu / Sunum Katmanı):**
   - HTTP isteklerini karşılayan Controller sınıfları (`DrawingsController`, `AnalysisController`).
   - Dependency Injection (DI) ve Güvenlik (JWT Auth) yapılandırmaları.

---

## 🔒 4. JWT (JSON Web Token) Kimlik Doğrulama

* **Nedir?:** Kullanıcı giriş yaptıktan sonra sunucunun ürettiği, kullanıcının kimliğini ve oturum süresini içeren kriptografik dijital anahtardır.
* **Kullanımı:** Frontend tarafında `localStorage` içinde saklanır. Sunucuya atılan her isteğin HTTP Header kısmında `Authorization: Bearer <TOKEN>` şeklinde gönderilerek güvenli erişim sağlanır.

---

## 📊 5. Veritabanı İzleme (Audit / Tracking) Kolonları Mimarisi

Tüm çizim (`tbl_point`, `tbl_line`, `tbl_polygon`) ve mekan (`tbl_place`) tablolarında verinin yaşam döngüsünü ve sahipliğini takip etmek amacıyla 5 temel izleme kolonu kullanılır:

1. **`inserted_user_id` (`InsertedUserId` - `integer`)**: Veriyi oluşturan/kaydeden kullanıcının benzersiz ID bilgisini tutar.
2. **`inserted_date` (`InsertedDate` - `timestamp with time zone`)**: Verinin veritabanına kayıt edildiği UTC zaman damgası.
3. **`modified_date` (`ModifiedDate` - `timestamp with time zone`)**: Verinin son güncellendiği veya silindiği UTC zaman damgası.
4. **`is_active` (`IsActive` - `boolean`)**: Kaydın aktif olup olmadığını belirten bayrak (Varsayılan: `true`).
5. **`is_deleted` (`IsDeleted` - `boolean`)**: Mantıksal silme (Soft Delete) durumunu tutan bayrak (Varsayılan: `false`).

---

## 🎨 7. Harita Üzerinden Obje Yönetimi, Detay Pop-Up'ı ve Soft Delete Mimarisi

* **Detay Pop-Up'ı (Overlay Component):** Harita üzerindeki herhangi bir coğrafi nesneye (Point, Line, Polygon) tıklandığında OpenLayers `Overlay` ve React `createPortal` kullanılarak nesnenin tam üzerinde interaktif detay kartı açılır.
* **Canlı Güncelleme (Update Endpoint - PUT):** Pop-up içerisinden Obje İsmi, Renk (Hex & Palet Seçimi) ve Geometri (WKT) doğrudan düzenlenebilir. "Güncelle" butonuna basıldığında `PUT /api/drawings/{type}/{id}` ucu ile veritabanı ve haritadaki vektör nesneleri anında güncellenir.
* **Onaylı Mantıksal Silme (Confirm & Soft Delete - DELETE):** Pop-up üzerindeki "Sil" butonu, kullanıcının yanlışlıkla silmesini engellemek için `Error Prevention Modal` (Onay Penceresi) tetikler. Onay verildiğinde `DELETE /api/drawings/{type}/{id}` ucu çağrılarak veritabanında `is_deleted = true` ve `is_active = false` yapılır; böylece fiziksel silme yapılmadan mantıksal silme (Soft Delete) gerçekleşir.

---

## 🛡️ 8. Admin Paneli Arayüzü ve Dinamik Yetkilendirme (RBAC + Direct Permissions) Mimarisi

### 8.1 Sol Navigasyonlu Admin Paneli (Vertical Left Navbar)
- **Modüler Yapı:** Harita uygulamasına paralel çalışan sol tarafa dikey yaslanmış (Vertical Navbar) navigasyon çubuğu ve içerik paneli.
- **Kullanıcı Yönetimi Ekranı:** Kullanıcı listesi, kullanıcı ekleme, bilgileri güncelleme, aktif/pasif durumu değiştirme ve mantıksal silme (Soft Delete).
- **Rol Yönetimi Ekranı:** Rol listesi (Admin, Editor, Viewer vb.), yeni rol ekleme, rol günceleme ve silme.

### 8.2 Dinamik Yetkilendirme Veritabanı Mimarisi
- **`tbl_permission` Tablosu:** Sistem genelindeki yetki tanımlarını tutar (`point.create` -> "Point Ekleme", `line.create`, `polygon.create`, `place.create`, `user.manage`, `role.manage`).
- **`tbl_role` & `tbl_role_permission` Tablosu:** Rol tablosu ve bir role atanmış varsayılan yetkilerin ilişki tablosu.
- **`tbl_user_role` Tablosu:** Kullanıcılar ile Roller arasındaki Çoktan-Çoka (Many-to-Many) ilişki tablosu.
- **`tbl_user_permission` Tablosu:** Doğrudan kullanıcıya özel atanan (Direct Permission) yetkilerin ilişki tablosu.

### 8.3 Rolden Gelen Yetki Çakışması Engelleme ve Arayüz Mantığı (Role-Inherited Permissions Resolution)
- Yetkiler hem Role hem de doğrudan Kullanıcıya atanabilir.
- **Çakışma Engelleme Kuralı:** Eğer bir yetki kullanıcının seçili rolünde zaten tanımlıysa (örneğin "Point Ekleme" yetkisi "Editor" rolünde varsa), Kullanıcı Yetkileri seçim matrisinde bu yetkinin checkbox'ı **otomatik olarak seçili ve kilitli (disabled)** gelir.
- Arayüzde yetkinin yanında **"🛡️ Rolden Geliyor (Role Adı)"** rozeti gösterilerek mükerrer seçim yapılması engellenir.
- Rol dışındaki ek yetkiler ise kullanıcının doğrudan yetkileri olarak (**"⚡ Doğrudan Atanmış"**) işaretlenir ve kaydedilir.

---

## 🏛️ 9. Coğrafi İl Sınırı Veritabanı Mimarisi (`tbl_city`)

* **Entity Modeli ([`CityFeature.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.Core/CityFeature.cs)):** 81 ilin coğrafi sınır (MultiPolygon/Polygon WKT) ve idari öznitelik bilgilerini tutar.
* **Veritabanı Tablosu (`tbl_city`):** PostgreSQL PostGIS veritabanında `id`, `plate` (Plaka), `name` (İl Adı), `region` (Bölge), `wkt` (Coğrafi Sınır WKT), `is_active`, `is_deleted`, `inserted_date`, `modified_date` sütunlarıyla saklanır.
* **Otomatik Veri Doldurma (Auto-Seeding):** [`CityService.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.Infrastructure/Services/CityService.cs) servisi, veritabanı tablosu boş olduğunda Türkiye'nin 81 il sınırı GeoJSON verisini veritabanına otomatik olarak yükler.
* **Kalıcı Harita Güncellemesi (`POST /api/cities/bulk-save`):** İstemci harita üzerinde poligon kestiğinde, ada sildiğinde veya yeni il eklediğinde yapılan tüm değişiklikler `tbl_city` tablosuna kalıcı olarak yazılır.

---

## 🌍 10. GeoServer OGC WMS / WFS Servis Entegrasyonu Mimarisi

GeoServer, coğrafi verileri uluslararası standartlarda (OGC) sunan harita sunucusudur.

### 10.1 GeoServer Bileşenleri
* **Workspace (`geomap`):** İlgili coğrafi katmanları gruplayan mantıksal çalışma alanıdır.
* **Store (`PostGIS_GeoMap`):** PostgreSQL / PostGIS veritabanı bağlantı deposudur.
* **Layer (Katmanlar):** Veritabanı tablolarının GeoServer üzerinde yayınlanan katmanlarıdır (`geomap:tbl_point`, `geomap:tbl_line`, `geomap:tbl_polygon`, `geomap:tbl_city`).
* **WMS (Web Map Service):** Coğrafi harita verilerini **görüntü (PNG/JPEG)** olarak sunar.
* **WFS (Web Feature Service):** Coğrafi vektör verilerini **GeoJSON** formatında sunar.

### 10.2 Backend Proxy Servis Mantığı ([`GeoServerService.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.Infrastructure/Services/GeoServerService.cs) & [`GeoServerController.cs`](file:///c:/Users/altay/source/repos/GeoMap/GeoraphMap.API/Controllers/GeoServerController.cs))
İstemci (React / OpenLayers) veriyi doğrudan veritabanından çekmek yerine Backend API üzerinden talep eder:
1. `GET /api/geoserver/wfs/{layerName}`: GeoServer WFS servisi üzerinden GeoJSON getirir.
2. `GET /api/geoserver/wms`: GeoServer WMS harita görüntü karolarını proxy üzerinden getirir.
3. GeoServer sunucusu çevrimdışı olduğunda Backend servis mimarisi PostGIS veritabanından dinamik OGC WFS-GeoJSON nesnesi oluşturarak kesintisiz veri aktarımı sağlar (High Availability / Seamless Fallback).

### 10.3 GeoServer SQL View (SQL ile Katman Oluşturma) Mimarisi
- **Tanım:** GeoServer üzerinde doğrudan bir fiziksel veritabanı tablosunu yayınlamak yerine, PostgreSQL / PostGIS SQL sorgusu yazılarak dinamik bir sanal katman (SQL View) oluşturulması yöntemidir.
- **`is_deleted = false` Güvenliği:** SQL View tanımlanırken `WHERE is_deleted = false` şartı doğrudan SQL sorgusuna gömülür. Böylece:
  - Mantıksal olarak silinmiş kayıtlar haritada hiçbir zaman görüntülenmez.
  - İstemcinin (Frontend) ek bir filtre göndermesine gerek kalmadan sunucu düzeyinde veri izolasyonu ve yüksek performans sağlanır.
- **Örnek SQL View Tanımı (`v_points`):**
  ```sql
  SELECT id, name, color, geometry, inserted_user_id, is_active, is_deleted, 'Point' AS type
  FROM tbl_point
  WHERE is_deleted = false AND is_active = true
  ```

---

## 🔍 11. Dinamik CQL Filtreleme (Common Query Language - `cql_filter`) Mimarisi

### 11.1 CQL (Common Query Language) Nedir?
**CQL (Common Query Language)**, OGC (Open Geospatial Consortium) standartlarında tanımlanmış, coğrafi ve sözel (öznitelik) verileri filtrelemek için kullanılan güçlü bir metin tabanlı sorgulama dilidir.

### 11.2 Dinamik `cql_filter` Parametresi Nasıl Çalışır?
OpenLayers veya başka bir harita istemcisi GeoServer WMS/WFS servislerine istek atarken HTTP GET parametresi olarak `cql_filter` ekler:

* **Geometri Türü Bazlı Filtreleme:**
  ```http
  GET /geoserver/geomap/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=geomap:v_points&CQL_FILTER=type='Point' AND is_deleted=false&...
  ```
* **Kullanıcı / Editör Bazlı Filtreleme:**
  ```http
  GET /geoserver/geomap/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=geomap:v_points&CQL_FILTER=inserted_user_id=5 AND is_deleted=false&...
  ```
* **Mekânsal ve Zamansal Birleşik Filtreler:**
  ```http
  CQL_FILTER=is_deleted=false AND BBOX(geometry, 32.0, 39.0, 34.0, 41.0)
  ```

### 11.3 Projedeki Uygulama Mantığı
React tarafında kullanıcının sağ alt lejanttan seçtiği filtreye (`Tümü`, `Nokta`, `Çizgi`, `Poligon`) göre `TileWMS` kaynağının parametreleri canlı olarak `updateParams({ 'CQL_FILTER': dynamicCql })` şeklinde güncellenir ve GeoServer sadece filtrelenen verinin ısı haritası tile'ını istemciye iletir.

---

## ⚖️ 12. WMS vs WFS Katman Standartları ve İşlevsel Ayrımı

Coğrafi Bilgi Sistemleri (CBS / GIS) mimarisinde WMS ve WFS servisleri farklı amaçlar için optimize edilmiştir:

| Özellik | WMS (Web Map Service) | WFS (Web Feature Service) |
| :--- | :--- | :--- |
| **Veri Formatı** | Raster Görüntü (PNG / JPEG / WebP Tile) | Vektör Veri (GeoJSON / GML / WFS-XML) |
| **İşlem Yeri** | Sunucu Tarafı (Server-Side Rendering) | İstemci Tarafı (Client-Side Rendering) |
| **Performans** | Milyonlarca nokta/çizgi için çok hızlı ve hafiftir | Çok büyük verilerde istemci tarayıcısını yorabilir |
| **Kullanım Amacı** | **Genel Harita Gösterimi, Arka Plan Katmanları, Isı Haritası (Heatmap)** | **Çizim, Düzenleme, Köşe Yakalama (Snapping), Tıklama/Seçme (Selection)** |
| **Güvenlik** | Ham koordinat geometrisi istemciye gitmez, sadece resim gider | Ham koordinat ve öznitelik verileri istemciye iletilir |

* **Projedeki Kural:** Verilerin haritadaki genel gösterimlerinde ve ısı haritasında **WMS**, çizim, köşe düzenleme ve etkileşim işlemlerinde ise **WFS** katman yapısı tercih edilir.

---

## 🔥 13. Isı Haritası (Heatmap) ve SLD (Styled Layer Descriptor) Mimarisi

### 13.1 SLD (Styled Layer Descriptor) Nedir?
**SLD**, OGC standardında XML formatında yazılan ve harita katmanlarının sunucu tarafında nasıl çizileceğini, renklendirileceğini ve filtreleneceğini belirleyen stil tanımlama dilidir.

### 13.2 GeoServer `vec:Heatmap` Rendering Transformation
GeoServer, SLD içinde gömülü çalışan WPS (Web Processing Service) dönüşüm fonksiyonu olan `vec:Heatmap` ile nokta verilerini sunucuda dinamik bir yoğunluk yüzeyine (kernel density surface) dönüştürür:

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>drawings_heatmap</Name>
    <UserStyle>
      <Title>Dinamik Isı Haritası</Title>
      <FeatureTypeStyle>
        <Transformation>
          <ogc:Function name="vec:Heatmap">
            <ogc:Function name="parameter">
              <ogc:Literal>data</ogc:Literal>
            </ogc:Function>
            <ogc:Function name="parameter">
              <ogc:Literal>radiusPixels</ogc:Literal>
              <ogc:Literal>25</ogc:Literal>
            </ogc:Function>
            <ogc:Function name="parameter">
              <ogc:Literal>pixelsPerCell</ogc:Literal>
              <ogc:Literal>10</ogc:Literal>
            </ogc:Function>
          </ogc:Function>
        </Transformation>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="ramp" extended="true">
              <ColorMapEntry color="#0000ff" quantity="0.0" opacity="0"/>
              <ColorMapEntry color="#00ffff" quantity="0.2" opacity="0.5"/>
              <ColorMapEntry color="#00ff00" quantity="0.5" opacity="0.7"/>
              <ColorMapEntry color="#ffff00" quantity="0.8" opacity="0.85"/>
              <ColorMapEntry color="#ff0000" quantity="1.0" opacity="0.95"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

### 13.3 Isı Haritası Lejantı ve Normalizasyon (0.0 - 1.0 Skalası)
- **0.0 (Düşük Yoğunluk):** Mavi (`#0000ff`) $\rightarrow$ Hiç veya çok seyrek nokta yoğunluğu.
- **0.5 (Orta Yoğunluk):** Yeşil / Sarı (`#00ff00` / `#ffff00`) $\rightarrow$ Dengeli kümelenme.
- **1.0 (Yüksek Yoğunluk):** Kırmızı (`#ff0000`) $\rightarrow$ Noktaların, çizgi kırılma düğümlerinin ve poligon merkezlerinin en sık kümelendiği tepe yoğunluk alanları.

### 13.4 Çoklu Geometri Yoğunluk Çıkarımı
- **Noktalar (Point):** Doğrudan koordinat değeri ile ağırlık 1.0 olarak hesaplanır.
- **Çizgiler (LineString):** Güzergah boyunca yer alan tüm tepe ve kırılma noktaları (vertices) ayrıştırılarak düğüm yoğunluğu oluşturulur.
- **Poligonlar (Polygon):** Alanın sınır köşe koordinatları (`vertices`) ile ağırlık merkezi (`centroid`) ısı kaynağı olarak haritaya işlenir.

---

## 🎯 14. Kullanıcı Mekânsal Kısıtı (Spatial Boundary / Yetki Alanı Sınırı) Mimarisi

- **`spatial_boundary_wkt`:** `tbl_user` tablosunda saklanan, kullanıcının yalnızca belirli bir coğrafi sınır (Örn: Ankara il sınırı veya özel bir poligon) içerisinde çizim yapabilmesini sağlayan yetkilendirme kısıtıdır.
- **İstemci Tarafı Denetimi (`isGeomInsideBoundary`):** Kullanıcı haritada yeni bir nokta, çizgi veya poligon oluştururken OpenLayers geometrisi WKT sınırının dışına taşıyorsa çizim anında iptal edilir ve görsel hata uyarısı verilir.
- **Sunucu Tarafı Güvenlik (`PostGIS ST_Within / ST_Intersects`):** Backend API, istemciden gelen WKT geometrisinin kullanıcının kayıtlı `spatial_boundary_wkt` sınırları içinde olduğunu PostGIS mekânsal sorgularıyla doğrular. Sınır dışı kayıtlar `400 BadRequest` ile reddedilir.





