using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    public class DirectionWaypointDto
    {
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public string? Name { get; set; }
        public int? PoiId { get; set; }
    }

    public class CalculateDirectionsDto
    {
        public double StartLongitude { get; set; }
        public double StartLatitude { get; set; }
        public string? StartPointName { get; set; }

        public double TargetLongitude { get; set; }
        public double TargetLatitude { get; set; }
        public int? TargetPoiId { get; set; }
        public string? TargetPoiName { get; set; }
        public string? PreferredMode { get; set; } = "driving"; // "driving", "walking", "cycling"

        // Çoklu durak / ara duraklar desteği
        public List<DirectionWaypointDto>? Waypoints { get; set; }
    }

    public class RouteStepDto
    {
        public int StepIndex { get; set; }
        public string Instruction { get; set; } = string.Empty;
        public string StreetName { get; set; } = string.Empty;
        public double DistanceMeters { get; set; }
        public string FormattedDistance { get; set; } = string.Empty;
        public double DurationSeconds { get; set; }
        public string FormattedDuration { get; set; } = string.Empty;
        public string Modifier { get; set; } = string.Empty; // "left", "right", "straight" vb.
        public string Type { get; set; } = string.Empty; // "turn", "depart", "arrive" vb.
    }

    public class RouteModeOptionDto
    {
        public string Mode { get; set; } = "driving"; // "driving", "walking", "cycling"
        public string Label { get; set; } = "Arabayla";
        public string Icon { get; set; } = "car";
        public double DistanceMeters { get; set; }
        public double DistanceKm => Math.Round(DistanceMeters / 1000.0, 2);
        public double DurationSeconds { get; set; }
        public double DurationMinutes => Math.Round(DurationSeconds / 60.0, 1);
        public string FormattedDuration { get; set; } = string.Empty;
        public string FormattedDistance { get; set; } = string.Empty;
        public string RouteWkt { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public List<RouteStepDto> Steps { get; set; } = new();
    }

    public class DirectionResultDto
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }

        public string StartPointName { get; set; } = "Başlangıç Noktası";
        public string StartWkt { get; set; } = string.Empty;

        public int? TargetPoiId { get; set; }
        public string TargetPoiName { get; set; } = "Hedef POI";
        public string TargetWkt { get; set; } = string.Empty;

        // Çok Modlu Seçenekler (Google Haritalar Tarzı)
        public RouteModeOptionDto Driving { get; set; } = new();
        public RouteModeOptionDto Walking { get; set; } = new();
        public RouteModeOptionDto Cycling { get; set; } = new();
        public RouteModeOptionDto? Transit { get; set; } // Toplu Taşıma (Karma)
        public RouteModeOptionDto? Gemi { get; set; }    // Gemi / Vapur
        public RouteModeOptionDto? Metro { get; set; }   // Metro / Raylı Sistem
        public RouteModeOptionDto? Otobus { get; set; }  // Otobüs
        public string ActiveMode { get; set; } = "driving";

        // Geriye Uyumluluk Alanları (Aktif modun verilerini yansıtır)
        public string RouteWkt { get; set; } = string.Empty; // LINESTRING
        public double DistanceMeters { get; set; }
        public double DistanceKm => Math.Round(DistanceMeters / 1000.0, 2);
        public double DurationSeconds { get; set; }
        public double DurationMinutes => Math.Round(DurationSeconds / 60.0, 1);
    }

    public class SaveDirectionRouteDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public string StartPointName { get; set; } = "Başlangıç Noktası";
        public string StartWkt { get; set; } = string.Empty;

        public int? TargetPoiId { get; set; }
        public string TargetPoiName { get; set; } = "Hedef POI";
        public string TargetWkt { get; set; } = string.Empty;

        public string RouteWkt { get; set; } = string.Empty;
        public double DistanceMeters { get; set; }
        public double DurationSeconds { get; set; }
        public string? Color { get; set; } = "#10B981";
    }

    public class UserSavedRouteDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public string StartPointName { get; set; } = "Başlangıç Noktası";
        public string StartWkt { get; set; } = string.Empty;

        public int? TargetPoiId { get; set; }
        public string TargetPoiName { get; set; } = "Hedef POI";
        public string TargetWkt { get; set; } = string.Empty;

        public string RouteWkt { get; set; } = string.Empty;
        public double DistanceMeters { get; set; }
        public double DistanceKm => Math.Round(DistanceMeters / 1000.0, 2);
        public double DurationSeconds { get; set; }
        public double DurationMinutes => Math.Round(DurationSeconds / 60.0, 1);

        public string Color { get; set; } = "#10B981";
        public DateTime CreatedDate { get; set; }
    }

    public class UserFavoritePoiDto
    {
        public int Id { get; set; }
        public int PoiId { get; set; }
        public string PoiName { get; set; } = string.Empty;
        public string? CategoryName { get; set; }
        public string? CategoryColor { get; set; }
        public string? CategoryIcon { get; set; }
        public string? Wkt { get; set; }
        public double? Longitude { get; set; }
        public double? Latitude { get; set; }
        public string? Description { get; set; }
        public string? WorkingHours { get; set; }
        public DateTime CreatedDate { get; set; }
    }

    public class UpdateUserProfileDto
    {
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Password { get; set; }
    }
}
