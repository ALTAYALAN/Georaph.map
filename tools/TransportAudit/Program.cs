using System.Text.Json;
using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using GeoraphMap.Infrastructure;
using GeoraphMap.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

try
{
// Run from the repository root. No credentials are written to reports.
using var settings = JsonDocument.Parse(File.ReadAllText("GeoraphMap.API/appsettings.json"));
var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? settings.RootElement.GetProperty("ConnectionStrings").GetProperty("DefaultConnection").GetString();
var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection, o => o.UseNetTopologySuite()).Options;
await using var db = new AppDbContext(options);
if (args.Contains("--poi-test") || args.Contains("--airports"))
{
    await using var tx = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE tbl_poi ADD COLUMN IF NOT EXISTS airport_code TEXT; CREATE UNIQUE INDEX IF NOT EXISTS ix_poi_airport_code ON tbl_poi(airport_code) WHERE airport_code IS NOT NULL;");
    await PoiCategoryCatalog.EnsureAsync(db);
    await AirportPoiCatalog.EnsureAsync(db);
    var count = await db.Pois.CountAsync(p => p.AirportCode != null);
    await AirportPoiCatalog.EnsureAsync(db);
    if (count != await db.Pois.CountAsync(p => p.AirportCode != null)) throw new Exception("Duplicate airport seed");
    if (args.Contains("--airports"))
    {
        await tx.CommitAsync();
        Console.WriteLine($"Persisted {count} airport POIs with IATA codes.");
        return;
    }
    var airport = await db.Pois.FirstAsync(p => p.AirportCode == "ESB");
    var service = new PoiService(db);
    var dto = new UpdatePoiDto { Name = "Test renamed airport", CategoryId = airport.CategoryId, Wkt = "POINT(33 40)", IsActive = true };
    var updated = await service.UpdatePoiAsync(airport.Id, dto, airport.UserId, "Admin");
    if (updated?.AirportCode != "ESB" || updated.Name != dto.Name || updated.Longitude != 33 || updated.Latitude != 40)
        throw new Exception("Airport edit failed");
    await AirportPoiCatalog.EnsureAsync(db);
    if (await db.Pois.CountAsync(p => p.AirportCode != null) != count || airport.Name != dto.Name) throw new Exception("Seed overwrote edit");
    dto.Wkt = "broken WKT";
    try { await service.UpdatePoiAsync(airport.Id, dto, airport.UserId, "Admin"); throw new Exception("Invalid WKT accepted"); }
    catch (ArgumentException) { }
    dto.Wkt = "POINT(33 40)"; dto.CategoryId = int.MaxValue;
    try { await service.UpdatePoiAsync(airport.Id, dto, airport.UserId, "Admin"); throw new Exception("Invalid category accepted"); }
    catch (ArgumentException) { }
    await service.DeletePoiAsync(airport.Id, airport.UserId, "Admin");
    await AirportPoiCatalog.EnsureAsync(db);
    if (!airport.IsDeleted || await db.Pois.CountAsync(p => p.AirportCode != null) != count) throw new Exception("Deleted airport resurrected");
    await tx.RollbackAsync();
    Console.WriteLine($"PASS: {count} airport codes; edit, move, idempotent seed, preserved edits/deletion, invalid WKT/category. All test writes rolled back.");
    return;
}
if (args.Contains("--access"))
{
    var admins = await db.Users.Where(u => !u.IsDeleted && u.Username.ToLower().Contains("admin"))
        .Select(u => new { u.Username, u.IsActive, Roles = u.UserRoles.Select(ur => ur.Role.Name).ToList() }).ToListAsync();
    Console.WriteLine(JsonSerializer.Serialize(admins));
    var users = await new UserService(db).GetAllUsersAsync();
    var roles = await db.Roles.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission).Include(r => r.UserRoles).ToListAsync();
    Console.WriteLine($"User list query: {users.Count} records; role list query: {roles.Count} records.");
    return;
}
var stops = await db.Stops.Where(s => !s.IsDeleted).Include(s => s.Route).Include(s => s.RouteStops).ThenInclude(j => j.Route).ToListAsync();
IEnumerable<RouteFeature> Routes(StopFeature s) => s.RouteStops.Where(j => j.Route != null && !j.Route.IsDeleted).Select(j => j.Route!)
    .Concat(s.Route is { IsDeleted: false } ? new[] { s.Route } : Array.Empty<RouteFeature>()).DistinctBy(r => r.Id);
