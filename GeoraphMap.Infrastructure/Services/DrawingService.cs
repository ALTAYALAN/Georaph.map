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
    public class DrawingService : IDrawingService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;
        private readonly WKTWriter _wktWriter;

        public DrawingService(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
            _wktWriter = new WKTWriter();
        }

        public async Task<List<DrawingResponseDto>> GetAllDrawingsAsync()
        {
            var lines = await _context.Lines
                .Where(l => !l.IsDeleted && l.IsActive)
                .Select(l => new DrawingResponseDto
                {
                    Id = l.Id,
                    Name = string.IsNullOrEmpty(l.Name) ? $"Çizgi #{l.Id}" : l.Name,
                    Wkt = !string.IsNullOrEmpty(l.Wkt) ? l.Wkt : _wktWriter.Write(l.Geometry),
                    Color = string.IsNullOrEmpty(l.Color) ? "#3b82f6" : l.Color,
                    Type = "Line",
                    ModifiedDate = l.ModifiedDate
                })
                .ToListAsync();

            var polygons = await _context.Polygons
                .Where(pg => !pg.IsDeleted && pg.IsActive)
                .Select(pg => new DrawingResponseDto
                {
                    Id = pg.Id,
                    Name = string.IsNullOrEmpty(pg.Name) ? $"Poligon #{pg.Id}" : pg.Name,
                    Wkt = !string.IsNullOrEmpty(pg.Wkt) ? pg.Wkt : _wktWriter.Write(pg.Geometry),
                    Color = string.IsNullOrEmpty(pg.Color) ? "#3b82f6" : pg.Color,
                    Type = "Polygon",
                    ModifiedDate = pg.ModifiedDate
                })
                .ToListAsync();

            var points = await _context.Points
                .Where(pt => !pt.IsDeleted && pt.IsActive)
                .Select(pt => new DrawingResponseDto
                {
                    Id = pt.Id,
                    Name = string.IsNullOrEmpty(pt.Name) ? $"Nokta #{pt.Id}" : pt.Name,
                    Wkt = !string.IsNullOrEmpty(pt.Wkt) ? pt.Wkt : _wktWriter.Write(pt.Geometry),
                    Color = string.IsNullOrEmpty(pt.Color) ? "#3b82f6" : pt.Color,
                    Type = "Point",
                    ModifiedDate = pt.ModifiedDate
                })
                .ToListAsync();

            var result = new List<DrawingResponseDto>();
            result.AddRange(points);
            result.AddRange(lines);
            result.AddRange(polygons);

            return result;
        }

        public async Task<DrawingResponseDto> CreatePointAsync(CreateDrawingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not Point pointGeom)
                throw new ArgumentException("Girdi geçerli bir Point WKT verisi değil.");

            pointGeom.SRID = 4326;

            var entity = new PointFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Nokta" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = pointGeom,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Points.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Point",
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<DrawingResponseDto> CreateLineAsync(CreateDrawingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not LineString lineGeom)
                throw new ArgumentException("Girdi geçerli bir LineString WKT verisi değil.");

            lineGeom.SRID = 4326;

            var entity = new LineFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Çizgi" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = lineGeom,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Lines.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Line",
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<DrawingResponseDto> CreatePolygonAsync(CreateDrawingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not Polygon polygonGeom)
                throw new ArgumentException("Girdi geçerli bir Polygon WKT verisi değil.");

            polygonGeom.SRID = 4326;

            var entity = new PolygonFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Poligon" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = polygonGeom,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Polygons.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Polygon",
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<bool> DeleteDrawingAsync(string type, int id)
        {
            switch (type.ToLower())
            {
                case "line":
                    var l = await _context.Lines.FindAsync(id);
                    if (l == null) return false;
                    l.IsDeleted = true;
                    l.IsActive = false;
                    l.ModifiedDate = DateTime.UtcNow;
                    break;

                case "polygon":
                    var pg = await _context.Polygons.FindAsync(id);
                    if (pg == null) return false;
                    pg.IsDeleted = true;
                    pg.IsActive = false;
                    pg.ModifiedDate = DateTime.UtcNow;
                    break;

                case "point":
                    var pt = await _context.Points.FindAsync(id);
                    if (pt == null) return false;
                    pt.IsDeleted = true;
                    pt.IsActive = false;
                    pt.ModifiedDate = DateTime.UtcNow;
                    break;

                default:
                    throw new ArgumentException("Geçersiz çizim tipi.");
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
