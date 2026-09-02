using System;

namespace GeoraphMap.Core
{
    public class UserFavoritePoi
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }

        public int PoiId { get; set; }
        public Poi? Poi { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