var errors = stops.SelectMany(s => Routes(s).Where(r => !TransportService.AreClassesCompatible(s.StopClass, r.RouteClass))
    .Select(r => new { stopId = s.Id, s.Name, s.StopClass, routeId = r.Id, r.RouteClass })).ToList();
Console.WriteLine($"Audit: {stops.Count} stops, {await db.Routes.CountAsync(r => !r.IsDeleted)} routes, {errors.Count} incompatible links.");
Directory.CreateDirectory("transport-audit");
var sharedRecord = stops.FirstOrDefault(s => s.Id == 224);
if (sharedRecord != null) Console.WriteLine($"Shared 224 class={sharedRecord.StopClass}, route IDs={string.Join(',', Routes(sharedRecord).Select(r => $"{r.Id}:{r.RouteClass}"))}");
var metro = await db.Routes.Where(r => !r.IsDeleted && r.RouteClass == "metro").ToListAsync();
await File.WriteAllTextAsync("transport-audit/metro-current.json", JsonSerializer.Serialize(metro.Select(r => new { r.Id, r.Name, r.Wkt, r.CustomWkt, r.PreviousWkt, r.GeometryType }), new JsonSerializerOptions { WriteIndented = true }));
if (args.Contains("--categories"))
{
    await PoiCategoryCatalog.EnsureAsync(db);
    Console.WriteLine("POI categories ensured.");
}
if (args.Contains("--restore-metro"))
{
    // These three current shapes were verified as six-sample generated splines.
    // The M2 route (5) is already manually edited and must remain untouched.
    await File.WriteAllTextAsync($"transport-audit/metro-before-restore-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json",
        JsonSerializer.Serialize(metro.Select(r => new { r.Id, r.Wkt, r.CustomWkt, r.PreviousWkt, r.GeometryType })));
    await using var tx = await db.Database.BeginTransactionAsync();
    foreach (var route in metro.Where(r => new[] { 1, 77, 78 }.Contains(r.Id)))
    {
        if (!IsGeneratedSpline(route.Wkt)) { Console.WriteLine($"Kept manual route {route.Id}"); continue; }
        if (string.IsNullOrWhiteSpace(route.PreviousWkt) || IsGeneratedSpline(route.PreviousWkt))
            throw new Exception($"No verified manual backup for route {route.Id}");
        var geometry = new NetTopologySuite.IO.WKTReader().Read(route.PreviousWkt);
        if (geometry is not LineString || geometry.IsEmpty) throw new Exception("Invalid backup geometry");
        geometry.SRID = 4326;
        var current = route.Wkt;
        route.Wkt = route.PreviousWkt;
        route.CustomWkt = route.Wkt;
        route.PreviousWkt = current;
        route.Geometry = geometry;
        route.GeometryType = "Custom";
        route.ModifiedDate = DateTime.UtcNow;
        Console.WriteLine($"Restored manual geometry for {route.Id}: {route.Name}");
    }
    await db.SaveChangesAsync();
    await tx.CommitAsync();
}
await File.WriteAllTextAsync("transport-audit/incompatible-links.json", JsonSerializer.Serialize(errors, new JsonSerializerOptions { WriteIndented = true }));

