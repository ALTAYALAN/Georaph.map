using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixSnakeCaseInvariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_permission_ıd",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_role_role_ıd",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_permission_ıd",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_user_user_ıd",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_role_role_ıd",
                table: "tbl_user_role");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_user_user_ıd",
                table: "tbl_user_role");

            migrationBuilder.RenameColumn(
                name: "role_ıd",
                table: "tbl_user_role",
                newName: "role_id");

            migrationBuilder.RenameColumn(
                name: "user_ıd",
                table: "tbl_user_role",
                newName: "user_id");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_role_role_ıd",
                table: "tbl_user_role",
                newName: "IX_tbl_user_role_role_id");

            migrationBuilder.RenameColumn(
                name: "permission_ıd",
                table: "tbl_user_permission",
                newName: "permission_id");

            migrationBuilder.RenameColumn(
                name: "user_ıd",
                table: "tbl_user_permission",
                newName: "user_id");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_permission_permission_ıd",
                table: "tbl_user_permission",
                newName: "IX_tbl_user_permission_permission_id");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_user",
                newName: "is_deleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_user",
                newName: "is_active");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_user",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "permission_ıd",
                table: "tbl_role_permission",
                newName: "permission_id");

            migrationBuilder.RenameColumn(
                name: "role_ıd",
                table: "tbl_role_permission",
                newName: "role_id");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_role_permission_permission_ıd",
                table: "tbl_role_permission",
                newName: "IX_tbl_role_permission_permission_id");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_role",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_polygon",
                newName: "is_deleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_polygon",
                newName: "is_active");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_polygon",
                newName: "inserted_user_id");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_polygon",
                newName: "inserted_date");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_polygon",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_point",
                newName: "is_deleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_point",
                newName: "is_active");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_point",
                newName: "inserted_user_id");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_point",
                newName: "inserted_date");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_point",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_permission",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_line",
                newName: "is_deleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_line",
                newName: "is_active");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_line",
                newName: "inserted_user_id");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_line",
                newName: "inserted_date");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_line",
                newName: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_permission_id",
                table: "tbl_role_permission",
                column: "permission_id",
                principalTable: "tbl_permission",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_role_role_id",
                table: "tbl_role_permission",
                column: "role_id",
                principalTable: "tbl_role",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_permission_id",
                table: "tbl_user_permission",
                column: "permission_id",
                principalTable: "tbl_permission",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_user_user_id",
                table: "tbl_user_permission",
                column: "user_id",
                principalTable: "tbl_user",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_role_role_id",
                table: "tbl_user_role",
                column: "role_id",
                principalTable: "tbl_role",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_user_user_id",
                table: "tbl_user_role",
                column: "user_id",
                principalTable: "tbl_user",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_permission_id",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_role_role_id",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_permission_id",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_user_user_id",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_role_role_id",
                table: "tbl_user_role");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_user_user_id",
                table: "tbl_user_role");

            migrationBuilder.RenameColumn(
                name: "role_id",
                table: "tbl_user_role",
                newName: "role_ıd");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "tbl_user_role",
                newName: "user_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_role_role_id",
                table: "tbl_user_role",
                newName: "IX_tbl_user_role_role_ıd");

            migrationBuilder.RenameColumn(
                name: "permission_id",
                table: "tbl_user_permission",
                newName: "permission_ıd");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "tbl_user_permission",
                newName: "user_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_permission_permission_id",
                table: "tbl_user_permission",
                newName: "IX_tbl_user_permission_permission_ıd");

            migrationBuilder.RenameColumn(
                name: "is_deleted",
                table: "tbl_user",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "is_active",
                table: "tbl_user",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_user",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "permission_id",
                table: "tbl_role_permission",
                newName: "permission_ıd");

            migrationBuilder.RenameColumn(
                name: "role_id",
                table: "tbl_role_permission",
                newName: "role_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_role_permission_permission_id",
                table: "tbl_role_permission",
                newName: "IX_tbl_role_permission_permission_ıd");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_role",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "is_deleted",
                table: "tbl_polygon",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "is_active",
                table: "tbl_polygon",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "inserted_user_id",
                table: "tbl_polygon",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "inserted_date",
                table: "tbl_polygon",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_polygon",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "is_deleted",
                table: "tbl_point",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "is_active",
                table: "tbl_point",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "inserted_user_id",
                table: "tbl_point",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "inserted_date",
                table: "tbl_point",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_point",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_permission",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "is_deleted",
                table: "tbl_line",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "is_active",
                table: "tbl_line",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "inserted_user_id",
                table: "tbl_line",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "inserted_date",
                table: "tbl_line",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tbl_line",
                newName: "ıd");

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_permission_ıd",
                table: "tbl_role_permission",
                column: "permission_ıd",
                principalTable: "tbl_permission",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_role_role_ıd",
                table: "tbl_role_permission",
                column: "role_ıd",
                principalTable: "tbl_role",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_permission_ıd",
                table: "tbl_user_permission",
                column: "permission_ıd",
                principalTable: "tbl_permission",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_user_user_ıd",
                table: "tbl_user_permission",
                column: "user_ıd",
                principalTable: "tbl_user",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_role_role_ıd",
                table: "tbl_user_role",
                column: "role_ıd",
                principalTable: "tbl_role",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_user_user_ıd",
                table: "tbl_user_role",
                column: "user_ıd",
                principalTable: "tbl_user",
                principalColumn: "ıd",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
