using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface IPoiService
    {
        // Kategori Metotları
        Task<List<PoiCategoryDto>> GetAllCategoriesAsync(bool includeInactive = false);
        Task<List<PoiCategoryTreeDto>> GetCategoryTreeAsync();
        Task<PoiCategoryDto?> GetCategoryByIdAsync(int id);
        Task<PoiCategoryDto> CreateCategoryAsync(CreatePoiCategoryDto dto);
        Task<PoiCategoryDto?> UpdateCategoryAsync(int id, UpdatePoiCategoryDto dto);
        Task<bool> DeleteCategoryAsync(int id);

        // POI Metotları
        Task<List<PoiDto>> GetAllPoisAsync(int userId, string userRole, int? categoryId = null, bool includeInactive = false);
        Task<PoiDto?> GetPoiByIdAsync(int id);
        Task<PoiDto> CreatePoiAsync(CreatePoiDto dto, int userId);
        Task<PoiDto?> UpdatePoiAsync(int id, UpdatePoiDto dto, int userId, string userRole);
        Task<bool> DeletePoiAsync(int id, int userId, string userRole);
    }
}