if (args.Contains("--repair"))
{
    var known = new HashSet<int> { 372, 384, 320, 321, 225, 265, 248 };
    if (errors.Any(e => !known.Contains(e.stopId))) throw new Exception("Unreviewed mismatch: inspect audit report before repair.");
    var affected = stops.Where(s => errors.Any(e => e.stopId == s.Id)
        || (s.Id is 372 or 384 && TransportService.NormalizeClass(s.StopClass) != "otobus")
        || (s.Id is 320 or 321 && TransportService.NormalizeClass(s.StopClass) != "havayolu")).ToList();
    var backup = affected.Select(s => new { s.Id, s.Name, s.StopClass, s.StopCode, s.Wkt, s.RouteId, s.OrderIndex,
        links = s.RouteStops.Select(j => new { j.Id, j.RouteId, j.OrderIndex }).ToArray() }).ToList();
    await File.WriteAllTextAsync($"transport-audit/before-repair-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json", JsonSerializer.Serialize(backup, new JsonSerializerOptions { WriteIndented = true }));
    await using var tx = await db.Database.BeginTransactionAsync();
    foreach (var s in affected)
    {
        var routes = Routes(s).ToList();
        if (s.Id is 372 or 384 or 320 or 321)
        {
            var expected = s.Id is 372 or 384 ? "otobus" : "havayolu";
            if (routes.Any(r => !TransportService.AreClassesCompatible(r.RouteClass, expected))) throw new Exception("Unexpected links on known mislabeled stop.");
            s.StopClass = expected;
            if (s.Id == 320) s.StopCode = "ESB";
            if (s.Id == 321) s.StopCode = "IST";
            if (s.Id is 372 or 384 && (s.StopCode ?? "").StartsWith("PORT-")) s.StopCode = null;
            s.ModifiedDate = DateTime.UtcNow;
            Console.WriteLine($"Corrected {s.Id}: {s.Name} -> {expected}");
        }
        else
        {
            // Keep the rail record and make a separate metro platform at the same location.
            if (TransportService.NormalizeClass(s.StopClass) != "tren") throw new Exception("Unexpected transfer type.");
            var incompatible = routes.Where(r => !TransportService.AreClassesCompatible(s.StopClass, r.RouteClass)).ToList();
            if (incompatible.Any(r => TransportService.NormalizeClass(r.RouteClass) != "metro")) throw new Exception("Unexpected transfer route.");
            var clone = new StopFeature { Name = s.Name + " (Metro)", StopClass = "metro", StopCode = $"METRO-XFER-{s.Id}",
                Wkt = s.Wkt, Geometry = s.Geometry == null ? null : (Point)s.Geometry.Copy(), Description = s.Description,
                IsActive = s.IsActive, RouteId = incompatible.First().Id,
                OrderIndex = s.RouteStops.FirstOrDefault(j => j.RouteId == incompatible.First().Id)?.OrderIndex ?? s.OrderIndex };
            db.Stops.Add(clone);
            foreach (var route in incompatible)
            {
                var links = s.RouteStops.Where(j => j.RouteId == route.Id).ToList();
                if (links.Count == 0) db.RouteStops.Add(new RouteStopFeature { Stop = clone, RouteId = route.Id, OrderIndex = s.OrderIndex });
                foreach (var link in links) link.Stop = clone;
            }
            if (s.RouteId.HasValue && incompatible.Any(r => r.Id == s.RouteId))
            {
                var retained = routes.FirstOrDefault(r => TransportService.AreClassesCompatible(s.StopClass, r.RouteClass));
                s.RouteId = retained?.Id;
                s.OrderIndex = s.RouteStops.FirstOrDefault(j => j.RouteId == retained?.Id)?.OrderIndex ?? 1;
            }
            s.ModifiedDate = DateTime.UtcNow;
            Console.WriteLine($"Separated metro platform from rail stop {s.Id}: {s.Name}");
        }
    }
    await db.SaveChangesAsync();
    await tx.CommitAsync();
    Console.WriteLine("Repair committed; run audit again to verify.");
}

