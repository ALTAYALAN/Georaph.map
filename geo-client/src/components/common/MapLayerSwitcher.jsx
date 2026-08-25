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
 */
export const MapLayerSwitcher = ({
    selectedLayerId = 'google_hybrid',
    onSelectLayer,
    direction = 'left'
}) => {
    const [isOpen, setIsOpen] = useState(false);
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
                <div className="map-layer-selector-card" style={cardPositionStyle}>
                    {/* Header */}
                    <div className="layer-selector-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>
                                Harita Katmanları
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '13px',
                                padding: '2px 6px',
                                borderRadius: '4px'
                            }}
                            title="Kapat"
                        >
                            &times;
                        </button>
                    </div>

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
                    <div className="layer-selector-grid">
                        {BASEMAP_LAYERS.map(layer => {
                            const isSelected = selectedLayerId === layer.id;
                            const isHovered = hoveredLayerId === layer.id;

                            return (
                                <button
                                    key={layer.id}
                                    className={`layer-option-btn ${isSelected ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHoveredLayerId(layer.id)}
                                    onMouseLeave={() => setHoveredLayerId(null)}
                                    onClick={() => {
                                        if (onSelectLayer) {
                                            onSelectLayer(layer.id);
                                        }
                                        setIsOpen(false);
                                    }}
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
                </div>
            )}
        </div>
    );
};
