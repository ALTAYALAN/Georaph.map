using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var result = await _authService.LoginAsync(dto);
            if (result == null)
            {
                return BadRequest(new { Message = "Kullanıcı adı ve şifre gereklidir." });
            }

            return Ok(result);
        }
    }
}
