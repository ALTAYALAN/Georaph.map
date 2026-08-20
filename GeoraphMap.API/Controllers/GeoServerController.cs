using System;
using System.Threading.Tasks;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GeoServerController : ControllerBase
    {
        private readonly IGeoServerService _geoServerService;

        public GeoServerController(IGeoServerService geoServerService)
        {
            _geoServerService = geoServerService;
        }

        [HttpGet("wfs/{layerName}")]
        public async Task<IActionResult> GetWfsFeature(string layerName)
        {
            try
            {
                var geoJsonStr = await _geoServerService.GetWfsFeatureGeoJsonAsync(layerName);
                return Content(geoJsonStr, "application/json");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"GeoServer WFS Hatası: {ex.Message}" });
            }
        }

        [HttpGet("wms")]
        public async Task<IActionResult> GetWmsTile()
        {
            try
            {
                string queryString = Request.QueryString.Value?.TrimStart('?') ?? "";
                var imageBytes = await _geoServerService.GetWmsMapImageAsync(queryString);
                if (imageBytes.Length > 0)
                {
                    return File(imageBytes, "image/png");
                }
                return NotFound(new { message = "WMS Harita görüntüsü oluşturulamadı." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"GeoServer WMS Hatası: {ex.Message}" });
            }
        }

        [HttpGet("capabilities")]
        public async Task<IActionResult> GetCapabilities()
        {
            try
            {
                var xmlStr = await _geoServerService.GetCapabilitiesAsync();
                return Content(xmlStr, "application/xml");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"GetCapabilities Hatası: {ex.Message}" });
            }
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            try
            {
                var status = await _geoServerService.GetGeoServerStatusAsync();
                return Ok(status);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"GeoServer Status Hatası: {ex.Message}" });
            }
        }
    }
}
