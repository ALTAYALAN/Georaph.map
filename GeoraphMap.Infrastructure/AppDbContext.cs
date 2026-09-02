using System;
using System.Collections.Generic;
using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<PointFeature> Points { get; set; }
        public DbSet<LineFeature> Lines { get; set; }
        public DbSet<PolygonFeature> Polygons { get; set; }

        public DbSet<Role> Roles { get; set; }
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }
        public DbSet<UserPermission> UserPermissions { get; set; }
        public DbSet<EditorCollaboration> EditorCollaborations { get; set; }
        public DbSet<CityFeature> Cities { get; set; }
        public DbSet<PoiCategory> PoiCategories { get; set; }
        public DbSet<Poi> Pois { get; set; }
        public DbSet<RouteFeature> Routes { get; set; }
        public DbSet<StopFeature> Stops { get; set; }
        public DbSet<UserSavedRoute> UserSavedRoutes { get; set; }
        public DbSet<UserFavoritePoi> UserFavoritePois { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasPostgresExtension("postgis");

            modelBuilder.Entity<User>().ToTable("tbl_user");
            modelBuilder.Entity<PointFeature>().ToTable("tbl_point");
            modelBuilder.Entity<LineFeature>().ToTable("tbl_line");
            modelBuilder.Entity<PolygonFeature>().ToTable("tbl_polygon");
            modelBuilder.Entity<CityFeature>().ToTable("tbl_city");
            modelBuilder.Entity<PoiCategory>().ToTable("tbl_poi_category");
            modelBuilder.Entity<Poi>().ToTable("tbl_poi");
            modelBuilder.Entity<RouteFeature>().ToTable("tbl_route");
            modelBuilder.Entity<RouteFeature>()
                .Property(r => r.RouteClass)
                .HasColumnName("route_class")
                .HasDefaultValue("araba");
            modelBuilder.Entity<StopFeature>().ToTable("tbl_stop");
            modelBuilder.Entity<UserSavedRoute>().ToTable("tbl_user_saved_route");
            modelBuilder.Entity<UserFavoritePoi>().ToTable("tbl_user_favorite_poi");

            modelBuilder.Entity<Role>().ToTable("tbl_role");
            modelBuilder.Entity<Permission>().ToTable("tbl_permission");
            modelBuilder.Entity<UserRole>().ToTable("tbl_user_role");
            modelBuilder.Entity<RolePermission>().ToTable("tbl_role_permission");
            modelBuilder.Entity<UserPermission>().ToTable("tbl_user_permission");
            modelBuilder.Entity<EditorCollaboration>().ToTable("tbl_editor_collaboration");

            // Route & Stop 1-N Relation
            modelBuilder.Entity<StopFeature>()
                .HasOne(s => s.Route)
                .WithMany(r => r.Stops)
                .HasForeignKey(s => s.RouteId)
                .OnDelete(DeleteBehavior.Cascade);

            // POI Category Self-Referencing Relation
            modelBuilder.Entity<PoiCategory>()
                .HasOne(c => c.Parent)
                .WithMany(c => c.Children)
                .HasForeignKey(c => c.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            // POI Category & User Relations
            modelBuilder.Entity<Poi>()
                .HasOne(p => p.Category)
                .WithMany(c => c.Pois)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Poi>()
                .HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Composite Keys
            modelBuilder.Entity<UserRole>()
                .HasKey(ur => new { ur.UserId, ur.RoleId });

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId);

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId);

            modelBuilder.Entity<RolePermission>()
                .HasKey(rp => new { rp.RoleId, rp.PermissionId });

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId);

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId);

            modelBuilder.Entity<UserPermission>()
                .HasKey(up => new { up.UserId, up.PermissionId });

            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.User)
                .WithMany(u => u.UserPermissions)
                .HasForeignKey(up => up.UserId);

            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.Permission)
                .WithMany(p => p.UserPermissions)
                .HasForeignKey(up => up.PermissionId);

            // Seed Permissions
            modelBuilder.Entity<Permission>().HasData(
                new Permission { Id = 1, Name = "Point Ekleme", Code = "point.create", Description = "Haritada yeni nokta objesi ekleme yetkisi" },
                new Permission { Id = 2, Name = "Line Ekleme", Code = "line.create", Description = "Haritada yeni çizgi objesi ekleme yetkisi" },
                new Permission { Id = 3, Name = "Polygon Ekleme", Code = "polygon.create", Description = "Haritada yeni poligon objesi ekleme yetkisi" },
                new Permission { Id = 5, Name = "Kullanıcı Yönetimi", Code = "user.manage", Description = "Kullanıcı ekleme, güncelleme, silme ve yetkilendirme" },
                new Permission { Id = 6, Name = "Rol Yönetimi", Code = "role.manage", Description = "Rol ekleme, güncelleme ve rol yetkisi yönetimi" },
                new Permission { Id = 7, Name = "Bütün Çizimleri Görüntüleme", Code = "drawings.view_all", Description = "Sistemdeki tüm çizimleri ve konumları görüntüleme yetkisi" },
                new Permission { Id = 8, Name = "POI Ekleme", Code = "poi.create", Description = "Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi" }
            );

            // Seed Roles
            modelBuilder.Entity<Role>().HasData(
                new Role { Id = 1, Name = "Admin", Description = "Tüm yetkilere sahip sistem yöneticisi" },
                new Role { Id = 2, Name = "Editor", Description = "Çizim ve veri ekleme yetkisine sahip editör" },
                new Role { Id = 3, Name = "Viewer", Description = "Sadece görüntüleme yetkisine sahip kullanıcı" }
            );

            // Seed Role Permissions for Admin & Editor
            modelBuilder.Entity<RolePermission>().HasData(
                new RolePermission { RoleId = 1, PermissionId = 1 },
                new RolePermission { RoleId = 1, PermissionId = 2 },
                new RolePermission { RoleId = 1, PermissionId = 3 },
                new RolePermission { RoleId = 1, PermissionId = 5 },
                new RolePermission { RoleId = 1, PermissionId = 6 },
                new RolePermission { RoleId = 1, PermissionId = 7 },
                new RolePermission { RoleId = 1, PermissionId = 8 },

                new RolePermission { RoleId = 2, PermissionId = 1 },
                new RolePermission { RoleId = 2, PermissionId = 2 },
                new RolePermission { RoleId = 2, PermissionId = 3 },
                new RolePermission { RoleId = 2, PermissionId = 8 },

                new RolePermission { RoleId = 3, PermissionId = 7 }
            );

            // PostgreSQL Snake_Case / Lowercase Column Naming (Tırnaksız SQL Desteği)
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    property.SetColumnName(ToSnakeCase(property.Name));
                }
            }
        }

        private static string ToSnakeCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            var startUnderscores = System.Text.RegularExpressions.Regex.Match(input, @"^_+");
            return startUnderscores + System.Text.RegularExpressions.Regex.Replace(input, @"([a-z0-9])([A-Z])", "$1_$2").ToLowerInvariant();
        }
    }
}
