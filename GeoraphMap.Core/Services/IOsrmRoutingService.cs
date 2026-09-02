using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public class OsrmRouteResult
    {
        public bool Success { get; set; }
        public string? Wkt { get; set; }
        public double DistanceMeters { get; set; }
        public double DurationSeconds { get; set; }
        public string? Summary { get; set; }
        public List<RouteStepDto> Steps { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }

    public interface IOsrmRoutingService
    {
        /// <summary>
        /// Verilen sıralı koordinatlar arasında OSRM ile optimum rotayı (driving, walking, cycling) hesaplar.
        /// </summary>
        Task<OsrmRouteResult> CalculateRouteAsync(List<(double Longitude, double Latitude)> coordinates, string profile = "driving");
    }
}
