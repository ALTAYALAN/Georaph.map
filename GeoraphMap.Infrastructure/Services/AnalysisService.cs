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

        public async Task<InventoryAnalysisResultDto> AnalyzePolygonInventoryAsync(string polygonWkt)
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

            // Places (tbl_place) kesişim hesabı
            var intersectedPlaces = await _context.Places
                .Where(p => !p.IsDeleted && p.IsActive && p.Location != null && p.Location.Intersects(targetGeom))
                .Select(p => p.Name)
                .ToListAsync();

            // PointFeatures (tbl_point) kesişim hesabı
            var intersectedPoints = await _context.Points
                .Where(pt => !pt.IsDeleted && pt.IsActive && pt.Geometry != null && pt.Geometry.Intersects(targetGeom))
                .Select(pt => pt.Name)
                .ToListAsync();

            // LineFeatures (tbl_line) kesişim hesabı
            var intersectedLines = await _context.Lines
                .Where(l => !l.IsDeleted && l.IsActive && l.Geometry != null && l.Geometry.Intersects(targetGeom))
                .Select(l => l.Name)
                .ToListAsync();

            // PolygonFeatures (tbl_polygon) kesişim hesabı
            var intersectedPolygons = await _context.Polygons
                .Where(pg => !pg.IsDeleted && pg.IsActive && pg.Geometry != null && pg.Geometry.Intersects(targetGeom))
                .Select(pg => pg.Name)
                .ToListAsync();

            var details = new List<string>();
            foreach (var name in intersectedPlaces) details.Add($"[Nokta] {name}");
            foreach (var name in intersectedPoints) details.Add($"[Nokta] {name}");
            foreach (var name in intersectedLines) details.Add($"[Çizgi] {name}");
            foreach (var name in intersectedPolygons) details.Add($"[Poligon] {name}");

            int pointsTotalCount = intersectedPlaces.Count + intersectedPoints.Count;
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
