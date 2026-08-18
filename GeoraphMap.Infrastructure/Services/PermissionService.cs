using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure.Services
{
    public class PermissionService : IPermissionService
    {
        private readonly AppDbContext _context;

        public PermissionService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<PermissionDto>> GetAllPermissionsAsync()
        {
            var perms = await _context.Permissions.OrderBy(p => p.Id).ToListAsync();
            return perms.Select(p => new PermissionDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Description = p.Description
            }).ToList();
        }
    }
}
