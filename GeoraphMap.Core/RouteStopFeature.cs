using System;

namespace GeoraphMap.Core
{
    public class RouteStopFeature
    {
        public int Id { get; set; }

        public int RouteId { get; set; }
        public RouteFeature Route { get; set; } = null!;

        public int StopId { get; set; }
        public StopFeature Stop { get; set; } = null!;

        public int OrderIndex { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
