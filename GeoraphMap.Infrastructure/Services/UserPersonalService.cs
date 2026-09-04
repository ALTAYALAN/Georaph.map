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
using BCrypt.Net;

namespace GeoraphMap.Infrastructure.Services
{
    public class UserPersonalService : IUserPersonalService
    {
        private readonly AppDbContext _context;
        private readonly IOsrmRoutingService _osrmService;
        private readonly WKTReader _wktReader;

        public UserPersonalService(AppDbContext context, IOsrmRoutingService osrmService)
        {
            _context = context;
            _osrmService = osrmService;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
        }

        public async Task<DirectionResultDto> CalculateDirectionsAsync(CalculateDirectionsDto dto)
        {
            var coords = new List<(double Longitude, double Latitude)>();
            string startWkt = "";
            string targetWkt = "";
            string startName = dto.StartPointName ?? "Başlangıç Noktası";
            string targetName = dto.TargetPoiName ?? "Hedef";
            int? targetPoiId = dto.TargetPoiId;

            if (dto.Waypoints != null && dto.Waypoints.Count >= 2)
            {
                foreach (var wp in dto.Waypoints)
                {
                    coords.Add((wp.Longitude, wp.Latitude));
                }
                var firstWp = dto.Waypoints.First();
                var lastWp = dto.Waypoints.Last();
                startWkt = $"POINT({firstWp.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {firstWp.Latitude.ToString("F6", CultureInfo.InvariantCulture)})";
                targetWkt = $"POINT({lastWp.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {lastWp.Latitude.ToString("F6", CultureInfo.InvariantCulture)})";
                if (!string.IsNullOrWhiteSpace(firstWp.Name)) startName = firstWp.Name;
                if (!string.IsNullOrWhiteSpace(lastWp.Name)) targetName = lastWp.Name;
                if (lastWp.PoiId.HasValue) targetPoiId = lastWp.PoiId;
            }
            else
            {
                coords.Add((dto.StartLongitude, dto.StartLatitude));
                coords.Add((dto.TargetLongitude, dto.TargetLatitude));
                startWkt = $"POINT({dto.StartLongitude.ToString("F6", CultureInfo.InvariantCulture)} {dto.StartLatitude.ToString("F6", CultureInfo.InvariantCulture)})";
                targetWkt = $"POINT({dto.TargetLongitude.ToString("F6", CultureInfo.InvariantCulture)} {dto.TargetLatitude.ToString("F6", CultureInfo.InvariantCulture)})";
            }

            // Arabayla, Yürüyerek ve Bisikletle rotaları eş zamanlı (paralel) hesapla
            var drivingTask = _osrmService.CalculateRouteAsync(coords, "driving");
            var walkingTask = _osrmService.CalculateRouteAsync(coords, "walking");
            var cyclingTask = _osrmService.CalculateRouteAsync(coords, "cycling");

            await Task.WhenAll(drivingTask, walkingTask, cyclingTask);

            var drivingRes = await drivingTask;
            var walkingRes = await walkingTask;
            var cyclingRes = await cyclingTask;

            // Eğer yürüme rotası gelmediyse sürüş mesafesinden gerçekçi yaya hesabı yap
            if (!walkingRes.Success || string.IsNullOrEmpty(walkingRes.Wkt) || walkingRes.DistanceMeters <= 0)
            {
                double dist = drivingRes.DistanceMeters > 0 ? drivingRes.DistanceMeters * 0.95 : 1000;
                walkingRes.Wkt = drivingRes.Wkt;
                walkingRes.DistanceMeters = dist;
                walkingRes.DurationSeconds = OsrmRoutingService.CalculateSpeedDuration(dist, "walking");
                walkingRes.Summary = "Düz ayak yürüme güzergahı";
            }

            // Eğer bisiklet rotası gelmediyse
            if (!cyclingRes.Success || string.IsNullOrEmpty(cyclingRes.Wkt) || cyclingRes.DistanceMeters <= 0)
            {
                double dist = drivingRes.DistanceMeters > 0 ? drivingRes.DistanceMeters : 1000;
                cyclingRes.Wkt = drivingRes.Wkt;
                cyclingRes.DistanceMeters = dist;
                cyclingRes.DurationSeconds = OsrmRoutingService.CalculateSpeedDuration(dist, "cycling");
                cyclingRes.Summary = "Bisiklet ve scooter uygun güzergah";
            }

            var drivingOpt = new RouteModeOptionDto
            {
                Mode = "driving",
                Label = "Arabayla",
                Icon = "car",
                DistanceMeters = drivingRes.DistanceMeters,
                DurationSeconds = drivingRes.DurationSeconds,
                FormattedDistance = OsrmRoutingService.FormatDistance(drivingRes.DistanceMeters),
                FormattedDuration = OsrmRoutingService.FormatDuration(drivingRes.DurationSeconds),
                RouteWkt = drivingRes.Wkt ?? "",
                Summary = drivingRes.Summary ?? "En hızlı sürüş rotası",
                Steps = drivingRes.Steps
            };

            var walkingOpt = new RouteModeOptionDto
            {
                Mode = "walking",
                Label = "Yürüyerek",
                Icon = "walking",
                DistanceMeters = walkingRes.DistanceMeters,
                DurationSeconds = walkingRes.DurationSeconds,
                FormattedDistance = OsrmRoutingService.FormatDistance(walkingRes.DistanceMeters),
                FormattedDuration = OsrmRoutingService.FormatDuration(walkingRes.DurationSeconds),
                RouteWkt = walkingRes.Wkt ?? "",
                Summary = walkingRes.Summary ?? "Yaya ve yürüyüş rotası",
                Steps = walkingRes.Steps
            };

            var cyclingOpt = new RouteModeOptionDto
            {
                Mode = "cycling",
                Label = "Bisikletle",
                Icon = "cycling",
                DistanceMeters = cyclingRes.DistanceMeters,
                DurationSeconds = cyclingRes.DurationSeconds,
                FormattedDistance = OsrmRoutingService.FormatDistance(cyclingRes.DistanceMeters),
                FormattedDuration = OsrmRoutingService.FormatDuration(cyclingRes.DurationSeconds),
                RouteWkt = cyclingRes.Wkt ?? "",
                Summary = cyclingRes.Summary ?? "Bisiklet yolu",
                Steps = cyclingRes.Steps
            };

            string preferredMode = (dto.PreferredMode ?? "driving").ToLower().Trim();
            var activeOpt = preferredMode switch
            {
                "walking" or "yuruyus" or "yürüyüş" or "foot" => walkingOpt,
                "cycling" or "bisiklet" or "bike" => cyclingOpt,
                _ => drivingOpt
            };

            return new DirectionResultDto
            {
                Success = true,
                StartPointName = startName,
                StartWkt = startWkt,
                TargetPoiId = targetPoiId,
                TargetPoiName = targetName,
                TargetWkt = targetWkt,
                Driving = drivingOpt,
                Walking = walkingOpt,
                Cycling = cyclingOpt,
                ActiveMode = activeOpt.Mode,
                RouteWkt = activeOpt.RouteWkt,
                DistanceMeters = activeOpt.DistanceMeters,
                DurationSeconds = activeOpt.DurationSeconds
            };
        }

