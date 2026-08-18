import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';

export const AdminDashboard = ({ token, onBackToMap }) => {
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="admin-layout">
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBackToMap={onBackToMap}
            />

            <main className="admin-content">
                {activeTab === 'users' && <UserManagement token={token} />}
                {activeTab === 'roles' && <RoleManagement token={token} />}
            </main>
        </div>
    );
};
