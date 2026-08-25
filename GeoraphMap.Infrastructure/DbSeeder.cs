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
                    ALTER TABLE tbl_poi_category ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 1;

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

                    -- Poligon ve çoklu geometri türü desteği için geometry kısıtlamasını generic Geometry tipine dönüştür
                    DO $$
                    BEGIN
                        BEGIN
                            ALTER TABLE tbl_poi ALTER COLUMN geometry TYPE geometry(Geometry, 4326) USING ST_SetSRID(geometry, 4326);
                        EXCEPTION
                            WHEN OTHERS THEN
                                NULL;
                        END;
                    END $$;

                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM tbl_permission WHERE code = 'poi.create' OR id = 8) THEN
                            INSERT INTO tbl_permission (id, name, code, description)
                            VALUES (8, 'POI Ekleme', 'poi.create', 'Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi');
                        END IF;
                    END $$;
                ");
                Console.WriteLine("[DbSeeder] tbl_editor_collaboration, tbl_poi_category, tbl_poi ve tbl_permission doğrulandı.");

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

                    var adminRole = await context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
                    if (adminRole != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == poiPerm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = poiPerm.Id });
                    }

                    var editorRole = await context.Roles.FirstOrDefaultAsync(r => r.Id == 2 || r.Name == "Editor" || r.Name == "Editör");
                    if (editorRole != null && !await context.RolePermissions.AnyAsync(rp => rp.RoleId == editorRole.Id && rp.PermissionId == poiPerm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = editorRole.Id, PermissionId = poiPerm.Id });
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
