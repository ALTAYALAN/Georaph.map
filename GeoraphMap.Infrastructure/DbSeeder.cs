using System;
using System.Linq;
using System.Threading.Tasks;
using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace GeoraphMap.Infrastructure
{
    public static class DbSeeder
    {
        public static async Task SeedAsdfUserAndAssignDrawingsAsync(AppDbContext context)
        {
            // 1. Find existing "asdf" or "asdf.admin" user
            var adminUser = await context.Users
                .FirstOrDefaultAsync(u => u.Username.ToLower() == "asdf.admin" || u.Username.ToLower() == "asdf");

            if (adminUser != null)
            {
                if (!adminUser.IsDeleted)
                {
                    adminUser.Username = "asdf.admin";
                    adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234");
                    adminUser.IsActive = true;
                    adminUser.ModifiedDate = DateTime.UtcNow;
                    await context.SaveChangesAsync();
                }
            }
            else
            {
                var passwordHash = BCrypt.Net.BCrypt.HashPassword("1234");
                adminUser = new User
                {
                    Username = "asdf.admin",
                    Email = "asdf.admin@geomap.com",
                    Phone = "05555555555",
                    PasswordHash = passwordHash,
                    IsActive = true,
                    IsDeleted = false,
                    ModifiedDate = DateTime.UtcNow
                };

                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }

            int adminUserId = adminUser.Id;
            Console.WriteLine($"[DbSeeder] asdf.admin User ID: {adminUserId}");

            // Assign Admin role (Id = 1)
            var adminRole = await context.Roles.FirstOrDefaultAsync(r => r.Id == 1 || r.Name == "Admin");
            if (adminRole != null)
            {
                var userRoleExists = await context.UserRoles.AnyAsync(ur => ur.UserId == adminUserId && ur.RoleId == adminRole.Id);
                if (!userRoleExists)
                {
                    context.UserRoles.Add(new UserRole
                    {
                        UserId = adminUserId,
                        RoleId = adminRole.Id
                    });
                    await context.SaveChangesAsync();
                }
            }

            await context.SaveChangesAsync();
            Console.WriteLine("[DbSeeder] asdf.admin user and role ensured successfully.");
        }

        public static async Task EnsureTablesCreatedAsync(AppDbContext context)
        {
            try
            {
                await context.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS tbl_editor_collaboration (
                        id SERIAL PRIMARY KEY,
                        sender_user_id INT NOT NULL,
                        receiver_user_id INT NOT NULL,
                        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                        requested_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        responded_date TIMESTAMP WITH TIME ZONE NULL
                    );
                ");
                Console.WriteLine("[DbSeeder] tbl_editor_collaboration table ensured successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbSeeder] Table creation error: {ex.Message}");
            }
        }
    }
}
