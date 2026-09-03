import React, { useState, useEffect } from 'react';
import { userPersonalApi } from '../../services/userPersonalApi';
import { translations } from '../../translations';
import { formatDuration } from '../../utils/formatUtils';

export default function UserProfileDrawer({
    isOpen,
    onClose,
    currentUser,
    token,
    isDarkMode = true,
    t = translations.tr,
    lang = 'tr',
    onLoadSavedRouteOnMap,
    onFocusPoiOnMap,
    onStartDirectionsToPoi,
    onLogout
}) {
    const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'favorites' | 'account'
    const [savedRoutes, setSavedRoutes] = useState([]);
    const [favoritePois, setFavoritePois] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const trans = t || (translations[lang] || translations.tr);

    useEffect(() => {
        if (isOpen && token) {
            loadPersonalData();
        }
    }, [isOpen, token]);

    const loadPersonalData = async () => {
        try {
            setLoading(true);
            setError('');
            const [routesRes, favsRes] = await Promise.all([
                userPersonalApi.getSavedRoutes(token).catch(() => []),
                userPersonalApi.getFavorites(token).catch(() => [])
            ]);
            setSavedRoutes(routesRes || []);
            setFavoritePois(favsRes || []);
        } catch (err) {
            setError(err.message || (lang === 'tr' ? 'Veriler yüklenemedi.' : 'Failed to load data.'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoute = async (routeId, e) => {
        e.stopPropagation();
        if (!window.confirm(trans.deleteRouteConfirm || 'Bu kayıtlı güzergahı silmek istediğinize emin misiniz?')) return;
        try {
            await userPersonalApi.deleteSavedRoute(routeId, token);
            setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
            setSuccessMsg(trans.routeDeletedSuccess || 'Güzergah silindi.');
            setTimeout(() => setSuccessMsg(''), 2500);
        } catch (err) {
            setError(err.message || (lang === 'tr' ? 'Güzergah silinemedi.' : 'Failed to delete route.'));
        }
    };

    const handleRemoveFavorite = async (poiId, e) => {
        e.stopPropagation();
        try {
            await userPersonalApi.toggleFavorite(poiId, token);
            setFavoritePois(prev => prev.filter(f => f.poiId !== poiId));
            setSuccessMsg(trans.favRemovedSuccess || 'Favorilerden kaldırıldı.');
            setTimeout(() => setSuccessMsg(''), 2500);
        } catch (err) {
            setError(err.message || (lang === 'tr' ? 'Favoriden çıkarılamadı.' : 'Failed to remove favorite.'));
        }
    };

    if (!isOpen) return null;

    const username = currentUser?.username || (lang === 'tr' ? 'Kullanıcı' : 'User');
    const role = currentUser?.role || 'Viewer';
    const email = currentUser?.email || '';

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(5px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                animation: 'fadeIn 0.18s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '450px',
                    maxWidth: '94vw',
                    maxHeight: '84vh',
                    backgroundColor: isDarkMode ? '#0b1329' : '#ffffff',
                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '14px',
                    border: `1px solid ${isDarkMode ? '#1e2e4a' : '#e2e8f0'}`,
                    overflow: 'hidden',
                    animation: 'scaleUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                            fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                        }}>
                            {username[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                    {username}
                                </h3>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    backgroundColor: role === 'Admin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                                    color: role === 'Admin' ? '#ef4444' : '#38bdf8',
                                    border: `1px solid ${role === 'Admin' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 99, 235, 0.3)'}`
                                }}>
                                    {role}
                                </span>
                            </div>
                            {email ? (
                                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '1px' }}>
                                    {email}
                                </div>
                            ) : (
                                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '1px' }}>
                                    {trans.profileTitle}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f1f5f9'; e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#000000'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                        title={trans.closeBtn || 'Kapat'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Tabs Bar */}
                <div style={{
                    display: 'flex',
                    borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
                    padding: '0 12px',
                    backgroundColor: isDarkMode ? '#080d1a' : '#f1f5f9'
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('routes')}
                        style={{
                            flex: 1,
                            padding: '11px 4px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'routes' ? '2.5px solid #10b981' : '2.5px solid transparent',
                            color: activeTab === 'routes' ? '#10b981' : (isDarkMode ? '#94a3b8' : '#64748b'),
                            fontWeight: activeTab === 'routes' ? 700 : 500,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                        <span>{trans.tabRoutes} ({savedRoutes.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('favorites')}
                        style={{
                            flex: 1,
                            padding: '11px 4px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'favorites' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
                            color: activeTab === 'favorites' ? '#f59e0b' : (isDarkMode ? '#94a3b8' : '#64748b'),
                            fontWeight: activeTab === 'favorites' ? 700 : 500,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span>{trans.tabFavorites} ({favoritePois.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('account')}
                        style={{
                            flex: 1,
                            padding: '11px 4px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'account' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                            color: activeTab === 'account' ? '#38bdf8' : (isDarkMode ? '#94a3b8' : '#64748b'),
                            fontWeight: activeTab === 'account' ? 700 : 500,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>{trans.tabAccount}</span>
                    </button>
                </div>

                {/* Notifications & Alerts */}
                {successMsg && (
                    <div style={{ margin: '10px 16px 0', padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '7px', fontSize: '11.5px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        <span>{successMsg}</span>
                    </div>
                )}
                {error && (
                    <div style={{ margin: '10px 16px 0', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '7px', fontSize: '11.5px', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Body Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '12px' }}>
                            <div style={{ width: '24px', height: '24px', margin: '0 auto 8px', border: '2.5px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            {lang === 'tr' ? 'Yükleniyor...' : 'Loading...'}
                        </div>
                    )}

                    {/* TAB 1: KAYDEDİLEN GÜZERGAHLAR */}
                    {!loading && activeTab === 'routes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {savedRoutes.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '36px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
                                    border: `1px dashed ${isDarkMode ? '#334155' : '#cbd5e1'}`
                                }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.6" style={{ margin: '0 auto 8px' }}>
                                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                    </svg>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 600, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{trans.noSavedRoutes}</h4>
                                    <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                                        {trans.noSavedRoutesHint}
                                    </p>
                                </div>
                            ) : (
                                savedRoutes.map(route => (
                                    <div
                                        key={route.id}
                                        style={{
                                            backgroundColor: isDarkMode ? '#131e36' : '#ffffff',
                                            borderRadius: '10px',
                                            border: `1px solid ${isDarkMode ? '#1e2e4a' : '#e2e8f0'}`,
                                            padding: '12px 13px',
                                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                                            transition: 'border-color 0.15s ease',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            if (onLoadSavedRouteOnMap) {
                                                onLoadSavedRouteOnMap(route);
                                                onClose();
                                            }
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#10b981'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.borderColor = isDarkMode ? '#1e2e4a' : '#e2e8f0'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {route.title}
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>{route.startPointName}</span>
                                                    <span>→</span>
                                                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{route.targetPoiName}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => handleDeleteRoute(route.id, e)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#64748b',
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px'
                                                }}
                                                title={trans.btnDelete || 'Sil'}
                                                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`, paddingTop: '8px', marginTop: '3px' }}>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <span style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '5px',
                                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 19L20 5" /></svg>
                                                    {route.distanceKm > 0 ? `${route.distanceKm} ${trans.kmUnit || 'km'}` : '-'}
                                                </span>
                                                {route.durationMinutes > 0 && (
                                                    <span style={{
                                                        fontSize: '10.5px',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        borderRadius: '5px',
                                                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                                        color: '#38bdf8',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                        {formatDuration(route.durationMinutes, lang)}
                                                    </span>
                                                )}
                                            </div>

                                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                {trans.showOnMap} →
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* TAB 2: FAVORİ POI'LER */}
                    {!loading && activeTab === 'favorites' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {favoritePois.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '36px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
                                    border: `1px dashed ${isDarkMode ? '#334155' : '#cbd5e1'}`
                                }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.6" style={{ margin: '0 auto 8px' }}>
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 600, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{trans.noFavoritePois}</h4>
                                    <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                                        {trans.noFavoritePoisHint}
                                    </p>
                                </div>
                            ) : (
                                favoritePois.map(fav => (
                                    <div
                                        key={fav.id}
                                        style={{
                                            backgroundColor: isDarkMode ? '#131e36' : '#ffffff',
                                            borderRadius: '10px',
                                            border: `1px solid ${isDarkMode ? '#1e2e4a' : '#e2e8f0'}`,
                                            padding: '12px 13px',
                                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                            <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '30px',
                                                    height: '30px',
                                                    borderRadius: '8px',
                                                    backgroundColor: fav.categoryColor || '#3b82f6',
                                                    color: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '13px',
                                                    flexShrink: 0
                                                }}>
                                                    <i className={fav.categoryIcon || 'pi pi-map-marker'} />
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                                                        {fav.poiName}
                                                    </h4>
                                                    <span style={{ fontSize: '11px', color: fav.categoryColor || '#38bdf8', fontWeight: 600 }}>
                                                        {fav.categoryName || 'POI'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => handleRemoveFavorite(fav.poiId, e)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#f59e0b',
                                                    padding: '3px',
                                                    cursor: 'pointer'
                                                }}
                                                title={lang === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites'}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            </button>
                                        </div>

                                        {fav.description && (
                                            <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.3 }}>
                                                {fav.description}
                                            </p>
                                        )}

                                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`, paddingTop: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onFocusPoiOnMap) {
                                                        onFocusPoiOnMap(fav);
                                                        onClose();
                                                    }
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '6px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                                    backgroundColor: isDarkMode ? '#0b1329' : '#f8fafc',
                                                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                <span>{trans.showOnMap}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onStartDirectionsToPoi) {
                                                        onStartDirectionsToPoi(fav);
                                                        onClose();
                                                    }
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '6px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    backgroundColor: '#10b981',
                                                    color: '#ffffff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                                                <span>{trans.getDirections}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* TAB 3: HESAP BİLGİLERİ */}
                    {!loading && activeTab === 'account' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{
                                backgroundColor: isDarkMode ? '#131e36' : '#ffffff',
                                borderRadius: '10px',
                                border: `1px solid ${isDarkMode ? '#1e2e4a' : '#e2e8f0'}`,
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
                                    {trans.accountInfo}
                                </h4>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                    <span style={{ color: '#94a3b8' }}>{trans.usernameLabel}:</span>
                                    <span style={{ fontWeight: 600 }}>{username}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                    <span style={{ color: '#94a3b8' }}>{trans.emailLabel}:</span>
                                    <span style={{ fontWeight: 600 }}>{email || (lang === 'tr' ? 'Belirtilmedi' : 'Not specified')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                    <span style={{ color: '#94a3b8' }}>{trans.userRoleLabel}:</span>
                                    <span style={{ fontWeight: 700, color: role === 'Admin' ? '#ef4444' : '#38bdf8' }}>{role}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                    <span style={{ color: '#94a3b8' }}>{trans.savedRoutesCount}</span>
                                    <span style={{ fontWeight: 600 }}>{savedRoutes.length} {lang === 'tr' ? 'Adet' : 'Items'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                    <span style={{ color: '#94a3b8' }}>{trans.favoritePoisCount}</span>
                                    <span style={{ fontWeight: 600 }}>{favoritePois.length} {lang === 'tr' ? 'Adet' : 'Items'}</span>
                                </div>
                            </div>

                            {onLogout && (
                                <button
                                    type="button"
                                    onClick={onLogout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '10px',
                                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        marginTop: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                    <span>{trans.logoutBtn}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
