using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConvertColumnsToSnakeCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_PermissionId",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_role_permission_tbl_role_RoleId",
                table: "tbl_role_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_PermissionId",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_permission_tbl_user_UserId",
                table: "tbl_user_permission");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_role_RoleId",
                table: "tbl_user_role");

            migrationBuilder.DropForeignKey(
                name: "FK_tbl_user_role_tbl_user_UserId",
                table: "tbl_user_role");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "tbl_user_role",
                newName: "role_ıd");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "tbl_user_role",
                newName: "user_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_role_RoleId",
                table: "tbl_user_role",
                newName: "IX_tbl_user_role_role_ıd");

            migrationBuilder.RenameColumn(
                name: "PermissionId",
                table: "tbl_user_permission",
                newName: "permission_ıd");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "tbl_user_permission",
                newName: "user_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_permission_PermissionId",
                table: "tbl_user_permission",
                newName: "IX_tbl_user_permission_permission_ıd");

            migrationBuilder.RenameColumn(
                name: "Username",
                table: "tbl_user",
                newName: "username");

            migrationBuilder.RenameColumn(
                name: "Phone",
                table: "tbl_user",
                newName: "phone");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "tbl_user",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "PasswordHash",
                table: "tbl_user",
                newName: "password_hash");

            migrationBuilder.RenameColumn(
                name: "ModifiedDate",
                table: "tbl_user",
                newName: "modified_date");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "tbl_user",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "tbl_user",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tbl_user",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "PermissionId",
                table: "tbl_role_permission",
                newName: "permission_ıd");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "tbl_role_permission",
                newName: "role_ıd");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_role_permission_PermissionId",
                table: "tbl_role_permission",
                newName: "IX_tbl_role_permission_permission_ıd");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tbl_role",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "tbl_role",
                newName: "description");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tbl_role",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "Wkt",
                table: "tbl_polygon",
                newName: "wkt");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tbl_polygon",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Geometry",
                table: "tbl_polygon",
                newName: "geometry");

            migrationBuilder.RenameColumn(
                name: "Color",
                table: "tbl_polygon",
                newName: "color");

            migrationBuilder.RenameColumn(
                name: "ModifiedDate",
                table: "tbl_polygon",
                newName: "modified_date");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "tbl_polygon",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "tbl_polygon",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "InsertedUserId",
                table: "tbl_polygon",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "InsertedDate",
                table: "tbl_polygon",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tbl_polygon",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "Wkt",
                table: "tbl_point",
                newName: "wkt");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tbl_point",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Geometry",
                table: "tbl_point",
                newName: "geometry");

            migrationBuilder.RenameColumn(
                name: "Color",
                table: "tbl_point",
                newName: "color");

            migrationBuilder.RenameColumn(
                name: "ModifiedDate",
                table: "tbl_point",
                newName: "modified_date");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "tbl_point",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "tbl_point",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "InsertedUserId",
                table: "tbl_point",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "InsertedDate",
                table: "tbl_point",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tbl_point",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tbl_permission",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "tbl_permission",
                newName: "description");

            migrationBuilder.RenameColumn(
                name: "Code",
                table: "tbl_permission",
                newName: "code");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tbl_permission",
                newName: "ıd");

            migrationBuilder.RenameColumn(
                name: "Wkt",
                table: "tbl_line",
                newName: "wkt");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tbl_line",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Geometry",
                table: "tbl_line",
                newName: "geometry");

            migrationBuilder.RenameColumn(
                name: "Color",
                table: "tbl_line",
                newName: "color");

            migrationBuilder.RenameColumn(
                name: "ModifiedDate",
                table: "tbl_line",
                newName: "modified_date");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "tbl_line",
                newName: "ıs_deleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "tbl_line",
                newName: "ıs_active");

            migrationBuilder.RenameColumn(
                name: "InsertedUserId",
                table: "tbl_line",
                newName: "ınserted_user_ıd");

            migrationBuilder.RenameColumn(
                name: "InsertedDate",
                table: "tbl_line",
                newName: "ınserted_date");

            migrationBuilder.RenameColumn(
                name: "Id",
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
                newName: "RoleId");

            migrationBuilder.RenameColumn(
                name: "user_ıd",
                table: "tbl_user_role",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_role_role_ıd",
                table: "tbl_user_role",
                newName: "IX_tbl_user_role_RoleId");

            migrationBuilder.RenameColumn(
                name: "permission_ıd",
                table: "tbl_user_permission",
                newName: "PermissionId");

            migrationBuilder.RenameColumn(
                name: "user_ıd",
                table: "tbl_user_permission",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_user_permission_permission_ıd",
                table: "tbl_user_permission",
                newName: "IX_tbl_user_permission_PermissionId");

            migrationBuilder.RenameColumn(
                name: "username",
                table: "tbl_user",
                newName: "Username");

            migrationBuilder.RenameColumn(
                name: "phone",
                table: "tbl_user",
                newName: "Phone");

            migrationBuilder.RenameColumn(
                name: "email",
                table: "tbl_user",
                newName: "Email");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_user",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_user",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "password_hash",
                table: "tbl_user",
                newName: "PasswordHash");

            migrationBuilder.RenameColumn(
                name: "modified_date",
                table: "tbl_user",
                newName: "ModifiedDate");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_user",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "permission_ıd",
                table: "tbl_role_permission",
                newName: "PermissionId");

            migrationBuilder.RenameColumn(
                name: "role_ıd",
                table: "tbl_role_permission",
                newName: "RoleId");

            migrationBuilder.RenameIndex(
                name: "IX_tbl_role_permission_permission_ıd",
                table: "tbl_role_permission",
                newName: "IX_tbl_role_permission_PermissionId");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tbl_role",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "tbl_role",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_role",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "wkt",
                table: "tbl_polygon",
                newName: "Wkt");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tbl_polygon",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "geometry",
                table: "tbl_polygon",
                newName: "Geometry");

            migrationBuilder.RenameColumn(
                name: "color",
                table: "tbl_polygon",
                newName: "Color");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_polygon",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_polygon",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_polygon",
                newName: "InsertedUserId");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_polygon",
                newName: "InsertedDate");

            migrationBuilder.RenameColumn(
                name: "modified_date",
                table: "tbl_polygon",
                newName: "ModifiedDate");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_polygon",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "wkt",
                table: "tbl_point",
                newName: "Wkt");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tbl_point",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "geometry",
                table: "tbl_point",
                newName: "Geometry");

            migrationBuilder.RenameColumn(
                name: "color",
                table: "tbl_point",
                newName: "Color");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_point",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_point",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_point",
                newName: "InsertedUserId");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_point",
                newName: "InsertedDate");

            migrationBuilder.RenameColumn(
                name: "modified_date",
                table: "tbl_point",
                newName: "ModifiedDate");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_point",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tbl_permission",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "tbl_permission",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "code",
                table: "tbl_permission",
                newName: "Code");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_permission",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "wkt",
                table: "tbl_line",
                newName: "Wkt");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tbl_line",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "geometry",
                table: "tbl_line",
                newName: "Geometry");

            migrationBuilder.RenameColumn(
                name: "color",
                table: "tbl_line",
                newName: "Color");

            migrationBuilder.RenameColumn(
                name: "ıs_deleted",
                table: "tbl_line",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "ıs_active",
                table: "tbl_line",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "ınserted_user_ıd",
                table: "tbl_line",
                newName: "InsertedUserId");

            migrationBuilder.RenameColumn(
                name: "ınserted_date",
                table: "tbl_line",
                newName: "InsertedDate");

            migrationBuilder.RenameColumn(
                name: "modified_date",
                table: "tbl_line",
                newName: "ModifiedDate");

            migrationBuilder.RenameColumn(
                name: "ıd",
                table: "tbl_line",
                newName: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_permission_PermissionId",
                table: "tbl_role_permission",
                column: "PermissionId",
                principalTable: "tbl_permission",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_role_permission_tbl_role_RoleId",
                table: "tbl_role_permission",
                column: "RoleId",
                principalTable: "tbl_role",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_permission_PermissionId",
                table: "tbl_user_permission",
                column: "PermissionId",
                principalTable: "tbl_permission",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_permission_tbl_user_UserId",
                table: "tbl_user_permission",
                column: "UserId",
                principalTable: "tbl_user",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_role_RoleId",
                table: "tbl_user_role",
                column: "RoleId",
                principalTable: "tbl_role",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tbl_user_role_tbl_user_UserId",
                table: "tbl_user_role",
                column: "UserId",
                principalTable: "tbl_user",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
