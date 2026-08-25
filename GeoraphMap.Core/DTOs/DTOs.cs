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
