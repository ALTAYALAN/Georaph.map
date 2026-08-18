using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    public class PermissionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }

    public class UserPermissionDetailDto
    {
        public int PermissionId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsFromRole { get; set; }
        public string SourceRoleName { get; set; } = string.Empty;
        public bool IsDirect { get; set; }
    }

    public class RoleDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<PermissionDto> Permissions { get; set; } = new List<PermissionDto>();
        public int UserCount { get; set; }
    }

    public class CreateRoleDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<int> PermissionIds { get; set; } = new List<int>();
    }

    public class UpdateRoleDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<int> PermissionIds { get; set; } = new List<int>();
    }

    public class UserDetailDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public List<RoleDto> Roles { get; set; } = new List<RoleDto>();
        public List<UserPermissionDetailDto> Permissions { get; set; } = new List<UserPermissionDetailDto>();
    }

    public class CreateAdminUserDto
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public List<int> RoleIds { get; set; } = new List<int>();
        public List<int> DirectPermissionIds { get; set; } = new List<int>();
    }

    public class UpdateAdminUserDto
    {
        public string? Username { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Password { get; set; }
        public bool IsActive { get; set; }
        public List<int> RoleIds { get; set; } = new List<int>();
        public List<int> DirectPermissionIds { get; set; } = new List<int>();
    }

    public class AssignUserPermissionsDto
    {
        public List<int> DirectPermissionIds { get; set; } = new List<int>();
    }

    public class AssignUserRolesDto
    {
        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
