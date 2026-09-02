import * as signalR from '@microsoft/signalr';

const HUB_URL = 'http://localhost:5041/hubs/simulation';
const API_BASE_URL = 'http://localhost:5041/api/simulation';

class SimulationHubService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.locationListeners = new Set();
        this.startedListeners = new Set();
        this.pausedListeners = new Set();
        this.resumedListeners = new Set();
        this.stoppedListeners = new Set();
        this.completedListeners = new Set();
        this.stateChangedListeners = new Set();
        this.subscribedRoutes = new Set();
    }

    async connect(token = null) {
        if (this.connection && this.isConnected) {
            return this.connection;
        }

        if (this.connection) {
            try {
                await this.connection.start();
                this.isConnected = true;
                return this.connection;
            } catch (e) {
                console.warn('[SignalR] Reconnect attempt failed:', e);
            }
        }

        const options = {
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
        };

        if (token) {
            options.accessTokenFactory = () => token;
        }

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, options)
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // SignalR Event Handlers
        this.connection.on('ReceiveVehicleLocation', (locationData) => {
            this.locationListeners.forEach(cb => {
                try { cb(locationData); } catch (err) { console.error('Error in location listener:', err); }
            });
        });

        this.connection.on('SimulationStarted', (statusData) => {
            this.startedListeners.forEach(cb => {
                try { cb(statusData); } catch (err) { console.error('Error in started listener:', err); }
            });
        });

        this.connection.on('SimulationPaused', (data) => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            const normalized = { routeId: Number(rId) };
            this.pausedListeners.forEach(cb => {
                try { cb(normalized); } catch (err) { console.error('Error in paused listener:', err); }
            });
        });

        this.connection.on('SimulationResumed', (data) => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            const normalized = { routeId: Number(rId) };
            this.resumedListeners.forEach(cb => {
                try { cb(normalized); } catch (err) { console.error('Error in resumed listener:', err); }
            });
        });

        this.connection.on('SimulationStopped', (data) => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            const normalized = { routeId: Number(rId) };
            this.stoppedListeners.forEach(cb => {
                try { cb(normalized); } catch (err) { console.error('Error in stopped listener:', err); }
            });
        });

        this.connection.on('SimulationCompleted', (data) => {
            this.completedListeners.forEach(cb => {
                try { cb(data); } catch (err) { console.error('Error in completed listener:', err); }
            });
        });

        this.connection.on('SimulationStateChanged', (data) => {
            this.stateChangedListeners.forEach(cb => {
                try { cb(data); } catch (err) { console.error('Error in stateChanged listener:', err); }
            });
        });

        this.connection.onreconnected(async () => {
            console.log('[SignalR] Connection re-established. Re-subscribing to routes:', Array.from(this.subscribedRoutes));
            for (const routeId of this.subscribedRoutes) {
                try {
                    await this.connection.invoke('JoinRouteTracking', routeId);
                } catch (err) {
                    console.error('[SignalR] Error re-joining route group:', routeId, err);
                }
            }
        });

        this.connection.onclose(() => {
            this.isConnected = false;
        });

        try {
            await this.connection.start();
            this.isConnected = true;
            console.log('[SignalR] Connected to SimulationHub successfully.');

            // Re-subscribe if any were registered
            for (const routeId of this.subscribedRoutes) {
                await this.connection.invoke('JoinRouteTracking', routeId).catch(console.error);
            }
        } catch (err) {
            console.warn('[SignalR] Connection to SimulationHub could not be established immediately:', err.message);
        }

        return this.connection;
    }

    async joinRoute(routeId) {
        if (!routeId) return;
        this.subscribedRoutes.add(routeId);

        if (this.connection && this.isConnected) {
            try {
                await this.connection.invoke('JoinRouteTracking', routeId);
            } catch (e) {
                console.error('[SignalR] joinRoute error:', e);
            }
        }
    }

    async leaveRoute(routeId) {
        if (!routeId) return;
        this.subscribedRoutes.delete(routeId);

        if (this.connection && this.isConnected) {
            try {
                await this.connection.invoke('LeaveRouteTracking', routeId);
            } catch (e) {
                console.error('[SignalR] leaveRoute error:', e);
            }
        }
    }

    // REST API Helpers with Auth Token
    async startSimulation(routeId, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/${routeId}/start`, {
            method: 'POST',
            headers
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Simülasyon başlatılamadı.');
        }

        // Also ensure joined to group
        await this.joinRoute(routeId);
        return data;
    }

    async pauseSimulation(routeId, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/${routeId}/pause`, {
            method: 'POST',
            headers
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Simülasyon duraklatılamadı.');
        }
        return data;
    }

    async resumeSimulation(routeId, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/${routeId}/resume`, {
            method: 'POST',
            headers
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Simülasyon devam ettirilemedi.');
        }
        return data;
    }

    async stopSimulation(routeId, token) {
        let numId = null;
        if (typeof routeId === 'number' && !isNaN(routeId)) {
            numId = routeId;
        } else if (typeof routeId === 'string' && !isNaN(Number(routeId))) {
            numId = Number(routeId);
        } else if (routeId && typeof routeId === 'object') {
            const candidate = routeId.id ?? routeId.routeId;
            if (candidate != null && !isNaN(Number(candidate))) {
                numId = Number(candidate);
            }
        }

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (numId != null) {
            // 1. Doğrudan tekil rota HTTP iptal çağrısı
            try {
                await fetch(`${API_BASE_URL}/${numId}/stop`, {
                    method: 'POST',
                    headers
                });
            } catch (_) { }

            // 2. SignalR Hub'a da bildir
            try {
                if (this.connection && this.isConnected) {
                    this.connection.invoke('StopSimulation', numId).catch(() => {});
                }
            } catch (_) { }
        } else {
            // Eğer rota ID belirlenememişse tüm simülasyonları güvenle durdur
            try {
                await fetch(`${API_BASE_URL}/stop-all`, {
                    method: 'POST',
                    headers
                });
            } catch (_) { }
        }

        return { success: true };
    }

    async stopAllSimulations(token) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/stop-all`, {
                method: 'POST',
                headers
            });

            return await res.json().catch(() => ({}));
        } catch (err) {
            return {};
        }
    }

    async getActiveSimulations() {
        try {
            const res = await fetch(`${API_BASE_URL}/active`);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }

    onVehicleLocation(callback) {
        this.locationListeners.add(callback);
        return () => this.locationListeners.delete(callback);
    }

    onSimulationStarted(callback) {
        this.startedListeners.add(callback);
        return () => this.startedListeners.delete(callback);
    }

    onSimulationPaused(callback) {
        this.pausedListeners.add(callback);
        return () => this.pausedListeners.delete(callback);
    }

    onSimulationResumed(callback) {
        this.resumedListeners.add(callback);
        return () => this.resumedListeners.delete(callback);
    }

    onSimulationStopped(callback) {
        this.stoppedListeners.add(callback);
        return () => this.stoppedListeners.delete(callback);
    }

    onSimulationCompleted(callback) {
        this.completedListeners.add(callback);
        return () => this.completedListeners.delete(callback);
    }

    onSimulationStateChanged(callback) {
        this.stateChangedListeners.add(callback);
        return () => this.stateChangedListeners.delete(callback);
    }
}

export const simulationHubService = new SimulationHubService();
