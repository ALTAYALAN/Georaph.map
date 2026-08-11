using Microsoft.AspNetCore.Mvc;

namespace GeoraphMap.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        public class LoginDto
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                return BadRequest(new { Message = "Kullanıcı adı ve şifre gereklidir." });
            }

            // Başarılı oturum açma yanıtı ve token döndürür
            var token = "geomap_demo_jwt_token_123456789";

            return Ok(new
            {
                Token = token,
                Message = "Giriş başarılı!"
            });
        }
    }
}
