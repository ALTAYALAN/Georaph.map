using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/user-personal")]
    public class UserPersonalController : ControllerBase
    {
        private readonly IUserPersonalService _personalService;

        public UserPersonalController(IUserPersonalService personalService)
        {
            _personalService = personalService;
        }

        private int GetUserId()
        {
            var claim = User.Claims.FirstOrDefault(c =>
                c.Type.Equals("userId", StringComparison.OrdinalIgnoreCase) ||
                c.Type.Equals("id", StringComparison.OrdinalIgnoreCase) ||
                c.Type.Equals(ClaimTypes.NameIdentifier, StringComparison.OrdinalIgnoreCase) ||
                c.Type.EndsWith("nameidentifier", StringComparison.OrdinalIgnoreCase) ||
                c.Type.Equals("sub", StringComparison.OrdinalIgnoreCase));

            if (claim != null && int.TryParse(claim.Value, out int userId) && userId > 0)
            {
                return userId;
            }
            return 0;
        }

        // ==========================================
        // 1. OSRM YOL TARİFİ HESAPLAMA
        // ==========================================
        [AllowAnonymous]
        [HttpPost("calculate-directions")]
        public async Task<IActionResult> CalculateDirections([FromBody] CalculateDirectionsDto dto)
        {
            if (dto == null) return BadRequest(new { message = "Geçersiz koordinat verisi." });
            var result = await _personalService.CalculateDirectionsAsync(dto);
            return Ok(result);
        }

        // ==========================================
        // 2. KAYITLI GÜZERGAHLAR
        // ==========================================
        [HttpGet("saved-routes")]
        public async Task<IActionResult> GetSavedRoutes()
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            var routes = await _personalService.GetSavedRoutesAsync(userId);
            return Ok(routes);
        }

        [HttpGet("saved-routes/{id}")]
        public async Task<IActionResult> GetSavedRouteById(int id)
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            var route = await _personalService.GetSavedRouteByIdAsync(userId, id);
            if (route == null) return NotFound(new { message = "Kayıtlı güzergah bulunamadı." });

            return Ok(route);
        }

        [HttpPost("saved-routes")]
        public async Task<IActionResult> SaveRoute([FromBody] SaveDirectionRouteDto dto)
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            if (dto == null || string.IsNullOrWhiteSpace(dto.RouteWkt))
                return BadRequest(new { message = "Kaydedilecek rota geometrisi eksik." });

            var saved = await _personalService.SaveRouteAsync(userId, dto);
            return Ok(new { message = "Güzergah profilinize başarıyla kaydedildi.", route = saved });
        }

        [HttpDelete("saved-routes/{id}")]
        public async Task<IActionResult> DeleteSavedRoute(int id)
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            var success = await _personalService.DeleteSavedRouteAsync(userId, id);
            if (!success) return NotFound(new { message = "Kayıtlı güzergah bulunamadı veya silinemedi." });

            return Ok(new { message = "Kayıtlı güzergah başarıyla silindi." });
        }

        // ==========================================
        // 3. FAVORİ POI'LER
        // ==========================================
        [HttpGet("favorites")]
        public async Task<IActionResult> GetFavorites()
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            var favs = await _personalService.GetFavoritePoisAsync(userId);
            return Ok(favs);
        }

        [HttpPost("favorites/{poiId}/toggle")]
        public async Task<IActionResult> ToggleFavorite(int poiId)
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            bool isFav = await _personalService.ToggleFavoritePoiAsync(userId, poiId);
            return Ok(new
            {
                isFavorite = isFav,
                message = isFav ? "İlgi noktası favorilerinize eklendi." : "İlgi noktası favorilerinizden kaldırıldı."
            });
        }

        [HttpGet("favorites/{poiId}/status")]
        public async Task<IActionResult> GetFavoriteStatus(int poiId)
        {
            int userId = GetUserId();
            if (userId <= 0) return Ok(new { isFavorite = false });

            bool isFav = await _personalService.IsPoiFavoriteAsync(userId, poiId);
            return Ok(new { isFavorite = isFav });
        }

        // ==========================================
        // 4. KULLANICI PROFİL AYARLARI
        // ==========================================
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateUserProfileDto dto)
        {
            int userId = GetUserId();
            if (userId <= 0) return Unauthorized(new { message = "Kullanıcı kimliği doğrulanamadı." });

            if (dto == null) return BadRequest(new { message = "Güncellenecek profil verisi eksik." });

            try
            {
                var updated = await _personalService.UpdateProfileAsync(userId, dto);
                return Ok(new { message = "Profil bilgileriniz başarıyla güncellendi.", user = updated });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Profil güncellenirken hata: {ex.Message}" });
            }
        }
    }
}
