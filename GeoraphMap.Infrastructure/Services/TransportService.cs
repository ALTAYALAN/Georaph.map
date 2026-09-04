using System;
using System.Collections.Generic;
using System.Globalization;
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
                        ALTER TABLE tbl_stop ADD COLUMN IF NOT EXISTS image_url TEXT;
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

        public static string NormalizeClass(string? classKey)
        {
            if (string.IsNullOrWhiteSpace(classKey)) return "otobus";
            var key = classKey.ToLowerInvariant().Trim();
            if (key == "gemi" || key == "deniz" || key == "vapur" || key == "feribot" || key == "ship" || key == "port") return "deniz";
            if (key == "metro" || key == "subway") return "metro";
            if (key == "tramvay" || key == "tram" || key == "nostaljik") return "tramvay";
            if (key == "metrobus" || key == "metrobüs" || key == "brt") return "metrobus";
            if (key == "tren" || key == "train" || key == "tcdd" || key == "marmaray" || key == "izban" || key == "baskentray" || key == "demiryolu") return "tren";
            if (key == "otobus" || key == "bus" || key == "iett" || key == "ego" || key == "eshot" || key == "araba" || key == "car") return "otobus";
            return key;
        }

        public static bool AreClassesCompatible(string? class1, string? class2)
        {
            return NormalizeClass(class1) == NormalizeClass(class2);
        }

        private static string GenerateStopCode(string stopClass, int? id = null)
        {
            string prefix = NormalizeClass(stopClass) switch
            {
                "metro" => "METRO",
                "deniz" => "ISKELE",
                "tren" => "GARY",
                "tramvay" => "TRAM",
                "metrobus" => "MBUS",
                _ => "DURAK"
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
            // Tekil liman sahte kayıtlarını filtrele
            var validRoutes = routes
                .Where(r => !(NormalizeClass(r.RouteClass) == "deniz" && string.IsNullOrEmpty(r.Wkt) && (r.Stops == null || r.Stops.Count <= 1)))
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
            var normClass = NormalizeClass(dto.RouteClass);
            var route = new RouteFeature
            {
                Name = dto.Name.Trim(),
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3B82F6" : dto.Color.Trim(),
                RouteClass = normClass,
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
                route.RouteClass = NormalizeClass(dto.RouteClass);

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

            string finalClass = NormalizeClass(dto.StopClass);

            // Gelen güzergah id'lerini filtrele: Sadece AYNI sınıftaki güzergahlara bağlanabilir!
            var rawRouteIds = (dto.RouteIds != null && dto.RouteIds.Any())
                ? dto.RouteIds.Where(r => r > 0).Distinct().ToList()
                : (dto.RouteId.HasValue && dto.RouteId.Value > 0 ? new List<int> { dto.RouteId.Value } : new List<int>());

            var validRoutes = await _context.Routes
                .Where(r => rawRouteIds.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync();

            var compatibleRouteIds = validRoutes
                .Where(r => AreClassesCompatible(r.RouteClass, finalClass))
                .Select(r => r.Id)
                .ToList();

            int? primaryRouteId = compatibleRouteIds.FirstOrDefault() > 0 ? compatibleRouteIds.First() : (int?)null;
            int nextOrder = 1;

            if (primaryRouteId.HasValue)
            {
                var maxOrder = await _context.RouteStops
                    .Where(rs => rs.RouteId == primaryRouteId.Value)
                    .MaxAsync(rs => (int?)rs.OrderIndex);

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

            string finalCode = !string.IsNullOrWhiteSpace(dto.StopCode) ? dto.StopCode.Trim() : GenerateStopCode(finalClass);

            var stop = new StopFeature
            {
                Name = dto.Name.Trim(),
                StopCode = finalCode,
                RouteId = primaryRouteId,
                StopClass = finalClass,
                OrderIndex = finalOrder,
                Description = dto.Description?.Trim(),
                ImageUrl = dto.ImageUrl?.Trim(),
                Wkt = dto.Wkt,
                Geometry = geom,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Stops.Add(stop);
            await _context.SaveChangesAsync();

            // Sync RouteStop Junction Entries (1-to-N relationships within same class)
            foreach (var rId in compatibleRouteIds)
            {
                _context.RouteStops.Add(new RouteStopFeature
                {
                    RouteId = rId,
                    StopId = stop.Id,
                    OrderIndex = finalOrder,
                    CreatedDate = DateTime.UtcNow
                });
            }
            if (compatibleRouteIds.Any())
            {
                await _context.SaveChangesAsync();
                foreach (var rId in compatibleRouteIds)
                {
                    try { await GenerateOsrmRouteAsync(rId); } catch { }
                }
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
                stop.StopClass = NormalizeClass(dto.StopClass);

            if (dto.Description != null)
                stop.Description = dto.Description.Trim();

            if (dto.ImageUrl != null)
                stop.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? null : dto.ImageUrl.Trim();

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

            // Sync Multi-Route Associations (Sadece aynı sınıftaki güzergahlar)
            var currentClass = stop.StopClass;
            List<int>? targetRouteIds = null;

            if (dto.RouteIds != null)
            {
                targetRouteIds = dto.RouteIds.Where(r => r > 0).Distinct().ToList();
            }

            if (targetRouteIds != null)
            {
                var validRoutes = await _context.Routes
                    .Where(r => targetRouteIds.Contains(r.Id) && !r.IsDeleted)
                    .ToListAsync();

                var compatibleRouteIds = validRoutes
                    .Where(r => AreClassesCompatible(r.RouteClass, currentClass))
                    .Select(r => r.Id)
                    .ToList();

                stop.RouteId = compatibleRouteIds.FirstOrDefault() > 0 ? compatibleRouteIds.First() : (int?)null;

                var currentJunctions = await _context.RouteStops.Where(rs => rs.StopId == id).ToListAsync();
                
                // Kaldırılan hat bağlantılarını sil
                var junctionsToRemove = currentJunctions.Where(j => !compatibleRouteIds.Contains(j.RouteId)).ToList();
                if (junctionsToRemove.Any())
                {
                    _context.RouteStops.RemoveRange(junctionsToRemove);
                }

                // Yeni eklenen hat bağlantılarını ekle (Mevcut olanların OrderIndex'ini koru!)
                foreach (var rId in compatibleRouteIds)
                {
                    var existing = currentJunctions.FirstOrDefault(j => j.RouteId == rId);
                    if (existing == null)
                    {
                        var maxOrder = await _context.RouteStops.Where(rs => rs.RouteId == rId).Select(rs => (int?)rs.OrderIndex).MaxAsync() ?? 0;
                        _context.RouteStops.Add(new RouteStopFeature
                        {
                            RouteId = rId,
                            StopId = id,
                            OrderIndex = maxOrder + 1,
                            CreatedDate = DateTime.UtcNow
                        });
                    }
                }

                await _context.SaveChangesAsync();

                // İlgili güzergahların geometrilerini güncelle
                var allAffectedRouteIds = currentJunctions.Select(j => j.RouteId).Concat(compatibleRouteIds).Distinct();
                foreach (var rId in allAffectedRouteIds)
                {
                    try { await GenerateOsrmRouteAsync(rId); } catch { }
                }
            }
            else
            {
                // dto.RouteIds gönderilmediyse (yalnızca koordinat veya isim güncellendiğinde) mevcut bağlantıları koru ve geometrilerini güncelle
                var existingRouteIds = await _context.RouteStops.Where(rs => rs.StopId == id).Select(rs => rs.RouteId).ToListAsync();
                if (stop.RouteId.HasValue && !existingRouteIds.Contains(stop.RouteId.Value))
                {
                    existingRouteIds.Add(stop.RouteId.Value);
                }
                foreach (var rId in existingRouteIds)
                {
                    try { await GenerateOsrmRouteAsync(rId); } catch { }
                }
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

            var affectedRoutes = await _context.RouteStops.Where(rs => rs.StopId == id).Select(rs => rs.RouteId).ToListAsync();

            await _context.SaveChangesAsync();

            foreach (var rId in affectedRoutes)
            {
                try { await GenerateOsrmRouteAsync(rId); } catch { }
            }

            return true;
        }

        #endregion

        #region Reorder Stops (Drag & Drop)

        public async Task<bool> ReorderStopsAsync(int routeId, List<int> orderedStopIds)
        {
            if (orderedStopIds == null || !orderedStopIds.Any()) return false;

            var routeStops = await _context.RouteStops
                .Where(rs => rs.RouteId == routeId)
                .ToListAsync();

            var stops = await _context.Stops
                .Where(s => (s.RouteId == routeId || s.RouteStops.Any(rs => rs.RouteId == routeId)) && !s.IsDeleted)
                .ToListAsync();

            if (!stops.Any() && !routeStops.Any()) return false;

            for (int i = 0; i < orderedStopIds.Count; i++)
            {
                var stopId = orderedStopIds[i];
                var stop = stops.FirstOrDefault(s => s.Id == stopId);
                if (stop != null && stop.RouteId == routeId)
                {
                    stop.OrderIndex = i + 1;
                    stop.ModifiedDate = DateTime.UtcNow;
                }

                var junction = routeStops.FirstOrDefault(rs => rs.StopId == stopId);
                if (junction != null)
                {
                    junction.OrderIndex = i + 1;
                }
                else
                {
                    _context.RouteStops.Add(new RouteStopFeature
                    {
                        RouteId = routeId,
                        StopId = stopId,
                        OrderIndex = i + 1,
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            try
            {
                await GenerateOsrmRouteAsync(routeId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TransportService] Auto route geometry generation after reorder error: {ex.Message}");
            }

            return true;
        }

        #endregion

        #region OSRM & Direct Transit Line Routing

        public async Task<RouteDto?> GenerateOsrmRouteAsync(int routeId)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .Include(r => r.RouteStops)
                    .ThenInclude(rs => rs.Stop)
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);

            if (route == null) return null;

            // Junction ve doğrudan bağlı durakları birleştirip sırala
            var junctionStops = route.RouteStops
                .Where(rs => rs.Stop != null && !rs.Stop.IsDeleted)
                .OrderBy(rs => rs.OrderIndex)
                .Select(rs => rs.Stop!)
                .ToList();

            var directStops = route.Stops
                .Where(s => !s.IsDeleted)
                .OrderBy(s => s.OrderIndex)
                .ToList();

            var orderedStops = junctionStops.Any() 
                ? junctionStops 
                : directStops;

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
                return MapToRouteDto(route);
            }

            var rClass = NormalizeClass(route.RouteClass);

            // 1. Metro, Tramvay, Metrobüs, Tren, Deniz ve Havayolu hatları için organik kıvrımlı hat geometrisi (Spline) oluştur
            if (rClass == "metro" || rClass == "deniz" || rClass == "tren" || rClass == "tramvay" || rClass == "metrobus" || rClass == "havayolu")
            {
                // Varsa öncelikle özel bükümü kullan
                if (route.GeometryType == "Custom" && !string.IsNullOrWhiteSpace(route.CustomWkt))
                {
                    route.Wkt = route.CustomWkt;
                }
                else
                {
                    // Kuş uçuşu sert kırılmalar yerine raylı sistemler için organik kıvrımlı (Catmull-Rom Spline) geometri üret
                    var curvedPoints = GenerateSmoothSpline(coordsList, segmentsPerSpan: 6);
                    var splineCoords = curvedPoints.Select(c => $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}");
                    var splineWkt = $"LINESTRING({string.Join(", ", splineCoords)})";

                    route.PreviousWkt = route.Wkt;
                    route.Wkt = splineWkt;
                    route.GeometryType = (route.GeometryType == "Direct") ? "Direct" : "Custom";
                    if (string.IsNullOrWhiteSpace(route.CustomWkt))
                    {
                        route.CustomWkt = splineWkt;
                    }
                }

                try
                {
                    route.Geometry = _wktReader.Read(route.Wkt);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TransportService] Transit Line WKT parsing error: {ex.Message}");
                }

                route.ModifiedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return MapToRouteDto(route);
            }

            // 2. Karayolu hatları (Otobüs, Dolmuş, Minibüs, Araba vb.) için OSRM üzerinden rotayı hesapla
            var osrmResult = await _osrmRoutingService.CalculateRouteAsync(coordsList);
            if (osrmResult.Success && !string.IsNullOrWhiteSpace(osrmResult.Wkt))
            {
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
            else
            {
                // Fallback olarak doğrudan çizgi
                var directPoints = coordsList.Select(c => $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}");
                var directWkt = $"LINESTRING({string.Join(", ", directPoints)})";
                route.PreviousWkt = route.Wkt;
                route.Wkt = directWkt;
                route.GeometryType = "Direct";
                try { route.Geometry = _wktReader.Read(directWkt); } catch { }
                route.ModifiedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return MapToRouteDto(route);
        }

        public async Task<RouteDto?> SwitchRouteGeometryModeAsync(int routeId, string mode)
        {
            var route = await _context.Routes
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .Include(r => r.RouteStops)
                    .ThenInclude(rs => rs.Stop)
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);

            if (route == null) return null;

            var targetMode = (mode ?? "").ToLowerInvariant();

            if (targetMode == "direct" || targetMode == "kusbakisi" || targetMode == "reset")
            {
                route.PreviousWkt = route.Wkt;
                route.GeometryType = "Direct";

                var junctionStops = route.RouteStops
                    .Where(rs => rs.Stop != null && !rs.Stop.IsDeleted)
                    .OrderBy(rs => rs.OrderIndex)
                    .Select(rs => rs.Stop!)
                    .ToList();

                var directStops = route.Stops
                    .Where(s => !s.IsDeleted)
                    .OrderBy(s => s.OrderIndex)
                    .ToList();

                var orderedStops = junctionStops.Any() ? junctionStops : directStops;
                var coordsList = new List<(double Longitude, double Latitude)>();
                foreach (var stop in orderedStops)
                {
                    var (lon, lat) = ExtractStopCoordinates(stop);
                    if (lon.HasValue && lat.HasValue) coordsList.Add((lon.Value, lat.Value));
                }

                if (coordsList.Count >= 2)
                {
                    var directPoints = coordsList.Select(c => $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}");
                    route.Wkt = $"LINESTRING({string.Join(", ", directPoints)})";
                    try { route.Geometry = _wktReader.Read(route.Wkt); } catch { }
                }

                route.ModifiedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return MapToRouteDto(route);
            }
            else if (targetMode == "custom" || targetMode == "bukulmus")
            {
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
                route.GeometryType = "Osrm";
                return await GenerateOsrmRouteAsync(routeId);
            }
            else if (targetMode == "revert" || targetMode == "restore" || targetMode == "undo")
            {
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

        public async Task<bool> AddStopToRouteAsync(int routeId, int stopId, string position = "end", int? targetStopId = null)
        {
            await EnsureStopSchemaAsync();

            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted);
            var stop = await _context.Stops.FirstOrDefaultAsync(s => s.Id == stopId && !s.IsDeleted);
            if (route == null || stop == null) return false;

            // KAT-I SINIF İZOLASYONU KONTROLÜ: Sadece aynı sınıftaki durak ve güzergahlar bağlanabilir!
            if (!AreClassesCompatible(stop.StopClass, route.RouteClass))
            {
                Console.WriteLine($"[TransportService] Reddedildi: Durak sınıfı ({stop.StopClass}) ile Güzergah sınıfı ({route.RouteClass}) uyumsuz!");
                return false;
            }

            var existingJunctions = await _context.RouteStops
                .Where(rs => rs.RouteId == routeId)
                .OrderBy(rs => rs.OrderIndex)
                .ToListAsync();

            var currentJunction = existingJunctions.FirstOrDefault(rs => rs.StopId == stopId);

            int targetIndex = 1;
            string pos = (position ?? "end").ToLowerInvariant().Trim();

            if (pos == "start" || pos == "basa" || pos == "once")
            {
                targetIndex = 1;
                // Mevcut tüm durakların indeksini 1 kaydır
                foreach (var j in existingJunctions.Where(j => j.StopId != stopId))
                {
                    j.OrderIndex += 1;
                }
            }
            else if (pos == "before" && targetStopId.HasValue)
            {
                var refJ = existingJunctions.FirstOrDefault(j => j.StopId == targetStopId.Value);
                int refOrder = refJ != null ? refJ.OrderIndex : 1;
                targetIndex = refOrder;
                foreach (var j in existingJunctions.Where(j => j.StopId != stopId && j.OrderIndex >= refOrder))
                {
                    j.OrderIndex += 1;
                }
            }
            else if (pos == "after" && targetStopId.HasValue)
            {
                var refJ = existingJunctions.FirstOrDefault(j => j.StopId == targetStopId.Value);
                int refOrder = refJ != null ? refJ.OrderIndex : existingJunctions.Count;
                targetIndex = refOrder + 1;
                foreach (var j in existingJunctions.Where(j => j.StopId != stopId && j.OrderIndex > refOrder))
                {
                    j.OrderIndex += 1;
                }
            }
            else // "end" veya "sona"
            {
                var maxOrder = existingJunctions.Any() ? existingJunctions.Max(rs => rs.OrderIndex) : 0;
                targetIndex = maxOrder + 1;
            }

            if (currentJunction == null)
            {
                _context.RouteStops.Add(new RouteStopFeature
                {
                    RouteId = routeId,
                    StopId = stopId,
                    OrderIndex = targetIndex,
                    CreatedDate = DateTime.UtcNow
                });
            }
            else
            {
                currentJunction.OrderIndex = targetIndex;
            }

            if (!stop.RouteId.HasValue || stop.RouteId <= 0)
            {
                stop.RouteId = routeId;
            }

            route.ModifiedDate = DateTime.UtcNow;
            stop.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Sıralamayı normalize et (1..N ardışık yap)
            var allJunctions = await _context.RouteStops
                .Where(rs => rs.RouteId == routeId)
                .OrderBy(rs => rs.OrderIndex)
                .ToListAsync();

            for (int i = 0; i < allJunctions.Count; i++)
            {
                allJunctions[i].OrderIndex = i + 1;
            }
            await _context.SaveChangesAsync();

            // Hat çizgisini otomatik yeniden oluştur
            try
            {
                await GenerateOsrmRouteAsync(routeId);
            }
            catch { }

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

            // Kalan durakların sıralamasını normalize et
            var remainingJunctions = await _context.RouteStops
                .Where(rs => rs.RouteId == routeId)
                .OrderBy(rs => rs.OrderIndex)
                .ToListAsync();

            for (int i = 0; i < remainingJunctions.Count; i++)
            {
                remainingJunctions[i].OrderIndex = i + 1;
            }
            await _context.SaveChangesAsync();

            // Hat çizgisini güncelle
            try
            {
                await GenerateOsrmRouteAsync(routeId);
            }
            catch { }

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
                ? route.RouteStops.Where(rs => rs.Stop != null && !rs.Stop.IsDeleted).OrderBy(rs => rs.OrderIndex).Select(rs => rs.Stop!).ToList() 
                : new List<StopFeature>();

            // Junction listesi varsa order_index junction üzerinden alınır
            var combinedStops = (junctionStops.Any() ? junctionStops : directStops)
                .GroupBy(s => s.Id)
                .Select(g => g.First())
                .Select(MapToStopDto)
                .ToList();

            if (route.RouteStops != null && route.RouteStops.Any())
            {
                foreach (var s in combinedStops)
                {
                    var j = route.RouteStops.FirstOrDefault(rs => rs.StopId == s.Id);
                    if (j != null)
                    {
                        s.OrderIndex = j.OrderIndex;
                    }
                }
                combinedStops = combinedStops.OrderBy(s => s.OrderIndex).ToList();
            }

            return new RouteDto
            {
                Id = route.Id,
                Name = route.Name,
                Color = route.Color ?? "#3B82F6",
                RouteClass = NormalizeClass(route.RouteClass),
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
                        double.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out double parsedLon) &&
                        double.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out double parsedLat))
                    {
                        lon = parsedLon;
                        lat = parsedLat;
                    }
                }
                catch { }
            }

            if (lat.HasValue && lon.HasValue)
            {
                // EPSG:3857 -> EPSG:4326 dönüşümü
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
                    RouteClass = NormalizeClass(s.Route.RouteClass),
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
                            RouteClass = NormalizeClass(rs.Route.RouteClass),
                            OrderIndex = rs.OrderIndex
                        });
                    }
                }
            }

            var stopClass = NormalizeClass(!string.IsNullOrWhiteSpace(s.StopClass) ? s.StopClass : s.Route?.RouteClass);

            return new StopDto
            {
                Id = s.Id,
                Name = s.Name,
                StopCode = !string.IsNullOrWhiteSpace(s.StopCode) ? s.StopCode : GenerateStopCode(stopClass, s.Id),
                OrderIndex = s.OrderIndex,
                Description = s.Description,
                RouteId = s.RouteId,
                RouteName = s.Route?.Name,
                RouteColor = s.Route?.Color ?? "#3B82F6",
                RouteIds = routeIdList,
                Routes = routeList,
                StopClass = stopClass,
                ImageUrl = s.ImageUrl,
                Wkt = s.Wkt,
                Latitude = lat,
                Longitude = lon,
                IsActive = s.IsActive,
                CreatedDate = s.CreatedDate
            };
        }

        private static List<(double Longitude, double Latitude)> GenerateSmoothSpline(List<(double Longitude, double Latitude)> points, int segmentsPerSpan = 6)
        {
            if (points == null || points.Count < 2) return points ?? new List<(double Longitude, double Latitude)>();
            if (points.Count == 2) return points;

            var result = new List<(double Longitude, double Latitude)>();
            int n = points.Count;

            for (int i = 0; i < n - 1; i++)
            {
                var p0 = i > 0 ? points[i - 1] : points[i];
                var p1 = points[i];
                var p2 = points[i + 1];
                var p3 = (i + 2 < n) ? points[i + 2] : points[i + 1];

                for (int step = 0; step < segmentsPerSpan; step++)
                {
                    double t = (double)step / segmentsPerSpan;
                    double t2 = t * t;
                    double t3 = t2 * t;

                    // Catmull-Rom Spline Formula
                    double lon = 0.5 * (
                        (2 * p1.Longitude) +
                        (-p0.Longitude + p2.Longitude) * t +
                        (2 * p0.Longitude - 5 * p1.Longitude + 4 * p2.Longitude - p3.Longitude) * t2 +
                        (-p0.Longitude + 3 * p1.Longitude - 3 * p2.Longitude + p3.Longitude) * t3
                    );

                    double lat = 0.5 * (
                        (2 * p1.Latitude) +
                        (-p0.Latitude + p2.Latitude) * t +
                        (2 * p0.Latitude - 5 * p1.Latitude + 4 * p2.Latitude - p3.Latitude) * t2 +
                        (-p0.Latitude + 3 * p1.Latitude - 3 * p2.Latitude + p3.Latitude) * t3
                    );

                    result.Add((lon, lat));
                }
            }

            result.Add(points.Last());
            return result;
        }

        #endregion
    }
}
