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

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
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
                foreach (var permId in dto.PermissionIds.Distinct())
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
                }
                await _context.SaveChangesAsync();
            }

            return (await GetRoleByIdAsync(role.Id))!;
        }

        public async Task<RoleDto?> UpdateRoleAsync(int id, UpdateRoleDto dto)
        {
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (role == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                role.Name = dto.Name.Trim();
            }
            role.Description = dto.Description?.Trim() ?? string.Empty;

            _context.RolePermissions.RemoveRange(role.RolePermissions);
            if (dto.PermissionIds != null && dto.PermissionIds.Any())
            {
                foreach (var permId in dto.PermissionIds.Distinct())
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
                }
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
