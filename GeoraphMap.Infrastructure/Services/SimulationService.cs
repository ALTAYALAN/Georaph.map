using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace GeoraphMap.Infrastructure.Services
{
    public class SimulationService : ISimulationService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ISimulationHubNotifier _hubNotifier;
        private readonly ILogger<SimulationService> _logger;

        private readonly ConcurrentDictionary<int, ActiveRouteSimulation> _activeSimulations = new();

        public SimulationService(
            IServiceScopeFactory scopeFactory,
            ISimulationHubNotifier hubNotifier,
            ILogger<SimulationService> logger)
        {
            _scopeFactory = scopeFactory;
            _hubNotifier = hubNotifier;
            _logger = logger;
        }

        public async Task<SimulationStatusDto?> StartSimulationAsync(int routeId, string startedBy = "Operatör")
        {
            // Eğer daha önce çalışan/iptal edilmiş bir simülasyon varsa sonlandırıp sıfırdan başlamasını sağla
            if (_activeSimulations.TryRemove(routeId, out var existingSim))
            {
                try
                {
                    existingSim.IsPaused = false;
                    existingSim.CancellationTokenSource.Cancel();
                }
                catch { }
            }

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var route = await dbContext.Routes
                .Include(r => r.Stops)
                .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted && r.IsActive);

            if (route == null)
            {
                _logger.LogWarning("Simulation failed: Route {RouteId} not found or inactive.", routeId);
                return null;
            }

            var sortedStops = route.Stops
                .Where(s => !s.IsDeleted && s.IsActive)
                .OrderBy(s => s.OrderIndex)
                .ToList();

            // Rota çizgisi koordinatlarını hazırla
            var pathPoints = ExtractRoutePathCoordinates(route, sortedStops);
            if (pathPoints == null || pathPoints.Count < 2)
            {
                _logger.LogWarning("Simulation failed: Route {RouteId} doesn't have sufficient coordinates/stops for simulation.", routeId);
                return null;
            }

            // Düzgün ve akıcı bir animasyon için güzergah üzerinde ara noktaları (interpolation) hesapla
            var interpolatedSteps = GenerateInterpolatedSteps(pathPoints, sortedStops, targetStepCount: 75);
            if (interpolatedSteps.Count < 2)
            {
                return null;
            }

            var cts = new CancellationTokenSource();
            var activeSim = new ActiveRouteSimulation
            {
                RouteId = route.Id,
                RouteName = route.Name,
                RouteColor = string.IsNullOrWhiteSpace(route.Color) ? "#3b82f6" : route.Color,
                RouteClass = string.IsNullOrWhiteSpace(route.RouteClass) ? "araba" : route.RouteClass,
                StartedBy = startedBy,
                StartedAt = DateTime.UtcNow,
                CancellationTokenSource = cts,
                Steps = interpolatedSteps
            };

            _activeSimulations[routeId] = activeSim;

            // İlk konumu hazırla (0. adım - rotanın tam başı)
            var initialLoc = activeSim.Steps[0].ToLocationDto(
                route.Id, route.Name, activeSim.RouteColor, activeSim.RouteClass, 0, activeSim.Steps.Count, isCompleted: false
            );
            activeSim.LastLocation = initialLoc;

            // SignalR ile simülasyonun başladığını tüm istemcilere ve o güzergah grubuna duyur
            _ = Task.Run(async () =>
            {
                try
                {
                    await _hubNotifier.BroadcastSimulationStartedAsync(activeSim.ToStatusDto());
                    await _hubNotifier.BroadcastSimulationStateChangedAsync(routeId, isRunning: true, isCompleted: false);
                    await _hubNotifier.BroadcastVehicleLocationAsync(routeId, initialLoc);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error broadcasting SimulationStarted for Route {RouteId}", routeId);
                }
            });

            // Arka planda simülasyon döngüsünü başlat
            _ = Task.Run(() => RunSimulationLoopAsync(activeSim, cts.Token));

            _logger.LogInformation("Simulation started for Route {RouteId} ({RouteName}) by {StartedBy}. Total steps: {Steps}",
                route.Id, route.Name, startedBy, interpolatedSteps.Count);

            return activeSim.ToStatusDto();
        }

        public async Task<bool> PauseSimulationAsync(int routeId)
        {
            if (_activeSimulations.TryGetValue(routeId, out var sim))
            {
                sim.IsPaused = true;
                if (sim.LastLocation != null)
                {
                    sim.LastLocation.IsPaused = true;
                    await _hubNotifier.BroadcastVehicleLocationAsync(routeId, sim.LastLocation);
                }
                await _hubNotifier.BroadcastSimulationPausedAsync(routeId);
                _logger.LogInformation("Simulation paused for Route {RouteId}", routeId);
                return true;
            }
            return false;
        }

        public async Task<bool> ResumeSimulationAsync(int routeId)
        {
            if (_activeSimulations.TryGetValue(routeId, out var sim))
            {
                sim.IsPaused = false;
                if (sim.LastLocation != null)
                {
                    sim.LastLocation.IsPaused = false;
                    await _hubNotifier.BroadcastVehicleLocationAsync(routeId, sim.LastLocation);
                }
                await _hubNotifier.BroadcastSimulationResumedAsync(routeId);
                _logger.LogInformation("Simulation resumed for Route {RouteId}", routeId);
                return true;
            }
            return false;
        }

        public async Task<bool> StopSimulationAsync(int routeId)
        {
            if (_activeSimulations.TryRemove(routeId, out var sim))
            {
                sim.IsPaused = false;
                try
                {
                    sim.CancellationTokenSource.Cancel();
                }
                catch { }

                await _hubNotifier.BroadcastSimulationStoppedAsync(routeId);
                await _hubNotifier.BroadcastSimulationStateChangedAsync(routeId, isRunning: false, isCompleted: false);

                _logger.LogInformation("Simulation stopped/cancelled completely for Route {RouteId}", routeId);
                return true;
            }

            // Simülasyon sözlükte zaten yoksa bile (önceden tamamlanmış/durdurulmuş olabilir)
            // İstemcilerin durumunu eşitlemek için durduruldu yayınını garanti et ve başarılı dön
            await _hubNotifier.BroadcastSimulationStoppedAsync(routeId);
            await _hubNotifier.BroadcastSimulationStateChangedAsync(routeId, isRunning: false, isCompleted: false);
            return true;
        }

        public List<SimulationStatusDto> GetActiveSimulations()
        {
            return _activeSimulations.Values.Select(s => s.ToStatusDto()).ToList();
        }

        public VehicleLocationDto? GetLastLocation(int routeId)
        {
            if (_activeSimulations.TryGetValue(routeId, out var sim))
            {
                return sim.LastLocation;
            }
            return null;
        }

        public bool IsSimulationRunning(int routeId)
        {
            return _activeSimulations.ContainsKey(routeId);
        }

        private async Task RunSimulationLoopAsync(ActiveRouteSimulation sim, CancellationToken token)
        {
            try
            {
                int total = sim.Steps.Count;

                while (!token.IsCancellationRequested)
                {
                    for (int i = sim.CurrentStepIndex; i < total; i++)
                    {
                        if (token.IsCancellationRequested) return;

                        // Duraklatma kontrolü: Simülasyon duraklatıldıysa bekle
                        while (sim.IsPaused && !token.IsCancellationRequested)
                        {
                            await Task.Delay(400, token);
                        }

                        if (token.IsCancellationRequested) return;

                        sim.CurrentStepIndex = i;
                        bool isCompleted = (i == total - 1);
                        var locDto = sim.Steps[i].ToLocationDto(
                            sim.RouteId, sim.RouteName, sim.RouteColor, sim.RouteClass, i, total, isCompleted, sim.IsPaused
                        );
                        sim.LastLocation = locDto;

                        // İptal kontrolü: Durdurma/iptal isteği geldiyse gecikmiş konum paketi yayını yapma
                        if (token.IsCancellationRequested) return;

                        // Canlı araç konumu yayını (Tüm ilgililere ve haritadaki istemcilere)
                        await _hubNotifier.BroadcastVehicleLocationAsync(sim.RouteId, locDto);

                        if (isCompleted)
                        {
                            if (token.IsCancellationRequested) return;
                            // Son durağa varıldı: Bir sefer tamamlandı bildirimi
                            await _hubNotifier.BroadcastSimulationCompletedAsync(sim.RouteId, sim.RouteName);
                            // Tur tamamlandıktan sonra sıradaki tura başa dönerek devam et
                            sim.CurrentStepIndex = 0;
                            // Son durakta 3.5 saniye bekle, ardından yeni sefere başla (Operatör durdurana kadar hat canlı kalır)
                            await Task.Delay(3500, token);
                            break;
                        }

                        // Her adım arası 850 milisaniye bekleme (akıcı harita kayması için ideal hız)
                        await Task.Delay(850, token);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Normal durdurma / iptal
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception in simulation loop for Route {RouteId}", sim.RouteId);
            }
            finally
            {
                // Yalnızca sözlükteki nesne hala bu simülasyonsa kaldır (yeni başlayan bir simülasyonu kazara silme!)
                if (_activeSimulations.TryGetValue(sim.RouteId, out var current) && ReferenceEquals(current, sim))
                {
                    _activeSimulations.TryRemove(sim.RouteId, out _);
                }
                try
                {
                    sim.CancellationTokenSource.Dispose();
                }
                catch { }
            }
        }

        #region Geometrik ve İnterpolasyon Yardımcıları

        private List<Coordinate>? ExtractRoutePathCoordinates(RouteFeature route, List<StopFeature> sortedStops)
        {
            // 1. Varsa öncelikle WKT geometrisini (OSRM veya bükülmüş hat) kullan
            if (!string.IsNullOrWhiteSpace(route.Wkt))
            {
                try
                {
                    var reader = new WKTReader { DefaultSRID = 4326 };
                    var geom = reader.Read(route.Wkt);
                    if (geom is LineString ls && ls.Coordinates.Length >= 2)
                    {
                        return ls.Coordinates.ToList();
                    }
                    else if (geom is MultiLineString mls)
                    {
                        var allCoords = new List<Coordinate>();
                        for (int i = 0; i < mls.NumGeometries; i++)
                        {
                            allCoords.AddRange(mls.GetGeometryN(i).Coordinates);
                        }
                        if (allCoords.Count >= 2) return allCoords;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse WKT for Route {RouteId}, falling back to stops.", route.Id);
                }
            }

            // 2. WKT yoksa durak noktalarını sırasıyla bağla
            var coordsFromStops = new List<Coordinate>();
            foreach (var stop in sortedStops)
            {
                if (stop.Geometry != null)
                {
                    coordsFromStops.Add(new Coordinate(stop.Geometry.X, stop.Geometry.Y));
                }
                else if (!string.IsNullOrWhiteSpace(stop.Wkt))
                {
                    try
                    {
                        var reader = new WKTReader { DefaultSRID = 4326 };
                        var geom = reader.Read(stop.Wkt);
                        if (geom is Point pt)
                        {
                            coordsFromStops.Add(new Coordinate(pt.X, pt.Y));
                        }
                    }
                    catch { }
                }
            }

            return coordsFromStops.Count >= 2 ? coordsFromStops : null;
        }

        private List<SimulationStep> GenerateInterpolatedSteps(
            List<Coordinate> pathCoords,
            List<StopFeature> stops,
            int targetStepCount = 75)
        {
            var result = new List<SimulationStep>();
            if (pathCoords.Count < 2) return result;

            // Toplam kümülatif mesafeyi hesapla
            var segmentLengths = new List<double>();
            double totalDistance = 0;

            for (int i = 0; i < pathCoords.Count - 1; i++)
            {
                double dist = CalculateDistanceMeters(pathCoords[i], pathCoords[i + 1]);
                segmentLengths.Add(dist);
                totalDistance += dist;
            }

            if (totalDistance <= 0) return result;

            // Adım sayısını mesafeye göre uyarla (en az 40, en çok 120 adım)
            int numSteps = Math.Clamp(targetStepCount, 40, 120);
            double stepDistance = totalDistance / (numSteps - 1);

            int currentSeg = 0;
            double currentSegRemaining = segmentLengths[0];
            Coordinate currentPoint = new Coordinate(pathCoords[0]);

            for (int s = 0; s < numSteps; s++)
            {
                double targetDistFromStart = s * stepDistance;

                // Koordinat bulma
                Coordinate stepCoord = InterpolateAlongPath(pathCoords, segmentLengths, targetDistFromStart);

                // Yön Açısı (Bearing) hesabı
                double bearing = 0.0;
                if (s < numSteps - 1)
                {
                    Coordinate nextCoord = InterpolateAlongPath(pathCoords, segmentLengths, Math.Min(totalDistance, (s + 1) * stepDistance));
                    bearing = CalculateBearing(stepCoord, nextCoord);
                }
                else if (result.Count > 0)
                {
                    bearing = result.Last().Bearing;
                }

                // Yüzde kaç tamamlandı?
                double progress = Math.Round(((double)s / (numSteps - 1)) * 100.0, 1);

                // En yakın durak ve bir sonraki durak tespiti
                string currentStop = stops.Count > 0 ? stops[0].Name : "";
                string nextStop = stops.Count > 1 ? stops[1].Name : "";

                if (stops.Count > 1)
                {
                    double ratio = (double)s / (numSteps - 1);
                    double stopIndexEst = ratio * (stops.Count - 1);
                    int currentIdx = Math.Min(stops.Count - 1, (int)Math.Floor(stopIndexEst));
                    int nextIdx = Math.Min(stops.Count - 1, currentIdx + 1);

                    currentStop = stops[currentIdx].Name;
                    nextStop = (currentIdx < stops.Count - 1) ? stops[nextIdx].Name : "Son Durak (Varış)";
                }

                result.Add(new SimulationStep
                {
                    Longitude = stepCoord.X,
                    Latitude = stepCoord.Y,
                    Bearing = Math.Round(bearing, 1),
                    ProgressPercentage = progress,
                    CurrentStopName = currentStop,
                    NextStopName = nextStop,
                    SpeedKmH = Math.Round(40.0 + ((s % 5) * 2.5), 1) // Hafif dalgalanan gerçekçi hız (40-50 km/h)
                });
            }

            return result;
        }

        private Coordinate InterpolateAlongPath(List<Coordinate> coords, List<double> lengths, double targetDist)
        {
            if (targetDist <= 0) return coords[0];

            double accumulated = 0;
            for (int i = 0; i < lengths.Count; i++)
            {
                if (accumulated + lengths[i] >= targetDist)
                {
                    double segRatio = (lengths[i] > 0) ? (targetDist - accumulated) / lengths[i] : 0;
                    double lon = coords[i].X + (coords[i + 1].X - coords[i].X) * segRatio;
                    double lat = coords[i].Y + (coords[i + 1].Y - coords[i].Y) * segRatio;
                    return new Coordinate(lon, lat);
                }
                accumulated += lengths[i];
            }

            return coords.Last();
        }

        private static double CalculateDistanceMeters(Coordinate c1, Coordinate c2)
        {
            double r = 6371000; // Dünya yarıçapı metre
            double lat1 = c1.Y * Math.PI / 180.0;
            double lat2 = c2.Y * Math.PI / 180.0;
            double dLat = (c2.Y - c1.Y) * Math.PI / 180.0;
            double dLon = (c2.X - c1.X) * Math.PI / 180.0;

            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat1) * Math.Cos(lat2) *
                       Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return r * c;
        }

        private static double CalculateBearing(Coordinate from, Coordinate to)
        {
            double lat1 = from.Y * Math.PI / 180.0;
            double lat2 = to.Y * Math.PI / 180.0;
            double dLon = (to.X - from.X) * Math.PI / 180.0;

            double y = Math.Sin(dLon) * Math.Cos(lat2);
            double x = Math.Cos(lat1) * Math.Sin(lat2) - Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLon);
            double brng = (Math.Atan2(y, x) * 180.0 / Math.PI + 360.0) % 360.0;
            return brng;
        }

        #endregion

        #region Dahili Durum Sınıfları

        private class ActiveRouteSimulation
        {
            public int RouteId { get; set; }
            public string RouteName { get; set; } = string.Empty;
            public string RouteColor { get; set; } = "#3b82f6";
            public string RouteClass { get; set; } = "araba";
            public string StartedBy { get; set; } = string.Empty;
            public DateTime StartedAt { get; set; }
            public CancellationTokenSource CancellationTokenSource { get; set; } = null!;
            public List<SimulationStep> Steps { get; set; } = new();
            public VehicleLocationDto? LastLocation { get; set; }
            public bool IsPaused { get; set; }
            public int CurrentStepIndex { get; set; }

            public SimulationStatusDto ToStatusDto() => new()
            {
                RouteId = RouteId,
                RouteName = RouteName,
                RouteColor = RouteColor,
                RouteClass = RouteClass,
                IsRunning = true,
                IsPaused = IsPaused,
                StartedBy = StartedBy,
                StartedAt = StartedAt,
                LastLocation = LastLocation
            };
        }

        private class SimulationStep
        {
            public double Longitude { get; set; }
            public double Latitude { get; set; }
            public double Bearing { get; set; }
            public double ProgressPercentage { get; set; }
            public string CurrentStopName { get; set; } = string.Empty;
            public string NextStopName { get; set; } = string.Empty;
            public double SpeedKmH { get; set; }

            public VehicleLocationDto ToLocationDto(int routeId, string routeName, string routeColor, string routeClass, int stepIndex, int totalSteps, bool isCompleted, bool isPaused = false)
            {
                return new VehicleLocationDto
                {
                    RouteId = routeId,
                    RouteName = routeName,
                    RouteColor = routeColor,
                    RouteClass = routeClass,
                    Longitude = Longitude,
                    Latitude = Latitude,
                    Bearing = Bearing,
                    ProgressPercentage = ProgressPercentage,
                    CurrentStepIndex = stepIndex,
                    TotalSteps = totalSteps,
                    CurrentStopName = CurrentStopName,
                    NextStopName = NextStopName,
                    SpeedKmH = SpeedKmH,
                    IsCompleted = isCompleted,
                    IsPaused = isPaused,
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        #endregion
    }
}
