using GeoraphMap.Core;
using Microsoft.EntityFrameworkCore;

namespace GeoraphMap.Infrastructure;

public static class PoiCategoryCatalog
{
    public static async Task EnsureAsync(AppDbContext db)
    {
        var existing = await db.PoiCategories.Where(c => !c.IsDeleted).ToListAsync();
        var entries = new[] {
            (Name: "Havalimanı & Uçuş", Icon: "plane", Color: "#0284c7", Parent: "Ulaşım", Aliases: new[] { "Havalimanı", "Havalimanları", "Havalimanı & Havaalanı" }),
            (Name: "Liman & İskele", Icon: "anchor", Color: "#0891b2", Parent: "Ulaşım", Aliases: new[] { "Liman", "Deniz Limanı & Marina", "Liman & Marina" }),
            (Name: "Benzinlik", Icon: "gas-pump", Color: "#ea580c", Parent: "Ulaşım", Aliases: new[] { "Akaryakıt", "Akaryakıt İstasyonu", "Benzin İstasyonu" }),
            (Name: "Şehir Simgesi", Icon: "city-landmark", Color: "#7c3aed", Parent: "Kültür & Turizm", Aliases: new[] { "Şehir simgesi", "Kent Simgesi" }),
            (Name: "Askeri Alan", Icon: "military-area", Color: "#4d7c0f", Parent: "Kamu & Hizmet", Aliases: new[] { "Askerî Alan", "Askeri Tesis" }),
            (Name: "Standart POI", Icon: "map-pin", Color: "#2563eb", Parent: "", Aliases: new[] { "Genel POI", "Genel İlgi Noktası" })
        };
        foreach (var entry in entries)
        {
            if (existing.Any(c => c.Name.Equals(entry.Name, StringComparison.OrdinalIgnoreCase)
                || entry.Aliases.Any(alias => alias.Equals(c.Name, StringComparison.OrdinalIgnoreCase)))) continue;
            var category = new PoiCategory { Name = entry.Name, Icon = entry.Icon, Color = entry.Color,
                ParentId = existing.FirstOrDefault(c => c.Name == entry.Parent)?.Id, DisplayOrder = 3 };
            db.PoiCategories.Add(category);
            existing.Add(category);
        }
        await db.SaveChangesAsync();
    }
}
