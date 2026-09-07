using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace GeoraphMap.Infrastructure.Services
{
    public class TransportService : ITransportService
    {
        private readonly AppDbContext _context;
        private readonly WKTReader _wktReader;
        private readonly IOsrmRoutingService _osrmRoutingService;
        private readonly IServiceScopeFactory? _scopeFactory;

        public TransportService(AppDbContext context, IOsrmRoutingService osrmRoutingService, IServiceScopeFactory? scopeFactory = null)
        {
            _context = context;
            _osrmRoutingService = osrmRoutingService;
            _scopeFactory = scopeFactory;
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
                .AsNoTracking()
                .Where(r => !r.IsDeleted);

            if (includeStops)
            {
                query = query
                    .AsSplitQuery()
                    .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                    .Include(r => r.RouteStops)
                        .ThenInclude(rs => rs.Stop);
            }

            var routes = await query.OrderBy(r => r.Name).ToListAsync();

            Dictionary<int, List<RouteStopFeature>>? junctionsByStop = null;
            if (includeStops)
            {
                // Devasa bellek optimizasyonu (3.2 GB -> ~250 MB):
                // 40.000 kaydı ve 9.200 parametreli Contains sorgusunu ve ağır Route entity graph'larını Include etmeden,
                // sadece StopId, RouteId, OrderIndex skalar projeksiyonu çekip bellekteki routes ile eşleştir
                var routeMap = routes.ToDictionary(r => r.Id, r => new RouteSummaryDto
                {
                    Id = r.Id,
                    Name = r.Name,
                    Color = r.Color ?? "#3B82F6",
                    RouteClass = NormalizeClass(r.RouteClass)
                });

                var rawJunctions = await _context.RouteStops
                    .AsNoTracking()
                    .Select(rs => new { rs.StopId, rs.RouteId, rs.OrderIndex })
                    .ToListAsync();

                junctionsByStop = rawJunctions
                    .Where(j => routeMap.ContainsKey(j.RouteId))
                    .GroupBy(j => j.StopId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(j => new RouteStopFeature
                        {
                            StopId = j.StopId,
                            RouteId = j.RouteId,
                            OrderIndex = j.OrderIndex,
                            Route = new RouteFeature
                            {
                                Id = j.RouteId,
                                Name = routeMap[j.RouteId].Name,
                                Color = routeMap[j.RouteId].Color,
                                RouteClass = routeMap[j.RouteId].RouteClass
                            }
                        }).ToList()
                    );
            }

            // Tekil liman sahte kayıtlarını filtrele
            var validRoutes = routes
                .Where(r => !(NormalizeClass(r.RouteClass) == "deniz" && string.IsNullOrEmpty(r.Wkt) && (r.Stops == null || r.Stops.Count <= 1)))
                .Select(r => MapToRouteDto(r, junctionsByStop))
                .ToList();

            if (GC.GetTotalMemory(false) > 400_000_000)
            {
                GC.Collect(2, GCCollectionMode.Aggressive, false, false);
            }

            return validRoutes;
        }

        public async Task<RouteDto?> GetRouteByIdAsync(int id)
        {
            var route = await _context.Routes
                .AsNoTracking()
                .AsSplitQuery()
                .Include(r => r.Stops.Where(s => !s.IsDeleted).OrderBy(s => s.OrderIndex))
                .Include(r => r.RouteStops)
                    .ThenInclude(rs => rs.Stop)
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

            if (route == null) return null;

            var allStopIds = (route.Stops?.Select(s => s.Id) ?? Enumerable.Empty<int>())
                .Concat(route.RouteStops?.Select(rs => rs.StopId) ?? Enumerable.Empty<int>())
                .Distinct()
                .ToList();

            var junctions = await _context.RouteStops
                .AsNoTracking()
                .Include(rs => rs.Route)
                .Where(rs => allStopIds.Contains(rs.StopId) && rs.Route != null && !rs.Route.IsDeleted)
                .ToListAsync();

            var junctionsByStop = junctions
                .GroupBy(rs => rs.StopId)
                .ToDictionary(g => g.Key, g => g.ToList());

            return MapToRouteDto(route, junctionsByStop);
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
            // 9.285 durak için devasa bellek optimizasyonu:
            // Güzergahların devasa WKT ve geometry verilerini belleğe çekmeden doğrudan skalar projeksiyon yap
            var stopItems = await _context.Stops
                .AsNoTracking()
                .Where(s => !s.IsDeleted)
                .Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.StopCode,
                    s.OrderIndex,
                    s.Description,
                    s.RouteId,
                    RouteName = s.Route != null && !s.Route.IsDeleted ? s.Route.Name : null,
                    RouteColor = s.Route != null && !s.Route.IsDeleted ? s.Route.Color : null,
                    RouteClass = s.Route != null && !s.Route.IsDeleted ? s.Route.RouteClass : null,
                    s.StopClass,
                    s.ImageUrl,
                    s.Wkt,
                    Lon = s.Geometry != null ? (double?)s.Geometry.X : null,
                    Lat = s.Geometry != null ? (double?)s.Geometry.Y : null,
                    s.IsActive,
                    s.CreatedDate,
                    RouteStops = s.RouteStops
                        .Where(rs => rs.Route != null && !rs.Route.IsDeleted)
                        .Select(rs => new
                        {
                            rs.RouteId,
                            RouteName = rs.Route!.Name,
                            RouteColor = rs.Route.Color,
                            RouteClass = rs.Route.RouteClass,
                            rs.OrderIndex
                        })
                        .ToList()
                })
                .OrderBy(s => s.RouteId)
                .ThenBy(s => s.OrderIndex)
                .ToListAsync();

            return stopItems.Select(s =>
            {
                var normClass = NormalizeClass(!string.IsNullOrWhiteSpace(s.StopClass) ? s.StopClass : s.RouteClass);
                var routeList = new List<RouteSummaryDto>();
                var routeIdList = new List<int>();

                if (s.RouteId.HasValue && s.RouteId.Value > 0 && !string.IsNullOrEmpty(s.RouteName))
                {
                    routeIdList.Add(s.RouteId.Value);
                    routeList.Add(new RouteSummaryDto
                    {
                        Id = s.RouteId.Value,
                        Name = s.RouteName,
                        Color = s.RouteColor ?? "#3B82F6",
                        RouteClass = NormalizeClass(s.RouteClass),
                        OrderIndex = s.OrderIndex
                    });
                }

                foreach (var rs in s.RouteStops)
                {
                    if (!routeIdList.Contains(rs.RouteId))
                    {
                        routeIdList.Add(rs.RouteId);
                        routeList.Add(new RouteSummaryDto
                        {
                            Id = rs.RouteId,
                            Name = rs.RouteName,
                            Color = rs.RouteColor ?? "#3B82F6",
                            RouteClass = NormalizeClass(rs.RouteClass),
                            OrderIndex = rs.OrderIndex
                        });
                    }
                }

                return new StopDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    StopCode = !string.IsNullOrWhiteSpace(s.StopCode) ? s.StopCode : GenerateStopCode(normClass, s.Id),
                    OrderIndex = s.OrderIndex,
                    Description = s.Description,
                    RouteId = s.RouteId,
                    RouteName = s.RouteName,
                    RouteColor = s.RouteColor ?? "#3B82F6",
                    RouteIds = routeIdList,
                    Routes = routeList,
                    StopClass = normClass,
                    ImageUrl = s.ImageUrl,
                    Wkt = s.Wkt,
                    Latitude = s.Lat,
                    Longitude = s.Lon,
                    IsActive = s.IsActive,
                    CreatedDate = s.CreatedDate
                };
            }).ToList();
        }

        public async Task<List<StopDto>> GetStopsByRouteIdAsync(int routeId)
        {
            await EnsureStopSchemaAsync();

            var stops = await _context.Stops
                .AsNoTracking()
                .AsSplitQuery()
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .Where(s => !s.IsDeleted && (s.RouteId == routeId || s.RouteStops.Any(rs => rs.RouteId == routeId)))
                .ToListAsync();

            var junctionOrderDict = await _context.RouteStops
                .AsNoTracking()
                .Where(rs => rs.RouteId == routeId)
                .GroupBy(rs => rs.StopId)
                .ToDictionaryAsync(g => g.Key, g => g.First().OrderIndex);

            var stopDtos = stops.Select(s =>
            {
                var dto = MapToStopDto(s);
                if (junctionOrderDict.TryGetValue(s.Id, out int jOrder))
                {
                    dto.OrderIndex = jOrder;
                }
                else if (s.RouteId == routeId)
                {
                    dto.OrderIndex = s.OrderIndex;
                }
                return dto;
            })
            .OrderBy(s => s.OrderIndex)
            .ToList();

            return stopDtos;
        }

        public async Task<StopDto?> GetStopByIdAsync(int id)
        {
            await EnsureStopSchemaAsync();

            var stop = await _context.Stops
                .AsNoTracking()
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

            bool locationChanged = false;
            if (!string.IsNullOrWhiteSpace(dto.Wkt) && dto.Wkt.Trim() != (stop.Wkt ?? "").Trim())
            {
                stop.Wkt = dto.Wkt.Trim();
                try
                {
                    var parsed = _wktReader.Read(dto.Wkt);
                    if (parsed is Point p)
                    {
                        stop.Geometry = p;
                        locationChanged = true;
                    }
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

                // Metro ve tren duraklarına kesinlikle otobüs hatlarının bağlanmasını engelle
                if (NormalizeClass(currentClass) == "metro" || NormalizeClass(currentClass) == "tren")
                {
                    compatibleRouteIds = validRoutes
                        .Where(r => NormalizeClass(r.RouteClass) == NormalizeClass(currentClass))
                        .Select(r => r.Id)
                        .ToList();
                }

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
            }

            stop.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Durak taşındığında (koordinatı değiştiğinde) bağlı olan TÜM güzergahların hat geometrilerini
            // (Spline / Catmull-Rom veya OSRM) anında otomatik olarak yeni durak konumuna bağla
            if (locationChanged)
            {
                var affectedRouteIds = await _context.RouteStops
                    .Where(rs => rs.StopId == id)
                    .Select(rs => rs.RouteId)
                    .Distinct()
                    .ToListAsync();

                if (stop.RouteId.HasValue && !affectedRouteIds.Contains(stop.RouteId.Value))
                {
                    affectedRouteIds.Add(stop.RouteId.Value);
                }

                foreach (var rId in affectedRouteIds)
                {
                    try
                    {
                        await GenerateOsrmRouteAsync(rId);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[TransportService] Error auto-updating route {rId} geometry after stop {id} move: {ex.Message}");
                    }
                }
            }

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

            // Otomatik OSRM güncellemesi kaldırıldı, kullanıcı arayüzündeki OSRM butonu üzerinden manuel yönetilir.
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

            // Durak sıralaması değiştiğinde hat geometrisini (Spline veya OSRM) ANINDA yeni sıralamaya göre yeniden hesapla ve kaydet
            try
            {
                await GenerateOsrmRouteAsync(routeId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TransportService] Reorder geometry update error for route {routeId}: {ex.Message}");
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

            // Direct ve Junction duraklarını harmanla ve sırayla birleştir
            var allStopsDict = new Dictionary<int, (StopFeature Stop, int OrderIndex)>();
            if (route.Stops != null)
            {
                foreach (var s in route.Stops.Where(s => !s.IsDeleted))
                {
                    allStopsDict[s.Id] = (s, s.OrderIndex);
                }
            }
            if (route.RouteStops != null)
            {
                foreach (var rs in route.RouteStops.Where(rs => rs.Stop != null && !rs.Stop.IsDeleted))
                {
                    allStopsDict[rs.StopId] = (rs.Stop!, rs.OrderIndex);
                }
            }

            var orderedStops = allStopsDict.Values
                .OrderBy(x => x.OrderIndex)
                .Select(x => x.Stop)
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
                return MapToRouteDto(route);
            }

            var rClass = NormalizeClass(route.RouteClass);

            // 1. Metro, Tramvay, Metrobüs, Tren, Deniz ve Havayolu hatları için organik kıvrımlı hat geometrisi (Spline) oluştur
            if (rClass == "metro" || rClass == "deniz" || rClass == "tren" || rClass == "tramvay" || rClass == "metrobus" || rClass == "havayolu")
            {
                // Kuş uçuşu sert kırılmalar yerine raylı sistemler için organik kıvrımlı (Catmull-Rom Spline) geometri üret
                var curvedPoints = GenerateSmoothSpline(coordsList, segmentsPerSpan: 6);
                var splineCoords = curvedPoints.Select(c => $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}");
                var splineWkt = $"LINESTRING({string.Join(", ", splineCoords)})";

                route.PreviousWkt = route.Wkt;
                route.Wkt = splineWkt;
                route.CustomWkt = splineWkt;
                route.GeometryType = "Custom";

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

        public async Task<BatchOsrmResultDto> GenerateAllBusRoutesOsrmAsync(bool onlyNonOsrm = false)
        {
            var result = new BatchOsrmResultDto();

            var busRoutes = await _context.Routes
                .Where(r => !r.IsDeleted)
                .Select(r => new { r.Id, r.Name, r.RouteClass, r.GeometryType })
                .ToListAsync();

            var targetRouteIds = busRoutes
                .Where(r => NormalizeClass(r.RouteClass) == "otobus")
                .Where(r => !onlyNonOsrm || (r.GeometryType != "Osrm"))
                .Select(r => r.Id)
                .ToList();

            result.TotalRoutes = targetRouteIds.Count;

            int successCount = 0;
            int failedCount = 0;
            int processedCount = 0;

            if (_scopeFactory != null)
            {
                var semaphore = new System.Threading.SemaphoreSlim(4, 4);
                var tasks = targetRouteIds.Select(async id =>
                {
                    await semaphore.WaitAsync();
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var scopedService = scope.ServiceProvider.GetRequiredService<ITransportService>();
                        var updated = await scopedService.GenerateOsrmRouteAsync(id);
                        if (updated != null && updated.GeometryType == "Osrm")
                        {
                            System.Threading.Interlocked.Increment(ref successCount);
                        }
                        else
                        {
                            System.Threading.Interlocked.Increment(ref failedCount);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Threading.Interlocked.Increment(ref failedCount);
                        Console.WriteLine($"[TransportService] Error batch generating OSRM for route {id}: {ex.Message}");
                    }
                    finally
                    {
                        System.Threading.Interlocked.Increment(ref processedCount);
                        semaphore.Release();
                    }
                });
                await Task.WhenAll(tasks);
            }
            else
            {
                foreach (var id in targetRouteIds)
                {
                    try
                    {
                        var updated = await GenerateOsrmRouteAsync(id);
                        if (updated != null && updated.GeometryType == "Osrm")
                            successCount++;
                        else
                            failedCount++;
                    }
                    catch (Exception ex)
                    {
                        failedCount++;
                        Console.WriteLine($"[TransportService] Error batch generating OSRM for route {id}: {ex.Message}");
                    }
                    processedCount++;
                }
            }

            result.ProcessedCount = processedCount;
            result.SuccessCount = successCount;
            result.FailedCount = failedCount;
            result.Message = $"{successCount} otobüs hattı OSRM ile başarıyla güncellendi. ({failedCount} başarısız veya yetersiz duraklı)";
            return result;
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

                var allStopsDict = new Dictionary<int, (StopFeature Stop, int OrderIndex)>();
                if (route.Stops != null)
                {
                    foreach (var s in route.Stops.Where(s => !s.IsDeleted))
                    {
                        allStopsDict[s.Id] = (s, s.OrderIndex);
                    }
                }
                if (route.RouteStops != null)
                {
                    foreach (var rs in route.RouteStops.Where(rs => rs.Stop != null && !rs.Stop.IsDeleted))
                    {
                        allStopsDict[rs.StopId] = (rs.Stop!, rs.OrderIndex);
                    }
                }

                var orderedStops = allStopsDict.Values
                    .OrderBy(x => x.OrderIndex)
                    .Select(x => x.Stop)
                    .ToList();
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

        public async Task<int> FixOrphanMetroStopsAsync()
        {
            await EnsureStopSchemaAsync();

            var metroStops = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .Where(s => !s.IsDeleted && s.StopClass.ToLower() == "metro")
                .ToListAsync();

            int convertedCount = 0;
            foreach (var stop in metroStops)
            {
                bool isConnectedToMetro = 
                    (stop.Route != null && !stop.Route.IsDeleted && NormalizeClass(stop.Route.RouteClass) == "metro") ||
                    (stop.RouteStops != null && stop.RouteStops.Any(rs => rs.Route != null && !rs.Route.IsDeleted && NormalizeClass(rs.Route.RouteClass) == "metro"));

                if (!isConnectedToMetro)
                {
                    stop.StopClass = "otobus";
                    stop.ModifiedDate = DateTime.UtcNow;
                    convertedCount++;
                }
            }

            // Metro duraklarına bağlı olan otobüs hatlarını (RouteStop) kesin olarak sil
            var busJunctionsOnMetro = await _context.RouteStops
                .Include(rs => rs.Stop)
                .Include(rs => rs.Route)
                .Where(rs => rs.Stop != null && rs.Stop.StopClass == "metro" && rs.Route != null && NormalizeClass(rs.Route.RouteClass) == "otobus")
                .ToListAsync();

            if (busJunctionsOnMetro.Any())
            {
                _context.RouteStops.RemoveRange(busJunctionsOnMetro);
            }

            await _context.SaveChangesAsync();
            return convertedCount;
        }

        public async Task<int> FixOrphanTrenStopsAsync()
        {
            await EnsureStopSchemaAsync();

            var trenStops = await _context.Stops
                .Include(s => s.Route)
                .Include(s => s.RouteStops)
                    .ThenInclude(rs => rs.Route)
                .Where(s => !s.IsDeleted && s.StopClass.ToLower() == "tren")
                .ToListAsync();

            int convertedCount = 0;
            foreach (var stop in trenStops)
            {
                bool isConnectedToTren = 
                    (stop.Route != null && !stop.Route.IsDeleted && NormalizeClass(stop.Route.RouteClass) == "tren") ||
                    (stop.RouteStops != null && stop.RouteStops.Any(rs => rs.Route != null && !rs.Route.IsDeleted && NormalizeClass(rs.Route.RouteClass) == "tren"));

                if (!isConnectedToTren)
                {
                    stop.StopClass = "otobus";
                    stop.ModifiedDate = DateTime.UtcNow;
                    convertedCount++;
                }
            }

            // Tren duraklarına bağlı olan otobüs hatlarını (RouteStop) kesin olarak sil
            var busJunctionsOnTren = await _context.RouteStops
                .Include(rs => rs.Stop)
                .Include(rs => rs.Route)
                .Where(rs => rs.Stop != null && rs.Stop.StopClass == "tren" && rs.Route != null && NormalizeClass(rs.Route.RouteClass) == "otobus")
                .ToListAsync();

            if (busJunctionsOnTren.Any())
            {
                _context.RouteStops.RemoveRange(busJunctionsOnTren);
            }

            await _context.SaveChangesAsync();
            return convertedCount;
        }

        public async Task<int> ConvertStopsToBusByCodesOrIdsAsync(List<string> codesOrIds)
        {
            await EnsureStopSchemaAsync();
            if (codesOrIds == null || codesOrIds.Count == 0) return 0;
            var set = codesOrIds.Select(c => c.Trim()).Where(c => !string.IsNullOrEmpty(c)).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var allStops = await _context.Stops.Where(s => !s.IsDeleted).ToListAsync();
            int converted = 0;
            foreach (var s in allStops)
            {
                if (set.Contains(s.Id.ToString()) || (!string.IsNullOrEmpty(s.StopCode) && set.Contains(s.StopCode.Trim())))
                {
                    if (s.StopClass != "otobus")
                    {
                        s.StopClass = "otobus";
                        s.ModifiedDate = DateTime.UtcNow;
                        converted++;
                    }
                }
            }
            if (converted > 0)
            {
                await _context.SaveChangesAsync();
            }
            return converted;
        }

        public async Task<bool> FixAnkaraTransitJunctionsAsync()
        {
            await EnsureStopSchemaAsync();

            // 1. Kızılay (ID: 224) - Sınıf ve kod güncelle
            var kizilay = await _context.Stops.FirstOrDefaultAsync(s => s.Id == 224 && !s.IsDeleted);
            if (kizilay != null)
            {
                kizilay.StopClass = "metro";
                kizilay.StopCode = "METRO-ANK-KZY";
                kizilay.Name = "15 Temmuz Kızılay Milli İrade";
                kizilay.ModifiedDate = DateTime.UtcNow;
            }

            // 2. Çoklu aktarma junction tanımları: (RouteId, StopId, OrderIndex)
            var junctionDefinitions = new List<(int RouteId, int StopId, int OrderIndex)>
            {
                // Kızılay (224): Ankaray'da 8, M2 Koru-OSB'de 23, M4 Keçiören'de 1
                (78, 224, 8),   // A1 Ankaray AŞTİ - Dikimevi
                (5,  224, 23),  // M2 Koru - OSB-Törekent (Sıhhiye 22 ile Necatibey 24 arası)
                (77, 224, 1),   // M4 Kızılay - Keçiören (Adliye 2 öncesi)

                // AKM (227): M2'de 20, M4'te 5
                (5,  227, 20),  // M2 Koru - OSB-Törekent (Akköprü 19 ile Ulus 21 arası)
                (77, 227, 5),   // M4 Kızılay - Keçiören (Ankara Garı 4 ile ASKİ 6 arası)

                // Ankara Garı (248): M4'te 4, Başkentray'da 4
                (77, 248, 4),   // M4 Kızılay - Keçiören
                (79, 248, 4),   // B1 Başkentray Sincan - Kayaş

                // Gar (319): M4'te 3
                (77, 319, 3),   // M4 Kızılay - Keçiören

                // Sıhhiye (225): M2'de 22, Başkentray'da 5
                (5,  225, 22),  // M2 Koru - OSB-Törekent
                (79, 225, 5),   // B1 Başkentray Sincan - Kayaş

                // Kurtuluş (265): Ankaray'da 10, Başkentray'da 6
                (78, 265, 10),  // A1 Ankaray
                (79, 265, 6),   // B1 Başkentray

                // Maltepe (262): Ankaray'da 6
                (78, 262, 6)    // A1 Ankaray
            };

            foreach (var (rId, sId, ord) in junctionDefinitions)
            {
                var stopExists = await _context.Stops.AnyAsync(s => s.Id == sId && !s.IsDeleted);
                var routeExists = await _context.Routes.AnyAsync(r => r.Id == rId && !r.IsDeleted);
                if (!stopExists || !routeExists) continue;

                var existingJunction = await _context.RouteStops
                    .FirstOrDefaultAsync(rs => rs.RouteId == rId && rs.StopId == sId);

                if (existingJunction != null)
                {
                    existingJunction.OrderIndex = ord;
                }
                else
                {
                    _context.RouteStops.Add(new RouteStopFeature
                    {
                        RouteId = rId,
                        StopId = sId,
                        OrderIndex = ord,
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }

            // 3. M4 Keçiören - Kızılay Hattı Tam Sıralamasını Garanti Et:
            // 1: 224 (Kızılay) -> 2: 247 (Adliye) -> 3: 319 (Gar) -> 4: 248 (Ankara Garı) -> 5: 227 (AKM)
            // -> 6: 249 (ASKİ) -> 7: 250 (Dışkapı) -> 8: 251 (Meteoroloji) -> 9: 252 (Belediye)
            // -> 10: 253 (Mecidiye) -> 11: 254 (Kuyubaşı) -> 12: 255 (Dutluk) -> 13: 256 (Şehitler)
            var m4OrderedStops = new List<int> { 224, 247, 319, 248, 227, 249, 250, 251, 252, 253, 254, 255, 256 };
            for (int i = 0; i < m4OrderedStops.Count; i++)
            {
                int sId = m4OrderedStops[i];
                int ord = i + 1;
                var j = await _context.RouteStops.FirstOrDefaultAsync(rs => rs.RouteId == 77 && rs.StopId == sId);
                if (j != null)
                {
                    j.OrderIndex = ord;
                }
                else
                {
                    var stopExists = await _context.Stops.AnyAsync(s => s.Id == sId && !s.IsDeleted);
                    if (stopExists)
                    {
                        _context.RouteStops.Add(new RouteStopFeature
                        {
                            RouteId = 77,
                            StopId = sId,
                            OrderIndex = ord,
                            CreatedDate = DateTime.UtcNow
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();

            // Metro ve tren duraklarındaki yetim ve otobüs hattı kalıntılarını tamamen temizle
            await FixOrphanMetroStopsAsync();
            await FixOrphanTrenStopsAsync();

            return true;
        }

        #endregion

        #region Helper Mapping

        private static RouteDto MapToRouteDto(RouteFeature route, Dictionary<int, List<RouteStopFeature>>? junctionsByStop = null)
        {
            // 1. Hem doğrudan durakları (route.Stops) hem de çoklu hat aktarma duraklarını (route.RouteStops) birleştir
            var allStopsDict = new Dictionary<int, StopFeature>();
            if (route.Stops != null)
            {
                foreach (var s in route.Stops.Where(s => !s.IsDeleted))
                {
                    allStopsDict[s.Id] = s;
                }
            }
            if (route.RouteStops != null)
            {
                foreach (var rs in route.RouteStops.Where(rs => rs.Stop != null && !rs.Stop.IsDeleted))
                {
                    allStopsDict[rs.StopId] = rs.Stop!;
                }
            }

            // 2. Bu rotaya özel atanmış order_index tablosu
            var junctionOrderDict = route.RouteStops?
                .Where(rs => rs != null)
                .GroupBy(rs => rs.StopId)
                .ToDictionary(g => g.Key, g => g.First().OrderIndex)
                ?? new Dictionary<int, int>();

            var combinedStops = allStopsDict.Values
                .Select(s =>
                {
                    List<RouteStopFeature>? stopJunctions = null;
                    if (junctionsByStop != null && junctionsByStop.TryGetValue(s.Id, out var jList))
                    {
                        stopJunctions = jList;
                    }
                    var dto = MapToStopDto(s, stopJunctions);
                    if (junctionOrderDict.TryGetValue(s.Id, out int jOrder))
                    {
                        dto.OrderIndex = jOrder;
                    }
                    else if (s.RouteId == route.Id)
                    {
                        dto.OrderIndex = s.OrderIndex;
                    }
                    return dto;
                })
                .OrderBy(s => s.OrderIndex)
                .ToList();

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
            return MapToStopDto(s, null);
        }

        private static StopDto MapToStopDto(StopFeature s, List<RouteStopFeature>? stopJunctions)
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

            var effectiveJunctions = stopJunctions ?? (s.RouteStops != null ? s.RouteStops.ToList() : new List<RouteStopFeature>());
            if (effectiveJunctions.Any())
            {
                foreach (var rs in effectiveJunctions)
                {
                    if (!routeIdList.Contains(rs.RouteId))
                    {
                        routeIdList.Add(rs.RouteId);
                    }

                    if (rs.Route != null && !rs.Route.IsDeleted && !routeList.Any(r => r.Id == rs.RouteId))
                    {
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
