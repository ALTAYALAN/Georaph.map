using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
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

        [HttpGet]
        public async Task<IActionResult> GetAllDrawings()
        {
            var drawings = await _drawingService.GetAllDrawingsAsync();
            return Ok(drawings);
        }

        [HttpPost("point")]
        public async Task<IActionResult> CreatePoint([FromBody] CreateDrawingDto dto)
        {
            try
            {
                var result = await _drawingService.CreatePointAsync(dto);
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
            try
            {
                var result = await _drawingService.CreateLineAsync(dto);
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
            try
            {
                var result = await _drawingService.CreatePolygonAsync(dto);
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

        [HttpDelete("{type}/{id}")]
        public async Task<IActionResult> DeleteDrawing(string type, int id)
        {
            try
            {
                var success = await _drawingService.DeleteDrawingAsync(type, id);
                if (!success)
                    return NotFound(new { Message = "Çizim bulunamadı." });

                return Ok(new { Message = "Çizim başarıyla silindi." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }
    }
}
