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
                        route_id INT NOT NULL REFERENCES tbl_route(id) ON DELETE CASCADE,
                        wkt TEXT NOT NULL,
                        geometry geometry(Point, 4326),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
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
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbSeeder] Table creation error: {ex.Message}");
            }
        }
    }
}
