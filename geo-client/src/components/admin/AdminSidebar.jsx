import React from 'react';

const UserGroupIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const MapIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);

const MapRegionIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const PoiIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

export const AdminSidebar = ({ activeTab, setActiveTab, onBackToMap, isDarkMode, toggleTheme }) => {
    const navItems = [
        { id: 'users', label: 'Kullanıcı Yönetimi', icon: <UserGroupIcon />, sub: 'Üyeler & Coğrafi Yetkiler' },
        { id: 'roles', label: 'Rol & Yetki Yönetimi', icon: <ShieldIcon />, sub: 'Sistem Rolleri & İzinler' },
        { id: 'pois', label: 'POI & Kategori Yönetimi', icon: <PoiIcon />, sub: 'POI Noktaları & Hiyerarşi' },
        { id: 'geo', label: 'Şehir & Bölge Yönetimi', icon: <MapRegionIcon />, sub: '81 İl & Bölge Sınırları' },
    ];

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar-header">
                <div className="admin-brand">
                    <img src="/logo.png" alt="Georaph.map Logo" className="admin-brand-logo" />
                    <div className="admin-brand-text">
                        <h2 className="admin-brand-title">Georaph.map</h2>
                        <span className="admin-brand-subtitle">Sistem Yönetimi</span>
                    </div>
                </div>

                {/* Main Screen format theme toggle button placed right in the header */}
                {toggleTheme && (
                    <button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        title={isDarkMode ? 'Aydınlık Mod' : 'Koyu Mod'}
                    >
                        {isDarkMode ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>
                )}
            </div>

            <nav className="admin-sidebar-nav">
                <div className="nav-group-title">YÖNETİM MENÜSÜ</div>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        <span className="admin-nav-icon">{item.icon}</span>
                        <div className="admin-nav-content">
                            <span className="admin-nav-label">{item.label}</span>
                            <span className="admin-nav-sub">{item.sub}</span>
                        </div>
                    </button>
                ))}
            </nav>

            <div className="admin-sidebar-footer">
                <div className="admin-user-profile-card">
                    <div className="admin-user-avatar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <div className="admin-user-details">
                        <span className="admin-user-name" title={localStorage.getItem('logged_in_username') || 'Admin'}>
                            {localStorage.getItem('logged_in_username') || 'Admin'}
                        </span>
                        <span className="admin-user-role-badge">Yönetici</span>
                    </div>
                </div>

                <button className="admin-back-btn" onClick={onBackToMap}>
                    <MapIcon />
                    <span>Harita Ekranına Dön</span>
                </button>
            </div>
        </aside>
    );
};
