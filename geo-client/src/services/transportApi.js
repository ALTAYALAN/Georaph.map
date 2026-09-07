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

    generateAllBusRoutesOsrm: async (onlyNonOsrm = false, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/generate-all-bus-osrm?onlyNonOsrm=${onlyNonOsrm}`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Toplu OSRM işlemi gerçekleştirilemedi.');
        }
        return res.json();
    },

    fixOrphanMetroStops: async (token) => {
        const res = await fetch(`${API_BASE_URL}/stops/fix-orphan-metro`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Metro durakları güncellenemedi.');
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
    },

    // ATTACH / DETACH STOP TO ROUTE
    addStopToRoute: async (routeId, stopId, token, position = 'end', targetStopId = null) => {
        let url = `${API_BASE_URL}/routes/${routeId}/stops/${stopId}?position=${encodeURIComponent(position)}`;
        if (targetStopId) {
            url += `&targetStopId=${encodeURIComponent(targetStopId)}`;
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak güzergaha bağlanamadı.');
        }
        return res.json();
    },

    removeStopFromRoute: async (routeId, stopId, token) => {
        const res = await fetch(`${API_BASE_URL}/routes/${routeId}/stops/${stopId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Durak güzergahtan çıkarılamadı.');
        }
        return res.json();
    },

    uploadImage: async (file, token) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            let res = null;
            try {
                res = await fetch(`${API_BASE_URL}/upload/image`, {
                    method: 'POST',
                    headers,
                    body: formData
                });
            } catch (networkErr) {
                try {
                    res = await fetch('/api/upload/image', {
                        method: 'POST',
                        headers,
                        body: formData
                    });
                } catch {
                    res = null;
                }
            }

            if (res && res.ok) {
                const text = await res.text();
                if (text && text.trim().length > 0) {
                    try {
                        const data = JSON.parse(text);
                        return data;
                    } catch (e) {
                        // ignore json parse error, fall through to base64 fallback
                    }
                }
            }
        } catch (err) {
            console.warn('Backend image upload fallback triggered:', err);
        }

        // Seamless fallback: convert to Base64 data URL
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    url: reader.result,
                    absoluteUrl: reader.result,
                    fileName: file.name,
                    size: file.size,
                    isLocalBase64: true
                });
            };
            reader.onerror = () => {
                resolve({
                    url: URL.createObjectURL(file),
                    absoluteUrl: URL.createObjectURL(file),
                    fileName: file.name,
                    size: file.size
                });
            };
            reader.readAsDataURL(file);
        });
    }
};
