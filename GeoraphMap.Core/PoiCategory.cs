using System;
using System.Collections.Generic;

namespace GeoraphMap.Core
{
    public class PoiCategory
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; } = "fa-map-pin";
        public string? Color { get; set; } = "#3b82f6";
        
        // Hiyerarşik Parent-Child İlişkisi
        public int? ParentId { get; set; }
        public PoiCategory? Parent { get; set; }
        public ICollection<PoiCategory> Children { get; set; } = new List<PoiCategory>();

        public ICollection<Poi> Pois { get; set; } = new List<Poi>();

        public int DisplayOrder { get; set; } = 1; // 1: Çok Yüksek (En Üstte), 5: Detay

        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    }
}
