using System;
using System.Collections.Generic;
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
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
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

        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                    ?? User.FindFirst("id")?.Value 
                    ?? User.FindFirst("userId")?.Value 
                    ?? User.FindFirst("nameid")?.Value;

                if (int.TryParse(userIdClaim, out int userId))
                {
                    var user = await _userService.GetUserByIdAsync(userId);
                    if (user != null) return Ok(user);
                }
                return NotFound(new { message = "Kullanıcı profili bulunamadı." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Profil bilgisi alınırken hata: {ex.Message}" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()

        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Bu alana sadece yetkili yöneticiler (Admin) erişebilir." });

            try
            {
                var users = await _userService.GetAllUsersAsync();
                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcılar alınırken hata: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var user = await _userService.GetUserByIdAsync(id);
                if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(user);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcı detayı alınırken hata: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateAdminUserDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var created = await _userService.CreateUserAsync(dto);
                return Ok(created);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcı oluşturulurken hata: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateAdminUserDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var updated = await _userService.UpdateUserAsync(id, dto);
                if (updated == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(updated);
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
                return StatusCode(500, new { message = $"Kullanıcı güncellenirken hata: {ex.Message}" });
            }
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var result = await _userService.ToggleUserStatusAsync(id);
                if (!result) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(new { message = "Kullanıcı durumu başarıyla güncellendi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcı durumu değiştirilirken hata: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var result = await _userService.DeleteUserAsync(id);
                if (!result) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(new { message = "Kullanıcı başarıyla silindi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcı silinirken hata: {ex.Message}" });
            }
        }

        [HttpPost("{id}/permissions")]
        public async Task<IActionResult> AssignPermissions(int id, [FromBody] AssignUserPermissionsDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var result = await _userService.AssignUserRolesAndPermissionsAsync(id, new List<int>(), dto.DirectPermissionIds);
                if (!result) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(new { message = "Kullanıcı yetkileri başarıyla güncellendi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Kullanıcı yetkileri atanırken hata: {ex.Message}" });
            }
        }

        [HttpPost("{id}/spatial-boundary")]
        public async Task<IActionResult> SetSpatialBoundary(int id, [FromBody] SetSpatialBoundaryDto dto)
        {
            if (!IsAdmin()) return StatusCode(403, new { message = "Sadece asdf.admin bu alana erişebilir." });

            try
            {
                var result = await _userService.SetSpatialBoundaryAsync(id, dto.SpatialBoundaryWkt);
                if (!result) return NotFound(new { message = "Kullanıcı bulunamadı." });
                return Ok(new { message = "Kullanıcının coğrafi yetki sınırı başarıyla güncellendi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Coğrafi yetki sınırı kaydedilirken hata: {ex.Message}" });
            }
        }
    }
}
