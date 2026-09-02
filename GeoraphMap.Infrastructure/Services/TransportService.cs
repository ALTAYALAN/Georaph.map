using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace GeoraphMap.Infrastructure.Services
{
    public class TransportService : ITransportService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;
        private readonly IOsrmRoutingService _osrmRoutingService;

        public TransportService(AppDbContext context, IOsrmRoutingService osrmRoutingService)
        {
            _context = context;
            _osrmRoutingService = osrmRoutingService;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
        }

        #region Route Operations

        public async Task<List<RouteDto>> GetAllRoutesAsync(bool includeStops = true)
        {
            var query = _context.Routes
                .Where(r => !r.IsDeleted);

            if (includeStops)
            {
                query = query.Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex));
            }

            var routes = await query.OrderBy(r => r.Name).ToListAsync();
            return routes.Select(MapToRouteDto).ToList();
        }

        public async Task<RouteDto?> GetRouteByIdAsync(int id)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return null;
            return MapToRouteDto(route);
        }

        public async Task<RouteDto> CreateRouteAsync(CreateRouteDto dto)
        {
            var route = new RouteFeature
            {
                Name = dto.Name.Trim(),
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3B82F6" : dto.Color.Trim(),
                RouteClass = string.IsNullOrWhiteSpace(dto.RouteClass) ? "araba" : dto.RouteClass.ToLower().Trim(),
                Description = dto.Description?.Trim(),
                Wkt = dto.Wkt?.Trim(),
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                try
                {
                    route.Geometry = _wktReader.Read(dto.Wkt.Trim());
                }
                catch { }
            }

            _context.Routes.Add(route);
            await _context.SaveChangesAsync();

            return new RouteDto
            {
                Id = route.Id,
                Name = route.Name,
                Color = route.Color,
                RouteClass = route.RouteClass,
                Description = route.Description,
                Wkt = route.Wkt,
                IsActive = route.IsActive,
                CreatedDate = route.CreatedDate,
                StopCount = 0,
                Stops = new List<StopDto>()
            };
        }

        public async Task<RouteDto?> UpdateRouteAsync(int id, UpdateRouteDto dto)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Name))
                route.Name = dto.Name.Trim();

            if (!string.IsNullOrWhiteSpace(dto.Color))
                route.Color = dto.Color.Trim();

            if (!string.IsNullOrWhiteSpace(dto.RouteClass))
                route.RouteClass = dto.RouteClass.ToLower().Trim();

            if (dto.Description != null)
                route.Description = dto.Description.Trim();

            if (dto.Wkt != null)
            {
                route.Wkt = string.IsNullOrWhiteSpace(dto.Wkt) ? null : dto.Wkt.Trim();
                if (!string.IsNullOrWhiteSpace(route.Wkt))
                {
                    try
                    {
                        route.Geometry = _wktReader.Read(route.Wkt);
                    }
                    catch { }
                }
                else
                {
                    route.Geometry = null;
                }
            }

            if (dto.IsActive.HasValue)
                route.IsActive = dto.IsActive.Value;

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new RouteDto
            {
                Id = route.Id,
                Name = route.Name,
                Color = route.Color,
                Description = route.Description,
                Wkt = route.Wkt,
                IsActive = route.IsActive,
                CreatedDate = route.CreatedDate,
                StopCount = route.Stops.Count(s => !s.IsDeleted),
                Stops = route.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex).Select(MapToStopDto).ToList()
            };
        }

        public async Task<RouteDto?> UpdateRouteGeometryAsync(int id, string wkt)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return null;

            // Önceki halini sakla
            route.PreviousWkt = route.Wkt;

            if (!string.IsNullOrWhiteSpace(wkt))
            {
                route.Wkt = wkt.Trim();
                route.CustomWkt = wkt.Trim();
                route.GeometryType = "Custom";
                try
                {
                    route.Geometry = _wktReader.Read(wkt.Trim());
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TransportService] Route WKT parsing error: {ex.Message}");
                }
            }
            else
            {
                route.Wkt = null;
                route.Geometry = null;
                route.GeometryType = "Direct";
            }

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToRouteDto(route);
        }

        public async Task<bool> DeleteRouteAsync(int id)
        {
            var route = await _context.Routes
                .Include(r => r.Stops)
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return false;

            route.IsDeleted = true;
            route.IsActive = false;
            route.ModifiedDate = DateTime.UtcNow;

            // Bağlı durakları da soft delete yap
            foreach (var stop in route.Stops.Where(s => !s.IsDeleted))
            {
                stop.IsDeleted = true;
                stop.IsActive = false;
                stop.ModifiedDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        #endregion

        #region Stop Operations

        public async Task<List<StopDto>> GetAllStopsAsync()
        {
            var stops = await _context.Stops
                .Include(s => s.Route)
                .Where(s => !s.IsDeleted && !s.Route.IsDeleted)
                .OrderBy(s => s.RouteId)
                .ThenBy(s => s.OrderIndex)
                .ToListAsync();

            return stops.Select(MapToStopDto).ToList();
        }

        public async Task<List<StopDto>> GetStopsByRouteIdAsync(int routeId)
        {
            var stops = await _context.Stops
                .Include(s => s.Route)
                .Where(s => s.RouteId == routeId && !s.IsDeleted)
                .OrderBy(s => s.OrderIndex)
                .ToListAsync();

            return stops.Select(MapToStopDto).ToList();
        }

        public async Task<StopDto?> GetStopByIdAsync(int id)
        {
            var stop = await _context.Stops
                .Include(s => s.Route)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (stop == null) return null;
            return MapToStopDto(stop);
        }

        public async Task<StopDto> CreateStopAsync(CreateStopDto dto)
        {
            // Eğer orderIndex belirtilmemişse, güzergahtaki mevcut en son sıra + 1 ata
            int nextOrder = 1;
            var maxOrder = await _context.Stops
                .Where(s => s.RouteId == dto.RouteId && !s.IsDeleted)
                .MaxAsync(s => (int?)s.OrderIndex);

            if (maxOrder.HasValue)
            {
                nextOrder = maxOrder.Value + 1;
            }

            int finalOrder = dto.OrderIndex.HasValue && dto.OrderIndex.Value > 0 ? dto.OrderIndex.Value : nextOrder;

            Point? geom = null;
            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                try
                {
                    var parsed = _wktReader.Read(dto.Wkt);
                    if (parsed is Point p)
                    {
                        geom = p;
                    }
                }
                catch
                {
                    // Fallback
                }
            }

            var stop = new StopFeature
            {
                Name = dto.Name.Trim(),
                RouteId = dto.RouteId,
                OrderIndex = finalOrder,
                Description = dto.Description?.Trim(),
                Wkt = dto.Wkt,
                Geometry = geom,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Stops.Add(stop);
            await _context.SaveChangesAsync();

            // Route bilgisiyle birlikte döndür
            var route = await _context.Routes.FindAsync(dto.RouteId);
            if (route != null) stop.Route = route;

            return MapToStopDto(stop);
        }

        public async Task<StopDto?> UpdateStopAsync(int id, UpdateStopDto dto)
        {
            var stop = await _context.Stops
                .Include(s => s.Route)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (stop == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Name))
                stop.Name = dto.Name.Trim();

            if (dto.RouteId > 0 && dto.RouteId != stop.RouteId)
                stop.RouteId = dto.RouteId;

            if (dto.Description != null)
                stop.Description = dto.Description.Trim();

            if (dto.OrderIndex.HasValue)
                stop.OrderIndex = dto.OrderIndex.Value;

            if (dto.IsActive.HasValue)
                stop.IsActive = dto.IsActive.Value;

            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                stop.Wkt = dto.Wkt;
                try
                {
                    var parsed = _wktReader.Read(dto.Wkt);
                    if (parsed is Point p)
                    {
                        stop.Geometry = p;
                    }
                }
                catch {}
            }

            stop.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToStopDto(stop);
        }

        public async Task<bool> DeleteStopAsync(int id)
        {
            var stop = await _context.Stops.FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
            if (stop == null) return false;

            int routeId = stop.RouteId;
            stop.IsDeleted = true;
            stop.IsActive = false;
            stop.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Silme sonrası kalan durakların sıralamasını (1, 2, 3...) yeniden düzelt
            var remainingStops = await _context.Stops
                .Where(s => s.RouteId == routeId && !s.IsDeleted)
                .OrderBy(s => s.OrderIndex)
                .ToListAsync();

            for (int i = 0; i < remainingStops.Count; i++)
            {
                remainingStops[i].OrderIndex = i + 1;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        #endregion

        #region Reorder Stops (Drag & Drop)

        public async Task<bool> ReorderStopsAsync(int routeId, List<int> orderedStopIds)
        {
            if (orderedStopIds == null || !orderedStopIds.Any()) return false;

            var stops = await _context.Stops
                .Where(s => s.RouteId == routeId && !s.IsDeleted)
                .ToListAsync();

            if (!stops.Any()) return false;

            for (int i = 0; i < orderedStopIds.Count; i++)
            {
                var stopId = orderedStopIds[i];
                var stop = stops.FirstOrDefault(s => s.Id == stopId);
                if (stop != null)
                {
                    stop.OrderIndex = i + 1; // 1-tabanlı sıra numarası
                    stop.ModifiedDate = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            // Durak sırası değiştiğinde OSRM'e yeni istek atılarak rota otomatik güncellenmelidir.
            try
            {
                await GenerateOsrmRouteAsync(routeId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TransportService] Auto OSRM route generation after reorder notice: {ex.Message}");
            }

            return true;
        }

        #endregion

        #region OSRM Automatic Routing

        public async Task<RouteDto?> GenerateOsrmRouteAsync(int routeId)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);

            if (route == null) return null;

            var orderedStops = route.Stops
                .Where(s => !s.IsDeleted)
                .OrderBy(s => s.OrderIndex)
                .ToList();

            // Durakların geçerli coğrafi koordinatlarını topla
            var coordsList = new List<(double Longitude, double Latitude)>();
            foreach (var stop in orderedStops)
            {
                var (lon, lat) = ExtractStopCoordinates(stop);
                if (lon.HasValue && lat.HasValue)
                {
                    coordsList.Add((lon.Value, lat.Value));
                }
            }

            if (coordsList.Count < 2)
            {
                return new RouteDto
                {
                    Id = route.Id,
                    Name = route.Name,
                    Color = route.Color ?? "#3B82F6",
                    Description = route.Description,
                    Wkt = route.Wkt,
                    IsActive = route.IsActive,
                    CreatedDate = route.CreatedDate,
                    StopCount = route.Stops.Count(s => !s.IsDeleted),
                    Stops = route.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex).Select(MapToStopDto).ToList()
                };
            }

            // OSRM üzerinden karayolu rotasını hesapla
            var osrmResult = await _osrmRoutingService.CalculateRouteAsync(coordsList);
            if (osrmResult.Success && !string.IsNullOrWhiteSpace(osrmResult.Wkt))
            {
                // Önceki geometri durumunu yedekle
                route.PreviousWkt = route.Wkt;
                route.Wkt = osrmResult.Wkt;
                route.GeometryType = "Osrm";

                try
                {
                    route.Geometry = _wktReader.Read(osrmResult.Wkt);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TransportService] OSRM WKT parsing into Geometry error: {ex.Message}");
                }

                route.ModifiedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return MapToRouteDto(route);
        }

        public async Task<RouteDto?> SwitchRouteGeometryModeAsync(int routeId, string mode)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);

            if (route == null) return null;

            var targetMode = (mode ?? "").ToLowerInvariant();

            if (targetMode == "direct" || targetMode == "kusbakisi" || targetMode == "reset")
            {
                // Kuş bakışı / Standart Düz Çizgi Modu
                route.PreviousWkt = route.Wkt;
                route.Wkt = null;
                route.Geometry = null;
                route.GeometryType = "Direct";
            }
            else if (targetMode == "custom" || targetMode == "bukulmus")
            {
                // Kullanıcının daha önce elle büktüğü özel geometriyi geri yükle
                if (!string.IsNullOrWhiteSpace(route.CustomWkt))
                {
                    route.PreviousWkt = route.Wkt;
                    route.Wkt = route.CustomWkt;
                    route.GeometryType = "Custom";
                    try { route.Geometry = _wktReader.Read(route.CustomWkt); } catch { }
                }
            }
            else if (targetMode == "osrm" || targetMode == "karayolu")
            {
                // OSRM Moduna geçiş
                return await GenerateOsrmRouteAsync(routeId);
            }
            else if (targetMode == "revert" || targetMode == "restore" || targetMode == "undo")
            {
                // Bir önceki geometri durumuna geri dön
                return await RevertRouteGeometryAsync(routeId);
            }

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToRouteDto(route);
        }

        public async Task<RouteDto?> RevertRouteGeometryAsync(int routeId)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);

            if (route == null) return null;

            // Wkt ile PreviousWkt'yi takas et (Undo / Redo desteği)
            var tempCurrent = route.Wkt;
            route.Wkt = route.PreviousWkt;
            route.PreviousWkt = tempCurrent;

            if (!string.IsNullOrWhiteSpace(route.Wkt))
            {
                try { route.Geometry = _wktReader.Read(route.Wkt); } catch { }
                route.GeometryType = route.Wkt == route.CustomWkt ? "Custom" : "Osrm";
            }
            else
            {
                route.Geometry = null;
                route.GeometryType = "Direct";
            }

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToRouteDto(route);
        }

        #endregion

        #region Helper Mapping

        private static RouteDto MapToRouteDto(RouteFeature route)
        {
            return new RouteDto
            {
                Id = route.Id,
                Name = route.Name,
                Color = route.Color ?? "#3B82F6",
                RouteClass = string.IsNullOrWhiteSpace(route.RouteClass) ? "araba" : route.RouteClass,
                Description = route.Description,
                Wkt = route.Wkt,
                PreviousWkt = route.PreviousWkt,
                CustomWkt = route.CustomWkt,
                GeometryType = route.GeometryType ?? (string.IsNullOrEmpty(route.Wkt) ? "Direct" : "Custom"),
                IsActive = route.IsActive,
                CreatedDate = route.CreatedDate,
                StopCount = route.Stops.Count(s => !s.IsDeleted),
                Stops = route.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex).Select(MapToStopDto).ToList()
            };
        }

        private static (double? Longitude, double? Latitude) ExtractStopCoordinates(StopFeature s)
        {
            double? lat = null;
            double? lon = null;

            if (s.Geometry != null)
            {
                lat = s.Geometry.Y;
                lon = s.Geometry.X;
            }
            else if (!string.IsNullOrWhiteSpace(s.Wkt))
            {
                try
                {
                    var clean = s.Wkt.ToUpperInvariant()
                        .Replace("POINT", "")
                        .Replace("(", "")
                        .Replace(")", "")
                        .Trim();
                    var parts = clean.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2 &&
                        double.TryParse(parts[0], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double parsedLon) &&
                        double.TryParse(parts[1], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double parsedLat))
                    {
                        lon = parsedLon;
                        lat = parsedLat;
                    }
                }
                catch { }
            }

            if (lat.HasValue && lon.HasValue)
            {
                // EPSG:3857 -> EPSG:4326 dönüşümü (gerekirse)
                if (Math.Abs(lon.Value) > 180 || Math.Abs(lat.Value) > 90)
                {
                    double x = lon.Value;
                    double y = lat.Value;
                    lon = (x / 20037508.34) * 180.0;
                    double latRad = (y / 20037508.34) * 180.0;
                    lat = 180.0 / Math.PI * (2.0 * Math.Atan(Math.Exp(latRad * Math.PI / 180.0)) - Math.PI / 2.0);
                }

                // Türkiye koordinat kontrolü (Lon: 25-45, Lat: 35-43)
                if (lon.Value >= 35.0 && lon.Value <= 43.0 && lat.Value >= 25.0 && lat.Value <= 35.0)
                {
                    var tmp = lon.Value;
                    lon = lat.Value;
                    lat = tmp;
                }
            }

            return (lon, lat);
        }

        private static StopDto MapToStopDto(StopFeature s)
        {
            var (lon, lat) = ExtractStopCoordinates(s);

            return new StopDto
            {
                Id = s.Id,
                Name = s.Name,
                OrderIndex = s.OrderIndex,
                Description = s.Description,
                RouteId = s.RouteId,
                RouteName = s.Route?.Name,
                RouteColor = s.Route?.Color ?? "#3B82F6",
                Wkt = s.Wkt,
                Latitude = lat,
                Longitude = lon,
                IsActive = s.IsActive,
                CreatedDate = s.CreatedDate
            };
        }

        #endregion
    }
}
