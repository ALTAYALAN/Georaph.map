// GeoraphMap Transport API Service
const API_BASE_URL = 'http://localhost:5041/api';

const getAuthHeaders = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const transportApi = {
    // ROUTES
    getRoutes: async (token, includeStops = true) => {
        const res = await fetch(`${API_BASE_URL}/routes?includeStops=${includeStops}`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Güzergahlar getirilemedi.');
        return res.json();
    },

    getRouteById: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${id}`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Güzergah detayı getirilemedi.');
        return res.json();
    },

    createRoute: async (routeDto, token) => {
        const res = await fetch(`${API_BASE_URL}/routes`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(routeDto)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah oluşturulamadı.');
        }
        return res.json();
    },

    updateRoute: async (id, routeDto, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(routeDto)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah güncellenemedi.');
        }
        return res.json();
    },

    deleteRoute: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah silinemedi.');
        }
        return res.json();
    },

    reorderStops: async (routeId, orderedStopIds, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/reorder-stops`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ orderedStopIds })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak sıralaması güncellenemedi.');
        }
        return res.json();
    },

    updateRouteGeometry: async (routeId, wkt, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/geometry`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ wkt })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah hat büküm geometrisi güncellenemedi.');
        }
        return res.json();
    },

    generateOsrmRoute: async (routeId, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/generate-route`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'OSRM ile rota üretilemedi.');
        }
        return res.json();
    },

    switchGeometryMode: async (routeId, mode, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/switch-mode`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ mode })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Geometri modu değiştirilemedi.');
        }
        return res.json();
    },

    revertGeometry: async (routeId, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/revert`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Önceki geometriye dönülemedi.');
        }
        return res.json();
    },

    // STOPS
    getAllStops: async (token) => {
        const res = await fetch(`${API_BASE_URL}/stops`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Duraklar getirilemedi.');
        return res.json();
    },

    getStopsByRoute: async (routeId, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/stops`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Güzergah durakları getirilemedi.');
        return res.json();
    },

    createStop: async (stopDto, token) => {
        const res = await fetch(`${API_BASE_URL}/stops`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(stopDto)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak oluşturulamadı.');
        }
        return res.json();
    },

    updateStop: async (id, stopDto, token) => {
        const res = await fetch(`${API_BASE_URL}/stops/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(stopDto)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak güncellenemedi.');
        }
        return res.json();
    },

    deleteStop: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/stops/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak silinemedi.');
        }
        return res.json();
    }
};
