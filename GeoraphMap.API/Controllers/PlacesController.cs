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
    public class PlacesController : ControllerBase
    {
        private readonly IPlaceService _placeService;

        public PlacesController(IPlaceService placeService)
        {
            _placeService = placeService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPlaces()
        {
            var places = await _placeService.GetPlacesAsync();
            return Ok(places);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePlace([FromBody] CreatePlaceDto dto)
        {
            try
            {
                var result = await _placeService.CreatePlaceAsync(dto);
                return Ok(new
                {
                    Message = "Nokta konumu veritabanına başarıyla kaydedildi.",
                    Place = result
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlace(int id)
        {
            var success = await _placeService.DeletePlaceAsync(id);
            if (!success)
                return NotFound(new { Message = "Konum bulunamadı." });

            return Ok(new { Message = "Konum başarıyla silindi." });
        }
    }
}