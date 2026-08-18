using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface IUserService
    {
        Task<List<UserDetailDto>> GetAllUsersAsync();
        Task<UserDetailDto?> GetUserByIdAsync(int id);
        Task<UserDetailDto> CreateUserAsync(CreateAdminUserDto dto);
        Task<UserDetailDto?> UpdateUserAsync(int id, UpdateAdminUserDto dto);
        Task<bool> DeleteUserAsync(int id);
        Task<bool> ToggleUserStatusAsync(int id);
        Task<List<UserPermissionDetailDto>> GetUserPermissionsAsync(int userId);
        Task<bool> AssignUserRolesAndPermissionsAsync(int userId, List<int> roleIds, List<int> directPermissionIds);
    }
}
