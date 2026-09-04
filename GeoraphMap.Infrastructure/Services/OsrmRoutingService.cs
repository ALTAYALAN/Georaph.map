using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;

namespace GeoraphMap.Infrastructure.Services
{
    public class OsrmRoutingService : IOsrmRoutingService
    {
        private readonly HttpClient _httpClient;
        private const string LocalOsrmUrl = "http://localhost:5000";
        private const string PublicOsrmUrl1 = "https://router.project-osrm.org";
        private const string PublicOsrmCar = "https://routing.openstreetmap.de/routed-car";
        private const string PublicOsrmFoot = "https://routing.openstreetmap.de/routed-foot";
        private const string PublicOsrmBike = "https://routing.openstreetmap.de/routed-bike";

        public OsrmRoutingService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public async Task<OsrmRouteResult> CalculateRouteAsync(List<(double Longitude, double Latitude)> coordinates, string profile = "driving")
        {
            if (coordinates == null || coordinates.Count < 2)
            {
                return new OsrmRouteResult
                {
                    Success = false,
                    ErrorMessage = "Rota hesaplamak için en az 2 geçerli durak koordinatı gereklidir."
                };
            }

            // Normalize profile key: "driving", "walking", "cycling"
            profile = (profile ?? "driving").ToLower().Trim();
            if (profile is "foot" or "pedestrian" or "yuruyus" or "yürüyüş") profile = "walking";
            else if (profile is "bike" or "bicycle" or "bisiklet") profile = "cycling";
            else if (profile is "car" or "araba" or "drive") profile = "driving";

            // Koordinatları EPSG:4326 (WGS84 Lon, Lat) formatına normalize et
            var normalizedCoords = new List<(double Longitude, double Latitude)>();
            foreach (var c in coordinates)
            {
                double lon = c.Longitude;
                double lat = c.Latitude;

                // Eğer koordinatlar EPSG:3857 (metre) cinsindeyse EPSG:4326'ya çevir
                if (Math.Abs(lon) > 180 || Math.Abs(lat) > 90)
                {
                    lon = (lon / 20037508.34) * 180.0;
                    lat = (lat / 20037508.34) * 180.0;
                    lat = 180.0 / Math.PI * (2.0 * Math.Atan(Math.Exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
                }

                // Türkiye koordinat kontrolü (Lat: 35-43, Lon: 25-45). Eğer ters girilmişse düzelt
                if (lon >= 35.0 && lon <= 43.0 && lat >= 25.0 && lat <= 35.0)
                {
                    var tmp = lon;
                    lon = lat;
                    lat = tmp;
                }

                normalizedCoords.Add((lon, lat));
            }

            // OSRM koordinat formatı: {lon1},{lat1};{lon2},{lat2};{lon3},{lat3}...
            string osrmProfileSegment = profile switch
            {
                "walking" => "driving",
                "cycling" => "driving",
                _ => "driving"
            };

            // Hedef profil için özel OpenStreetMap endpoint'leri
            var baseUrls = new List<string>
            {
                profile switch
                {
                    "walking" => PublicOsrmFoot,
                    "cycling" => PublicOsrmBike,
                    _ => PublicOsrmCar
                },
                PublicOsrmUrl1
            };

            // 1. Önce tüm rotayı tek seferde OSRM'den çekmeyi dene
            var coordsParam = string.Join(";", normalizedCoords.Select(c =>
                $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)},{c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}"));

            var queryOptions = new[]
            {
                $"/route/v1/{osrmProfileSegment}/{coordsParam}?overview=full&geometries=geojson&steps=true",
                $"/route/v1/{osrmProfileSegment}/{coordsParam}?overview=full&geometries=geojson"
            };

            foreach (var baseUrl in baseUrls)
            {
                foreach (var qPath in queryOptions)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}{qPath}");
                        req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                        req.Headers.Add("Accept", "application/json");

                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            var content = await res.Content.ReadAsStringAsync();
                            var parsed = ParseOsrmResponse(content, profile);
                            if (parsed.Success) return parsed;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[OsrmRoutingService] Single request error on {baseUrl}: {ex.Message}");
                    }
                }
            }

