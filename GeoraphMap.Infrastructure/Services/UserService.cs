using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace GeoraphMap.Infrastructure.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;

        public UserService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserDetailDto>> GetAllUsersAsync()
        {
            var users = await _context.Users
                .Where(u => !u.IsDeleted)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
                .Include(u => u.UserPermissions)
                    .ThenInclude(up => up.Permission)
                .ToListAsync();

            var allPermissions = await _context.Permissions.ToListAsync();
            var result = new List<UserDetailDto>();

            foreach (var user in users)
            {
                result.Add(MapToUserDetailDto(user, allPermissions));
            }

            result = result
                .OrderBy(u => {
                    var roleNames = u.Roles.Select(r => r.Name.ToLower()).ToList();
                    if (roleNames.Any(r => r.Contains("admin"))) return 1;
                    if (roleNames.Any(r => r.Contains("edit"))) return 2;
                    if (roleNames.Any(r => r.Contains("view"))) return 3;
                    return 4;
                })
                .ThenBy(u => u.Username)
                .ToList();

            return result;
        }

        public async Task<UserDetailDto?> GetUserByIdAsync(int id)
        {
            var user = await _context.Users
                .Where(u => u.Id == id && !u.IsDeleted)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
                .Include(u => u.UserPermissions)
                    .ThenInclude(up => up.Permission)
                .FirstOrDefaultAsync();

            if (user == null) return null;

            var allPermissions = await _context.Permissions.ToListAsync();
            return MapToUserDetailDto(user, allPermissions);
        }

        public async Task<UserDetailDto> CreateUserAsync(CreateAdminUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                throw new ArgumentException("Kullanıcı adı ve şifre zorunludur.");
            }

            var trimmedUsername = dto.Username.Trim();
            var existingUser = await _context.Users.AnyAsync(u => u.Username.ToLower() == trimmedUsername.ToLower() && !u.IsDeleted);
            if (existingUser)
            {
                throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılmaktadır.");
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

            // Assign Roles
            if (dto.RoleIds != null && dto.RoleIds.Any())
            {
                foreach (var roleId in dto.RoleIds.Distinct())
                {
                    _context.UserRoles.Add(new UserRole { UserId = newUser.Id, RoleId = roleId });
                }
            }

            // Assign Direct Permissions (filtering out ones that will come from roles if needed, or saving direct)
            if (dto.DirectPermissionIds != null && dto.DirectPermissionIds.Any())
            {
                foreach (var permId in dto.DirectPermissionIds.Distinct())
                {
                    _context.UserPermissions.Add(new UserPermission { UserId = newUser.Id, PermissionId = permId });
                }
            }

            await _context.SaveChangesAsync();
            return (await GetUserByIdAsync(newUser.Id))!;
        }

        public async Task<UserDetailDto?> UpdateUserAsync(int id, UpdateAdminUserDto dto)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

            if (user == null) return null;

            if (!string.IsNullOrWhiteSpace(dto.Username))
            {
                var trimmedUsername = dto.Username.Trim();
                if (!string.Equals(user.Username, trimmedUsername, StringComparison.OrdinalIgnoreCase))
                {
                    var existingUser = await _context.Users.AnyAsync(u => u.Id != id && u.Username.ToLower() == trimmedUsername.ToLower() && !u.IsDeleted);
                    if (existingUser)
                    {
                        throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılmaktadır.");
                    }
                    user.Username = trimmedUsername;
                }
            }

            user.Email = dto.Email?.Trim() ?? string.Empty;
            user.Phone = dto.Phone?.Trim() ?? string.Empty;
            user.IsActive = dto.IsActive;
            user.ModifiedDate = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(dto.Password))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }

            // Update Roles safely with diffing
            var targetRoleIds = (dto.RoleIds ?? new List<int>()).Distinct().ToList();
            var currentRoleIds = user.UserRoles.Select(ur => ur.RoleId).ToList();
            var rolesToRemove = user.UserRoles.Where(ur => !targetRoleIds.Contains(ur.RoleId)).ToList();
            if (rolesToRemove.Any()) _context.UserRoles.RemoveRange(rolesToRemove);
            var rolesToAdd = targetRoleIds.Where(rid => !currentRoleIds.Contains(rid)).ToList();
            foreach (var roleId in rolesToAdd)
            {
                _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
            }

            // Update Direct Permissions safely with diffing
            var validPermIds = await _context.Permissions.Select(p => p.Id).ToListAsync();
            var targetDirectPermIds = (dto.DirectPermissionIds ?? new List<int>()).Where(pid => validPermIds.Contains(pid)).Distinct().ToList();
            var currentDirectPermIds = user.UserPermissions.Select(up => up.PermissionId).ToList();
            var permsToRemove = user.UserPermissions.Where(up => !targetDirectPermIds.Contains(up.PermissionId)).ToList();
            if (permsToRemove.Any()) _context.UserPermissions.RemoveRange(permsToRemove);
            var permsToAdd = targetDirectPermIds.Where(pid => !currentDirectPermIds.Contains(pid)).ToList();
            foreach (var permId in permsToAdd)
            {
                _context.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permId });
            }

            await _context.SaveChangesAsync();
            return await GetUserByIdAsync(user.Id);
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);
            if (user == null) return false;

            user.IsDeleted = true;
            user.IsActive = false;
            user.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ToggleUserStatusAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);
            if (user == null) return false;

            user.IsActive = !user.IsActive;
            user.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<UserPermissionDetailDto>> GetUserPermissionsAsync(int userId)
        {
            var userDetail = await GetUserByIdAsync(userId);
            return userDetail?.Permissions ?? new List<UserPermissionDetailDto>();
        }

        public async Task<bool> AssignUserRolesAndPermissionsAsync(int userId, List<int> roleIds, List<int> directPermissionIds)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            if (user == null) return false;

            // Roles diffing
            var targetRoleIds = (roleIds ?? new List<int>()).Distinct().ToList();
            var currentRoleIds = user.UserRoles.Select(ur => ur.RoleId).ToList();
            var rolesToRemove = user.UserRoles.Where(ur => !targetRoleIds.Contains(ur.RoleId)).ToList();
            if (rolesToRemove.Any()) _context.UserRoles.RemoveRange(rolesToRemove);
            var rolesToAdd = targetRoleIds.Where(rid => !currentRoleIds.Contains(rid)).ToList();
            foreach (var roleId in rolesToAdd)
            {
                _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
            }

            // Direct permissions diffing
            var validPermIds = await _context.Permissions.Select(p => p.Id).ToListAsync();
            var targetDirectPermIds = (directPermissionIds ?? new List<int>()).Where(pid => validPermIds.Contains(pid)).Distinct().ToList();
            var currentDirectPermIds = user.UserPermissions.Select(up => up.PermissionId).ToList();
            var permsToRemove = user.UserPermissions.Where(up => !targetDirectPermIds.Contains(up.PermissionId)).ToList();
            if (permsToRemove.Any()) _context.UserPermissions.RemoveRange(permsToRemove);
            var permsToAdd = targetDirectPermIds.Where(pid => !currentDirectPermIds.Contains(pid)).ToList();
            foreach (var permId in permsToAdd)
            {
                _context.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permId });
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private static UserDetailDto MapToUserDetailDto(User user, List<Permission> allPermissions)
        {
            var roles = user.UserRoles.Select(ur => new RoleDto
            {
                Id = ur.Role.Id,
                Name = ur.Role.Name,
                Description = ur.Role.Description,
                Permissions = ur.Role.RolePermissions.Select(rp => new PermissionDto
                {
                    Id = rp.Permission.Id,
                    Name = rp.Permission.Name,
                    Code = rp.Permission.Code,
                    Description = rp.Permission.Description
                }).ToList()
            }).ToList();

            var directPermIds = user.UserPermissions.Select(up => up.PermissionId).ToHashSet();

            // Map permission details with role inheritance info
            var permissionDetails = new List<UserPermissionDetailDto>();

            foreach (var perm in allPermissions)
            {
                // Find if any assigned role contains this permission
                var matchingRole = user.UserRoles
                    .Select(ur => ur.Role)
                    .FirstOrDefault(r => r.RolePermissions.Any(rp => rp.PermissionId == perm.Id));

                bool isFromRole = matchingRole != null;
                bool isDirect = directPermIds.Contains(perm.Id);

                permissionDetails.Add(new UserPermissionDetailDto
                {
                    PermissionId = perm.Id,
                    Name = perm.Name,
                    Code = perm.Code,
                    Description = perm.Description,
                    IsFromRole = isFromRole,
                    SourceRoleName = matchingRole?.Name ?? string.Empty,
                    IsDirect = isDirect
                });
            }

            return new UserDetailDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Phone = user.Phone,
                IsActive = user.IsActive,
                SpatialBoundaryWkt = user.SpatialBoundaryWkt,
                Roles = roles,
                Permissions = permissionDetails
            };
        }

        public async Task<bool> SetSpatialBoundaryAsync(int userId, string? boundaryWkt)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
            if (user == null) return false;

            user.SpatialBoundaryWkt = string.IsNullOrWhiteSpace(boundaryWkt) ? null : boundaryWkt.Trim();
            user.ModifiedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
