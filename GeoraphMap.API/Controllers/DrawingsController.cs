using GeoraphMap.Core;
using GeoraphMap.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DrawingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;
        private readonly WKTWriter _wktWriter;

        public DrawingsController(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
            _wktWriter = new WKTWriter();
        }

        public class CreateDrawingDto
        {
            public string Name { get; set; } = string.Empty;
            public string Wkt { get; set; } = string.Empty;
        }

        public class DrawingResponseDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public string Wkt { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty; // Line, Polygon
            public DateTime ModifiedDate { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllDrawings()
        {
            var lines = await _context.Lines
                .Where(l => !l.IsDeleted && l.IsActive)
                .Select(l => new DrawingResponseDto
                {
                    Id = l.Id,
                    Name = string.IsNullOrEmpty(l.Name) ? $"Çizgi #{l.Id}" : l.Name,
                    Wkt = l.Wkt != "" ? l.Wkt : _wktWriter.Write(l.Geometry),
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
                    Wkt = pg.Wkt != "" ? pg.Wkt : _wktWriter.Write(pg.Geometry),
                    Type = "Polygon",
                    ModifiedDate = pg.ModifiedDate
                })
                .ToListAsync();

            var result = new List<DrawingResponseDto>();
            result.AddRange(lines);
            result.AddRange(polygons);

            return Ok(result);
        }

        [HttpPost("line")]
        public async Task<IActionResult> CreateLine([FromBody] CreateDrawingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                return BadRequest(new { Message = "WKT verisi boş olamaz." });

            try
            {
                var geom = _wktReader.Read(dto.Wkt);
                if (geom is not LineString lineGeom)
                    return BadRequest(new { Message = "Girdi geçerli bir LineString WKT verisi değil." });

                lineGeom.SRID = 4326;

                var entity = new LineFeature
                {
                    Name = dto.Name,
                    Wkt = dto.Wkt,
                    Geometry = lineGeom,
                    IsActive = true,
                    IsDeleted = false,
                    ModifiedDate = DateTime.UtcNow
                };

                _context.Lines.Add(entity);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Çizgi veritabanına (tbl_line) başarıyla kaydedildi.",
                    Data = new DrawingResponseDto
                    {
                        Id = entity.Id,
                        Name = entity.Name,
                        Wkt = entity.Wkt,
                        Type = "Line",
                        ModifiedDate = entity.ModifiedDate
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = $"WKT ayrıştırma hatası: {ex.Message}" });
            }
        }

        [HttpPost("polygon")]
        public async Task<IActionResult> CreatePolygon([FromBody] CreateDrawingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                return BadRequest(new { Message = "WKT verisi boş olamaz." });

            try
            {
                var geom = _wktReader.Read(dto.Wkt);
                if (geom is not Polygon polygonGeom)
                    return BadRequest(new { Message = "Girdi geçerli bir Polygon WKT verisi değil." });

                polygonGeom.SRID = 4326;

                var entity = new PolygonFeature
                {
                    Name = dto.Name,
                    Wkt = dto.Wkt,
                    Geometry = polygonGeom,
                    IsActive = true,
                    IsDeleted = false,
                    ModifiedDate = DateTime.UtcNow
                };

                _context.Polygons.Add(entity);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Poligon veritabanına (tbl_polygon) başarıyla kaydedildi.",
                    Data = new DrawingResponseDto
                    {
                        Id = entity.Id,
                        Name = entity.Name,
                        Wkt = entity.Wkt,
                        Type = "Polygon",
                        ModifiedDate = entity.ModifiedDate
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = $"WKT ayrıştırma hatası: {ex.Message}" });
            }
        }

        [HttpDelete("{type}/{id}")]
        public async Task<IActionResult> DeleteDrawing(string type, int id)
        {
            switch (type.ToLower())
            {
                case "line":
                    var l = await _context.Lines.FindAsync(id);
                    if (l == null) return NotFound();
                    l.IsDeleted = true;
                    l.IsActive = false;
                    l.ModifiedDate = DateTime.UtcNow;
                    break;

                case "polygon":
                    var pg = await _context.Polygons.FindAsync(id);
                    if (pg == null) return NotFound();
                    pg.IsDeleted = true;
                    pg.IsActive = false;
                    pg.ModifiedDate = DateTime.UtcNow;
                    break;

                default:
                    return BadRequest(new { Message = "Geçersiz çizim tipi." });
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Çizim başarıyla silindi." });
        }
    }
}
