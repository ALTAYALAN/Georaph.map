using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface ITransportService
    {
        // Routes
        Task<List<RouteDto>> GetAllRoutesAsync(bool includeStops = true);
        Task<RouteDto?> GetRouteByIdAsync(int id);
        Task<RouteDto> CreateRouteAsync(CreateRouteDto dto);
        Task<RouteDto?> UpdateRouteAsync(int id, UpdateRouteDto dto);
        Task<RouteDto?> UpdateRouteGeometryAsync(int id, string wkt);
        Task<bool> DeleteRouteAsync(int id);

        // Stops
        Task<List<StopDto>> GetStopsByRouteIdAsync(int routeId);
        Task<List<StopDto>> GetAllStopsAsync();
        Task<StopDto?> GetStopByIdAsync(int id);
        Task<StopDto> CreateStopAsync(CreateStopDto dto);
        Task<StopDto?> UpdateStopAsync(int id, UpdateStopDto dto);
        Task<bool> DeleteStopAsync(int id);

        // Reordering
        Task<bool> ReorderStopsAsync(int routeId, List<int> orderedStopIds);

        // OSRM Automatic Routing & Geometry Mode Switching
        Task<RouteDto?> GenerateOsrmRouteAsync(int routeId);
        Task<BatchOsrmResultDto> GenerateAllBusRoutesOsrmAsync(bool onlyNonOsrm = false);
        Task<RouteDto?> SwitchRouteGeometryModeAsync(int routeId, string mode);
        Task<RouteDto?> RevertRouteGeometryAsync(int routeId);

        // Stop-Route Attachment (with flexible position: start, end, before, after)
        Task<bool> AddStopToRouteAsync(int routeId, int stopId, string position = "end", int? targetStopId = null);
        Task<bool> RemoveStopFromRouteAsync(int routeId, int stopId);

        // Stop Classification Cleanup
        Task<int> FixOrphanMetroStopsAsync();
        Task<int> FixOrphanTrenStopsAsync();
        Task<int> ConvertStopsToBusByCodesOrIdsAsync(List<string> codesOrIds);

        // Transit Junction & Multi-Route Stops Fix
        Task<bool> FixAnkaraTransitJunctionsAsync();
    }
}
