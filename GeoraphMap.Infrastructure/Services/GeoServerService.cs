using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using GeoraphMap.Core;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace GeoraphMap.Infrastructure.Services
{
    public class GeoServerService : IGeoServerService
    {
        private readonly AppDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly string _geoServerBaseUrl;
        private readonly string _workspace;

        public GeoServerService(AppDbContext context, IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _context = context;
            _httpClient = httpClientFactory.CreateClient();
            _geoServerBaseUrl = configuration["GeoServer:BaseUrl"] ?? "http://localhost:8080/geoserver";
            _workspace = configuration["GeoServer:Workspace"] ?? "geomap";
        }

        public async Task<string> GetWfsFeatureGeoJsonAsync(string layerName)
        {
            string cleanLayer = layerName.Replace("geomap:", "").Trim().ToLower();
            string fullLayerName = $"{_workspace}:{cleanLayer}";

            // 1. Try fetching directly from GeoServer WFS Service
            try
            {
                string wfsUrl = $"{_geoServerBaseUrl}/{_workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName={fullLayerName}&outputFormat=application/json";
                var response = await _httpClient.GetAsync(wfsUrl);
                if (response.IsSuccessStatusCode)
                {
                    string content = await response.Content.ReadAsStringAsync();
                    if (!string.IsNullOrWhiteSpace(content) && content.Contains("FeatureCollection"))
                    {
                        return content;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GeoServerService] GeoServer WFS fetch warning ({fullLayerName}): {ex.Message}. Falling back to PostGIS database provider.");
            }

            // 2. Fallback: Build WFS-compliant GeoJSON from PostGIS database tables
            return await BuildWfsGeoJsonFromDbAsync(cleanLayer);
        }

        public async Task<byte[]> GetWmsMapImageAsync(string queryString)
        {
            try
            {
                string wmsUrl = $"{_geoServerBaseUrl}/{_workspace}/wms?{queryString}";
                var response = await _httpClient.GetAsync(wmsUrl);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsByteArrayAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GeoServerService] GeoServer WMS Image fetch warning: {ex.Message}");
            }

            return Array.Empty<byte>();
        }

        public async Task<string> GetCapabilitiesAsync()
        {
            try
            {
                string capUrl = $"{_geoServerBaseUrl}/{_workspace}/ows?service=WMS&version=1.3.0&request=GetCapabilities";
                var response = await _httpClient.GetAsync(capUrl);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GeoServerService] GetCapabilities warning: {ex.Message}");
            }

            return "<WMS_Capabilities version=\"1.3.0\"><Service><Name>GeoServer GeoMap Proxy</Name></Service></WMS_Capabilities>";
        }

        public async Task<object> GetGeoServerStatusAsync()
        {
            bool isGeoServerOnline = false;
            string version = "Unknown";
            try
            {
                var response = await _httpClient.GetAsync($"{_geoServerBaseUrl}/web/");
                isGeoServerOnline = response.IsSuccessStatusCode;
            }
            catch { }

            int pointCount = await _context.Points.CountAsync(p => !p.IsDeleted);
            int lineCount = await _context.Lines.CountAsync(l => !l.IsDeleted);
            int polygonCount = await _context.Polygons.CountAsync(p => !p.IsDeleted);
            int cityCount = await _context.Cities.CountAsync(c => !c.IsDeleted);

            return new
            {
                geoServerUrl = _geoServerBaseUrl,
                workspace = _workspace,
                isGeoServerOnline = isGeoServerOnline,
                activeLayers = new[]
                {
                    new { name = $"{_workspace}:tbl_point", title = "Point Layer (Nokta Katmanı)", type = "Point", featureCount = pointCount },
                    new { name = $"{_workspace}:tbl_line", title = "Line Layer (Çizgi Katmanı)", type = "LineString", featureCount = lineCount },
                    new { name = $"{_workspace}:tbl_polygon", title = "Polygon Layer (Poligon Katmanı)", type = "Polygon", featureCount = polygonCount },
                    new { name = $"{_workspace}:tbl_city", title = "City Boundary Layer (İl Sınırları Katmanı)", type = "MultiPolygon", featureCount = cityCount }
                },
                supportedProtocols = new[] { "WMS 1.1.1 / 1.3.0", "WFS 1.0.0 / 2.0.0", "WFS-T (Transaction)" }
            };
        }

        private async Task<string> BuildWfsGeoJsonFromDbAsync(string cleanLayer)
        {
            var featuresList = new List<object>();

            if (cleanLayer == "tbl_point" || cleanLayer == "point")
            {
                var dbPoints = await _context.Points.Where(p => !p.IsDeleted).ToListAsync();
                foreach (var p in dbPoints)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(p.Wkt.StartsWith("{") ? p.Wkt : ConvertWktToJsonGeometry(p.Wkt, "Point"));
                        featuresList.Add(new
                        {
                            type = "Feature",
                            id = $"tbl_point.{p.Id}",
                            geometry = doc.RootElement.Clone(),
                            properties = new { id = p.Id, name = p.Name, color = p.Color, inserted_user_id = p.InsertedUserId }
                        });
                    }
                    catch { }
                }
            }
            else if (cleanLayer == "tbl_line" || cleanLayer == "line")
            {
                var dbLines = await _context.Lines.Where(l => !l.IsDeleted).ToListAsync();
                foreach (var l in dbLines)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(l.Wkt.StartsWith("{") ? l.Wkt : ConvertWktToJsonGeometry(l.Wkt, "LineString"));
                        featuresList.Add(new
                        {
                            type = "Feature",
                            id = $"tbl_line.{l.Id}",
                            geometry = doc.RootElement.Clone(),
                            properties = new { id = l.Id, name = l.Name, color = l.Color, inserted_user_id = l.InsertedUserId }
                        });
                    }
                    catch { }
                }
            }
            else if (cleanLayer == "tbl_polygon" || cleanLayer == "polygon")
            {
                var dbPolys = await _context.Polygons.Where(p => !p.IsDeleted).ToListAsync();
                foreach (var p in dbPolys)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(p.Wkt.StartsWith("{") ? p.Wkt : ConvertWktToJsonGeometry(p.Wkt, "Polygon"));
                        featuresList.Add(new
                        {
                            type = "Feature",
                            id = $"tbl_polygon.{p.Id}",
                            geometry = doc.RootElement.Clone(),
                            properties = new { id = p.Id, name = p.Name, color = p.Color, inserted_user_id = p.InsertedUserId }
                        });
                    }
                    catch { }
                }
            }
            else if (cleanLayer == "tbl_city" || cleanLayer == "city")
            {
                var dbCities = await _context.Cities.Where(c => !c.IsDeleted).ToListAsync();
                foreach (var c in dbCities)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(ConvertWktToJsonGeometry(c.Wkt, "MultiPolygon"));
                        featuresList.Add(new
                        {
                            type = "Feature",
                            id = $"tbl_city.{c.Plate}",
                            geometry = doc.RootElement.Clone(),
                            properties = new { plate = c.Plate, name = c.Name, region = c.Region }
                        });
                    }
                    catch { }
                }
            }

            var geoJsonObj = new
            {
                type = "FeatureCollection",
                numberMatched = featuresList.Count,
                numberReturned = featuresList.Count,
                timeStamp = DateTime.UtcNow.ToString("o"),
                crs = new
                {
                    type = "name",
                    properties = new { name = "urn:ogc:def:crs:EPSG::4326" }
                },
                features = featuresList
            };

            return JsonSerializer.Serialize(geoJsonObj, new JsonSerializerOptions { WriteIndented = true });
        }

        private static string ConvertWktToJsonGeometry(string wkt, string defaultType)
        {
            if (string.IsNullOrWhiteSpace(wkt)) return "{\"type\":\"Point\",\"coordinates\":[35.0,39.0]}";
            if (wkt.Trim().StartsWith("{")) return wkt;

            try
            {
                var reader = new NetTopologySuite.IO.WKTReader();
                var geom = reader.Read(wkt);
                if (geom is NetTopologySuite.Geometries.Point pt)
                {
                    return JsonSerializer.Serialize(new { type = "Point", coordinates = new[] { pt.X, pt.Y } });
                }
                else if (geom is NetTopologySuite.Geometries.LineString line)
                {
                    var coords = line.Coordinates.Select(c => new[] { c.X, c.Y }).ToArray();
                    return JsonSerializer.Serialize(new { type = "LineString", coordinates = coords });
                }
                else if (geom is NetTopologySuite.Geometries.Polygon poly)
                {
                    var extRing = poly.ExteriorRing.Coordinates.Select(c => new[] { c.X, c.Y }).ToArray();
                    return JsonSerializer.Serialize(new { type = "Polygon", coordinates = new[] { extRing } });
                }
                else if (geom is NetTopologySuite.Geometries.MultiPolygon multiPoly)
                {
                    var polyList = new List<double[][][]>();
                    for (int i = 0; i < multiPoly.NumGeometries; i++)
                    {
                        if (multiPoly.GetGeometryN(i) is NetTopologySuite.Geometries.Polygon p)
                        {
                            var extRing = p.ExteriorRing.Coordinates.Select(c => new[] { c.X, c.Y }).ToArray();
                            polyList.Add(new[] { extRing });
                        }
                    }
                    return JsonSerializer.Serialize(new { type = "MultiPolygon", coordinates = polyList });
                }
            }
            catch { }

            return "{\"type\":\"Point\",\"coordinates\":[35.0,39.0]}";
        }
    }
}
