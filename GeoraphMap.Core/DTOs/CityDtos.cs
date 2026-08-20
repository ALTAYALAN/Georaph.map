using System;
using System.Collections.Generic;

namespace GeoraphMap.Core.DTOs
{
    public class CityDto
    {
        public int Id { get; set; }
        public int Plate { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
    }

    public class CreateCityDto
    {
        public int Plate { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
    }

    public class UpdateCityDto
    {
        public int Plate { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Wkt { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
    }

    public class BulkSaveCitiesDto
    {
        public List<CityDto> Cities { get; set; } = new();
    }
}
