using System;

namespace GeoraphMap.Core.DTOs
{
    public class VehicleLocationDto
    {
        public int RouteId { get; set; }
        public string RouteName { get; set; } = string.Empty;
        public string RouteColor { get; set; } = "#3b82f6";
        public string RouteClass { get; set; } = "araba";
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public double Bearing { get; set; } // Yön açısı (0 - 360 derece)
        public double ProgressPercentage { get; set; } // Tamamlanma yüzdesi (0.0 - 100.0)
        public int CurrentStepIndex { get; set; }
        public int TotalSteps { get; set; }
        public string CurrentStopName { get; set; } = string.Empty;
        public string NextStopName { get; set; } = string.Empty;
        public double SpeedKmH { get; set; } = 45.0; // km/h
        public bool IsCompleted { get; set; }
        public bool IsPaused { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class SimulationStatusDto
    {
        public int RouteId { get; set; }
        public string RouteName { get; set; } = string.Empty;
        public string RouteColor { get; set; } = "#3b82f6";
        public string RouteClass { get; set; } = "araba";
        public bool IsRunning { get; set; }
        public bool IsPaused { get; set; }
        public string StartedBy { get; set; } = string.Empty;
        public DateTime? StartedAt { get; set; }
        public VehicleLocationDto? LastLocation { get; set; }
    }
}
