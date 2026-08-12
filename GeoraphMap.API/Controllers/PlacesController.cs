using GeoraphMap.Core;
using GeoraphMap.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PlacesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;
        private readonly WKTWriter _wktWriter;

        public PlacesController(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
            _wktWriter = new WKTWriter();
        }

        public class CreatePlaceDto
        {
            public string Name { get; set; } = string.Empty;
            public double Longitude { get; set; }
            public double Latitude { get; set; }
            public string? Wkt { get; set; }
        }

        public class PlaceResponseDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public double Longitude { get; set; }
            public double Latitude { get; set; }
            public string Wkt { get; set; } = string.Empty;
            public DateTime ModifiedDate { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetPlaces()
        {
            var places = await _context.Places
                .Where(p => !p.IsDeleted)
                .Select(p => new PlaceResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Longitude = p.Location != null ? p.Location.X : 0,
                    Latitude = p.Location != null ? p.Location.Y : 0,
                    Wkt = !string.IsNullOrEmpty(p.Wkt) ? p.Wkt : (p.Location != null ? $"POINT({p.Location.X.ToString(CultureInfo.InvariantCulture)} {p.Location.Y.ToString(CultureInfo.InvariantCulture)})" : ""),
                    ModifiedDate = p.ModifiedDate
                })
                .ToListAsync();

            return Ok(places);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePlace([FromBody] CreatePlaceDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { Message = "Mekan adı boş olamaz." });
            }

            Point pointGeom;
            string wktStr;

            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                try
                {
                    var geom = _wktReader.Read(dto.Wkt);
                    if (geom is not Point pGeom)
                        return BadRequest(new { Message = "Geçersiz WKT Nokta formatı." });

                    pointGeom = pGeom;
                    pointGeom.SRID = 4326;
                    wktStr = dto.Wkt;
                }
                catch (Exception ex)
                {
                    return BadRequest(new { Message = $"WKT ayrıştırma hatası: {ex.Message}" });
                }
            }
            else
            {
                pointGeom = new Point(dto.Longitude, dto.Latitude) { SRID = 4326 };
                wktStr = string.Create(CultureInfo.InvariantCulture, $"POINT({dto.Longitude} {dto.Latitude})");
            }

            var place = new Place
            {
                Name = dto.Name,
                Wkt = wktStr,
                Location = pointGeom,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Places.Add(place);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                Message = "Nokta konumu veritabanına başarıyla kaydedildi.",
                Place = new PlaceResponseDto
                {
                    Id = place.Id,
                    Name = place.Name,
                    Longitude = place.Location.X,
                    Latitude = place.Location.Y,
                    Wkt = place.Wkt,
                    ModifiedDate = place.ModifiedDate
                }
            });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlace(int id)
        {
            var place = await _context.Places.FindAsync(id);
            if (place == null)
                return NotFound(new { Message = "Konum bulunamadı." });

            place.IsDeleted = true;
            place.IsActive = false;
            place.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Konum başarıyla silindi." });
        }
    }
}