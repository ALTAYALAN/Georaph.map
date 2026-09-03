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

        private static bool _stopTableSchemaEnsured = false;

        private async Task EnsureStopSchemaAsync()
        {
            if (!_stopTableSchemaEnsured)
            {
                try
                {
                    await _context.Database.ExecuteSqlRawAsync(@"
                        ALTER TABLE tbl_stop ALTER COLUMN route_id DROP NOT NULL;
                        ALTER TABLE tbl_stop ADD COLUMN IF NOT EXISTS stop_class VARCHAR(50) DEFAULT 'otobus';
                        ALTER TABLE tbl_stop ADD COLUMN IF NOT EXISTS stop_code VARCHAR(100);
                        UPDATE tbl_stop SET stop_class = 'otobus' WHERE stop_class IS NULL;

                        CREATE TABLE IF NOT EXISTS tbl_route_stop (
                            id SERIAL PRIMARY KEY,
                            route_id INT NOT NULL REFERENCES tbl_route(id) ON DELETE CASCADE,
                            stop_id INT NOT NULL REFERENCES tbl_stop(id) ON DELETE CASCADE,
                            order_index INT NOT NULL DEFAULT 1,
                            created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                        );
                        CREATE INDEX IF NOT EXISTS ix_tbl_route_stop_route_id ON tbl_route_stop(route_id);
                        CREATE INDEX IF NOT EXISTS ix_tbl_route_stop_stop_id ON tbl_route_stop(stop_id);
                    ");
                    _stopTableSchemaEnsured = true;
                }
                catch
                {
                    // Fallback
                }
            }
        }

        private static string GenerateStopCode(string stopClass, int? id = null)
        {
            string prefix = (stopClass?.ToLowerInvariant()) switch
            {
                "metro" => "METRO",
                "gemi" => "PORT",
                "tren" => "TRAIN",
                "araba" => "ROAD",
                _ => "BUS"
            };

            int randomSuffix = id.HasValue && id.Value > 0 ? id.Value : new Random().Next(1000, 9999);
            return $"{prefix}-{randomSuffix:D4}";
        }

        #region Route Operations

        public async Task<List<RouteDto>> GetAllRoutesAsync(bool includeStops = true)
        {
            var query = _context.Routes
                .Where(r => !r.IsDeleted);

            if (includeStops)
            {
                query = query
                    .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                    .Include(r => r.RouteStops)
                        .ThenInclude(rs => rs.Stop);
            }

            var routes = await query.OrderBy(r => r.Name).ToListAsync();
            // Tekil liman sahte kayıtlarını filtrele (Limanlar duraktır, tek başına güzergah değildir)
            var validRoutes = routes
                .Where(r => !(r.RouteClass == "gemi" && string.IsNullOrEmpty(r.Wkt) && (r.Stops == null || r.Stops.Count <= 1)))
                .Select(MapToRouteDto)
                .ToList();

            return validRoutes;
        }

        public async Task<RouteDto?> GetRouteByIdAsync(int id)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .Include(r => r.RouteStops)
                    .ThenInclude(rs => rs.Stop)
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
                .Include(r => r.RouteStops)
                    .ThenInclude(rs => rs.Stop)
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

            if (dto.IsActive.HasValue)
                route.IsActive = dto.IsActive.Value;

            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                route.Wkt = dto.Wkt;
                try
                {
                    route.Geometry = _wktReader.Read(dto.Wkt);
                }
                catch { }
            }

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToRouteDto(route);
        }

        public async Task<RouteDto?> UpdateRouteGeometryAsync(int id, string wkt)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return null;

            route.PreviousWkt = route.Wkt;
            route.CustomWkt = wkt?.Trim();
            route.Wkt = wkt?.Trim();
            route.GeometryType = "Custom";

            if (!string.IsNullOrWhiteSpace(wkt))
            {
                try
                {
                    route.Geometry = _wktReader.Read(wkt.Trim());
                }
                catch { }
            }

            route.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToRouteDto(route);
        }

        public async Task<bool> DeleteRouteAsync(int id)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
            if (route == null) return false;

            route.IsDeleted = true;
            route.IsActive = false;
            route.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        #endregion

        #region Stop Operations

        public async Task<List<StopDto>> GetAllStopsAsync()
        {
            await EnsureStopSchemaAsync();

            var stops = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .Where(s => !s.IsDeleted)
                .OrderBy(s => s.RouteId)
                .ThenBy(s => s.OrderIndex)
                .ToListAsync();

            return stops.Select(MapToStopDto).ToList();
        }

        public async Task<List<StopDto>> GetStopsByRouteIdAsync(int routeId)
        {
            await EnsureStopSchemaAsync();

            // Hem doğrudan route_id'si olanlar hem de tbl_route_stop junction'da olanlar
            var stops = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .Where(s => !s.IsDeleted && (s.RouteId == routeId || s.RouteStops.Any(rs => rs.RouteId == routeId)))
                .OrderBy(s => s.OrderIndex)
                .ToListAsync();

            return stops.Select(MapToStopDto).ToList();
        }

        public async Task<StopDto?> GetStopByIdAsync(int id)
        {
            await EnsureStopSchemaAsync();

            var stop = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (stop == null) return null;
            return MapToStopDto(stop);
        }

        public async Task<StopDto> CreateStopAsync(CreateStopDto dto)
        {
            await EnsureStopSchemaAsync();

            var routeIds = (dto.RouteIds != null && dto.RouteIds.Any())
                ? dto.RouteIds.Where(r => r > 0).Distinct().ToList()
                : (dto.RouteId.HasValue && dto.RouteId.Value > 0 ? new List<int> { dto.RouteId.Value } : new List<int>());

            int? primaryRouteId = routeIds.FirstOrDefault() > 0 ? routeIds.First() : (int?)null;
            int nextOrder = 1;

            if (primaryRouteId.HasValue)
            {
                var maxOrder = await _context.Stops
                    .Where(s => s.RouteId == primaryRouteId.Value && !s.IsDeleted)
                    .MaxAsync(s => (int?)s.OrderIndex);

                if (maxOrder.HasValue)
                {
                    nextOrder = maxOrder.Value + 1;
                }
            }

            int finalOrder = dto.OrderIndex.HasValue && dto.OrderIndex.Value > 0 ? dto.OrderIndex.Value : nextOrder;

            Point? geom = null;
            if (!string.IsNullOrWhiteSpace(dto.Wkt))
            {
                try
                {
                    var parsed = _wktReader.Read(dto.Wkt);
                    if (parsed is Point p) geom = p;
                }
                catch { }
            }

            string finalClass = !string.IsNullOrWhiteSpace(dto.StopClass) ? dto.StopClass.ToLower().Trim() : "otobus";
            string finalCode = !string.IsNullOrWhiteSpace(dto.StopCode) ? dto.StopCode.Trim() : GenerateStopCode(finalClass);

            var stop = new StopFeature
            {
                Name = dto.Name.Trim(),
                StopCode = finalCode,
                RouteId = primaryRouteId,
                StopClass = finalClass,
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

            // Sync RouteStop Junction Entries
            foreach (var rId in routeIds)
            {
                _context.RouteStops.Add(new RouteStopFeature
                {
                    RouteId = rId,
                    StopId = stop.Id,
                    OrderIndex = finalOrder,
                    CreatedDate = DateTime.UtcNow
                });
            }
            if (routeIds.Any())
            {
                await _context.SaveChangesAsync();
            }

            return MapToStopDto(stop);
        }

        public async Task<StopDto?> UpdateStopAsync(int id, UpdateStopDto dto)
        {
            await EnsureStopSchemaAsync();

            var stop = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (stop == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Name))
                stop.Name = dto.Name.Trim();

            if (!string.IsNullOrWhiteSpace(dto.StopCode))
                stop.StopCode = dto.StopCode.Trim();

            if (!string.IsNullOrWhiteSpace(dto.StopClass))
                stop.StopClass = dto.StopClass.ToLower().Trim();

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
                    if (parsed is Point p) stop.Geometry = p;
                }
                catch {}
            }

            // Sync Multi-Route Associations
            if (dto.RouteIds != null)
            {
                var targetRouteIds = dto.RouteIds.Where(r => r > 0).Distinct().ToList();
                stop.RouteId = targetRouteIds.FirstOrDefault() > 0 ? targetRouteIds.First() : (int?)null;

                var currentJunctions = await _context.RouteStops.Where(rs => rs.StopId == id).ToListAsync();
                _context.RouteStops.RemoveRange(currentJunctions);

                foreach (var rId in targetRouteIds)
                {
                    _context.RouteStops.Add(new RouteStopFeature
                    {
                        RouteId = rId,
                        StopId = id,
                        OrderIndex = stop.OrderIndex,
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }
            else if (dto.RouteId.HasValue)
            {
                stop.RouteId = dto.RouteId.Value > 0 ? dto.RouteId.Value : null;
            }

            stop.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToStopDto(stop);
        }

        public async Task<bool> DeleteStopAsync(int id)
        {
            var stop = await _context.Stops.FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
            if (stop == null) return false;

            stop.IsDeleted = true;
            stop.IsActive = false;
            stop.ModifiedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        #endregion

        #region Reorder Stops (Drag & Drop)

        public async Task<bool> ReorderStopsAsync(int routeId, List<int> orderedStopIds)
        {
            if (orderedStopIds == null || !orderedStopIds.Any()) return false;

            var stops = await _context.Stops
                .Where(s => (s.RouteId == routeId || s.RouteStops.Any(rs => rs.RouteId == routeId)) && !s.IsDeleted)
                .ToListAsync();

            if (!stops.Any()) return false;

            for (int i = 0; i < orderedStopIds.Count; i++)
            {
                var stopId = orderedStopIds[i];
                var stop = stops.FirstOrDefault(s => s.Id == stopId);
                if (stop != null)
                {
                    stop.OrderIndex = i + 1;
                    stop.ModifiedDate = DateTime.UtcNow;
                }

                var junction = await _context.RouteStops.FirstOrDefaultAsync(rs => rs.RouteId == routeId && rs.StopId == stopId);
                if (junction != null)
                {
                    junction.OrderIndex = i + 1;
                }
            }

            await _context.SaveChangesAsync();

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

        public async Task<bool> AddStopToRouteAsync(int routeId, int stopId)
        {
            await EnsureStopSchemaAsync();

            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);
            var stop = await _context.Stops.FirstOrDefaultAsync(s => s.Id == stopId && !s.IsDeleted);
            if (route == null || stop == null) return false;

            var existingJunction = await _context.RouteStops
                .FirstOrDefaultAsync(rs => rs.RouteId == routeId && rs.StopId == stopId);

            if (existingJunction == null)
            {
                var maxOrder = await _context.RouteStops
                    .Where(rs => rs.RouteId == routeId)
                    .MaxAsync(rs => (int?)rs.OrderIndex) ?? 0;

                _context.RouteStops.Add(new RouteStopFeature
                {
                    RouteId = routeId,
                    StopId = stopId,
                    OrderIndex = maxOrder + 1,
                    CreatedDate = DateTime.UtcNow
                });
            }

            if (!stop.RouteId.HasValue || stop.RouteId <= 0)
            {
                stop.RouteId = routeId;
            }

            route.ModifiedDate = DateTime.UtcNow;
            stop.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveStopFromRouteAsync(int routeId, int stopId)
        {
            await EnsureStopSchemaAsync();

            var junctions = await _context.RouteStops
                .Where(rs => rs.RouteId == routeId && rs.StopId == stopId)
                .ToListAsync();

            if (junctions.Any())
            {
                _context.RouteStops.RemoveRange(junctions);
            }

            var stop = await _context.Stops.FirstOrDefaultAsync(s => s.Id == stopId && !s.IsDeleted);
            if (stop != null && stop.RouteId == routeId)
            {
                var otherJunction = await _context.RouteStops
                    .FirstOrDefaultAsync(rs => rs.StopId == stopId && rs.RouteId != routeId);
                stop.RouteId = otherJunction?.RouteId;
                stop.ModifiedDate = DateTime.UtcNow;
            }

            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);
            if (route != null)
            {
                route.ModifiedDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        #endregion

        #region Helper Mapping

        private static RouteDto MapToRouteDto(RouteFeature route)
        {
            var directStops = route.Stops != null 
                ? route.Stops.Where(s => !s.IsDeleted).ToList() 
                : new List<StopFeature>();

            var junctionStops = route.RouteStops != null 
                ? route.RouteStops.Where(rs => rs.Stop != null && !rs.Stop.IsDeleted).Select(rs => rs.Stop!).ToList() 
                : new List<StopFeature>();

            var combinedStops = directStops
                .Concat(junctionStops)
                .GroupBy(s => s.Id)
                .Select(g => g.First())
                .OrderBy(s => s.OrderIndex)
                .Select(MapToStopDto)
                .ToList();

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
                StopCount = combinedStops.Count,
                Stops = combinedStops
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

            var routeList = new List<RouteSummaryDto>();
            var routeIdList = new List<int>();

            if (s.Route != null && !s.Route.IsDeleted)
            {
                routeIdList.Add(s.Route.Id);
                routeList.Add(new RouteSummaryDto
                {
                    Id = s.Route.Id,
                    Name = s.Route.Name,
                    Color = s.Route.Color ?? "#3B82F6",
                    RouteClass = s.Route.RouteClass ?? "araba",
                    OrderIndex = s.OrderIndex
                });
            }

            if (s.RouteStops != null && s.RouteStops.Any())
            {
                foreach (var rs in s.RouteStops)
                {
                    if (rs.Route != null && !rs.Route.IsDeleted && !routeIdList.Contains(rs.RouteId))
                    {
                        routeIdList.Add(rs.RouteId);
                        routeList.Add(new RouteSummaryDto
                        {
                            Id = rs.RouteId,
                            Name = rs.Route.Name,
                            Color = rs.Route.Color ?? "#3B82F6",
                            RouteClass = rs.Route.RouteClass ?? "araba",
                            OrderIndex = rs.OrderIndex
                        });
                    }
                }
            }

            return new StopDto
            {
                Id = s.Id,
                Name = s.Name,
                StopCode = !string.IsNullOrWhiteSpace(s.StopCode) ? s.StopCode : GenerateStopCode(s.StopClass, s.Id),
                OrderIndex = s.OrderIndex,
                Description = s.Description,
                RouteId = s.RouteId,
                RouteName = s.Route?.Name,
                RouteColor = s.Route?.Color ?? "#3B82F6",
                RouteIds = routeIdList,
                Routes = routeList,
                StopClass = !string.IsNullOrWhiteSpace(s.StopClass) ? s.StopClass : (!string.IsNullOrWhiteSpace(s.Route?.RouteClass) ? s.Route.RouteClass : "otobus"),
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
