using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface IPermissionService
    {
        Task<List<PermissionDto>> GetAllPermissionsAsync();
    }
}
