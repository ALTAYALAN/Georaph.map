using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConsolidatePlaceIntoPoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO tbl_point (""Name"", ""Wkt"", ""Color"", ""Geometry"", ""InsertedUserId"", ""InsertedDate"", ""IsActive"", ""IsDeleted"", ""ModifiedDate"")
                SELECT ""Name"", ""Wkt"", ""Color"", ""Location"", ""InsertedUserId"", ""InsertedDate"", ""IsActive"", ""IsDeleted"", ""ModifiedDate""
                FROM tbl_place;
            ");

            migrationBuilder.DropTable(
                name: "tbl_place");

            migrationBuilder.DeleteData(
                table: "tbl_role_permission",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 4, 1 });

            migrationBuilder.DeleteData(
                table: "tbl_role_permission",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 4, 2 });

            migrationBuilder.DeleteData(
                table: "tbl_permission",
                keyColumn: "Id",
                keyValue: 4);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tbl_place",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Color = table.Column<string>(type: "text", nullable: false),
                    InsertedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InsertedUserId = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Location = table.Column<Point>(type: "geometry", nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Wkt = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_place", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "tbl_permission",
                columns: new[] { "Id", "Code", "Description", "Name" },
                values: new object[] { 4, "place.create", "Veritabanına mekan kaydı ekleme yetkisi", "Mekan/Place Ekleme" });

            migrationBuilder.InsertData(
                table: "tbl_role_permission",
                columns: new[] { "PermissionId", "RoleId" },
                values: new object[,]
                {
                    { 4, 1 },
                    { 4, 2 }
                });
        }
    }
}
