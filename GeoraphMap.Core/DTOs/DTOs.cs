using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    // Mekan (Place) DTO'ları
    public class CreatePlaceDto
    {
        public string Name { get; set; } = string.Empty;
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public string? Wkt { get; set; }
        public string Color { get; set; } = "#3b82f6";
    }

    public class PlaceResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public DateTime ModifiedDate { get; set; }
    }

    // Çizim (Drawing - Line, Polygon, Point) DTO'ları
    public class CreateDrawingDto
    {
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
    }

    public class DrawingResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public string Type { get; set; } = string.Empty; // Point, Line, Polygon
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
}
