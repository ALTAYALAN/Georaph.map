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
    [Route("api/[controller]")]
    public class PoisController : ControllerBase
    {
        private readonly IPoiService _poiService;

        public PoisController(IPoiService poiService)
        {
            _poiService = poiService;
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

        private string GetUserRole()
        {
            var isAdminClaim = User.Claims.FirstOrDefault(c => c.Type.Equals("isAdmin", StringComparison.OrdinalIgnoreCase))?.Value;
            if (string.Equals(isAdminClaim, "true", StringComparison.OrdinalIgnoreCase))
                return "Admin";

            var roleClaim = User.Claims.FirstOrDefault(c =>
                c.Type.Equals("userRole", StringComparison.OrdinalIgnoreCase) ||
                c.Type.Equals(ClaimTypes.Role, StringComparison.OrdinalIgnoreCase) ||
                c.Type.EndsWith("role", StringComparison.OrdinalIgnoreCase));

            if (roleClaim != null && !string.IsNullOrEmpty(roleClaim.Value))
            {
                return roleClaim.Value;
            }

            return "Editor";
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] int? categoryId = null, [FromQuery] bool includeInactive = false)
        {
            try
            {
                int userId = GetUserId();
                string userRole = GetUserRole();
                var pois = await _poiService.GetAllPoisAsync(userId, userRole, categoryId, includeInactive);
                return Ok(pois);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"POI listesi alınırken hata oluştu: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var poi = await _poiService.GetPoiByIdAsync(id);
                if (poi == null) return NotFound(new { message = "POI bulunamadı." });
                return Ok(poi);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"POI alınırken hata: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePoiDto dto)
        {
            string role = GetUserRole();
            if (role.Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { message = "Viewer (İzleyici) rolündeki kullanıcılar POI ekleyemez." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "POI adı boş olamaz." });

            if (dto.CategoryId <= 0)
                return BadRequest(new { message = "Lütfen geçerli bir kategori seçiniz." });

            if (string.IsNullOrWhiteSpace(dto.Wkt))
                return BadRequest(new { message = "POI konumu (WKT) belirtilmelidir." });

            try
            {
                int userId = GetUserId();
                var created = await _poiService.CreatePoiAsync(dto, userId);
                return Ok(new { message = "POI başarıyla oluşturuldu ve haritaya eklendi.", data = created });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"POI oluşturulurken hata: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdatePoiDto dto)
        {
            string role = GetUserRole();
            if (role.Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { message = "Viewer (İzleyici) rolündeki kullanıcılar POI güncelleyemez." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "POI adı boş olamaz." });

            if (dto.CategoryId <= 0)
                return BadRequest(new { message = "Lütfen geçerli bir kategori seçiniz." });

            try
            {
                int userId = GetUserId();
                var updated = await _poiService.UpdatePoiAsync(id, dto, userId, role);
                if (updated == null) return NotFound(new { message = "POI bulunamadı." });
                return Ok(new { message = "POI detayları başarıyla güncellendi.", data = updated });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"POI güncellenirken hata: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            string role = GetUserRole();
            if (role.Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { message = "Viewer (İzleyici) rolündeki kullanıcılar POI silemez." });

            try
            {
                int userId = GetUserId();
                var success = await _poiService.DeletePoiAsync(id, userId, role);
                if (!success) return NotFound(new { message = "POI bulunamadı." });
                return Ok(new { message = "POI başarıyla silindi." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"POI silinirken hata: {ex.Message}" });
            }
        }
    }
}
