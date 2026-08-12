using GeoraphMap.Core.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IPlaceService
    {
        Task<List<PlaceResponseDto>> GetPlacesAsync();
        Task<PlaceResponseDto> CreatePlaceAsync(CreatePlaceDto dto);
        Task<bool> DeletePlaceAsync(int id);
    }
}
