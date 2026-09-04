using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    // POI Kategori DTO'ları
    public class CreatePoiCategoryDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; } = "fa-map-pin";
        public string? Color { get; set; } = "#3b82f6";
        public int? ParentId { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsActive { get; set; } = true;
    }

    public class UpdatePoiCategoryDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public int? ParentId { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsActive { get; set; } = true;
    }

    public class PoiCategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public int? ParentId { get; set; }
        public string? ParentName { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsActive { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedDate { get; set; }
        public int PoiCount { get; set; }
    }

    public class PoiCategoryTreeDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public int? ParentId { get; set; }
        public int DisplayOrder { get; set; } = 1;
        public bool IsActive { get; set; }
        public int PoiCount { get; set; }
        public List<PoiCategoryTreeDto> Children { get; set; } = new List<PoiCategoryTreeDto>();
    }

    // POI (Point of Interest) DTO'ları
    public class CreatePoiDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int CategoryId { get; set; }
        public string? WorkingHours { get; set; }
        public string? ImageUrl { get; set; }
        public string Wkt { get; set; } = string.Empty; // Format: POINT(lon lat)
    }

    public class UpdatePoiDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int CategoryId { get; set; }
        public string? WorkingHours { get; set; }
        public string? ImageUrl { get; set; }
        public string? Wkt { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class PoiDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string? ParentCategoryName { get; set; }
        public string? CategoryColor { get; set; }
        public string? CategoryIcon { get; set; }
        public int CategoryDisplayOrder { get; set; } = 1;
        public string? WorkingHours { get; set; }
        public string? ImageUrl { get; set; }
        public string Wkt { get; set; } = string.Empty;
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime ModifiedDate { get; set; }
    }
}
