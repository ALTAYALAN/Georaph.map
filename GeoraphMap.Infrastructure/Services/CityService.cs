using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure.Services
{
    public class CityService : ICityService
    {
        private readonly AppDbContext _context;

        public CityService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<CityDto>> GetAllCitiesAsync(bool includeDeleted = false)
        {
            await EnsureTableExistsAsync();

            var query = _context.Cities.AsNoTracking().AsQueryable();
            if (!includeDeleted)
            {
                query = query.Where(c => !c.IsDeleted);
            }

            var list = await query.OrderBy(c => c.Plate).ToListAsync();
            return list.Select(c => MapToDto(c)).ToList();
        }

        public async Task<CityDto?> GetCityByPlateAsync(int plate)
        {
            await EnsureTableExistsAsync();
            var city = await _context.Cities.AsNoTracking().FirstOrDefaultAsync(c => c.Plate == plate && !c.IsDeleted);
            return city == null ? null : MapToDto(city);
        }

        public async Task<CityDto> CreateCityAsync(CreateCityDto dto)
        {
            await EnsureTableExistsAsync();

            var existing = await _context.Cities.FirstOrDefaultAsync(c => c.Plate == dto.Plate);
            if (existing != null)
            {
                existing.Name = dto.Name;
                existing.Region = dto.Region;
                existing.Wkt = dto.Wkt;
                existing.IsDeleted = false;
                existing.IsActive = true;
                existing.ModifiedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return MapToDto(existing);
            }

            var entity = new CityFeature
            {
                Plate = dto.Plate,
                Name = dto.Name,
                Region = dto.Region,
                Wkt = dto.Wkt,
                IsActive = true,
                IsDeleted = false,
                InsertedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Cities.Add(entity);
            await _context.SaveChangesAsync();
            return MapToDto(entity);
        }

        public async Task<CityDto?> UpdateCityAsync(int plate, UpdateCityDto dto)
        {
            await EnsureTableExistsAsync();

            var city = await _context.Cities.FirstOrDefaultAsync(c => c.Plate == plate);
            if (city == null) return null;

            city.Plate = dto.Plate;
            city.Name = dto.Name;
            city.Region = dto.Region;
            city.Wkt = dto.Wkt;
            city.IsDeleted = dto.IsDeleted;
            city.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return MapToDto(city);
        }

        public async Task<bool> SoftDeleteCityAsync(int plate)
        {
            await EnsureTableExistsAsync();

            var city = await _context.Cities.FirstOrDefaultAsync(c => c.Plate == plate);
            if (city == null) return false;

            city.IsDeleted = true;
            city.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreCityAsync(int plate)
        {
            await EnsureTableExistsAsync();

            var city = await _context.Cities.FirstOrDefaultAsync(c => c.Plate == plate);
            if (city == null) return false;

            city.IsDeleted = false;
            city.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> BulkSaveCitiesAsync(List<CityDto> cities)
        {
            await EnsureTableExistsAsync();

            if (cities == null || !cities.Any()) return false;

            var existingCities = await _context.Cities.ToListAsync();
            var existingMap = existingCities
                .GroupBy(c => c.Plate)
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var dto in cities)
            {
                if (dto.Plate <= 0) continue;

                if (existingMap.TryGetValue(dto.Plate, out var city))
                {
                    city.Name = dto.Name;
                    city.Region = dto.Region;
                    city.Wkt = dto.Wkt ?? string.Empty;
                    city.IsDeleted = dto.IsDeleted;
                    city.IsActive = dto.IsActive;
                    city.ModifiedDate = DateTime.UtcNow;
                }
                else
                {
                    var newEntity = new CityFeature
                    {
                        Plate = dto.Plate,
                        Name = dto.Name,
                        Region = dto.Region,
                        Wkt = dto.Wkt ?? string.Empty,
                        IsActive = dto.IsActive,
                        IsDeleted = dto.IsDeleted,
                        InsertedDate = DateTime.UtcNow,
                        ModifiedDate = DateTime.UtcNow
                    };
                    _context.Cities.Add(newEntity);
                    existingMap[dto.Plate] = newEntity;
                }
            }

            await _context.SaveChangesAsync();

            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    UPDATE tbl_city 
                    SET geom = ST_SetSRID(ST_GeomFromText(wkt), 4326) 
                    WHERE wkt IS NOT NULL AND wkt != '' AND (wkt LIKE 'POLYGON%' OR wkt LIKE 'MULTIPOLYGON%');
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CityService] PostGIS geom sync warning: {ex.Message}");
            }

            return true;
        }

        public async Task<int> SeedCitiesFromJsonAsync(string jsonPath)
        {
            await EnsureTableExistsAsync();

            if (await _context.Cities.AnyAsync())
            {
                return 0; // Already seeded
            }

            if (string.IsNullOrEmpty(jsonPath) || !File.Exists(jsonPath))
            {
                return 0;
            }

            try
            {
                var jsonStr = await File.ReadAllTextAsync(jsonPath);
                using var doc = JsonDocument.Parse(jsonStr);
                var root = doc.RootElement;

                if (!root.TryGetProperty("features", out var features))
                {
                    return 0;
                }

                var entities = new List<CityFeature>();
                int idx = 1;

                foreach (var element in features.EnumerateArray())
                {
                    if (!element.TryGetProperty("properties", out var props)) continue;

                    int plate = props.TryGetProperty("plate", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt32() : idx;
                    string name = props.TryGetProperty("name", out var n) ? n.GetString() ?? $"İl {plate}" : $"İl {plate}";
                    string region = props.TryGetProperty("region", out var r) ? r.GetString() ?? "İç Anadolu Bölgesi" : "İç Anadolu Bölgesi";
                    string wkt = props.TryGetProperty("wkt", out var w) ? w.GetString() ?? "" : "";

                    entities.Add(new CityFeature
                    {
                        Plate = plate,
                        Name = name,
                        Region = region,
                        Wkt = wkt,
                        IsActive = true,
                        IsDeleted = false,
                        InsertedDate = DateTime.UtcNow,
                        ModifiedDate = DateTime.UtcNow
                    });

                    idx++;
                }

                if (entities.Any())
                {
                    await _context.Cities.AddRangeAsync(entities);
                    await _context.SaveChangesAsync();

                    try
                    {
                        await _context.Database.ExecuteSqlRawAsync(@"
                            UPDATE tbl_city 
                            SET geom = ST_SetSRID(ST_GeomFromText(wkt), 4326) 
                            WHERE wkt IS NOT NULL AND wkt != '' AND (wkt LIKE 'POLYGON%' OR wkt LIKE 'MULTIPOLYGON%');
                        ");
                    }
                    catch { }

                    return entities.Count;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CityService] JSON Seed Error: {ex.Message}");
            }

            return 0;
        }

        private async Task EnsureTableExistsAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    CREATE EXTENSION IF NOT EXISTS postgis;

                    CREATE TABLE IF NOT EXISTS tbl_city (
                        id SERIAL PRIMARY KEY,
                        plate INT NOT NULL,
                        name VARCHAR(250) NOT NULL,
                        region VARCHAR(250) NOT NULL,
                        wkt TEXT NOT NULL,
                        geom geometry(Geometry, 4326),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        inserted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    ALTER TABLE tbl_city ADD COLUMN IF NOT EXISTS geom geometry(Geometry, 4326);

                    UPDATE tbl_city 
                    SET geom = ST_SetSRID(ST_GeomFromText(wkt), 4326) 
                    WHERE (geom IS NULL) AND wkt IS NOT NULL AND wkt != '' AND wkt LIKE 'POLYGON%' OR wkt LIKE 'MULTIPOLYGON%';
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CityService] Table creation check error: {ex.Message}");
            }
        }

        private static CityDto MapToDto(CityFeature c)
        {
            return new CityDto
            {
                Id = c.Id,
                Plate = c.Plate,
                Name = c.Name,
                Region = c.Region,
                Wkt = c.Wkt,
                IsActive = c.IsActive,
                IsDeleted = c.IsDeleted
            };
        }
    }
}
