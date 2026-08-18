import React, { useState, useEffect } from 'react';
export const getRoleColorStyle = (roleName, roleId) => {
    const name = (roleName || '').toLowerCase();
    
    if (name.includes('admin') || roleId === 1) {
        return {
            bg: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: 'rgba(239, 68, 68, 0.35)',
        };
    }
    if (name.includes('edit') || name.includes('yönetici') || roleId === 2) {
        return {
            bg: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            border: 'rgba(59, 130, 246, 0.35)',
        };
    }
    if (name.includes('user') || name.includes('kullanıcı') || roleId === 3) {
        return {
            bg: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            border: 'rgba(16, 185, 129, 0.35)',
        };
    }
    if (name.includes('mod') || name.includes('denetçi') || roleId === 4) {
        return {
            bg: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            border: 'rgba(139, 92, 246, 0.35)',
        };
    }

    const palette = [
        { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.35)' },
        { bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.35)' },
        { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.35)' },
        { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.35)' },
        { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.35)' },
    ];
    const idx = Math.abs((roleId || 0) + name.length) % palette.length;
    return palette[idx];
};
import { adminApi } from '../../services/adminApi';

// SVG Icons
const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const MailIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const PhoneIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const PauseIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
);

const PlayIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const TrashIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const KeyIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
);

const ZapIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

