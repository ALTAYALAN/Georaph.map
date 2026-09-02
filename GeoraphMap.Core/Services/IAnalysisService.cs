using GeoraphMap.Core.DTOs;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IAnalysisService
    {
        Task<InventoryAnalysisResultDto> AnalyzePolygonInventoryAsync(string polygonWkt, int userId = 0, string userRole = "");
        Task<LocationAnalysisResultDto> AnalyzeLocationSuitabilityAsync(LocationAnalysisRequestDto dto, int userId = 0, string userRole = "");
    }
}
