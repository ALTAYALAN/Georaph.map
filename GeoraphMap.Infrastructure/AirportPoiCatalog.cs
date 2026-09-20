using System.Text.Json;
using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace GeoraphMap.Infrastructure;

public static class AirportPoiCatalog
{
    public static async Task EnsureAsync(AppDbContext db)
    {
        using var stream = typeof(AirportPoiCatalog).Assembly.GetManifestResourceStream("GeoMap.airports.json")!;
        using var catalog = await JsonDocument.ParseAsync(stream);
        var category = await db.PoiCategories.FirstAsync(c => !c.IsDeleted && c.Name == "Havalimanı & Uçuş"
            || !c.IsDeleted && (c.Name == "Havalimanı" || c.Name == "Havalimanları" || c.Name == "Havalimanı & Havaalanı"));
        var owner = await db.Users.Where(u => !u.IsDeleted && u.IsActive && u.UserRoles.Any(r => r.Role.Name == "Admin"))
            .OrderBy(u => u.Id).Select(u => (int?)u.Id).FirstOrDefaultAsync();
        if (owner == null) return;
        // Include deleted records so a user's deletion is never undone at startup.
        var pois = await db.Pois.ToListAsync();
        foreach (var airport in catalog.RootElement.EnumerateArray())
        {
            var code = airport.GetProperty("iata").GetString()!;
            var name = airport.GetProperty("name").GetString()!;
            if (pois.Any(p => p.AirportCode == code)) continue;
            var existing = pois.FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (existing != null) { existing.AirportCode = code; continue; }
            var coords = airport.GetProperty("coordinates");
            var point = new Point(coords[0].GetDouble(), coords[1].GetDouble()) { SRID = 4326 };
            var poi = new Poi {
                AirportCode = code, Name = name, CategoryId = category.Id, UserId = owner.Value,
                Description = $"{airport.GetProperty("type").GetString()} • {airport.GetProperty("runways").GetString()} • IATA: {code} • ICAO: {airport.GetProperty("icao").GetString()} • {airport.GetProperty("description").GetString()}",
                WorkingHours = "7/24 Açık (24 Saat Kesintisiz Uçuş)",
                ImageUrl = airport.GetProperty("imageUrl").GetString(), Geometry = point, Wkt = point.AsText()
            };
            db.Pois.Add(poi);
            pois.Add(poi);
        }
        await db.SaveChangesAsync();
    }
}
