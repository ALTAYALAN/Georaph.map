using GeoraphMap.Core.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IDrawingService
    {
        Task<List<DrawingResponseDto>> GetAllDrawingsAsync(int userId, string userRole = "");
        Task<DrawingResponseDto> CreatePointAsync(CreateDrawingDto dto, int userId);
        Task<DrawingResponseDto> CreateLineAsync(CreateDrawingDto dto, int userId);
        Task<DrawingResponseDto> CreatePolygonAsync(CreateDrawingDto dto, int userId);
        Task<DrawingResponseDto?> UpdateDrawingAsync(string type, int id, UpdateDrawingDto dto, int userId);
        Task<bool> DeleteDrawingAsync(string type, int id, int userId);
    }
}
