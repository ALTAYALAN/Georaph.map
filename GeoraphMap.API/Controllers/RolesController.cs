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
    public class RolesController : ControllerBase
    {
        private readonly IRoleService _roleService;

        public RolesController(IRoleService roleService)
        {
            _roleService = roleService;
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
        public async Task<IActionResult> GetAll()
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Bu alana sadece yetkili yöneticiler (Admin) erişebilir." });

            try
            {
                var roles = await _roleService.GetAllRolesAsync();
                return Ok(roles);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Roller alınırken hata: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var role = await _roleService.GetRoleByIdAsync(id);
                if (role == null) return NotFound(new { message = "Rol bulunamadı." });
                return Ok(role);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Rol detayı alınırken hata: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRoleDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var role = await _roleService.CreateRoleAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = role.Id }, role);
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
                return StatusCode(500, new { message = $"Rol oluşturulurken hata: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var updated = await _roleService.UpdateRoleAsync(id, dto);
                if (updated == null) return NotFound(new { message = "Güncellenecek rol bulunamadı." });
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Rol güncellenirken hata: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var result = await _roleService.DeleteRoleAsync(id);
                if (!result) return NotFound(new { message = "Silinecek rol bulunamadı." });
                return Ok(new { message = "Rol başarıyla silindi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Rol silinirken hata: {ex.Message}" });
            }
        }
    }
}
