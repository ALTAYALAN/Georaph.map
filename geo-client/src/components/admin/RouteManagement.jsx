import React, { useState, useEffect, useRef } from 'react';
import { transportApi } from '../../services/transportApi';
import { simulationHubService } from '../../services/simulationHubService';
import { translations } from '../../translations';
import { ROUTE_CLASSES, getRouteClassInfo, RouteClassIcon } from '../../constants/routeClasses';

const PRESET_COLORS = [
    { label: 'Mavi', hex: '#3b82f6' },
    { label: 'Kırmızı', hex: '#ef4444' },
    { label: 'Yeşil', hex: '#10b981' },
    { label: 'Turuncu', hex: '#f59e0b' },
    { label: 'Mor', hex: '#8b5cf6' },
    { label: 'Pembe', hex: '#ec4899' },
    { label: 'Teal', hex: '#14b8a6' },
    { label: 'Koyu Gri', hex: '#475569' }
];

export const RouteManagement = ({ 
    token, 
    isDarkMode, 
    onEditRouteGeometryOnMap, 
    onRepositionStopOnMap, 
    lang = 'tr', 
    t,
    activeSimulations: propActiveSimulations,
    setActiveSimulations: propSetActiveSimulations,
    simLoadingId: propSimLoadingId,
    setSimLoadingId: propSetSimLoadingId
}) => {
    const trans = t || (translations[lang] || translations.tr);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Canlı Simülasyon Durumları (SignalR)
    const [internalActiveSimulations, setInternalActiveSimulations] = useState({});
    const activeSimulations = propActiveSimulations !== undefined ? propActiveSimulations : internalActiveSimulations;
    const setActiveSimulations = propSetActiveSimulations !== undefined ? propSetActiveSimulations : setInternalActiveSimulations;

    const [internalSimLoadingId, setInternalSimLoadingId] = useState(null);
    const simLoadingId = propSimLoadingId !== undefined ? propSimLoadingId : internalSimLoadingId;
    const setSimLoadingId = propSetSimLoadingId !== undefined ? propSetSimLoadingId : setInternalSimLoadingId;

    // Selected Route for Stop Reordering & Inspection
    const [selectedRouteId, setSelectedRouteId] = useState(null);
    const [routeStops, setRouteStops] = useState([]);

    // Drag & Drop State
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [isReordering, setIsReordering] = useState(false);

    // Modals
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [isEditingRoute, setIsEditingRoute] = useState(false);
    const [routeForm, setRouteForm] = useState({ id: null, name: '', color: '#3b82f6', routeClass: 'araba', description: '', isActive: true });

    const [showStopModal, setShowStopModal] = useState(false);
    const [isEditingStop, setIsEditingStop] = useState(false);
    const [stopForm, setStopForm] = useState({ id: null, name: '', routeId: null, description: '', orderIndex: 1, wkt: '', isActive: true });
    const [isGeneratingRouteId, setIsGeneratingRouteId] = useState(null);

    // SignalR Simülasyon Dinleyicileri
    useEffect(() => {
        simulationHubService.getActiveSimulations().then(list => {
            if (Array.isArray(list)) {
                const map = {};
                list.forEach(s => { map[s.routeId] = s; });
                setActiveSimulations(map);
            }
        });

        const unsubStarted = simulationHubService.onSimulationStarted(status => {
            if (status?.routeId) {
                setActiveSimulations(prev => ({ ...prev, [status.routeId]: { ...status, isRunning: true, isPaused: false } }));
            }
        });

        const unsubPaused = simulationHubService.onSimulationPaused(data => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (rId) {
                const num = Number(rId);
                setActiveSimulations(prev => {
                    // Sadece listede zaten varsa duraklat
                    if (!prev[rId] && !prev[num] && !prev[String(num)]) return prev;
                    return {
                        ...prev,
                        [rId]: { ...(prev[rId] || prev[num] || {}), isPaused: true },
                        [num]: { ...(prev[num] || prev[rId] || {}), isPaused: true }
                    };
                });
            }
        });

        const unsubResumed = simulationHubService.onSimulationResumed(data => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (rId) {
                const num = Number(rId);
                setActiveSimulations(prev => {
                    // Sadece listede zaten varsa devam ettir
                    if (!prev[rId] && !prev[num] && !prev[String(num)]) return prev;
                    return {
                        ...prev,
                        [rId]: { ...(prev[rId] || prev[num] || {}), isPaused: false },
                        [num]: { ...(prev[num] || prev[rId] || {}), isPaused: false }
                    };
                });
            }
        });

        const unsubStopped = simulationHubService.onSimulationStopped(data => {
            const rId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (rId) {
                const num = Number(rId);
                setActiveSimulations(prev => {
                    const next = { ...prev };
                    delete next[rId];
                    delete next[num];
                    delete next[String(num)];
                    return next;
                });
            }
        });

        const unsubStateChanged = simulationHubService.onSimulationStateChanged(data => {
            if (!data?.routeId) return;
            const num = Number(data.routeId);
            if (data.isRunning) {
                setActiveSimulations(prev => ({
                    ...prev,
                    [data.routeId]: { ...(prev[data.routeId] || {}), isRunning: true, isPaused: false },
                    [num]: { ...(prev[num] || {}), isRunning: true, isPaused: false },
                    [String(num)]: { ...(prev[String(num)] || {}), isRunning: true, isPaused: false }
                }));
            } else {
                setActiveSimulations(prev => {
                    const next = { ...prev };
                    delete next[data.routeId];
                    delete next[num];
                    delete next[String(num)];
                    return next;
                });
            }
        });

        const unsubCompleted = simulationHubService.onSimulationCompleted(() => {
            // Hat sefer döngüsünde çalıştığından burada simülasyon silinmez
        });

        return () => {
            unsubStarted();
            unsubPaused();
            unsubResumed();
            unsubStopped();
            unsubStateChanged();
            unsubCompleted();
        };
    }, []);

    const handleStartSimulationFromAdmin = async (routeId, e) => {
        e?.stopPropagation();
        const numId = Number(routeId);
        try {
            // Durdurulmuşlar listesinden temizle ki haritada araç engellenmesin
            try {
                const raw = sessionStorage.getItem('stopped_sim_routes');
                if (raw) {
                    const set = new Set(JSON.parse(raw));
                    set.delete(numId);
                    set.delete(routeId);
                    set.delete(String(numId));
                    set.delete(String(routeId));
                    sessionStorage.setItem('stopped_sim_routes', JSON.stringify(Array.from(set)));
                }
            } catch (_) { }

            setSimLoadingId(routeId);
            const res = await simulationHubService.startSimulation(routeId, token);
            const statusObj = res?.status || {
                routeId: numId,
                isRunning: true,
                isPaused: false
            };
            setActiveSimulations(prev => ({
                ...prev,
                [routeId]: statusObj,
                [numId]: statusObj,
                [String(routeId)]: statusObj
            }));
            setSuccessMsg('Canlı araç simülasyonu başarıyla başlatıldı!');
        } catch (err) {
            setError(err.message || 'Simülasyon başlatılamadı.');
        } finally {
            setSimLoadingId(null);
        }
    };

    const handlePauseSimulationFromAdmin = async (routeId, e) => {
        e?.stopPropagation();
        try {
            setSimLoadingId(routeId);
            setActiveSimulations(prev => ({
                ...prev,
                [routeId]: { ...(prev[routeId] || {}), isPaused: true }
            }));
            await simulationHubService.pauseSimulation(routeId, token);
            setSuccessMsg('Simülasyon duraklatıldı.');
        } catch (err) {
            setError(err.message || 'Simülasyon duraklatılamadı.');
        } finally {
            setSimLoadingId(null);
        }
    };

    const handleResumeSimulationFromAdmin = async (routeId, e) => {
        e?.stopPropagation();
        try {
            setSimLoadingId(routeId);
            setActiveSimulations(prev => ({
                ...prev,
                [routeId]: { ...(prev[routeId] || {}), isPaused: false }
            }));
            await simulationHubService.resumeSimulation(routeId, token);
            setSuccessMsg('Simülasyon devam ettiriliyor.');
        } catch (err) {
            setError(err.message || 'Simülasyon devam ettirilemedi.');
        } finally {
            setSimLoadingId(null);
        }
    };

    const handleCancelSimulationFromAdmin = async (routeId, e) => {
        e?.stopPropagation();
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            // Anında yerel durumdan temizle (haritadan kalkması için)
            setActiveSimulations(prev => {
                const next = { ...prev };
                delete next[routeId];
                delete next[numId];
                delete next[String(routeId)];
                delete next[String(numId)];
                return next;
            });
            await simulationHubService.stopSimulation(numId, token);
            setSuccessMsg('Simülasyon tamamen iptal edildi ve bitirildi.');
        } catch (err) {
            setActiveSimulations(prev => {
                const next = { ...prev };
                delete next[routeId];
                delete next[numId];
                delete next[String(routeId)];
                delete next[String(numId)];
                return next;
            });
            setError(err.message || 'Simülasyon işlemi başarısız oldu.');
        } finally {
            setSimLoadingId(null);
        }
    };

    // Toast Timer
    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    // Load Routes
    const loadRoutes = async (keepSelection = false) => {
        try {
            setLoading(true);
            setError('');
            const data = await transportApi.getRoutes(token, true);
            setRoutes(data || []);

            if (data && data.length > 0) {
                if (!keepSelection || !selectedRouteId) {
                    setSelectedRouteId(data[0].id);
                    setRouteStops(data[0].stops || []);
                } else {
                    const current = data.find(r => r.id === selectedRouteId);
                    if (current) {
                        setRouteStops(current.stops || []);
                    } else {
                        setSelectedRouteId(data[0].id);
                        setRouteStops(data[0].stops || []);
                    }
                }
            } else {
                setSelectedRouteId(null);
                setRouteStops([]);
            }
        } catch (err) {
            setError(err.message || 'Güzergahlar yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoutes();
    }, [token]);

    // Handle Route Selection
    const handleSelectRoute = (route) => {
        setSelectedRouteId(route.id);
        setRouteStops(route.stops || []);
    };

    // --- DRAG & DROP REORDERING ---
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Set drag ghost image styling if needed
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null);
            return;
        }

        const updated = [...routeStops];
        const [movedStop] = updated.splice(draggedIndex, 1);
        updated.splice(targetIndex, 0, movedStop);

        // Update local sequence
        const reordered = updated.map((item, idx) => ({
            ...item,
            orderIndex: idx + 1
        }));

        setRouteStops(reordered);
        setDraggedIndex(null);

        // Send to backend
        try {
            setIsReordering(true);
            const orderedIds = reordered.map(s => s.id);
            await transportApi.reorderStops(selectedRouteId, orderedIds, token);
            setSuccessMsg('Durak sıralaması güncellendi ve kaydedildi.');
            // Refresh route data in parent list
            setRoutes(prev => prev.map(r => r.id === selectedRouteId ? { ...r, stops: reordered } : r));
        } catch (err) {
            setError('Sıralama kaydedilemedi: ' + err.message);
            // Revert by reloading
            loadRoutes(true);
        } finally {
            setIsReordering(false);
        }
    };

    // --- ROUTE CRUD ---
    const handleOpenCreateRoute = () => {
        setRouteForm({ id: null, name: '', color: '#3b82f6', routeClass: 'araba', description: '', isActive: true });
        setIsEditingRoute(false);
        setShowRouteModal(true);
    };

    const handleOpenEditRoute = (route, e) => {
        if (e) e.stopPropagation();
        setRouteForm({
            id: route.id,
            name: route.name,
            color: route.color || '#3b82f6',
            routeClass: route.routeClass || 'araba',
            description: route.description || '',
            isActive: route.isActive !== false
        });
        setIsEditingRoute(true);
        setShowRouteModal(true);
    };

    const handleSaveRoute = async (e) => {
        e.preventDefault();
        if (!routeForm.name.trim()) {
            setError('Güzergah adı boş bırakılamaz.');
            return;
        }

        try {
            setLoading(true);
            if (isEditingRoute) {
                await transportApi.updateRoute(routeForm.id, {
                    name: routeForm.name,
                    color: routeForm.color,
                    routeClass: routeForm.routeClass || 'araba',
                    description: routeForm.description,
                    isActive: routeForm.isActive
                }, token);
                setSuccessMsg('Güzergah başarıyla güncellendi.');
            } else {
                const created = await transportApi.createRoute({
                    name: routeForm.name,
                    color: routeForm.color,
                    routeClass: routeForm.routeClass || 'araba',
                    description: routeForm.description
                }, token);
                setSuccessMsg('Yeni güzergah başarıyla oluşturuldu.');
                setSelectedRouteId(created.id);
            }
            setShowRouteModal(false);
            await loadRoutes(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoute = async (routeId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Bu güzergahı ve içerisindeki tüm durakları silmek istediğinizden emin misiniz?')) return;

        try {
            setLoading(true);
            await transportApi.deleteRoute(routeId, token);
            setSuccessMsg('Güzergah başarıyla silindi.');
            await loadRoutes();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- STOP CRUD ---
    const handleOpenCreateStop = () => {
        if (!selectedRouteId) {
            setError('Önce bir güzergah seçmelisiniz.');
            return;
        }
        setStopForm({
            id: null,
            name: '',
            routeId: selectedRouteId,
            description: '',
            orderIndex: routeStops.length + 1,
            wkt: '',
            isActive: true
        });
        setIsEditingStop(false);
        setShowStopModal(true);
    };

    const handleOpenEditStop = (stop) => {
        setStopForm({
            id: stop.id,
            name: stop.name,
            routeId: stop.routeId,
            description: stop.description || '',
            orderIndex: stop.orderIndex,
            wkt: stop.wkt || '',
            isActive: stop.isActive !== false
        });
        setIsEditingStop(true);
        setShowStopModal(true);
    };

    const handleSaveStop = async (e) => {
        e.preventDefault();
        if (!stopForm.name.trim()) {
            setError('Durak adı boş bırakılamaz.');
            return;
        }

        try {
            setLoading(true);
            if (isEditingStop) {
                await transportApi.updateStop(stopForm.id, {
                    name: stopForm.name,
                    routeId: stopForm.routeId,
                    description: stopForm.description,
                    orderIndex: stopForm.orderIndex,
                    wkt: stopForm.wkt,
                    isActive: stopForm.isActive
                }, token);
                setSuccessMsg('Durak başarıyla güncellendi.');
            } else {
                await transportApi.createStop({
                    name: stopForm.name,
                    routeId: stopForm.routeId,
                    description: stopForm.description,
                    orderIndex: stopForm.orderIndex,
                    wkt: stopForm.wkt || 'POINT(29.0234 40.9904)' // Varsayılan nokta
                }, token);
                setSuccessMsg('Durak başarıyla eklendi.');
            }
            setShowStopModal(false);
            await loadRoutes(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStop = async (stopId) => {
        if (!window.confirm('Bu durağı güzergahtan silmek istediğinizden emin misiniz?')) return;

        try {
            setLoading(true);
            await transportApi.deleteStop(stopId, token);
            setSuccessMsg('Durak güzergahtan çıkarıldı.');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // OSRM İLE OTOMATİK KARAYOLU ROTASI HESAPLAMA
    const handleGenerateOsrmRoute = async (routeId, e) => {
        if (e) e.stopPropagation();
        try {
            setIsGeneratingRouteId(routeId);
            setError('');
            const res = await transportApi.generateOsrmRoute(routeId, token);
            setSuccessMsg(res.message || 'OSRM ile gerçek karayolu rotası başarıyla oluşturuldu ve haritaya işlendi!');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'OSRM ile rota üretilirken hata oluştu.');
        } finally {
            setIsGeneratingRouteId(null);
        }
    };

    // GEOMETRİ MODU DEĞİŞTİRME (KUŞ BAKIŞI / OSRM / BÜKÜLMÜŞ)
    const handleSwitchGeometryMode = async (routeId, mode, e) => {
        if (e) e.stopPropagation();
        try {
            setIsGeneratingRouteId(routeId);
            setError('');
            const res = await transportApi.switchGeometryMode(routeId, mode, token);
            setSuccessMsg(res.message || 'Hat geometrisi başarıyla güncellendi.');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'Geometri modu değiştirilemedi.');
        } finally {
            setIsGeneratingRouteId(null);
        }
    };

    // ÖNCEKİ GEOMETRİYİ GERİ AL (UNDO / REVERT)
    const handleRevertGeometry = async (routeId, e) => {
        if (e) e.stopPropagation();
        try {
            setIsGeneratingRouteId(routeId);
            setError('');
            const res = await transportApi.revertGeometry(routeId, token);
            setSuccessMsg(res.message || 'Hat geometrisi önceki haline geri alındı.');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'Önceki geometriye dönülemedi.');
        } finally {
            setIsGeneratingRouteId(null);
        }
    };

    const selectedRoute = routes.find(r => r.id === selectedRouteId);
    const totalStopsCount = routes.reduce((acc, r) => acc + (r.stops ? r.stops.length : 0), 0);

    return (
        <div className="route-management-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            {/* Header & Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="13" rx="2" />
                            <path d="M4 9h16" />
                            <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                            <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                            <path d="M6 17v2.5M18 17v2.5" />
                        </svg>
                        {lang === 'tr' ? 'Güzergah & Durak Yönetimi' : 'Route & Stop Management'}
                    </h2>
                    <p style={{ margin: 0, color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '13.5px' }}>
                        {lang === 'tr' 
                            ? 'Akıllı Ulaşım Modülü: Hat tanımları, durak sıralama ve sürükle-bırak entegrasyonu' 
                            : 'Smart Transport Module: Line definitions, stop sequencing, and drag-and-drop integration'}
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateRoute}
                    className="btn btn-primary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '13.5px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: 'none'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {lang === 'tr' ? 'Yeni Güzergah Ekle' : 'Add New Route'}
                </button>
            </div>

            {/* Notification Alerts */}
            {error && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
            )}
            {successMsg && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
            )}

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderRadius: '12px', background: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Toplam Güzergah</div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#3b82f6' }}>{routes.length}</div>
                </div>
                <div style={{ padding: '16px 20px', borderRadius: '12px', background: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Toplam Durak</div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#10b981' }}>{totalStopsCount}</div>
                </div>
                <div style={{ padding: '16px 20px', borderRadius: '12px', background: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Aktif Hatlar</div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#f59e0b' }}>{routes.filter(r => r.isActive).length}</div>
                </div>
            </div>

            {/* 2-Column Split: Left = Route List, Right = Stop Reordering & Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(400px, 1.5fr)', gap: '24px' }}>
                {/* Left: Routes List */}
                <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Güzergahlar</h3>
                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '20px', background: isDarkMode ? '#334155' : '#e2e8f0', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            {routes.length} Hat
                        </span>
                    </div>

                    {routes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: '#64748b' }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <div>Henüz tanımlı güzergah bulunmuyor.</div>
                            <button onClick={handleOpenCreateRoute} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>
                                Yeni bir güzergah ekleyin
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {routes.map(route => {
                                const isSelected = route.id === selectedRouteId;
                                return (
                                    <div
                                        key={route.id}
                                        onClick={() => handleSelectRoute(route)}
                                        style={{
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            border: `2px solid ${isSelected ? (route.color || '#3b82f6') : (isDarkMode ? '#334155' : '#e2e8f0')}`,
                                            background: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#f0f7ff') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                            <span
                                                style={{
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '50%',
                                                    backgroundColor: route.color || '#3b82f6',
                                                    flexShrink: 0,
                                                    boxShadow: 'none'
                                                }}
                                            />
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {(() => {
                                                        const rClassInfo = getRouteClassInfo(route.routeClass);
                                                        return (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    backgroundColor: rClassInfo.bg,
                                                                    color: rClassInfo.color,
                                                                    border: `1px solid ${rClassInfo.border}`,
                                                                    flexShrink: 0
                                                                }}
                                                                title={`Ulaşım Sınıfı: ${rClassInfo.label}`}
                                                            >
                                                                <RouteClassIcon classKey={rClassInfo.id} size={13} color={rClassInfo.color} />
                                                                <span>{rClassInfo.shortLabel}</span>
                                                            </span>
                                                        );
                                                    })()}
                                                    <span style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {route.name}
                                                    </span>
                                                    {activeSimulations[route.id]?.isRunning && (
                                                        <span className="sim-live-indicator" style={{ padding: '1px 6px', fontSize: '9.5px', gap: '4px' }}>
                                                            <span className="live-pulse-dot" style={{ width: '5px', height: '5px' }}></span>
                                                            <span>CANLI SİMÜLASYON</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                                    <span>{route.stops ? route.stops.length : 0} Durak</span>
                                                    {route.description && (
                                                        <>
                                                            <span>•</span>
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{route.description}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {/* CANLI ARAÇ SİMÜLASYONU KONTROLLERİ */}
                                            {(() => {
                                                const currentSim = activeSimulations[route.id] || activeSimulations[Number(route.id)] || activeSimulations[String(route.id)];
                                                const isRunning = Boolean(currentSim?.isRunning);
                                                const isPaused = Boolean(currentSim?.isPaused);

                                                if (isRunning) {
                                                    return (
                                                        <>
                                                            {/* DURAKLAT VEYA DEVAM ET BUTONU */}
                                                            {isPaused ? (
                                                                <button
                                                                    onClick={(e) => handleResumeSimulationFromAdmin(route.id, e)}
                                                                    disabled={simLoadingId === route.id}
                                                                    title="Duraklatılan simülasyona kaldığı yerden devam et"
                                                                    style={{
                                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                                        border: '1px solid #10b981',
                                                                        color: '#10b981',
                                                                        padding: '5px 8px',
                                                                        cursor: 'pointer',
                                                                        borderRadius: '6px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                                    </svg>
                                                                    <span>Devam Et</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => handlePauseSimulationFromAdmin(route.id, e)}
                                                                    disabled={simLoadingId === route.id}
                                                                    title="Simülasyon hareketini anlık olarak duraklat"
                                                                    style={{
                                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                                        border: '1px solid #f59e0b',
                                                                        color: '#f59e0b',
                                                                        padding: '5px 8px',
                                                                        cursor: 'pointer',
                                                                        borderRadius: '6px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                                                    </svg>
                                                                    <span>Duraklat</span>
                                                                </button>
                                                            )}

                                                            {/* İPTAL ET / SİMÜLASYONU TAMAMEN KAPAT BUTONU */}
                                                            <button
                                                                onClick={(e) => handleCancelSimulationFromAdmin(route.id, e)}
                                                                disabled={simLoadingId === route.id}
                                                                title="Simülasyonu anında kapat ve aracı haritadan kaldır"
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    border: '1px solid #ef4444',
                                                                    color: '#ef4444',
                                                                    padding: '5px 8px',
                                                                    cursor: 'pointer',
                                                                    borderRadius: '6px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                                                    <rect x="4" y="4" width="16" height="16" rx="2" />
                                                                </svg>
                                                                <span>İptal Et</span>
                                                            </button>
                                                        </>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        onClick={(e) => handleStartSimulationFromAdmin(route.id, e)}
                                                        disabled={simLoadingId === route.id || (!route.stops || route.stops.length < 2 && !route.wkt)}
                                                        title="Güzergah üzerinde canlı araç simülasyonu başlat"
                                                        style={{
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        border: '1px solid #10b981',
                                                        color: '#10b981',
                                                        padding: '5px 8px',
                                                        cursor: 'pointer',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                    <span>Simülasyonu Başlat</span>
                                                </button>
                                            );
                                        })()}

                                            <button
                                                onClick={(e) => handleGenerateOsrmRoute(route.id, e)}
                                                disabled={isGeneratingRouteId === route.id || !route.stops || route.stops.length < 2}
                                                title={(!route.stops || route.stops.length < 2) ? 'Rota için en az 2 durak gereklidir' : 'OSRM ile Karayolu Rotasını Hesapla ve Kaydet'}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: (!route.stops || route.stops.length < 2) ? '#64748b' : '#10b981',
                                                    padding: '6px',
                                                    cursor: (!route.stops || route.stops.length < 2) ? 'not-allowed' : 'pointer',
                                                    borderRadius: '6px',
                                                    opacity: (!route.stops || route.stops.length < 2) ? 0.4 : 1
                                                }}
                                                onMouseOver={(e) => { if (route.stops?.length >= 2) e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleOpenEditRoute(route, e)}
                                                title="Düzenle"
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                onMouseOver={(e) => e.currentTarget.style.color = '#3b82f6'}
                                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteRoute(route.id, e)}
                                                title="Sil"
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Selected Route Duraklar & Drag & Drop Reordering */}
                <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedRoute ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: selectedRoute.color || '#3b82f6' }} />
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                                            {selectedRoute.name}
                                        </h3>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            Durakları sürükleyip bırakarak güzergah sırasını değiştirin
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {/* GEOMETRİ SEÇİM GRUBU (KUŞ BAKIŞI / OSRM / ÖZEL BÜKÜM) */}
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
                                        padding: '3px',
                                        borderRadius: '8px',
                                        gap: '2px',
                                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`
                                    }}>
                                        {/* KUŞ BAKIŞI / DOĞRUSAL BUTONU */}
                                        <button
                                            type="button"
                                            onClick={(e) => handleSwitchGeometryMode(selectedRoute.id, 'direct', e)}
                                            disabled={isGeneratingRouteId === selectedRoute.id}
                                            style={{
                                                padding: '5px 10px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: !selectedRoute.wkt ? '#2563eb' : 'transparent',
                                                color: !selectedRoute.wkt ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#475569'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                            title="Duraklar arası doğrudan düz çizgi (Kuş Bakışı / Şematik Metro)"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="5" y1="12" x2="19" y2="12"/><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/></svg>
                                            {trans.modeDirect || 'Kuş Bakışı'}
                                        </button>

                                        {/* OSRM KARAYOLU BUTONU */}
                                        <button
                                            type="button"
                                            onClick={(e) => handleGenerateOsrmRoute(selectedRoute.id, e)}
                                            disabled={isGeneratingRouteId === selectedRoute.id || routeStops.length < 2}
                                            style={{
                                                padding: '5px 10px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: routeStops.length < 2 || isGeneratingRouteId === selectedRoute.id ? 'not-allowed' : 'pointer',
                                                backgroundColor: selectedRoute.geometryType === 'Osrm' && selectedRoute.wkt ? '#059669' : 'transparent',
                                                color: selectedRoute.geometryType === 'Osrm' && selectedRoute.wkt ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#475569'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                            title="Open Source Routing Machine ile sokakları ve caddeleri takip eden gerçek sürüş rotası"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                                            {isGeneratingRouteId === selectedRoute.id ? (lang === 'tr' ? 'Hesaplanıyor...' : 'Calculating...') : (trans.modeOsrm || 'OSRM Rota')}
                                        </button>

                                        {/* ÖZEL BÜKÜM BUTONU */}
                                        {selectedRoute.customWkt && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleSwitchGeometryMode(selectedRoute.id, 'custom', e)}
                                                disabled={isGeneratingRouteId === selectedRoute.id}
                                                style={{
                                                    padding: '5px 10px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedRoute.geometryType === 'Custom' && selectedRoute.wkt === selectedRoute.customWkt ? '#7c3aed' : 'transparent',
                                                    color: selectedRoute.geometryType === 'Custom' && selectedRoute.wkt === selectedRoute.customWkt ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#475569'),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}
                                                title="Daha önce haritada elle bükülmüş özel geometriyi geri yükle"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>
                                                {trans.modeCustom || 'Özel Büküm'}
                                            </button>
                                        )}
                                    </div>

                                    {/* GERİ AL (UNDO / REVERT) BUTONU */}
                                    {selectedRoute.previousWkt !== undefined && (
                                        <button
                                            onClick={(e) => handleRevertGeometry(selectedRoute.id, e)}
                                            disabled={isGeneratingRouteId === selectedRoute.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '7px 11px',
                                                borderRadius: '7px',
                                                fontWeight: '600',
                                                fontSize: '12.5px',
                                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                                                color: isDarkMode ? '#e2e8f0' : '#334155',
                                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                cursor: 'pointer'
                                            }}
                                            title="Güzergahın bir önceki çizim/geometri haline geri dön"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                            {trans.modeRevert || 'Geri Al'}
                                        </button>
                                    )}

                                    {onEditRouteGeometryOnMap && (
                                        <button
                                            onClick={() => onEditRouteGeometryOnMap(selectedRoute)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '7px 12px',
                                                borderRadius: '7px',
                                                fontWeight: '600',
                                                fontSize: '12.5px',
                                                backgroundColor: isDarkMode ? '#334155' : '#e2e8f0',
                                                color: isDarkMode ? '#f8fafc' : '#0f172a',
                                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                cursor: 'pointer',
                                                boxShadow: 'none'
                                            }}
                                            title="Bu güzergahın harita üzerindeki çizgisini fare ile bükün ve şekillendirin"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12h4l3 8 4-16 3 8h4" />
                                            </svg>
                                            {trans.btnBendRoute || 'Hattı Bük'}
                                        </button>
                                    )}

                                    <button
                                        onClick={handleOpenCreateStop}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '7px 12px',
                                            borderRadius: '7px',
                                            fontWeight: '600',
                                            fontSize: '12.5px',
                                            backgroundColor: '#2563eb',
                                            color: '#ffffff',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: 'none'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Durak Ekle
                                    </button>
                                </div>
                            </div>

                            {/* Drag and Drop Instruction Banner */}
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: isDarkMode ? '#0f172a' : '#f1f5f9', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                <span>Durakları taşımak için tutamacı (grip) veya kartı tutup yukarı/aşağı sürükleyin. Sıralama haritaya ve veritabanına anında yansır.</span>
                            </div>

                            {/* Stop List (Drag & Drop) */}
                            {routeStops.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', border: `2px dashed ${isDarkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#64748b' }}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </div>
                                    <div>Bu güzergahta henüz kayıtlı durak bulunmuyor.</div>
                                    <div style={{ fontSize: '13px', marginTop: '6px', color: '#64748b' }}>
                                        Yukarıdaki "Durak Ekle" butonuyla veya haritadan "Durak Ekle" aracı ile nokta seçerek durak ekleyebilirsiniz.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {routeStops.map((stop, index) => {
                                        const isDragging = draggedIndex === index;
                                        return (
                                            <div
                                                key={stop.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '10px',
                                                    border: `1px solid ${isDragging ? '#3b82f6' : (isDarkMode ? '#334155' : '#e2e8f0')}`,
                                                    background: isDragging
                                                        ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe')
                                                        : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                                    opacity: isDragging ? 0.5 : 1,
                                                    cursor: 'grab',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    transition: 'transform 0.15s ease, background 0.15s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    {/* Drag Handle */}
                                                    <div style={{ color: '#94a3b8', cursor: 'grab', display: 'flex', alignItems: 'center' }} title="Sürükle">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
                                                            <circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                                                        </svg>
                                                    </div>

                                                    {/* Sequence Number Badge */}
                                                    <span
                                                        style={{
                                                            width: '26px',
                                                            height: '26px',
                                                            borderRadius: '50%',
                                                            backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                                                            color: selectedRoute.color || '#3b82f6',
                                                            border: `1.5px solid ${selectedRoute.color || '#3b82f6'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </span>

                                                    {/* Stop Info */}
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>
                                                            {stop.name}
                                                        </div>
                                                        {stop.latitude && stop.longitude && (
                                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                {stop.latitude.toFixed(4)}° N, {stop.longitude.toFixed(4)}° E
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {onRepositionStopOnMap && (
                                                        <button
                                                            onClick={() => onRepositionStopOnMap(stop)}
                                                            title="Durağın Konumunu Haritada Sürükleyerek Değiştir"
                                                            style={{ background: 'none', border: 'none', color: '#38bdf8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)'}
                                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="5 9 2 12 5 15" />
                                                                <polyline points="9 5 12 2 15 5" />
                                                                <polyline points="15 19 12 22 9 19" />
                                                                <polyline points="19 9 22 12 19 15" />
                                                                <line x1="2" y1="12" x2="22" y2="12" />
                                                                <line x1="12" y1="2" x2="12" y2="22" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEditStop(stop)}
                                                        title="Durağı Düzenle"
                                                        style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                        onMouseOver={(e) => e.currentTarget.style.color = '#3b82f6'}
                                                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStop(stop.id)}
                                                        title="Durağı Kaldır"
                                                        style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            Soldaki listeden duraklarını yönetmek istediğiniz bir güzergah seçin.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Create/Edit Route */}
            {showRouteModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                {isEditingRoute ? 'Güzergahı Düzenle' : 'Yeni Güzergah Oluştur'}
                            </h3>
                            <button onClick={() => setShowRouteModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Güzergah Adı *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="örn. M4 Kadıköy - Sabiha Gökçen veya 15F Sahil Hattı"
                                    value={routeForm.name}
                                    onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Hat Rengi</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    {PRESET_COLORS.map(p => (
                                        <button
                                            key={p.hex}
                                            type="button"
                                            onClick={() => setRouteForm({ ...routeForm, color: p.hex })}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                backgroundColor: p.hex,
                                                border: routeForm.color === p.hex ? '3px solid #ffffff' : 'none',
                                                boxShadow: routeForm.color === p.hex ? `0 0 10px ${p.hex}` : 'none',
                                                cursor: 'pointer'
                                            }}
                                            title={p.label}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={routeForm.color}
                                        onChange={(e) => setRouteForm({ ...routeForm, color: e.target.value })}
                                        style={{ width: '36px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                                    Güzergah Sınıfı (Ulaşım Türü) *
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {ROUTE_CLASSES.map(cls => {
                                        const isSelected = (routeForm.routeClass || 'araba') === cls.id;
                                        return (
                                            <button
                                                key={cls.id}
                                                type="button"
                                                onClick={() => setRouteForm({ ...routeForm, routeClass: cls.id })}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '8px',
                                                    border: `1.5px solid ${isSelected ? cls.color : (isDarkMode ? '#334155' : '#e2e8f0')}`,
                                                    background: isSelected ? cls.bg : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                                    color: isSelected ? cls.color : (isDarkMode ? '#cbd5e1' : '#475569'),
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontWeight: isSelected ? 700 : 500,
                                                    fontSize: '12px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <RouteClassIcon classKey={cls.id} size={15} color={isSelected ? cls.color : (isDarkMode ? '#cbd5e1' : '#475569')} />
                                                <span>{cls.shortLabel}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Açıklama</label>
                                <textarea
                                    rows="3"
                                    placeholder="Hat güzergahı hakkında ek bilgi..."
                                    value={routeForm.description}
                                    onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowRouteModal(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: 'none', color: isDarkMode ? '#ffffff' : '#0f172a', cursor: 'pointer' }}>
                                    İptal
                                </button>
                                <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', background: '#3b82f6', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Create/Edit Stop */}
            {showStopModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                {isEditingStop ? 'Durağı Düzenle' : 'Güzergaha Durak Ekle'}
                            </h3>
                            <button onClick={() => setShowStopModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Kapat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveStop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Durak Adı *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="örn. Kadıköy Rıhtım"
                                    value={stopForm.name}
                                    onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Bağlı Olduğu Güzergah</label>
                                <select
                                    value={stopForm.routeId || ''}
                                    onChange={(e) => setStopForm({ ...stopForm, routeId: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                >
                                    {routes.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Konum (WKT Point)</label>
                                <input
                                    type="text"
                                    placeholder="POINT(29.0234 40.9904)"
                                    value={stopForm.wkt}
                                    onChange={(e) => setStopForm({ ...stopForm, wkt: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                />
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Haritadan eklemek için harita ekranındaki "Durak Ekle" aracını da kullanabilirsiniz.
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowStopModal(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: 'none', color: isDarkMode ? '#ffffff' : '#0f172a', cursor: 'pointer' }}>
                                    İptal
                                </button>
                                <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', background: '#3b82f6', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
