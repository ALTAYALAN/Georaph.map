using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
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
            var poiPerm = await _context.Permissions.FirstOrDefaultAsync(p => p.Code == "poi.create" || p.Name == "POI Ekleme");
            if (poiPerm == null)
            {
                poiPerm = new Permission
                {
                    Name = "POI Ekleme",
                    Code = "poi.create",
                    Description = "Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi"
                };
                _context.Permissions.Add(poiPerm);
                await _context.SaveChangesAsync();

                // Admin ve Editor rollerine varsayılan ekle
                var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
                if (adminRole != null && !await _context.RolePermissions.AnyAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == poiPerm.Id))
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = poiPerm.Id });
                }

                var editorRole = await _context.Roles.FirstOrDefaultAsync(r => r.Id == 2 || r.Name == "Editor" || r.Name == "Editör");
                if (editorRole != null && !await _context.RolePermissions.AnyAsync(rp => rp.RoleId == editorRole.Id && rp.PermissionId == poiPerm.Id))
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = editorRole.Id, PermissionId = poiPerm.Id });
                }
                await _context.SaveChangesAsync();
            }

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
