using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure
{
    public static class TurkishMuseumsSeeder
    {
        public static async Task SeedAllTurkeyProvincialMuseumsAsync(AppDbContext context)
        {
            try
            {
                var wktReader = new WKTReader { DefaultSRID = 4326 };

                // 1. Kültür & Turizm Ana Kategorisini ve Müze Alt Kategorisini Bul / Oluştur
                var cultureParent = await context.PoiCategories
                    .FirstOrDefaultAsync(c => c.Name == "Kültür & Turizm" || c.Name == "Kültür & Sanat" || c.Name == "Kültür");

                if (cultureParent == null)
                {
                    cultureParent = new PoiCategory
                    {
                        Name = "Kültür & Turizm",
                        Description = "Müzeler, ören yerleri, tarihi mekanlar ve anıtlar",
                        Icon = "fa-landmark",
                        Color = "#8b5cf6",
                        DisplayOrder = 1,
                        IsActive = true,
                        IsDeleted = false
                    };
                    context.PoiCategories.Add(cultureParent);
                    await context.SaveChangesAsync();
                }

                var museumCategory = await context.PoiCategories
                    .FirstOrDefaultAsync(c => c.Name == "Müze" || (c.ParentId == cultureParent.Id && c.Name.Contains("Müze")));

                if (museumCategory == null)
                {
                    museumCategory = new PoiCategory
                    {
                        Name = "Müze",
                        Description = "Tarih, arkeoloji, etnografya, sanat ve bilim müzeleri",
                        ParentId = cultureParent.Id,
                        Icon = "fa-landmark",
                        Color = "#8b5cf6",
                        DisplayOrder = 1,
                        IsActive = true,
                        IsDeleted = false
                    };
                    context.PoiCategories.Add(museumCategory);
                    await context.SaveChangesAsync();
                }

                // 2. Default Kullanıcı (Admin veya ilk kullanıcı)
                var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == "admin" || u.Id == 1)
                                ?? await context.Users.FirstOrDefaultAsync();

                if (adminUser == null)
                {
                    Console.WriteLine("[TurkishMuseumsSeeder] Kullanıcı bulunamadı, müze POI seed işlemi ertelendi.");
                    return;
                }

                // Müzeler zaten mevcutsa 405 adet ardışık veritabanı sorgusunu atla (RAM ve CPU optimizasyonu)
                if (await context.Pois.CountAsync(p => p.CategoryId == museumCategory.Id && !p.IsDeleted) >= 300)
                {
                    Console.WriteLine("[TurkishMuseumsSeeder] 81 ilin tüm müzeleri zaten veritabanında mevcut, seed atlandı.");
                    return;
                }

                // 3. 81 İlin En Bilindik 5'er Müzesi (Toplam 405 Müze)
                var museums = Get81ProvincesMuseumList();

                int addedCount = 0;
                foreach (var m in museums)
                {
                    var exists = await context.Pois.AnyAsync(p => p.Name == m.Name && !p.IsDeleted);
                    if (!exists)
                    {
                        string wkt = string.Format(CultureInfo.InvariantCulture, "POINT({0:F6} {1:F6})", m.Lon, m.Lat);
                        var geom = wktReader.Read(wkt);

                        context.Pois.Add(new Poi
                        {
                            Name = m.Name,
                            Description = m.Desc,
                            CategoryId = museumCategory.Id,
                            WorkingHours = m.Hours,
                            Wkt = wkt,
                            Geometry = geom,
                            UserId = adminUser.Id,
                            IsActive = true,
                            IsDeleted = false,
                            CreatedDate = DateTime.UtcNow,
                            ModifiedDate = DateTime.UtcNow
                        });
                        addedCount++;
                    }
                }

                if (addedCount > 0)
                {
                    await context.SaveChangesAsync();
                    Console.WriteLine($"[TurkishMuseumsSeeder] Türkiye geneli 81 ilden toplam {addedCount} yeni müze POI'si başarıyla eklendi.");
                }
                else
                {
                    Console.WriteLine("[TurkishMuseumsSeeder] 81 ilin tüm müzeleri zaten veritabanında mevcut.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TurkishMuseumsSeeder] Müze POI seed hatası: {ex.Message}");
            }
        }

        public static List<(string City, string Name, string Desc, double Lon, double Lat, string Hours)> Get81ProvincesMuseumList()
        {
            return new List<(string City, string Name, string Desc, double Lon, double Lat, string Hours)>
            {
                // 01. ADANA
                ("Adana", "Adana Arkeoloji Müzesi", "Tarihi Milli Mensucat Fabrikası Müze Kompleksi içinde yer alan Çukurova arkeoloji müzesi.", 35.297400, 36.991200, "08:30 - 19:00"),
                ("Adana", "Adana Etnografya Müzesi", "Tarihi kilise binasında sergilenen Çukurova ve Toros Yörükleri etnografik eserleri.", 35.326200, 36.985600, "08:30 - 17:30"),
                ("Adana", "Adana Sinema Müzesi", "Seyhan Nehri kenarında Türk sineması ve Adanalı sanatçılara adanmış tematik müze.", 35.331200, 36.984500, "09:00 - 17:00"),
                ("Adana", "Adana Atatürk Evi Müzesi", "Atatürk'ün Adana ziyaretinde kaldığı 19. yüzyıl geleneksel Adana konağı.", 35.328900, 36.987000, "08:30 - 17:00"),
                ("Adana", "Misis Mozaik Müzesi", "Yüreğir Misis Antik Kenti buluntuları ve 4. yüzyıl zemin mozaiklerini barındıran müze.", 35.626400, 36.957500, "08:30 - 17:00"),

                // 02. ADIYAMAN
                ("Adıyaman", "Adıyaman Arkeoloji Müzesi", "Kommagene Krallığı, Paleolitik ve Roma dönemlerine ait zengin arkeolojik koleksiyon.", 38.276400, 37.763800, "08:00 - 17:00"),
                ("Adıyaman", "Nemrut Dağı Ören Yeri & Açık Hava Müzesi", "UNESCO Dünya Mirası I. Antiochos devasa heykelleri ve kutsal tümülüs alanı.", 38.740800, 37.980800, "Gündoğumu - Günbatımı"),
                ("Adıyaman", "Perre Antik Kenti & Nekropol Müzesi", "Kommagene'nin beş büyük kentinden biri olan tarihi kaya mezarları nekropolü.", 38.303100, 37.795200, "08:30 - 19:00"),
                ("Adıyaman", "Kahta Yeni Kale Müze Alanı", "Kocahisar Köyü'nde sarp kayalıklar üzerine kurulu Memlük ve Kommagene kalesi.", 38.654700, 37.954200, "08:30 - 18:00"),
                ("Adıyaman", "Arsemia Ören Yeri & Yazıt Alanı", "Kommagene Krallığı'nın yazlık başkenti, tünelleri ve Anadolu'nun en uzun Grekçe yazıtı.", 38.659200, 37.944200, "08:30 - 18:30"),

                // 03. AFYONKARAHİSAR
                ("Afyonkarahisar", "Afyonkarahisar Arkeoloji Müzesi", "Tunç Çağı, Hitit, Frig ve Roma dönemlerine ait lahitler ve heykeller müzesi.", 30.542200, 38.751100, "08:30 - 17:30"),
                ("Afyonkarahisar", "Zafer Müzesi (Başkomutanlık Karargahı)", "Büyük Taarruz planlarının yapıldığı tarihi karargah binası ve askeri müze.", 30.540100, 38.756900, "09:00 - 17:00"),
                ("Afyonkarahisar", "Sultan Divani Mevlevihanesi Müzesi", "Anadolu'nun ikinci büyük Mevlevihanesi olan tarihi külliye ve semahane.", 30.545800, 38.754700, "09:00 - 18:00"),
                ("Afyonkarahisar", "Afyonkarahisar Kültür Sanat Evi", "Tarihi konakta sergilenen Afyon geleneksel el sanatları ve şehir kültürü.", 30.541500, 38.753300, "09:00 - 17:30"),
                ("Afyonkarahisar", "Bolvadin Belediye Müzesi", "Bolvadin bölgesinin Roma, Bizans ve Osmanlı dönemi zengin etnografik mirası.", 31.048900, 38.712800, "08:30 - 17:00"),

                // 04. AĞRI
                ("Ağrı", "İshak Paşa Sarayı Müzesi", "Doğubayazıt'ta Osmanlı, Fars ve Selçuklu mimarisinin eşsiz şaheseri tarihi saray.", 44.135000, 39.520600, "08:30 - 19:00"),
                ("Ağrı", "Doğubayazıt Ahmed-i Hani Müzesi", "Büyük mutasavvıf ve düşünür Ahmed-i Hani'nin hayatı ve bölge kültürünü tanıtan müze.", 44.131000, 39.521800, "09:00 - 17:00"),
                ("Ağrı", "Ağrı İbrahim Çeçen Üniversitesi Kültür Müzesi", "Bölgenin tarihsel ve etnografik zenginliklerinin sergilendiği üniversite müzesi.", 43.052000, 39.718000, "09:00 - 16:30"),
                ("Ağrı", "Ağrı Kent Belleği ve Etnografya Evi", "Ağrı Dağı ve çevresinin geleneksel yaşam tarzı ve el sanatları sergi alanı.", 43.053500, 39.721500, "09:00 - 17:00"),
                ("Ağrı", "Diyadin Kanyonu & Kaplıcaları Kültür Alanı", "Doğal travertenler ve tarihi kaya yerleşimlerini içeren açık hava müze alanı.", 43.672000, 39.541000, "08:00 - 18:00"),

                // 05. AMASYA
                ("Amasya", "Amasya Arkeoloji ve Mumyalar Müzesi", "İlhanlılar dönemine ait dünyaca ünlü mumyalar ve Hitit Fırtına Tanrısı Teşup heykeli.", 35.836100, 40.653600, "08:30 - 19:00"),
                ("Amasya", "Şehzadeler Müzesi", "Osmanlı padişahı olmuş şehzadelerin bal mumu heykelleri ve dönemsel kıyafetleri.", 35.833900, 40.653100, "09:00 - 18:00"),
                ("Amasya", "Ferhat ile Şirin Aşıklar Müzesi", "Efsanevi aşıkların hikayesini su kanalları ve canlandırmalarla anlatan müze.", 35.808300, 40.638600, "09:00 - 18:00"),
                ("Amasya", "Sabuncuoğlu Şerefeddin Tıp ve Cerrahi Tarihi Müzesi", "Tarihi Bimarhane binasında Osmanlı dönemi cerrahi ve musiki ile tedavi yöntemleri.", 35.828600, 40.650800, "08:30 - 18:00"),
                ("Amasya", "Saraydüzü Kışlası Milli Mücadele Müzesi", "Amasya Genelgesi'nin imzalandığı tarihi kışla ve Kurtuluş Savaşı belgeleri.", 35.823900, 40.651400, "09:00 - 17:30"),

                // 06. ANKARA
                ("Ankara", "Anıtkabir Atatürk ve Kurtuluş Savaşı Müzesi", "Gazi Mustafa Kemal Atatürk'ün ebedi istirahatgahı ve Kurtuluş Savaşı müzesi.", 32.836900, 39.925000, "09:00 - 17:00"),
                ("Ankara", "Anadolu Medeniyetleri Müzesi", "Avrupa Yılın Müzesi ödüllü, Paleolitik'ten Urartu'ya eşsiz Anadolu hazineleri.", 32.863900, 39.938300, "08:30 - 19:00"),
                ("Ankara", "I. TBMM Kurtuluş Savaşı Müzesi", "Ulus'ta Cumhuriyetin kurulduğu ve bağımsızlığın ilan edildiği ilk meclis binası.", 32.854200, 39.941900, "09:00 - 18:00"),
                ("Ankara", "Erimtan Arkeoloji ve Sanat Müzesi", "Ankara Kalesi girişinde yer alan çağdaş arkeoloji koleksiyonu ve sanat galerisi.", 32.864700, 39.939200, "10:00 - 18:00"),
                ("Ankara", "Rahmi M. Koç Müzesi Ankara", "Tarihi Çengelhan ve Safranhan binalarında endüstri ve sanayi tarihi koleksiyonu.", 32.864200, 39.938900, "10:00 - 17:30"),

                // 07. ANTALYA
                ("Antalya", "Antalya Arkeoloji Müzesi", "Perge heykelleri, Herakles lahdi ve Likya uygarlığı hazinelerini barındıran dev müze.", 30.677500, 36.885300, "08:30 - 20:00"),
                ("Antalya", "Suna & İnan Kıraç Kaleiçi Müzesi", "Kaleiçi'nde geleneksel Osmanlı Antalya evi ve Aya Yorgi Kilisesi koleksiyonu.", 30.706100, 36.884200, "09:00 - 18:00"),
                ("Antalya", "Alanya Arkeoloji Müzesi", "Herakles heykeli, Helenistik bronz eserler ve Selçuklu kenti Alanya tarihi.", 31.990300, 36.542200, "08:30 - 19:00"),
                ("Antalya", "Side Antik Müzesi", "Tarihi Roma hamamı içerisinde sergilenen Side antik kenti lahit ve heykelleri.", 31.390800, 36.768100, "08:30 - 19:00"),
                ("Antalya", "Antalya Deniz Biyolojisi Müzesi", "Kaleiçi Yat Limanı'nda Türkiye deniz canlıları ve endemik deniz biyolojisi müzesi.", 30.702800, 36.883900, "09:30 - 18:30"),

                // 08. ARTVİN
                ("Artvin", "Artvin Yaşayan Kültür Evi Müzesi", "Geleneksel Artvin ahşap mimarisi, yöresel giyim ve yaşam kültürünü sergileyen müze.", 41.819700, 41.182200, "09:00 - 17:00"),
                ("Artvin", "Şavşat Kalesi Ören Yeri & Kültür Evi", "Bagratlı Krallığı ve Osmanlı dönemine ait tarihi Şavşat kalesi ve müze sergi alanı.", 42.361900, 41.241700, "08:30 - 18:00"),
                ("Artvin", "Borçka Karagöl Doğa ve Kültür Müzesi", "Milli park florası, faunası ve Kafkas ekosistemini anlatan doğa tanıtım merkezi.", 41.853300, 41.365300, "08:00 - 19:00"),
                ("Artvin", "Ardanuç Gevhernik Kalesi Tarih Alanı", "Tarihi İpek Yolu üzerinde yer alan kale içi açık hava müzesi ve kitabeler.", 42.061700, 41.127500, "08:30 - 18:00"),
                ("Artvin", "Hopa Kültür ve Sanat Evi Müzesi", "Karadeniz kıyı kültürü, Laz ve Hemşin etnografyası sergi galerisi.", 41.428900, 41.407200, "09:00 - 17:30"),

                // 09. AYDIN
                ("Aydın", "Aydın Arkeoloji Müzesi", "Tralleis, Magnesia ve Alabanda antik kentlerinden çıkan heykeller ve altın takılar.", 27.848900, 37.845600, "08:30 - 19:00"),
                ("Aydın", "Afrodisias Müzesi ve Ören Yeri", "UNESCO Dünya Mirası heykelcilik okulu, Sebasteion kabartmaları ve antik tiyatro.", 28.725800, 37.708300, "08:30 - 19:00"),
                ("Aydın", "Milet Müzesi (Didim)", "Milet Antik Kenti ve Didyma Apollon Tapınağı buluntularını sergileyen müze.", 27.277800, 37.530300, "08:30 - 19:00"),
                ("Aydın", "Kuşadası İbramaki Sanat Galerisi & Kent Müzesi", "Kuşadası denizcilik tarihi ve zeytincilik kültürüne ait tarihi konak müzesi.", 27.258900, 37.859400, "09:00 - 18:00"),
                ("Aydın", "Çine Kuvâ-yı Milliye Müzesi", "Milli Mücadele kahramanı Yörük Ali Efe ve Ege direnişini anlatan tarihi müze.", 28.061700, 37.616700, "08:30 - 17:30"),

                // 10. BALIKESİR
                ("Balıkesir", "Balıkesir Kuvayi Milliye Müzesi", "Alaca Mescit hareketi ve Milli Mücadele döneminin ilk karargah binası müzesi.", 27.886400, 39.648300, "08:30 - 17:30"),
                ("Balıkesir", "Bandırma Arkeoloji Müzesi", "Daskyleion Pers Satraplığı ve Kyzikos antik kenti mermer lahitleri koleksiyonu.", 27.968900, 40.351400, "08:30 - 17:30"),
                ("Balıkesir", "Ayvalık Taksiyarhis Rahmi M. Koç Müzesi", "Cunda Adası'nda restore edilen tarihi kilisede denizcilik ve teneke oyuncak müzesi.", 26.657500, 39.327500, "10:00 - 18:00"),
                ("Balıkesir", "Edremit Tahtakuşlar Etnografya Müzesi", "Türkiye'nin ilk özel köy müzesi, Kazdağları Türkmenleri ve deniz canlıları.", 26.858900, 39.588900, "08:30 - 18:00"),
                ("Balıkesir", "Havran Seyit Onbaşı Müzesi", "Çanakkale Kahramanı Koca Seyit'in hayatı, silahları ve hatıralarının sergilendiği müze.", 27.098300, 39.558300, "09:00 - 17:00"),

                // 11. BİLECİK
                ("Bilecik", "Bilecik Müzesi (Eski Hükümet Konağı)", "Osmanlı Devleti'nin kuruluş coğrafyası ve arkeolojik buluntuları içeren müze.", 29.978900, 40.141700, "08:30 - 17:30"),
                ("Bilecik", "Şeyh Edebali Türbesi Tarih Müzesi", "Osmanlı'nın manevi kurucusu Şeyh Edebali külliyesi ve açık hava tarih koridoru.", 29.986700, 40.146700, "08:00 - 19:00"),
                ("Bilecik", "Söğüt Ertuğrul Gazi Müzesi", "Ertuğrul Gazi Türbesi yanında Kayı Boyu gelenekleri ve Osmanlı kuruluşu müzesi.", 30.180300, 40.016900, "08:30 - 17:30"),
                ("Bilecik", "Bozüyük Şehir Müzesi ve Arşivi", "İnönü Savaşları hatıraları, Metristepe zaferi ve Bozüyük kent tarihi.", 30.038900, 39.907800, "09:00 - 17:00"),
                ("Bilecik", "Pazaryeri Etnografya Müzesi", "Geleneksel Pazaryeri çömlekçilik sanatı ve ilçe etnografik kültürü.", 29.904200, 39.991700, "09:00 - 17:00"),

                // 12. BİNGÖL
                ("Bingöl", "Bingöl Kent Tarihi ve Etnografya Müzesi", "Bingöl'ün Urartu'dan günümüze kültürel mirası ve geleneksel el sanatları.", 40.498900, 38.885600, "08:30 - 17:00"),
                ("Bingöl", "Yüzen Adalar Doğa Müzesi Alanı (Solhan)", "Dünyada eşine az rastlanan hareketli doğal adacıklar ve tabiat anıtı sergisi.", 41.026700, 38.938900, "08:00 - 19:00"),
                ("Bingöl", "Zağ Mağaraları Açık Hava Kültür Alanı", "Murat Nehri kıyısında 5. yüzyıl erken Hristiyanlık dönemi çok katlı kaya yerleşimi.", 40.612200, 38.741700, "08:30 - 18:00"),
                ("Bingöl", "Kiğı Kalesi Tarihi Sergi Alanı", "Urartu ve Orta Çağ kaya mezarları ile tarihi Kiğı Camii çevresi kültür alanı.", 40.345600, 39.308900, "09:00 - 17:30"),
                ("Bingöl", "Genç Sebeterias Kalesi Kültür Alanı", "Dara Hini antik dönemi ve Urartu izlerini taşıyan tarihi kale müze alanı.", 40.558300, 38.748900, "09:00 - 17:00"),

                // 13. BİTLİS
                ("Bitlis", "Ahlat Müzesi", "Urartu, Selçuklu ve Osmanlı dönemi zengin arkeolojik buluntuları ve taş sandukalar.", 42.488900, 38.748300, "08:30 - 17:30"),
                ("Bitlis", "Ahlat Selçuklu Meydan Mezarlığı Açık Hava Müzesi", "UNESCO geçici listesinde yer alan dünyanın en büyük Türk-İslam tarihi mezarlığı.", 42.483900, 38.751400, "08:00 - 19:00"),
                ("Bitlis", "Bitlis Etnografya Müzesi", "Tarihi taş konakta Bitlis tütüncülüğü, dokumacılığı ve geleneksel kent yaşamı.", 42.108900, 38.401100, "08:30 - 17:00"),
                ("Bitlis", "Bitlis Kalesi Arkeolojik Kültür Evi", "M.Ö. 312 yılında Büyük İskender komutanı Badlis tarafından kurulan tarihi kale.", 42.106700, 38.398600, "09:00 - 17:30"),
                ("Bitlis", "Adilcevaz Sahil Kalesi Müze Sergi Alanı", "Van Gölü kıyısında Urartu Kef Kalesi kalıntıları ve Selçuklu taş eserleri.", 42.735000, 38.802800, "09:00 - 18:00"),

                // 14. BOLU
                ("Bolu", "Bolu Müzesi (Arkeoloji ve Etnografya)", "Bithynia dönemi Claudiopolis mermer heykelleri ve Bolu el sanatları.", 31.606100, 40.735000, "08:30 - 17:30"),
                ("Bolu", "Göynük Gürcüler Konağı Etnografya Evi", "Akşemseddin Hazretleri diyarı Göynük'te 19. yüzyıl geleneksel ahşap konak yaşamı.", 30.787200, 40.400300, "09:00 - 17:30"),
                ("Bolu", "Mudurnu Ahilik Kültür Evi Müzesi", "UNESCO aday adayı Mudurnu'da 700 yıllık Ahilik geleneği ve esnaf kültürü.", 31.144200, 40.463900, "09:00 - 18:00"),
                ("Bolu", "Seben Kaya Evleri Açık Hava Müzesi", "Solaklar Köyü'nde Friglerden kalan çok katlı kaya yerleşimi ve mağaralar.", 31.572200, 40.411100, "08:30 - 18:00"),
                ("Bolu", "Bolu Köroğlu Kültür ve Sanat Evi", "Halk ozanı Köroğlu destanı ve Bolu yöresi halk edebiyatı sergisi.", 31.608300, 40.738900, "09:00 - 17:00"),

                // 15. BURDUR
                ("Burdur", "Burdur Arkeoloji Müzesi", "Hacılar Höyüğü Neolitik buluntuları ve Sagalassos antik kenti imparator heykelleri.", 30.285800, 37.721400, "08:30 - 19:00"),
                ("Burdur", "Sagalassos Antik Kenti Açık Hava Müzesi (Ağlasun)", "Torosların 1700 metre rakımında Antoninler Çeşmesi ve tiyatrosuyla ünlü antik kent.", 30.521700, 37.677500, "08:30 - 19:00"),
                ("Burdur", "Kibyra Antik Kenti Açık Hava Müzesi (Gölhisar)", "Gladyatörler kenti, muhteşem Medusa mozaiği ve 10.000 kişilik odeon alanı.", 29.488900, 37.156700, "08:30 - 19:00"),
                ("Burdur", "Burdur Doğa Tarihi Müzesi", "Kavaklı Rum Kilisesi binasında sergilenen Pliyosen dönemi dev mamut fosilleri.", 30.283100, 37.719400, "08:30 - 17:30"),
                ("Burdur", "Taş Oda Konağı Etnografya Müzesi", "17. yüzyıl Osmanlı sivil mimarisinin başyapıtı olan altın varaklı tavanlı konak.", 30.288300, 37.718300, "08:30 - 17:30"),

                // 16. BURSA
                ("Bursa", "Panorama 1326 Bursa Fetih Müzesi", "Dünyanın en büyük tam panoramik müzesi, Bursa'nın fethini 360 derece yaşatan merkez.", 29.076700, 40.188300, "09:00 - 17:00"),
                ("Bursa", "Bursa Arkeoloji Müzesi (Kültürpark)", "Bitinya, Roma ve Bizans devirlerine ait lahitler, büstler ve sikke koleksiyonları.", 29.043300, 40.194200, "09:00 - 18:00"),
                ("Bursa", "Türk İslam Eserleri Müzesi (Yeşil Medrese)", "Sultan I. Mehmed Çelebi'nin yaptırdığı tarihi medresede Selçuklu ve Osmanlı sanatı.", 29.074700, 40.181400, "09:00 - 18:00"),
                ("Bursa", "Bursa Kent Müzesi", "Heykel Meydanı'nda kentin 7000 yıllık geçmişi, ipekçilik ve çarşı kültürünü anlatan müze.", 29.065800, 40.184400, "09:30 - 17:30"),
                ("Bursa", "Tofaş Anadolu Arabaları Müzesi", "Umurbey'de tarihi ipek fabrikasında tekerlekten otomobile Anadolu araba tarihi.", 29.075800, 40.178300, "10:00 - 17:00"),

                // 17. ÇANAKKALE
                ("Çanakkale", "Troya Müzesi (Tevfikiye)", "Avrupa Yılın Müzesi Özel Ödüllü, Homeros destanları ve Troya antik kenti hazineleri.", 26.242800, 39.957500, "08:30 - 20:00"),
                ("Çanakkale", "Çanakkale Deniz Müzesi (Çimenlik Kalesi)", "Nusret Mayın Gemisi maketi, Fatih Sultan Mehmet kalesi ve 1915 Deniz Zaferi.", 26.398900, 40.147800, "09:00 - 17:00"),
                ("Çanakkale", "Çanakkale Destanı Tanıtım Merkezi (Kabatepe)", "Gelibolu Tarihi Yarımadası'nda ileri simülasyon ve Çanakkale Kara Savaşları müzesi.", 26.269400, 40.201700, "08:30 - 18:00"),
                ("Çanakkale", "Assos Ören Yeri ve Arkeoloji Müzesi (Behramkale)", "Aristoteles'in felsefe okulu kurduğu Athena Tapınağı ve antik liman müzesi.", 26.336400, 39.488900, "08:30 - 20:00"),
                ("Çanakkale", "Çanakkale Arkeoloji Müzesi", "Dardanos Tümülüsü altınları ve Tenedos ile Parion antik kentleri kazı buluntuları.", 26.411100, 40.134700, "08:30 - 17:30"),

                // 18. ÇANKIRI
                ("Çankırı", "Çankırı Müzesi", "Tarihi Hükümet Konağı binasında 8 milyon yıllık omurgalı fosilleri ve etnografik eserler.", 29.617800, 40.601400, "08:30 - 17:00"),
                ("Çankırı", "Tarihi Kaya Tuzu Mağarası Sanat Galerisi", "Hititlerden kalan 5000 yıllık yer altı tuz mağarasında heykel ve kültür galerisi.", 29.771700, 40.531700, "09:00 - 17:30"),
                ("Çankırı", "Ferit Akalın Radyo ve İletişim Müzesi", "Cumhuriyet dönemi ilk telsizler, nostaljik radyolar ve iletişim cihazları müzesi.", 29.615600, 40.603300, "09:00 - 17:00"),
                ("Çankırı", "Çivitçioğlu Medresesi Sanat Evi", "17. yüzyıl Osmanlı medresesinde geleneksel tezhip, ebru ve ney atölyeleri.", 29.614200, 40.605600, "09:00 - 18:00"),
                ("Çankırı", "Tarihi Çankırı Evleri Kültür Müzesi", "Geleneksel ahşap Çankırı konak mimarisi ve mahalle yaşamı sergi evi.", 29.616700, 40.607500, "09:00 - 17:00"),

                // 19. ÇORUM
                ("Çorum", "Çorum Arkeoloji ve Etnografya Müzesi", "Hitit başkenti Hattuşa, Şapinuva ve Alacahöyük altın ve pişmiş toprak şaheserleri.", 34.954200, 40.548900, "08:30 - 19:00"),
                ("Çorum", "Boğazköy Müzesi (Hattuşa)", "UNESCO Dünya Mirası Hitit Başkenti sfenksleri, çivi yazılı tabletleri ve kabartmaları.", 34.615600, 40.020800, "08:30 - 19:00"),
                ("Çorum", "Alacahöyük Müzesi ve Ören Yeri", "Kalkolitik ve Eski Tunç Çağı kral mezarları ile meşhur güneş kursu buluntu alanı.", 34.697500, 40.237800, "08:30 - 19:00"),
                ("Çorum", "Çorum Kent Arşivi ve Etnografya Evi", "Tarihi İskilip ve Çorum leblebicilik, bakırcılık kültürü ve şehir tarihi.", 34.956700, 40.551400, "09:00 - 17:30"),
                ("Çorum", "İskilip Alimler Müzesi ve Sanat Evi", "Tarihi kalede Osmanlı şeyhülislamları, Ebussuud Efendi ve İskilip alimleri sergisi.", 34.475000, 40.736100, "09:00 - 17:00"),

                // 20. DENİZLİ
                ("Denizli", "Hierapolis Arkeoloji Müzesi (Pamukkale)", "Travertenlerin yanı başında tarihi Roma hamamı içinde lahitler ve heykeller.", 29.124200, 37.925800, "08:00 - 21:00"),
                ("Denizli", "Laodikeia Antik Kenti Açık Hava Müzesi", "İncil'de geçen 7 kiliseden biri, anıtsal caddeleri ve restore edilmiş tapınakları.", 29.108300, 37.834700, "08:00 - 20:00"),
                ("Denizli", "Denizli Atatürk ve Etnografya Müzesi", "Mustafa Kemal Atatürk'ün Denizli'de kaldığı tarihi konak ve yöresel eserler.", 29.088900, 37.776400, "08:30 - 17:30"),
                ("Denizli", "Denizli Kent Belleği Müzesi", "Tarihi bez dokumacılığı, Buldan ipeği ve Denizli sanayi tarihi merkezi.", 29.084700, 37.778300, "09:00 - 18:00"),
                ("Denizli", "Tripolis Antik Kenti Açık Hava Müzesi (Buldan)", "Lidya ve Roma dönemi sütunlu caddeleri, mozaikli villaları ve agora alanı.", 28.948900, 38.058300, "08:30 - 18:30"),

                // 21. DİYARBAKIR
                ("Diyarbakır", "Diyarbakır Arkeoloji Müzesi (İçkale)", "Körtik Tepe Neolitik buluntuları ve Artuklu sarayı arkeolojik eserleri.", 40.241100, 37.915800, "08:30 - 19:00"),
                ("Diyarbakır", "Cahit Sıtkı Tarancı Müze Evi", "Ünlü şairin doğup büyüdüğü geleneksel bazalt taş avlulu Diyarbakır konağı.", 40.236700, 37.912200, "09:00 - 17:00"),
                ("Diyarbakır", "Ziya Gökalp Müze Evi", "Sosyolog ve yazar Ziya Gökalp'in çocukluk evi ve zengin edebiyat arşivi.", 40.238900, 37.913300, "09:00 - 17:00"),
                ("Diyarbakır", "Ahmet Arif Edebiyat Müze Kütüphanesi", "Sur içinde şair Ahmet Arif'in el yazmaları, daktilosu ve kütüphane kompleksi.", 40.237200, 37.911700, "09:00 - 18:00"),
                ("Diyarbakır", "Cemil Paşa Konağı Diyarbakır Kent Müzesi", "Güneydoğu Anadolu'nun en görkemli sivil mimari yapısında kent tarihi müzesi.", 40.243300, 37.908900, "09:00 - 18:00"),

                // 22. EDİRNE
                ("Edirne", "Sultan II. Bayezid Külliyesi Sağlık Müzesi", "Avrupa Konseyi Müze Ödüllü tarihi Darüşşifa, su ve musikiyle tedavi odaları.", 26.541400, 41.684700, "09:00 - 18:30"),
                ("Edirne", "Edirne Türk İslam Eserleri Müzesi", "Selimiye Külliyesi medresesinde çini, hat, kılıç ve saray eşyaları koleksiyonu.", 26.560600, 41.678100, "09:00 - 18:00"),
                ("Edirne", "Edirne Arkeoloji ve Etnografya Müzesi", "Trak mezar stelleri, Roma heykelleri ve Edirnekarî ahşap sanatı örnekleri.", 26.559400, 41.676900, "08:30 - 17:30"),
                ("Edirne", "Selimiye Vakıf Müzesi (Dar'ül Kurra)", "Mimar Sinan başyapıtı Selimiye Camii avlusunda tarihi vakıf eserleri.", 26.559700, 41.677800, "09:00 - 17:30"),
                ("Edirne", "Edirne Kent Müzesi (Hafıza-i Edirne)", "Osmanlı payitahtı Edirne'nin Balkan Savaşları ve zengin kent belleği.", 26.554200, 41.675000, "09:00 - 17:30"),

                // 23. ELAZIĞ
                ("Elazığ", "Elazığ Arkeoloji ve Etnografya Müzesi", "Keban ve Karakaya Baraj havzası kurtarma kazıları ve Harput kültürü.", 39.221700, 38.673900, "08:30 - 17:00"),
                ("Elazığ", "Tarihi Harput Kalesi & Açık Hava Müzesi", "Urartu Süt Kalesi, Artuklu zindanları ve binlerce yıllık tarihi yerleşim.", 39.255800, 38.705600, "08:30 - 19:00"),
                ("Elazığ", "Harput Basın Müzesi", "Doğu Anadolu'nun ilk matbaaları ve Cumhuriyet basını tarihi sergi alanı.", 39.253300, 38.703900, "09:00 - 17:30"),
                ("Elazığ", "Harput Musiki Müzesi", "Harput kürsübaşı kültürü, geleneksel Türk halk müziği ustaları ve enstrümanları.", 39.254200, 38.704700, "09:00 - 18:00"),
                ("Elazığ", "Şefik Gül Kültür Evi Müzesi (Harput)", "Tarihi Harput konağında geleneksel Elazığ ev yaşamı ve etnografyası.", 39.252500, 38.702800, "09:00 - 17:00"),

                // 24. ERZİNCAN
                ("Erzincan", "Erzincan Arkeoloji ve Kent Müzesi", "Urartu kenti Altıntepe buluntuları ve Erzincan bakır işleme sanatları.", 39.491700, 39.747200, "08:30 - 17:00"),
                ("Erzincan", "Altıntepe Ören Yeri Arkeoloji Alanı", "Urartu tapınağı, kabul salonu ve mozaikli Bizans kilisesi kalıntıları.", 39.694400, 39.702800, "08:30 - 18:00"),
                ("Erzincan", "Kemaliye Prof. Dr. Ali Demirsoy Doğa Tarihi Müzesi", "Türkiye'nin en kapsamlı üniversite doğa tarihi ve jeoloji müzesi.", 38.495800, 39.261100, "09:00 - 17:30"),
                ("Erzincan", "Kemaliye Ocak Köyü Ali Gürer Müzesi", "Anadolu'nun ilk özel köy müzesi ve Alevi-Bektaşi kültür mirası.", 38.561700, 39.183300, "09:00 - 18:00"),
                ("Erzincan", "Kemaliye Etnografya ve Kültür Evi", "Tarihi Eğin konakları mimarisi ve yöresel el sanatları sergisi.", 38.497200, 39.263900, "09:00 - 17:30"),

                // 25. ERZURUM
                ("Erzurum", "Erzurum Arkeoloji Müzesi", "Transkafkasya Karaz kültürü, Urartu bronzları ve Roma heykelleri koleksiyonu.", 41.272500, 39.904200, "08:30 - 19:00"),
                ("Erzurum", "Yakutiye Medresesi Türk İslam Eserleri Müzesi", "İlhanlılar devri görkemli medresesinde hat, tezhip ve maden sanatı eserleri.", 41.271100, 39.907500, "08:30 - 19:00"),
                ("Erzurum", "Çifte Minareli Medrese Müze Alanı", "Selçuklu taş işçiliğinin şaheseri tarihi medrese ve eyvan galerisi.", 41.278300, 39.906700, "08:00 - 19:30"),
                ("Erzurum", "Erzurum Kalesi ve Saat Kulesi Müze Alanı", "Saltuklular ve Osmanlı dönemi iç kale tahkimatı ve panoramik şehir manzarası.", 41.277800, 39.908300, "08:30 - 18:00"),
                ("Erzurum", "Erzurum Atatürk Evi Müzesi", "Erzurum Kongresi günlerinde Mustafa Kemal Paşa'nın 52 gün çalıştığı tarihi konak.", 41.268900, 39.903900, "09:00 - 17:00"),

                // 26. ESKİŞEHİR
                ("Eskişehir", "Odunpazarı Modern Müze (OMM)", "Kengo Kuma imzalı mimarisiyle uluslararası çağdaş sanat müzesi.", 30.526400, 39.764700, "10:00 - 18:00"),
                ("Eskişehir", "Eskişehir Eti Arkeoloji Müzesi", "Frig Vadisi Kaya Anıtları ve Dorylaion antik kenti heykelleri müzesi.", 30.528300, 39.762800, "08:30 - 17:30"),
                ("Eskişehir", "Yılmaz Büyükerşen Balmumu Heykeller Müzesi", "Tarihi ve çağdaş 200'den fazla ünlü şahsiyetin bal mumu heykelleri.", 30.527200, 39.765600, "10:00 - 17:00"),
                ("Eskişehir", "Eskişehir Çağdaş Cam Sanatları Müzesi", "Türkiye'nin ilk cam müzesi, yerli ve yabancı sanatçıların cam heykelleri.", 30.527800, 39.765000, "10:00 - 17:30"),
                ("Eskişehir", "TÜRASAŞ Devrim Otomobili Müzesi", "1961 yılında Türk mühendislerce yapılan ilk yerli Türk otomobili Devrim.", 30.505600, 39.775800, "10:00 - 16:30"),

                // 27. GAZİANTEP
                ("Gaziantep", "Zeugma Mozaik Müzesi", "Dünyaca ünlü Çingene Kızı mozaiği ve Fırat kıyısı Roma villaları taban şaheserleri.", 37.385300, 37.075000, "08:30 - 19:00"),
                ("Gaziantep", "Gaziantep Arkeoloji Müzesi", "Dülük antik kenti, Kommagene stelleri ve zengin Neolitik eserler salonu.", 37.378900, 37.061700, "08:30 - 17:30"),
                ("Gaziantep", "Gaziantep Savunması ve Kahramanlık Panoraması", "Milli Mücadele'de Antep savunması ve Şahin Bey destanını anlatan panorama.", 37.382800, 37.066400, "08:30 - 17:30"),
                ("Gaziantep", "Bayazhan Gaziantep Kent Müzesi", "Tarihi tütün tüccarı hanında Gaziantep zanaatları, fıstıkçılık ve gastronomi tarihi.", 37.381400, 37.058300, "09:00 - 18:00"),
                ("Gaziantep", "Gaziantep Oyun ve Oyuncak Müzesi", "Sunay Akın küratörlüğünde 1700'lerden günümüze dünya oyuncak tarihi.", 37.384700, 37.064200, "09:00 - 18:00"),

                // 28. GİRESUN
                ("Giresun", "Giresun Müzesi (Tarihi Gogora Kilisesi)", "18. yüzyıl tarihi bazilikasında Doğu Karadeniz arkeoloji ve etnografyası.", 38.391700, 40.918900, "08:30 - 17:30"),
                ("Giresun", "Giresun Kalesi Açık Hava Müzesi", "Pontus Kralı Pharnakes kalesi ve Milli Mücadele Kahramanı Topal Osman Ağa anıt mezarı.", 38.388300, 40.921400, "08:00 - 20:00"),
                ("Giresun", "Tirebolu Kalesi Müze Sergi Alanı", "Denize sıfır yarımada üzerinde tarihi Saint Jean kalesi ve kitabeleri.", 38.816700, 41.008300, "08:30 - 18:00"),
                ("Giresun", "Şebinkarahisar Atatürk Evi Müzesi", "Mustafa Kemal Atatürk'ün Şebinkarahisar ziyaretinde kaldığı tarihi Tüfekçizade Konağı.", 38.423300, 40.288900, "09:00 - 17:00"),
                ("Giresun", "Giresun Adası Açık Hava Tarih Alanı", "Doğu Karadeniz'in tek yaşanabilir adasında Amazon efsaneleri ve manastır kalıntıları.", 38.436100, 40.931700, "09:00 - 18:00"),

                // 29. GÜMÜŞHANE
                ("Gümüşhane", "Gümüşhane İkizevler Kent Müzesi", "Tarihi Süleymaniye mahallesinde geleneksel gümüş işlemeciliği ve şehir tarihi.", 39.458900, 40.461100, "08:30 - 17:00"),
                ("Gümüşhane", "Tarihi Süleymaniye Mahallesi Açık Hava Müzesi", "Cami, kilise ve darphanelerin bir arada yaşadığı tarihi madenci kenti harabeleri.", 39.438900, 40.447800, "08:00 - 19:00"),
                ("Gümüşhane", "Karaca Mağarası Sergi ve Kültür Alanı (Torul)", "Sarkıt, dikit ve sütunlarıyla dünya çapında jeolojik doğa şaheseri.", 39.394400, 40.547200, "08:30 - 19:00"),
                ("Gümüşhane", "Torul Kalesi Cam Seyir Terası Müze Alanı", "Fatih Sultan Mehmet dönemi kalesinde 240 metre yükseklikte tarihi seyir terası.", 39.294400, 40.561100, "08:30 - 19:00"),
                ("Gümüşhane", "Santa Harabeleri Arkeolojik Kültür Alanı", "Dumanlı Köyü'nde 7 mahalleden oluşan tarihi Rum taş konakları ve kiliseleri.", 39.683300, 40.600000, "09:00 - 18:00"),

                // 30. HAKKARİ
                ("Hakkari", "Hakkari Meydan Medresesi Kültür Müzesi", "1700 yılında Hakkari Beyi İzzeddin oğlu İbrahim Bey tarafından yaptırılan şaheser.", 43.740800, 37.575600, "08:30 - 17:00"),
                ("Hakkari", "Hakkari Kent Belleği ve Etnografya Evi", "Ters lale diyarı Hakkari'nin geleneksel kilimleri, yayla kültürü ve el sanatları.", 43.742200, 37.576700, "09:00 - 17:30"),
                ("Hakkari", "Şemdinli Kayme Sarayı Kültür Alanı", "Seyyid Taha-i Hakkari döneminde inşa edilen tarihi taş saray kalıntısı.", 44.572200, 37.294400, "08:30 - 17:30"),
                ("Hakkari", "Çukurca Tarihi Taş Evler Açık Hava Alanı", "Sivil mimarlık örneği çok katlı tarihi Çukurca taş kale evleri.", 43.616700, 37.247200, "09:00 - 17:00"),
                ("Hakkari", "Yüksekova Taş Köprü Kültür Alanı", "Nehri bölgesinde tarihi kemer köprü ve Urartu kaya mezarları güzergahı.", 44.283300, 37.566700, "09:00 - 17:00"),

                // 31. HATAY
                ("Hatay", "Hatay Arkeoloji Müzesi", "Dünyanın en geniş taban mozaiği koleksiyonu ve Kral Şuppiluliuma heykeli.", 36.178300, 36.236100, "08:30 - 19:00"),
                ("Hatay", "St. Pierre Kilisesi ve Açık Hava Müzesi", "Hristiyanlık adının dünyada ilk kez kullanıldığı mağara kilise ve anıtı.", 36.177200, 36.208900, "08:30 - 19:00"),
                ("Hatay", "Hatay Şehir Müzesi", "Tarihi Antakya mimarisi, ipekçilik ve çok dinli kültür mirası sergi binası.", 36.160300, 36.203600, "09:00 - 17:30"),
                ("Hatay", "Titus Tüneli ve Beşikli Mağara (Samandağ)", "Roma İmparatoru Vespasianus dönemi el oyması devasa tünel ve kaya mezarları.", 35.928300, 36.121400, "08:30 - 19:00"),
                ("Hatay", "Hatay Tıbbi ve Aromatik Bitkiler Müzesi", "Tarihi Antakya evinde bölgenin zengin şifalı bitki florası sergisi.", 36.161100, 36.204400, "08:30 - 17:00"),

                // 32. ISPARTA
                ("Isparta", "Isparta Arkeoloji ve Etnografya Müzesi", "Pisidia bölgesi heykelleri, Göller Bölgesi fosilleri ve geleneksel gülcülük.", 30.554200, 37.765600, "08:30 - 17:30"),
                ("Isparta", "Yalvaç Müzesi ve Pisidia Antiokheia Ören Yeri", "Aziz Pavlus'un ilk vaazını verdiği tarihi metropol antik kenti buluntuları.", 31.176400, 38.298900, "08:30 - 19:00"),
                ("Isparta", "Prof. Dr. Turan Yazgan Halı ve Kilim Müzesi", "Gökkuşağı gibi dokunan tarihi Isparta halıları ve Türk dünyası kilim hazinesi.", 30.562200, 37.771400, "09:00 - 18:00"),
                ("Isparta", "Süleyman Demirel Demokrasi ve Kalkınma Müzesi", "İslamköy'de 9. Cumhurbaşkanı Süleyman Demirel'in arşivi ve kütüphanesi.", 30.648900, 37.891700, "09:00 - 17:00"),
                ("Isparta", "Eğirdir Kalesi ve Dündar Bey Medresesi Tarih Alanı", "Eğirdir Gölü kıyısında Selçuklu taş medresesi ve kalesi kültür alanı.", 30.852800, 37.876700, "08:30 - 18:30"),

                // 33. MERSİN
                ("Mersin", "Mersin Arkeoloji Müzesi", "Yumuktepe Höyüğü 9000 yıllık geçmişi ve Soli Pompeiopolis antik kenti sütunları.", 34.606700, 36.786700, "08:30 - 19:00"),
                ("Mersin", "Tarsus Müzesi (75. Yıl Kültür Merkezi)", "Aziz Pavlus Kuyusu, Kleopatra Kapısı ve Eshab-ı Kehf Mağarası zengin koleksiyonu.", 34.896700, 36.915000, "08:30 - 18:00"),
                ("Mersin", "Mersin Deniz Müzesi", "Türk denizcilik tarihi, Çanakkale deniz savaşları ve askeri gemi modelleri.", 34.588900, 36.778300, "09:00 - 17:00"),
                ("Mersin", "Mersin Atatürk Evi Müzesi", "Atatürk ve Latife Hanım'ın Mersin ziyaretlerinde konakladığı tarihi levanten evi.", 34.628900, 36.801100, "08:30 - 17:00"),
                ("Mersin", "Kızkalesi & Korykos Ören Yeri Açık Hava Müzesi", "Erdemli sahilinde denizin ortasında yükselen efsanevi deniz kalesi.", 34.146700, 36.483300, "08:00 - 19:30"),

                // 34. İSTANBUL
                ("İstanbul", "Topkapı Sarayı Müzesi", "Osmanlı padişahlarının 400 yıllık idare merkezi, Kutsal Emanetler ve Harem.", 28.983300, 41.011700, "09:00 - 18:00"),
                ("İstanbul", "İstanbul Arkeoloji Müzeleri", "İskender Lahdi, Kadeş Anlaşması tableti ve dünyanın ilk arkeoloji koleksiyonlarından biri.", 28.981400, 41.011400, "09:00 - 19:00"),
                ("İstanbul", "Ayasofya Tarih ve Deneyim Müzesi", "Ayasofya'nın 1500 yıllık mimari ve ruhani serüvenini dijital sanatla sunan müze.", 28.979700, 41.008600, "09:00 - 19:30"),
                ("İstanbul", "Dolmabahçe Sarayı Müzesi", "Boğaz kıyısında neobarok Osmanlı sarayı, Kristal Merdivenler ve Muayede Salonu.", 29.000300, 41.039200, "09:00 - 17:30"),
                ("İstanbul", "İstanbul Modern Sanat Müzesi (Galataport)", "Renzo Piano imzalı binasında Türkiye'nin öncü uluslararası çağdaş sanat müzesi.", 28.982200, 41.026400, "10:00 - 18:00"),

                // 35. İZMİR
                ("İzmir", "Efes Müzesi ve Efes Ören Yeri (Selçuk)", "UNESCO Dünya Mirası Artemis heykelleri, Celsus Kütüphanesi ve Yamaç Evler.", 27.367200, 37.948900, "08:00 - 20:00"),
                ("İzmir", "İzmir Arkeoloji ve Etnografya Müzesi (Bahribaba)", "Bayraklı Smyrna Höyüğü, Agora ve İyonya uygarlıklarına ait heykeller.", 27.127800, 38.414700, "08:30 - 19:00"),
                ("İzmir", "Bergama Arkeoloji Müzesi ve Akropol", "Dünyanın en dik antik tiyatrosu, Pergamon Krallığı ve parşömen tarihi.", 27.178300, 39.121700, "08:30 - 19:00"),
                ("İzmir", "İzmir Resim ve Heykel Müzesi (Kültürpark)", "Tanzimat'tan günümüze Türk plastik sanatlarının seçkin koleksiyonu.", 27.147200, 38.431900, "09:00 - 17:30"),
                ("İzmir", "İzmir Atatürk Evi Müzesi (Kordon)", "Gazi Mustafa Kemal Paşa'nın İzmir ikametgahı ve Kurtuluş Savaşı karargahı.", 27.140300, 38.433900, "08:30 - 17:30"),

                // 36. KARS
                ("Kars", "Ani Ören Yeri Açık Hava Müzesi", "UNESCO Dünya Mirası '1001 Kiliseli Şehir', İpek Yolu ve Fethiye Camii (Ani Katedrali).", 43.571900, 40.509700, "08:30 - 19:00"),
                ("Kars", "Kars Kafkas Cephesi Harp Tarihi Müzesi (Kanlı Tabya)", "1877-1878 Osmanlı-Rus Savaşı ve Sarıkamış Harekatı kahramanlık müzesi.", 43.104200, 40.613900, "08:30 - 17:30"),
                ("Kars", "Kars Müzesi", "Eski Tunç Çağı ahşap mezar arabaları, Urartu bronzları ve Selçuklu kitabeleri.", 43.098300, 40.607800, "08:30 - 17:00"),
                ("Kars", "Kars Kalesi ve Beylerbeyi Sarayı Müze Alanı", "Sultan III. Murad dönemi tarihi kale burçları ve Kars Çayı panoraması.", 43.091700, 40.615600, "08:00 - 19:00"),
                ("Kars", "Namık Kemal Evi ve Kültür Müzesi", "Vatan Şairi Namık Kemal'in dedesiyle birlikte çocukluğunu geçirdiği tarihi konak.", 43.093300, 40.612800, "09:00 - 17:00"),

                // 37. KASTAMONU
                ("Kastamonu", "Kastamonu Arkeoloji Müzesi", "Mustafa Kemal Atatürk'ün 1925 Şapka Nutku'nu söylediği tarihi bina ve arkeoloji salonu.", 33.778300, 41.378900, "08:30 - 17:30"),
                ("Kastamonu", "Kastamonu Etnografya Müzesi (Livapaşa Konağı)", "Geleneksel ahşap oymacılığı, dokumacılık ve Kastamonu konak hayatı.", 33.774400, 41.376100, "08:30 - 17:00"),
                ("Kastamonu", "Vedat Tek Kültür Merkezi (Şapka & Silah Müzesi)", "Cumhuriyet tarihinin ilk ve tek Şapka Müzesi ile tarihi silahlar koleksiyonu.", 33.766700, 41.368300, "09:00 - 17:30"),
                ("Kastamonu", "Kastamonu Kent Tarihi Müzesi", "Eski Hükümet Konağı yanında Kastamonu zanaatları ve Kurtuluş Savaşı İnebolu hattı.", 33.775600, 41.377500, "09:00 - 17:00"),
                ("Kastamonu", "Şeyh Şaban-ı Veli Külliyesi ve Vakıf Müzesi", "Anadolu'nun dört büyük velisinden Şeyh Şaban-ı Veli türbesi ve el yazmaları.", 33.769400, 41.371100, "08:00 - 19:00"),

                // 38. KAYSERİ
                ("Kayseri", "Kayseri Arkeoloji Müzesi (Kayseri Kalesi)", "Tarihi Roma-Selçuklu kalesinin içinde Kültepe tabletleri ve Roma lahitleri.", 35.488600, 38.721700, "09:00 - 19:00"),
                ("Kayseri", "Selçuklu Uygarlığı Müzesi (Gevher Nesibe)", "Dünyanın ilk tıp fakültesi ve şifahanesinde Selçuklu medeniyeti ve tıp tarihi.", 35.483900, 38.725800, "09:00 - 18:00"),
                ("Kayseri", "Kayseri Milli Mücadele Müzesi (Taş Mektep)", "Kayseri Lisesi tarihi binasında Sakarya Savaşı ve şehit düşen son sınıf öğrencileri.", 35.480600, 38.718300, "09:00 - 17:30"),
                ("Kayseri", "Kültepe Kaniş-Karum Ören Yeri Açık Hava Müzesi", "Anadolu'da yazılı tarihin başladığı 4000 yıllık Asur Ticaret Kolonileri başkenti.", 35.633900, 38.850300, "08:30 - 19:00"),
                ("Kayseri", "Güpgüpoğlu Konağı Etnografya Müzesi", "18. yüzyıl geleneksel Kayseri harem-selamlık mimarisi ve gelin odası sergisi.", 35.486700, 38.720300, "08:30 - 17:30"),

                // 39. KIRKLARELİ
                ("Kırklareli", "Kırklareli Müzesi", "Eski Belediye Binasında Trakya doğa tarihi, memeli fosilleri ve arkeoloji koleksiyonu.", 27.224700, 41.734700, "08:30 - 17:30"),
                ("Kırklareli", "Aşağı Pınar Açık Hava Arkeoloji Müzesi", "Avrupa'ya tarımın yayılışını kanıtlayan 8000 yıllık Neolitik köy canlandırması.", 27.208300, 41.725000, "09:00 - 17:30"),
                ("Kırklareli", "Vize Küçük Ayasofya (Gazi Süleyman Paşa) Tarih Alanı", "6. yüzyıl I. Justinianus dönemi Bizans bazilikası ve Trakya tarihi merkezi.", 27.766700, 41.572200, "09:00 - 18:00"),
                ("Kırklareli", "Kıyıköy Kalesi ve Aya Nikola Manastırı", "Karadeniz kıyısında sarp kayalıklara oyulmuş 6. yüzyıl kaya manastırı müzesi.", 28.094400, 41.636100, "08:30 - 18:30"),
                ("Kırklareli", "Dupnisa Mağarası Doğa Sergi Alanı (Demirköy)", "Istranca Ormanları kalbinde 3 milyon yıllık karstik mağara ekosistemi.", 27.558300, 41.841700, "08:30 - 18:00"),

                // 40. KIRŞEHİR
                ("Kırşehir", "Kırşehir Müzesi (Kültür Merkezi)", "Kaleiçi, Hashöyük ve Kaman kazılarından çıkarılan Frig, Roma ve Selçuklu hazineleri.", 34.158900, 39.145600, "08:30 - 17:00"),
                ("Kaman", "Kaman Kalehöyük Arkeoloji Müzesi & Japon Bahçesi", "Japonya Ortadoğu Kültür Merkezi iş birliğiyle kurulan ödüllü müze ve göletli bahçe.", 33.788900, 39.355800, "08:30 - 18:00"),
                ("Kırşehir", "Ahi Evran Müzesi ve Türbesi", "Ahilik teşkilatının kurucusu Ahi Evran-ı Veli külliyesi ve 32 esnaf kolu sergisi.", 34.161100, 39.148300, "08:00 - 19:00"),
                ("Kırşehir", "Neşet Ertaş Gönül Sultanları Kültür Evi", "Bozkırın Tezenesi Neşet Ertaş ve Abdal müzik geleneğinin ses ve enstrüman müzesi.", 34.156700, 39.142800, "09:00 - 18:00"),
                ("Kırşehir", "Cacabey Medresesi Gökbilim Müze Alanı", "1272 yılında Selçuklular tarafından kurulan dünyanın ilk astronomi rasathanesi.", 34.159700, 39.146700, "08:30 - 18:30"),

                // 41. KOCAELİ
                ("Kocaeli", "Kocaeli Arkeoloji ve Etnografya Müzesi", "Tarihi tren garı ambarlarında Nikomedia Roma başkenti heykelleri ve lahitleri.", 29.918900, 40.763900, "08:30 - 17:30"),
                ("Kocaeli", "Gayret Gemi Müzesi (İzmit Marina)", "Türk Deniz Kuvvetleri'nin efsanevi muhribi TCG Gayret yüzer müzesi.", 29.914400, 40.758300, "09:00 - 17:00"),
                ("Kocaeli", "Kasr-ı Hümayun Saray Müzesi (Sultan Abdülaziz Av Köşkü)", "İstanbul dışındaki tek Osmanlı saray köşkü, neobarok mermer şaheser.", 29.923300, 40.761700, "09:00 - 17:00"),
                ("Kocaeli", "Seka Kağıt Müzesi", "Türkiye'nin ilk kağıt fabrikasında kağıdın serüveni ve endüstriyel miras.", 29.908900, 40.761100, "09:00 - 17:30"),
                ("Kocaeli", "Osman Hamdi Bey Evi ve Müzesi (Eskihisar)", "Kaplumbağa Terbiyecisi ressamı Osman Hamdi Bey'in tarihi sahil köşkü.", 29.430600, 40.771400, "09:00 - 17:00"),

                // 42. KONYA
                ("Konya", "Mevlana Müzesi ve Dergahı", "Hz. Mevlana Celaleddin-i Rumi'nin Kubbe-i Hadra altındaki türbesi ve derviş hücreleri.", 32.505000, 37.870800, "09:00 - 18:30"),
                ("Konya", "Karatay Medresesi Çini Eserler Müzesi", "Selçuklu çini sanatının zirvesi, mozaik kubbesi ve Kubadabad Sarayı çinileri.", 32.493100, 37.875300, "09:00 - 17:30"),
                ("Konya", "İnce Minareli Medrese Taş ve Ahşap Eserler Müzesi", "Selçuklu taç kapı taş işçiliğinin başyapıtı ve çift başlı kartal kabartmaları.", 32.491400, 37.872800, "09:00 - 17:30"),
                ("Konya", "Konya Arkeoloji Müzesi", "Neolitik, Kalkolitik, Roma dönemi lahitleri ve Herakles çelenkli lahdi.", 32.495800, 37.868300, "08:30 - 17:00"),
                ("Konya", "Çatalhöyük Neolitik Kenti Açık Hava Müzesi (Çumra)", "UNESCO Dünya Mirası 9000 yıllık ilk kentsel yerleşim ve kerpiç evler.", 32.828300, 37.667500, "09:00 - 18:00"),

                // 43. KÜTAHYA
                ("Kütahya", "Kütahya Çini Müzesi (Germiyan Beyi İshak Fakih Medresesi)", "14. yüzyıldan günümüze Kütahya çinicilik ve seramik sanatı şaheserleri.", 29.975800, 39.418300, "08:30 - 17:30"),
                ("Kütahya", "Kütahya Arkeoloji Müzesi (Vacidiye Medresesi)", "Aizanoi Amazonlar lahdi, Paleolitik ve Roma dönemi heykelleri.", 29.975000, 39.418900, "08:30 - 17:30"),
                ("Kütahya", "Aizanoi Antik Kenti Açık Hava Müzesi (Çavdarhisar)", "Dünyanın en iyi korunmuş Zeus Tapınağı ve ilk borsa yapısı.", 29.610800, 39.200800, "08:30 - 19:00"),
                ("Kütahya", "Dumlupınar Kurtuluş Savaşı Müzesi", "Başkomutan Meydan Muharebesi'nin kazanıldığı topraklarda zafer müzesi.", 30.011700, 38.868300, "08:30 - 17:00"),
                ("Kütahya", "Kossuth Evi Müzesi (Macar Evi)", "Macaristan Özgürlük Lideri Lajos Kossuth'un 1850-1851 yıllarında yaşadığı tarihi konak.", 29.972200, 39.416700, "08:30 - 17:30"),

                // 44. MALATYA
                ("Malatya", "Arslantepe Höyüğü Açık Hava Müzesi (Battalgazi)", "UNESCO Dünya Mirası dünyanın en eski kerpiç sarayı ve ilk devlet bürokrasisi.", 38.361400, 38.380800, "08:30 - 19:00"),
                ("Malatya", "Malatya Arkeoloji Müzesi", "Karakaya Barajı kurtarma kazıları, Hitit kabartmaları ve Neolitik mühürler.", 38.315600, 38.351700, "08:30 - 17:00"),
                ("Malatya", "Malatya Fotoğraf Makineleri Müzesi (Sanat Sokağı)", "Türkiye ve Asya'nın en büyük tarihi fotoğraf makineleri koleksiyonu.", 38.313900, 38.348900, "09:00 - 18:00"),
                ("Malatya", "Beşkonaklar Etnografya Müzesi", "Geleneksel Malatya sivil mimarisi, yöresel halılar ve kayısıcılık tarihi.", 38.320300, 38.357200, "08:30 - 17:00"),
                ("Malatya", "Malatya Kent Müzesi ve Kültür Evi", "Tarihi Askerlik Şubesi binasında Malatya'nın Cumhuriyet tarihi ve kültürü.", 38.318300, 38.355600, "09:00 - 17:30"),

                // 45. MANİSA
                ("Manisa", "Sardes Antik Kenti ve Sinagogu Açık Hava Müzesi (Salihli)", "Lidya Krallığı başkenti, ilk madeni paranın basıldığı yer ve anıtsal Sinagog.", 28.040300, 38.488300, "08:30 - 19:00"),
                ("Manisa", "Manisa Arkeoloji ve Etnografya Müzesi (Muradiye Külliyesi)", "Mimar Sinan eseri tarihi medresede Lidya mezar stelleri ve Roma mozaikleri.", 27.430600, 38.614200, "08:30 - 17:30"),
                ("Manisa", "Akhisar Arkeoloji ve Etnografya Müzesi", "Thyateira antik kenti kalıntıları, Tepe Mezarlığı ve zeytin kültürü.", 27.838900, 38.921400, "08:30 - 17:30"),
                ("Manisa", "Kula Tarihi Evleri Kenan Evren Etnografya Müzesi", "UNESCO Jeoparkı Kula'da geleneksel Osmanlı ahşap konak mimarisi.", 28.648900, 38.547200, "09:00 - 17:00"),
                ("Manisa", "Şehzadeler Müzesi Manisa", "Osmanlı'da Manisa'da sancak beyliği yapmış Fatih ve Kanuni heykelleri.", 27.428900, 38.612800, "09:00 - 18:00"),

                // 46. KAHRAMANMARAŞ
                ("Kahramanmaraş", "Kahramanmaraş Arkeoloji Müzesi", "Maraş Fili fosilleri, Geç Hitit Domuztepe buluntuları ve Germenicia mozaikleri.", 36.924200, 37.575000, "08:30 - 17:30"),
                ("Kahramanmaraş", "Kahramanmaraş Kurtuluş Destanı Panoraması Müzesi", "Sütçü İmam ve Rıdvan Hoca öncülüğünde Fransız işgaline karşı destansı direniş.", 36.931700, 37.585600, "09:00 - 18:00"),
                ("Kahramanmaraş", "Yedi Güzel Adam Edebiyat Müzesi", "Tarihi Gazipaşa İlkokulu'nda Cahit Zarifoğlu, Sezai Karakoç ve Maraş edebiyatı.", 36.928300, 37.581700, "09:00 - 17:30"),
                ("Kahramanmaraş", "Dondurma Müzesi (Katip Han)", "Dünyaca ünlü dövme Maraş dondurmasının tarihi, salep ve keçi sütü kültürü.", 36.926700, 37.583300, "09:00 - 18:00"),
                ("Kahramanmaraş", "Mutfak Kültürü Müzesi (Dedeoğlu Konağı)", "Geleneksel Maraş mutfağı, bakırcılık ve ahşap oymacılık eserleri.", 36.925000, 37.580800, "09:00 - 17:30"),

                // 47. MARDİN
                ("Mardin", "Mardin Müzesi (Tarihi Süryani Patrikhanesi)", "Kuzey Mezopotamya arkeolojisi, altın takılar ve Artuklu sikkeleri.", 40.738900, 37.313900, "08:30 - 19:00"),
                ("Mardin", "Sakıp Sabancı Mardin Kent Müzesi", "Eski Süvari Kışlası binasında Mardin'in çok dilli, çok dinli tarihi ve fotoğraf galerisi.", 40.734700, 37.311700, "09:00 - 17:30"),
                ("Mardin", "Dara Antik Kenti ve Nekropol Açık Hava Müzesi", "Doğu Roma garnizon kenti, devasa su sarnıçları ve kaya mezarları nekropolü.", 40.954200, 37.181400, "08:30 - 19:00"),
                ("Mardin", "Mardin Kasımiye Medresesi Müze Alanı", "Artuklu taş işçiliği, hayat havuzu felsefesi ve astronomi rasathanesi.", 40.721400, 37.307200, "08:30 - 18:30"),
                ("Mardin", "Midyat Kent Müzesi ve Kültür Evi", "Tarihi taş konakta Süryani telkari gümüş sanatı ve Midyat taş ustalığı.", 41.338900, 37.416700, "09:00 - 18:00"),

                // 48. MUĞLA
                ("Muğla", "Bodrum Sualtı Arkeoloji Müzesi (Bodrum Kalesi)", "Uluburun Batığı, Karya Prensesi Ada mezarı ve dünyanın en zengin batık müzesi.", 27.429700, 37.031900, "08:30 - 22:00"),
                ("Muğla", "Marmaris Kalesi ve Arkeoloji Müzesi", "Kanuni Sultan Süleyman dönemi kalesinde Knidos, Burgaz ve Hisarönü buluntuları.", 28.274200, 36.850800, "08:30 - 19:00"),
                ("Muğla", "Fethiye Arkeoloji Müzesi", "Likya Trilingual Dikmesi, Tlos ve Kaunos antik kentleri heykelleri.", 29.115800, 36.621400, "08:30 - 17:30"),
                ("Muğla", "Knidos Antik Kenti Açık Hava Müzesi (Datça)", "Ege ile Akdeniz'in birleştiği burunda Afrodit Heykeli ve antik deniz feneri.", 27.375000, 36.685800, "08:30 - 20:00"),
                ("Muğla", "Muğla Müzesi (Eski Cezaevi)", "Özlüce Köyü doğa tarihi 9 milyon yıllık hayvan fosilleri ve Muğla bacaları.", 28.365300, 37.218100, "08:30 - 17:30"),

                // 49. MUŞ
                ("Muş", "Muş Kent Müzesi (Tarihi Yıldızlı Han)", "Tarihi İpek Yolu hanında Muş lalesi, dengbejlik kültürü ve yöresel zanaatlar.", 41.491700, 38.736100, "08:30 - 17:00"),
                ("Muş", "Tarihi Murat Köprüsü Kültür ve Sergi Alanı", "Selçuklu dönemi 12 gözlü tarihi taş köprü ve rekreasyon alanı.", 41.530600, 38.783300, "08:00 - 20:00"),
                ("Muş", "Malazgirt 1071 Zafer Anıtı ve Müzesi", "Sultan Alparslan'ın Anadolu kapılarını açtığı tarihi zafer anıtı ve harp sergisi.", 42.544400, 39.147200, "08:30 - 17:30"),
                ("Muş", "Muş Etnografya Evi", "Geleneksel Muş ev eşyaları, dokuma kilimleri ve folklorik miras.", 41.488900, 38.734700, "09:00 - 17:00"),
                ("Muş", "Arak Manastırı Tarihi Sergi Alanı", "Karaçavuş Dağları eteklerinde 4. yüzyıl erken dönem Hristiyanlık manastırı.", 41.611100, 38.705600, "09:00 - 17:00"),

                // 50. NEVŞEHİR
                ("Nevşehir", "Göreme Açık Hava Müzesi", "UNESCO Dünya Mirası Karanlık Kilise, Tokalı Kilise ve Kapadokya kaya freskleri.", 34.829400, 38.640300, "08:00 - 19:00"),
                ("Nevşehir", "Zelve Açık Hava Müzesi", "Üç vadiden oluşan peribacaları içinde manastırlar, cami ve kaya yerleşimleri.", 34.863900, 38.669400, "08:00 - 19:00"),
                ("Nevşehir", "Hacıbektaş Veli Müzesi", "Hacı Bektaş-ı Veli Külliyesi, Balım Evi, Aşevi ve Bektaşilik kültür merkezi.", 34.561100, 38.943900, "08:30 - 18:00"),
                ("Nevşehir", "Derinkuyu Yeraltı Şehri Müzesi", "8 katlı, 20.000 kişiyi barındırabilecek havalandırma bacalı dev yer altı sığınağı.", 34.735000, 38.373600, "08:00 - 19:00"),
                ("Nevşehir", "Nevşehir Arkeoloji ve Etnografya Müzesi", "Kapadokya bölgesinin Neolitik, Helenistik ve Osmanlı dönemi buluntuları.", 34.715300, 38.625800, "08:30 - 17:00"),

                // 51. NİĞDE
                ("Niğde", "Niğde Arkeoloji Müzesi", "Nahita antik kenti, Sarıkaya sarayı, Çaydırlı Mumyası ve Geç Hitit stelleri.", 34.678900, 37.968900, "08:30 - 17:30"),
                ("Niğde", "Gümüşler Manastırı Açık Hava Müzesi", "Dünyada tek 'Gülen Meryem' freskine sahip kaya oyması anıtsal manastır.", 34.770800, 37.988900, "08:30 - 19:00"),
                ("Niğde", "Niğde Kalesi ve Saat Kulesi Müze Alanı", "Alaaddin Tepesi'nde Selçuklu kalesi ve Ziya Paşa'nın yaptırdığı tarihi saat kulesi.", 34.675600, 37.965800, "08:00 - 19:00"),
                ("Niğde", "Tyana Antik Kenti ve Su Kemerleri (Bor)", "Filozof Apollonius'un memleketi Roma dönemi anıtsal su kemerleri müzesi.", 34.611100, 37.891700, "08:30 - 18:00"),
                ("Niğde", "Niğde Kültür ve Sanat Evi (Cullaz Sokağı)", "Tarihi Cullaz mahallesinde restore edilen geleneksel Niğde konakları.", 34.676700, 37.967200, "09:00 - 17:00"),

                // 52. ORDU
                ("Ordu", "Ordu Paşaoğlu Konağı Etnografya Müzesi", "1896 yapımı 3 katlı tarihi konakta Karadeniz silahları ve ahşap oymacılığı.", 37.876700, 40.985600, "08:30 - 17:30"),
                ("Ordu", "Ordu Taşbaşı Sanat Alanı ve Kültür Merkezi", "Tarihi Rum Kilisesi binasında Karadeniz resim ve heykel sergileri.", 37.873300, 40.988900, "09:00 - 18:00"),
                ("Ordu", "Ünye Yaşayan Kültür Mirası Müzesi (Kaptanlar Konağı)", "Geleneksel çocuk oyunları, meddahlık ve Ünye denizcilik kültürü.", 37.288900, 41.127800, "09:00 - 18:00"),
                ("Ordu", "Kurul Kalesi Arkeolojik Kazı Alanı & Müzesi", "Doğu Karadeniz'in ilk arkeolojik kazısı, mermer Kybele Ana Tanrıça Heykeli.", 37.838900, 40.905600, "08:30 - 18:30"),
                ("Ordu", "Fatsa Cıngırt Kalesi Açık Hava Müzesi", "Mithridates dönemi kayaya oyulmuş gizli su tünelleri ve antik gözetleme kulesi.", 37.472200, 41.011100, "09:00 - 17:30"),

                // 53. RİZE
                ("Rize", "Rize Müzesi (Sarı Ev)", "19. yüzyıl geleneksel Doğu Karadeniz taş-ahşap mimarisi ve etnografik zenginlik.", 40.518900, 41.026700, "08:30 - 17:00"),
                ("Rize", "Rize Atatürk Evi Müzesi (Mehmet Mataracı Konağı)", "Mustafa Kemal Atatürk'ün Rize ziyaretinde kaldığı tarihi sahil konağı.", 40.512200, 41.023300, "08:30 - 17:00"),
                ("Rize", "Zilkale Tarihi ve Açık Hava Müzesi (Çamlıhemşin)", "Fırtına Vadisi'nde sarp kayalık üzerinde yükselen görkemli Orta Çağ kalesi.", 40.962200, 40.957500, "08:30 - 19:00"),
                ("Rize", "Çayeli Ahmet Hamdi İshakoğlu Doğal Yaşam Müzesi", "Rize çay tarımı, denizcilik ve Karadeniz ahşap tekne yapım kültürü.", 40.727800, 41.088900, "09:00 - 17:30"),
                ("Rize", "Fındıklı Tarihi Taş Konaklar Kültür Evi", "Fındıklı ilçesinde taş dolgulu tarihi Laz konakları ve serenderler sergisi.", 41.144400, 41.272200, "09:00 - 17:30"),

                // 54. SAKARYA
                ("Sakarya", "Sakarya Müzesi (Atatürk Evi)", "Mustafa Kemal Atatürk'ün annesi Zübeyde Hanım ile buluştuğu tarihi konak.", 30.404200, 40.774400, "08:30 - 17:30"),
                ("Sakarya", "Sakarya Deprem Kültür Müzesi", "1999 Marmara Depremi anısına kurulan, sismik simülatörlü anma ve eğitim müzesi.", 30.398900, 40.773300, "09:00 - 17:00"),
                ("Sakarya", "Ali Fuat Paşa Kuvayi Milliye Müzesi (Geyve)", "Milli Mücadele Geyve Boğazı savunması kahramanı Ali Fuat Cebesoy'un müzesi.", 30.291700, 40.505600, "08:30 - 17:30"),
                ("Sakarya", "Taraklı Tarihi Konaklar Kültür Evi", "Sakin Şehir Taraklı'da Fenerli Ev ve geleneksel ahşap kaşıkçılık zanaatı.", 30.455600, 40.394400, "09:00 - 18:00"),
                ("Sakarya", "Justinianus Köprüsü (Beşköprü) Tarih Alanı", "Bizans İmparatoru Justinianus'un 559 yılında yaptırdığı 375 metrelik dev taş köprü.", 30.363900, 40.741700, "08:00 - 20:00"),

                // 55. SAMSUN
                ("Samsun", "Samsun Bandırma Vapuru ve Milli Mücadele Açık Hava Müzesi", "19 Mayıs 1919'da Mustafa Kemal Paşa ve kurmaylarını Samsun'a getiren vapur.", 36.360300, 41.280600, "08:30 - 18:30"),
                ("Samsun", "Samsun Gazi Müzesi (Mıntıka Palas)", "Atatürk'ün Samsun'a ayak bastığında konakladığı tarihi Mıntıka Palas Oteli.", 36.335300, 41.288900, "08:30 - 17:30"),
                ("Samsun", "Samsun Arkeoloji ve Etnografya Müzesi", "Amisos Hazineleri, Amazon heykelleri ve Helenistik som altın taçlar.", 36.330800, 41.285800, "08:30 - 19:00"),
                ("Samsun", "Samsun Kent Müzesi", "Avrupa'nın prestijli 'Yılın Müzesi' ödülüne aday gösterilmiş zengin şehir belleği.", 36.338900, 41.291700, "09:00 - 18:00"),
                ("Samsun", "Havza Atatürk Evi Müzesi", "Milli Mücadele'nin ilk genelgesi olan Havza Genelgesi'nin yazıldığı tarihi kaplıca konağı.", 35.658300, 40.977800, "08:30 - 17:30"),

                // 56. SİİRT
                ("Siirt", "Siirt Etnografya ve Kent Müzesi", "Siirt battaniyesi dokumacılığı, bakırcılık ve Siirt fıstığı üretim tarihi.", 41.944200, 37.928900, "08:30 - 17:00"),
                ("Siirt", "Tillo İsmail Fakirullah & İbrahim Hakkı Işık Müzesi", "Ekinoks günlerinde türbe başını aydınlatan dünyaca ünlü optik güneş düzeneği.", 42.016700, 37.950000, "08:00 - 18:00"),
                ("Siirt", "Veysel Karani Türbesi Kültür ve İnanç Müzesi (Baykan)", "İslam aleminin büyük velisi Veysel Karani Hazretleri türbesi ve müzesi.", 41.761100, 38.155600, "08:00 - 19:00"),
                ("Siirt", "Siirt Ulu Camii Tarihi Sergi Alanı", "1129 Selçuklu Çinili Minare şaheseri ve ahşap kündekari minber galerisi.", 41.948300, 37.931700, "08:00 - 19:00"),
                ("Siirt", "Botan Vadisi Milli Parkı Kültür Alanı", "Tarihi İpek Yolu köprüleri ve Rasıl Hacar Deliklitaş seyir terası.", 41.872200, 37.894400, "08:00 - 19:00"),

                // 57. SİNOP
                ("Sinop", "Tarihi Sinop Kapalı Cezaevi Müzesi", "Sebahattin Ali ve pek çok edebiyatçının kaldığı tarihi kale içi cezaevi.", 35.148900, 42.023300, "08:30 - 19:30"),
                ("Sinop", "Sinop Arkeoloji Müzesi", "Karadeniz ticaret kolonisi Sinope kenti amphoraları ve Filozof Diyojen sergisi.", 35.153900, 42.026700, "08:30 - 17:30"),
                ("Sinop", "Sinop Etnografya Müzesi (Aslan Torun Konağı)", "18. yüzyıl geleneksel Sinop burjuva ahşap konağı ve keten dokumaları.", 35.152200, 42.025600, "08:30 - 17:00"),
                ("Sinop", "Balatlar Kilisesi Açık Hava Müzesi", "Roma hamamı, Bizans kilisesi ve freskleriyle 2000 yıllık yapı kompleksi.", 35.155600, 42.028900, "08:30 - 18:00"),
                ("Sinop", "Boyabat Kalesi Açık Hava Tarih Alanı", "Gökırmak Vadisi üzerinde yükselen Paflagonya kaya mezarları ve kalesi.", 34.766700, 41.469400, "09:00 - 18:00"),

                // 58. SİVAS
                ("Sivas", "Sivas Atatürk Kongre ve Etnografya Müzesi", "4 Eylül 1919 Sivas Kongresi'nin toplandığı tarihi milli mücadele binası.", 37.015300, 39.748300, "08:30 - 18:00"),
                ("Sivas", "Divriği Ulu Camii ve Darüşşifası (Açık Hava Müzesi)", "UNESCO Dünya Mirası Anadolu'nun Elhamra'sı benzersiz taş işleme kapıları.", 38.125000, 39.373600, "08:30 - 19:00"),
                ("Sivas", "Sivas Buruciye Medresesi Müze Alanı", "1271 Selçuklu taş işçiliği başyapıtı ve hat sanatı sergi galerisi.", 37.016700, 39.747800, "09:00 - 19:00"),
                ("Sivas", "Sivas Çifte Minareli Medrese & Şifaiye Medresesi", "İlhanlı veziri Şemseddin Cüveyni eseri çinili minareler ve tıp tarihi.", 37.017500, 39.748100, "08:30 - 19:00"),
                ("Sivas", "Sivas Sanayi Mektebi Müzesi", "Tarihi Hamidiye Mektebi binasında Sivas zanaatları, halıcılık ve demircilik.", 37.012200, 39.745600, "09:00 - 17:30"),

                // 59. TEKİRDAĞ
                ("Tekirdağ", "Tekirdağ Arkeoloji ve Etnografya Müzesi", "Perinthos ve Heraion Teichos antik kentleri Trak Kralı mezar buluntuları.", 27.514400, 40.975800, "08:30 - 17:30"),
                ("Tekirdağ", "Rakoczi Müzesi", "Macaristan Ulusal Kahramanı II. Ferenc Rakoczi'nin sürgünde yaşadığı tarihi konak.", 27.518900, 40.973300, "09:00 - 17:00"),
                ("Tekirdağ", "Namık Kemal Evi Müzesi", "Vatan Şairi Namık Kemal'in anısına inşa edilen geleneksel Tekirdağ ahşap konağı.", 27.511700, 40.978300, "09:00 - 17:00"),
                ("Tekirdağ", "Çorlu Tarihi Belediye Binası Kent Müzesi", "Trakya'nın sanayi ve demiryolu tarihi ile Çorlu kültürel mirası.", 27.800300, 41.159400, "09:00 - 17:30"),
                ("Tekirdağ", "Şarköy Etnografya ve Kültür Evi", "Marmara Denizi kıyısında geleneksel bağcılık, zeytincilik ve balıkçılık tarihi.", 27.255600, 40.613900, "09:00 - 17:00"),

                // 60. TOKAT
                ("Tokat", "Tokat Müzesi (Arasta Bedesteni)", "Geleneksel Tokat yazmacılığı, Maşat Höyük Hitit tabletleri ve Roma sikkeleri.", 36.554200, 40.316700, "08:30 - 17:30"),
                ("Tokat", "Tokat Atatürk Evi ve Etnografya Müzesi", "Mustafa Kemal Atatürk'ün Tokat ziyaretlerinde konakladığı tarihi konak.", 36.552800, 40.318900, "08:30 - 17:00"),
                ("Tokat", "Tokat Latifoğlu Konağı Müzesi", "Barok ve Rokoko üslubunda tavan süslemeli 18. yüzyıl Osmanlı konağı.", 36.551400, 40.315000, "08:30 - 17:00"),
                ("Tokat", "Zile Kalesi Açık Hava Müzesi", "Jül Sezar'ın 'Veni, Vidi, Vici' (Geldim, Gördüm, Yendim) dediği tarihi kale.", 35.888900, 40.302800, "08:30 - 18:30"),
                ("Tokat", "Niksar Kalesi & Yağıbasan Medresesi Müze Alanı", "Anadolu'nun ilk tıp eğitimi veren Danişmentli medresesi ve kalesi.", 36.950000, 40.591700, "08:30 - 18:00"),

                // 61. TRABZON
                ("Trabzon", "Trabzon Ayasofya Müzesi", "13. yüzyıl Komnenos Hanedanı başyapıtı freskleri ve kabartmalı çan kulesi.", 39.696100, 41.002800, "08:30 - 19:00"),
                ("Trabzon", "Sümela Manastırı Açık Hava Müzesi (Maçka)", "Altındere Vadisi Karadağ sarp kayalıklarına oyulmuş 1600 yıllık manastır.", 39.658300, 40.690300, "08:00 - 19:30"),
                ("Trabzon", "Trabzon Atatürk Köşkü Müzesi (Soğuksu)", "Gazi Mustafa Kemal Paşa'nın mal varlığını milletine bağışladığı tarihi köşk.", 39.698900, 40.988900, "09:00 - 18:30"),
                ("Trabzon", "Trabzon Müzesi (Kostaki Konağı)", "Art Nouveau mimarili tarihi köşkte zengin arkeoloji ve etnografya sergisi.", 39.726700, 41.005600, "08:30 - 17:30"),
                ("Trabzon", "Trabzon Şehir Müzesi", "M.Ö. 2000'den günümüze Trabzon'un denizcilik, ticaret ve spor tarihi.", 39.724400, 41.004200, "09:00 - 18:00"),

                // 62. TUNCELİ
                ("Tunceli", "Tunceli Müzesi (Avrupa Müze Ödüllü Kışla Binası)", "Avrupa Müze Akademisi Luigi Micheletti ödüllü arkeoloji ve inanç kültürü müzesi.", 39.546700, 39.108300, "08:30 - 17:30"),
                ("Tunceli", "Çemişgezek İn Delikleri Kaya Evleri Açık Hava Müzesi", "Tahar Çayı kanyonunda dikey kayalıklara oyulmuş çok katlı Urartu odaları.", 38.916700, 39.066700, "08:30 - 18:00"),
                ("Tunceli", "Pertek Kalesi Tarihi Sergi Alanı", "Keban Baraj Gölü suları ortasında ada üzerinde yükselen tarihi kale.", 39.316700, 38.866700, "09:00 - 18:00"),
                ("Tunceli", "Mazgirt Kalesi Arkeolojik Kültür Alanı", "Urartu Kralı Rusa dönemi kaya kitabeleri ve Orta Çağ burçları.", 39.600000, 39.016700, "09:00 - 17:30"),
                ("Tunceli", "Munzur Gözeleri Doğa ve İnanç Kültür Alanı (Ovacık)", "Munzur Baba efsanesi ve 40 gözeden fışkıran kutsal su kaynakları.", 39.183300, 39.366700, "08:00 - 20:00"),

                // 63. ŞANLIURFA
                ("Şanlıurfa", "Göbeklitepe Ören Yeri Açık Hava Müzesi", "UNESCO Dünya Mirası 12.000 yıllık tarihin sıfır noktası T biçimli anıt tapınaklar.", 38.922500, 37.223100, "08:30 - 19:00"),
                ("Şanlıurfa", "Şanlıurfa Arkeoloji Müzesi", "Türkiye'nin en büyük müze kompleksi, Urfa Adamı ve Neolitik Çağ şaheserleri.", 38.783300, 37.155600, "08:30 - 19:00"),
                ("Şanlıurfa", "Haleplibahçe Mozaik Müzesi", "Savaşçı Amazon Kraliçeleri ve Orpheus mozaiği gibi nadide Roma taban eserleri.", 38.781400, 37.154200, "08:30 - 19:00"),
                ("Şanlıurfa", "Karahantepe Ören Yeri Kültür Alanı", "Taş Tepeler projesinin en önemli merkezi, insan başı heykelleri ve ritüel alanları.", 39.388900, 37.088900, "08:30 - 18:30"),
                ("Şanlıurfa", "Şanlıurfa Kurtuluş Müzesi (Mahmut Nedim Konağı)", "Onikiler Hareketi ve Fransız işgaline karşı 'Şanlı' direnişin tarihi.", 38.791700, 37.158300, "09:00 - 17:30"),

                // 64. UŞAK
                ("Uşak", "Uşak Arkeoloji Müzesi (Karun Hazineleri)", "Lidya Kralı Krezüs'e ait dünyaca ünlü Kanatlı Denizatı Broşu ve altın hazineler.", 29.404200, 38.675600, "08:30 - 17:30"),
                ("Uşak", "Uşak Atatürk ve Etnografya Müzesi", "Yunan Orduları Başkomutanı Trikupis'in kılıcını Atatürk'e teslim ettiği tarihi konak.", 29.401400, 38.678300, "08:30 - 17:00"),
                ("Uşak", "Blaundus Antik Kenti Açık Hava Müzesi (Ulubey)", "Kanyonlarla çevrili yarımada üzerinde Makedon krallığı tapınakları ve tiyatrosu.", 29.355600, 38.358300, "08:30 - 19:00"),
                ("Uşak", "Uşak Kent Tarihi Müzesi", "Türkiye'nin ilk elektrik kullanan kenti Uşak'ın sanayi ve halıcılık geçmişi.", 29.405600, 38.676700, "09:00 - 17:30"),
                ("Uşak", "Ulubey Kanyonları Açık Hava Doğa ve Tarih Alanı", "Dünyanın en uzun ikinci kanyonu ve antik kaya mezarları parkuru.", 29.288900, 38.419400, "08:30 - 19:30"),

                // 65. VAN
                ("Van", "Van Müzesi (Van Kalesi Yanı)", "Urartu Krallığı başkenti Tuşpa'nın dünyadaki en zengin çivi yazılı tablet ve bronz koleksiyonu.", 43.340300, 38.502800, "08:30 - 19:00"),
                ("Van", "Akdamar Kilisesi ve Adası Açık Hava Müzesi (Gevaş)", "Van Gölü ortasında 10. yüzyıl Vaspurakan krallığı dış cephe taş kabartmaları.", 43.036700, 38.340300, "08:30 - 19:00"),
                ("Van", "Tarihi Van Kalesi & Tuşpa Antik Kenti", "Kral I. Sarduri'nin kurduğu sarp kaya kalesi, Urartu kral mezarları ve Analı Kız.", 43.344400, 38.501400, "08:30 - 19:00"),
                ("Van", "Çavuştepe Kalesi Urartu Açık Hava Müzesi (Gürpınar)", "Kral II. Sarduri'nin inşa ettirdiği saray, Haldi Tapınağı ve taş kanalizasyon.", 43.458300, 38.352800, "08:30 - 18:00"),
                ("Van", "Hoşap Kalesi Tarih ve Kültür Müzesi (Güzelsu)", "Sarp kayalık üzerine Mahmudi Beyleri tarafından kurulan görkemli şato kale.", 43.801400, 38.318900, "09:00 - 18:00"),

                // 66. YOZGAT
                ("Yozgat", "Yozgat Müzesi (Nizamoğlu Konağı)", "19. yüzyıl geleneksel ahşap tavan süslemeli konak ve Roma heykelleri.", 34.808900, 39.821400, "08:30 - 17:00"),
                ("Yozgat", "Sarıkaya Roma Hamamı (Basilica Therma) Açık Hava Müzesi", "2000 yıldır kesintisiz şifalı termal suyu kaynayan eşsiz Roma mimarisi.", 35.377800, 39.494400, "08:30 - 18:30"),
                ("Yozgat", "Yozgat Karslıoğlu Konağı Kültür Müzesi", "Mustafa Kemal Atatürk'ün Yozgat ziyaretinde kaldığı tarihi Osmanlı konağı.", 34.805600, 39.819400, "09:00 - 17:00"),
                ("Yozgat", "Çamlık Milli Parkı Doğa Evi Müzesi", "Türkiye'nin ilan edilen ilk milli parkında endemik karaçam florası sergisi.", 34.816700, 39.811100, "08:00 - 19:00"),
                ("Yozgat", "Çengeltepe Höyüğü ve Arkeoloji Sergi Alanı", "Hitit ve Frig katmanları buluntularının sergilendiği tarihi ören yeri.", 34.811100, 39.824200, "09:00 - 17:30"),

                // 67. ZONGULDAK
                ("Zonguldak", "Zonguldak Maden Müzesi", "Türkiye'nin ilk ve tek taş kömürü madencilik tarihi müzesi ve eğitim ocağı.", 31.798900, 41.448900, "09:00 - 17:30"),
                ("Zonguldak", "Kdz. Ereğli Müzesi (Halil Paşa Konağı)", "19. yüzyıl konağında Herakleia Pontika antik kenti büstleri ve mezar stelleri.", 31.417800, 41.282800, "08:30 - 17:30"),
                ("Zonguldak", "Cehennemağzı Mağaraları Arkeolojik Açık Hava Müzesi", "Mitolojide Herakles'in üç başlı köpek Kerberos'u yakaladığı kutsal mağaralar.", 31.428900, 41.291700, "08:30 - 19:00"),
                ("Zonguldak", "Filyos Tios Antik Kenti Açık Hava Müzesi", "Karadeniz'in Efes'i olarak adlandırılan antik tiyatro, su kemerleri ve akropol.", 32.022200, 41.569400, "08:30 - 18:30"),
                ("Zonguldak", "Çanakçılar Arkeoloji ve Etnografya Müzesi (Gökçebey)", "Özel fabrikada kurulan zengin doğa tarihi, fosil ve seramik koleksiyonu.", 32.148900, 41.311100, "09:00 - 17:00"),

                // 68. AKSARAY
                ("Aksaray", "Aksaray Müzesi (Yeni Müze Kompleksi)", "Aşıklı Höyük kafatası ameliyatı buluntuları, çocuk mumyaları ve Roma lahitleri.", 34.026700, 38.371400, "08:30 - 17:30"),
                ("Aksaray", "Ihlara Vadisi Açık Hava Müzesi", "Melendiz Çayı boyunca uzanan 14 kilometrelik kanyonda kaya oyması freskli kiliseler.", 34.298900, 38.253600, "08:00 - 19:00"),
                ("Aksaray", "Güzelyurt Manastır Vadisi ve Yeraltı Şehri Müzesi", "Aziz Gregorius Theologos kilisesi, kaya evleri ve yer altı yerleşimi.", 34.375000, 38.277800, "08:30 - 18:30"),
                ("Aksaray", "Sultanhanı Kervansarayı Tarih Müzesi", "Selçuklu Sultanı I. Alaeddin Keykubad'ın yaptırdığı Anadolu'nun en büyük kervansarayı.", 33.546700, 38.246700, "08:30 - 18:30"),
                ("Aksaray", "Aşıklı Höyük Arkeoloji Açık Hava Müzesi (Gülağaç)", "10.500 yıllık Orta Anadolu'nun ilk köy yerleşimi ve beyin cerrahisi tarihi.", 34.228900, 38.347200, "09:00 - 17:30"),

                // 69. BAYBURT
                ("Bayburt", "Baksı Müzesi (Bayraktar Köyü)", "Avrupa Konseyi Müze Ödüllü Çoruh Vadisi tepesinde çağdaş sanat ve geleneksel zanaat.", 40.569400, 40.388900, "10:00 - 18:00"),
                ("Bayburt", "Kenan Yavuz Etnografya Müzesi (Beşpınar Köyü)", "Avrupa Silletto Ödüllü köy yerleşkesinde tandırlık, bezirhane ve köy odaları.", 40.452800, 40.158300, "10:00 - 18:00"),
                ("Bayburt", "Bayburt Kalesi Tarihi Açık Hava Müzesi", "Çoruh Nehri kıyısında sarp kayalıkta Dede Korkut destanlarına konu olan 'Çinimaçin' Kalesi.", 40.222200, 40.261100, "08:30 - 19:00"),
                ("Bayburt", "Dede Korkut Kümbeti Kültür Alanı (Masat)", "Türk dünyasının büyük bilgesi Dede Korkut anısına yapılan türbe ve anıt alanı.", 40.483300, 40.233300, "09:00 - 18:00"),
                ("Bayburt", "Bayburt Aydıntepe Yeraltı Şehri Müzesi", "Tüf kayalara oyulmuş galerileri, odaları ve havalandırma bacalarıyla tarihi sığınak.", 40.155600, 40.388900, "08:30 - 17:30"),

                // 70. KARAMAN
                ("Karaman", "Karaman Müzesi (Hatuniye Medresesi Arkası)", "Canhasan Höyüğü Kalkolitik buluntuları, Manazan Mumyası ve altın sikkeler.", 33.218900, 37.181400, "08:30 - 17:00"),
                ("Karaman", "Karaman Kalesi Açık Hava Müze Alanı", "Karamanoğulları Beyliği başkenti iç kalesi ve açık hava etkinlik tiyatrosu.", 33.214400, 37.184700, "08:30 - 18:30"),
                ("Karaman", "Manazan Mağaraları Kaya Yerleşimi Müzesi (Taşkale)", "Yeşildere Kanyonu'nda 5 katlı sarp kaya kireçtaşı yerleşimi.", 33.616700, 37.166700, "09:00 - 18:00"),
                ("Karaman", "Tartan Evi Etnografya Müzesi", "1810 yılı yapımı Osmanlı ahşap süsleme sanatının seçkin örneği tarihi konak.", 33.216700, 37.178900, "08:30 - 17:00"),
                ("Karaman", "Madenşehri & Dehle Binbirkilise Açık Hava Müzesi", "Karadağ eteklerinde 4.-9. yüzyıllar arasına tarihlenen Bizans bazilikaları.", 33.155600, 37.427800, "09:00 - 18:00"),

                // 71. KIRIKKALE
                ("Kırıkkale", "Kırıkkale MKE Silah Sanayi Müzesi", "Osmanlı ve Cumhuriyet dönemi ateşli silahları, kılıçları ve Tophane koleksiyonu.", 33.513900, 39.842200, "09:00 - 17:00"),
                ("Kırıkkale", "Tarihi Çeşnigir Köprüsü ve Kanyonu Açık Hava Müzesi", "Kızılırmak üzerinde Selçuklu Sultanı I. Alaeddin Keykubad eseri tarihi taş köprü.", 33.438900, 39.588900, "08:00 - 20:00"),
                ("Kırıkkale", "Kralların Ressamı Rahmi Pehlivanlı Müze Evi (Keskin)", "Dünya kralları ve liderlerinin portrelerini çizen ünlü ressamın tarihi evi.", 33.583300, 39.672200, "09:00 - 17:30"),
                ("Kırıkkale", "Hacı Taşan Kültür Merkezi ve Taş Mektep Etnografya Evi", "Keskin Abdal geleneği ve halk ozanı Hacı Taşan anısına düzenlenen kültür evi.", 33.585600, 39.674400, "09:00 - 17:30"),
                ("Kırıkkale", "Kırıkkale Kent Tarihi ve Etnografya Sergi Alanı", "Cumhuriyetin sanayi şehri Kırıkkale'nin kuruluşu ve demir-çelik mirası.", 33.508900, 39.845600, "09:00 - 17:00"),

                // 72. BATMAN
                ("Batman", "Batman Müzesi ve Müze Parkı", "Ilısu Barajı kurtarma kazıları, Gre Fılla, Başur Höyük oyun taşları ve heykeller.", 41.130600, 37.887800, "08:30 - 17:30"),
                ("Batman", "Hasankeyf Arkeoloji Müzesi ve Tarihi Ören Yeri", "Dicle kıyısında Artuklu, Eyyubi ve Roma dönemlerine ait taş köprü ve saray kalıntıları.", 41.413900, 37.714400, "08:30 - 19:00"),
                ("Batman", "Malabadi Köprüsü Tarih ve Kültür Parkı", "1147 Artuklu şaheseri dünyanın en geniş kemer açıklığına sahip taş köprüsü.", 41.204200, 38.154200, "08:00 - 19:30"),
                ("Batman", "Mor Kiryakus Manastırı İnanç ve Kültür Alanı (Beşiri)", "Tur Abdin bölgesinin en uç noktasında 5. yüzyıl Süryani Ortodoks manastırı.", 41.350000, 37.883300, "09:00 - 17:30"),
                ("Batman", "Batman Kültür ve Sanat Evi", "Geleneksel Kürt ve bölge etnografyası, kilim dokumacılığı ve folklor sergisi.", 41.127800, 37.885600, "09:00 - 17:00"),

                // 73. ŞIRNAK
                ("Şırnak", "İsmail Ebul-İz El-Cezeri Müzesi ve Kültür Evi (Cizre)", "Sibernetiğin ve robotik biliminin babası El-Cezeri'nin su saatleri ve mekanik icatları.", 42.188900, 37.327800, "08:30 - 17:30"),
                ("Şırnak", "Kırmızı Medrese Tarih ve İnanç Müzesi (Cizre)", "14. yüzyıl Cizre Beyliği döneminde kırmızı tuğlalardan inşa edilen ilim merkezi.", 42.186700, 37.325600, "08:30 - 18:00"),
                ("Şırnak", "Hz. Nuh Türbesi ve Cami Külliyesi Müze Alanı (Cizre)", "Büyük tufandan sonra Cudi Dağı eteğinde Hz. Nuh Peygamber'in kabri.", 42.191700, 37.330600, "08:00 - 19:00"),
                ("Şırnak", "Finik Kalesi ve Kaya Evleri Açık Hava Müzesi (Güçlükonak)", "Dicle Nehri vadisinde kayalara oyulmuş saray, zindan ve su sarnıçları.", 42.066700, 37.516700, "09:00 - 17:30"),
                ("Şırnak", "Kasrik Boğazı Tarihi Kaya Kabartmaları Sergi Alanı", "Cudi ve Gabar dağları arasında Part ve Sasani kaya kabartmaları.", 42.366700, 37.416700, "08:30 - 18:00"),

                // 74. BARTIN
                ("Bartın", "Bartın Kent Müzesi (Eski Hükümet Konağı)", "Tarihi ahşap gemi yapımcılığı (Çektirme) ve Bartın tel kırma gümüş işlemeciliği.", 32.337500, 41.635800, "09:00 - 17:30"),
                ("Bartın", "Amasra Arkeoloji Müzesi", "Sesamos antik kenti Helenistik heykelleri, Roma denizcilik buluntuları ve lahitler.", 32.386700, 41.748300, "08:30 - 17:30"),
                ("Bartın", "Amasra Kalesi ve Şapel Tarih Müzesi", "Ceneviz armaları, Kemere Köprüsü ve Fatih Sultan Mehmet'in fethettiği kale.", 32.384400, 41.749700, "08:00 - 19:30"),
                ("Bartın", "Kemal Samancıoğlu Etnografya Müzesi", "18. yüzyıl geleneksel ahşap Bartın konağında yöresel ev yaşamı sergisi.", 32.339200, 41.637200, "09:00 - 17:00"),
                ("Bartın", "Güzelcehisar Lav Sütunları Açık Hava Doğa Müzesi", "80 milyon yıllık volkanik soğuma sonucu oluşan dev bazalt sütunlar.", 32.233300, 41.683300, "08:00 - 20:00"),

                // 75. ARDAHAN
                ("Ardahan", "Ardahan Kalesi Tarihi ve Açık Hava Sergi Alanı", "Kura Nehri kıyısında Kanuni Sultan Süleyman dönemi görkemli taş tahkimatı.", 42.704200, 41.112800, "08:30 - 19:00"),
                ("Ardahan", "Şeytan Kalesi Arkeolojik Kültür Müzesi (Çıldır)", "Karaçay Kanyonu'nda sarp kayalık tepeye kondurulmuş Urartu kalesi.", 43.158300, 41.155600, "08:30 - 19:00"),
                ("Ardahan", "Çıldır Gölü Aşık Şenlik Kültür ve Doğa Evi", "Doğu Anadolu aşıklık geleneği piri Aşık Şenlik ve Çıldır göl ekolojisi.", 43.216700, 41.050000, "09:00 - 18:00"),
                ("Ardahan", "Hamşioğlu Rasim Bey Konağı Kültür Evi", "1919 Ardahan Kongreleri'nin toplandığı tarihi Baltık mimarili bina.", 42.701400, 41.110600, "09:00 - 17:00"),
                ("Ardahan", "Dursun Akçam Kültür Evi ve Edebiyat Müzesi", "Köy Enstitüleri ve Ardahan edebiyat geleneğini yaşatan kültür merkezi.", 42.698900, 41.108300, "09:30 - 17:30"),

                // 76. IĞDIR
                ("Iğdır", "Iğdır Soykırım Anıtı ve Müzesi", "Türkiye'nin en yüksek anıtı, 1915-1920 Doğu Anadolu tarihi belgeleri sergisi.", 44.045800, 39.921400, "08:30 - 17:00"),
                ("Iğdır", "Tuzluca Tuz Mağaraları Sağlık ve Sanat Müzesi", "55 dönümlük tarihi yer altı kaya tuzu mağaralarında ışık ve heykel galerisi.", 43.655600, 40.041700, "08:30 - 18:00"),
                ("Iğdır", "Selçuklu Kervansarayı Müze Alanı (Harmandöven)", "12. yüzyıl İpek Yolu üzerinde yer alan tarihi taş kervansaray.", 43.838900, 39.816700, "09:00 - 17:30"),
                ("Iğdır", "Tarihi Karakale Ören Yeri Açık Hava Alanı", "Aras Nehri kıyısında Urartu ve Orta Çağ sınır tahkimatı kalıntıları.", 43.683300, 40.066700, "09:00 - 17:00"),
                ("Iğdır", "Iğdır Kültür ve Etnografya Evi", "Ağrı Dağı eteklerinde geleneksel halı dokumacılığı ve kentin ziraat tarihi.", 44.041700, 39.923600, "09:00 - 17:00"),

                // 77. YALOVA
                ("Yalova", "Yalova Yürüyen Köşk Müzesi (Atatürk Köşkü)", "Atatürk'ün ulu bir çınar ağacının dalını kesmemek için raylar üzerinde kaydırdığı köşk.", 29.288900, 40.661100, "09:00 - 18:30"),
                ("Yalova", "İbrahim Müteferrika Kağıt Müzesi", "İlk Türk matbaacısı İbrahim Müteferrika anısına geleneksel el yapımı kağıt müzesi.", 29.261100, 40.648300, "09:00 - 17:00"),
                ("Yalova", "Yalova Kent Müzesi", "Hükümet Meydanı'nda kentin kaplıca tarihi, çiçekçilik ve Atatürk'ün Yalova günleri.", 29.274200, 40.655600, "09:00 - 17:30"),
                ("Yalova", "Yalova Açık Hava Arkeoloji Müzesi", "Roma, Bizans ve Osmanlı dönemi lahitleri, stelleri ve sütun başlıkları.", 29.271400, 40.653900, "08:30 - 17:30"),
                ("Yalova", "Termal Atatürk Köşkü Müzesi", "1929 yapımı tarihi kaplıca köşkü, orijinal mobilyalar ve toplantı salonu.", 29.176400, 40.601700, "09:00 - 17:00"),

                // 78. KARABÜK
                ("Karabük", "Safranbolu Kent Tarihi Müzesi (Eski Hükümet Konağı)", "UNESCO Dünya Mirası Safranbolu'nun tarihi, zanaatları ve konak kültürü.", 32.691700, 41.244400, "09:00 - 18:30"),
                ("Karabük", "Safranbolu Kaymakamlar Gezi Evi Müzesi", "18. yüzyıl geleneksel Safranbolu konak mimarisinin en canlı örneği.", 32.694200, 41.246700, "09:00 - 18:00"),
                ("Karabük", "Hadrianapolis Antik Kenti Açık Hava Müzesi (Eskipazar)", "Karadeniz'in Zeugma'sı; Kilise zeminlerinde Nil nehri canlıları mozaikleri.", 32.533300, 40.950000, "08:30 - 19:00"),
                ("Karabük", "Karabük Demir Çelik Sanayi Müzesi", "KARDEMİR yerleşkesinde Türkiye'nin ağır sanayi ve demir-çelik hamlesi tarihi.", 32.626700, 41.198900, "09:00 - 17:00"),
                ("Karabük", "Safranbolu Çikolata Müzesi", "Tarihi Safranbolu evleri ve anıtlarının gerçek çikolatadan yapılmış minyatürleri.", 32.688900, 41.241700, "09:30 - 18:30"),

                // 79. KİLİS
                ("Kilis", "Kilis Tarihi Neşet Efendi Konağı Kent Müzesi", "Cumhuriyet dönemi sivil mimarisi konağında Kilis etnografyası ve el sanatları.", 37.115800, 36.716700, "08:30 - 17:00"),
                ("Kilis", "Kilis Tarihi Sabunhane Etnografya Müzesi", "Geleneksel Kilis zeytinyağı sabunculuğu ve tarihi pres mengene düzenekleri.", 37.114200, 36.714400, "09:00 - 17:30"),
                ("Kilis", "Oylum Höyük ve Bazilika Açık Hava Müzesi", "Güneydoğu Anadolu'nun en büyük höyüklerinden biri, 5500 yıllık krallık sarayı.", 37.172200, 36.702800, "08:30 - 17:30"),
                ("Kilis", "Ravanda Kalesi Açık Hava Tarih Alanı (Polateli)", "Afrin Çayı vadisinde sarp tepe üzerinde Hitit ve Haçlılar dönemi kalesi.", 37.016700, 36.883300, "08:30 - 18:00"),
                ("Kilis", "Kilis Tarihi Kabaltıları ve Taş Evler Kültür Alanı", "Geleneksel dar sokaklar üzerinde evleri birbirine bağlayan tarihi taş kemerler.", 37.116700, 36.718100, "08:00 - 19:00"),

                // 80. OSMANİYE
                ("Osmaniye", "Karatepe-Aslantaş Açık Hava Müzesi (Kadirli)", "Türkiye'nin ilk açık hava müzesi; Geç Hitit çift dilli Fenike hiyeroglif yazıtları.", 36.245800, 37.295800, "08:30 - 19:00"),
                ("Osmaniye", "Kastabala (Hierapolis) Antik Kenti Açık Hava Müzesi", "Sütunlu anıtsal caddesi, tiyatrosu ve orta çağ kalesiyle görkemli antik kent.", 36.195800, 37.178300, "08:30 - 18:30"),
                ("Osmaniye", "Osmaniye Kent Müzesi", "Çukurova folkloru, geleneksel Karatepe kilimleri ve Osmaniye tarım tarihi.", 36.246700, 37.075800, "08:30 - 17:00"),
                ("Osmaniye", "Kadirli Ala Cami Tarih Müzesi", "Roma tapınağı, Bizans kilisesi ve Dulkadiroğlu camisi olarak kullanılan anıt eser.", 36.088900, 37.375000, "08:00 - 18:30"),
                ("Osmaniye", "Toprakkale Kalesi Tarihi Sergi Alanı", "Çukurova'yı Suriye'ye bağlayan tarihi kavşakta Abbasi ve Memlük kalesi.", 36.144400, 37.066700, "08:30 - 18:00"),

                // 81. DÜZCE
                ("Düzce", "Konuralp (Prusias ad Hypium) Arkeoloji Müzesi", "Bithynia dönemi Tyche heykeli, Orpheus taban mozaiği ve Roma lahitleri.", 31.154200, 40.904200, "08:30 - 17:30"),
                ("Düzce", "Prusias ad Hypium Antik Tiyatro Açık Hava Müzesi", "Halk arasında 'Kırk Basamaklar' olarak bilinen muhteşem Roma tiyatrosu.", 31.156700, 40.906100, "08:30 - 19:00"),
                ("Düzce", "Akçakoca Tarihi Ceneviz Kalesi Açık Hava Müzesi", "Karadeniz kıyısında falezler üzerinde UNESCO adayı Ceneviz ticaret kalesi.", 31.108300, 41.094400, "08:00 - 20:00"),
                ("Düzce", "Düzce Kent Kültür ve Etnografya Evi", "Düzce'nin zengin Kafkas, Karadeniz ve Balkan göçmenleri kültürel mirası.", 31.161100, 40.843300, "09:00 - 17:00"),
                ("Düzce", "Samandere Şelalesi Tabiat Anıtı Doğa Sergi Alanı", "Türkiye'nin tescil edilen ilk tabiat anıtı jeolojik kanyonu ve şelalesi.", 31.294400, 40.730600, "08:00 - 19:00")
            };
        }
    }
}