        public async Task<List<UserSavedRouteDto>> GetSavedRoutesAsync(int userId)
        {
            var routes = await _context.UserSavedRoutes
                .Where(r => r.UserId == userId && !r.IsDeleted)
                .OrderByDescending(r => r.CreatedDate)
                .ToListAsync();

            return routes.Select(MapToSavedRouteDto).ToList();
        }

        public async Task<UserSavedRouteDto?> GetSavedRouteByIdAsync(int userId, int routeId)
        {
            var route = await _context.UserSavedRoutes
                .FirstOrDefaultAsync(r => r.Id == routeId && r.UserId == userId && !r.IsDeleted);

            if (route == null) return null;
            return MapToSavedRouteDto(route);
        }

        public async Task<UserSavedRouteDto> SaveRouteAsync(int userId, SaveDirectionRouteDto dto)
        {
            Geometry? geom = null;
            if (!string.IsNullOrWhiteSpace(dto.RouteWkt))
            {
                try
                {
                    geom = _wktReader.Read(dto.RouteWkt);
                }
                catch { }
            }

            var savedRoute = new UserSavedRoute
            {
                UserId = userId,
                Title = string.IsNullOrWhiteSpace(dto.Title) ? $"{dto.StartPointName} ➔ {dto.TargetPoiName}" : dto.Title.Trim(),
                Description = dto.Description?.Trim(),
                StartPointName = dto.StartPointName?.Trim() ?? "Başlangıç Noktası",
                StartWkt = dto.StartWkt?.Trim() ?? string.Empty,
                TargetPoiId = dto.TargetPoiId,
                TargetPoiName = dto.TargetPoiName?.Trim() ?? "Hedef POI",
                TargetWkt = dto.TargetWkt?.Trim() ?? string.Empty,
                RouteWkt = dto.RouteWkt?.Trim() ?? string.Empty,
                Geometry = geom,
                DistanceMeters = dto.DistanceMeters,
                DurationSeconds = dto.DurationSeconds,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#10B981" : dto.Color.Trim(),
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow
            };

            _context.UserSavedRoutes.Add(savedRoute);
            await _context.SaveChangesAsync();

            return MapToSavedRouteDto(savedRoute);
        }

