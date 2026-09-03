using System;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace GeoraphMap.Infrastructure
{
    public static class DbSeeder
    {
        public static async Task SeedAsdfUserAndAssignDrawingsAsync(AppDbContext context)
        {
            // 1. Find existing "asdf" or "asdf.admin" user
            var adminUser = await context.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == "asdf.admin" || u.Username.ToLower() == "asdf");

            if (adminUser != null)
            {
                if (!adminUser.IsDeleted)
                {
                    adminUser.Username = "asdf.admin";
                    adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234");
                    adminUser.IsActive = true;
                    adminUser.ModifiedDate = DateTime.UtcNow;
                    await context.SaveChangesAsync();
                }
            }
            else
            {
                var passwordHash = BCrypt.Net.BCrypt.HashPassword("1234");
                adminUser = new User
                {
                    Username = "asdf.admin",
                    Email = "asdf.admin@geomap.com",
                    Phone = "05555555555",
                    PasswordHash = passwordHash,
                    IsActive = true,
                    IsDeleted = false,
                    ModifiedDate = DateTime.UtcNow
                };

                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }

            int adminUserId = adminUser.Id;
            Console.WriteLine($"[DbSeeder] asdf.admin User ID: {adminUserId}");

            // Assign Admin role (Id = 1)
            var adminRole = await context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
            if (adminRole != null)
            {
                var userRoleExists = await context.UserRoles.AnyAsync(ur => ur.UserId == adminUserId && ur.RoleId == adminRole.Id);
                if (!userRoleExists)
                {
                    context.UserRoles.Add(new UserRole
                    {
                        UserId = adminUserId,
                        RoleId = adminRole.Id
                    });
                    await context.SaveChangesAsync();
                }
            }

            // Ensure any users without any role get default "Viewer" role
            var viewerRole = await context.Roles
                .FirstOrDefaultAsync(r => r.Name.ToLower() == "viewer" || r.Name.ToLower() == "görüntüleyici");

            if (viewerRole != null)
            {
                var usersWithoutRoles = await context.Users
                    .Where(u => !u.IsDeleted && !u.UserRoles.Any())
                    .ToListAsync();

                foreach (var u in usersWithoutRoles)
                {
                    context.UserRoles.Add(new UserRole
                    {
                        UserId = u.Id,
                        RoleId = viewerRole.Id
                    });
                }
                if (usersWithoutRoles.Any())
                {
                    await context.SaveChangesAsync();
                }
            }

            await context.SaveChangesAsync();
            Console.WriteLine("[DbSeeder] asdf.admin user, role and default viewer roles ensured successfully.");
        }

        public static async Task EnsureTablesCreatedAsync(AppDbContext context)
        {
            try
            {
                // 1. Tabloları Oluştur
                await context.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS tbl_editor_collaboration (
                        id SERIAL PRIMARY KEY,
                        sender_user_id INT NOT NULL,
                        receiver_user_id INT NOT NULL,
                        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                        requested_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        responded_date TIMESTAMP WITH TIME ZONE NULL
                    );
                    ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS spatial_boundary_wkt TEXT;

                    CREATE TABLE IF NOT EXISTS tbl_poi_category (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        icon VARCHAR(100) DEFAULT 'fa-map-pin',
                        color VARCHAR(50) DEFAULT '#3b82f6',
                        parent_id INT NULL REFERENCES tbl_poi_category(id) ON DELETE RESTRICT,
                        display_order INT NOT NULL DEFAULT 1,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS tbl_poi (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        category_id INT NOT NULL REFERENCES tbl_poi_category(id) ON DELETE RESTRICT,
                        working_hours VARCHAR(255),
                        wkt TEXT NOT NULL,
                        geometry geometry(Geometry, 4326),
                        user_id INT NOT NULL REFERENCES tbl_user(id) ON DELETE RESTRICT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS tbl_route (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        color VARCHAR(50) DEFAULT '#3B82F6',
                        description TEXT,
                        wkt TEXT,
                        geometry geometry(Geometry, 4326),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS wkt TEXT;
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS previous_wkt TEXT;
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS custom_wkt TEXT;
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS geometry_type VARCHAR(50) DEFAULT 'Direct';
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS route_class VARCHAR(50) DEFAULT 'araba';
                    ALTER TABLE tbl_route ADD COLUMN IF NOT EXISTS geometry geometry(Geometry, 4326);
                    UPDATE tbl_route SET route_class = 'araba' WHERE route_class IS NULL;
                    UPDATE tbl_route SET route_class = 'metro' WHERE (name ILIKE '%metro%' OR name ILIKE 'M1%' OR name ILIKE 'M2%' OR name ILIKE 'M4%') AND (route_class = 'araba' OR route_class IS NULL);

                    CREATE TABLE IF NOT EXISTS tbl_stop (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        order_index INT NOT NULL DEFAULT 1,
                        description TEXT,
                        route_id INT NULL REFERENCES tbl_route(id) ON DELETE CASCADE,
                        stop_class VARCHAR(50) DEFAULT 'otobus',
                        wkt TEXT NOT NULL,
                        geometry geometry(Point, 4326),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE tbl_stop ALTER COLUMN route_id DROP NOT NULL;
                    ALTER TABLE tbl_stop ADD COLUMN IF NOT EXISTS stop_class VARCHAR(50) DEFAULT 'otobus';
                    
                    -- Liman, İskele, Feribot duraklarının sınıflarını 'gemi' yap
                    UPDATE tbl_stop SET stop_class = 'gemi' 
                    WHERE name ILIKE '%Liman%' 
                       OR name ILIKE '%İskele%' 
                       OR name ILIKE '%İskelesi%' 
                       OR name ILIKE '%Feribot%' 
                       OR name ILIKE '%Ro-Ro%' 
                       OR name ILIKE '%Port%'
                       OR route_id IN (SELECT id FROM tbl_route WHERE route_class = 'gemi');

                    -- Metro duraklarını 'metro' sınıfı yap
                    UPDATE tbl_stop SET stop_class = 'metro' 
                    WHERE route_id IN (SELECT id FROM tbl_route WHERE route_class = 'metro')
                       OR name ILIKE '%Metro%' 
                       OR name ILIKE '%İstasyon%';

                    -- Tren duraklarını 'tren' sınıfı yap
                    UPDATE tbl_stop SET stop_class = 'tren' 
                    WHERE route_id IN (SELECT id FROM tbl_route WHERE route_class = 'tren')
                       OR name ILIKE '%Gar%' 
                       OR name ILIKE '%Garı%';

                    CREATE TABLE IF NOT EXISTS tbl_route_stop (
                        id SERIAL PRIMARY KEY,
                        route_id INT NOT NULL REFERENCES tbl_route(id) ON DELETE CASCADE,
                        stop_id INT NOT NULL REFERENCES tbl_stop(id) ON DELETE CASCADE,
                        order_index INT NOT NULL DEFAULT 1,
                        created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ix_tbl_route_stop_route_id ON tbl_route_stop(route_id);
                    CREATE INDEX IF NOT EXISTS ix_tbl_route_stop_stop_id ON tbl_route_stop(stop_id);
                    ALTER TABLE tbl_stop ADD COLUMN IF NOT EXISTS stop_code VARCHAR(100);

                    -- Mevcut duraklara sınıfına göre benzersiz kod ata
                    UPDATE tbl_stop SET stop_code = 'PORT-' || LPAD(id::text, 4, '0') WHERE stop_code IS NULL AND stop_class = 'gemi';
                    UPDATE tbl_stop SET stop_code = 'METRO-' || LPAD(id::text, 4, '0') WHERE stop_code IS NULL AND stop_class = 'metro';
                    UPDATE tbl_stop SET stop_code = 'TRAIN-' || LPAD(id::text, 4, '0') WHERE stop_code IS NULL AND stop_class = 'tren';
                    UPDATE tbl_stop SET stop_code = 'ROAD-' || LPAD(id::text, 4, '0') WHERE stop_code IS NULL AND stop_class = 'araba';
                    UPDATE tbl_stop SET stop_code = 'BUS-' || LPAD(id::text, 4, '0') WHERE stop_code IS NULL;

                    -- Mevcut tekil route_id bağlantılarını tbl_route_stop junction tablosuna da işle
                    INSERT INTO tbl_route_stop (route_id, stop_id, order_index, created_date)
                    SELECT route_id, id, order_index, CURRENT_TIMESTAMP
                    FROM tbl_stop
                    WHERE route_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM tbl_route_stop rs WHERE rs.route_id = tbl_stop.route_id AND rs.stop_id = tbl_stop.id
                      );

                    CREATE TABLE IF NOT EXISTS tbl_user_saved_route (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES tbl_user(id) ON DELETE CASCADE,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        start_point_name VARCHAR(255) DEFAULT 'Başlangıç Noktası',
                        start_wkt TEXT NOT NULL,
                        target_poi_id INT NULL,
                        target_poi_name VARCHAR(255) DEFAULT 'Hedef POI',
                        target_wkt TEXT NOT NULL,
                        route_wkt TEXT NOT NULL,
                        geometry geometry(LineString, 4326),
                        distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
                        duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
                        color VARCHAR(50) DEFAULT '#10B981',
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS tbl_user_favorite_poi (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES tbl_user(id) ON DELETE CASCADE,
                        poi_id INT NOT NULL REFERENCES tbl_poi(id) ON DELETE CASCADE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, poi_id)
                    );
                ");
                Console.WriteLine("[DbSeeder] tbl_route, tbl_stop, tbl_user_saved_route ve tbl_user_favorite_poi tabloları doğrulandı.");

                // 2. İzinleri Güvenle Ekle
                await context.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO tbl_permission (id, name, code, description)
                    VALUES (8, 'POI Ekleme', 'poi.create', 'Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi')
                    ON CONFLICT (id) DO NOTHING;

                    INSERT INTO tbl_permission (id, name, code, description)
                    VALUES (9, 'Güzergah Yönetimi', 'route.manage', 'Yeni güzergah ekleme, düzenleme, silme ve durak sıralama yetkisi')
                    ON CONFLICT (id) DO NOTHING;

                    INSERT INTO tbl_permission (id, name, code, description)
                    VALUES (10, 'Durak Yönetimi', 'stop.manage', 'Haritada durak ekleme, düzenleme ve silme yetkisi')
                    ON CONFLICT (id) DO NOTHING;

                    INSERT INTO tbl_permission (id, name, code, description)
                    VALUES (11, 'Güzergah ve Durak Görüntüleme', 'route.view', 'Güzergahları ve durakları haritada görüntüleme yetkisi')
                    ON CONFLICT (id) DO NOTHING;
                ");

                // 3. Rolleri Güvenle Ekle
                await context.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO tbl_role (id, name, description)
                    VALUES (4, 'Operatör', 'Ulaşım güzergah ve durak yönetim yetkisine sahip operatör')
                    ON CONFLICT (id) DO NOTHING;

                    INSERT INTO tbl_role (id, name, description)
                    VALUES (5, 'Ulaşım Kullanıcısı', 'Güzergah ve durakları görüntüleme yetkisine sahip kullanıcı')
                    ON CONFLICT (id) DO NOTHING;
                ");

                // 4. Rol-Yetki İlişkilerini Dinamik SQL ile Doğrudan Bağla
                await context.Database.ExecuteSqlRawAsync(@"
                    -- Admin: route.manage, stop.manage, route.view
                    INSERT INTO tbl_role_permission (role_id, permission_id)
                    SELECT r.id, p.id FROM tbl_role r, tbl_permission p
                    WHERE (r.name = 'Admin' OR r.id = 1) AND p.code IN ('route.manage', 'stop.manage', 'route.view')
                    ON CONFLICT DO NOTHING;

                    -- Editor: route.view
                    INSERT INTO tbl_role_permission (role_id, permission_id)
                    SELECT r.id, p.id FROM tbl_role r, tbl_permission p
                    WHERE (r.name = 'Editor' OR r.id = 2) AND p.code = 'route.view'
                    ON CONFLICT DO NOTHING;

                    -- Viewer: route.view
                    INSERT INTO tbl_role_permission (role_id, permission_id)
                    SELECT r.id, p.id FROM tbl_role r, tbl_permission p
                    WHERE (r.name = 'Viewer' OR r.id = 3) AND p.code = 'route.view'
                    ON CONFLICT DO NOTHING;

                    -- Operatör: drawings.view_all, route.manage, stop.manage, route.view (Kesinlikle poi.create veya çizim ekleme yok!)
                    INSERT INTO tbl_role_permission (role_id, permission_id)
                    SELECT r.id, p.id FROM tbl_role r, tbl_permission p
                    WHERE (r.name = 'Operatör' OR r.name = 'Operator' OR r.id = 4) 
                      AND p.code IN ('drawings.view_all', 'route.manage', 'stop.manage', 'route.view')
                    ON CONFLICT DO NOTHING;

                    -- Ulaşım Kullanıcısı: drawings.view_all, route.view
                    INSERT INTO tbl_role_permission (role_id, permission_id)
                    SELECT r.id, p.id FROM tbl_role r, tbl_permission p
                    WHERE (r.name = 'Ulaşım Kullanıcısı' OR r.id = 5) 
                      AND p.code IN ('drawings.view_all', 'route.view')
                    ON CONFLICT DO NOTHING;
                ");
                Console.WriteLine("[DbSeeder] İzinler, Roller ve Rol Yetkileri başarıyla senkronize edildi.");

                // Seed Demo Routes and Stops if empty
                if (!await context.Stops.AnyAsync())
                {
                    var wktReader = new NetTopologySuite.IO.WKTReader { DefaultSRID = 4326 };

                    var route1 = await context.Routes.FirstOrDefaultAsync(r => r.Name.Contains("M4"));
                    if (route1 == null)
                    {
                        route1 = new RouteFeature
                        {
                            Name = "M4 Kadıköy - Kartal Metro Hattı",
                            Color = "#ef4444", // Kırmızı metro hattı
                            Description = "Anadolu yakası ana metro güzergahı",
                            IsActive = true
                        };
                        context.Routes.Add(route1);
                        await context.SaveChangesAsync();
                    }

                    var stops1 = new List<(string Name, int Order, double Lon, double Lat)>
                    {
                        ("Kadıköy İstasyonu", 1, 29.0234, 40.9904),
                        ("Ayrılık Çeşmesi", 2, 29.0305, 41.0001),
                        ("Acıbadem", 3, 29.0450, 41.0040),
                        ("Ünalan", 4, 29.0600, 40.9980),
                        ("Göztepe", 5, 29.0750, 40.9920),
                        ("Yenisahra", 6, 29.0920, 40.9880),
                        ("Kozyatağı", 7, 29.1080, 40.9820),
                        ("Bostancı", 8, 29.1240, 40.9750),
                        ("Küçükyalı", 9, 29.1410, 40.9680),
                        ("Maltepe", 10, 29.1580, 40.9520),
                        ("Kartal İstasyonu", 11, 29.1890, 40.9020)
                    };

                    foreach (var s in stops1)
                    {
                        var wkt = $"POINT({s.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {s.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                        var geom = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt);
                        context.Stops.Add(new StopFeature
                        {
                            Name = s.Name,
                            OrderIndex = s.Order,
                            RouteId = route1.Id,
                            Wkt = wkt,
                            Geometry = geom,
                            IsActive = true
                        });
                    }

                    // 2. 15F Sahil Otobüs Hattı (Beykoz - Kadıköy)
                    var route2 = new RouteFeature
                    {
                        Name = "15F Beykoz - Kadıköy Sahil Hattı",
                        Color = "#10b981", // Yeşil sahil hattı
                        Description = "Boğaz sahil yolu toplu taşıma hattı",
                        IsActive = true
                    };
                    context.Routes.Add(route2);
                    await context.SaveChangesAsync();

                    var stops2 = new List<(string Name, int Order, double Lon, double Lat)>
                    {
                        ("Beykoz Merkez", 1, 29.0965, 41.1340),
                        ("Paşabahçe", 2, 29.0920, 41.1180),
                        ("Çubuklu", 3, 29.0850, 41.1060),
                        ("Kanlıca", 4, 29.0660, 41.0870),
                        ("Anadoluhisarı", 5, 29.0680, 41.0820),
                        ("Kandilli", 6, 29.0610, 41.0740),
                        ("Çengelköy", 7, 29.0520, 41.0510),
                        ("Beylerbeyi", 8, 29.0430, 41.0420),
                        ("Kuzguncuk", 9, 29.0310, 41.0330),
                        ("Üsküdar Meydan", 10, 29.0150, 41.0260),
                        ("Kadıköy Rıhtım", 11, 29.0225, 40.9912)
                    };

                    foreach (var s in stops2)
                    {
                        var wkt = $"POINT({s.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {s.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                        var geom = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt);
                        context.Stops.Add(new StopFeature
                        {
                            Name = s.Name,
                            OrderIndex = s.Order,
                            RouteId = route2.Id,
                            Wkt = wkt,
                            Geometry = geom,
                            IsActive = true
                        });
                    }

                    await context.SaveChangesAsync();
                    Console.WriteLine("[DbSeeder] Örnek Güzergahlar ve Duraklar başarıyla eklendi.");
                }

                // Seed Default Hierarchical Categories if empty
                if (!await context.PoiCategories.AnyAsync())
                {
                    // 1. Yeme-İçme (Öncelik: 4 - Yerel İşletmeler / Detay)
                    var foodCat = new PoiCategory { Name = "Yeme-İçme", Description = "Restoran, kafe ve gıda işletmeleri", Icon = "fa-utensils", Color = "#f59e0b", DisplayOrder = 4 };
                    context.PoiCategories.Add(foodCat);
                    await context.SaveChangesAsync();

                    context.PoiCategories.AddRange(
                        new PoiCategory { Name = "Restoran", Description = "Yemek servis mekanları", ParentId = foodCat.Id, Icon = "fa-utensils", Color = "#f59e0b", DisplayOrder = 4 },
                        new PoiCategory { Name = "Kafe", Description = "Kahve ve dinlenme mekanları", ParentId = foodCat.Id, Icon = "fa-coffee", Color = "#d97706", DisplayOrder = 5 },
                        new PoiCategory { Name = "Fast Food", Description = "Hızlı yemek ve atıştırmalık", ParentId = foodCat.Id, Icon = "fa-burger", Color = "#b45309", DisplayOrder = 5 }
                    );

                    // 2. Sağlık (Öncelik: 1-2 - Kritik / Yüksek)
                    var healthCat = new PoiCategory { Name = "Sağlık", Description = "Hastaneler, klinikler ve eczaneler", Icon = "fa-heartbeat", Color = "#ef4444", DisplayOrder = 1 };
                    context.PoiCategories.Add(healthCat);
                    await context.SaveChangesAsync();

                    context.PoiCategories.AddRange(
                        new PoiCategory { Name = "Hastane", Description = "Devlet ve Özel Hastaneler", ParentId = healthCat.Id, Icon = "fa-hospital", Color = "#ef4444", DisplayOrder = 1 },
                        new PoiCategory { Name = "Eczane", Description = "İlaç ve medikal noktaları", ParentId = healthCat.Id, Icon = "fa-prescription-bottle-alt", Color = "#dc2626", DisplayOrder = 3 },
                        new PoiCategory { Name = "Klinik & Sağlık Ocağı", Description = "A tipi poliklinik ve ASM", ParentId = healthCat.Id, Icon = "fa-stethoscope", Color = "#991b1b", DisplayOrder = 2 }
                    );

                    // 3. Eğitim (Öncelik: 2-3 - Yüksek / Orta)
                    var eduCat = new PoiCategory { Name = "Eğitim", Description = "Okullar, kütüphaneler ve üniversiteler", Icon = "fa-graduation-cap", Color = "#3b82f6", DisplayOrder = 2 };
                    context.PoiCategories.Add(eduCat);
                    await context.SaveChangesAsync();

                    context.PoiCategories.AddRange(
                        new PoiCategory { Name = "Okul", Description = "İlk, orta ve lise eğitim kurumları", ParentId = eduCat.Id, Icon = "fa-school", Color = "#3b82f6", DisplayOrder = 3 },
                        new PoiCategory { Name = "Üniversite & Kampüs", Description = "Yükseköğretim kurumları", ParentId = eduCat.Id, Icon = "fa-university", Color = "#2563eb", DisplayOrder = 2 },
                        new PoiCategory { Name = "Kütüphane", Description = "Halk ve araştırma kütüphaneleri", ParentId = eduCat.Id, Icon = "fa-book-reader", Color = "#1d4ed8", DisplayOrder = 3 }
                    );

                    // 4. Kamu & Hizmet (Öncelik: 1-2 - Kritik / Yüksek)
                    var pubCat = new PoiCategory { Name = "Kamu & Hizmet", Description = "Resmi kurumlar ve belediye hizmetleri", Icon = "fa-landmark", Color = "#8b5cf6", DisplayOrder = 1 };
                    context.PoiCategories.Add(pubCat);
                    await context.SaveChangesAsync();

                    context.PoiCategories.AddRange(
                        new PoiCategory { Name = "Belediye & Kaymakamlık", Description = "Yerel yönetim binaları", ParentId = pubCat.Id, Icon = "fa-landmark", Color = "#8b5cf6", DisplayOrder = 1 },
                        new PoiCategory { Name = "Muhtarlık", Description = "Mahalle muhtarlıkları", ParentId = pubCat.Id, Icon = "fa-building", Color = "#7c3aed", DisplayOrder = 3 },
                        new PoiCategory { Name = "Postane / Kargo", Description = "PTT ve kargo şubeleri", ParentId = pubCat.Id, Icon = "fa-envelope", Color = "#6d28d9", DisplayOrder = 3 }
                    );

                    // 5. Ulaşım & Altyapı (Öncelik: 1 - Çok Yüksek / Kritik)
                    var transCat = new PoiCategory { Name = "Ulaşım", Description = "Toplu taşıma ve otopark alanları", Icon = "fa-bus", Color = "#10b981", DisplayOrder = 1 };
                    context.PoiCategories.Add(transCat);
                    await context.SaveChangesAsync();

                    context.PoiCategories.AddRange(
                        new PoiCategory { Name = "Otogar / Terminal", Description = "Şehirlerarası ve ilçe otogarları", ParentId = transCat.Id, Icon = "fa-bus", Color = "#10b981", DisplayOrder = 1 },
                        new PoiCategory { Name = "Metro / Tren İstasyonu", Description = "Raylı sistem istasyonları", ParentId = transCat.Id, Icon = "fa-train", Color = "#059669", DisplayOrder = 1 },
                        new PoiCategory { Name = "Otopark", Description = "Açık ve kapalı otopark alanları", ParentId = transCat.Id, Icon = "fa-parking", Color = "#047857", DisplayOrder = 3 }
                    );

                    await context.SaveChangesAsync();
                    Console.WriteLine("[DbSeeder] Örnek hiyerarşik POI kategorileri başarıyla eklendi.");
                }

                // Ensure "POI Ekleme" permission exists
                var poiPerm = await context.Permissions.FirstOrDefaultAsync(p => p.Code == "poi.create" || p.Name == "POI Ekleme");
                if (poiPerm == null)
                {
                    poiPerm = new Permission
                    {
                        Name = "POI Ekleme",
                        Code = "poi.create",
                        Description = "Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi"
                    };
                    context.Permissions.Add(poiPerm);
                    await context.SaveChangesAsync();

                    var existingAdmin = await context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
                    if (existingAdmin != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == existingAdmin.Id && rp.PermissionId == poiPerm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = existingAdmin.Id, PermissionId = poiPerm.Id });
                    }

                    var existingEditor = await context.Roles.FirstOrDefaultAsync(r => r.Id == 2 || r.Name == "Editor" || r.Name == "Editör");
                    if (existingEditor != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == existingEditor.Id && rp.PermissionId == poiPerm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = existingEditor.Id, PermissionId = poiPerm.Id });
                    }
                    await context.SaveChangesAsync();
                }

                // 5. Türkiye'deki Tüm Limanlar İçin Deniz Hatları ve Durakları Ekle
                await SeedAllTurkishSeaportsAndRoutesAsync(context);

                // 6. Ankara Metro, Ankaray, Başkentray ve EGO Ulaşım Ağını Ekle
                await SeedAnkaraTransitAndMultiRouteStopsAsync(context);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbSeeder] Table creation error: {ex.Message}");
            }
        }

        public static async Task SeedAllTurkishSeaportsAndRoutesAsync(AppDbContext context)
        {
            try
            {
                var wktReader = new NetTopologySuite.IO.WKTReader { DefaultSRID = 4326 };

                // 1. Sahte tekil liman güzergahlarını (RouteClass: gemi olup Wkt'si olmayan veya tek duraklı) veritabanından tamamen temizle
                var fakePortRoutes = await context.Routes
                    .Include(r => r.Stops)
                    .Where(r => r.RouteClass == "gemi" && (string.IsNullOrEmpty(r.Wkt) || r.Stops.Count <= 1))
                    .ToListAsync();

                if (fakePortRoutes.Any())
                {
                    foreach (var fr in fakePortRoutes)
                    {
                        if (fr.Stops.Any())
                        {
                            context.Stops.RemoveRange(fr.Stops);
                        }
                    }
                    context.Routes.RemoveRange(fakePortRoutes);
                    await context.SaveChangesAsync();
                    Console.WriteLine($"[DbSeeder] {fakePortRoutes.Count} adet tekil sahte liman güzergahı veritabanından başarıyla temizlendi.");
                }

                // 2. Örnek Gerçek Limanlar Arası Deniz Güzergahları (İki Limanı Birbirine Bağlayan Hatlar)
                var sampleMaritimeRoutes = new[]
                {
                    (
                        Name: "Yenikapı - Bandırma Hızlı Feribot Hattı",
                        Desc: "Marmara Denizi hızlı feribot ve araç taşıma deniz koridoru",
                        Color: "#0284c7",
                        Wkt: "LINESTRING(28.953600 41.002800, 28.750000 40.800000, 28.300000 40.600000, 27.973900 40.356700)",
                        DepPort: (Name: "Yenikapı Feribot Limanı", Desc: "İDO Yenikapı Hızlı Feribot Terminali", Lon: 28.9536, Lat: 41.0028),
                        ArrPort: (Name: "Bandırma Limanı (Balıkesir)", Desc: "Çelebi Bandırma Feribot ve Konteyner Limanı", Lon: 27.9739, Lat: 40.3567)
                    ),
                    (
                        Name: "Mersin - Girne Feribot & Ro-Ro Hattı",
                        Desc: "Türkiye - KKTC Doğu Akdeniz ana deniz ulaşım koridoru",
                        Color: "#0891b2",
                        Wkt: "LINESTRING(34.646700 36.796700, 34.200000 36.200000, 33.600000 35.600000, 33.323600 35.342500)",
                        DepPort: (Name: "Mersin Uluslararası Limanı (MIP)", Desc: "Mersin Ana Liman ve Yolcu Terminali", Lon: 34.6467, Lat: 36.7967),
                        ArrPort: (Name: "Girne Limanı (KKTC)", Desc: "KKTC Girne Feribot ve Ro-Ro Limanı", Lon: 33.3236, Lat: 35.3425)
                    ),
                    (
                        Name: "Çanakkale - Eceabat Boğaz Geçiş Hattı",
                        Desc: "Çanakkale Boğazı araç ve yolcu feribot bağlantı hattı",
                        Color: "#06b6d4",
                        Wkt: "LINESTRING(26.381400 40.104200, 26.500000 40.250000, 26.671400 40.411200)",
                        DepPort: (Name: "Çanakkale Kepez Limanı", Desc: "Çanakkale Boğazı Kepez Limanı", Lon: 26.3814, Lat: 40.1042),
                        ArrPort: (Name: "Gelibolu Feribot Limanı (Çanakkale)", Desc: "Gelibolu Feribot İskelesi", Lon: 26.6714, Lat: 40.4112)
                    )
                };

                foreach (var mr in sampleMaritimeRoutes)
                {
                    var existingRoute = await context.Routes.Include(r => r.Stops).FirstOrDefaultAsync(r => r.Name == mr.Name);
                    if (existingRoute == null)
                    {
                        var newRoute = new RouteFeature
                        {
                            Name = mr.Name,
                            Description = mr.Desc,
                            Color = mr.Color,
                            RouteClass = "gemi",
                            Wkt = mr.Wkt,
                            IsActive = true,
                            IsDeleted = false
                        };
                        try { newRoute.Geometry = wktReader.Read(mr.Wkt); } catch { }
                        context.Routes.Add(newRoute);
                        await context.SaveChangesAsync();

                        // 1. Kalkış Limanı Durağı
                        var wkt1 = $"POINT({mr.DepPort.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {mr.DepPort.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                        var geom1 = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt1);
                        context.Stops.Add(new StopFeature
                        {
                            Name = mr.DepPort.Name,
                            Description = mr.DepPort.Desc,
                            StopClass = "gemi",
                            OrderIndex = 1,
                            RouteId = newRoute.Id,
                            Wkt = wkt1,
                            Geometry = geom1,
                            IsActive = true
                        });

                        // 2. Varış Limanı Durağı
                        var wkt2 = $"POINT({mr.ArrPort.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {mr.ArrPort.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                        var geom2 = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt2);
                        context.Stops.Add(new StopFeature
                        {
                            Name = mr.ArrPort.Name,
                            Description = mr.ArrPort.Desc,
                            StopClass = "gemi",
                            OrderIndex = 2,
                            RouteId = newRoute.Id,
                            Wkt = wkt2,
                            Geometry = geom2,
                            IsActive = true
                        });
                    }
                }

                // 3. Türkiye'deki Tüm Ana Liman ve İskeleleri Bağımsız 'gemi' Sınıfı Duraklar Olarak Ekle / Güncelle
                var allTurkishSeaports = new (string Name, string Desc, double Lon, double Lat)[]
                {
                    ("Haydarpaşa Limanı (İstanbul)", "TCDD Haydarpaşa Konteyner ve Genel Kargo Limanı", 29.0142, 40.9995),
                    ("Ambarlı Limanı (İstanbul)", "Marmara Bölgesi Ana Konteyner Hub Limanı (Marport/Kumport)", 28.6914, 40.9678),
                    ("Galataport İstanbul Limanı", "İstanbul Uluslararası Kruvaziyer Yolcu Limanı", 28.9836, 41.0264),
                    ("Yenikapı Feribot Limanı", "İDO Yenikapı Hızlı Feribot ve Deniz Otobüsü Terminali", 28.9536, 41.0028),
                    ("Pendik Ro-Ro Limanı", "DFDS Pendik Uluslararası Ro-Ro ve Lojistik Terminali", 29.2312, 40.8756),
                    ("Tuzla Limanı & Tersaneler", "Tuzla Gemi İnşa, Bakım-Onarım ve Sanayi Limanı", 29.2786, 40.8492),
                    ("Zeytinburnu Port Limanı", "Zeyport Ro-Ro ve Yolcu Giriş-Çıkış Limanı", 28.9056, 40.9856),
                    ("Safiport Derince Limanı (Kocaeli)", "Kocaeli Derince Çok Amaçlı Konteyner ve Ro-Ro Limanı", 29.8247, 40.7511),
                    ("Yılport Dilovası Limanı (Kocaeli)", "İzmit Körfezi Yılport Konteyner ve Sıvı Yük Terminali", 29.5412, 40.7719),
                    ("Autoport Limanı (Kocaeli - Gölcük)", "Türkiye Otomotiv İhracat ve Ro-Ro Limanı", 29.8512, 40.7189),
                    ("Evyapport Körfez Limanı (Kocaeli)", "Doğu Marmara Konteyner ve Sıvı Kimyasal Limanı", 29.7534, 40.7689),
                    ("Bandırma Limanı (Balıkesir)", "Çelebi Bandırma Feribot ve Konteyner Limanı", 27.9739, 40.3567),
                    ("Erdek Feribot İskelesi (Balıkesir)", "Marmara ve Avşa Adaları Feribot İskelesi", 27.7942, 40.3989),
                    ("Tekirdağ Ceyport Limanı", "Trakya Bölgesi Genel Yük ve Ro-Ro Limanı", 27.5142, 40.9689),
                    ("Asyaport Limanı (Tekirdağ - Barbaros)", "Türkiye'nin En Büyük Transit Konteyner Hub Limanı", 27.4689, 40.9123),
                    ("Mudanya Feribot İskelesi (Bursa)", "BUDO Mudanya - Eminönü/Kabataş Deniz Otobüsü İskelesi", 28.8789, 40.3756),
                    ("Gemlik Borusan Limanı (Bursa)", "Borusan Port Konteyner ve Genel Kargo Limanı", 29.1123, 40.4289),
                    ("Gemport Limanı (Gemlik - Bursa)", "Gemlik Körfezi Konteyner ve Araç İhracat Terminali", 29.1234, 40.4312),
                    ("Rodaport Limanı (Gemlik - Bursa)", "Gemlik Kuru Yük ve Konteyner Terminali", 29.1356, 40.4356),
                    ("Yalova Ro-Ro Limanı", "Yalova - Sète (Fransa) / Trieste Uluslararası Ro-Ro Terminali", 29.2812, 40.6589),
                    ("Çanakkale Kepez Limanı", "Çanakkale Boğazı Kepez Genel Kargo ve Yolcu Limanı", 26.3814, 40.1042),
                    ("Gelibolu Feribot Limanı (Çanakkale)", "Gelibolu Boğaz Geçiş Feribot İskelesi", 26.6714, 40.4112),
                    ("Eceabat İskelesi (Çanakkale)", "GESTAŞ Eceabat - Çanakkale Boğaz Hattı İskelesi", 26.3578, 40.1834),
                    ("Gökçeada Kuzu Limanı (Çanakkale)", "Gökçeada - Kabatepe Feribot Limanı", 25.9612, 40.2189),
                    ("Bozcaada Feribot İskelesi (Çanakkale)", "Bozcaada - Geyikli Feribot İskelesi", 26.0689, 39.8356),
                    ("Alsancak Limanı (İzmir)", "TCDD İzmir Alsancak Konteyner ve Kruvaziyer Limanı", 27.1489, 38.4398),
                    ("Nemport Limanı (İzmir - Aliağa)", "Ege Bölgesi Nemport Konteyner Terminali", 26.9312, 38.7845),
                    ("SOCAR Aliağa Terminali (İzmir)", "Petkim & Star Rafineri Petrol ve Kimyasal Terminali", 26.9456, 38.8123),
                    ("Çeşme Uluslararası Limanı (İzmir)", "Çeşme - Sakız / İtalya Ro-Ro ve Yolcu Limanı", 26.2989, 38.3245),
                    ("Dikili Limanı (İzmir)", "Dikili Genel Kargo ve Yolcu Limanı", 26.8856, 39.0712),
                    ("Ayvalık Limanı (Balıkesir)", "Ayvalık - Midilli Feribot ve Gümrük Limanı", 26.6912, 39.3178),
                    ("Kuşadası Ege Port Limanı (Aydın)", "Global Ports Kuşadası Uluslararası Kruvaziyer Limanı", 27.2567, 37.8612),
                    ("Bodrum Cruise Port (Muğla)", "Bodrum Uluslararası Kruvaziyer ve Feribot Limanı", 27.4356, 37.0312),
                    ("Marmaris Cruise Port (Muğla)", "Marmaris Uluslararası Kruvaziyer ve Rodos Feribot Limanı", 28.2745, 36.8512),
                    ("Datça Feribot İskelesi (Muğla)", "Datça - Bodrum Feribot İskelesi", 27.6845, 36.7212),
                    ("Fethiye Limanı (Muğla)", "Fethiye - Rodos Feribot ve Kruvaziyer Limanı", 29.1089, 36.6212),
                    ("Güllük Limanı (Muğla - Milas)", "Feldspat Madeni ve Genel Yük İhracat Limanı", 27.6012, 37.2456),
                    ("Kaş Yat Limanı / İskelesi (Antalya)", "Kaş - Meis Adası Feribot ve Yat İskelesi", 29.6389, 36.1989),
                    ("Finike Limanı (Antalya)", "Batı Akdeniz Genel Yük ve Yat Limanı", 30.1456, 36.2945),
                    ("Antalya QTerminals Port Limanı", "Antalya Çok Amaçlı Konteyner ve Kruvaziyer Limanı", 30.6089, 36.8312),
                    ("Alanya Limanı (Antalya)", "Alanya Uluslararası Kruvaziyer ve Girne Feribot Limanı", 31.9989, 36.5389),
                    ("Anamur Feribot İskelesi (Mersin)", "Anamur - Girne Hızlı Feribot İskelesi", 32.8345, 36.0712),
                    ("Taşucu Limanı (Mersin)", "Taşucu - Girne Feribot ve Ro-Ro Limanı", 33.8812, 36.3145),
                    ("Mersin Uluslararası Limanı (MIP)", "Doğu Akdeniz'in En Büyük Ana Konteyner ve Ticaret Limanı", 34.6467, 36.7967),
                    ("İskenderun LimakPort Limanı (Hatay)", "Doğu Akdeniz Ana Konteyner ve Sanayi Hub Limanı", 36.1845, 36.5889),
                    ("İskenderun Yazıcı / Assan Port (Hatay)", "İskenderun Körfezi Konteyner ve Demir-Çelik Terminali", 36.2089, 36.6212),
                    ("Madenli Yat Limanı & HADO İskelesi", "Hatay Madenli HADO Deniz Otobüsü ve Yat İskelesi", 35.9845, 36.4817),
                    ("Karadeniz Ereğli Erdemir Limanı", "Batı Karadeniz Erdemir Demir-Çelik Sanayi Limanı", 31.4189, 41.2789),
                    ("Zonguldak Limanı", "TCDD Zonguldak Kömür ve Ro-Ro Limanı", 31.7856, 41.4589),
                    ("Filyos Mega Limanı (Zonguldak)", "Karadeniz Doğalgazı Lojistik ve Mega Sanayi Limanı", 32.0245, 41.5712),
                    ("Bartın Limanı", "Bartın Genel Kargo ve Kereste İhracat Limanı", 32.2345, 41.6889),
                    ("Sinop Limanı", "Orta Karadeniz Doğal Korunaklı Genel Kargo Limanı", 35.1545, 42.0256),
                    ("Samsunport Sanayi Limanı", "Orta Karadeniz'in En Büyük Sanayi ve Ro-Ro Limanı", 36.3456, 41.3012),
                    ("Ünye Limanı (Ordu)", "Ordu Ünye Karadeniz İhracat ve Ro-Ro Limanı", 37.3189, 41.1345),
                    ("Giresun Limanı", "Giresun Çok Amaçlı Ticaret ve Fındık İhracat Limanı", 38.3889, 40.9189),
                    ("Trabzonport Limanı", "Doğu Karadeniz Ana Transit ve Konteyner Hub Limanı", 39.7345, 41.0045),
                    ("Rize Limanı", "Doğu Karadeniz Genel Kargo ve Çay İhracat Limanı", 40.5289, 41.0345),
                    ("Hopa Limanı (Artvin)", "Türkiye - Gürcistan / Kafkasya Sınır Deniz Terminali", 41.4289, 41.4089),
                    ("Girne Limanı (KKTC)", "KKTC Girne Feribot ve Ro-Ro Limanı", 33.3236, 35.3425),
                    ("Gazimağusa Limanı (KKTC)", "KKTC Gazimağusa Ana Ticaret ve Konteyner Limanı", 33.9447, 35.1285)
                };

                foreach (var port in allTurkishSeaports)
                {
                    string searchPrefix = port.Name.Split('(')[0].Trim();
                    var existingStop = await context.Stops
                        .FirstOrDefaultAsync(s => s.Name == port.Name || s.Name.StartsWith(searchPrefix));

                    if (existingStop != null)
                    {
                        // Sınıfı 'gemi' olarak güncelle
                        existingStop.StopClass = "gemi";
                        if (string.IsNullOrWhiteSpace(existingStop.Description))
                        {
                            existingStop.Description = port.Desc;
                        }
                    }
                    else
                    {
                        var wkt = $"POINT({port.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {port.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                        NetTopologySuite.Geometries.Point? geom = null;
                        try { geom = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt); } catch { }

                        context.Stops.Add(new StopFeature
                        {
                            Name = port.Name,
                            Description = port.Desc,
                            StopClass = "gemi",
                            RouteId = null,
                            OrderIndex = 1,
                            Wkt = wkt,
                            Geometry = geom,
                            IsActive = true,
                            IsDeleted = false,
                            CreatedDate = DateTime.UtcNow,
                            ModifiedDate = DateTime.UtcNow
                        });
                    }
                }

                // 4. Veritabanındaki adı 'Liman' veya 'İskele' içeren tüm durakların StopClass'ını 'gemi' yap
                var allPortStops = await context.Stops
                    .Where(s => s.Name.Contains("Liman") || s.Name.Contains("İskele") || s.Name.Contains("Feribot") || s.Name.Contains("Port"))
                    .ToListAsync();

                foreach (var ps in allPortStops)
                {
                    ps.StopClass = "gemi";
                }

                await context.SaveChangesAsync();
                Console.WriteLine("[DbSeeder] Tüm Türkiye limanları 'gemi' sınıfı ile başarıyla güncellendi.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbSeeder] Seaports seed error: {ex.Message}");
            }
        }

        public static async Task SeedAnkaraTransitAndMultiRouteStopsAsync(AppDbContext context)
        {
            try
            {
                var wktReader = new NetTopologySuite.IO.WKTReader { DefaultSRID = 4326 };

                // 1. Ankara Hat Tanımları
                var ankaraRoutes = new (string Name, string RouteClass, string Color, string Desc, (string Name, string Code, string Class, double Lon, double Lat)[] Stops)[]
                {
                    (
                        Name: "M1 Kızılay - Batıkent Metro Hattı (Ankara)",
                        RouteClass: "metro",
                        Color: "#e11d48",
                        Desc: "Ankara M1 Batıkent Metro Hattı",
                        Stops: new[]
                        {
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "metro", 32.8543, 39.9208),
                            ("Sıhhiye İstasyonu (Ankara)", "METRO-ANK-SHY", "metro", 32.8539, 39.9298),
                            ("Ulus Metro İstasyonu", "METRO-ANK-ULS", "metro", 32.8542, 39.9419),
                            ("Atatürk Kültür Merkezi (AKM)", "METRO-ANK-AKM", "metro", 32.8427, 39.9482),
                            ("Akköprü Metro İstasyonu", "METRO-ANK-AKP", "metro", 32.8315, 39.9546),
                            ("İvedik Metro İstasyonu", "METRO-ANK-IVD", "metro", 32.8189, 39.9621),
                            ("Yenimahalle Metro İstasyonu", "METRO-ANK-YNM", "metro", 32.8098, 39.9687),
                            ("Demetevler Metro İstasyonu", "METRO-ANK-DMT", "metro", 32.7989, 39.9723),
                            ("Hastane Metro İstasyonu", "METRO-ANK-HST", "metro", 32.7889, 39.9745),
                            ("Macunköy Metro İstasyonu", "METRO-ANK-MCN", "metro", 32.7756, 39.9721),
                            ("OSTİM Sanayi İstasyonu", "METRO-ANK-OST", "metro", 32.7489, 39.9712),
                            ("Batıkent Metro Terminali", "METRO-ANK-BTK", "metro", 32.7356, 39.9689)
                        }
                    ),
                    (
                        Name: "M2 Kızılay - Koru Çayyolu Metro Hattı (Ankara)",
                        RouteClass: "metro",
                        Color: "#2563eb",
                        Desc: "Ankara M2 Çayyolu Koru Metro Hattı",
                        Stops: new[]
                        {
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "metro", 32.8543, 39.9208),
                            ("Necatibey Metro İstasyonu", "METRO-ANK-NCT", "metro", 32.8489, 39.9145),
                            ("Milli Kütüphane Metro İstasyonu", "METRO-ANK-MKT", "metro", 32.8289, 39.9156),
                            ("Söğütözü Metro & Ankaray Aktarma", "METRO-ANK-SGT", "metro", 32.8089, 39.9123),
                            ("MTA Genel Müdürlüğü İstasyonu", "METRO-ANK-MTA", "metro", 32.7956, 39.9089),
                            ("ODTÜ Metro İstasyonu", "METRO-ANK-ODTU", "metro", 32.7789, 39.9045),
                            ("Bilkent Metro İstasyonu", "METRO-ANK-BLK", "metro", 32.7589, 39.8978),
                            ("Tarım Bakanlığı / Danıştay", "METRO-ANK-TRM", "metro", 32.7389, 39.8912),
                            ("Beytepe Metro İstasyonu", "METRO-ANK-BYT", "metro", 32.7189, 39.8878),
                            ("Ümitköy Metro İstasyonu", "METRO-ANK-UMT", "metro", 32.6989, 39.8845),
                            ("Çayyolu Metro İstasyonu", "METRO-ANK-CYY", "metro", 32.6789, 39.8812),
                            ("Koru Metro Terminali", "METRO-ANK-KRU", "metro", 32.6589, 39.8789)
                        }
                    ),
                    (
                        Name: "M4 Kızılay - Keçiören Metro Hattı (Ankara)",
                        RouteClass: "metro",
                        Color: "#7c3aed",
                        Desc: "Ankara M4 Keçiören Metro Hattı",
                        Stops: new[]
                        {
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "metro", 32.8543, 39.9208),
                            ("Adliye Metro İstasyonu", "METRO-ANK-ADL", "metro", 32.8534, 39.9289),
                            ("Ankara Garı (YHT & Başkentray)", "TRAIN-ANK-GAR", "tren", 32.8434, 39.9367),
                            ("Atatürk Kültür Merkezi (AKM)", "METRO-ANK-AKM", "metro", 32.8427, 39.9482),
                            ("ASKİ Metro İstasyonu", "METRO-ANK-ASK", "metro", 32.8456, 39.9578),
                            ("Dışkapı Metro İstasyonu", "METRO-ANK-DSK", "metro", 32.8612, 39.9623),
                            ("Meteoroloji Metro İstasyonu", "METRO-ANK-MTR", "metro", 32.8712, 39.9678),
                            ("Keçiören Belediye İstasyonu", "METRO-ANK-KCB", "metro", 32.8789, 39.9745),
                            ("Mecidiye Metro İstasyonu", "METRO-ANK-MCD", "metro", 32.8845, 39.9812),
                            ("Kuyubaşı Metro İstasyonu", "METRO-ANK-KYB", "metro", 32.8889, 39.9889),
                            ("Dutluk Metro İstasyonu", "METRO-ANK-DTL", "metro", 32.8934, 39.9956),
                            ("Şehitler Keçiören Terminali", "METRO-ANK-SHT", "metro", 32.8989, 40.0012)
                        }
                    ),
                    (
                        Name: "A1 Ankaray AŞTİ - Dikimevi Hattı (Ankara)",
                        RouteClass: "metro",
                        Color: "#059669",
                        Desc: "Ankara A1 Ankaray Hafif Raylı Sistemi",
                        Stops: new[]
                        {
                            ("AŞTİ Şehirlerarası Otobüs Terminali", "ROAD-ANK-ASTI", "araba", 32.8134, 39.9178),
                            ("Emek Ankaray İstasyonu", "METRO-ANK-EMK", "metro", 32.8212, 39.9212),
                            ("Bahçelievler İstasyonu", "METRO-ANK-BHC", "metro", 32.8289, 39.9234),
                            ("Beşevler İstasyonu", "METRO-ANK-BSV", "metro", 32.8367, 39.9267),
                            ("Anadolu / Tandoğan Meydanı", "METRO-ANK-AND", "metro", 32.8434, 39.9289),
                            ("Maltepe Ankaray İstasyonu", "METRO-ANK-MLT", "metro", 32.8478, 39.9267),
                            ("Demirtepe İstasyonu", "METRO-ANK-DMR", "metro", 32.8512, 39.9234),
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "metro", 32.8543, 39.9208),
                            ("Kolej Ankaray İstasyonu", "METRO-ANK-KLJ", "metro", 32.8612, 39.9234),
                            ("Kurtuluş Aktarma İstasyonu", "METRO-ANK-KRT", "metro", 32.8678, 39.9267),
                            ("Dikimevi Ankaray Terminali", "METRO-ANK-DKM", "metro", 32.8745, 39.9301)
                        }
                    ),
                    (
                        Name: "B1 Başkentray Sincan - Kayaş Banliyö Hattı",
                        RouteClass: "tren",
                        Color: "#f59e0b",
                        Desc: "TCDD Başkentray Doğu-Batı Banliyö Tren Koridoru",
                        Stops: new[]
                        {
                            ("Sincan Tren Garı", "TRAIN-ANK-SNC", "tren", 32.5789, 39.9589),
                            ("Etimesgut Gar İstasyonu", "TRAIN-ANK-ETM", "tren", 32.6789, 39.9489),
                            ("Eryaman YHT Garı", "TRAIN-ANK-ERY", "tren", 32.6989, 39.9456),
                            ("Ankara Garı (YHT & Başkentray)", "TRAIN-ANK-GAR", "tren", 32.8434, 39.9367),
                            ("Sıhhiye İstasyonu (Ankara)", "METRO-ANK-SHY", "metro", 32.8539, 39.9298),
                            ("Kurtuluş Aktarma İstasyonu", "METRO-ANK-KRT", "metro", 32.8678, 39.9267),
                            ("Cebeci Tren İstasyonu", "TRAIN-ANK-CBC", "tren", 32.8745, 39.9289),
                            ("Demirlibahçe İstasyonu", "TRAIN-ANK-DMR", "tren", 32.8856, 39.9278),
                            ("Mamak Tren İstasyonu", "TRAIN-ANK-MMK", "tren", 32.9089, 39.9245),
                            ("Kayaş Banliyö Terminali", "TRAIN-ANK-KYS", "tren", 32.9789, 39.9123)
                        }
                    ),
                    (
                        Name: "EGO 185 Kızılay - Oran Sitesi Otobüs Hattı",
                        RouteClass: "otobus",
                        Color: "#0ea5e9",
                        Desc: "Ankara EGO 185 Kızılay - Çankaya - Oran Ekspres Hattı",
                        Stops: new[]
                        {
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "otobus", 32.8543, 39.9208),
                            ("Bakanlıklar EGO Durağı", "BUS-ANK-BKN", "otobus", 32.8534, 39.9134),
                            ("Kuğulu Park & Tunalı Hilmi", "BUS-ANK-KGL", "otobus", 32.8567, 39.8978),
                            ("Atakule & Botanik Parkı", "BUS-ANK-ATK", "otobus", 32.8589, 39.8856),
                            ("Turan Güneş Bulvarı Durağı", "BUS-ANK-TGN", "otobus", 32.8512, 39.8656),
                            ("TRT Genel Müdürlüğü Durağı", "BUS-ANK-TRT", "otobus", 32.8456, 39.8534),
                            ("Oran Sitesi Son Durak", "BUS-ANK-ORN", "otobus", 32.8389, 39.8456)
                        }
                    ),
                    (
                        Name: "EGO 413 Kızılay - Altınpark - Keçiören",
                        RouteClass: "otobus",
                        Color: "#0ea5e9",
                        Desc: "Ankara EGO 413 Kızılay - Sıhhiye - Dışkapı - Keçiören Hattı",
                        Stops: new[]
                        {
                            ("15 Temmuz Kızılay Milli İrade", "METRO-ANK-KZY", "otobus", 32.8543, 39.9208),
                            ("Sıhhiye İstasyonu (Ankara)", "METRO-ANK-SHY", "otobus", 32.8539, 39.9298),
                            ("Ulus Metro İstasyonu", "METRO-ANK-ULS", "otobus", 32.8542, 39.9419),
                            ("Dışkapı Metro İstasyonu", "METRO-ANK-DSK", "otobus", 32.8612, 39.9623),
                            ("Altınpark EGO Durağı", "BUS-ANK-ALT", "otobus", 32.8789, 39.9712),
                            ("Aydınlıkevler Durağı", "BUS-ANK-AYD", "otobus", 32.8856, 39.9789),
                            ("Keçiören Gazino Son Durak", "BUS-ANK-GZN", "otobus", 32.8956, 39.9912)
                        }
                    )
                };

                foreach (var ar in ankaraRoutes)
                {
                    var existingRoute = await context.Routes.Include(r => r.Stops).FirstOrDefaultAsync(r => r.Name == ar.Name);
                    if (existingRoute == null)
                    {
                        var coordStrings = ar.Stops.Select(s => $"{s.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {s.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}");
                        var routeWkt = $"LINESTRING({string.Join(", ", coordStrings)})";

                        existingRoute = new RouteFeature
                        {
                            Name = ar.Name,
                            RouteClass = ar.RouteClass,
                            Color = ar.Color,
                            Description = ar.Desc,
                            Wkt = routeWkt,
                            IsActive = true,
                            IsDeleted = false,
                            CreatedDate = DateTime.UtcNow,
                            ModifiedDate = DateTime.UtcNow
                        };
                        try { existingRoute.Geometry = wktReader.Read(routeWkt); } catch { }
                        context.Routes.Add(existingRoute);
                        await context.SaveChangesAsync();
                    }

                    int order = 1;
                    foreach (var st in ar.Stops)
                    {
                        var existingStop = await context.Stops
                            .FirstOrDefaultAsync(s => s.StopCode == st.Code || s.Name == st.Name);

                        if (existingStop == null)
                        {
                            var wkt = $"POINT({st.Lon.ToString(System.Globalization.CultureInfo.InvariantCulture)} {st.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
                            NetTopologySuite.Geometries.Point? geom = null;
                            try { geom = (NetTopologySuite.Geometries.Point)wktReader.Read(wkt); } catch { }

                            existingStop = new StopFeature
                            {
                                Name = st.Name,
                                StopCode = st.Code,
                                StopClass = st.Class,
                                RouteId = existingRoute.Id,
                                OrderIndex = order,
                                Description = $"{st.Name} Aktarma Noktası",
                                Wkt = wkt,
                                Geometry = geom,
                                IsActive = true,
                                IsDeleted = false,
                                CreatedDate = DateTime.UtcNow,
                                ModifiedDate = DateTime.UtcNow
                            };
                            context.Stops.Add(existingStop);
                            await context.SaveChangesAsync();
                        }
                        else
                        {
                            // Sınıf veya kodu güncelle
                            if (string.IsNullOrEmpty(existingStop.StopCode))
                            {
                                existingStop.StopCode = st.Code;
                            }
                        }

                        // Çoklu Güzergah Junction (tbl_route_stop) Ekle
                        var existingJunction = await context.RouteStops
                            .FirstOrDefaultAsync(rs => rs.RouteId == existingRoute.Id && rs.StopId == existingStop.Id);

                        if (existingJunction == null)
                        {
                            context.RouteStops.Add(new RouteStopFeature
                            {
                                RouteId = existingRoute.Id,
                                StopId = existingStop.Id,
                                OrderIndex = order,
                                CreatedDate = DateTime.UtcNow
                            });
                        }
                        order++;
                    }
                    await context.SaveChangesAsync();
                }

                Console.WriteLine("[DbSeeder] Ankara Metro, Ankaray, Başkentray ve EGO hatları çoklu aktarma bağlantılarıyla başarıyla işlendi.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbSeeder] Ankara transit seed error: {ex.Message}");
            }
        }
    }
}
