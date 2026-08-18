using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackingColumnsToDrawings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "InsertedDate",
                table: "tbl_polygon",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "InsertedUserId",
                table: "tbl_polygon",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "InsertedDate",
                table: "tbl_point",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "InsertedUserId",
                table: "tbl_point",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "InsertedDate",
                table: "tbl_place",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "InsertedUserId",
                table: "tbl_place",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "InsertedDate",
                table: "tbl_line",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "InsertedUserId",
                table: "tbl_line",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InsertedDate",
                table: "tbl_polygon");

            migrationBuilder.DropColumn(
                name: "InsertedUserId",
                table: "tbl_polygon");

            migrationBuilder.DropColumn(
                name: "InsertedDate",
                table: "tbl_point");

            migrationBuilder.DropColumn(
                name: "InsertedUserId",
                table: "tbl_point");

            migrationBuilder.DropColumn(
                name: "InsertedDate",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "InsertedUserId",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "InsertedDate",
                table: "tbl_line");

            migrationBuilder.DropColumn(
                name: "InsertedUserId",
                table: "tbl_line");
        }
    }
}
