using System;
using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace GeoraphMap.Core
{
    public class RouteFeature
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3B82F6"; // Varsayılan mavi renk
        public string? Description { get; set; }
        public string? Wkt { get; set; } // Özelleştirilmiş bükülmüş hat çizgisi WKT (LINESTRING)
        public string? PreviousWkt { get; set; } // Önceki geometri yedeği (Geri alma / Undo için)
        public string? CustomWkt { get; set; } // Kullanıcının elle büktüğü özel hat geometrisi
        public string GeometryType { get; set; } = "Direct"; // "Direct" (Kuş Bakışı), "Osrm" (Karayolu), "Custom" (Bükülmüş)
        public string RouteClass { get; set; } = "araba"; // "gemi", "metro", "tren", "araba", "yuruyus", "bisiklet"
        public Geometry? Geometry { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;

        // 1-N İlişki: Bir güzergahın birden fazla durağı vardır
        public ICollection<StopFeature> Stops { get; set; } = new List<StopFeature>();
    }
}

