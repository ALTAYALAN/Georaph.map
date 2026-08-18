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
    }
}
