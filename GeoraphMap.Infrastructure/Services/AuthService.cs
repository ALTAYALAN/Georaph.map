using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IConfiguration _configuration;

        public AuthService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public Task<LoginResponseDto?> LoginAsync(LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                return Task.FromResult<LoginResponseDto?>(null);
            }

            var jwtKey = _configuration["Jwt:Key"] ?? "GeoMap_Super_Secret_Key_For_Jwt_Authentication_2026_Key!";
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "GeoMapAPI";
            var jwtAudience = _configuration["Jwt:Audience"] ?? "GeoMapClient";

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, dto.Username),
                new Claim(ClaimTypes.Name, dto.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var expiration = DateTime.UtcNow.AddMinutes(10);

            var tokenDescriptor = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiration,
                signingCredentials: credentials
            );

            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtToken = tokenHandler.WriteToken(tokenDescriptor);

            var response = new LoginResponseDto
            {
                Token = jwtToken,
                Expiration = expiration,
                Message = "Giriş başarılı!"
            };

            return Task.FromResult<LoginResponseDto?>(response);
        }
    }
}
