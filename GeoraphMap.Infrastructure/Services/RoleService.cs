using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure.Services
{
    public class RoleService : IRoleService
    {
        private readonly AppDbContext _context;

        public RoleService(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsurePoiPermissionExistsAsync()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM tbl_permission WHERE code = 'poi.create' OR id = 8) THEN
                            INSERT INTO tbl_permission (id, name, code, description)
                            VALUES (8, 'POI Ekleme', 'poi.create', 'Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi');
                        END IF;
                    END $$;
                ");

                var poiPerm = await _context.Permissions.FirstOrDefaultAsync(p => p.Code == "poi.create" || p.Name == "POI Ekleme");
                if (poiPerm != null)
                {
                    var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
                    if (adminRole != null && !await _context.RolePermissions.AnyAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == poiPerm.Id))
                    {
                        _context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = poiPerm.Id });
                        await _context.SaveChangesAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RoleService] EnsurePoiPermissionExists error: {ex.Message}");
            }
        }

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
            await EnsurePoiPermissionExistsAsync();

            var roles = await _context.Roles
                .Include(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
                .Include(r => r.UserRoles)
                .ToListAsync();

            return roles.Select(r => MapToRoleDto(r)).ToList();
        }

        public async Task<RoleDto?> GetRoleByIdAsync(int id)
        {
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
                .Include(r => r.UserRoles)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (role == null) return null;
            return MapToRoleDto(role);
        }

        public async Task<RoleDto> CreateRoleAsync(CreateRoleDto dto)
        {
            await EnsurePoiPermissionExistsAsync();

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                throw new ArgumentException("Rol adı zorunludur.");
            }

            var trimmedName = dto.Name.Trim();
            var existing = await _context.Roles.AnyAsync(r => r.Name.ToLower() == trimmedName.ToLower());
            if (existing)
            {
                throw new InvalidOperationException("Bu rol adı zaten mevcut.");
            }

            var role = new Role
            {
                Name = trimmedName,
                Description = dto.Description?.Trim() ?? string.Empty
            };

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            if (dto.PermissionIds != null && dto.PermissionIds.Any())
            {
                var validPermIds = await _context.Permissions.Select(p => p.Id).ToListAsync();
                var safePermIds = dto.PermissionIds.Where(pid => validPermIds.Contains(pid)).Distinct().ToList();

                foreach (var permId in safePermIds)
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
                }
                await _context.SaveChangesAsync();
            }

            return (await GetRoleByIdAsync(role.Id))!;
        }

        public async Task<RoleDto?> UpdateRoleAsync(int id, UpdateRoleDto dto)
        {
            await EnsurePoiPermissionExistsAsync();

            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (role == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                role.Name = dto.Name.Trim();
            }
            role.Description = dto.Description?.Trim() ?? string.Empty;

            var validPermIds = await _context.Permissions.Select(p => p.Id).ToListAsync();
            var targetPermIds = (dto.PermissionIds ?? new List<int>())
                .Where(pid => validPermIds.Contains(pid))
                .Distinct()
                .ToList();

            var currentPermIds = role.RolePermissions.Select(rp => rp.PermissionId).ToList();

            // 1. Çıkarılacak yetkiler
            var toRemove = role.RolePermissions
                .Where(rp => !targetPermIds.Contains(rp.PermissionId))
                .ToList();
            if (toRemove.Any())
            {
                _context.RolePermissions.RemoveRange(toRemove);
            }

            // 2. Yeni eklenecek yetkiler
            var toAddIds = targetPermIds
                .Where(pid => !currentPermIds.Contains(pid))
                .ToList();
            foreach (var permId in toAddIds)
            {
                _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
            }

            await _context.SaveChangesAsync();
            return await GetRoleByIdAsync(role.Id);
        }

        public async Task<bool> DeleteRoleAsync(int id)
        {
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .Include(r => r.UserRoles)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (role == null) return false;

            _context.RolePermissions.RemoveRange(role.RolePermissions);
            _context.UserRoles.RemoveRange(role.UserRoles);
            _context.Roles.Remove(role);

            await _context.SaveChangesAsync();
            return true;
        }

        private static RoleDto MapToRoleDto(Role r)
        {
            return new RoleDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                UserCount = r.UserRoles?.Count ?? 0,
                Permissions = r.RolePermissions?.Select(rp => new PermissionDto
                {
                    Id = rp.Permission.Id,
                    Name = rp.Permission.Name,
                    Code = rp.Permission.Code,
                    Description = rp.Permission.Description
                }).ToList() ?? new List<PermissionDto>()
            };
        }
    }
}
