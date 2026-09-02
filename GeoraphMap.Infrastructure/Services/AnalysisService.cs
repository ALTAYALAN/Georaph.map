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
    public class AnalysisService : IAnalysisService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;

        public AnalysisService(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
        }

        public async Task<InventoryAnalysisResultDto> AnalyzePolygonInventoryAsync(string polygonWkt, int userId = 0, string userRole = "")
        {
            if (string.IsNullOrWhiteSpace(polygonWkt))
            {
                throw new ArgumentException("Poligon WKT verisi boş olamaz.");
            }

            Geometry targetGeom;
            try
            {
                targetGeom = _wktReader.Read(polygonWkt);
                targetGeom.SRID = 4326;
            }
            catch (Exception ex)
            {
                throw new ArgumentException($"WKT ayrıştırma hatası: {ex.Message}");
            }

            bool isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(userRole, "Administrator", StringComparison.OrdinalIgnoreCase);

            var pointsQuery = _context.Points.Where(pt => !pt.IsDeleted && pt.IsActive && pt.Geometry != null && pt.Geometry.Intersects(targetGeom));
            var linesQuery = _context.Lines.Where(l => !l.IsDeleted && l.IsActive && l.Geometry != null && l.Geometry.Intersects(targetGeom));
            var polygonsQuery = _context.Polygons.Where(pg => !pg.IsDeleted && pg.IsActive && pg.Geometry != null && pg.Geometry.Intersects(targetGeom));

            if (isAdmin)
            {
                // Admin kullanıcıları sistemdeki TÜM şekiller üzerinde envanter analizi yapar
            }
            else if (string.Equals(userRole, "Viewer", StringComparison.OrdinalIgnoreCase))
            {
                var editorUserIds = await _context.UserRoles
                    .Include(ur => ur.Role)
                    .Where(ur => ur.RoleId == 2 || (ur.Role != null && ur.Role.Name.Equals("Editor", StringComparison.OrdinalIgnoreCase)))
                    .Select(ur => ur.UserId)
                    .Distinct()
                    .ToListAsync();

                if (editorUserIds != null && editorUserIds.Any())
                {
                    pointsQuery = pointsQuery.Where(pt => editorUserIds.Contains(pt.InsertedUserId) || pt.InsertedUserId == 0);
                    linesQuery = linesQuery.Where(l => editorUserIds.Contains(l.InsertedUserId) || l.InsertedUserId == 0);
                    polygonsQuery = polygonsQuery.Where(pg => editorUserIds.Contains(pg.InsertedUserId) || pg.InsertedUserId == 0);
                }
            }
            else
            {
                // Editör kullanıcıları YALNIZCA kendi görebildiği/çizdiği şekiller üzerinde envanter analizi yapar
                pointsQuery = pointsQuery.Where(pt => pt.InsertedUserId == userId || pt.InsertedUserId == 0);
                linesQuery = linesQuery.Where(l => l.InsertedUserId == userId || l.InsertedUserId == 0);
                polygonsQuery = polygonsQuery.Where(pg => pg.InsertedUserId == userId || pg.InsertedUserId == 0);
            }

            var intersectedPoints = await pointsQuery.Select(pt => pt.Name).ToListAsync();
            var intersectedLines = await linesQuery.Select(l => l.Name).ToListAsync();
            var intersectedPolygons = await polygonsQuery.Select(pg => pg.Name).ToListAsync();

            var details = new List<string>();
            foreach (var name in intersectedPoints) details.Add($"[Nokta] {name}");
            foreach (var name in intersectedLines) details.Add($"[Çizgi] {name}");
            foreach (var name in intersectedPolygons) details.Add($"[Poligon] {name}");

            int pointsTotalCount = intersectedPoints.Count;
            int linesCount = intersectedLines.Count;
            int polygonsCount = intersectedPolygons.Count;
            int total = pointsTotalCount + linesCount + polygonsCount;

            return new InventoryAnalysisResultDto
            {
                TotalIntersectedCount = total,
                PlacesCount = 0,
                PointsCount = pointsTotalCount,
                LinesCount = linesCount,
                PolygonsCount = polygonsCount,
                Details = details
            };
        }

        public async Task<LocationAnalysisResultDto> AnalyzeLocationSuitabilityAsync(LocationAnalysisRequestDto dto, int userId = 0, string userRole = "")
        {
            if (dto == null)
            {
                throw new ArgumentException("Analiz parametreleri boş olamaz.");
            }

            // 1. Kriter Sayısı Doğrulaması (En az 2, en fazla 5)
            if (dto.Criteria == null || dto.Criteria.Count < 2 || dto.Criteria.Count > 5)
            {
                throw new ArgumentException("Kullanıcı analiz için en az 2, en fazla 5 adet kategori bazlı kriter eklemelidir.");
            }

            // 2. Puan Toplamı Doğrulaması (Tam olarak 100 olmalı)
            int totalScore = dto.Criteria.Sum(c => c.Weight);
            if (totalScore != 100)
            {
                throw new ArgumentException($"Her kritere 100 üzerinden bir ağırlık puanı verilmeli ve tüm kriterlerin puanları toplamı tam olarak 100 olmalıdır. Şu anki puan toplamı: {totalScore}. Puan toplamı 100'den farklı ise analiz başlatılamaz.");
            }

            // 3. Hedef Bölge / Alan Belirleme (İl veya Poligon Çizimi)
            string boundaryWkt = dto.BoundaryWkt?.Trim() ?? string.Empty;
            string boundaryName = dto.BoundaryName?.Trim() ?? "Seçilen Analiz Alanı";

            if (dto.CityPlate.HasValue && dto.CityPlate.Value > 0 && string.IsNullOrWhiteSpace(boundaryWkt))
            {
                var city = await _context.Cities.FirstOrDefaultAsync(c => c.Plate == dto.CityPlate.Value && !c.IsDeleted);
                if (city != null && !string.IsNullOrWhiteSpace(city.Wkt))
                {
                    boundaryWkt = city.Wkt;
                    boundaryName = $"{city.Name} İli";
                }
            }

            if (string.IsNullOrWhiteSpace(boundaryWkt))
            {
                throw new ArgumentException("Lütfen analiz yapılacak bir hedef bölge seçiniz (İller listesinden seçim yapın veya haritada poligon çizin).");
            }

            Geometry targetBoundaryGeom;
            try
            {
                targetBoundaryGeom = _wktReader.Read(boundaryWkt);
                targetBoundaryGeom.SRID = 4326;
            }
            catch (Exception ex)
            {
                throw new ArgumentException($"Hedef bölge geometrisi (WKT) okunamadı: {ex.Message}");
            }

            // 4. Tüm Kategorileri ve Hiyerarşilerini Çek
            var allCategories = await _context.PoiCategories
                .Where(c => !c.IsDeleted && c.IsActive)
                .ToListAsync();

            // 5. Yalnızca Seçilen Alan İçindeki POI'leri Getir (ST_Intersects)
            var intersectingPois = await _context.Pois
                .Include(p => p.Category)
                    .ThenInclude(c => c.Parent)
                .Where(p => !p.IsDeleted && p.IsActive && p.Geometry != null && p.Geometry.Intersects(targetBoundaryGeom))
                .ToListAsync();

            var analyzedPois = new List<AnalyzedPoiItemDto>();
            var criteriaSummaries = new List<CriterionSummaryDto>();

            // 6. Her Kriter İçin POI'leri Filtrele ve Ağırlıklı Puan Ataması Yap
            foreach (var criterion in dto.Criteria)
            {
                var targetCat = allCategories.FirstOrDefault(c => c.Id == criterion.CategoryId);
                string catName = !string.IsNullOrWhiteSpace(criterion.CategoryName) ? criterion.CategoryName : (targetCat?.Name ?? $"Kategori #{criterion.CategoryId}");
                string catColor = targetCat?.Color ?? "#3b82f6";
                string catIcon = targetCat?.Icon ?? "fa-map-pin";

                // Kategori ve alt kategorilerinin ID listesi
                var categoryIdList = new HashSet<int> { criterion.CategoryId };
                var childIds = allCategories.Where(c => c.ParentId == criterion.CategoryId).Select(c => c.Id);
                foreach (var cid in childIds) categoryIdList.Add(cid);

                // Bu kritere uyan POI'ler
                var matchingPois = intersectingPois.Where(p => categoryIdList.Contains(p.CategoryId)).ToList();

                double normalizedWeight = Math.Round((double)criterion.Weight / 100.0, 3);

                foreach (var p in matchingPois)
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

                    analyzedPois.Add(new AnalyzedPoiItemDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        CategoryId = p.CategoryId,
                        CategoryName = p.Category?.Name ?? catName,
                        CategoryColor = p.Category?.Color ?? catColor,
                        CategoryIcon = p.Category?.Icon ?? catIcon,
                        Weight = normalizedWeight, // Isı haritası için 0.0 - 1.0 arası ağırlık
                        CriterionScore = criterion.Weight, // Ham ağırlık puanı
                        Longitude = lon,
                        Latitude = lat,
                        Wkt = p.Wkt
                    });
                }

                criteriaSummaries.Add(new CriterionSummaryDto
                {
                    CategoryId = criterion.CategoryId,
                    CategoryName = catName,
                    CategoryColor = catColor,
                    CategoryIcon = catIcon,
                    Weight = criterion.Weight,
                    PoiCount = matchingPois.Count,
                    ContributionScore = matchingPois.Count > 0 ? criterion.Weight : 0
                });
            }

            // Toplam uygunluk skoru (mevcut kriterlerin karşılanma oranı)
            double overallScore = criteriaSummaries.Count > 0
                ? criteriaSummaries.Where(c => c.PoiCount > 0).Sum(c => c.Weight)
                : 0;

            return new LocationAnalysisResultDto
            {
                BoundaryName = boundaryName,
                BoundaryWkt = boundaryWkt,
                TotalPoiCount = analyzedPois.Count,
                OverallScore = overallScore,
                CriteriaSummaries = criteriaSummaries,
                AnalyzedPois = analyzedPois
            };
        }
    }
}
