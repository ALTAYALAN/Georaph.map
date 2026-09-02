import React, { useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';
import { GeoManagement } from './GeoManagement';
import { PoiManagement } from './PoiManagement';
import { RouteManagement } from './RouteManagement';

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

            <main className="admin-content">
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
            </main>
        </div>
    );
};
