using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;

namespace GeoraphMap.Core.Services
{
    public interface ISimulationHubNotifier
    {
        Task BroadcastVehicleLocationAsync(int routeId, VehicleLocationDto location);
        Task BroadcastSimulationStartedAsync(SimulationStatusDto status);
        Task BroadcastSimulationPausedAsync(int routeId);
        Task BroadcastSimulationResumedAsync(int routeId);
        Task BroadcastSimulationStoppedAsync(int routeId);
        Task BroadcastSimulationCompletedAsync(int routeId, string routeName);
        Task BroadcastSimulationStateChangedAsync(int routeId, bool isRunning, bool isCompleted);
    }
}
