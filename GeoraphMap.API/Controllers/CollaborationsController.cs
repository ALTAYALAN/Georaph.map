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
    public class CollaborationsController : ControllerBase
    {
        private readonly ICollaborationService _collaborationService;

        public CollaborationsController(ICollaborationService collaborationService)
        {
            _collaborationService = collaborationService;
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

        [HttpGet("available-editors")]
        public async Task<IActionResult> GetAvailableEditors()
        {
            try
            {
                int userId = GetUserId();
                var editors = await _collaborationService.GetAvailableEditorsAsync(userId);
                return Ok(editors);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Editörler getirilirken hata: {ex.Message}" });
            }
        }

        [HttpGet("my-requests")]
        public async Task<IActionResult> GetMyRequests()
        {
            try
            {
                int userId = GetUserId();
                var requests = await _collaborationService.GetMyRequestsAsync(userId);
                return Ok(requests);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"İstekler getirilirken hata: {ex.Message}" });
            }
        }

        [HttpPost("request")]
        public async Task<IActionResult> SendRequest([FromBody] SendCollaborationRequestDto dto)
        {
            try
            {
                int userId = GetUserId();
                var result = await _collaborationService.SendRequestAsync(userId, dto.ReceiverUserId);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"İstek gönderilirken hata: {ex.Message}" });
            }
        }

        [HttpPost("respond")]
        public async Task<IActionResult> RespondRequest([FromBody] RespondCollaborationRequestDto dto)
        {
            try
            {
                int userId = GetUserId();
                await _collaborationService.RespondRequestAsync(userId, dto.RequestId, dto.Approve);
                return Ok(new { Message = dto.Approve ? "İşbirliği isteği kabul edildi!" : "İşbirliği isteği reddedildi." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Yanıtlarken hata: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> CancelCollaboration(int id)
        {
            try
            {
                int userId = GetUserId();
                await _collaborationService.CancelCollaborationAsync(userId, id);
                return Ok(new { Message = "İşbirliği sonlandırıldı / iptal edildi." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"İşbirliği iptal edilirken hata: {ex.Message}" });
            }
        }

        [HttpGet("effective-boundary")]
        public async Task<IActionResult> GetEffectiveBoundary()
        {
            try
            {
                int userId = GetUserId();
                var result = await _collaborationService.GetEffectiveSpatialBoundaryInfoAsync(userId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Ortak yetki alanı getirilirken hata: {ex.Message}" });
            }
        }
    }
}
