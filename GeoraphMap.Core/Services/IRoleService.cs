using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface IRoleService
    {
        Task<List<RoleDto>> GetAllRolesAsync();
        Task<RoleDto?> GetRoleByIdAsync(int id);
        Task<RoleDto> CreateRoleAsync(CreateRoleDto dto);
        Task<RoleDto?> UpdateRoleAsync(int id, UpdateRoleDto dto);
        Task<bool> DeleteRoleAsync(int id);
    }
}
