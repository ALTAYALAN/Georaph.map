import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';
import { GeoManagement } from './GeoManagement';
import { PoiManagement } from './PoiManagement';
import { RouteManagement } from './RouteManagement';
import { ZoomSettingsManagement } from './ZoomSettingsManagement';
import { translations } from '../../translations';

export const AdminDashboard = ({ 
    token, 
    userRole, 
    initialTab = 'users', 
    onBackToMap, 
    onEditRouteGeometryOnMap, 
    onRepositionStopOnMap,
    activeSimulations,
    setActiveSimulations,
    simLoadingId,
    setSimLoadingId,
    lang = 'tr',
    toggleLang,
    isDarkMode: externalDarkMode,
    setIsDarkMode: externalSetIsDarkMode,
    loggedInUsername
}) => {
    const t = translations[lang] || translations.tr;
    const isOperator = userRole === 'Operatör' || userRole === 'Operator';
    const isEditor = userRole === 'Editor' || userRole === 'Editör';
    const defaultTab = (isOperator || isEditor) ? (initialTab === 'users' ? 'routes' : initialTab) : initialTab;
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [internalDarkMode, setInternalDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : true;
    });

    const isDarkMode = externalDarkMode !== undefined ? externalDarkMode : internalDarkMode;

    const toggleTheme = () => {
        const next = !isDarkMode;
        if (externalSetIsDarkMode) {
            externalSetIsDarkMode(next);
        } else {
            setInternalDarkMode(next);
        }
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const getTabMeta = () => {
        switch (activeTab) {
            case 'users':
                return { title: t.adminUserMgmt || 'Kullanıcı Yönetimi', sub: t.adminUserMgmtSub || 'Üyeler & Coğrafi Yetkiler' };
            case 'roles':
                return { title: t.adminRoleMgmt || 'Rol & Yetki Yönetimi', sub: t.adminRoleMgmtSub || 'Sistem Rolleri & İzinler' };
            case 'routes':
                return { title: t.adminRouteMgmt || 'Güzergah & Hat Yönetimi', sub: t.adminRouteMgmtSub || 'Hatlar, Duraklar & Canlı Simülasyon' };
            case 'pois':
                return { title: t.adminPoiMgmt || 'POI & Kategori Yönetimi', sub: t.adminPoiMgmtSub || 'Önemli Noktalar, Poligonlar & Hiyerarşi' };
            case 'geo':
                return { title: t.adminGeoMgmt || 'Şehir & Bölge Yönetimi', sub: t.adminGeoMgmtSub || '81 İl ve Coğrafi Sınırlar' };
            case 'zoom':
                return { title: lang === 'tr' ? 'Zoom & Görünürlük Seviyeleri' : 'Zoom & Visibility Levels', sub: lang === 'tr' ? 'İşaret, POI, Durak ve Hat Görünme Eşikleri' : 'Visibility Thresholds for Markers, POIs, Stops & Routes' };
            default:
                return { title: 'Yönetim Paneli', sub: 'CBS Yönetim Portalı' };
        }
    };

    const tabMeta = getTabMeta();

    return (
        <div className={`admin-layout ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBackToMap={onBackToMap}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                userRole={userRole}
                lang={lang}
                toggleLang={toggleLang}
                loggedInUsername={loggedInUsername}
            />

            <div className="admin-main-wrapper">
                {/* Modern Üst Bar (Top Header) */}
                <header className="admin-top-bar">
                    <div className="admin-top-bar-left">
                        <span className="admin-top-bar-badge">
                            {userRole === 'Admin' ? 'YÖNETİCİ PORTALI' : 'CBS PANELİ'}
                        </span>
                        <div className="admin-top-bar-breadcrumb">
                            <span className="breadcrumb-root">Georaph.map</span>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">{tabMeta.title}</span>
                        </div>
                    </div>
                </header>

                <main className={`admin-content ${activeTab === 'geo' ? 'admin-content-geo' : ''}`}>
                    {activeTab === 'users' && <UserManagement token={token} isDarkMode={isDarkMode} lang={lang} />}
                    {activeTab === 'roles' && <RoleManagement token={token} isDarkMode={isDarkMode} lang={lang} />}
                    {activeTab === 'routes' && (
                        <RouteManagement 
                            token={token} 
                            isDarkMode={isDarkMode} 
                            lang={lang}
                            onEditRouteGeometryOnMap={onEditRouteGeometryOnMap} 
                            onRepositionStopOnMap={onRepositionStopOnMap}
                            activeSimulations={activeSimulations}
                            setActiveSimulations={setActiveSimulations}
                            simLoadingId={simLoadingId}
                            setSimLoadingId={setSimLoadingId}
                        />
                    )}
                    {activeTab === 'pois' && <PoiManagement token={token} isDarkMode={isDarkMode} lang={lang} />}
                    {activeTab === 'geo' && <GeoManagement token={token} isDarkMode={isDarkMode} toggleTheme={toggleTheme} lang={lang} />}
                    {activeTab === 'zoom' && <ZoomSettingsManagement lang={lang} isDarkMode={isDarkMode} token={token} />}
                </main>
            </div>
        </div>
    );
};
