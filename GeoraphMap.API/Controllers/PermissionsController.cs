using System;
using System.Security.Claims;
using System.Threading.Tasks;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PermissionsController : ControllerBase
    {
        private readonly IPermissionService _permissionService;

        public PermissionsController(IPermissionService permissionService)
        {
            _permissionService = permissionService;
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
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var perms = await _permissionService.GetAllPermissionsAsync();
                return Ok(perms);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Yetkiler alınırken hata: {ex.Message}" });
            }
        }
    }
}
