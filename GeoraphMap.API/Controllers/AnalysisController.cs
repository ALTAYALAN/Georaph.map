using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AnalysisController : ControllerBase
    {
        private readonly IAnalysisService _analysisService;

        public AnalysisController(IAnalysisService analysisService)
        {
            _analysisService = analysisService;
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

        [HttpPost("inventory")]
        public async Task<IActionResult> AnalyzeInventory([FromBody] InventoryAnalysisRequestDto dto)
        {
            try
            {
                int userId = GetUserId();
                string userRole = GetUserRole();
                var result = await _analysisService.AnalyzePolygonInventoryAsync(dto.Wkt, userId, userRole);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu analiz hatası: {ex.Message}" });
            }
        }
    }
}
