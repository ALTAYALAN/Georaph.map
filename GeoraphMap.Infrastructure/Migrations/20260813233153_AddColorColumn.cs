using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoraphMap.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddColorColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "tbl_polygon",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "tbl_point",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "tbl_place",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "tbl_line",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "tbl_polygon");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "tbl_point");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "tbl_place");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "tbl_line");
        }
    }
}
