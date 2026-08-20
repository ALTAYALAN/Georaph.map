using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface ICityService
    {
        Task<List<CityDto>> GetAllCitiesAsync(bool includeDeleted = false);
        Task<CityDto?> GetCityByPlateAsync(int plate);
        Task<CityDto> CreateCityAsync(CreateCityDto dto);
        Task<CityDto?> UpdateCityAsync(int plate, UpdateCityDto dto);
        Task<bool> SoftDeleteCityAsync(int plate);
        Task<bool> RestoreCityAsync(int plate);
        Task<bool> BulkSaveCitiesAsync(List<CityDto> cities);
        Task<int> SeedCitiesFromJsonAsync(string jsonPath);
    }
}
