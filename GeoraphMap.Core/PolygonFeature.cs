using NetTopologySuite.Geometries;
using System;

namespace GeoraphMap.Core
{
    public class PolygonFeature
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public Polygon Geometry { get; set; } = null!;
        public int InsertedUserId { get; set; } = 1;
        public DateTime InsertedDate { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
