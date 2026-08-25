using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface IGeoServerService
    {
        Task<string> GetWfsFeatureGeoJsonAsync(string layerName);
        Task<byte[]> GetWmsMapImageAsync(string queryString);
        Task<string> GetCapabilitiesAsync();
        Task<object> GetGeoServerStatusAsync();
        Task<string> GetPoiSldStyleAsync();
    }
}
