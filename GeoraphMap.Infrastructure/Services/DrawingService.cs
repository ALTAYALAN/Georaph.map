using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure.Services
{
    public class DrawingService : IDrawingService
    {
        private readonly AppDbContext _context;
        private readonly ICollaborationService _collaborationService;
        private readonly WKTReader _wktReader;
        private readonly WKTWriter _wktWriter;

        public DrawingService(AppDbContext context, ICollaborationService collaborationService)
        {
            _context = context;
            _collaborationService = collaborationService;
            _wktReader = new WKTReader { DefaultSRID = 4326 };
            _wktWriter = new WKTWriter();
        }

        private async Task<List<int>> GetAllowedUserIdsAsync(int userId)
        {
            if (userId == 0) return new List<int>();

            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
            bool isAdmin = (currentUser != null && (currentUser.Username.Equals("asdf.admin", StringComparison.OrdinalIgnoreCase) || currentUser.Username.EndsWith(".admin", StringComparison.OrdinalIgnoreCase)));
            if (!isAdmin && currentUser != null)
            {
                isAdmin = await _context.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == 1);
            }

            if (isAdmin)
            {
                // Admin sistemdeki tüm çizimleri düzenleyebilir
                return await _context.Users.Select(u => u.Id).ToListAsync();
            }

            // Normal Editör: Yalnızca kendi çizimlerini ve ONAYLANMIŞ işbirliği olan diğer editörlerin çizimlerini düzenleyebilir.
            // Admin çizimleri (Id: 1 veya Admin rolüne sahip kullanıcılar) normal editörler tarafından DÜZENLENEMEZ.
            var list = new List<int> { userId };

            var adminUserIds = await _context.UserRoles
                .Where(ur => ur.RoleId == 1)
                .Select(ur => ur.UserId)
                .ToListAsync();
            if (!adminUserIds.Contains(1)) adminUserIds.Add(1);

            var collaborators = await _context.EditorCollaborations
                .Where(c => c.Status == "Approved" && (c.SenderUserId == userId || c.ReceiverUserId == userId))
                .Select(c => c.SenderUserId == userId ? c.ReceiverUserId : c.SenderUserId)
                .Where(collabId => !adminUserIds.Contains(collabId)) // Admin hariç
                .ToListAsync();

            list.AddRange(collaborators);
            return list;
        }

        public async Task<List<DrawingResponseDto>> GetAllDrawingsAsync(int userId, string userRole = "")
        {
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            bool isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(userRole, "Administrator", StringComparison.OrdinalIgnoreCase)
                        || (currentUser != null && (currentUser.Username.Equals("asdf.admin", StringComparison.OrdinalIgnoreCase) || currentUser.Username.EndsWith(".admin", StringComparison.OrdinalIgnoreCase)));

            if (!isAdmin && currentUser != null)
            {
                var hasAdminRole = await _context.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == 1);
                if (hasAdminRole) isAdmin = true;
            }

            bool isViewer = string.Equals(userRole, "Viewer", StringComparison.OrdinalIgnoreCase) || userId == 0 || string.IsNullOrEmpty(userRole);

            var linesQuery = _context.Lines.Where(l => !l.IsDeleted);
            var polygonsQuery = _context.Polygons.Where(pg => !pg.IsDeleted);
            var pointsQuery = _context.Points.Where(pt => !pt.IsDeleted);

            // Tüm kullanıcılar ve editörler haritada ve filtreleme ekranında tüm çizimleri görüntüleyebilir
            // Düzenleme / güncelleme yetkisi ise yalnızca çizim sahibi, admin veya onaylı işbirliği olan editörlere verilir

            var usersMap = await _context.Users
                .ToDictionaryAsync(u => u.Id, u => u.Username);

            string GetUsername(int uid)
            {
                if (usersMap.TryGetValue(uid, out var name)) return name;
                if (uid == 1) return "asdf.admin";
                if (uid == 99999) return "Misafir (İzleyici)";
                return "Sistem";
            }

            var lines = await linesQuery
                .Select(l => new DrawingResponseDto
                {
                    Id = l.Id,
                    Name = string.IsNullOrEmpty(l.Name) ? $"Çizgi #{l.Id}" : l.Name,
                    Wkt = !string.IsNullOrEmpty(l.Wkt) ? l.Wkt : _wktWriter.Write(l.Geometry),
                    Color = string.IsNullOrEmpty(l.Color) ? "#3b82f6" : l.Color,
                    Type = "Line",
                    InsertedUserId = l.InsertedUserId,
                    InsertedDate = l.InsertedDate,
                    IsActive = l.IsActive,
                    IsDeleted = l.IsDeleted,
                    ModifiedDate = l.ModifiedDate
                })
                .ToListAsync();

            foreach (var l in lines) l.InsertedUsername = GetUsername(l.InsertedUserId);

            var polygons = await polygonsQuery
                .Select(pg => new DrawingResponseDto
                {
                    Id = pg.Id,
                    Name = string.IsNullOrEmpty(pg.Name) ? $"Poligon #{pg.Id}" : pg.Name,
                    Wkt = !string.IsNullOrEmpty(pg.Wkt) ? pg.Wkt : _wktWriter.Write(pg.Geometry),
                    Color = string.IsNullOrEmpty(pg.Color) ? "#3b82f6" : pg.Color,
                    Type = "Polygon",
                    InsertedUserId = pg.InsertedUserId,
                    InsertedDate = pg.InsertedDate,
                    IsActive = pg.IsActive,
                    IsDeleted = pg.IsDeleted,
                    ModifiedDate = pg.ModifiedDate
                })
                .ToListAsync();

            foreach (var pg in polygons) pg.InsertedUsername = GetUsername(pg.InsertedUserId);

            var points = await pointsQuery
                .Select(pt => new DrawingResponseDto
                {
                    Id = pt.Id,
                    Name = string.IsNullOrEmpty(pt.Name) ? $"Nokta #{pt.Id}" : pt.Name,
                    Wkt = !string.IsNullOrEmpty(pt.Wkt) ? pt.Wkt : _wktWriter.Write(pt.Geometry),
                    Color = string.IsNullOrEmpty(pt.Color) ? "#3b82f6" : pt.Color,
                    Type = "Point",
                    InsertedUserId = pt.InsertedUserId,
                    InsertedDate = pt.InsertedDate,
                    IsActive = pt.IsActive,
                    IsDeleted = pt.IsDeleted,
                    ModifiedDate = pt.ModifiedDate
                })
                .ToListAsync();

            foreach (var pt in points) pt.InsertedUsername = GetUsername(pt.InsertedUserId);

            var result = new List<DrawingResponseDto>();
            result.AddRange(points);
            result.AddRange(lines);
            result.AddRange(polygons);

            return result;
        }

        public async Task<DrawingResponseDto> CreatePointAsync(CreateDrawingDto dto, int userId)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not Point pointGeom)
                throw new ArgumentException("Girdi geçerli bir Point WKT verisi değil.");

            pointGeom.SRID = 4326;
            await ValidateSpatialBoundaryAsync(userId, pointGeom);

            var entity = new PointFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Nokta" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = pointGeom,
                InsertedUserId = userId,
                InsertedDate = DateTime.UtcNow,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Points.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Point",
                InsertedUserId = entity.InsertedUserId,
                InsertedDate = entity.InsertedDate,
                IsActive = entity.IsActive,
                IsDeleted = entity.IsDeleted,
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<DrawingResponseDto> CreateLineAsync(CreateDrawingDto dto, int userId)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not LineString lineGeom)
                throw new ArgumentException("Girdi geçerli bir LineString WKT verisi değil.");

            lineGeom.SRID = 4326;
            await ValidateSpatialBoundaryAsync(userId, lineGeom);

            var entity = new LineFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Çizgi" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = lineGeom,
                InsertedUserId = userId,
                InsertedDate = DateTime.UtcNow,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Lines.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Line",
                InsertedUserId = entity.InsertedUserId,
                InsertedDate = entity.InsertedDate,
                IsActive = entity.IsActive,
                IsDeleted = entity.IsDeleted,
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<DrawingResponseDto> CreatePolygonAsync(CreateDrawingDto dto, int userId)
        {
            if (string.IsNullOrWhiteSpace(dto.Wkt))
                throw new ArgumentException("WKT verisi boş olamaz.");

            var geom = _wktReader.Read(dto.Wkt);
            if (geom is not Polygon polygonGeom)
                throw new ArgumentException("Girdi geçerli bir Polygon WKT verisi değil.");

            polygonGeom.SRID = 4326;
            await ValidateSpatialBoundaryAsync(userId, polygonGeom);

            var entity = new PolygonFeature
            {
                Name = string.IsNullOrWhiteSpace(dto.Name) ? "Poligon" : dto.Name,
                Wkt = dto.Wkt,
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#3b82f6" : dto.Color,
                Geometry = polygonGeom,
                InsertedUserId = userId,
                InsertedDate = DateTime.UtcNow,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Polygons.Add(entity);
            await _context.SaveChangesAsync();

            return new DrawingResponseDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Wkt = entity.Wkt,
                Color = entity.Color,
                Type = "Polygon",
                InsertedUserId = entity.InsertedUserId,
                InsertedDate = entity.InsertedDate,
                IsActive = entity.IsActive,
                IsDeleted = entity.IsDeleted,
                ModifiedDate = entity.ModifiedDate
            };
        }

        public async Task<DrawingResponseDto?> UpdateDrawingAsync(string type, int id, UpdateDrawingDto dto, int userId)
        {
            var allowedUserIds = await GetAllowedUserIdsAsync(userId);

            switch (type.ToLower())
            {
                case "point":
                    var pt = await _context.Points.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted && (userId == 0 || allowedUserIds.Contains(p.InsertedUserId)));
                    if (pt == null) return null;
                    if (!string.IsNullOrWhiteSpace(dto.Name)) pt.Name = dto.Name;
                    if (!string.IsNullOrWhiteSpace(dto.Color)) pt.Color = dto.Color;
                    if (!string.IsNullOrWhiteSpace(dto.Wkt))
                    {
                        var geom = _wktReader.Read(dto.Wkt.Trim());
                        if (geom is not Point pointGeom)
                            throw new ArgumentException("Geçersiz Point WKT verisi.");
                        pointGeom.SRID = 4326;
                        pt.Geometry = pointGeom;
                        pt.Wkt = dto.Wkt.Trim();
                    }
                    pt.ModifiedDate = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return new DrawingResponseDto
                    {
                        Id = pt.Id,
                        Name = pt.Name,
                        Wkt = pt.Wkt,
                        Color = pt.Color,
                        Type = "Point",
                        InsertedUserId = pt.InsertedUserId,
                        InsertedDate = pt.InsertedDate,
                        IsActive = pt.IsActive,
                        IsDeleted = pt.IsDeleted,
                        ModifiedDate = pt.ModifiedDate
                    };

                case "line":
                    var l = await _context.Lines.FirstOrDefaultAsync(line => line.Id == id && !line.IsDeleted && (userId == 0 || allowedUserIds.Contains(line.InsertedUserId)));
                    if (l == null) return null;
                    if (!string.IsNullOrWhiteSpace(dto.Name)) l.Name = dto.Name;
                    if (!string.IsNullOrWhiteSpace(dto.Color)) l.Color = dto.Color;
                    if (!string.IsNullOrWhiteSpace(dto.Wkt))
                    {
                        var geom = _wktReader.Read(dto.Wkt.Trim());
                        if (geom is not LineString lineGeom)
                            throw new ArgumentException("Geçersiz LineString WKT verisi.");
                        lineGeom.SRID = 4326;
                        await ValidateSpatialBoundaryAsync(userId, lineGeom);
                        l.Geometry = lineGeom;
                        l.Wkt = dto.Wkt.Trim();
                    }
                    l.ModifiedDate = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return new DrawingResponseDto
                    {
                        Id = l.Id,
                        Name = l.Name,
                        Wkt = l.Wkt,
                        Color = l.Color,
                        Type = "Line",
                        InsertedUserId = l.InsertedUserId,
                        InsertedDate = l.InsertedDate,
                        IsActive = l.IsActive,
                        IsDeleted = l.IsDeleted,
                        ModifiedDate = l.ModifiedDate
                    };

                case "polygon":
                    var pg = await _context.Polygons.FirstOrDefaultAsync(poly => poly.Id == id && !poly.IsDeleted && (userId == 0 || allowedUserIds.Contains(poly.InsertedUserId)));
                    if (pg == null) return null;
                    if (!string.IsNullOrWhiteSpace(dto.Name)) pg.Name = dto.Name;
                    if (!string.IsNullOrWhiteSpace(dto.Color)) pg.Color = dto.Color;
                    if (!string.IsNullOrWhiteSpace(dto.Wkt))
                    {
                        var geom = _wktReader.Read(dto.Wkt.Trim());
                        if (geom is not Polygon polyGeom)
                            throw new ArgumentException("Geçersiz Polygon WKT verisi.");
                        polyGeom.SRID = 4326;
                        pg.Geometry = polyGeom;
                        pg.Wkt = dto.Wkt.Trim();
                    }
                    pg.ModifiedDate = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return new DrawingResponseDto
                    {
                        Id = pg.Id,
                        Name = pg.Name,
                        Wkt = pg.Wkt,
                        Color = pg.Color,
                        Type = "Polygon",
                        InsertedUserId = pg.InsertedUserId,
                        InsertedDate = pg.InsertedDate,
                        IsActive = pg.IsActive,
                        IsDeleted = pg.IsDeleted,
                        ModifiedDate = pg.ModifiedDate
                    };

                default:
                    throw new ArgumentException("Geçersiz çizim tipi.");
            }
        }

        public async Task<bool> DeleteDrawingAsync(string type, int id, int userId)
        {
            var allowedUserIds = await GetAllowedUserIdsAsync(userId);

            switch (type.ToLower())
            {
                case "line":
                    var l = await _context.Lines.FirstOrDefaultAsync(line => line.Id == id && (userId == 0 || allowedUserIds.Contains(line.InsertedUserId)));
                    if (l == null) return false;
                    l.IsDeleted = true;
                    l.IsActive = false;
                    l.ModifiedDate = DateTime.UtcNow;
                    break;

                case "polygon":
                    var pg = await _context.Polygons.FirstOrDefaultAsync(poly => poly.Id == id && (userId == 0 || allowedUserIds.Contains(poly.InsertedUserId)));
                    if (pg == null) return false;
                    pg.IsDeleted = true;
                    pg.IsActive = false;
                    pg.ModifiedDate = DateTime.UtcNow;
                    break;

                case "point":
                    var pt = await _context.Points.FirstOrDefaultAsync(p => p.Id == id && (userId == 0 || allowedUserIds.Contains(p.InsertedUserId)));
                    if (pt == null) return false;
                    pt.IsDeleted = true;
                    pt.IsActive = false;
                    pt.ModifiedDate = DateTime.UtcNow;
                    break;

                default:
                    throw new ArgumentException("Geçersiz çizim tipi.");
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private async Task ValidateSpatialBoundaryAsync(int userId, NetTopologySuite.Geometries.Geometry drawingGeom)
        {
            var boundaryInfo = await _collaborationService.GetEffectiveSpatialBoundaryInfoAsync(userId);
            if (!boundaryInfo.HasBoundary || string.IsNullOrWhiteSpace(boundaryInfo.SpatialBoundaryWkt))
                return;

            try
            {
                var boundaryGeom = _wktReader.Read(boundaryInfo.SpatialBoundaryWkt);
                boundaryGeom.SRID = 4326;

                // Bitişik iller/bölgeler seçildiğinde aradaki ortak sınırları dinamik olarak eritip tek bir birleşik alan oluştur
                var unifiedBoundary = NetTopologySuite.Operation.Union.UnaryUnionOp.Union(boundaryGeom) ?? boundaryGeom;
                unifiedBoundary.SRID = 4326;

                // 1. Doğrudan kapsama veya içerme kontrolü
                if (unifiedBoundary.Covers(drawingGeom) || unifiedBoundary.Contains(drawingGeom))
                {
                    return;
                }

                // 2. Çizimin birleşik sınır dışına taşan kısmının olup olmadığını kontrol et
                var difference = drawingGeom.Difference(unifiedBoundary);
                if (difference == null || difference.IsEmpty)
                {
                    return;
                }

                var scopeMsg = boundaryInfo.IsCollaborative
                    ? $"işbirliği ile birleştirilmiş ortak yetki alanınızın ({string.Join(", ", boundaryInfo.ActiveCollaboratorUsernames)} ile ortak)"
                    : "tanımlı coğrafi yetki alanınızın";

                // Poligonlar için toleranslı alan kontrolü, çizgi ve noktalar için uzunluk/nokta kontrolü
                if (drawingGeom is Polygon || drawingGeom is MultiPolygon)
                {
                    if (difference.Area > 0.0000001)
                    {
                        throw new ArgumentException($"Çizim, {scopeMsg} dışındadır! Lütfen sadece izin verilen coğrafi sınırlar içine çizim yapınız.");
                    }
                }
                else if (drawingGeom is LineString || drawingGeom is MultiLineString)
                {
                    if (difference.Length > 0.0000001)
                    {
                        throw new ArgumentException($"Çizgi, {scopeMsg} dışına taşmaktadır! Lütfen izin verilen sınırlar içinde çiziniz.");
                    }
                }
                else
                {
                    if (!unifiedBoundary.Covers(drawingGeom) && !unifiedBoundary.Intersects(drawingGeom))
                    {
                        throw new ArgumentException($"Nokta / Çizim, {scopeMsg} dışındadır! Lütfen sadece izin verilen coğrafi sınırlar içine konumlandırınız.");
                    }
                }
            }
            catch (ArgumentException)
            {
                throw;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DrawingService] Coğrafi sınır doğrulama uyarısı: {ex.Message}");
            }
        }
    }
}
