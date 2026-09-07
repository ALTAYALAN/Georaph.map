using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StopsController : ControllerBase
    {
        private readonly ITransportService _transportService;

        public StopsController(ITransportService transportService)
        {
            _transportService = transportService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var stops = await _transportService.GetAllStopsAsync();
            return Ok(stops);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var stop = await _transportService.GetStopByIdAsync(id);
            if (stop == null) return NotFound(new { message = "Durak bulunamadı." });
            return Ok(stop);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateStopDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Durak adı zorunludur." });

            var created = await _transportService.CreateStopAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateStopDto dto)
        {
            var updated = await _transportService.UpdateStopAsync(id, dto);
            if (updated == null) return NotFound(new { message = "Durak bulunamadı." });
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _transportService.DeleteStopAsync(id);
            if (!success) return NotFound(new { message = "Durak bulunamadı." });
            return Ok(new { message = "Durak başarıyla silindi." });
        }

        [HttpPost("fix-orphan-metro")]
        public async Task<IActionResult> FixOrphanMetroStops()
        {
            var count = await _transportService.FixOrphanMetroStopsAsync();
            return Ok(new { message = $"{count} adet metro hattına bağlı olmayan durak başarıyla otobüs durağına dönüştürüldü.", count });
        }

        [HttpPost("fix-orphan-tren")]
        public async Task<IActionResult> FixOrphanTrenStops()
        {
            var count = await _transportService.FixOrphanTrenStopsAsync();
            return Ok(new { message = $"{count} adet tren hattına bağlı olmayan durak başarıyla otobüs durağına dönüştürüldü.", count });
        }

        [HttpPost("convert-to-bus")]
        public async Task<IActionResult> ConvertStopsToBus([FromBody] System.Collections.Generic.List<string> codesOrIds)
        {
            var count = await _transportService.ConvertStopsToBusByCodesOrIdsAsync(codesOrIds);
            return Ok(new { message = $"{count} adet durak başarıyla otobüs durağına dönüştürüldü.", count });
        }

        [HttpPost("fix-transit-junctions")]
        public async Task<IActionResult> FixTransitJunctions()
        {
            var success = await _transportService.FixAnkaraTransitJunctionsAsync();
            return Ok(new { message = "Ankara metro ve tren aktarma durakları (Kızılay, AKM, Gar, Sıhhiye vb.) başarıyla bağlandı ve sıralandı.", success });
        }
    }
}
