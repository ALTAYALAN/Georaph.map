using System;
using System.Threading.Tasks;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.SignalR;

namespace GeoraphMap.API.Hubs
{
    public class SimulationHubNotifier : ISimulationHubNotifier
    {
        private readonly IHubContext<SimulationHub> _hubContext;

        public SimulationHubNotifier(IHubContext<SimulationHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task BroadcastVehicleLocationAsync(int routeId, VehicleLocationDto location)
        {
            // Harita üzerindeki tüm kullanıcıların aracı anlık görebilmesi için All yayını yapılır
            await _hubContext.Clients.All.SendAsync("ReceiveVehicleLocation", location);
        }

        public async Task BroadcastSimulationStartedAsync(SimulationStatusDto status)
        {
            await _hubContext.Clients.All.SendAsync("SimulationStarted", status);
        }

        public async Task BroadcastSimulationPausedAsync(int routeId)
        {
            await _hubContext.Clients.All.SendAsync("SimulationPaused", new { routeId });
        }

        public async Task BroadcastSimulationResumedAsync(int routeId)
        {
            await _hubContext.Clients.All.SendAsync("SimulationResumed", new { routeId });
        }

        public async Task BroadcastSimulationStoppedAsync(int routeId)
        {
            await _hubContext.Clients.All.SendAsync("SimulationStopped", new { routeId });
        }

        public async Task BroadcastSimulationCompletedAsync(int routeId, string routeName)
        {
            await _hubContext.Clients.All.SendAsync("SimulationCompleted", new
            {
                routeId,
                routeName,
                completedAt = DateTime.UtcNow
            });
        }

        public async Task BroadcastSimulationStateChangedAsync(int routeId, bool isRunning, bool isCompleted)
        {
            await _hubContext.Clients.All.SendAsync("SimulationStateChanged", new
            {
                routeId,
                isRunning,
                isCompleted
            });
        }
    }
}
