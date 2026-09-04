using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface IUserPersonalService
    {
        // OSRM Yol Tarifi Hesaplama
        Task<DirectionResultDto> CalculateDirectionsAsync(CalculateDirectionsDto dto);

        // Kayıtlı Güzergahlar
        Task<List<UserSavedRouteDto>> GetSavedRoutesAsync(int userId);
        Task<UserSavedRouteDto?> GetSavedRouteByIdAsync(int userId, int routeId);
        Task<UserSavedRouteDto> SaveRouteAsync(int userId, SaveDirectionRouteDto dto);
        Task<bool> DeleteSavedRouteAsync(int userId, int routeId);

        // Favori POI'ler
        Task<List<UserFavoritePoiDto>> GetFavoritePoisAsync(int userId);
        Task<bool> ToggleFavoritePoiAsync(int userId, int poiId);
        Task<bool> IsPoiFavoriteAsync(int userId, int poiId);

        // Profil Bilgilerini Güncelleme
        Task<UserDetailDto> UpdateProfileAsync(int userId, UpdateUserProfileDto dto);
    }
}