if (args.Contains("--test"))
{
    db.ChangeTracker.Clear();
    await using var tx = await db.Database.BeginTransactionAsync();
    var service = new TransportService(db, new NoNetworkRouting());
    async Task Reject(Func<Task> action, string label)
    {
        try { await action(); } catch (ArgumentException) { db.ChangeTracker.Clear(); Console.WriteLine("PASS " + label); return; }
        throw new Exception("Expected rejection: " + label);
    }
    await Reject(async () => { await service.CreateStopAsync(new CreateStopDto { Name = "test", StopClass = "otobus", RouteIds = new() { 5 } }); }, "cross-type create");
    await Reject(async () => { await service.UpdateStopAsync(224, new UpdateStopDto { StopClass = "otobus" }); }, "cross-type stop edit");
    await Reject(async () => { await service.UpdateRouteAsync(5, new UpdateRouteDto { RouteClass = "otobus" }); }, "cross-type route edit");
    await Reject(async () => { await service.ReorderStopsAsync(5, new() { 224, 372 }); }, "foreign stop in reorder");
    await Reject(async () => { await service.ReorderStopsAsync(5, new() { 224, 224 }); }, "duplicate stop in reorder");
    await Reject(async () => { await service.UpdateStopAsync(224, new UpdateStopDto { Wkt = "LINESTRING(0 0,1 1)" }); }, "invalid stop geometry");
    await Reject(async () => { await service.ConvertStopsToBusByCodesOrIdsAsync(new() { "224" }); }, "unsafe bulk conversion");
    var shared = await service.GetStopByIdAsync(224) ?? throw new Exception("Shared stop missing");
    var beforeShapes = await db.Routes.Where(r => shared.RouteIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Wkt);
    var lon = shared.Longitude!.Value + 0.001;
    var lat = shared.Latitude!.Value + 0.001;
    var wkt = FormattableString.Invariant($"POINT({lon} {lat})");
    await service.UpdateStopAsync(224, new UpdateStopDto { Wkt = wkt });
    foreach (var routeId in shared.RouteIds)
    {
        var route = await db.Routes.FindAsync(routeId);
        if (route?.Geometry == null || !route.Geometry.Coordinates.Any(c => Math.Abs(c.X - lon) < 0.000002 && Math.Abs(c.Y - lat) < 0.000002))
            throw new Exception($"Shared route {routeId} did not move");
        var oldCoordinates = new NetTopologySuite.IO.WKTReader().Read(beforeShapes[routeId]).Coordinates;
        if (route.Geometry.Coordinates.Length < oldCoordinates.Length || route.Geometry.Coordinates.Length > oldCoordinates.Length + 1
            || oldCoordinates.Count(c => !route.Geometry.Coordinates.Any(n => n.Equals2D(c))) > 1)
            throw new Exception($"Manual route {routeId} changed beyond the stop anchor");
    }
    Console.WriteLine($"PASS shared stop move updated all {shared.RouteIds.Count} routes");
    await tx.RollbackAsync();
    Console.WriteLine("Tests rolled back; no test coordinates retained.");
}

}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    Environment.ExitCode = 1;
}

static bool IsGeneratedSpline(string? wkt)
{
    if (string.IsNullOrWhiteSpace(wkt)) return false;
    var geometry = new NetTopologySuite.IO.WKTReader().Read(wkt);
    var c = geometry.Coordinates;
    if (c.Length < 13 || (c.Length - 1) % 6 != 0) return false;
    var knots = c.Where((_, i) => i % 6 == 0).ToArray();
    for (var i = 0; i < knots.Length - 1; i++)
    {
        var p0 = knots[Math.Max(0, i - 1)]; var p1 = knots[i];
        var p2 = knots[i + 1]; var p3 = knots[Math.Min(knots.Length - 1, i + 2)];
        for (var step = 0; step < 6; step++)
        {
            double t = step / 6.0, t2 = t*t, t3 = t2*t;
            double F(double a, double b, double d, double e) => .5 * (2*b + (-a+d)*t + (2*a-5*b+4*d-e)*t2 + (-a+3*b-3*d+e)*t3);
            if (Math.Abs(c[i*6+step].X - F(p0.X,p1.X,p2.X,p3.X)) > 0.0000015 || Math.Abs(c[i*6+step].Y - F(p0.Y,p1.Y,p2.Y,p3.Y)) > 0.0000015) return false;
        }
    }
    return true;
}
sealed class NoNetworkRouting : IOsrmRoutingService
{
    public Task<OsrmRouteResult> CalculateRouteAsync(List<(double Longitude, double Latitude)> coordinates, string profile = "driving")
        => Task.FromResult(new OsrmRouteResult { Success = false });
}
