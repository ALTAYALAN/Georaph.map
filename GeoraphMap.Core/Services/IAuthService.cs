using GeoraphMap.Core.DTOs;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IAuthService
    {
        Task<LoginResponseDto?> LoginAsync(LoginDto dto);
        Task<LoginResponseDto> GuestLoginAsync();
        Task<bool> RegisterAsync(RegisterDto dto);
    }
}
