using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using BCrypt.Net;

namespace GeoraphMap.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;

        public AuthService(IConfiguration configuration, AppDbContext context)
        {
            _configuration = configuration;
            _context = context;
        }

        public async Task<bool> RegisterAsync(RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                throw new ArgumentException("Kullanıcı adı ve şifre zorunludur.");
            }

            var trimmedUsername = dto.Username.Trim();

            var existingUser = await _context.Users.AnyAsync(u => u.Username.ToLower() == trimmedUsername.ToLower() && !u.IsDeleted);
            if (existingUser)
            {
                throw new InvalidOperationException("Bu kullanıcı adı zaten alınmış. Lütfen başka bir kullanıcı adı seçin.");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var newUser = new User
            {
                Username = trimmedUsername,
                Email = dto.Email?.Trim() ?? string.Empty,
                Phone = dto.Phone?.Trim() ?? string.Empty,
                PasswordHash = passwordHash,
                IsActive = true,
                IsDeleted = false,
                ModifiedDate = DateTime.UtcNow
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<LoginResponseDto?> LoginAsync(LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                return null;
            }

            var trimmedUsername = dto.Username.Trim();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == trimmedUsername.ToLower() && u.IsActive && !u.IsDeleted);

            if (user != null)
            {
                bool isValid = false;
                try
                {
                    isValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
                }
                catch
                {
                    isValid = user.PasswordHash == dto.Password;
                }

                if (!isValid)
                {
                    throw new ArgumentException("Kullanıcı adı veya şifre hatalı.");
                }
            }

            var jwtKey = _configuration["Jwt:Key"] ?? "GeoMap_Super_Secret_Key_For_Jwt_Authentication_2026_Key!";
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "GeoMapAPI";
            var jwtAudience = _configuration["Jwt:Audience"] ?? "GeoMapClient";

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, trimmedUsername),
                new Claim(ClaimTypes.Name, trimmedUsername),
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

            return new LoginResponseDto
            {
                Token = jwtToken,
                Expiration = expiration,
                Message = "Giriş başarılı!"
            };
        }
    }
}
