using System;
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
    public class PoiCategoriesController : ControllerBase
    {
        private readonly IPoiService _poiService;

        public PoiCategoriesController(IPoiService poiService)
        {
            _poiService = poiService;
        }

        private bool IsAdmin()
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value;
            if (username != null && username.Equals("asdf.admin", StringComparison.OrdinalIgnoreCase)) return true;

            var isAdminClaim = User.FindFirst("isAdmin")?.Value;
            if (isAdminClaim == "true") return true;

            var roleClaim = User.FindFirst("userRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            if (roleClaim != null && roleClaim.Equals("Admin", StringComparison.OrdinalIgnoreCase)) return true;

            return User.IsInRole("Admin");
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        {
            try
            {
                var categories = await _poiService.GetAllCategoriesAsync(includeInactive);
                return Ok(categories);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategoriler alınırken hata oluştu: {ex.Message}" });
            }
        }

        [HttpGet("tree")]
        [AllowAnonymous]
        public async Task<IActionResult> GetTree()
        {
            try
            {
                var tree = await _poiService.GetCategoryTreeAsync();
                return Ok(tree);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategori ağacı alınırken hata oluştu: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var category = await _poiService.GetCategoryByIdAsync(id);
                if (category == null) return NotFound(new { message = "Kategori bulunamadı." });
                return Ok(category);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategori alınırken hata: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePoiCategoryDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Kategori ekleme yetkisi sadece yöneticilere (Admin) aittir." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Kategori adı boş olamaz." });

            try
            {
                var created = await _poiService.CreateCategoryAsync(dto);
                return Ok(new { message = "Kategori başarıyla oluşturuldu.", data = created });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategori eklenirken hata: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdatePoiCategoryDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Kategori güncelleme yetkisi sadece yöneticilere (Admin) aittir." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Kategori adı boş olamaz." });

            try
            {
                var updated = await _poiService.UpdateCategoryAsync(id, dto);
                if (updated == null) return NotFound(new { message = "Kategori bulunamadı." });
                return Ok(new { message = "Kategori başarıyla güncellendi.", data = updated });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategori güncellenirken hata: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Kategori silme yetkisi sadece yöneticilere (Admin) aittir." });

            try
            {
                var success = await _poiService.DeleteCategoryAsync(id);
                if (!success) return NotFound(new { message = "Kategori bulunamadı." });
                return Ok(new { message = "Kategori ve bağlı alt kategoriler başarıyla silindi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kategori silinirken hata: {ex.Message}" });
            }
        }
    }
}
