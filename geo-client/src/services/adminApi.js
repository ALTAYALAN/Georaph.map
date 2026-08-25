const API_BASE_URL = 'http://localhost:5041/api';

const getAuthHeaders = (token) => ({
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
});

export const adminApi = {
    // USERS
    getUsers: async (token) => {
        const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders(token) });
        if (!res.ok) throw new Error('Kullanıcılar getirilemedi.');
        return await res.json();
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
        if (!res.ok) throw new Error('Roller getirilemedi.');
        return await res.json();
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
    getPoiCategories: async (includeInactive = false, token) => {
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

    getPois: async (categoryId = null, includeInactive = false, token) => {
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
    }
};
