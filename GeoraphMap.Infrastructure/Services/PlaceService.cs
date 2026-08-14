using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure.Services
{
    public class PlaceService : IPlaceService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;

        public PlaceService(AppDbContext context)
        {
            _context = context;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
        }

        public async Task<List<PlaceResponseDto>> GetPlacesAsync()
        {
            return await _context.Places
                .Where(p => !p.IsDeleted)
                .Select(p => new PlaceResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Longitude = p.Location != null ? p.Location.X : 0,
                    Latitude = p.Location != null ? p.Location.Y : 0,
                    Wkt = !string.IsNullOrEmpty(p.Wkt) ? p.Wkt : (p.Location != null ? $"POINT({p.Location.X.ToString(CultureInfo.InvariantCulture)} {p.Location.Y.ToString(CultureInfo.InvariantCulture)})" : ""),
                    Color = string.IsNullOrEmpty(p.Color) ? "#3b82f6" : p.Color,
                    ModifiedDate = p.ModifiedDate
                })
                .ToListAsync();
        }

        public async Task<PlaceResponseDto> CreatePlaceAsync(CreatePlaceDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                throw new ArgumentException("Mekan adı boş olamaz.");
            }

            Point pointGeom;
            string wktStr;

            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                try
                {
                    var geom = _wktReader.Read(dto.Wkt);
                    if (geom is not Point pGeom)
                        throw new ArgumentException("Geçersiz WKT Nokta formatı.");

                    pointGeom = pGeom;
                    pointGeom.SRID = 4326;
                    wktStr = dto.Wkt;
                }
                catch (Exception ex)
                {
                    throw new ArgumentException($"WKT ayrıştırma hatası: {ex.Message}");
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
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Location = pointGeom,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Places.Add(place);
            await _context.SaveChangesAsync();

            return new PlaceResponseDto
            {
                Id = place.Id,
                Name = place.Name,
                Longitude = place.Location.X,
                Latitude = place.Location.Y,
                Wkt = place.Wkt,
                Color = place.Color,
                ModifiedDate = place.ModifiedDate
            };
        }

        public async Task<bool> DeletePlaceAsync(int id)
        {
            var place = await _context.Places.FindAsync(id);
            if (place == null)
                return false;

            place.IsDeleted = true;
            place.IsActive = false;
            place.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
