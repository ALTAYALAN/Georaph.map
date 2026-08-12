using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTblPlace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Places",
                table: "Places");

            migrationBuilder.RenameTable(
                name: "Places",
                newName: "tbl_place");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "tbl_place",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "tbl_place",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ModifiedDate",
                table: "tbl_place",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Wkt",
                table: "tbl_place",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddPrimaryKey(
                name: "PK_tbl_place",
                table: "tbl_place",
                column: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_tbl_place",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "ModifiedDate",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "Wkt",
                table: "tbl_place");

            migrationBuilder.RenameTable(
                name: "tbl_place",
                newName: "Places");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Places",
                table: "Places",
                column: "Id");
        }
    }
}
