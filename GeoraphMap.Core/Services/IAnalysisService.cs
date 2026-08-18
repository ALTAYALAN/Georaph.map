using GeoraphMap.Core.DTOs;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IAnalysisService
    {
        Task<InventoryAnalysisResultDto> AnalyzePolygonInventoryAsync(string polygonWkt, int userId = 0, string userRole = "");
    }
}
