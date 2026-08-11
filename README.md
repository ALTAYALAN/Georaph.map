# 🗺️ GeoMap - Harita ve Mekan Yönetim Uygulaması

GeoMap, **.NET 8 Web API** ve **React (OpenLayers)** kullanılarak geliştirilmiş, JWT kimlik doğrulamalı ve coğrafi konum tabanlı bir harita uygulamasıdır.

---

## 📌 Teknolojiler

* **Backend:** .NET 8 Web API, Entity Framework Core, PostgreSQL (PostGIS / NetTopologySuite)
* **Frontend:** React (Vite), OpenLayers (`ol`)
* **Kimlik Doğrulama:** JWT (JSON Web Token) - *10 Dakikalık Oturum Süresi*

---

## 🛠️ Ön Gereksinimler

Projeyi bilgisayarınızda çalıştırmak için aşağıdaki yazılımların kurulu olması gerekir:

1. **.NET 8 SDK** ([İndir](https://dotnet.microsoft.com/download/dotnet/8.0))
2. **Node.js** (v18 veya üzeri) ([İndir](https://nodejs.org/))
3. **PostgreSQL** (PostGIS eklentisi ile birlikte)

---

## ⚙️ Kurulum ve Yapılandırma

### 1. Veritabanı Ayarları (Backend)
`GeoraphMap.API/appsettings.json` dosyasındaki veritabanı bağlantı cümlesini kendi PostgreSQL şifrenize göre düzenleyin:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=Geo;Username=postgres;Password=KENDI_SIFRENIZ"
}
```

---

## 🚀 Projeyi Çalıştırma

Uygulamayı çalıştırmak için **iki ayrı terminal** kullanabilirsiniz:

### 1. Adım: Backend (API) Sunucusunu Başlatma
1. Birinci terminalde `GeoraphMap.API` klasörüne gidin:
   ```bash
   cd GeoraphMap.API
   ```
2. API sunucusunu başlatın:
   ```bash
   dotnet run
   ```
   * *Backend `http://localhost:5041` adresinde çalışır.*

---

### 2. Adım: Frontend (React) İstemcisini Başlatma
1. İkinci terminalde `geo-client` klasörüne gidin:
   ```bash
   cd geo-client
   ```
2. Paketleri yükleyin (yalnızca ilk kurulumda):
   ```bash
   npm install
   ```
3. Arayüz sunucusunu başlatın:
   ```bash
   npm run dev
   ```
   * *Arayüz `http://localhost:5173` adresinde çalışır.*

---

## 💡 Kullanım

1. Tarayıcınızda `http://localhost:5173` adresini açın.
2. Giriş ekranında **Kullanıcı Adı** ve **Şifre** girerek giriş yapın.
3. Giriş yapıldığında harita **Türkiye** merkezli (`zoom: 6`) açılır ve 10 dakikalık geri sayım sayacı başlar.
4. Harita üzerinden konum seçip mekan adı yazarak veritabanına kaydedebilirsiniz.