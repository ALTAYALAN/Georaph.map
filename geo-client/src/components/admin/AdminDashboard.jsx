import React, { useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';
import { GeoManagement } from './GeoManagement';
import { PoiManagement } from './PoiManagement';

export const AdminDashboard = ({ token, onBackToMap }) => {
    const [activeTab, setActiveTab] = useState('users');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : true;
    });

    const toggleTheme = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
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
            />

            <main className="admin-content">
                {activeTab === 'users' && <UserManagement token={token} isDarkMode={isDarkMode} />}
                {activeTab === 'roles' && <RoleManagement token={token} isDarkMode={isDarkMode} />}
                {activeTab === 'pois' && <PoiManagement token={token} isDarkMode={isDarkMode} />}
                {activeTab === 'geo' && <GeoManagement token={token} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
            </main>
        </div>
    );
};
