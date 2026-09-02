using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SimulationController : ControllerBase
    {
        private readonly ISimulationService _simulationService;

        public SimulationController(ISimulationService simulationService)
        {
            _simulationService = simulationService;
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

            return "Viewer";
        }

        private bool CanManageSimulation()
        {
            var role = GetUserRole();
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "Operatör", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "Operator", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "Editor", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "Editör", StringComparison.OrdinalIgnoreCase);
        }

        [HttpGet("active")]
        public IActionResult GetActiveSimulations()
        {
            var active = _simulationService.GetActiveSimulations();
            return Ok(active);
        }

        [HttpGet("{routeId}/location")]
        public IActionResult GetLastLocation(int routeId)
        {
            var loc = _simulationService.GetLastLocation(routeId);
            if (loc == null) return NotFound(new { message = "Bu güzergah için aktif simülasyon konumu bulunamadı." });
            return Ok(loc);
        }

        [Authorize]
        [HttpPost("{routeId}/start")]
        public async Task<IActionResult> Start(int routeId)
        {
            if (!CanManageSimulation())
            {
                return StatusCode(403, new { message = "Yalnızca Yönetici (Admin) ve Operatör rolleri simülasyon başlatabilir." });
            }

            var username = User.Identity?.Name ?? User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name || c.Type == "username")?.Value ?? "Operatör";
            var status = await _simulationService.StartSimulationAsync(routeId, username);

            if (status == null)
            {
                return BadRequest(new { message = "Simülasyon başlatılamadı. Güzergah bulunamadı veya rota için yeterli durak/geometri yok." });
            }

            return Ok(new { message = "Araç simülasyonu başarıyla başlatıldı.", status });
        }

        [Authorize]
        [HttpPost("{routeId}/pause")]
        public async Task<IActionResult> Pause(int routeId)
        {
            if (!CanManageSimulation())
            {
                return StatusCode(403, new { message = "Yalnızca Yönetici (Admin) ve Operatör rolleri simülasyonu duraklatabilir." });
            }

            var paused = await _simulationService.PauseSimulationAsync(routeId);
            if (!paused)
            {
                return NotFound(new { message = "Duraklatılacak aktif bir simülasyon bulunamadı." });
            }

            return Ok(new { message = "Araç simülasyonu duraklatıldı." });
        }

        [Authorize]
        [HttpPost("{routeId}/resume")]
        public async Task<IActionResult> Resume(int routeId)
        {
            if (!CanManageSimulation())
            {
                return StatusCode(403, new { message = "Yalnızca Yönetici (Admin) ve Operatör rolleri simülasyona devam edebilir." });
            }

            var resumed = await _simulationService.ResumeSimulationAsync(routeId);
            if (!resumed)
            {
                return NotFound(new { message = "Devam ettirilecek duraklatılmış bir simülasyon bulunamadı." });
            }

            return Ok(new { message = "Araç simülasyonu devam ettirildi." });
        }

        [AllowAnonymous]
        [HttpPost("{routeId}/stop")]
        public async Task<IActionResult> Stop(int routeId)
        {
            await _simulationService.StopSimulationAsync(routeId);
            return Ok(new { message = "Araç simülasyonu iptal edildi ve kapatıldı." });
        }

        [AllowAnonymous]
        [HttpPost("stop-all")]
        public async Task<IActionResult> StopAll()
        {
            var active = _simulationService.GetActiveSimulations();
            foreach (var sim in active)
            {
                await _simulationService.StopSimulationAsync(sim.RouteId);
            }
            return Ok(new { message = "Tüm aktif simülasyonlar tamamen silindi ve kapatıldı." });
        }
    }
}
