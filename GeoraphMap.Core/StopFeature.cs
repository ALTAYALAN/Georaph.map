using System;
using NetTopologySuite.Geometries;

namespace GeoraphMap.Core
{
    public class StopFeature
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int OrderIndex { get; set; } = 1; // Güzergah içerisindeki sıralama numarası (1, 2, 3...)
        public string? Description { get; set; }

        public int? RouteId { get; set; }
        public RouteFeature? Route { get; set; }

        // Benzersiz Durak Kodu (örn. BUS-0601, METRO-ANK-01, PORT-MDN)
        public string? StopCode { get; set; }

        // Durak Sınıfı: "otobus", "metro", "gemi", "tren", "araba" vb.
        public string StopClass { get; set; } = "otobus";

        // Çoklu Güzergah Bağlantıları (Many-to-Many)
        public System.Collections.Generic.ICollection<RouteStopFeature> RouteStops { get; set; } = new System.Collections.Generic.List<RouteStopFeature>();

        // Coğrafi Konum (PostGIS Point Geometrisi)
        public string Wkt { get; set; } = string.Empty;
        public Point? Geometry { get; set; }

        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
