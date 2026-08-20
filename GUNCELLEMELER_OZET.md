# GeoraphMap - Yapılan Geliştirmeler ve Güncellemeler Özeti (Changelog)

**Tarih:** 20 Ağustos 2026  
**Proje:** GeoMap (GeoraphMap.API & Geo-Client)

---

## 1. Şehir, Bölge Yönetimi ve Veri Kalıcılığı (Persistence)

- **İl Ekleme & Poligon Kaydetme Hatası Düzeltildi:**
  - `adminApi.js` ve `GeoManagement.jsx` üzerinde gönderilen `id` parametresinin tamsayı (int) tipine dönüştürülmesi sağlandı, HTTP 400 Bad Request hatası giderildi.
  - `CityService.cs` içerisindeki `BulkSaveCitiesAsync` metodunda plaka bazlı gruplama (`GroupBy(c => c.Plate)`) uygulanarak yinelenen anahtar (`An item with the same key has already been added`) hatası çözüldü.
  - Sayfa yenilendiğinde şehirlerin silinmesi sorunu çözüldü; hem PostgreSQL veritabanına hem de istemci yerel depolama sürümüne eşzamanlı kalıcı kayıt sağlandı.
- **İsteğe Bağlı Bölge & Özel Yeni Bölge Tanımlama:**
  - Şehir ekleme ve düzenleme işlemlerinde bölge seçimi zorunluluğu esnetildi.
  - Sabit `<select>` yerine `<input list=...>` ve dinamik `<datalist>` yapısına geçilerek kullanıcının dilediği zaman haritada **yeni özel bölge adı** oluşturabilmesi sağlandı.
  - Yeni eklenen bölgeler anında filtre ve seçim menülerinde listelenir.

---

## 2. Google Haritalar Katmanları & Canlı Önizleme (Layer Switcher)

- **Çoklu Harita Katmanı Desteği:**
  - Google Hybrid (Uydu + Yol/Sınır İsimleri)
  - Google Roadmap (Siyasi / Yol Haritası)
  - Google Terrain (Fiziki / Arazi / Topografik)
  - Google Satellite (Saf Uydu Görüntüsü)
  - Carto Dark (Gece / Karanlık Mod)
  - Carto Light (Açık / Sade Harita)
  - OpenStreetMap (Standart)
- **Vektörel SVG İkonlar & Emojilerin Temizlenmesi:**
  - Tüm harita katmanlarındaki emojiler kaldırıldı; yerlerine özel vektörel SVG simgeler ve renkli etiket hapları entegre edildi.
- **Canlı Hover Önizlemesi (Hover Preview & Mini Thumbnails):**
  - Katman menüsünün üst kısmına anlık canlı önizleme kutusu eklendi. Kullanıcı fareyle herhangi bir katmanın üzerine geldiğinde haritanın Türkiye üzerindeki gerçek karosu ve detay açıklaması gösterilmektedir.
- **Karanlık Mod Uydu Renk Bozulması (Invert) Düzeltildi:**
  - OpenLayers harita tuvaline uygulanan eski CSS `invert` filtresi kaldırıldı; Google Uydu ve tüm haritalar karanlık modda dahi %100 doğal renkleriyle render edilmektedir.
- **Açılma Yönü (Positioning):**
  - Admin panelinde sağ tarafta bulunan araç çubuğu için katman menüsünün açılma yönü **sola (harita içine doğru)** ayarlandı (`direction="left"`).

---

## 3. Admin Paneli Aydınlık Modu (Light Mode) & Tipografi İyileştirmeleri

- **Admin Paneli Aydınlık Mod Desteği:**
  - `AdminDashboard`, `AdminSidebar`, `UserManagement`, `RoleManagement` ve `GeoManagement` bileşenlerine aydınlık tema desteği kazandırıldı.
  - Sol menü altına (Sidebar Footer) ve GeoManagement üst çubuğuna **Aydınlık / Koyu Mod Değiştirme Butonu** eklendi.
  - Seçilen tema tarayıcı hafızasında (`localStorage`) saklanır.
- **İl Listesindeki ID Rozetleri:**
  - Şehir listesi tablosundaki ID/plaka rozetleri (`.plate-badge`, `.compact-badge`) hem karanlık hem aydınlık modda **saf beyaz (`#ffffff`)** ve net okunabilir renge dönüştürüldü.
- **Neon / Parlamalı Yazıların Temizlenmesi:**
  - Sitedeki rahatsız edici metin gölgeleri (`text-shadow`) kaldırılarak sade, modern Inter tipografisine geçildi.

---

## 4. Ekran Yerleşimi, Seçili İl Pop-up & Yetkilendirme Entegrasyonu

- **Admin Panelinin Ekrana Tam Sığması (100vh Full Screen):**
  - Dış katmanlardaki taşmalar ve çift kaydırma çubuğu engellendi (`height: 100vh`, `overflow: hidden`).
  - Harita ve paneller ekran yüksekliğini tam olarak dolduracak şekilde esnek (flex/grid) yapıya kavuşturuldu.
- **Seçili İl Bildirim / Pop-up Konumlandırması:**
  - Önceden başlığı aşağı iterek harita boyutunu bozan bildirim bannerı, haritanın sol üst köşesine şık ve yarı saydam **yüzen bir kapsül (floating glassmorphism pill)** olarak taşındı.
- **İller Sekmesi (Sağ Çekmece):**
  - İl listesi paneli ekranın en sağ kenarına tam hizalandı (`margin-right: 0`, `width: 360px`).
- **Kullanıcı Yetki Ekranında Dinamik İl ve Bölge Entegrasyonu:**
  - `UserManagement.jsx` içerisindeki Coğrafi Çalışma Alanı yetkilendirme modalında sabit 81 il ve 7 bölge listesi yerine, sistemde yeni oluşturulan tüm iller ve özel bölgeler anlık dinamik olarak çekilip listeye dahil edildi.
  - Yeni eklenen bir il veya bölge, yetkilendirme ekranında anında seçilebilir durumdadır.

---

*GeoMap Sistem Geliştirme Raporu*
