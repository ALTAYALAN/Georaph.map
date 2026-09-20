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

const getAuthHeaders = (token) => ({
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
});

async function readAdminList(res, fallback) {
    if (res.status === 401) throw new Error('Oturum doğrulanamadı. Çıkış yapıp yeniden giriş yapın.');
    if (res.status === 403) throw new Error('Bu oturumda yönetici yetkisi bulunmuyor. Admin hesabınızla yeniden giriş yapın.');
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || `${fallback} (HTTP ${res.status})`);
    }
    return res.json();
}

export const adminApi = {
    // USERS
    getUsers: async (token) => {
        const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders(token) });
        return readAdminList(res, 'Kullanıcılar getirilemedi.');
    },

    createUser: async (userDto, token) => {
        const res = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(userDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kullanıcı oluşturulamadı.');
        return data;
    },

    updateUser: async (id, userDto, token) => {
        const res = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(userDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kullanıcı güncellenemedi.');
        return data;
    },

    deleteUser: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kullanıcı silinemedi.');
        return data;
    },

    toggleUserStatus: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
            method: 'PATCH',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kullanıcı durumu güncellenemedi.');
        return data;
    },

    assignUserRolesAndPermissions: async (id, assignmentData, token) => {
        const res = await fetch(`${API_BASE_URL}/users/${id}/assignments`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(assignmentData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Yetki ve roller atanamadı.');
        return data;
    },

    setSpatialBoundary: async (id, spatialBoundaryWkt, token) => {
        const res = await fetch(`${API_BASE_URL}/users/${id}/spatial-boundary`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ userId: id, spatialBoundaryWkt })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Coğrafi yetki sınırı kaydedilemedi.');
        return data;
    },

    // ROLES
    getRoles: async (token) => {
        const res = await fetch(`${API_BASE_URL}/roles`, { headers: getAuthHeaders(token) });
        return readAdminList(res, 'Roller getirilemedi.');
    },

    createRole: async (roleDto, token) => {
        const res = await fetch(`${API_BASE_URL}/roles`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(roleDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Rol oluşturulamadı.');
        return data;
    },

    updateRole: async (id, roleDto, token) => {
        const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(roleDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Rol güncellenemedi.');
        return data;
    },

    deleteRole: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Rol silinemedi.');
        return data;
    },

    // PERMISSIONS
    getPermissions: async (token) => {
        const res = await fetch(`${API_BASE_URL}/permissions`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('Yetkiler getirilemedi.');
        return await res.json();
    },

    getAllPermissions: async (token) => {
        return await adminApi.getPermissions(token);
    },

    // CITIES (Database Table Integration)
    getCities: async (includeDeleted = false, token) => {
        const res = await fetch(`${API_BASE_URL}/cities?includeDeleted=${includeDeleted}`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('İl sınır verileri veritabanından alınamadı.');
        return await res.json();
    },

    saveBulkCities: async (cities, token) => {
        const dtoList = (cities || []).map(c => ({
            id: typeof c.id === 'number' ? c.id : (parseInt(c.plate, 10) || 0),
            plate: parseInt(c.plate, 10) || 0,
            name: c.name || '',
            region: c.region || '',
            wkt: c.wkt || '',
            isActive: c.isActive !== false,
            isDeleted: c.isDeleted === true
        }));

        const res = await fetch(`${API_BASE_URL}/cities/bulk-save`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ cities: dtoList })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'İl sınır verileri veritabanına kaydedilemedi.');
        return data;
    },

    backupCities: async (payload) => {
        try {
            await fetch(`${API_BASE_URL}/drawings/backup-cities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn('[backupCities] Sunucu disk yedeği kaydedilemedi:', e);
        }
    },

    seedCities: async (token) => {
        const res = await fetch(`${API_BASE_URL}/cities/seed`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Veritabanı otomatik doldurulamadı.');
        return data;
    },

    // GEOSERVER (WMS / WFS OGC Integration)
    getGeoServerStatus: async (token) => {
        const res = await fetch(`${API_BASE_URL}/geoserver/status`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('GeoServer servisi durumu alınamadı.');
        return await res.json();
    },

    getGeoServerWfsLayer: async (layerName, token) => {
        const res = await fetch(`${API_BASE_URL}/geoserver/wfs/${layerName}`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error(`GeoServer WFS katman verisi alınamadı (${layerName}).`);
        return await res.json();
    },

    // POI (Point of Interest) & Kategori API
    getPoiCategories: async (arg1, arg2) => {
        let includeInactive = false;
        let token = null;
        if (typeof arg1 === 'boolean') {
            includeInactive = arg1;
            token = arg2;
        } else if (typeof arg1 === 'string') {
            token = arg1;
            includeInactive = typeof arg2 === 'boolean' ? arg2 : false;
        } else {
            token = arg2;
        }
        const res = await fetch(`${API_BASE_URL}/poicategories?includeInactive=${includeInactive}`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('Kategoriler alınamadı.');
        return await res.json();
    },

    getPoiCategoryTree: async (token) => {
        const res = await fetch(`${API_BASE_URL}/poicategories/tree`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('Kategori ağacı alınamadı.');
        return await res.json();
    },

    createPoiCategory: async (categoryDto, token) => {
        const res = await fetch(`${API_BASE_URL}/poicategories`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(categoryDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kategori oluşturulamadı.');
        return data;
    },

    updatePoiCategory: async (id, categoryDto, token) => {
        const res = await fetch(`${API_BASE_URL}/poicategories/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(categoryDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kategori güncellenemedi.');
        return data;
    },

    deletePoiCategory: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/poicategories/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Kategori silinemedi.');
        return data;
    },

    getPois: async (arg1 = null, arg2 = false, arg3 = null) => {
        let categoryId = null;
        let includeInactive = false;
        let token = null;
        if (typeof arg1 === 'string' && !arg2 && !arg3) {
            token = arg1;
        } else {
            categoryId = (typeof arg1 === 'number' || (typeof arg1 === 'string' && !isNaN(parseInt(arg1, 10)))) ? parseInt(arg1, 10) : null;
            includeInactive = typeof arg2 === 'boolean' ? arg2 : false;
            token = arg3 || (typeof arg2 === 'string' ? arg2 : null);
        }
        let url = `${API_BASE_URL}/pois?includeInactive=${includeInactive}`;
        if (categoryId) url += `&categoryId=${categoryId}`;
        const res = await fetch(url, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('POI listesi alınamadı.');
        return await res.json();
    },

    createPoi: async (poiDto, token) => {
        const res = await fetch(`${API_BASE_URL}/pois`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(poiDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'POI oluşturulamadı.');
        return data;
    },

    updatePoi: async (id, poiDto, token) => {
        const res = await fetch(`${API_BASE_URL}/pois/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(poiDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'POI güncellenemedi.');
        return data;
    },

    deletePoi: async (id, token) => {
        const res = await fetch(`${API_BASE_URL}/pois/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'POI silinemedi.');
        return data;
    },

    // CITIES
    getCities: async (token) => {
        const res = await fetch(`${API_BASE_URL}/cities`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('İller listesi alınamadı.');
        return await res.json();
    },

    // LOCATION / WEIGHTED HEATMAP ANALYSIS
    runLocationAnalysis: async (analysisDto, token) => {
        const res = await fetch(`${API_BASE_URL}/analysis/location`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(analysisDto)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.Message || 'Konum analizi gerçekleştirilemedi.');
        return data;
    },

    // FILE / IMAGE UPLOAD
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
