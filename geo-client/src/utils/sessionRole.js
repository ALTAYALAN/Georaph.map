// UI state only: API authorization continues to validate the signed token.
export function getSessionRole(payload) {
    if (!payload) return 'Viewer';
    const role = payload.userRole || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role;
    const roles = (Array.isArray(role) ? role : [role]).filter(Boolean).map(value => String(value).trim());
    if (payload.isAdmin === true || payload.isAdmin === 'true' || roles.some(value => value.toLowerCase() === 'admin')) return 'Admin';
    return roles[0] || 'Viewer';
}
