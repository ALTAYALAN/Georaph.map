using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure.Services
{
    public class PoiService : IPoiService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;

        public PoiService(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
        }

        #region Kategori İşlemleri

        private async Task EnsureDefaultCategoriesSeededAsync()
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE tbl_poi ADD COLUMN IF NOT EXISTS image_url TEXT;
            ");

            if (await _context.PoiCategories.AnyAsync(c => !c.IsDeleted)) return;

            try
            {
                // 1. Yeme-İçme
                var foodCat = new PoiCategory { Name = "Yeme-İçme", Description = "Restoran, kafe ve gıda işletmeleri", Icon = "fa-utensils", Color = "#f59e0b" };
                _context.PoiCategories.Add(foodCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Restoran", Description = "Yemek servis mekanları", ParentId = foodCat.Id, Icon = "fa-utensils", Color = "#f59e0b" },
                    new PoiCategory { Name = "Kafe", Description = "Kahve ve dinlenme mekanları", ParentId = foodCat.Id, Icon = "fa-coffee", Color = "#d97706" },
                    new PoiCategory { Name = "Fast Food", Description = "Hızlı yemek ve atıştırmalık", ParentId = foodCat.Id, Icon = "fa-burger", Color = "#b45309" }
                );

                // 2. Sağlık
                var healthCat = new PoiCategory { Name = "Sağlık", Description = "Hastaneler, klinikler ve eczaneler", Icon = "fa-heartbeat", Color = "#ef4444" };
                _context.PoiCategories.Add(healthCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Hastane", Description = "Devlet ve Özel Hastaneler", ParentId = healthCat.Id, Icon = "fa-hospital", Color = "#ef4444" },
                    new PoiCategory { Name = "Eczane", Description = "İlaç ve medikal noktaları", ParentId = healthCat.Id, Icon = "fa-prescription-bottle-alt", Color = "#dc2626" },
                    new PoiCategory { Name = "Klinik & Sağlık Ocağı", Description = "A tipi poliklinik ve ASM", ParentId = healthCat.Id, Icon = "fa-stethoscope", Color = "#991b1b" }
                );

                // 3. Eğitim
                var eduCat = new PoiCategory { Name = "Eğitim", Description = "Okullar, kütüphaneler ve üniversiteler", Icon = "fa-graduation-cap", Color = "#3b82f6" };
                _context.PoiCategories.Add(eduCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Okul", Description = "İlk, orta ve lise eğitim kurumları", ParentId = eduCat.Id, Icon = "fa-school", Color = "#3b82f6" },
                    new PoiCategory { Name = "Üniversite & Kampüs", Description = "Yükseköğretim kurumları", ParentId = eduCat.Id, Icon = "fa-university", Color = "#2563eb" },
                    new PoiCategory { Name = "Kütüphane", Description = "Halk ve araştırma kütüphaneleri", ParentId = eduCat.Id, Icon = "fa-book-reader", Color = "#1d4ed8" }
                );

                // 4. Kamu & Hizmet
                var pubCat = new PoiCategory { Name = "Kamu & Hizmet", Description = "Resmi kurumlar ve belediye hizmetleri", Icon = "fa-landmark", Color = "#8b5cf6" };
                _context.PoiCategories.Add(pubCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Belediye & Kaymakamlık", Description = "Yerel yönetim binaları", ParentId = pubCat.Id, Icon = "fa-landmark", Color = "#8b5cf6" },
                    new PoiCategory { Name = "Muhtarlık", Description = "Mahalle muhtarlıkları", ParentId = pubCat.Id, Icon = "fa-building", Color = "#7c3aed" },
                    new PoiCategory { Name = "Postane / Kargo", Description = "PTT ve kargo şubeleri", ParentId = pubCat.Id, Icon = "fa-envelope", Color = "#6d28d9" }
                );

                // 5. Ulaşım & Altyapı
                var transCat = new PoiCategory { Name = "Ulaşım", Description = "Toplu taşıma ve otopark alanları", Icon = "fa-bus", Color = "#10b981" };
                _context.PoiCategories.Add(transCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Otogar / Terminal", Description = "Şehirlerarası ve ilçe otogarları", ParentId = transCat.Id, Icon = "fa-bus", Color = "#10b981" },
                    new PoiCategory { Name = "Metro / Tren İstasyonu", Description = "Raylı sistem istasyonları", ParentId = transCat.Id, Icon = "fa-train", Color = "#059669" },
                    new PoiCategory { Name = "Otopark", Description = "Açık ve kapalı otopark alanları", ParentId = transCat.Id, Icon = "fa-parking", Color = "#047857" }
                );

                // 6. Kültür & Turizm
                var cultureCat = new PoiCategory { Name = "Kültür & Turizm", Description = "Müzeler, ören yerleri, tarihi yapılar ve sanat merkezleri", Icon = "fa-landmark", Color = "#8b5cf6" };
                _context.PoiCategories.Add(cultureCat);
                await _context.SaveChangesAsync();

                _context.PoiCategories.AddRange(
                    new PoiCategory { Name = "Müze", Description = "Tarih, arkeoloji, etnografya ve sanat müzeleri", ParentId = cultureCat.Id, Icon = "fa-landmark", Color = "#8b5cf6" },
                    new PoiCategory { Name = "Ören Yeri & Antik Kent", Description = "Tarihi açık hava yerleşimleri ve arkeolojik alanlar", ParentId = cultureCat.Id, Icon = "fa-monument", Color = "#a855f7" },
                    new PoiCategory { Name = "Sanat Galerisi", Description = "Resim, heykel ve çağdaş sanat sergi merkezleri", ParentId = cultureCat.Id, Icon = "fa-palette", Color = "#7c3aed" }
                );

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PoiService] Category auto-seeding error: {ex.Message}");
            }
        }

        public async Task<List<PoiCategoryDto>> GetAllCategoriesAsync(bool includeInactive = false)
        {
            await EnsureDefaultCategoriesSeededAsync();

            var query = _context.PoiCategories
                .AsNoTracking()
                .Include(c => c.Parent)
                .Include(c => c.Pois)
                .Where(c => !c.IsDeleted);

            if (!includeInactive)
            {
                query = query.Where(c => c.IsActive);
            }

            var list = await query
                .OrderBy(c => c.ParentId.HasValue)
                .ThenBy(c => c.DisplayOrder)
                .ThenBy(c => c.Name)
                .ToListAsync();

            return list.Select(c => new PoiCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                Icon = c.Icon ?? "fa-map-pin",
                Color = c.Color ?? "#3b82f6",
                ParentId = c.ParentId,
                ParentName = c.Parent?.Name,
                DisplayOrder = c.DisplayOrder,
                IsActive = c.IsActive,
                IsDeleted = c.IsDeleted,
                CreatedDate = c.CreatedDate,
                PoiCount = c.Pois.Count(p => !p.IsDeleted)
            }).ToList();
        }

        public async Task<List<PoiCategoryTreeDto>> GetCategoryTreeAsync()
        {
            var allCategories = await _context.PoiCategories
                .AsNoTracking()
                .Include(c => c.Pois)
                .Where(c => !c.IsDeleted && c.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .ThenBy(c => c.Name)
                .ToListAsync();

            var roots = allCategories.Where(c => c.ParentId == null).ToList();

            var tree = roots.Select(r => BuildCategoryTreeNode(r, allCategories)).ToList();
            return tree;
        }

        private PoiCategoryTreeDto BuildCategoryTreeNode(PoiCategory current, List<PoiCategory> allCategories)
        {
            var children = allCategories
                .Where(c => c.ParentId == current.Id)
                .OrderBy(c => c.DisplayOrder)
                .ThenBy(c => c.Name)
                .ToList();

            return new PoiCategoryTreeDto
            {
                Id = current.Id,
                Name = current.Name,
                Description = current.Description,
                Icon = current.Icon ?? "fa-map-pin",
                Color = current.Color ?? "#3b82f6",
                ParentId = current.ParentId,
                DisplayOrder = current.DisplayOrder,
                IsActive = current.IsActive,
                PoiCount = current.Pois.Count(p => !p.IsDeleted),
                Children = children.Select(c => BuildCategoryTreeNode(c, allCategories)).ToList()
            };
        }

        public async Task<PoiCategoryDto?> GetCategoryByIdAsync(int id)
        {
            var c = await _context.PoiCategories
                .AsNoTracking()
                .Include(c => c.Parent)
                .Include(c => c.Pois)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (c == null) return null;

            return new PoiCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                Icon = c.Icon ?? "fa-map-pin",
                Color = c.Color ?? "#3b82f6",
                ParentId = c.ParentId,
                ParentName = c.Parent?.Name,
                DisplayOrder = c.DisplayOrder,
                IsActive = c.IsActive,
                IsDeleted = c.IsDeleted,
                CreatedDate = c.CreatedDate,
                PoiCount = c.Pois.Count(p => !p.IsDeleted)
            };
        }

        public async Task<PoiCategoryDto> CreateCategoryAsync(CreatePoiCategoryDto dto)
        {
            var category = new PoiCategory
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                Icon = string.IsNullOrWhiteSpace(dto.Icon) ? "fa-map-pin" : dto.Icon.Trim(),
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color.Trim(),
                ParentId = dto.ParentId,
                DisplayOrder = dto.DisplayOrder > 0 ? dto.DisplayOrder : 1,
                IsActive = dto.IsActive,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            _context.PoiCategories.Add(category);
            await contextSaveAsync();

            return (await GetCategoryByIdAsync(category.Id))!;
        }

        public async Task<PoiCategoryDto?> UpdateCategoryAsync(int id, UpdatePoiCategoryDto dto)
        {
            var category = await _context.PoiCategories
                .Include(c => c.Children)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
            if (category == null) return null;

            int newDisplayOrder = dto.DisplayOrder > 0 ? dto.DisplayOrder : 1;
            bool displayOrderChanged = category.DisplayOrder != newDisplayOrder;

            category.Name = dto.Name.Trim();
            category.Description = dto.Description?.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Icon)) category.Icon = dto.Icon.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Color)) category.Color = dto.Color.Trim();
            category.DisplayOrder = newDisplayOrder;
            
            // Döngüsel hiyerarşiyi engellemek için kendi ID'sini Parent olarak seçemez
            if (dto.ParentId != id)
            {
                category.ParentId = dto.ParentId;
            }
            category.IsActive = dto.IsActive;
            category.ModifiedDate = DateTime.UtcNow;

            // Ana kategorinin önceliği değiştiğinde tüm alt kategorilerin önceliğini de kaskad olarak güncelle
            if (displayOrderChanged)
            {
                await CascadeUpdateChildDisplayOrdersAsync(category.Id, newDisplayOrder);
            }

            await contextSaveAsync();
            return (await GetCategoryByIdAsync(category.Id));
        }

        private async Task CascadeUpdateChildDisplayOrdersAsync(int parentId, int newDisplayOrder)
        {
            var children = await _context.PoiCategories
                .Where(c => c.ParentId == parentId && !c.IsDeleted)
                .ToListAsync();

            foreach (var child in children)
            {
                child.DisplayOrder = newDisplayOrder;
                child.ModifiedDate = DateTime.UtcNow;
                await CascadeUpdateChildDisplayOrdersAsync(child.Id, newDisplayOrder);
            }
        }

        public async Task<bool> DeleteCategoryAsync(int id)
        {
            var category = await _context.PoiCategories
                .Include(c => c.Children)
                .Include(c => c.Pois)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (category == null) return false;

            // Alt kategorileri ve bağlı POI'leri kontrol et / soft delete
            category.IsDeleted = true;
            category.IsActive = false;
            category.ModifiedDate = DateTime.UtcNow;

            // Alt kategorileri de soft delete yap
            foreach (var child in category.Children.Where(c => !c.IsDeleted))
            {
                child.IsDeleted = true;
                child.IsActive = false;
                child.ModifiedDate = DateTime.UtcNow;
            }

            await contextSaveAsync();
            return true;
        }

        #endregion

        #region POI İşlemleri

        public async Task<List<PoiDto>> GetAllPoisAsync(int userId, string userRole, int? categoryId = null, bool includeInactive = false)
        {
            var query = _context.Pois
                .AsNoTracking()
                .Include(p => p.Category)
                    .ThenInclude(c => c.Parent)
                .Include(p => p.User)
                .Where(p => !p.IsDeleted);

            if (!includeInactive)
            {
                query = query.Where(p => p.IsActive);
            }

            if (categoryId.HasValue && categoryId.Value > 0)
            {
                // Seçilen kategori veya onun alt kategorilerine ait POI'ler
                var subCategoryIds = await _context.PoiCategories
                    .Where(c => c.ParentId == categoryId.Value && !c.IsDeleted)
                    .Select(c => c.Id)
                    .ToListAsync();
                subCategoryIds.Add(categoryId.Value);

                query = query.Where(p => subCategoryIds.Contains(p.CategoryId));
            }

            var pois = await query.OrderByDescending(p => p.CreatedDate).ToListAsync();

            return pois.Select(p => MapToPoiDto(p)).ToList();
        }

        public async Task<PoiDto?> GetPoiByIdAsync(int id)
        {
            var p = await _context.Pois
                .AsNoTracking()
                .Include(p => p.Category)
                    .ThenInclude(c => c.Parent)
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (p == null) return null;
            return MapToPoiDto(p);
        }

        public async Task<PoiDto> CreatePoiAsync(CreatePoiDto dto, int userId)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("POI konumu (WKT) boş olamaz.");

            Geometry geometry;
            try
            {
                var geom = _wktReader.Read(dto.Wkt);
                geom.SRID = 4326;
                geometry = geom;
            }
            catch (Exception ex)
            {
                throw new ArgumentException($"Geçersiz WKT formatı: {ex.Message}");
            }

            var poi = new Poi
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                CategoryId = dto.CategoryId,
                WorkingHours = dto.WorkingHours?.Trim(),
                ImageUrl = dto.ImageUrl?.Trim(),
                Wkt = dto.Wkt.Trim(),
                Geometry = geometry,
                UserId = userId,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Pois.Add(poi);
            await contextSaveAsync();

            return (await GetPoiByIdAsync(poi.Id))!;
        }

        public async Task<PoiDto?> UpdatePoiAsync(int id, UpdatePoiDto dto, int userId, string userRole)
        {
            var poi = await _context.Pois.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (poi == null) return null;

            bool isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase);
            if (!isAdmin && poi.UserId != userId && userId != 0)
            {
                throw new UnauthorizedAccessException("Bu POI'yi güncelleme yetkiniz bulunmamaktadır.");
            }

            poi.Name = dto.Name.Trim();
            poi.Description = dto.Description?.Trim();
            poi.CategoryId = dto.CategoryId;
            poi.WorkingHours = dto.WorkingHours?.Trim();
            poi.ImageUrl = dto.ImageUrl?.Trim();
            poi.IsActive = dto.IsActive;
            poi.ModifiedDate = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(dto.Wkt) && dto.Wkt != poi.Wkt)
            {
                var geom = _wktReader.Read(dto.Wkt);
                geom.SRID = 4326;
                poi.Geometry = geom;
                poi.Wkt = dto.Wkt.Trim();
            }

            await contextSaveAsync();
            return await GetPoiByIdAsync(poi.Id);
        }

        public async Task<bool> DeletePoiAsync(int id, int userId, string userRole)
        {
            var poi = await _context.Pois.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (poi == null) return false;

            bool isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase);
            if (!isAdmin && poi.UserId != userId && userId != 0)
            {
                throw new UnauthorizedAccessException("Bu POI'yi silme yetkiniz bulunmamaktadır.");
            }

            poi.IsDeleted = true;
            poi.IsActive = false;
            poi.ModifiedDate = DateTime.UtcNow;

            await contextSaveAsync();
            return true;
        }

        #endregion

        #region Yardımcı Metotlar

        private static PoiDto MapToPoiDto(Poi p)
        {
            double lon = 0, lat = 0;
            if (p.Geometry != null)
            {
                var centroid = p.Geometry.Centroid;
                if (centroid != null)
                {
                    lon = centroid.X;
                    lat = centroid.Y;
                }
                else if (p.Geometry.Coordinate != null)
                {
                    lon = p.Geometry.Coordinate.X;
                    lat = p.Geometry.Coordinate.Y;
                }
            }

            return new PoiDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                CategoryId = p.CategoryId,
                CategoryName = p.Category?.Name ?? "Genel",
                ParentCategoryName = p.Category?.Parent?.Name,
                CategoryColor = p.Category?.Color ?? "#3b82f6",
                CategoryIcon = p.Category?.Icon ?? "fa-map-pin",
                CategoryDisplayOrder = p.Category?.DisplayOrder ?? 1,
                WorkingHours = p.WorkingHours,
                ImageUrl = p.ImageUrl,
                Wkt = p.Wkt,
                Longitude = lon,
                Latitude = lat,
                UserId = p.UserId,
                Username = p.User?.Username ?? "Sistem",
                IsActive = p.IsActive,
                IsDeleted = p.IsDeleted,
                CreatedDate = p.CreatedDate,
                ModifiedDate = p.ModifiedDate
            };
        }

        private async Task contextSaveAsync()
        {
            await _context.SaveChangesAsync();
        }

        #endregion
    }
}