            // 2. Eğer rota uzunsa (>25 durak) ve tek seferde alınamadıysa parçalı (chunked) OSRM hesaplaması yap
            if (normalizedCoords.Count > 20)
            {
                try
                {
                    var chunkedResult = await CalculateChunkedRouteAsync(normalizedCoords, profile, baseUrls, osrmProfileSegment);
                    if (chunkedResult.Success) return chunkedResult;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[OsrmRoutingService] Chunked calculation error: {ex.Message}");
                }
            }

            // 3. Fallback doğrudan LineString WKT üret
            var fallbackLinePairs = normalizedCoords.Select(c =>
                $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}");
            string directLineWkt = $"LINESTRING({string.Join(", ", fallbackLinePairs)})";

            double approxMeters = CalculateEuclideanMeters(normalizedCoords);
            double calculatedDuration = CalculateSpeedDuration(approxMeters, profile);

            return new OsrmRouteResult
            {
                Success = true,
                Wkt = directLineWkt,
                DistanceMeters = approxMeters,
                DurationSeconds = calculatedDuration,
                Summary = profile == "walking" ? "Yaya Yolu (Kuş Uçuşu Bağlantı)" : "Doğrudan Hat (Kuş Uçuşu Bağlantı)",
                Steps = GenerateBasicSteps(approxMeters, profile)
            };
        }

