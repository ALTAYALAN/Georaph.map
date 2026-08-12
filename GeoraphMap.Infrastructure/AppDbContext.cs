using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Place> Places { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<PointFeature> Points { get; set; }
        public DbSet<LineFeature> Lines { get; set; }
        public DbSet<PolygonFeature> Polygons { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasPostgresExtension("postgis");

            modelBuilder.Entity<Place>().ToTable("tbl_place");
            modelBuilder.Entity<User>().ToTable("tbl_user");
            modelBuilder.Entity<PointFeature>().ToTable("tbl_point");
            modelBuilder.Entity<LineFeature>().ToTable("tbl_line");
            modelBuilder.Entity<PolygonFeature>().ToTable("tbl_polygon");
        }
    }
}
