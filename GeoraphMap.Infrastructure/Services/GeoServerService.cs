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
            int poiCount = await _context.Pois.CountAsync(p => !p.IsDeleted && p.IsActive);

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
                    new { name = $"{_workspace}:tbl_city", title = "City Boundary Layer (İl Sınırları Katmanı)", type = "MultiPolygon", featureCount = cityCount },
                    new { name = $"{_workspace}:tbl_poi", title = "POI Layer (İlgi Noktaları Katmanı)", type = "Geometry", featureCount = poiCount }
                },
                supportedProtocols = new[] { "WMS 1.1.1 / 1.3.0", "WFS 1.0.0 / 2.0.0", "WFS-T (Transaction)" }
            };
        }

        public async Task<string> GetPoiSldStyleAsync()
        {
            var categories = await _context.PoiCategories
                .Where(c => !c.IsDeleted && c.IsActive)
                .ToListAsync();

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
            sb.AppendLine("<StyledLayerDescriptor version=\"1.0.0\" xsi:schemaLocation=\"http://www.opengis.net/sld StyledLayerDescriptor.xsd\" xmlns=\"http://www.opengis.net/sld\" xmlns:ogc=\"http://www.opengis.net/ogc\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">");
            sb.AppendLine("  <NamedLayer>");
            sb.AppendLine("    <Name>tbl_poi</Name>");
            sb.AppendLine("    <UserStyle>");
            sb.AppendLine("      <Title>GeoMap Dynamic POI Style</Title>");
            sb.AppendLine("      <Abstract>Kategori bazlı renkler ve zoom seviyesine duyarlı POI etiketleme stili</Abstract>");
            sb.AppendLine("      <FeatureTypeStyle>");

            foreach (var cat in categories)
            {
                string hexColor = string.IsNullOrWhiteSpace(cat.Color) ? "#3b82f6" : cat.Color;
                string catNameLower = (cat.Name ?? "").ToLowerInvariant();
                string wellKnownName = "circle";
                if (catNameLower.Contains("sağlık") || catNameLower.Contains("saglik") || catNameLower.Contains("hastane") || catNameLower.Contains("eczane") || catNameLower.Contains("klinik"))
                {
                    wellKnownName = "cross";
                }
                else if (catNameLower.Contains("eğitim") || catNameLower.Contains("egitim") || catNameLower.Contains("okul") || catNameLower.Contains("kamu") || catNameLower.Contains("belediye") || catNameLower.Contains("kütüphane"))
                {
                    wellKnownName = "square";
                }
                else if (catNameLower.Contains("yeme") || catNameLower.Contains("restoran") || catNameLower.Contains("kafe") || catNameLower.Contains("ulaşım") || catNameLower.Contains("ulasim") || catNameLower.Contains("otogar"))
                {
                    wellKnownName = "triangle";
                }
                else if (catNameLower.Contains("park") || catNameLower.Contains("doğa") || catNameLower.Contains("doga") || catNameLower.Contains("eğlence") || catNameLower.Contains("eglence") || catNameLower.Contains("botanik"))
                {
                    wellKnownName = "star";
                }

                sb.AppendLine($"        <!-- Rule for Category: {cat.Name} (ID: {cat.Id}, Symbol: {wellKnownName}) -->");
                sb.AppendLine("        <Rule>");
                sb.AppendLine($"          <Name>Category_{cat.Id}</Name>");
                sb.AppendLine($"          <Title>{cat.Name}</Title>");
                sb.AppendLine("          <ogc:Filter>");
                sb.AppendLine("            <ogc:PropertyIsEqualTo>");
                sb.AppendLine("              <ogc:PropertyName>category_id</ogc:PropertyName>");
                sb.AppendLine($"              <ogc:Literal>{cat.Id}</ogc:Literal>");
                sb.AppendLine("            </ogc:PropertyIsEqualTo>");
                sb.AppendLine("          </ogc:Filter>");
                sb.AppendLine("          <PointSymbolizer>");
                sb.AppendLine("            <Graphic>");
                sb.AppendLine("              <Mark>");
                sb.AppendLine($"                <WellKnownName>{wellKnownName}</WellKnownName>");
                sb.AppendLine("                <Fill>");
                sb.AppendLine($"                  <CssParameter name=\"fill\">{hexColor}</CssParameter>");
                sb.AppendLine("                  <CssParameter name=\"fill-opacity\">0.9</CssParameter>");
                sb.AppendLine("                </Fill>");
                sb.AppendLine("                <Stroke>");
                sb.AppendLine("                  <CssParameter name=\"stroke\">#ffffff</CssParameter>");
                sb.AppendLine("                  <CssParameter name=\"stroke-width\">2</CssParameter>");
                sb.AppendLine("                </Stroke>");
                sb.AppendLine("              </Mark>");
                sb.AppendLine("              <Size>18</Size>");
                sb.AppendLine("            </Graphic>");
                sb.AppendLine("          </PointSymbolizer>");
                sb.AppendLine("          <PolygonSymbolizer>");
                sb.AppendLine("            <Fill>");
                sb.AppendLine($"              <CssParameter name=\"fill\">{hexColor}</CssParameter>");
                sb.AppendLine("              <CssParameter name=\"fill-opacity\">0.35</CssParameter>");
                sb.AppendLine("            </Fill>");
                sb.AppendLine("            <Stroke>");
                sb.AppendLine($"              <CssParameter name=\"stroke\">{hexColor}</CssParameter>");
                sb.AppendLine("              <CssParameter name=\"stroke-width\">2.5</CssParameter>");
                sb.AppendLine("            </Stroke>");
                sb.AppendLine("          </PolygonSymbolizer>");
                sb.AppendLine("        </Rule>");
            }

            // Zoom-dependent Text Labeling Rule (Zoom In >= Zoom Level ~14 / Scale Denominator <= 25000)
            sb.AppendLine("        <!-- Zoom-Dependent Label Rule: POI Names appear when zoomed in -->");
            sb.AppendLine("        <Rule>");
            sb.AppendLine("          <Name>ZoomDependent_PoiLabels</Name>");
            sb.AppendLine("          <Title>POI İsim Etiketleri</Title>");
            sb.AppendLine("          <MaxScaleDenominator>25000</MaxScaleDenominator>");
            sb.AppendLine("          <TextSymbolizer>");
            sb.AppendLine("            <Label>");
            sb.AppendLine("              <ogc:PropertyName>name</ogc:PropertyName>");
            sb.AppendLine("            </Label>");
            sb.AppendLine("            <Font>");
            sb.AppendLine("              <CssParameter name=\"font-family\">Inter, Arial, sans-serif</CssParameter>");
            sb.AppendLine("              <CssParameter name=\"font-size\">11</CssParameter>");
            sb.AppendLine("              <CssParameter name=\"font-weight\">bold</CssParameter>");
            sb.AppendLine("            </Font>");
            sb.AppendLine("            <LabelPlacement>");
            sb.AppendLine("              <PointPlacement>");
            sb.AppendLine("                <AnchorPoint>");
            sb.AppendLine("                  <AnchorPointX>0.5</AnchorPointX>");
            sb.AppendLine("                  <AnchorPointY>0.0</AnchorPointY>");
            sb.AppendLine("                </AnchorPoint>");
            sb.AppendLine("                <Displacement>");
            sb.AppendLine("                  <DisplacementX>0</DisplacementX>");
            sb.AppendLine("                  <DisplacementY>12</DisplacementY>");
            sb.AppendLine("                </Displacement>");
            sb.AppendLine("              </PointPlacement>");
            sb.AppendLine("            </LabelPlacement>");
            sb.AppendLine("            <Halo>");
            sb.AppendLine("              <Radius>2.5</Radius>");
            sb.AppendLine("              <Fill>");
            sb.AppendLine("                <CssParameter name=\"fill\">#0f172a</CssParameter>");
            sb.AppendLine("              </Fill>");
            sb.AppendLine("            </Halo>");
            sb.AppendLine("            <Fill>");
            sb.AppendLine("              <CssParameter name=\"fill\">#f8fafc</CssParameter>");
            sb.AppendLine("            </Fill>");
            sb.AppendLine("          </TextSymbolizer>");
            sb.AppendLine("        </Rule>");

            sb.AppendLine("      </FeatureTypeStyle>");
            sb.AppendLine("    </UserStyle>");
            sb.AppendLine("  </NamedLayer>");
            sb.AppendLine("</StyledLayerDescriptor>");

            return sb.ToString();
        }

        private async Task<string> BuildWfsGeoJsonFromDbAsync(string cleanLayer)
        {
            var featuresList = new List<object>();

            if (cleanLayer == "tbl_poi" || cleanLayer == "poi")
            {
                var dbPois = await _context.Pois
                    .Include(p => p.Category)
                    .Include(p => p.User)
                    .Where(p => !p.IsDeleted && p.IsActive)
                    .ToListAsync();

                foreach (var p in dbPois)
                {
                    try
                    {
                        string wkt = p.Wkt ?? "";
                        string defaultType = wkt.ToUpperInvariant().Contains("POLYGON") ? "Polygon" : "Point";
                        using var doc = JsonDocument.Parse(wkt.StartsWith("{") ? wkt : ConvertWktToJsonGeometry(wkt, defaultType));
                        featuresList.Add(new
                        {
                            type = "Feature",
                            id = $"tbl_poi.{p.Id}",
                            geometry = doc.RootElement.Clone(),
                            properties = new
                            {
                                id = p.Id,
                                name = p.Name,
                                description = p.Description,
                                category_id = p.CategoryId,
                                category_name = p.Category?.Name ?? "Genel",
                                category_color = p.Category?.Color ?? "#3b82f6",
                                category_icon = p.Category?.Icon ?? "pi pi-map-marker",
                                category_display_order = p.Category?.DisplayOrder ?? 1,
                                working_hours = p.WorkingHours,
                                user_id = p.UserId,
                                username = p.User?.Username ?? "Sistem",
                                created_date = p.CreatedDate
                            }
                        });
                    }
                    catch { }
                }
            }
            else if (cleanLayer == "tbl_point" || cleanLayer == "point")
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