export const UserManagement = ({ token }) => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null); // null for new user
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        isActive: true,
        selectedRoleIds: [],
        selectedDirectPermIds: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [usersData, rolesData, permsData] = await Promise.all([
                adminApi.getUsers(token),
                adminApi.getRoles(token),
                adminApi.getPermissions(token)
            ]);
            setUsers(usersData);
            setRoles(rolesData);
            setPermissions(permsData);
        } catch (err) {
            setError(err.message || 'Veriler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            phone: '',
            password: '',
            isActive: true,
            selectedRoleIds: [],
            selectedDirectPermIds: []
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        const roleIds = user.roles ? user.roles.map(r => r.id) : [];
        const directPermIds = user.permissions
            ? user.permissions.filter(p => p.isDirect).map(p => p.permissionId)
            : [];

        setFormData({
            username: user.username,
            email: user.email || '',
            phone: user.phone || '',
            password: '',
            isActive: user.isActive,
            selectedRoleIds: roleIds,
            selectedDirectPermIds: directPermIds
        });
        setShowModal(true);
    };

    const handleToggleStatus = async (userId) => {
        try {
            await adminApi.toggleUserStatus(userId, token);
            setSuccessMessage('Kullanıcı durumu başarıyla güncellendi.');
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deleteUser(userId, token);
            setSuccessMessage('Kullanıcı başarıyla silindi.');
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRoleToggle = (roleId) => {
        setFormData(prev => {
            const exists = prev.selectedRoleIds.includes(roleId);
            const newRoleIds = exists
                ? prev.selectedRoleIds.filter(id => id !== roleId)
                : [...prev.selectedRoleIds, roleId];

            return { ...prev, selectedRoleIds: newRoleIds };
        });
    };

    const handleDirectPermToggle = (permId) => {
        setFormData(prev => {
            const exists = prev.selectedDirectPermIds.includes(permId);
            const newDirect = exists
                ? prev.selectedDirectPermIds.filter(id => id !== permId)
                : [...prev.selectedDirectPermIds, permId];

            return { ...prev, selectedDirectPermIds: newDirect };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editingUser) {
                await adminApi.updateUser(editingUser.id, {
                    username: formData.username,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password || null,
                    isActive: formData.isActive,
                    roleIds: formData.selectedRoleIds,
                    directPermissionIds: formData.selectedDirectPermIds
                }, token);
                setSuccessMessage('Kullanıcı başarıyla güncellendi.');
            } else {
                await adminApi.createUser({
                    username: formData.username,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    roleIds: formData.selectedRoleIds,
                    directPermissionIds: formData.selectedDirectPermIds
                }, token);
                setSuccessMessage('Yeni kullanıcı başarıyla eklendi.');
            }
            setShowModal(false);
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    // Helper: Compute inherited permissions from currently selected roles in form
    const getInheritedPermissionsFromSelectedRoles = () => {
        const inheritedMap = {};
        formData.selectedRoleIds.forEach(roleId => {
            const role = roles.find(r => r.id === roleId);
            if (role && role.permissions) {
                role.permissions.forEach(p => {
                    if (!inheritedMap[p.id]) {
                        inheritedMap[p.id] = role.name;
                    }
                });
            }
        });
        return inheritedMap;
    };

    const inheritedPerms = getInheritedPermissionsFromSelectedRoles();

    return (
        <div className="admin-view-container">
            <div className="admin-header">
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserIcon /> Kullanıcı Yönetimi
                    </h2>
                    <p className="admin-subtext">Sistemdeki kullanıcıları listeleyin, ekleyin, düzenleyin ve dinamik yetkilerini belirleyin.</p>
                </div>
                <button className="admin-primary-btn" onClick={handleOpenCreateModal}>
                    <PlusIcon /> Yeni Kullanıcı Ekle
                </button>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {successMessage && <div className="admin-alert success">{successMessage}</div>}

            {loading ? (
                <div className="admin-loading">Kullanıcılar yükleniyor...</div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Kullanıcı Adı</th>
                                <th>E-Posta / Telefon</th>
                                <th>Roller</th>
                                <th>Yetki Durumu</th>
                                <th>Durum</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center">Kullanıcı bulunamadı.</td>
                                </tr>
                            ) : (
                                users.map(u => (
                                    <tr key={u.id}>
                                        <td>#{u.id}</td>
                                        <td>
                                            <strong className="user-name">{u.username}</strong>
                                        </td>
                                        <td>
                                            <div className="user-contact">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <MailIcon /> {u.email || '-'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <PhoneIcon /> {u.phone || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="badge-list">
                                                {u.roles && u.roles.length > 0 ? (
                                                    u.roles.map(r => {
                                                        const style = getRoleColorStyle(r.name, r.id);
                                                        return (
                                                            <span
                                                                key={r.id}
                                                                className="badge role-badge"
                                                                style={{
                                                                    backgroundColor: style.bg,
                                                                    color: style.color,
                                                                    border: `1px solid ${style.border}`,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '3px 9px',
                                                                    borderRadius: '6px',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                <ShieldIcon /> {r.name}
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="badge muted-badge">Rolsüz</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="perm-summary">
                                                {u.permissions ? (
                                                    <span>
                                                        {u.permissions.filter(p => p.isFromRole || p.isDirect).length} Yetki
                                                    </span>
                                                ) : '0 Yetki'}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                                                {u.isActive ? '● Aktif' : '○ Pasif'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn edit-btn"
                                                    title="Düzenle ve Yetkileri Yönet"
                                                    onClick={() => handleOpenEditModal(u)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <EditIcon /> Düzenle
                                                </button>
                                                <button
                                                    className={`action-btn toggle-btn ${u.isActive ? 'warning' : 'success'}`}
                                                    title="Durumu Değiştir"
                                                    onClick={() => handleToggleStatus(u.id)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {u.isActive ? <><PauseIcon /> Pasif Yap</> : <><PlayIcon /> Aktif Yap</>}
                                                </button>
                                                <button
                                                    className="action-btn delete-btn"
                                                    title="Kullanıcıyı Sil"
                                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <TrashIcon /> Sil
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL */}
            {showModal && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <div className="admin-modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingUser ? <><EditIcon /> Kullanıcı Düzenle: {editingUser.username}</> : <><PlusIcon /> Yeni Kullanıcı Ekle</>}
                            </h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="admin-modal-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Kullanıcı Adı *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="Kullanıcı adı girin..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{editingUser ? 'Yeni Şifre (Boş bırakılabilir)' : 'Şifre *'}</label>
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? 'Değiştirmek istemiyorsanız boş bırakın' : 'Şifre girin...'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>E-Posta</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="ornek@geomap.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Telefon</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="05xxxxxxxxx"
                                    />
                                </div>
                            </div>

                            {/* ROLES SECTION */}
                            <div className="section-divider">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldIcon /> Rol Seçimi
                                </h4>
                                <p className="section-help">Kullanıcıya tanımlanacak rolleri seçin.</p>
                            </div>
                            <div className="roles-checkbox-grid">
                                {roles.map(r => {
                                    const style = getRoleColorStyle(r.name, r.id);
                                    const isSelected = formData.selectedRoleIds.includes(r.id);
                                    return (
                                        <label
                                            key={r.id}
                                            className={`checkbox-card ${isSelected ? 'selected' : ''}`}
                                            style={{
                                                borderColor: isSelected ? style.color : 'rgba(255, 255, 255, 0.1)',
                                                backgroundColor: isSelected ? style.bg : 'transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleRoleToggle(r.id)}
                                            />
                                            <div className="checkbox-info">
                                                <strong style={{ color: isSelected ? style.color : 'inherit' }}>{r.name}</strong>
                                                <small>{r.description}</small>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            {/* DYNAMIC PERMISSIONS SECTION */}
                            <div className="section-divider">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <KeyIcon /> Kullanıcı Yetkileri (Dinamik Yetkilendirme)
                                </h4>
                                <p className="section-help">
                                    Aşağıda sistemdeki tüm yetkiler listelenmektedir. Seçili rollerden gelen yetkiler <strong>otomatik olarak seçili ve kilitlidir</strong>.
                                </p>
                            </div>

                            <div className="permissions-grid">
                                {permissions.map(p => {
                                    const isInherited = !!inheritedPerms[p.id];
                                    const roleName = inheritedPerms[p.id];
                                    const isDirectChecked = formData.selectedDirectPermIds.includes(p.id);
                                    const isChecked = isInherited || isDirectChecked;

                                    return (
                                        <div
                                            key={p.id}
                                            className={`perm-item-card ${isInherited ? 'inherited' : isDirectChecked ? 'direct-checked' : ''}`}
                                        >
                                            <div className="perm-item-header">
                                                <input
                                                    type="checkbox"
                                                    id={`perm-${p.id}`}
                                                    checked={isChecked}
                                                    disabled={isInherited}
                                                    onChange={() => !isInherited && handleDirectPermToggle(p.id)}
                                                />
                                                <label htmlFor={`perm-${p.id}`} className="perm-label">
                                                    <strong>{p.name}</strong>
                                                    <span className="perm-code">({p.code})</span>
                                                </label>
                                            </div>

                                            <div className="perm-description">{p.description}</div>

                                            <div className="perm-source-tag">
                                                {isInherited ? (
                                                    <span className="badge inherited-badge" title="Bu yetki kullanıcının rolünden gelmektedir ve tekrar değiştirilemez.">
                                                        <ShieldIcon /> Rolden Geliyor ({roleName})
                                                    </span>
                                                ) : isDirectChecked ? (
                                                    <span className="badge direct-badge">
                                                        <ZapIcon /> Doğrudan Atanmış
                                                    </span>
                                                ) : (
                                                    <span className="badge unassigned-badge">
                                                        Atanmadı
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="admin-modal-footer">
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingUser ? 'Kullanıcıyı Güncelle' : 'Kullanıcıyı Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
