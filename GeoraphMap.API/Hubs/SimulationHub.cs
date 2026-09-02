using System;
using System.Threading.Tasks;
using GeoraphMap.Core.Services;
using Microsoft.AspNetCore.SignalR;

namespace GeoraphMap.API.Hubs
{
    public class SimulationHub : Hub
    {
        private readonly ISimulationService _simulationService;

        public SimulationHub(ISimulationService simulationService)
        {
            _simulationService = simulationService;
        }

        /// <summary>
        /// Belirli bir güzergahın canlı araç takibine abone olur (Client group join).
        /// Abone olunduğunda araç zaten yoldaysa en son konumu istemciye hemen gönderilir.
        /// </summary>
        public async Task JoinRouteTracking(int routeId)
        {
            var groupName = $"route_{routeId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

            // Mevcut bir araç konumu varsa sadece yeni katılan istemciye hemen gönder
            var lastLoc = _simulationService.GetLastLocation(routeId);
            if (lastLoc != null)
            {
                await Clients.Caller.SendAsync("ReceiveVehicleLocation", lastLoc);
            }
        }

        /// <summary>
        /// Güzergah takibinden çıkış yapar.
        /// </summary>
        public async Task LeaveRouteTracking(int routeId)
        {
            var groupName = $"route_{routeId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        /// <summary>
        /// Aktif çalışan tüm güzergah simülasyonlarının listesini istemciye döner.
        /// </summary>
        public Task<System.Collections.Generic.List<GeoraphMap.Core.DTOs.SimulationStatusDto>> GetActiveSimulations()
        {
            return Task.FromResult(_simulationService.GetActiveSimulations());
        }

        /// <summary>
        /// Operatör veya Admin tarafından canlı araç simülasyonunu başlatır.
        /// </summary>
        public async Task<bool> StartSimulation(int routeId)
        {
            var username = Context.User?.Identity?.Name ?? "Operatör";
            var status = await _simulationService.StartSimulationAsync(routeId, username);
            return status != null;
        }

        public async Task<bool> PauseSimulation(int routeId)
        {
            return await _simulationService.PauseSimulationAsync(routeId);
        }

        public async Task<bool> ResumeSimulation(int routeId)
        {
            return await _simulationService.ResumeSimulationAsync(routeId);
        }

        /// <summary>
        /// Canlı araç simülasyonunu durdurur/iptal eder.
        /// </summary>
        public async Task<bool> StopSimulation(int routeId)
        {
            return await _simulationService.StopSimulationAsync(routeId);
        }

        public override async Task OnConnectedAsync()
        {
            // Bağlanan istemciye aktif simülasyonların durumunu iletebiliriz
            var active = _simulationService.GetActiveSimulations();
            await Clients.Caller.SendAsync("ActiveSimulationsList", active);
            await base.OnConnectedAsync();
        }
    }
}
