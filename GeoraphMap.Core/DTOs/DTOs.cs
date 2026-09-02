using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{

    // Çizim (Drawing - Line, Polygon, Point) DTO'ları
    public class CreateDrawingDto
    {
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
    }

    public class UpdateDrawingDto
    {
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public string Wkt { get; set; } = string.Empty;
    }

    public class DrawingResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public string Type { get; set; } = string.Empty; // Point, Line, Polygon
        public int InsertedUserId { get; set; }
        public string InsertedUsername { get; set; } = string.Empty;
        public DateTime InsertedDate { get; set; }
        public bool IsActive { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime ModifiedDate { get; set; }
    }

    // Kimlik Doğrulama (Auth) DTO'ları
    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
        public string Role { get; set; } = string.Empty;
        public DateTime Expiration { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    // Envanter Analizi DTO'ları
    public class InventoryAnalysisRequestDto
    {
        public string Wkt { get; set; } = string.Empty;
    }

    public class InventoryAnalysisResultDto
    {
        public int TotalIntersectedCount { get; set; }
        public int PlacesCount { get; set; }
        public int PointsCount { get; set; }
        public int LinesCount { get; set; }
        public int PolygonsCount { get; set; }
        public List<string> Details { get; set; } = new List<string>();
    }

    // Çok Kriterli Konum Analizi DTO'ları (Location / Weighted Heatmap Analysis)
    public class LocationCriterionDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int Weight { get; set; } // 1..100
    }

    public class LocationAnalysisRequestDto
    {
        public string? BoundaryWkt { get; set; } // Çizilen poligon veya il sınır WKT'si
        public int? CityPlate { get; set; } // Seçilen il plaka kodu (opsiyonel)
        public string? BoundaryName { get; set; } // Örn: "Ankara İli" veya "Özel Çizilen Alan"
        public List<LocationCriterionDto> Criteria { get; set; } = new List<LocationCriterionDto>();
    }

    public class AnalyzedPoiItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategoryColor { get; set; } = string.Empty;
        public string CategoryIcon { get; set; } = string.Empty;
        public double Weight { get; set; } // 0.0 - 1.0 (Isı Haritası Normalizasyonu: Weight / 100)
        public int CriterionScore { get; set; } // Kullanıcının atadığı ham puan (örn: 35)
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public string Wkt { get; set; } = string.Empty;
    }

    public class CriterionSummaryDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategoryColor { get; set; } = string.Empty;
        public string CategoryIcon { get; set; } = string.Empty;
        public int Weight { get; set; }
        public int PoiCount { get; set; }
        public double ContributionScore { get; set; }
    }

    public class LocationAnalysisResultDto
    {
        public string BoundaryName { get; set; } = string.Empty;
        public string BoundaryWkt { get; set; } = string.Empty;
        public int TotalPoiCount { get; set; }
        public double OverallScore { get; set; }
        public List<CriterionSummaryDto> CriteriaSummaries { get; set; } = new List<CriterionSummaryDto>();
        public List<AnalyzedPoiItemDto> AnalyzedPois { get; set; } = new List<AnalyzedPoiItemDto>();
    }

    // Editör İşbirliği DTO'ları
    public class SendCollaborationRequestDto
    {
        public int ReceiverUserId { get; set; }
    }

    public class RespondCollaborationRequestDto
    {
        public int RequestId { get; set; }
        public bool Approve { get; set; }
    }

    public class CollaborationResponseDto
    {
        public int Id { get; set; }
        public int SenderUserId { get; set; }
        public string SenderUsername { get; set; } = string.Empty;
        public int ReceiverUserId { get; set; }
        public string ReceiverUsername { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime RequestedDate { get; set; }
    }

    public class EditorUserDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }

    public class UserSpatialBoundaryItemDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? SpatialBoundaryWkt { get; set; }
        public bool IsCurrentUser { get; set; }
    }

    public class EffectiveSpatialBoundaryDto
    {
        public string? SpatialBoundaryWkt { get; set; }
        public bool HasBoundary { get; set; }
        public bool IsCollaborative { get; set; }
        public List<string> ActiveCollaboratorUsernames { get; set; } = new List<string>();
        public List<UserSpatialBoundaryItemDto> Boundaries { get; set; } = new List<UserSpatialBoundaryItemDto>();
    }
}
