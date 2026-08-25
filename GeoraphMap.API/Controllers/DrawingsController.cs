using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DrawingsController : ControllerBase
    {
        private readonly IDrawingService _drawingService;

        public DrawingsController(IDrawingService drawingService)
        {
            _drawingService = drawingService;
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
        public async Task<IActionResult> GetAllDrawings()
        {
            try
            {
                int userId = GetUserId();
                string userRole = GetUserRole();
                var drawings = await _drawingService.GetAllDrawingsAsync(userId, userRole);
                return Ok(drawings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("point")]
        public async Task<IActionResult> CreatePoint([FromBody] CreateDrawingDto dto)
        {
            if (GetUserRole().Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { Message = "Viewer (İzleyici) rolündeki kullanıcılar çizim oluşturamaz." });

            try
            {
                int userId = GetUserId();
                var result = await _drawingService.CreatePointAsync(dto, userId);
                return Ok(new
                {
                    Message = "Nokta veritabanına (tbl_point) başarıyla kaydedildi.",
                    Data = result
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("line")]
        public async Task<IActionResult> CreateLine([FromBody] CreateDrawingDto dto)
        {
            if (GetUserRole().Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { Message = "Viewer (İzleyici) rolündeki kullanıcılar çizim oluşturamaz." });

            try
            {
                int userId = GetUserId();
                var result = await _drawingService.CreateLineAsync(dto, userId);
                return Ok(new
                {
                    Message = "Çizgi veritabanına (tbl_line) başarıyla kaydedildi.",
                    Data = result
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("polygon")]
        public async Task<IActionResult> CreatePolygon([FromBody] CreateDrawingDto dto)
        {
            if (GetUserRole().Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { Message = "Viewer (İzleyici) rolündeki kullanıcılar çizim oluşturamaz." });

            try
            {
                int userId = GetUserId();
                var result = await _drawingService.CreatePolygonAsync(dto, userId);
                return Ok(new
                {
                    Message = "Poligon veritabanına (tbl_polygon) başarıyla kaydedildi.",
                    Data = result
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPut("{type}/{id}")]
        public async Task<IActionResult> UpdateDrawing(string type, int id, [FromBody] UpdateDrawingDto dto)
        {
            string role = GetUserRole();
            if (role.Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { Message = "Viewer (İzleyici) rolündeki kullanıcılar çizim değiştiremez." });

            try
            {
                int userId = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ? 0 : GetUserId();
                var result = await _drawingService.UpdateDrawingAsync(type, id, dto, userId);
                if (result == null)
                    return NotFound(new { Message = "Çizim bulunamadı veya güncelleme yetkiniz yok." });

                return Ok(new
                {
                    Message = "Çizim detayları ve konumu başarıyla güncellendi.",
                    Data = result
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpDelete("{type}/{id}")]
        public async Task<IActionResult> DeleteDrawing(string type, int id)
        {
            string role = GetUserRole();
            if (role.Equals("Viewer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { Message = "Viewer (İzleyici) rolündeki kullanıcılar çizim silemez." });

            try
            {
                int userId = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ? 0 : GetUserId();
                var success = await _drawingService.DeleteDrawingAsync(type, id, userId);
                if (!success)
                    return NotFound(new { Message = "Çizim bulunamadı." });

                return Ok(new { Message = "Çizim başarıyla silindi." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [AllowAnonymous]
        [HttpPost("backup-cities")]
        public async Task<IActionResult> BackupCities([FromBody] System.Text.Json.JsonElement payload)
        {
            try
            {
                string jsonStr = payload.GetRawText();
                string basePath = AppDomain.CurrentDomain.BaseDirectory;
                string solutionDir = System.IO.Path.GetFullPath(System.IO.Path.Combine(basePath, "..", "..", "..", ".."));
                string targetPath1 = System.IO.Path.Combine(solutionDir, "geo-client", "public", "data", "turkey-cities.json");
                string targetPath2 = System.IO.Path.Combine(solutionDir, "geo-client", "public", "data", "turkey-cities-backup.json");
                string targetPath3 = System.IO.Path.Combine(solutionDir, "GeoraphMap.API", "wwwroot", "data", "turkey-cities.json");

                var dir = System.IO.Path.GetDirectoryName(targetPath1);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                var dir3 = System.IO.Path.GetDirectoryName(targetPath3);
                if (!string.IsNullOrEmpty(dir3) && !Directory.Exists(dir3))
                {
                    Directory.CreateDirectory(dir3);
                }

                await System.IO.File.WriteAllTextAsync(targetPath1, jsonStr);
                await System.IO.File.WriteAllTextAsync(targetPath2, jsonStr);
                try { await System.IO.File.WriteAllTextAsync(targetPath3, jsonStr); } catch { }

                return Ok(new { Message = "Haritadaki tüm iller ve poligonlar sunucu diskindeki turkey-cities.json dosyasına ve yedek dosyasına başarıyla kaydedildi!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Yedekleme Hatası: {ex.Message}" });
            }
        }
    }
}

