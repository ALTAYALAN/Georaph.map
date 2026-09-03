using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    public class RouteSummaryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3B82F6";
        public string RouteClass { get; set; } = "araba";
        public int OrderIndex { get; set; } = 1;
    }

    public class StopDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? StopCode { get; set; }
        public int OrderIndex { get; set; }
        public string? Description { get; set; }
        public int? RouteId { get; set; }
        public string? RouteName { get; set; }
        public string? RouteColor { get; set; }
        public List<int> RouteIds { get; set; } = new List<int>();
        public List<RouteSummaryDto> Routes { get; set; } = new List<RouteSummaryDto>();
        public string StopClass { get; set; } = "otobus";
        public string Wkt { get; set; } = string.Empty;
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
    }

    public class CreateStopDto
    {
        public string Name { get; set; } = string.Empty;
        public string? StopCode { get; set; }
        public int? RouteId { get; set; }
        public List<int>? RouteIds { get; set; }
        public string StopClass { get; set; } = "otobus";
        public string Wkt { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? OrderIndex { get; set; } // Belirtilmezse güzergahın sonuna eklenir
    }

    public class UpdateStopDto
    {
        public string Name { get; set; } = string.Empty;
        public string? StopCode { get; set; }
        public int? RouteId { get; set; }
        public List<int>? RouteIds { get; set; }
        public string? StopClass { get; set; }
        public string? Description { get; set; }
        public string? Wkt { get; set; }
        public int? OrderIndex { get; set; }
        public bool? IsActive { get; set; }
    }

    public class RouteDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3B82F6";
        public string? Description { get; set; }
        public string? Wkt { get; set; }
        public string? PreviousWkt { get; set; }
        public string? CustomWkt { get; set; }
        public string GeometryType { get; set; } = "Direct";
        public string RouteClass { get; set; } = "araba";
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
        public int StopCount { get; set; }
        public List<StopDto> Stops { get; set; } = new List<StopDto>();
    }

    public class CreateRouteDto
    {
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3B82F6";
        public string RouteClass { get; set; } = "araba";
        public string? Description { get; set; }
        public string? Wkt { get; set; }
    }

    public class UpdateRouteDto
    {
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#3B82F6";
        public string? RouteClass { get; set; }
        public string? Description { get; set; }
        public string? Wkt { get; set; }
        public bool? IsActive { get; set; }
    }

    public class UpdateRouteGeometryDto
    {
        public string Wkt { get; set; } = string.Empty;
    }

    public class ReorderStopsDto
    {
        public List<int> OrderedStopIds { get; set; } = new List<int>();
    }
}