        public async Task<bool> DeleteSavedRouteAsync(int userId, int routeId)
        {
            var route = await _context.UserSavedRoutes
                .FirstOrDefaultAsync(r => r.Id == routeId && r.UserId == userId && !r.IsDeleted);

            if (route == null) return false;

            route.IsDeleted = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<UserFavoritePoiDto>> GetFavoritePoisAsync(int userId)
        {
            var favs = await _context.UserFavoritePois
                .Include(f => f.Poi)
                    .ThenInclude(p => p.Category)
                .Where(f => f.UserId == userId && f.Poi != null && !f.Poi.IsDeleted && f.Poi.IsActive)
                .OrderByDescending(f => f.CreatedDate)
                .ToListAsync();

            return favs.Select(f =>
            {
                double? lon = null;
                double? lat = null;
                if (f.Poi?.Geometry != null)
                {
                    lon = f.Poi.Geometry.Coordinate.X;
                    lat = f.Poi.Geometry.Coordinate.Y;
                }

                return new UserFavoritePoiDto
                {
                    Id = f.Id,
                    PoiId = f.PoiId,
                    PoiName = f.Poi?.Name ?? string.Empty,
                    CategoryName = f.Poi?.Category?.Name,
                    CategoryColor = f.Poi?.Category?.Color ?? "#3B82F6",
                    CategoryIcon = f.Poi?.Category?.Icon ?? "pi pi-map-marker",
                    Wkt = f.Poi?.Wkt,
                    Longitude = lon,
                    Latitude = lat,
                    Description = f.Poi?.Description,
                    WorkingHours = f.Poi?.WorkingHours,
                    CreatedDate = f.CreatedDate
                };
            }).ToList();
        }

        public async Task<bool> ToggleFavoritePoiAsync(int userId, int poiId)
        {
            var existing = await _context.UserFavoritePois
                .FirstOrDefaultAsync(f => f.UserId == userId && f.PoiId == poiId);

            if (existing != null)
            {
                _context.UserFavoritePois.Remove(existing);
                await _context.SaveChangesAsync();
                return false; // Artık favori değil
            }
            else
            {
                var fav = new UserFavoritePoi
                {
                    UserId = userId,
                    PoiId = poiId,
                    CreatedDate = DateTime.UtcNow
                };
                _context.UserFavoritePois.Add(fav);
                await _context.SaveChangesAsync();
                return true; // Artık favori
            }
        }

        public async Task<bool> IsPoiFavoriteAsync(int userId, int poiId)
        {
            return await _context.UserFavoritePois
                .AnyAsync(f => f.UserId == userId && f.PoiId == poiId);
        }

        public async Task<UserDetailDto> UpdateProfileAsync(int userId, UpdateUserProfileDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new KeyNotFoundException("Kullanıcı bulunamadı.");

            if (!string.IsNullOrWhiteSpace(dto.Email))
            {
                var emailTrimmed = dto.Email.Trim();
                var exists = await _context.Users.AnyAsync(u => u.Email == emailTrimmed && u.Id != userId);
                if (exists) throw new InvalidOperationException("Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.");
                user.Email = emailTrimmed;
            }

            if (!string.IsNullOrWhiteSpace(dto.Phone))
            {
                user.Phone = dto.Phone.Trim();
            }

            if (!string.IsNullOrWhiteSpace(dto.Password))
            {
                if (dto.Password.Length < 4) throw new ArgumentException("Şifre en az 4 karakter olmalıdır.");
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }

            await _context.SaveChangesAsync();

            return new UserDetailDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Phone = user.Phone,
                IsActive = user.IsActive,
                SpatialBoundaryWkt = user.SpatialBoundaryWkt
            };
        }

        private static UserSavedRouteDto MapToSavedRouteDto(UserSavedRoute r)
        {
            return new UserSavedRouteDto
            {
                Id = r.Id,
                UserId = r.UserId,
                Title = r.Title,
                Description = r.Description,
                StartPointName = r.StartPointName,
                StartWkt = r.StartWkt,
                TargetPoiId = r.TargetPoiId,
                TargetPoiName = r.TargetPoiName,
                TargetWkt = r.TargetWkt,
                RouteWkt = r.RouteWkt,
                DistanceMeters = r.DistanceMeters,
                DurationSeconds = r.DurationSeconds,
                Color = r.Color ?? "#10B981",
                CreatedDate = r.CreatedDate
            };
        }
    }
}
