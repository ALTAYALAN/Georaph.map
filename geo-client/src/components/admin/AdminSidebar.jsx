import React from 'react';

const UserGroupIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const ZapIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const MapIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);

export const AdminSidebar = ({ activeTab, setActiveTab, onBackToMap }) => {
    const navItems = [
        { id: 'users', label: 'Kullanıcı Listesi', icon: <UserGroupIcon />, sub: 'Ekle / Çıkar / Güncelle' },
        { id: 'roles', label: 'Rol Listesi', icon: <ShieldIcon />, sub: 'Ekle / Çıkar / Sil' },
    ];

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar-header">
                <div className="admin-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/logo.png" alt="Georaph.map Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }} />
                    <div className="admin-brand-text">
                        <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.4px' }}>Georaph.map</h3>
                        <span className="admin-badge" style={{ fontSize: '11px', fontWeight: 600, color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>Yönetim Paneli</span>
                    </div>
                </div>
            </div>

            <nav className="admin-sidebar-nav">
                <div className="nav-group-title">MENÜ</div>
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
                <button className="admin-back-btn" onClick={onBackToMap}>
                    <span className="btn-icon"><MapIcon /></span>
                    <span>Haritaya Dön</span>
                </button>
            </div>
        </aside>
    );
};
