using System;
using NetTopologySuite.Geometries;

namespace GeoraphMap.Core
{
    public class UserSavedRoute
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public string StartPointName { get; set; } = "Başlangıç Noktası";
        public string StartWkt { get; set; } = string.Empty;

        public int? TargetPoiId { get; set; }
        public string TargetPoiName { get; set; } = "Hedef POI";
        public string TargetWkt { get; set; } = string.Empty;

        public string RouteWkt { get; set; } = string.Empty; // LINESTRING geometry
        public Geometry? Geometry { get; set; }

        public double DistanceMeters { get; set; }
        public double DurationSeconds { get; set; }

        public string Color { get; set; } = "#10B981"; // Emerald green default for directions
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
