import React from 'react';
import { translations } from '../../translations';

const TurkeyFlag = () => (
    <svg width="18" height="13" viewBox="0 0 1200 800" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
        <rect width="1200" height="800" fill="#E30A17" />
        <circle cx="425" cy="400" r="200" fill="#ffffff" />
        <circle cx="475" cy="400" r="160" fill="#E30A17" />
        <polygon points="583.3,400 684.8,433 622,346.5 622,453.5 684.8,367" fill="#ffffff" />
    </svg>
);

const UKFlag = () => (
    <svg width="18" height="13" viewBox="0 0 60 30" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
        <clipPath id="uk-clip-admin"><rect width="60" height="30" /></clipPath>
        <g clipPath="url(#uk-clip-admin)">
            <rect width="60" height="30" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
            <path d="M30,0 V30 M0,15 H60" stroke="#ffffff" strokeWidth="10" />
            <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
        </g>
    </svg>
);

const UserGroupIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const RouteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="13" rx="2" />
        <path d="M4 9h16" />
        <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
        <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
        <path d="M6 17v2.5M18 17v2.5" />
    </svg>
);

const PoiIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const MapRegionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const MapIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);

const ZoomSliderIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
);

export const AdminSidebar = ({ 
    activeTab, 
    setActiveTab, 
    onBackToMap, 
    isDarkMode, 
    toggleTheme, 
    userRole, 
    lang = 'tr', 
    toggleLang, 
    loggedInUsername 
}) => {
    const t = translations[lang] || translations.tr;
    const isOperator = userRole === 'Operatör' || userRole === 'Operator';
    const isEditor = userRole === 'Editor' || userRole === 'Editör';

    const allNavItems = [
        { id: 'users', label: t.adminUserMgmt || 'Kullanıcı Yönetimi', icon: <UserGroupIcon />, sub: t.adminUserMgmtSub || 'Üyeler & Coğrafi Yetkiler' },
        { id: 'roles', label: t.adminRoleMgmt || 'Rol & Yetki Yönetimi', icon: <ShieldIcon />, sub: t.adminRoleMgmtSub || 'Sistem Rolleri & İzinler' },
        { id: 'routes', label: t.adminRouteMgmt || 'Güzergah Yönetimi', icon: <RouteIcon />, sub: t.adminRouteMgmtSub || 'Hatlar & Durak Sıralaması' },
        { id: 'pois', label: t.adminPoiMgmt || 'POI & Kategori Yönetimi', icon: <PoiIcon />, sub: t.adminPoiMgmtSub || 'POI Noktaları & Hiyerarşi' },
        { id: 'geo', label: t.adminGeoMgmt || 'Şehir & Bölge Yönetimi', icon: <MapRegionIcon />, sub: t.adminGeoMgmtSub || '81 İl & Bölge Sınırları' },
        { id: 'zoom', label: lang === 'tr' ? 'Zoom & Görünürlük' : 'Zoom & Visibility', icon: <ZoomSliderIcon />, sub: lang === 'tr' ? 'İşaret, POI & Hat Zoom Seviyeleri' : 'Marker, POI & Route Zoom Levels' },
    ];

    const navItems = (isOperator || isEditor)
        ? allNavItems.filter(item => item.id === 'routes')
        : allNavItems;

    const roleDisplayName = userRole === 'Admin' 
        ? (t.roleAdmin || 'Yönetici') 
        : ((userRole === 'Operator' || userRole === 'Operatör') 
            ? (t.roleOperator || 'Operatör') 
            : ((userRole === 'Editor' || userRole === 'Editör') 
                ? (t.roleEditor || 'Editör') 
                : (userRole || (t.roleViewer || 'Görüntüleyici'))));

    const username = loggedInUsername || localStorage.getItem('logged_in_username') || 'Admin';

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar-header">
                <div className="admin-brand">
                    <img src="/logo.png" alt="Georaph.map Logo" className="admin-brand-logo" />
                    <div className="admin-brand-text">
                        <h2 className="admin-brand-title">Georaph.map</h2>
                        <span className="admin-brand-subtitle">{t.adminSystemTitle || 'Sistem Yönetimi'}</span>
                    </div>
                </div>
            </div>

            <nav className="admin-sidebar-nav">
                <div className="nav-group-title">{t.adminMenuTitle || 'YÖNETİM MODÜLLERİ'}</div>
                {navItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            className={`admin-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <span className="admin-nav-icon">{item.icon}</span>
                            <div className="admin-nav-content">
                                <span className="admin-nav-label">{item.label}</span>
                                <span className="admin-nav-sub">{item.sub}</span>
                            </div>
                        </button>
                    );
                })}
            </nav>

            <div className="admin-sidebar-footer">
                {/* Kullanıcı Profili & Yanında Tema + Dil Butonları */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '10px' }}>
                    <div className="admin-user-profile-card">
                        <div className="admin-user-avatar">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <div className="admin-user-details">
                            <span className="admin-user-name" title={username}>
                                {username}
                            </span>
                            <span className="admin-user-role-badge">
                                {roleDisplayName}
                            </span>
                        </div>
                    </div>

                    {/* Karanlık / Aydınlık Mod Butonu */}
                    {toggleTheme && (
                        <button
                            type="button"
                            className="theme-toggle-btn admin-footer-action-btn"
                            onClick={toggleTheme}
                            title={isDarkMode ? (t.lightMode || 'Aydınlık Mod') : (t.darkMode || 'Karanlık Mod')}
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

                    {/* Dil Seçim Butonu */}
                    {toggleLang && (
                        <button
                            type="button"
                            className="theme-toggle-btn lang-toggle-btn admin-footer-action-btn"
                            onClick={toggleLang}
                            title={t.languageSelect || 'Dil Seçimi'}
                        >
                            {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                        </button>
                    )}
                </div>

                <button className="admin-back-btn" onClick={onBackToMap}>
                    <MapIcon />
                    <span>{t.backToMap || (lang === 'tr' ? 'Harita Ekranına Dön' : 'Return to Map')}</span>
                </button>
            </div>
        </aside>
    );
};

