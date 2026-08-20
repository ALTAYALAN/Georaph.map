using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CitiesController : ControllerBase
    {
        private readonly ICityService _cityService;
        private readonly IWebHostEnvironment _env;

        public CitiesController(ICityService cityService, IWebHostEnvironment env)
        {
            _cityService = cityService;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool includeDeleted = false)
        {
            try
            {
                var cities = await _cityService.GetAllCitiesAsync(includeDeleted);

                // If database table is empty, auto-seed from wwwroot/data/turkey-cities.json
                if (cities.Count == 0)
                {
                    var jsonPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "data", "turkey-cities.json");
                    await _cityService.SeedCitiesFromJsonAsync(jsonPath);
                    cities = await _cityService.GetAllCitiesAsync(includeDeleted);
                }

                return Ok(cities);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpGet("{plate}")]
        public async Task<IActionResult> GetByPlate(int plate)
        {
            try
            {
                var city = await _cityService.GetCityByPlateAsync(plate);
                if (city == null) return NotFound(new { message = $"Plaka kodu {plate} olan il bulunamadı." });
                return Ok(city);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateCityDto dto)
        {
            try
            {
                if (dto.Plate <= 0) return BadRequest(new { message = "Geçersiz plaka kodu!" });
                if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "İl adı boş olamaz!" });

                var created = await _cityService.CreateCityAsync(dto);
                return CreatedAtAction(nameof(GetByPlate), new { plate = created.Plate }, created);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPut("{plate}")]
        public async Task<IActionResult> Update(int plate, [FromBody] UpdateCityDto dto)
        {
            try
            {
                var updated = await _cityService.UpdateCityAsync(plate, dto);
                if (updated == null) return NotFound(new { message = $"Plaka kodu {plate} olan il bulunamadı." });
                return Ok(updated);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpDelete("{plate}")]
        public async Task<IActionResult> SoftDelete(int plate)
        {
            try
            {
                var success = await _cityService.SoftDeleteCityAsync(plate);
                if (!success) return NotFound(new { message = $"Plaka kodu {plate} olan il bulunamadı." });
                return Ok(new { message = $"Plaka kodu {plate} olan il mantıksal olarak silindi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("restore/{plate}")]
        public async Task<IActionResult> Restore(int plate)
        {
            try
            {
                var success = await _cityService.RestoreCityAsync(plate);
                if (!success) return NotFound(new { message = $"Plaka kodu {plate} olan il bulunamadı." });
                return Ok(new { message = $"Plaka kodu {plate} olan il geri yüklendi." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("bulk-save")]
        public async Task<IActionResult> BulkSave([FromBody] BulkSaveCitiesDto dto)
        {
            try
            {
                if (dto == null || dto.Cities == null) return BadRequest(new { message = "İl verileri boş olamaz!" });
                var result = await _cityService.BulkSaveCitiesAsync(dto.Cities);
                return Ok(new { message = "Tüm il verileri ve coğrafi sınırlar veritabanına başarıyla kaydedildi.", count = dto.Cities.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }

        [HttpPost("seed")]
        public async Task<IActionResult> Seed()
        {
            try
            {
                var jsonPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "data", "turkey-cities.json");
                var count = await _cityService.SeedCitiesFromJsonAsync(jsonPath);
                return Ok(new { message = $"{count} adet il veritabanına eklendi ve dolduruldu.", count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Sunucu hatası: {ex.Message}" });
            }
        }
    }
}
