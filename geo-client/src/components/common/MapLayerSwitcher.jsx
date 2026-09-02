import React, { useState, useEffect, useRef } from 'react';
import { BASEMAP_LAYERS } from '../../constants/mapLayers';

// Professional SVG Vector Icons for each Layer Type (Zero Emojis)
const LayerVectorIcon = ({ type, color = '#38bdf8' }) => {
    switch (type) {
        case 'hybrid':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
                    <path d="M3.6 9h16.8" />
                    <path d="M3.6 15h16.8" />
                    <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
                    <circle cx="12" cy="12" r="2.5" fill={color} />
                </svg>
            );
        case 'roadmap':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                    <line x1="9" y1="3" x2="9" y2="18" />
                    <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
            );
        case 'terrain':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3l4 8 5-5 5 15H2L8 3z" />
                    <path d="M4 14l4-4 3 3" />
                </svg>
            );
        case 'satellite':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
            );
        case 'dark':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            );
        case 'light':
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            );
        case 'osm':
        default:
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
            );
    }
};

/**
 * Modern Google Maps Style Layer Switcher Control with Live Hover Preview & Zero Emojis
 * Includes Basemaps Tab & Overlays / Transport Visibility Management Tab
 */
export const MapLayerSwitcher = ({
    selectedLayerId = 'google_hybrid',
    onSelectLayer,
    direction = 'left',
    layerVisibility = { routes: true, stops: true, pois: true, drawings: true, heatmap: false },
    onToggleLayerVisibility,
    currentZoom = 6.5,
    heatmapTypeFilter = 'ALL',
    onChangeHeatmapFilter,
    heatmapFeatureCount = 0,
    isOpen: propIsOpen,
    onToggleOpen
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
    const setIsOpen = (val) => {
        if (typeof val === 'function') {
            const nextVal = val(isOpen);
            if (onToggleOpen) onToggleOpen(nextVal);
            else setInternalIsOpen(nextVal);
        } else {
            if (onToggleOpen) onToggleOpen(val);
            else setInternalIsOpen(val);
        }
    };
    const [activeTab, setActiveTab] = useState('basemap'); // 'basemap' | 'visibility'
    const [hoveredLayerId, setHoveredLayerId] = useState(null);
    const containerRef = useRef(null);

    // Auto-close on click outside
    useEffect(() => {
        const handleClickOutside = (evt) => {
            if (containerRef.current && !containerRef.current.contains(evt.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (evt) => {
            if (evt.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const activeLayer = BASEMAP_LAYERS.find(l => l.id === selectedLayerId) || BASEMAP_LAYERS[0];
    const previewTargetLayer = BASEMAP_LAYERS.find(l => l.id === (hoveredLayerId || selectedLayerId)) || activeLayer;

    const cardPositionStyle = direction === 'left'
        ? { right: 'calc(100% + 12px)', left: 'auto', top: 0 }
        : { left: 'calc(100% + 12px)', right: 'auto', top: 0 };

    const isZoomValidForStops = currentZoom >= 16;

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            {/* LAYER SWITCHER ICON BUTTON */}
            <button
                className={`tool-btn-exact ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
                title={`Harita Katmanları (${activeLayer.name})`}
                style={{
                    background: isOpen ? '#2563eb' : '',
                    color: isOpen ? '#ffffff' : ''
                }}
            >
                {/* Sleek Google Maps Stacked Layers SVG Icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                </svg>
            </button>
            {/* FLOATING LAYER SELECTOR CARD */}
            {isOpen && (
                <div className="map-layer-selector-card" style={{ ...cardPositionStyle, width: '330px' }}>
                    {/* Header */}
                    <div className="layer-selector-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>
                                Harita & Katman Yönetimi
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Kapat"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* SEGMENTED TAB SWITCHER */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '4px',
                        borderRadius: '8px',
                        margin: '10px 12px 6px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        gap: '4px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('basemap')}
                            style={{
                                flex: 1,
                                padding: '7px 6px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: activeTab === 'basemap' ? '#2563eb' : 'transparent',
                                color: activeTab === 'basemap' ? '#ffffff' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            <span>Altlık Harita</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('visibility')}
                            style={{
                                flex: 1,
                                padding: '7px 6px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: activeTab === 'visibility' ? '#0284c7' : 'transparent',
                                color: activeTab === 'visibility' ? '#ffffff' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>Katman Görünürlüğü</span>
                        </button>
                    </div>

                    {/* TAB 1: ALTLIK HARİTALAR */}
                    {activeTab === 'basemap' && (
                        <>
                            {/* LIVE HOVER PREVIEW BANNER */}
                            <div className="layer-preview-banner">
                                <div className="layer-preview-img-box">
                                    <img
                                        src={previewTargetLayer.previewUrl}
                                        alt={previewTargetLayer.name}
                                        className="layer-preview-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                    <div className="layer-preview-overlay">
                                        <div className="layer-preview-badge">
                                            <span className="pulse-dot" />
                                            <span>{hoveredLayerId ? 'Önizleme' : 'Aktif Katman'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="layer-preview-meta">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="layer-preview-title">{previewTargetLayer.name}</span>
                                        <span className="layer-type-tag" style={{ background: `${previewTargetLayer.tagColor || '#3b82f6'}22`, color: previewTargetLayer.tagColor || '#38bdf8', borderColor: `${previewTargetLayer.tagColor || '#3b82f6'}44` }}>
                                            {previewTargetLayer.tag}
                                        </span>
                                    </div>
                                    <span className="layer-preview-desc">{previewTargetLayer.sub}</span>
                                </div>
                            </div>

                            {/* Layer Options List */}
                            <div className="layer-selector-grid" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                {BASEMAP_LAYERS.map(layer => {
                                    const isSelected = selectedLayerId === layer.id;
                                    const isHovered = hoveredLayerId === layer.id;

                                    return (
                                        <button
                                            key={layer.id}
                                            type="button"
                                            className={`layer-option-btn ${isSelected ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                                            onClick={() => {
                                                if (onSelectLayer) {
                                                    onSelectLayer(layer.id);
                                                }
                                            }}
                                            onMouseEnter={() => setHoveredLayerId(layer.id)}
                                            onMouseLeave={() => setHoveredLayerId(null)}
                                        >
                                            {/* Mini Layer Tile Thumbnail */}
                                            <div className="layer-mini-thumb">
                                                <img
                                                    src={layer.previewUrl}
                                                    alt={layer.name}
                                                    className="layer-thumb-img"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                                <div className="layer-thumb-icon-overlay">
                                                    <LayerVectorIcon type={layer.iconType} color={isSelected ? '#38bdf8' : '#ffffff'} />
                                                </div>
                                            </div>

                                            <div className="layer-text-info">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                    <span className="layer-name">{layer.name}</span>
                                                    <span className="layer-pill-tag" style={{ color: layer.tagColor || '#94a3b8' }}>
                                                        {layer.tag}
                                                    </span>
                                                </div>
                                                <span className="layer-sub">{layer.sub}</span>
                                            </div>

                                            {isSelected && (
                                                <span className="layer-active-badge">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* TAB 2: KATMAN GÖRÜNÜRLÜĞÜ (OVERLAY & TRANSPORT) */}
                    {activeTab === 'visibility' && (
                        <div style={{
                            padding: '10px 12px 14px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                marginBottom: '2px',
                                lineHeight: '1.4'
                            }}>
                                Haritada görüntülenen vektör katmanlarını ve akıllı ulaşım elemanlarını açıp kapatın:
                            </div>

                            {/* 1. TOPLU TAŞIMA DURAKLARI */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                background: layerVisibility.stops ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${layerVisibility.stops ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.15s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '7px',
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        color: '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="4" y="4" width="16" height="13" rx="2" />
                                            <path d="M4 9h16" />
                                            <circle cx="7.5" cy="14" r="1.2" fill="currentColor" />
                                            <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
                                            <path d="M6 17v2.5M18 17v2.5" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Ulaşım Durakları</div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Toplu Taşıma & Otobüs Durakları</div>
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={!!layerVisibility.stops}
                                    onChange={() => onToggleLayerVisibility && onToggleLayerVisibility('stops')}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer',
                                        accentColor: '#ef4444'
                                    }}
                                />
                            </div>

                            {/* 2. GÜZERGAHLAR / HATLAR */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                background: layerVisibility.routes ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${layerVisibility.routes ? 'rgba(2, 132, 199, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.15s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '7px',
                                        background: 'rgba(2, 132, 199, 0.2)',
                                        color: '#38bdf8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 12h4l3 8 4-16 3 8h4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Hat & Güzergah Çizgileri</div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Metro & Otobüs Rotaları</div>
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={!!layerVisibility.routes}
                                    onChange={() => onToggleLayerVisibility && onToggleLayerVisibility('routes')}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer',
                                        accentColor: '#0284c7'
                                    }}
                                />
                            </div>

                            {/* 3. POI (İLGİ NOKTALARI) */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                background: layerVisibility.pois ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${layerVisibility.pois ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.15s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '7px',
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        color: '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>POI (İlgi Noktaları)</div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Mekan ve Kategori Pinleri</div>
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={!!layerVisibility.pois}
                                    onChange={() => onToggleLayerVisibility && onToggleLayerVisibility('pois')}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer',
                                        accentColor: '#10b981'
                                    }}
                                />
                            </div>

                            {/* 4. ÇİZİMLER & POLİGONLAR */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                background: layerVisibility.drawings ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${layerVisibility.drawings ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.15s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '7px',
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        color: '#3b82f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Kullanıcı Çizimleri</div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Nokta, Çizgi ve Poligonlar</div>
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={!!layerVisibility.drawings}
                                    onChange={() => onToggleLayerVisibility && onToggleLayerVisibility('drawings')}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer',
                                        accentColor: '#3b82f6'
                                    }}
                                />
                            </div>

                            {/* 5. ISI HARİTASI (HEATMAP) */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                padding: '9px 12px',
                                background: layerVisibility.heatmap ? 'rgba(234, 88, 12, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${layerVisibility.heatmap ? 'rgba(234, 88, 12, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.15s ease'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '7px',
                                            background: 'rgba(234, 88, 12, 0.2)',
                                            color: '#f97316',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Nokta Yoğunluğu (Isı Haritası)</div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Konum ve Çizim Yoğunluk Katmanı</div>
                                        </div>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={!!layerVisibility.heatmap}
                                        onChange={() => onToggleLayerVisibility && onToggleLayerVisibility('heatmap')}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: '#ea580c'
                                        }}
                                    />
                                </div>

                                {/* ISI HARİTASI AKTİF İSE GÖSTERİLECEK FİLTRE VE ÖLÇEK KONTROLLERİ */}
                                {layerVisibility.heatmap && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        paddingTop: '6px',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                                    }}>
                                        {/* Geometri Filtresi */}
                                        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '6px' }}>
                                            {[
                                                { id: 'ALL', label: 'Tümü' },
                                                { id: 'Point', label: 'Nokta' },
                                                { id: 'Line', label: 'Çizgi' },
                                                { id: 'Polygon', label: 'Poligon' }
                                            ].map(f => (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    onClick={() => onChangeHeatmapFilter && onChangeHeatmapFilter(f.id)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '3px 0',
                                                        fontSize: '10.5px',
                                                        fontWeight: heatmapTypeFilter === f.id ? 700 : 500,
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        backgroundColor: heatmapTypeFilter === f.id ? '#ea580c' : 'transparent',
                                                        color: heatmapTypeFilter === f.id ? '#ffffff' : '#94a3b8',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Renk Skalası Gradient Şeridi */}
                                        <div style={{
                                            height: '6px',
                                            borderRadius: '3px',
                                            background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                                            width: '100%'
                                        }} />

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8' }}>
                                            <span>0.0 (Düşük)</span>
                                            <span>0.5 (Orta)</span>
                                            <span>1.0 (Yüksek)</span>
                                        </div>

                                        {heatmapFeatureCount > 0 && (
                                            <div style={{ fontSize: '10px', color: '#f97316', fontWeight: 600, textAlign: 'right' }}>
                                                {heatmapFeatureCount} Konum / Nokta Analiz Edildi
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

