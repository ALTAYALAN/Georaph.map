const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.port === '5041') {
            return `${window.location.origin}/api`;
        }
        const host = window.location.hostname || 'localhost';
        return `http://${host}:5041/api`;
    }
    return 'http://localhost:5041/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const userPersonalApi = {
    // 1. OSRM ile POI Yol Tarifi Hesaplama
    calculateDirections: async (params, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/calculate-directions`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(params)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Yol tarifi hesaplanamadı.');
        }
        return res.json();
    },

    // 2. Kayıtlı Güzergahlar
    getSavedRoutes: async (token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/saved-routes`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Kayıtlı güzergahlar getirilemedi.');
        return res.json();
    },

    saveRoute: async (routeData, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/saved-routes`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(routeData)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah kaydedilemedi.');
        }
        return res.json();
    },

    deleteSavedRoute: async (routeId, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/saved-routes/${routeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Güzergah silinemedi.');
        }
        return res.json();
    },

    // 3. Favori POI'ler
    getFavorites: async (token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/favorites`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) throw new Error('Favori ilgi noktaları getirilemedi.');
        return res.json();
    },

    toggleFavorite: async (poiId, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/favorites/${poiId}/toggle`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Favori durumu güncellenemedi.');
        }
        return res.json();
    },

    getFavoriteStatus: async (poiId, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/favorites/${poiId}/status`, {
            headers: getAuthHeaders(token)
        });
        if (!res.ok) return { isFavorite: false };
        return res.json();
    },

    // 4. Profil Bilgilerini Güncelleme
    updateProfile: async (profileDto, token) => {
        const res = await fetch(`${API_BASE_URL}/user-personal/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(profileDto)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Profil güncellenemedi.');
        }
        return res.json();
    }
};
