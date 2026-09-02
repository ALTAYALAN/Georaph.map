using System.Collections.Generic;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface ISimulationService
    {
        Task<SimulationStatusDto?> StartSimulationAsync(int routeId, string startedBy = "Operatör");
        Task<bool> PauseSimulationAsync(int routeId);
        Task<bool> ResumeSimulationAsync(int routeId);
        Task<bool> StopSimulationAsync(int routeId);
        List<SimulationStatusDto> GetActiveSimulations();
        VehicleLocationDto? GetLastLocation(int routeId);
        bool IsSimulationRunning(int routeId);
    }
}
