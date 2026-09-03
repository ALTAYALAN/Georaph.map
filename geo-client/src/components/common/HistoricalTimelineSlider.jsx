import React, { useState, useEffect, useRef } from 'react';
import { HISTORICAL_WAYBACK_YEARS, isWaybackLayer, getWaybackYearInfo } from '../../constants/mapLayers';

/**
 * Compact & Minimalist Top-Right Historical Imagery Time Slider
 * Automatically appears when "Esri Harita" (or any wayback archive layer) is selected.
 * Positioned in the top-right next to zoom controls.
 * Adheres strictly to React Rules of Hooks (NO conditional early returns before hooks).
 */
export const HistoricalTimelineSlider = ({
    selectedLayerId = 'esri_wayback',
    onSelectLayer,
    onClose
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const playTimerRef = useRef(null);

    // Compute visibility and active indexes safely before hooks
    const isVisible = isWaybackLayer(selectedLayerId);
    const currentInfo = getWaybackYearInfo(selectedLayerId) || HISTORICAL_WAYBACK_YEARS[HISTORICAL_WAYBACK_YEARS.length - 1];
    const currentIndex = HISTORICAL_WAYBACK_YEARS.findIndex(y => y.year === currentInfo.year);
    const activeIndex = currentIndex !== -1 ? currentIndex : HISTORICAL_WAYBACK_YEARS.length - 1;

    // Timelapse auto-play effect (advances 1 step every 1.4s)
    useEffect(() => {
        if (!isVisible) {
            setIsPlaying(false);
            return;
        }

        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                const nextIndex = (activeIndex + 1) % HISTORICAL_WAYBACK_YEARS.length;
                const nextYear = HISTORICAL_WAYBACK_YEARS[nextIndex];
                if (onSelectLayer) {
                    onSelectLayer(`wayback_${nextYear.year}`);
                }
            }, 1400);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }

        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isVisible, isPlaying, activeIndex, onSelectLayer]);

    // CONDITIONAL RETURN MUST BE AFTER ALL HOOKS TO COMPLY WITH REACT RULES OF HOOKS
    if (!isVisible) {
        return null;
    }

    const handleStep = (step) => {
        setIsPlaying(false);
        const newIndex = Math.max(0, Math.min(HISTORICAL_WAYBACK_YEARS.length - 1, activeIndex + step));
        const target = HISTORICAL_WAYBACK_YEARS[newIndex];
        if (onSelectLayer && target) {
            onSelectLayer(`wayback_${target.year}`);
        }
    };

    const handleSliderChange = (e) => {
        setIsPlaying(false);
        const idx = parseInt(e.target.value, 10);
        const target = HISTORICAL_WAYBACK_YEARS[idx];
        if (onSelectLayer && target) {
            onSelectLayer(`wayback_${target.year}`);
        }
    };

    const handleJumpToIndex = (idx) => {
        setIsPlaying(false);
        const target = HISTORICAL_WAYBACK_YEARS[idx];
        if (onSelectLayer && target) {
            onSelectLayer(`wayback_${target.year}`);
        }
    };

    return (
        <div
            className="compact-wayback-timebar"
            style={{
                position: 'absolute',
                top: '20px',
                right: '80px',
                zIndex: 1002,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '11px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.2)',
                color: '#f8fafc',
                userSelect: 'none'
            }}
        >
            {/* Esri Badge & Active Year Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#38bdf8',
                    boxShadow: '0 0 8px #38bdf8'
                }} />
                <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.15)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    letterSpacing: '0.3px'
                }}>
                    Esri
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', lineHeight: '1' }}>
                        {currentInfo.year}
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#38bdf8', lineHeight: '1', marginTop: '3px', fontWeight: 600 }}>
                        {currentInfo.label}
                    </span>
                </div>
            </div>

            {/* Vertical Divider */}
            <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 2px' }} />

            {/* Play / Pause Timelapse Button */}
            <button
                type="button"
                onClick={() => setIsPlaying(prev => !prev)}
                title={isPlaying ? 'Durdur' : 'Yılları Otomatik Oynat (Timelapse)'}
                style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isPlaying ? '#ef4444' : '#0284c7',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                }}
            >
                {isPlaying ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                )}
            </button>

            {/* Step Back Button (◀) */}
            <button
                type="button"
                onClick={() => handleStep(-1)}
                disabled={activeIndex === 0}
                title="Önceki Yıl"
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: activeIndex === 0 ? '#475569' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                    flexShrink: 0
                }}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>

            {/* SLIDER WITH TICKS (ÇENTİKLER) */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '160px', margin: '0 2px' }}>
                <input
                    type="range"
                    min={0}
                    max={HISTORICAL_WAYBACK_YEARS.length - 1}
                    step={1}
                    value={activeIndex}
                    onChange={handleSliderChange}
                    title={`${currentInfo.year} (${currentInfo.label})`}
                    style={{
                        width: '100%',
                        accentColor: '#38bdf8',
                        cursor: 'pointer',
                        height: '5px',
                        borderRadius: '3px',
                        outline: 'none',
                        margin: 0
                    }}
                />

                {/* VISUAL TICKS / ÇENTİKLER FOR EVERY YEAR */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0 3px',
                    marginTop: '3px',
                    width: '100%'
                }}>
                    {HISTORICAL_WAYBACK_YEARS.map((y, idx) => {
                        const isCurrent = idx === activeIndex;
                        return (
                            <div
                                key={y.year}
                                onClick={() => handleJumpToIndex(idx)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    padding: '0 1px'
                                }}
                                title={`${y.label} (${y.provider})`}
                            >
                                {/* Çentik Çizgisi */}
                                <div style={{
                                    width: isCurrent ? '2px' : '1px',
                                    height: isCurrent ? '6px' : '3.5px',
                                    backgroundColor: isCurrent ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                                    borderRadius: '1px',
                                    boxShadow: isCurrent ? '0 0 4px #38bdf8' : 'none'
                                }} />
                                {/* Çentik Yıl Etiketi */}
                                <span style={{
                                    fontSize: '8.5px',
                                    color: isCurrent ? '#38bdf8' : '#94a3b8',
                                    fontWeight: isCurrent ? 800 : 600,
                                    marginTop: '2px',
                                    letterSpacing: '-0.3px',
                                    lineHeight: 1
                                }}>
                                    {y.year.toString().slice(-2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step Forward Button (▶) */}
            <button
                type="button"
                onClick={() => handleStep(1)}
                disabled={activeIndex === HISTORICAL_WAYBACK_YEARS.length - 1}
                title="Sonraki Yıl"
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: activeIndex === HISTORICAL_WAYBACK_YEARS.length - 1 ? '#475569' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: activeIndex === HISTORICAL_WAYBACK_YEARS.length - 1 ? 'not-allowed' : 'pointer',
                    flexShrink: 0
                }}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>

            {/* Close Button (✕) */}
            <button
                type="button"
                onClick={onClose}
                title="Esri Zaman Çizelgesini Kapat ve Standart Haritaya Dön"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    marginLeft: '2px',
                    borderRadius: '4px'
                }}
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
};
export default HistoricalTimelineSlider;
