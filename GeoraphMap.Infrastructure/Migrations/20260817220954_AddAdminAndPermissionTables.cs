using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAndPermissionTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tbl_permission",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_permission", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tbl_role",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_role", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tbl_user_permission",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PermissionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_user_permission", x => new { x.UserId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_tbl_user_permission_tbl_permission_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "tbl_permission",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tbl_user_permission_tbl_user_UserId",
                        column: x => x.UserId,
                        principalTable: "tbl_user",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tbl_role_permission",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    PermissionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_role_permission", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_tbl_role_permission_tbl_permission_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "tbl_permission",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tbl_role_permission_tbl_role_RoleId",
                        column: x => x.RoleId,
                        principalTable: "tbl_role",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tbl_user_role",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    RoleId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_user_role", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_tbl_user_role_tbl_role_RoleId",
                        column: x => x.RoleId,
                        principalTable: "tbl_role",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tbl_user_role_tbl_user_UserId",
                        column: x => x.UserId,
                        principalTable: "tbl_user",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "tbl_permission",
                columns: new[] { "Id", "Code", "Description", "Name" },
                values: new object[,]
                {
                    { 1, "point.create", "Haritada yeni nokta objesi ekleme yetkisi", "Point Ekleme" },
                    { 2, "line.create", "Haritada yeni çizgi objesi ekleme yetkisi", "Line Ekleme" },
                    { 3, "polygon.create", "Haritada yeni poligon objesi ekleme yetkisi", "Polygon Ekleme" },
                    { 4, "place.create", "Veritabanına mekan kaydı ekleme yetkisi", "Mekan/Place Ekleme" },
                    { 5, "user.manage", "Kullanıcı ekleme, güncelleme, silme ve yetkilendirme", "Kullanıcı Yönetimi" },
                    { 6, "role.manage", "Rol ekleme, güncelleme ve rol yetkisi yönetimi", "Rol Yönetimi" }
                });

            migrationBuilder.InsertData(
                table: "tbl_role",
                columns: new[] { "Id", "Description", "Name" },
                values: new object[,]
                {
                    { 1, "Tüm yetkilere sahip sistem yöneticisi", "Admin" },
                    { 2, "Çizim ve veri ekleme yetkisine sahip editör", "Editor" },
                    { 3, "Sadece görüntüleme yetkisine sahip kullanıcı", "Viewer" }
                });

            migrationBuilder.InsertData(
                table: "tbl_role_permission",
                columns: new[] { "PermissionId", "RoleId" },
                values: new object[,]
                {
                    { 1, 1 },
                    { 2, 1 },
                    { 3, 1 },
                    { 4, 1 },
                    { 5, 1 },
                    { 6, 1 },
                    { 1, 2 },
                    { 2, 2 },
                    { 3, 2 },
                    { 4, 2 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_tbl_role_permission_PermissionId",
                table: "tbl_role_permission",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_tbl_user_permission_PermissionId",
                table: "tbl_user_permission",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_tbl_user_role_RoleId",
                table: "tbl_user_role",
                column: "RoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tbl_role_permission");

            migrationBuilder.DropTable(
                name: "tbl_user_permission");

            migrationBuilder.DropTable(
                name: "tbl_user_role");

            migrationBuilder.DropTable(
                name: "tbl_permission");

            migrationBuilder.DropTable(
                name: "tbl_role");
        }
    }
}