        private async Task<OsrmRouteResult> CalculateChunkedRouteAsync(
            List<(double Longitude, double Latitude)> coords,
            string profile,
            List<string> baseUrls,
            string osrmProfileSegment)
        {
            const int chunkSize = 30;
            var allCoordPairs = new List<string>();
            double totalDistance = 0;
            double totalDuration = 0;
            var allSteps = new List<RouteStepDto>();

            for (int i = 0; i < coords.Count - 1; i += (chunkSize - 1))
            {
                var chunk = coords.Skip(i).Take(chunkSize).ToList();
                if (chunk.Count < 2) break;

                var chunkParam = string.Join(";", chunk.Select(c =>
                    $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)},{c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}"));

                var chunkPath = $"/route/v1/{osrmProfileSegment}/{chunkParam}?overview=full&geometries=geojson";
                bool chunkDone = false;

                foreach (var baseUrl in baseUrls)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}{chunkPath}");
                        req.Headers.Add("User-Agent", "GeoMap-App/1.0");
                        req.Headers.Add("Accept", "application/json");

                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            var content = await res.Content.ReadAsStringAsync();
                            var parsed = ParseOsrmResponse(content, profile);
                            if (parsed.Success && !string.IsNullOrWhiteSpace(parsed.Wkt))
                            {
                                totalDistance += parsed.DistanceMeters;
                                totalDuration += parsed.DurationSeconds;
                                if (parsed.Steps != null) allSteps.AddRange(parsed.Steps);

                                // LINESTRING(x y, x y) içerisindeki koordinatları ayıkla
                                var cleanWkt = parsed.Wkt.Trim();
                                if (cleanWkt.StartsWith("LINESTRING(", StringComparison.OrdinalIgnoreCase) && cleanWkt.EndsWith(")"))
                                {
                                    var inside = cleanWkt.Substring(11, cleanWkt.Length - 12);
                                    var parts = inside.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                                    foreach (var p in parts)
                                    {
                                        var trimmed = p.Trim();
                                        if (allCoordPairs.Count == 0 || allCoordPairs.Last() != trimmed)
                                        {
                                            allCoordPairs.Add(trimmed);
                                        }
                                    }
                                }
                                chunkDone = true;
                                break;
                            }
                        }
                    }
                    catch { }
                }

                if (!chunkDone)
                {
                    // Chunk OSRM başarısız olursa bu dilimdeki ham noktaları ekle
                    foreach (var c in chunk)
                    {
                        var str = $"{c.Longitude.ToString("F6", CultureInfo.InvariantCulture)} {c.Latitude.ToString("F6", CultureInfo.InvariantCulture)}";
                        if (allCoordPairs.Count == 0 || allCoordPairs.Last() != str)
                        {
                            allCoordPairs.Add(str);
                        }
                    }
                }
            }

            if (allCoordPairs.Count >= 2)
            {
                return new OsrmRouteResult
                {
                    Success = true,
                    Wkt = $"LINESTRING({string.Join(", ", allCoordPairs)})",
                    DistanceMeters = totalDistance > 0 ? totalDistance : CalculateEuclideanMeters(coords),
                    DurationSeconds = totalDuration > 0 ? totalDuration : CalculateSpeedDuration(totalDistance, profile),
                    Summary = "OSRM ile hesaplanan karayolu güzergahı",
                    Steps = allSteps.Count > 0 ? allSteps : GenerateBasicSteps(totalDistance, profile)
                };
            }

            return new OsrmRouteResult { Success = false, ErrorMessage = "Parçalı OSRM rotası oluşturulamadı." };
        }

        private static OsrmRouteResult ParseOsrmResponse(string jsonContent, string profile)
        {
            try
            {
                using var doc = JsonDocument.Parse(jsonContent);
                var root = doc.RootElement;

                if (!root.TryGetProperty("code", out var codeProp) || codeProp.GetString() != "Ok")
                {
                    return new OsrmRouteResult
                    {
                        Success = false,
                        ErrorMessage = "OSRM rotayı hesaplayamadı (Code: " + (codeProp.GetString() ?? "Unknown") + ")"
                    };
                }

                if (!root.TryGetProperty("routes", out var routesProp) || routesProp.GetArrayLength() == 0)
                {
                    return new OsrmRouteResult
                    {
                        Success = false,
                        ErrorMessage = "OSRM rota bilgisi döndürmedi."
                    };
                }

                var primaryRoute = routesProp[0];
                double distance = primaryRoute.TryGetProperty("distance", out var dProp) ? dProp.GetDouble() : 0;
                double duration = primaryRoute.TryGetProperty("duration", out var durProp) ? durProp.GetDouble() : 0;

                // Eğer yürüyüş veya bisiklet için sürüş servisi fallback olduysa süreleri yaya/bisiklet hızına göre gerçekçi ayarla
                if (profile == "walking" && duration < (distance / 2.0))
                {
                    duration = distance / 1.34; // 1.34 m/s = ~4.8 km/s (ortalama insan yürüme hızı)
                }
                else if (profile == "cycling" && duration < (distance / 5.5))
                {
                    duration = distance / 4.44; // 4.44 m/s = ~16 km/s (ortalama şehir içi bisiklet hızı)
                }

                if (!primaryRoute.TryGetProperty("geometry", out var geomProp) ||
                    !geomProp.TryGetProperty("coordinates", out var coordsProp) ||
                    coordsProp.GetArrayLength() < 2)
                {
                    return new OsrmRouteResult
                    {
                        Success = false,
                        ErrorMessage = "OSRM geometri koordinatları eksik."
                    };
                }

                var coordPairs = new List<string>();
                foreach (var item in coordsProp.EnumerateArray())
                {
                    if (item.GetArrayLength() >= 2)
                    {
                        double lon = item[0].GetDouble();
                        double lat = item[1].GetDouble();
                        coordPairs.Add($"{lon.ToString("F6", CultureInfo.InvariantCulture)} {lat.ToString("F6", CultureInfo.InvariantCulture)}");
                    }
                }

                if (coordPairs.Count < 2)
                {
                    return new OsrmRouteResult
                    {
                        Success = false,
                        ErrorMessage = "Yeterli çizgi koordinatı üretilemedi."
                    };
                }

                string lineStringWkt = $"LINESTRING({string.Join(", ", coordPairs)})";

                // Adım adım yönlendirmeleri (turn-by-turn steps) ayrıştır
                var steps = new List<RouteStepDto>();
                string summary = "";

                if (primaryRoute.TryGetProperty("legs", out var legsProp))
                {
                    int stepIdx = 1;
                    var streetNames = new HashSet<string>();

                    foreach (var leg in legsProp.EnumerateArray())
                    {
                        if (leg.TryGetProperty("summary", out var sProp) && string.IsNullOrEmpty(summary))
                        {
                            summary = sProp.GetString() ?? "";
                        }

                        if (leg.TryGetProperty("steps", out var stepsArray))
                        {
                            foreach (var s in stepsArray.EnumerateArray())
                            {
                                double sDist = s.TryGetProperty("distance", out var sd) ? sd.GetDouble() : 0;
                                double sDur = s.TryGetProperty("duration", out var st) ? st.GetDouble() : 0;
                                string sName = s.TryGetProperty("name", out var sn) ? sn.GetString() ?? "" : "";

                                if (!string.IsNullOrWhiteSpace(sName)) streetNames.Add(sName);

                                string mType = "";
                                string mMod = "";
                                if (s.TryGetProperty("maneuver", out var man))
                                {
                                    mType = man.TryGetProperty("type", out var mt) ? mt.GetString() ?? "" : "";
                                    mMod = man.TryGetProperty("modifier", out var mm) ? mm.GetString() ?? "" : "";
                                }

                                if (profile == "walking" && sDur < (sDist / 2.0))
                                {
                                    sDur = sDist / 1.34;
                                }

                                string instruction = TranslateManeuver(mType, mMod, sName, sDist, profile);

                                steps.Add(new RouteStepDto
                                {
                                    StepIndex = stepIdx++,
                                    Instruction = instruction,
                                    StreetName = sName,
                                    DistanceMeters = sDist,
                                    FormattedDistance = FormatDistance(sDist),
                                    DurationSeconds = sDur,
                                    FormattedDuration = FormatDuration(sDur),
                                    Modifier = mMod,
                                    Type = mType
                                });
                            }
                        }
                    }

                    if (string.IsNullOrEmpty(summary) && streetNames.Count > 0)
                    {
                        summary = string.Join(" ve ", streetNames.Take(2)) + " üzerinden";
                    }
                }

                if (string.IsNullOrEmpty(summary))
                {
                    summary = profile switch
                    {
                        "walking" => "En kısa yaya güzergahı",
                        "cycling" => "Bisiklet için uygun rota",
                        _ => "En hızlı karayolu rotası"
                    };
                }

                if (steps.Count == 0)
                {
                    steps = GenerateBasicSteps(distance, profile);
                }

                return new OsrmRouteResult
                {
                    Success = true,
                    Wkt = lineStringWkt,
                    DistanceMeters = distance,
                    DurationSeconds = duration,
                    Summary = summary,
                    Steps = steps
                };
            }
            catch (Exception ex)
            {
                return new OsrmRouteResult
                {
                    Success = false,
                    ErrorMessage = $"OSRM yanıtı ayrıştırılamadı: {ex.Message}"
                };
            }
        }

        private static string TranslateManeuver(string type, string modifier, string streetName, double distance, string profile)
        {
            bool hasStreet = !string.IsNullOrWhiteSpace(streetName);
            string onStreet = hasStreet ? $" ({streetName})" : "";

            return type switch
            {
                "depart" => profile == "walking" ? $"Yürüyüşe başlayın{onStreet}" : $"Harekete başlayın{onStreet}",
                "arrive" => "Hedefinize ulaştınız",
                "roundabout" => $"Dönel kavşaktan çıkın{onStreet}",
                "rotary" => $"Kavşaktan devam edin{onStreet}",
                "fork" => modifier switch
                {
                    "left" => $"Çatal yolda sola ayrılın{onStreet}",
                    "right" => $"Çatal yolda sağa ayrılın{onStreet}",
                    _ => $"Yol ayrımından ilerleyin{onStreet}"
                },
                "turn" => modifier switch
                {
                    "slight right" => $"Hafif sağa dönün{onStreet}",
                    "right" => $"Sağa dönün{onStreet}",
                    "sharp right" => $"Keskin sağa dönün{onStreet}",
                    "slight left" => $"Hafif sola dönün{onStreet}",
                    "left" => $"Sola dönün{onStreet}",
                    "sharp left" => $"Keskin sola dönün{onStreet}",
                    "uturn" => "U dönüşü yapın",
                    _ => $"Dönüş yapın{onStreet}"
                },
                "continue" or "new name" => hasStreet ? $"{streetName} üzerinde düz devam edin" : "Düz devam edin",
                _ => hasStreet ? $"{streetName} yönünde ilerleyin" : "İlerleyin"
            };
        }

        private static List<RouteStepDto> GenerateBasicSteps(double distanceMeters, string profile)
        {
            string startAction = profile == "walking" ? "Yürüyüşe başlayın" : (profile == "cycling" ? "Bisikletle harekete başlayın" : "Araçla harekete başlayın");
            string midAction = profile == "walking" ? "Yaya yolunu takip edin" : "Ana güzergahı takip edin";

            return new List<RouteStepDto>
            {
                new() { StepIndex = 1, Instruction = startAction, DistanceMeters = 50, FormattedDistance = "50 m", FormattedDuration = "1 dk", Type = "depart" },
                new() { StepIndex = 2, Instruction = $"{midAction} ({FormatDistance(distanceMeters)})", DistanceMeters = distanceMeters, FormattedDistance = FormatDistance(distanceMeters), FormattedDuration = FormatDuration(CalculateSpeedDuration(distanceMeters, profile)), Type = "continue" },
                new() { StepIndex = 3, Instruction = "Hedefe varış", DistanceMeters = 0, FormattedDistance = "0 m", FormattedDuration = "0 dk", Type = "arrive" }
            };
        }

        public static string FormatDistance(double meters)
        {
            if (meters < 1000) return $"{Math.Round(meters)} m";
            return $"{Math.Round(meters / 1000.0, 1)} km";
        }

        public static string FormatDuration(double seconds)
        {
            if (seconds < 60) return "1 dk";
            double minutes = seconds / 60.0;
            if (minutes < 60) return $"{Math.Round(minutes)} dk";
            int hours = (int)(minutes / 60.0);
            int remainMin = (int)(minutes % 60.0);
            return remainMin > 0 ? $"{hours} sa {remainMin} dk" : $"{hours} sa";
        }

        public static double CalculateSpeedDuration(double distanceMeters, string profile)
        {
            return profile switch
            {
                "walking" => distanceMeters / 1.34, // ~4.8 km/s
                "cycling" => distanceMeters / 4.44, // ~16 km/s
                _ => (distanceMeters / 1000.0) / 45.0 * 3600.0 // ortalama 45 km/s şehir içi sürüş
            };
        }

        private static double CalculateEuclideanMeters(List<(double Longitude, double Latitude)> coords)
        {
            double total = 0;
            for (int i = 0; i < coords.Count - 1; i++)
            {
                var c1 = coords[i];
                var c2 = coords[i + 1];
                double dLat = (c2.Latitude - c1.Latitude) * Math.PI / 180.0;
                double dLon = (c2.Longitude - c1.Longitude) * Math.PI / 180.0;
                double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                           Math.Cos(c1.Latitude * Math.PI / 180.0) * Math.Cos(c2.Latitude * Math.PI / 180.0) *
                           Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
                double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
                total += 6371000.0 * c;
            }
            return Math.Round(total);
        }
    }
}
