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
    }
};
