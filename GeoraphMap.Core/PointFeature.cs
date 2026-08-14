using NetTopologySuite.Geometries;
using System;

namespace GeoraphMap.Core
{
    public class PointFeature
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public Point Geometry { get; set; } = null!;
        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
