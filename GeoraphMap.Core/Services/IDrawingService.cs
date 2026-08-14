using GeoraphMap.Core.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IDrawingService
    {
        Task<List<DrawingResponseDto>> GetAllDrawingsAsync();
        Task<DrawingResponseDto> CreatePointAsync(CreateDrawingDto dto);
        Task<DrawingResponseDto> CreateLineAsync(CreateDrawingDto dto);
        Task<DrawingResponseDto> CreatePolygonAsync(CreateDrawingDto dto);
        Task<bool> DeleteDrawingAsync(string type, int id);
    }
}
