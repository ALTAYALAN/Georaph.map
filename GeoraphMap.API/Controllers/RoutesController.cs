using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RoutesController : ControllerBase
    {
        private readonly ITransportService _transportService;

        public RoutesController(ITransportService transportService)
        {
            _transportService = transportService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool includeStops = true)
        {
            var routes = await _transportService.GetAllRoutesAsync(includeStops);
            return Ok(routes);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var route = await _transportService.GetRouteByIdAsync(id);
            if (route == null) return NotFound(new { message = "Güzergah bulunamadı." });
            return Ok(route);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRouteDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Güzergah adı zorunludur." });

            var created = await _transportService.CreateRouteAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRouteDto dto)
        {
            var updated = await _transportService.UpdateRouteAsync(id, dto);
            if (updated == null) return NotFound(new { message = "Güzergah bulunamadı." });
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _transportService.DeleteRouteAsync(id);
            if (!success) return NotFound(new { message = "Güzergah bulunamadı." });
            return Ok(new { message = "Güzergah başarıyla silindi." });
        }

        [HttpGet("{id}/stops")]
        public async Task<IActionResult> GetStops(int id)
        {
            var stops = await _transportService.GetStopsByRouteIdAsync(id);
            return Ok(stops);
        }

        [HttpPost("{id}/stops/{stopId}")]
        public async Task<IActionResult> AddStop(int id, int stopId, [FromQuery] string position = "end", [FromQuery] int? targetStopId = null)
        {
            var success = await _transportService.AddStopToRouteAsync(id, stopId, position, targetStopId);
            if (!success) return BadRequest(new { message = "Durak güzergaha eklenemedi. Farklı sınıftaki duraklar bu güzergaha bağlanamaz." });

            var updatedRoute = await _transportService.GetRouteByIdAsync(id);
            return Ok(new { message = "Durak güzergaha başarıyla bağlandı.", route = updatedRoute });
        }

        [HttpDelete("{id}/stops/{stopId}")]
        public async Task<IActionResult> RemoveStop(int id, int stopId)
        {
            var success = await _transportService.RemoveStopFromRouteAsync(id, stopId);
            if (!success) return BadRequest(new { message = "Durak güzergahtan çıkarılamadı." });

            var updatedRoute = await _transportService.GetRouteByIdAsync(id);
            return Ok(new { message = "Durak güzergahtan başarıyla çıkarıldı.", route = updatedRoute });
        }

        [HttpPut("{id}/reorder-stops")]
        public async Task<IActionResult> ReorderStops(int id, [FromBody] ReorderStopsDto dto)
        {
            if (dto == null || dto.OrderedStopIds == null)
                return BadRequest(new { message = "Sıralı durak listesi zorunludur." });

            var success = await _transportService.ReorderStopsAsync(id, dto.OrderedStopIds);
            if (!success) return BadRequest(new { message = "Durak sıralaması güncellenemedi veya duraklar bulunamadı." });

            var updatedRoute = await _transportService.GetRouteByIdAsync(id);
            return Ok(new { message = "Durak sıralaması başarıyla güncellendi.", route = updatedRoute });
        }

        [HttpPut("{id}/geometry")]
        public async Task<IActionResult> UpdateGeometry(int id, [FromBody] UpdateRouteGeometryDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "Geometri verisi geçersiz." });

            var updated = await _transportService.UpdateRouteGeometryAsync(id, dto.Wkt);
            if (updated == null) return NotFound(new { message = "Güzergah bulunamadı." });
            return Ok(new { message = "Güzergah hat çizgisi ve büküm geometrisi başarıyla güncellendi.", route = updated });
        }

        [HttpPost("{id}/generate-route")]
        public async Task<IActionResult> GenerateRoute(int id)
        {
            var route = await _transportService.GenerateOsrmRouteAsync(id);
            if (route == null) return NotFound(new { message = "Güzergah bulunamadı." });
            if (string.IsNullOrWhiteSpace(route.Wkt))
                return BadRequest(new { message = "Rota oluşturulamadı. Güzergaha ait en az 2 geçerli koordinatlı durak bulunmalıdır." });

            return Ok(new { message = "OSRM ile karayolu rotası başarıyla oluşturuldu.", route });
        }

        [HttpPost("{id}/switch-mode")]
        public async Task<IActionResult> SwitchMode(int id, [FromBody] SwitchGeometryModeDto dto)
        {
            var route = await _transportService.SwitchRouteGeometryModeAsync(id, dto?.Mode ?? "direct");
            if (route == null) return NotFound(new { message = "Güzergah bulunamadı." });

            string desc = (dto?.Mode?.ToLowerInvariant()) switch
            {
                "direct" or "kusbakisi" or "reset" => "Hat, duraklar arası standart kuş bakışı / doğrudan hatta dönüştürüldü.",
                "custom" or "bukulmus" => "Kullanıcının daha önce çizdiği özel bükülmüş hat geometrisi geri yüklendi.",
                "osrm" or "karayolu" => "OSRM karayolu rotası oluşturuldu.",
                _ => "Geometri modu başarıyla güncellendi."
            };

            return Ok(new { message = desc, route });
        }

        [HttpPost("{id}/revert")]
        public async Task<IActionResult> Revert(int id)
        {
            var route = await _transportService.RevertRouteGeometryAsync(id);
            if (route == null) return NotFound(new { message = "Güzergah bulunamadı veya geri alınacak önceki bir geometri kaydı yok." });

            return Ok(new { message = "Güzergah geometrisi bir önceki haline başarıyla geri alındı.", route });
        }
    }

    public class SwitchGeometryModeDto
    {
        public string Mode { get; set; } = "direct"; // "direct", "custom", "osrm", "revert"
    }
}
