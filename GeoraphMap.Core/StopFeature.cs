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

        // 1-N İlişki Yabancı Anahtarı (Foreign Key)
        public int RouteId { get; set; }
        public RouteFeature Route { get; set; } = null!;

        // Coğrafi Konum (PostGIS Point Geometrisi)
        public string Wkt { get; set; } = string.Empty;
        public Point? Geometry { get; set; }

        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
