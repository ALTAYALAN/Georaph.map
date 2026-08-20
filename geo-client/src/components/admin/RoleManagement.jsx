import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import { getRoleColorStyle } from './UserManagement';

// SVG Icons
const ShieldIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const UserIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const EditIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const KeyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
);

export const RoleManagement = ({ token }) => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        selectedPermIds: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [rolesData, permsData] = await Promise.all([
                adminApi.getRoles(token),
                adminApi.getPermissions(token)
            ]);
            setRoles(rolesData);
            setPermissions(permsData);
        } catch (err) {
            setError(err.message || 'Veriler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            description: '',
            selectedPermIds: []
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (role) => {
        setEditingRole(role);
        const permIds = role.permissions ? role.permissions.map(p => p.id) : [];
        setFormData({
            name: role.name,
            description: role.description || '',
            selectedPermIds: permIds
        });
        setShowModal(true);
    };

    const handleDeleteRole = async (roleId, roleName) => {
        if (!window.confirm(`"${roleName}" rolünü silmek istediğinize emin misiniz? Bu role sahip kullanıcıların rol tanımları kaldırılacaktır.`)) return;
        try {
            await adminApi.deleteRole(roleId, token);
            setSuccessMessage('Rol başarıyla silindi.');
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePermToggle = (permId) => {
        setFormData(prev => {
            const exists = prev.selectedPermIds.includes(permId);
            const newPerms = exists
                ? prev.selectedPermIds.filter(id => id !== permId)
                : [...prev.selectedPermIds, permId];

            return { ...prev, selectedPermIds: newPerms };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editingRole) {
                await adminApi.updateRole(editingRole.id, {
                    name: formData.name,
                    description: formData.description,
                    permissionIds: formData.selectedPermIds
                }, token);
                setSuccessMessage('Rol başarıyla güncellendi.');
            } else {
                await adminApi.createRole({
                    name: formData.name,
                    description: formData.description,
                    permissionIds: formData.selectedPermIds
                }, token);
                setSuccessMessage('Yeni rol başarıyla oluşturuldu.');
            }
            setShowModal(false);
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-view-container">
            <div className="admin-header">
                <div>
                    <h2>Rol Listesi ve Yetki Yönetimi</h2>
                    <p className="admin-subtext">Sistemdeki rolleri ve bu rollere bağlı varsayılan yetkileri yönetin.</p>
                </div>
                <button className="admin-primary-btn" onClick={handleOpenCreateModal}>
                    <PlusIcon /> Yeni Rol Ekle
                </button>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {successMessage && <div className="admin-alert success">{successMessage}</div>}

            {loading ? (
                <div className="admin-loading">Roller yükleniyor...</div>
            ) : (
                <div className="roles-cards-grid">
                    {roles.length === 0 ? (
                        <div className="no-data">Rol bulunamadı.</div>
                    ) : (
                        roles.map(role => {
                            const style = getRoleColorStyle(role.name, role.id);
                            return (
                                <div
                                    key={role.id}
                                    className="role-card"
                                    style={{
                                        borderLeft: `4px solid ${style.color}`,
                                        background: `linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, ${style.bg} 100%)`
                                    }}
                                >
                                    <div className="role-card-header">
                                        <div>
                                            <h3 className="role-title" style={{ color: style.color }}>
                                                {role.name}
                                            </h3>
                                            <span className="role-user-count" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <UserIcon /> {role.userCount} Kullanıcı
                                            </span>
                                        </div>
                                        <div className="role-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                className="admin-action-btn edit-icon-btn"
                                                title="Rolü Düzenle"
                                                onClick={() => handleOpenEditModal(role)}
                                            >
                                                <EditIcon size={16} />
                                            </button>
                                            <button
                                                className="admin-action-btn delete-icon-btn"
                                                title="Rolü Sil"
                                                onClick={() => handleDeleteRole(role.id, role.name)}
                                            >
                                                <TrashIcon size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="role-description">{role.description || 'Açıklama girilmemiş.'}</p>

                                    <div className="role-permissions-section">
                                        <span className="role-perm-title">TANIMLI YETKİLER ({role.permissions?.length || 0})</span>
                                        <div className="role-perm-tags">
                                            {role.permissions && role.permissions.length > 0 ? (
                                                role.permissions.map(p => (
                                                    <span key={p.id} className="perm-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <KeyIcon /> {p.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="muted-text">Atanmış yetki yok</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* MODAL */}
            {showModal && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <div className="admin-modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingRole ? <><EditIcon /> Rol Düzenle: {editingRole.name}</> : <><PlusIcon /> Yeni Rol Ekle</>}
                            </h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>x</button>
                        </div>
                        <form onSubmit={handleSubmit} className="admin-modal-form">
                            <div className="form-group">
                                <label>Rol Adı *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: Editör, Saha Personeli..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Açıklama</label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Rolün sorumluluk ve kapsama alanı..."
                                />
                            </div>

                            <div className="section-divider">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <KeyIcon /> Role Atanacak Yetkiler
                                </h4>
                                <p className="section-help">Bu role sahip kullanıcılar bu yetkileri otomatik kazanır.</p>
                            </div>

                            <div className="permissions-grid">
                                {permissions.map(p => {
                                    const isChecked = formData.selectedPermIds.includes(p.id);

                                    return (
                                        <div
                                            key={p.id}
                                            className={`perm-item-card ${isChecked ? 'direct-checked' : ''}`}
                                            onClick={() => handlePermToggle(p.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="perm-item-header">
                                                <input
                                                    type="checkbox"
                                                    id={`role-perm-${p.id}`}
                                                    checked={isChecked}
                                                    onChange={() => { }}
                                                />
                                                <label htmlFor={`role-perm-${p.id}`} className="perm-label">
                                                    <strong>{p.name}</strong>
                                                    <span className="perm-code">({p.code})</span>
                                                </label>
                                            </div>
                                            <div className="perm-description">{p.description}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="admin-modal-footer">
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingRole ? 'Rolü Güncelle' : 'Rolü Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
