using NetTopologySuite.Geometries;
using System;

namespace GeoraphMap.Core
{
    public class Poi
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        
        // Kategori İlişkisi
        public int CategoryId { get; set; }
        public PoiCategory Category { get; set; } = null!;

        // Mesai Saatleri (Örn: 08:30 - 18:00 veya Hafta içi 09:00 - 17:00)
        public string? WorkingHours { get; set; }

        // Fotoğraf / Görsel URL
        public string? ImageUrl { get; set; }

        // Geometri (Point/Polygon WKT & PostGIS Geometry)
        public string Wkt { get; set; } = string.Empty;
        public Geometry Geometry { get; set; } = null!;

        // Ekleyen Kullanıcı
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        // Standart Alanlar
        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
