import React, { useState, useEffect, useRef, useMemo } from 'react';
import { transportApi } from '../../services/transportApi';
import { simulationHubService } from '../../services/simulationHubService';
import { translations } from '../../translations';
import { ROUTE_CLASSES, getRouteClassInfo, RouteClassIcon, normalizeTransitClass, areTransitClassesCompatible } from '../../constants/routeClasses';
import { TURKISH_SEAPORTS, generateMaritimeRouteWkt, cleanPortName } from '../../constants/seaports';
import { TURKISH_AIRPORTS, generateFlightRouteWkt, cleanAirportName } from '../../constants/airports';

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

// Ulaşım Sınıfı Öncelikleri
export const TYPE_PRIORITY = { 'havayolu': 0, 'ucak': 0, 'metro': 1, 'tramvay': 2, 'metrobus': 3, 'tren': 4, 'deniz': 5, 'gemi': 5, 'otobus': 6, 'araba': 7 };

export function detectCityForEntity(entity, allRoutes) {
    if (!entity) return 'Diğer';
    if (entity.city) return entity.city;

    // Bağlı hat üzerinden il kontrolü
    if (allRoutes && entity.routeId) {
        const matchedRoute = allRoutes.find(r => r.id === entity.routeId);
        if (matchedRoute && matchedRoute.name) {
            const rc = detectCityForEntity(matchedRoute);
            if (rc !== 'Diğer') return rc;
        }
    }
    if (allRoutes && Array.isArray(entity.routes) && entity.routes.length > 0) {
        for (const r of entity.routes) {
            const rc = detectCityForEntity(r);
            if (rc !== 'Diğer') return rc;
        }
    }

    const name = ((entity.name || '') + ' ' + (entity.description || '') + ' ' + (entity.stopCode || '')).toLowerCase();
    
    // Ankara
    if (name.includes('ankara') || name.includes('ego') || name.includes('ankaray') || name.includes('kızılay') || name.includes('kizilay') || name.includes('başkentray') || name.includes('baskentray') || name.includes('batıkent') || name.includes('törekent') || name.includes('eryaman') || name.includes('aşot') || name.includes('aşti') || name.includes('sıhhiye') || name.includes('keçiören') || name.includes('kecioren') || name.includes('sincan') || name.includes('kayaş') || name.includes('kayas') || name.includes('dikimevi') || name.includes('çankaya') || name.includes('cankaya') || name.includes('altındağ') || name.includes('mamak') || name.includes('etimesgut') || name.includes('yenimahalle') || name.includes('gölbaşı') || name.includes('koru') || name.includes('osb-törekent') || name.includes('altınpark') || name.includes('subayevleri') || name.includes('oran sitesi')) {
        if (!name.includes('kadıköy') && !name.includes('kartal')) {
            return 'Ankara';
        }
    }
    // İstanbul
    if (name.includes('istanbul') || name.includes('galataport') || name.includes('yenikapı') || name.includes('yenikapi') || name.includes('kadıköy') || name.includes('kadikoy') || name.includes('üsküdar') || name.includes('uskudar') || name.includes('marmaray') || name.includes('iett') || name.includes('boğaz') || name.includes('pendik') || name.includes('kartal') || name.includes('haydarpaşa') || name.includes('haydarpasa') || name.includes('avcılar') || name.includes('avcilar') || name.includes('beşiktaş') || name.includes('taksim') || name.includes('mecidiyeköy') || name.includes('eminönü') || name.includes('kabataş') || name.includes('bakırköy')) {
        return 'İstanbul';
    }
    // İzmir
    if (name.includes('izmir') || name.includes('izban') || name.includes('alsancak') || name.includes('konak') || name.includes('karşıyaka') || name.includes('karsiyaka') || name.includes('eshott') || name.includes('eshot') || name.includes('fahrettin altay') || name.includes('evka') || name.includes('bostanlı') || name.includes('üçyol') || name.includes('bornova')) {
        return 'İzmir';
    }
    // Çanakkale
    if (name.includes('çanakkale') || name.includes('canakkale') || name.includes('eceabat') || name.includes('gelibolu') || name.includes('bozcaada') || name.includes('gökçeada')) {
        return 'Çanakkale';
    }
    // Mersin / Akdeniz / Kıbrıs
    if (name.includes('mersin') || name.includes('girne') || name.includes('taşucu') || name.includes('tasucu') || name.includes('anamur') || name.includes('kıbrıs') || name.includes('kibris') || name.includes('iskenderun') || name.includes('akdeniz') || name.includes('madenli') || name.includes('gazimağusa') || name.includes('magusa')) {
        return 'Mersin / Akdeniz';
    }
    // Bursa
    if (name.includes('bursa') || name.includes('mudanya') || name.includes('bursaray') || name.includes('nilüfer') || name.includes('osmangazi')) {
        return 'Bursa';
    }
    // Antalya
    if (name.includes('antalya') || name.includes('antray') || name.includes('muratpaşa') || name.includes('kepez') || name.includes('konyaaltı') || name.includes('alanya')) {
        return 'Antalya';
    }
    const lat = entity.latitude || entity.stops?.[0]?.latitude;
    const lon = entity.longitude || entity.stops?.[0]?.longitude;
    if (lat && lon) {
        if (lon >= 32.2 && lon <= 33.5 && lat >= 39.5 && lat <= 40.4) return 'Ankara';
        if (lon >= 28.3 && lon <= 29.6 && lat >= 40.7 && lat <= 41.4) return 'İstanbul';
        if (lon >= 26.8 && lon <= 27.5 && lat >= 38.2 && lat <= 38.7) return 'İzmir';
        if (lon >= 26.0 && lon <= 26.8 && lat >= 39.8 && lat <= 40.5) return 'Çanakkale';
        if (lon >= 32.5 && lon <= 36.0 && lat >= 35.0 && lat <= 37.2) return 'Mersin / Akdeniz';
        if (lon >= 30.0 && lon <= 32.0 && lat >= 36.2 && lat <= 37.2) return 'Antalya';
        if (lon >= 28.5 && lon <= 29.8 && lat >= 40.0 && lat <= 40.6) return 'Bursa';
    }
    return 'Diğer';
}

// Açılır ve Kendi İçinde Aranabilir Liman Seçim Bileşeni
const SearchablePortSelect = ({
    label,
    selectedId,
    onChange,
    ports = [],
    disabledId,
    placeholder = "Liman seçiniz...",
    isDarkMode
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    const selectedPort = ports.find(p => p.id === selectedId || p.stopId === selectedId || p.name === selectedId);

    // Dışarı tıklandığında menüyü kapat
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return ports;
        const q = search.toLowerCase();
        return ports.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.shortName.toLowerCase().includes(q) ||
            (p.city && p.city.toLowerCase().includes(q))
        );
    }, [ports, search]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                    {label}
                </label>
            )}

            {/* Tıklanabilir Liman Seçim Kutusu */}
            <div
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearch('');
                }}
                style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isOpen ? '#0284c7' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                    background: isDarkMode ? '#0f172a' : '#ffffff',
                    color: selectedPort ? (isDarkMode ? '#ffffff' : '#0f172a') : '#94a3b8',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: isOpen ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                }}
            >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selectedPort ? '600' : 'normal' }}>
                    {selectedPort ? `${selectedPort.shortName} (${selectedPort.city || 'Kıyı Limanı'})` : placeholder}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: '#0284c7', flexShrink: 0, marginLeft: '8px' }}>
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </div>

            {/* Açılır Arama ve Liman Listesi Pop-up */}
            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1.5px solid ${isDarkMode ? '#0284c7' : '#38bdf8'}`,
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                        zIndex: 99999,
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}
                >
                    {/* Arama Kutusu */}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Liman ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: '7px 28px 7px 30px',
                                borderRadius: '6px',
                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                background: isDarkMode ? '#0f172a' : '#f8fafc',
                                color: isDarkMode ? '#ffffff' : '#0f172a',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, color: '#0284c7' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        {search && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Kaydırılabilir Liman Listesi */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                Eşleşen liman bulunamadı
                            </div>
                        ) : (
                            filtered.map(port => {
                                const isSelected = port.id === selectedId || port.stopId === selectedId || port.name === selectedId;
                                const isDisabled = disabledId && (port.id === disabledId || port.stopId === disabledId || port.name === disabledId);
                                return (
                                    <div
                                        key={port.id}
                                        onClick={() => {
                                            if (isDisabled) return;
                                            onChange(port.id);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            opacity: isDisabled ? 0.4 : 1,
                                            background: isSelected 
                                                ? (isDarkMode ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe') 
                                                : 'transparent',
                                            color: isSelected 
                                                ? '#0284c7' 
                                                : (isDarkMode ? '#e2e8f0' : '#1e293b'),
                                            fontWeight: isSelected ? '700' : '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'background 0.12s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected && !isDisabled) {
                                                e.currentTarget.style.background = isDarkMode ? '#334155' : '#f1f5f9';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected && !isDisabled) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        <span>{port.shortName}</span>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>{port.city}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Açılır ve Kendi İçinde Aranabilir Havalimanı Seçim Bileşeni
const SearchableAirportSelect = ({
    label,
    selectedId,
    onChange,
    airports = [],
    disabledId,
    placeholder = "Havalimanı seçiniz...",
    isDarkMode
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    const selectedAirport = airports.find(a => a.id === selectedId || a.stopId === selectedId || a.iata === selectedId || a.name === selectedId);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return airports;
        const q = search.toLowerCase();
        return airports.filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.shortName.toLowerCase().includes(q) ||
            (a.iata && a.iata.toLowerCase().includes(q)) ||
            (a.city && a.city.toLowerCase().includes(q))
        );
    }, [airports, search]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                    {label}
                </label>
            )}

            <div
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearch('');
                }}
                style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isOpen ? '#0284c7' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                    background: isDarkMode ? '#0f172a' : '#ffffff',
                    color: selectedAirport ? (isDarkMode ? '#ffffff' : '#0f172a') : '#94a3b8',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: isOpen ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                }}
            >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selectedAirport ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selectedAirport ? (
                        <>
                            <span style={{ color: '#0284c7', fontWeight: '700' }}>[{selectedAirport.iata || 'APT'}]</span>
                            <span>{selectedAirport.shortName}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>({selectedAirport.city})</span>
                        </>
                    ) : placeholder}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: '#0284c7', flexShrink: 0, marginLeft: '8px' }}>
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </div>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1.5px solid ${isDarkMode ? '#0284c7' : '#38bdf8'}`,
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                        zIndex: 99999,
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Havalimanı veya şehir ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: '7px 28px 7px 30px',
                                borderRadius: '6px',
                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                background: isDarkMode ? '#0f172a' : '#f8fafc',
                                color: isDarkMode ? '#ffffff' : '#0f172a',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, color: '#0284c7' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        {search && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                Eşleşen havalimanı bulunamadı
                            </div>
                        ) : (
                            filtered.map(apt => {
                                const isSelected = apt.id === selectedId || apt.stopId === selectedId || apt.iata === selectedId || apt.name === selectedId;
                                const isDisabled = disabledId && (apt.id === disabledId || apt.stopId === disabledId || apt.iata === disabledId || apt.name === disabledId);
                                return (
                                    <div
                                        key={apt.id}
                                        onClick={() => {
                                            if (isDisabled) return;
                                            onChange(apt.id);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            opacity: isDisabled ? 0.4 : 1,
                                            background: isSelected 
                                                ? (isDarkMode ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe') 
                                                : 'transparent',
                                            color: isSelected 
                                                ? '#0284c7' 
                                                : (isDarkMode ? '#e2e8f0' : '#1e293b'),
                                            fontWeight: isSelected ? '700' : '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'background 0.12s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected && !isDisabled) {
                                                e.currentTarget.style.background = isDarkMode ? '#334155' : '#f1f5f9';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected && !isDisabled) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: '700', color: '#0284c7' }}>[{apt.iata || 'APT'}]</span>
                                            <span>{apt.shortName}</span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>{apt.city}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Türkiye Deniz Limanları, Havalimanları ve Tüm Kıyı Durakları
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
    const isTr = lang === 'tr';
    const [routes, setRoutes] = useState([]);
    const [allStops, setAllStops] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Ana Görünüm Sekmesi (Güzergahlar / Duraklar)
    const [activeMainTab, setActiveMainTab] = useState('routes'); // 'routes' | 'stops'

    // Güzergah Türü, Şehir ve Sıralama Filtreleri
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
    const [selectedCityFilter, setSelectedCityFilter] = useState('ALL');
    const [routeSortBy, setRouteSortBy] = useState('TYPE'); // 'TYPE' | 'NAME' | 'STOPS'
    const [searchQuery, setSearchQuery] = useState('');

    // Durak Yönetimi Filtreleri
    const [stopClassFilter, setStopClassFilter] = useState('ALL');
    const [selectedStopCityFilter, setSelectedStopCityFilter] = useState('ALL');
    const [stopSortBy, setStopSortBy] = useState('TYPE'); // 'TYPE' | 'NAME'
    const [stopRouteFilter, setStopRouteFilter] = useState('ALL');
    const [stopSearchQuery, setStopSearchQuery] = useState('');

    // Liman Seçimi Arama Filtresi (Emoji ve bölge ayrımı olmadan düz arama)
    const [portSearchQuery, setPortSearchQuery] = useState('');

    // Canlı Simülasyon Durumları (SignalR) ve Hız Katsayısı (1x, 1.5x, 2x, 2.5x)
    const [simSpeedMap, setSimSpeedMap] = useState({});
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
    const [routeForm, setRouteForm] = useState({ 
        id: null, 
        name: '', 
        color: '#3b82f6', 
        routeClass: 'araba', 
        description: '', 
        isActive: true,
        departurePortId: TURKISH_SEAPORTS[0]?.id || '',
        arrivalPortId: TURKISH_SEAPORTS[1]?.id || '',
        departureAirportId: TURKISH_AIRPORTS[0]?.id || '',
        arrivalAirportId: TURKISH_AIRPORTS[1]?.id || ''
    });

    const [showStopModal, setShowStopModal] = useState(false);
    const [isEditingStop, setIsEditingStop] = useState(false);
    const [stopForm, setStopForm] = useState({ 
        id: null, 
        name: '', 
        stopCode: '',
        stopClass: 'otobus', 
        routeId: null, 
        routeIds: [],
        description: '', 
        imageUrl: '',
        orderIndex: 1, 
        wkt: '', 
        isActive: true 
    });
    const [uploadingStopImage, setUploadingStopImage] = useState(false);
    const [isGeneratingRouteId, setIsGeneratingRouteId] = useState(null);

    // Gemi güzergahları için Varış Ekle modalı
    const [showArrivalModal, setShowArrivalModal] = useState(false);
    const [arrivalForm, setArrivalForm] = useState({ arrivalPortId: '', routeName: '' });
    const [isAddingArrival, setIsAddingArrival] = useState(false);

    // Mevcut Durağı Güzergaha Bağlama Modalı ve Pozisyon State'leri
    const [showAttachStopModal, setShowAttachStopModal] = useState(false);
    const [attachSearchQuery, setAttachSearchQuery] = useState('');
    const [attachPosition, setAttachPosition] = useState('end'); // 'start' | 'end' | 'after'
    const [attachTargetStopId, setAttachTargetStopId] = useState('');
    const [insertPosition, setInsertPosition] = useState('end'); // 'start' | 'end' | 'after'
    const [insertTargetStopId, setInsertTargetStopId] = useState(null);
    const [quickRouteMenuStopId, setQuickRouteMenuStopId] = useState(null);

    // Durak Yönetimi için seçili şehre göre filtrelenmiş güzergahlar
    const availableStopRoutes = useMemo(() => {
        return (routes || []).filter(r => {
            if (selectedStopCityFilter === 'ALL') return true;
            const rCity = detectCityForEntity(r);
            if (rCity === selectedStopCityFilter) return true;
            if (r.stops && r.stops.some(s => detectCityForEntity(s, routes) === selectedStopCityFilter)) return true;
            return false;
        }).sort((a, b) => {
            const pa = TYPE_PRIORITY[normalizeTransitClass(a.routeClass)] || 99;
            const pb = TYPE_PRIORITY[normalizeTransitClass(b.routeClass)] || 99;
            if (pa !== pb) return pa - pb;
            return (a.name || '').localeCompare(b.name || '', 'tr');
        });
    }, [routes, selectedStopCityFilter]);

    // Şehir filtresi değiştiğinde geçerli olmayan hat filtresini sıfırla
    useEffect(() => {
        if (selectedStopCityFilter !== 'ALL' && stopRouteFilter !== 'ALL') {
            const exists = availableStopRoutes.some(r => r.id === Number(stopRouteFilter));
            if (!exists) {
                setStopRouteFilter('ALL');
            }
        }
    }, [selectedStopCityFilter, availableStopRoutes, stopRouteFilter]);

    // Seçili şehre ait duraklar (Sınıf butonu sayaçları için)
    const cityFilteredStopsForCounts = useMemo(() => {
        return (allStops || []).filter(s => {
            if (selectedStopCityFilter === 'ALL') return true;
            return detectCityForEntity(s, routes) === selectedStopCityFilter;
        });
    }, [allStops, selectedStopCityFilter, routes]);

    // Durak Yönetimi İçin Filtrelenmiş ve Sıralanmış Duraklar Listesi
    const filteredStops = useMemo(() => {
        return (allStops || []).filter(stop => {
            // Şehir Filtresi
            if (selectedStopCityFilter !== 'ALL') {
                const detectedCity = detectCityForEntity(stop, routes);
                if (detectedCity !== selectedStopCityFilter) return false;
            }
            // Sınıf Filtresi (6 Temel Tür)
            if (stopClassFilter !== 'ALL') {
                if (normalizeTransitClass(stop.stopClass) !== normalizeTransitClass(stopClassFilter)) {
                    return false;
                }
            }
            // Güzergah Filtresi
            if (stopRouteFilter !== 'ALL') {
                const targetNum = Number(stopRouteFilter);
                const isMatch = stop.routeId === targetNum || 
                                (stop.routeIds && stop.routeIds.includes(targetNum)) ||
                                (stop.routes && stop.routes.some(r => r.id === targetNum));
                if (!isMatch) return false;
            }
            // Arama Filtresi (İsim, Durak Kodu, Açıklama veya Hat Adı)
            if (stopSearchQuery.trim()) {
                const q = stopSearchQuery.toLowerCase();
                const matchName = (stop.name || '').toLowerCase().includes(q);
                const matchCode = (stop.stopCode || '').toLowerCase().includes(q);
                const matchDesc = (stop.description || '').toLowerCase().includes(q);
                const matchedRoute = routes.find(r => r.id === stop.routeId);
                const matchRoute = matchedRoute ? matchedRoute.name.toLowerCase().includes(q) : false;
                const matchMultiRoutes = stop.routes ? stop.routes.some(r => (r.name || '').toLowerCase().includes(q)) : false;
                if (!matchName && !matchCode && !matchDesc && !matchRoute && !matchMultiRoutes) return false;
            }
            return true;
        }).sort((a, b) => {
            if (stopSortBy === 'TYPE') {
                const pa = TYPE_PRIORITY[normalizeTransitClass(a.stopClass)] || 99;
                const pb = TYPE_PRIORITY[normalizeTransitClass(b.stopClass)] || 99;
                if (pa !== pb) return pa - pb;
                return (a.name || '').localeCompare(b.name || '', 'tr');
            }
            if (a.routeId && b.routeId && a.routeId !== b.routeId) return a.routeId - b.routeId;
            if ((a.orderIndex || 0) !== (b.orderIndex || 0)) return (a.orderIndex || 0) - (b.orderIndex || 0);
            return (a.name || '').localeCompare(b.name || '', 'tr');
        });
    }, [allStops, stopClassFilter, selectedStopCityFilter, stopRouteFilter, stopSearchQuery, stopSortBy, routes]);

    // Dinamik ve Statik Tüm Limanları Birleştiren Alfabetik Liste
    const allAvailablePorts = useMemo(() => {
        const portMap = new Map();

        // 1. Statik hazır limanları ekle
        TURKISH_SEAPORTS.forEach(p => {
            const cleanShort = p.shortName || cleanPortName(p.name);
            portMap.set(p.id, {
                id: p.id,
                name: p.name,
                shortName: cleanShort,
                city: p.city || 'Kıyı Limanı',
                coordinates: p.coordinates,
                description: p.description || p.type || ''
            });
        });

        // 2. Veritabanından gelen tüm 'gemi' sınıfı ve liman duraklarını ekle / eşleştir
        (allStops || []).forEach(s => {
            const isPort = (s.stopClass || '').toLowerCase() === 'gemi' ||
                           (s.name || '').toLowerCase().includes('liman') ||
                           (s.name || '').toLowerCase().includes('iskele') ||
                           (s.name || '').toLowerCase().includes('port') ||
                           (s.name || '').toLowerCase().includes('feribot');

            if (isPort && s.longitude != null && s.latitude != null) {
                const sNameClean = cleanPortName(s.name).toLowerCase();
                const matchedStaticKey = Array.from(portMap.keys()).find(k => {
                    const item = portMap.get(k);
                    return item.name.toLowerCase() === s.name.toLowerCase() ||
                           cleanPortName(item.name).toLowerCase() === sNameClean;
                });

                const customId = matchedStaticKey || `stop_${s.id}`;

                portMap.set(customId, {
                    id: customId,
                    stopId: s.id,
                    name: s.name,
                    shortName: cleanPortName(s.name) || s.name,
                    city: s.city || (s.name.includes('(') ? s.name.split('(')[1].replace(')', '').trim() : 'Kıyı Limanı'),
                    coordinates: [s.longitude, s.latitude],
                    description: s.description || 'Liman / İskele'
                });
            }
        });

        return Array.from(portMap.values()).sort((a, b) => a.shortName.localeCompare(b.shortName, 'tr'));
    }, [allStops]);

    // Dinamik ve Statik Tüm Havalimanlarını Birleştiren Alfabetik Liste
    const allAvailableAirports = useMemo(() => {
        const aptMap = new Map();

        // 1. Statik hazır havalimanlarını ekle
        TURKISH_AIRPORTS.forEach(a => {
            const cleanShort = a.shortName || cleanAirportName(a.name);
            aptMap.set(a.id, {
                id: a.id,
                name: a.name,
                shortName: cleanShort,
                iata: a.iata,
                icao: a.icao,
                city: a.city || 'Havalimanı',
                coordinates: a.coordinates,
                description: a.description || a.type || ''
            });
        });

        // 2. Veritabanından gelen tüm 'havayolu' / 'ucak' sınıfı ve havalimanı duraklarını ekle / eşleştir
        (allStops || []).forEach(s => {
            const isAirport = (s.stopClass || '').toLowerCase() === 'havayolu' ||
                              (s.stopClass || '').toLowerCase() === 'ucak' ||
                              (s.name || '').toLowerCase().includes('havaliman') ||
                              (s.name || '').toLowerCase().includes('havaalan') ||
                              (s.name || '').toLowerCase().includes('airport');

            if (isAirport && s.longitude != null && s.latitude != null) {
                const sNameClean = cleanAirportName(s.name).toLowerCase();
                const matchedStaticKey = Array.from(aptMap.keys()).find(k => {
                    const item = aptMap.get(k);
                    return item.name.toLowerCase() === s.name.toLowerCase() ||
                           cleanAirportName(item.name).toLowerCase() === sNameClean;
                });

                const customId = matchedStaticKey || `stop_apt_${s.id}`;

                aptMap.set(customId, {
                    id: customId,
                    stopId: s.id,
                    name: s.name,
                    shortName: cleanAirportName(s.name) || s.name,
                    iata: s.stopCode || (s.name.match(/\[([A-Z0-9]{3})\]/)?.[1] || 'APT'),
                    city: s.city || (s.name.includes('(') ? s.name.split('(')[1].replace(')', '').trim() : 'Havalimanı'),
                    coordinates: [s.longitude, s.latitude],
                    description: s.description || 'Havalimanı / Uçuş Terminali'
                });
            }
        });

        return Array.from(aptMap.values()).sort((a, b) => a.shortName.localeCompare(b.shortName, 'tr'));
    }, [allStops]);

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
                [String(routeId)]: statusObj,
                [String(numId)]: statusObj
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
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            setActiveSimulations(prev => ({
                ...prev,
                [routeId]: { ...(prev[routeId] || prev[numId] || {}), isPaused: true },
                [numId]: { ...(prev[numId] || prev[routeId] || {}), isPaused: true }
            }));
            await simulationHubService.pauseSimulation(numId, token);
            setSuccessMsg('Simülasyon duraklatıldı.');
        } catch (err) {
            setError(err.message || 'Simülasyon duraklatılamadı.');
        } finally {
            setSimLoadingId(null);
        }
    };

    const handleResumeSimulationFromAdmin = async (routeId, e) => {
        e?.stopPropagation();
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            setActiveSimulations(prev => ({
                ...prev,
                [routeId]: { ...(prev[routeId] || prev[numId] || {}), isPaused: false },
                [numId]: { ...(prev[numId] || prev[routeId] || {}), isPaused: false }
            }));
            await simulationHubService.resumeSimulation(numId, token);
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

    // Load Routes & All Stops
    const loadRoutes = async (keepSelection = false) => {
        try {
            setLoading(true);
            setError('');
            const [rawData, stopsData] = await Promise.all([
                transportApi.getRoutes(token, true),
                transportApi.getAllStops(token).catch(() => [])
            ]);

            setAllStops(Array.isArray(stopsData) ? stopsData : []);
            const allItems = Array.isArray(rawData) ? rawData : [];

            // Limanlar duraktır; tekil liman sahte kayıtlarını (gemi olup wkt'si olmayan veya <=1 duraklı) temizle
            const fakePortRoutes = allItems.filter(r => (r.routeClass || '').toLowerCase() === 'gemi' && !r.wkt && (r.stops ? r.stops.length : 0) <= 1);
            if (fakePortRoutes.length > 0) {
                // Arka planda veritabanından temizle
                fakePortRoutes.forEach(fr => {
                    transportApi.deleteRoute(fr.id, token).catch(() => {});
                });
            }

            // Yalnızca geçerli gerçek hatları listele
            const data = allItems.filter(r => !((r.routeClass || '').toLowerCase() === 'gemi' && !r.wkt && (r.stops ? r.stops.length : 0) <= 1));
            setRoutes(data);

            if (data && data.length > 0) {
                const targetId = keepSelection && selectedRouteId ? selectedRouteId : data[0].id;
                const current = data.find(r => r.id === targetId) || data[0];
                setSelectedRouteId(current.id);
                let stops = current.stops || [];
                if ((!stops || stops.length === 0) && Array.isArray(stopsData)) {
                    stops = stopsData.filter(s => s.routeId === current.id || (s.routeIds && s.routeIds.includes(current.id)) || (s.routes && s.routes.some(r => r.id === current.id)));
                }
                setRouteStops(stops);
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

    // Handle Route Selection (Destekler: hem Route objesi hem de routeId int parametresi)
    const handleSelectRoute = (routeOrId) => {
        const rId = typeof routeOrId === 'object' && routeOrId !== null ? routeOrId.id : Number(routeOrId);
        const targetRoute = typeof routeOrId === 'object' && routeOrId !== null ? routeOrId : routes.find(r => r.id === rId);
        setSelectedRouteId(rId);

        let stops = targetRoute?.stops || [];
        if ((!stops || stops.length === 0) && rId && allStops.length > 0) {
            stops = allStops.filter(s => s.routeId === rId || (s.routeIds && s.routeIds.includes(rId)) || (s.routes && s.routes.some(r => r.id === rId)));
        }
        setRouteStops(stops);
    };

    useEffect(() => {
        if (selectedRouteId) {
            const current = routes.find(r => r.id === selectedRouteId);
            let stops = current?.stops || [];
            if ((!stops || stops.length === 0) && allStops.length > 0) {
                stops = allStops.filter(s => s.routeId === selectedRouteId || (s.routeIds && s.routeIds.includes(selectedRouteId)) || (s.routes && s.routes.some(r => r.id === selectedRouteId)));
            }
            setRouteStops(stops);
        }
    }, [selectedRouteId, routes, allStops]);

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
        setRouteForm({ 
            id: null, 
            name: '', 
            color: '#3b82f6', 
            routeClass: 'araba', 
            description: '', 
            isActive: true,
            departurePortId: TURKISH_SEAPORTS[0]?.id || '',
            arrivalPortId: TURKISH_SEAPORTS[1]?.id || '',
            departureAirportId: TURKISH_AIRPORTS[0]?.id || '',
            arrivalAirportId: TURKISH_AIRPORTS[1]?.id || ''
        });
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
            isActive: route.isActive !== false,
            departurePortId: TURKISH_SEAPORTS[0]?.id || '',
            arrivalPortId: TURKISH_SEAPORTS[1]?.id || '',
            departureAirportId: TURKISH_AIRPORTS[0]?.id || '',
            arrivalAirportId: TURKISH_AIRPORTS[1]?.id || ''
        });
        setIsEditingRoute(true);
        setShowRouteModal(true);
    };

    const handleSaveRoute = async (e) => {
        e.preventDefault();

        // 1. Havayolu / Uçuş Güzergahı: İki havalimanı arasında otomatik eğri rota oluşturulur
        if (routeForm.routeClass === 'havayolu' && !isEditingRoute) {
            if (!routeForm.departureAirportId || !routeForm.arrivalAirportId) {
                setError('Lütfen kalkış ve varış havalimanlarını seçiniz.');
                return;
            }
            if (routeForm.departureAirportId === routeForm.arrivalAirportId) {
                setError('Kalkış ve varış havalimanları birbirinden farklı olmalıdır.');
                return;
            }
            const aptA = allAvailableAirports.find(a => a.id === routeForm.departureAirportId || a.stopId === routeForm.departureAirportId || a.iata === routeForm.departureAirportId || a.name === routeForm.departureAirportId);
            const aptB = allAvailableAirports.find(a => a.id === routeForm.arrivalAirportId || a.stopId === routeForm.arrivalAirportId || a.iata === routeForm.arrivalAirportId || a.name === routeForm.arrivalAirportId);
            if (!aptA || !aptB) {
                setError('Seçilen havalimanları bulunamadı.');
                return;
            }

            try {
                setLoading(true);
                setError('');
                const lineWkt = generateFlightRouteWkt(aptA, aptB);
                const autoName = routeForm.name?.trim() || `${aptA.shortName} - ${aptB.shortName} Uçuş Hattı`;
                const autoDesc = routeForm.description?.trim() || `${aptA.name} ile ${aptB.name} arası hava koridoru ve uçuş rotası`;

                const created = await transportApi.createRoute({
                    name: autoName,
                    color: routeForm.color || '#0284c7',
                    routeClass: 'havayolu',
                    description: autoDesc,
                    wkt: lineWkt,
                    isActive: true
                }, token);

                // Kalkış Havalimanı Durağı
                await transportApi.createStop({
                    name: aptA.name,
                    stopCode: aptA.iata || 'DEP',
                    description: aptA.description || 'Kalkış Havalimanı Terminali',
                    stopClass: 'havayolu',
                    orderIndex: 1,
                    routeId: created.id,
                    wkt: `POINT(${aptA.coordinates[0]} ${aptA.coordinates[1]})`,
                    isActive: true
                }, token);

                // Varış Havalimanı Durağı
                await transportApi.createStop({
                    name: aptB.name,
                    stopCode: aptB.iata || 'ARR',
                    description: aptB.description || 'Varış Havalimanı Terminali',
                    stopClass: 'havayolu',
                    orderIndex: 2,
                    routeId: created.id,
                    wkt: `POINT(${aptB.coordinates[0]} ${aptB.coordinates[1]})`,
                    isActive: true
                }, token);

                setShowRouteModal(false);
                setSuccessMsg(`${autoName} başarıyla oluşturuldu ve havalimanı terminalleri bağlandı.`);
                await loadRoutes(true);
                setSelectedRouteId(created.id);
            } catch (err) {
                setError(err.message || 'Uçuş rotası oluşturulurken hata oluştu.');
            } finally {
                setLoading(false);
            }
            return;
        }

        // 2. Deniz / Gemi Güzergahı: Yalnızca iki liman arasında oluşturulur
        if (routeForm.routeClass === 'gemi' && !isEditingRoute) {
            if (!routeForm.departurePortId || !routeForm.arrivalPortId) {
                setError('Lütfen kalkış ve varış limanlarını seçiniz.');
                return;
            }
            if (routeForm.departurePortId === routeForm.arrivalPortId) {
                setError('Kalkış ve varış limanları birbirinden farklı olmalıdır.');
                return;
            }
            const portA = allAvailablePorts.find(p => p.id === routeForm.departurePortId || p.stopId === routeForm.departurePortId || p.name === routeForm.departurePortId);
            const portB = allAvailablePorts.find(p => p.id === routeForm.arrivalPortId || p.stopId === routeForm.arrivalPortId || p.name === routeForm.arrivalPortId);
            if (!portA || !portB) {
                setError('Seçilen limanlar bulunamadı.');
                return;
            }

            try {
                setLoading(true);
                setError('');
                const lineWkt = generateMaritimeRouteWkt(portA, portB);
                const autoName = routeForm.name?.trim() || `${portA.shortName} - ${portB.shortName} Deniz Hattı`;
                const autoDesc = routeForm.description?.trim() || `${portA.name} ile ${portB.name} arası deniz koridoru ve liman bağlantısı`;

                const created = await transportApi.createRoute({
                    name: autoName,
                    color: routeForm.color || '#0284c7',
                    routeClass: 'gemi',
                    description: autoDesc,
                    wkt: lineWkt,
                    isActive: true
                }, token);

                // Kalkış Limanı Durağı
                await transportApi.createStop({
                    name: portA.name,
                    description: portA.description || portA.type,
                    stopClass: 'gemi',
                    orderIndex: 1,
                    routeId: created.id,
                    wkt: `POINT(${portA.coordinates[0]} ${portA.coordinates[1]})`,
                    isActive: true
                }, token);

                // Varış Limanı Durağı
                await transportApi.createStop({
                    name: portB.name,
                    description: portB.description || portB.type,
                    stopClass: 'gemi',
                    orderIndex: 2,
                    routeId: created.id,
                    wkt: `POINT(${portB.coordinates[0]} ${portB.coordinates[1]})`,
                    isActive: true
                }, token);

                setShowRouteModal(false);
                setSuccessMsg(`${autoName} başarıyla oluşturuldu ve liman durakları bağlandı.`);
                await loadRoutes(true);
                setSelectedRouteId(created.id);
            } catch (err) {
                setError(err.message || 'Deniz rotası oluşturulurken hata oluştu.');
            } finally {
                setLoading(false);
            }
            return;
        }

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
    const handleOpenCreateStop = (position = 'end', targetStopId = null) => {
        // Eğer seçili hat bir deniz/gemi hattı ise yalnızca liman durakları eklenebilir
        if (selectedRoute && normalizeTransitClass(selectedRoute.routeClass) === 'deniz') {
            const existingPortNames = routeStops.map(s => s.name);
            const availablePorts = allAvailablePorts.filter(p => !existingPortNames.includes(p.name));
            const firstAvailable = availablePorts[0]?.id || allAvailablePorts[0]?.id || '';
            setArrivalForm({
                arrivalPortId: firstAvailable,
                routeName: selectedRoute.name
            });
            setShowArrivalModal(true);
            return;
        }

        const initialClass = selectedRoute ? normalizeTransitClass(selectedRoute.routeClass) : 'otobus';
        let defaultOrder = 1;
        if (position === 'start') {
            defaultOrder = 1;
        } else if (position === 'after' && targetStopId) {
            const targetStop = routeStops.find(s => s.id === targetStopId);
            defaultOrder = targetStop ? (targetStop.orderIndex || 1) + 1 : (routeStops.length + 1);
        } else {
            defaultOrder = selectedRoute ? (routeStops.length + 1) : ((allStops || []).length + 1);
        }

        const initialRouteIds = selectedRouteId ? [selectedRouteId] : [];
        setInsertPosition(position);
        setInsertTargetStopId(targetStopId);

        const prefix = (initialClass || 'DURAK').slice(0, 4).toUpperCase();
        const suggestedCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        setStopForm({
            id: null,
            name: '',
            stopCode: suggestedCode,
            stopClass: initialClass,
            routeId: selectedRouteId || null,
            routeIds: initialRouteIds,
            description: '',
            imageUrl: '',
            orderIndex: defaultOrder,
            wkt: '',
            isActive: true
        });
        setIsEditingStop(false);
        setShowStopModal(true);
    };

    const handleOpenEditStop = (stop) => {
        const directRouteIds = stop.routeIds && stop.routeIds.length > 0 
            ? stop.routeIds 
            : (stop.routeId ? [stop.routeId] : (stop.routes ? stop.routes.map(r => r.id) : []));

        setStopForm({
            id: stop.id,
            name: stop.name,
            stopCode: stop.stopCode || '',
            stopClass: stop.stopClass || (selectedRoute?.routeClass || 'otobus'),
            routeId: stop.routeId || (directRouteIds[0] || null),
            routeIds: directRouteIds,
            description: stop.description || '',
            imageUrl: stop.imageUrl || '',
            orderIndex: stop.orderIndex || 1,
            wkt: stop.wkt || (stop.longitude && stop.latitude ? `POINT(${stop.longitude} ${stop.latitude})` : ''),
            isActive: stop.isActive !== false
        });
        setIsEditingStop(true);
        setShowStopModal(true);
    };

    const handleUpdateStopRank = async (stop, delta, e) => {
        if (e) e.stopPropagation();
        if (!selectedRouteId || !routeStops || routeStops.length <= 1) return;

        const currentIndex = routeStops.findIndex(s => s.id === stop.id);
        if (currentIndex === -1) return;

        const isShift = Boolean(e && e.shiftKey);
        let targetIndex;

        if (delta < 0) {
            // Yukarı taşı (▲) -> Shift ile basıldığında EN ÜSTE (index 0)
            if (currentIndex === 0) return;
            targetIndex = isShift ? 0 : (currentIndex - 1);
        } else {
            // Aşağı taşı (▼) -> Shift ile basıldığında EN ALTA (index length - 1)
            if (currentIndex >= routeStops.length - 1) return;
            targetIndex = isShift ? (routeStops.length - 1) : (currentIndex + 1);
        }

        if (targetIndex === currentIndex) return;

        const updated = [...routeStops];
        const [moved] = updated.splice(currentIndex, 1);
        updated.splice(targetIndex, 0, moved);

        const reordered = updated.map((item, idx) => ({
            ...item,
            orderIndex: idx + 1
        }));

        setRouteStops(reordered);

        try {
            setIsReordering(true);
            const orderedIds = reordered.map(s => s.id);
            await transportApi.reorderStops(selectedRouteId, orderedIds, token);
            const moveMsg = isShift
                ? (targetIndex === 0 ? `"${stop.name}" durağı en üste (1. sıraya) taşındı.` : `"${stop.name}" durağı en alta (${targetIndex + 1}. sıraya) taşındı.`)
                : `"${stop.name}" durağının sırası ${targetIndex + 1} olarak güncellendi.`;
            setSuccessMsg(moveMsg);
            setRoutes(prev => prev.map(r => r.id === selectedRouteId ? { ...r, stops: reordered } : r));
        } catch (err) {
            setError('Sıra güncellenemedi: ' + err.message);
            await loadRoutes(true);
        } finally {
            setIsReordering(false);
        }
    };

    const handleSaveStop = async (e) => {
        e.preventDefault();
        if (!stopForm.name.trim()) {
            setError('Durak adı boş bırakılamaz.');
            return;
        }

        try {
            setLoading(true);
            const activeRouteIds = (stopForm.routeIds || []).map(Number).filter(r => r > 0);
            const primaryRouteId = activeRouteIds.length > 0 ? activeRouteIds[0] : (stopForm.routeId ? parseInt(stopForm.routeId, 10) : null);

            if (isEditingStop) {
                await transportApi.updateStop(stopForm.id, {
                    name: stopForm.name.trim(),
                    stopCode: stopForm.stopCode?.trim() || null,
                    stopClass: stopForm.stopClass || 'otobus',
                    routeId: primaryRouteId,
                    routeIds: activeRouteIds,
                    description: stopForm.description?.trim() || null,
                    imageUrl: stopForm.imageUrl?.trim() || null,
                    orderIndex: stopForm.orderIndex,
                    wkt: stopForm.wkt,
                    isActive: stopForm.isActive
                }, token);
                setSuccessMsg('Durak başarıyla güncellendi.');
            } else {
                await transportApi.createStop({
                    name: stopForm.name.trim(),
                    stopCode: stopForm.stopCode?.trim() || null,
                    stopClass: stopForm.stopClass || 'otobus',
                    routeId: primaryRouteId,
                    routeIds: activeRouteIds,
                    description: stopForm.description?.trim() || null,
                    imageUrl: stopForm.imageUrl?.trim() || null,
                    orderIndex: stopForm.orderIndex,
                    wkt: stopForm.wkt || 'POINT(32.8543 39.9208)' // Ankara Kızılay varsayılanı
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

    // Gemi güzergahı için varış limanı ekleme
    const handleOpenAddArrival = () => {
        if (!selectedRouteId || !selectedRoute) return;
        const existingPortNames = routeStops.map(s => s.name);
        const availablePorts = allAvailablePorts.filter(p => !existingPortNames.includes(p.name));
        const firstAvailable = availablePorts[0]?.id || allAvailablePorts[0]?.id || '';
        setArrivalForm({ arrivalPortId: firstAvailable, routeName: '' });
        setShowArrivalModal(true);
    };

    const handleAddArrivalPort = async (e) => {
        e.preventDefault();
        if (!arrivalForm.arrivalPortId || !selectedRoute) return;

        const arrivalPort = allAvailablePorts.find(p => p.id === arrivalForm.arrivalPortId || p.stopId === arrivalForm.arrivalPortId || p.name === arrivalForm.arrivalPortId);
        if (!arrivalPort) {
            setError('Seçilen liman bulunamadı.');
            return;
        }

        try {
            setIsAddingArrival(true);
            setError('');

            const newOrderIndex = routeStops.length + 1;
            await transportApi.createStop({
                name: arrivalPort.name,
                description: arrivalPort.description || arrivalPort.type,
                stopClass: 'gemi',
                orderIndex: newOrderIndex,
                routeId: selectedRouteId,
                wkt: `POINT(${arrivalPort.coordinates[0]} ${arrivalPort.coordinates[1]})`,
                isActive: true
            }, token);

            const departureStop = routeStops[0];
            if (departureStop) {
                const departurePort = allAvailablePorts.find(p => p.name === departureStop.name || p.id === departureStop.id || p.stopId === departureStop.id);
                if (departurePort) {
                    const lineWkt = generateMaritimeRouteWkt(departurePort, arrivalPort);
                    const depClean = cleanPortName(departurePort.shortName || departurePort.name);
                    const arrClean = cleanPortName(arrivalPort.shortName || arrivalPort.name);
                    const autoName = arrivalForm.routeName?.trim() || `${depClean} - ${arrClean}`;

                    await transportApi.updateRoute(selectedRouteId, {
                        ...selectedRoute,
                        name: autoName,
                        wkt: lineWkt
                    }, token);
                }
            }

            setShowArrivalModal(false);
            setSuccessMsg('Varış limanı eklendi ve güzergâh oluşturuldu.');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAddingArrival(false);
        }
    };

    // MEVCUT DURAĞI GÜZERGAHA BAĞLA (Güzergah Menüsünden)
    const handleAttachExistingStopToRoute = async (stopId, position = attachPosition, targetStopId = attachTargetStopId) => {
        if (!selectedRouteId) return;
        try {
            setLoading(true);
            const res = await transportApi.addStopToRoute(selectedRouteId, stopId, token, position, targetStopId ? Number(targetStopId) : null);
            const stopObj = (allStops || []).find(s => s.id === stopId);
            setSuccessMsg(res.message || `"${stopObj?.name || 'Durak'}" durağı güzergaha başarıyla bağlandı.`);
            setShowAttachStopModal(false);
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'Durak güzergaha bağlanamadı.');
        } finally {
            setLoading(false);
        }
    };

    // DURAĞI SEÇİLİ GÜZERGAHTAN ÇIKAR (Diğer hatlar korunur)
    const handleRemoveStopFromCurrentRoute = async (stop, e) => {
        if (e) e.stopPropagation();
        if (!selectedRouteId) return;
        const isMulti = (stop.routeIds && stop.routeIds.length > 1) || (stop.routes && stop.routes.length > 1);
        const confirmMsg = isMulti
            ? `"${stop.name}" durağı yalnızca bu hattan (${selectedRoute?.name || 'seçili hat'}) çıkarılacaktır. Diğer hatlardaki bağlantısı devam eder. Onaylıyor musunuz?`
            : `"${stop.name}" durağını bu hattan çıkarmak istediğinizden emin misiniz?`;
        
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            const res = await transportApi.removeStopFromRoute(selectedRouteId, stop.id, token);
            setSuccessMsg(res.message || 'Durak güzergahtan çıkarıldı.');
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'Durak hattan çıkarılamadı.');
        } finally {
            setLoading(false);
        }
    };

    // DURAK KARTINDAN HIZLI GÜZERGAH BAĞLA / ÇIKAR (Durak Menüsünden)
    const handleQuickToggleRouteForStop = async (stop, routeId, e) => {
        if (e) e.stopPropagation();
        const currentRouteIds = stop.routeIds && stop.routeIds.length > 0
            ? stop.routeIds
            : (stop.routeId ? [stop.routeId] : (stop.routes ? stop.routes.map(r => r.id) : []));

        const isCurrentlyAttached = currentRouteIds.includes(routeId);

        try {
            setLoading(true);
            if (isCurrentlyAttached) {
                const res = await transportApi.removeStopFromRoute(routeId, stop.id, token);
                setSuccessMsg(res.message || 'Hat bağlantısı kaldırıldı.');
            } else {
                const res = await transportApi.addStopToRoute(routeId, stop.id, token);
                setSuccessMsg(res.message || 'Hat durağa başarıyla bağlandı.');
            }
            await loadRoutes(true);
        } catch (err) {
            setError(err.message || 'İşlem başarısız oldu.');
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

    // Dinamik İl Listesi (Güzergahlardan Türetilen)
    const availableRouteCities = useMemo(() => {
        const citySet = new Set(['Ankara', 'İstanbul', 'İzmir', 'Mersin / Akdeniz', 'Bursa', 'Antalya']);
        (routes || []).forEach(r => {
            const c = detectCityForEntity(r);
            if (c && c !== 'Diğer') citySet.add(c);
        });
        return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'tr'));
    }, [routes]);

    // Dinamik İl Listesi (Duraklardan Türetilen)
    const availableStopCities = useMemo(() => {
        const citySet = new Set(['Ankara', 'İstanbul', 'İzmir', 'Mersin / Akdeniz', 'Bursa', 'Antalya']);
        (allStops || []).forEach(s => {
            const c = detectCityForEntity(s);
            if (c && c !== 'Diğer') citySet.add(c);
        });
        return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'tr'));
    }, [allStops]);

    // 6+1 Temel Sınıflandırma Sayımları ve Filtrelenmiş Liste
    const typeCounts = useMemo(() => ({
        ALL: routes.length,
        havayolu: routes.filter(r => normalizeTransitClass(r.routeClass) === 'havayolu').length,
        otobus: routes.filter(r => normalizeTransitClass(r.routeClass) === 'otobus').length,
        metro: routes.filter(r => normalizeTransitClass(r.routeClass) === 'metro').length,
        tramvay: routes.filter(r => normalizeTransitClass(r.routeClass) === 'tramvay').length,
        metrobus: routes.filter(r => normalizeTransitClass(r.routeClass) === 'metrobus').length,
        tren: routes.filter(r => normalizeTransitClass(r.routeClass) === 'tren').length,
        deniz: routes.filter(r => normalizeTransitClass(r.routeClass) === 'deniz').length
    }), [routes]);

    const filteredRoutes = useMemo(() => {
        return (routes || []).filter(route => {
            const rClass = normalizeTransitClass(route.routeClass);
            // Tür Filtresi
            if (selectedTypeFilter !== 'ALL') {
                if (rClass !== normalizeTransitClass(selectedTypeFilter)) return false;
            }
            // Şehir / İl Filtresi
            if (selectedCityFilter !== 'ALL') {
                const detected = detectCityForEntity(route);
                if (detected !== selectedCityFilter) return false;
            }
            // Arama Filtresi (İsim, Açıklama, Bağlı Duraklar)
            if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesName = (route.name || '').toLowerCase().includes(q);
                const matchesDesc = (route.description || '').toLowerCase().includes(q);
                const matchesStops = (route.stops || []).some(s => (s.name || '').toLowerCase().includes(q));
                if (!matchesName && !matchesDesc && !matchesStops) return false;
            }
            return true;
        }).sort((a, b) => {
            if (routeSortBy === 'TYPE') {
                const pa = TYPE_PRIORITY[normalizeTransitClass(a.routeClass)] || 99;
                const pb = TYPE_PRIORITY[normalizeTransitClass(b.routeClass)] || 99;
                if (pa !== pb) return pa - pb;
                return (a.name || '').localeCompare(b.name || '', 'tr');
            }
            if (routeSortBy === 'CITY') {
                const ca = detectCityForEntity(a);
                const cb = detectCityForEntity(b);
                const cmp = ca.localeCompare(cb, 'tr');
                if (cmp !== 0) return cmp;
                return (a.name || '').localeCompare(b.name || '', 'tr');
            }
            if (routeSortBy === 'STOPS') {
                const sa = a.stops ? a.stops.length : 0;
                const sb = b.stops ? b.stops.length : 0;
                if (sa !== sb) return sb - sa;
            }
            return (a.name || '').localeCompare(b.name || '', 'tr');
        });
    }, [routes, selectedTypeFilter, selectedCityFilter, searchQuery, routeSortBy]);

    return (
        <div className="route-management-container" style={{ padding: '24px 30px', height: '100%', overflowY: 'auto' }}>
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
                            ? 'Akıllı Ulaşım Modülü: Tür sınıflandırması, liman koridorları ve hat yönetimi' 
                            : 'Smart Transport Module: Type classification, port corridors, and line management'}
                    </p>
                </div>

            </div>

            {/* Notification Alerts */}
            {error && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            )}
            {successMsg && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            )}

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: isDarkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                    boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                            {lang === 'tr' ? 'Toplam Güzergah' : 'Total Routes'}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{routes.length}</div>
                    </div>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="13" rx="2" />
                            <path d="M4 9h16" />
                            <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                            <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                        </svg>
                    </div>
                </div>

                <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: isDarkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                    boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                            {lang === 'tr' ? 'Toplam Durak' : 'Total Stops'}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{totalStopsCount || allStops.length}</div>
                    </div>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </div>
                </div>

                <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: isDarkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                    boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                            {lang === 'tr' ? 'Deniz / Gemi Hatları' : 'Maritime & Ferry Lines'}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>{typeCounts.deniz || typeCounts.gemi || 0}</div>
                    </div>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="3" />
                            <line x1="12" y1="8" x2="12" y2="21" />
                            <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Ana Mod Sekmeleri: Güzergah Yönetimi vs Durak Yönetimi */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, paddingBottom: '12px' }}>
                <button
                    type="button"
                    onClick={() => setActiveMainTab('routes')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: activeMainTab === 'routes' ? 700 : 600,
                        cursor: 'pointer',
                        border: activeMainTab === 'routes' ? '1.5px solid #2563eb' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        backgroundColor: activeMainTab === 'routes' ? (isDarkMode ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : (isDarkMode ? '#1e293b' : '#ffffff'),
                        color: activeMainTab === 'routes' ? (isDarkMode ? '#60a5fa' : '#2563eb') : (isDarkMode ? '#94a3b8' : '#64748b'),
                        transition: 'all 0.15s ease'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="4" y="4" width="16" height="13" rx="2" />
                        <path d="M4 9h16" />
                        <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                        <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                        <path d="M6 17v2.5M18 17v2.5" />
                    </svg>
                    <span>Güzergah Yönetimi ({routes.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveMainTab('stops')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: activeMainTab === 'stops' ? 700 : 600,
                        cursor: 'pointer',
                        border: activeMainTab === 'stops' ? '1.5px solid #10b981' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        backgroundColor: activeMainTab === 'stops' ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5') : (isDarkMode ? '#1e293b' : '#ffffff'),
                        color: activeMainTab === 'stops' ? (isDarkMode ? '#34d399' : '#059669') : (isDarkMode ? '#94a3b8' : '#64748b'),
                        transition: 'all 0.15s ease'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                    <span>Durak Yönetimi ({allStops.length})</span>
                </button>
            </div>

            {/* SEKME 1: GÜZERGAHLAR & HATLAR */}
            {activeMainTab === 'routes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 460px) 1fr', gap: '24px', alignItems: 'start' }}>
                    {/* Left: Route List & Filters */}
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                                Güzergah Listesi
                            </h3>
                            <button
                                onClick={handleOpenCreateRoute}
                                style={{
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '7px 12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Yeni Hat Ekle
                            </button>
                        </div>

                        {/* Tür Filtre Hapları */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[
                                { key: 'ALL', label: 'Tümü', count: typeCounts.ALL, color: '#3b82f6' },
                                { key: 'havayolu', label: 'Havayolu', count: typeCounts.havayolu, color: '#0284c7' },
                                { key: 'otobus', label: 'Otobüs', count: typeCounts.otobus, color: '#0284c7' },
                                { key: 'metro', label: 'Metro', count: typeCounts.metro, color: '#ef4444' },
                                { key: 'tramvay', label: 'Tramvay', count: typeCounts.tramvay, color: '#06b6d4' },
                                { key: 'metrobus', label: 'Metrobüs', count: typeCounts.metrobus, color: '#f59e0b' },
                                { key: 'tren', label: 'Tren', count: typeCounts.tren, color: '#8b5cf6' },
                                { key: 'deniz', label: 'Deniz', count: typeCounts.deniz, color: '#0ea5e9' }
                            ].map(t => {
                                const isSelected = selectedTypeFilter === t.key;
                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => setSelectedTypeFilter(t.key)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 10px',
                                            borderRadius: '6px',
                                            fontSize: '11.5px',
                                            fontWeight: isSelected ? '700' : '500',
                                            border: `1px solid ${isSelected ? t.color : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                                            color: isSelected ? (isDarkMode ? '#ffffff' : t.color) : (isDarkMode ? '#94a3b8' : '#64748b'),
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <span>{t.label}</span>
                                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '10px', backgroundColor: isSelected ? t.color : (isDarkMode ? '#334155' : '#e2e8f0'), color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#64748b') }}>
                                            {t.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Şehir ve Sıralama Filtre Satırı */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '3px' }}>
                                    İl / Bölge Filtresi
                                </label>
                                <select
                                    value={selectedCityFilter}
                                    onChange={(e) => setSelectedCityFilter(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                        color: isDarkMode ? '#ffffff' : '#0f172a',
                                        fontSize: '12px'
                                    }}
                                >
                                    <option value="ALL">Tüm İller & Bölgeler</option>
                                    {availableRouteCities.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value="Diğer">Diğer İller</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '3px' }}>
                                    Sıralama Ölçütü
                                </label>
                                <select
                                    value={routeSortBy}
                                    onChange={(e) => setRouteSortBy(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                        color: isDarkMode ? '#ffffff' : '#0f172a',
                                        fontSize: '12px'
                                    }}
                                >
                                    <option value="TYPE">Türe Göre (Metro ➔ Gemi)</option>
                                    <option value="NAME">İsim (A-Z)</option>
                                    <option value="STOPS">Durak Sayısı (Çoktan Aza)</option>
                                </select>
                            </div>
                        </div>

                        {/* Arama Kutusu */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Güzergah adı veya açıklama ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 34px',
                                    borderRadius: '8px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                    color: isDarkMode ? '#ffffff' : '#0f172a',
                                    fontSize: '13px'
                                }}
                            />
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#94a3b8"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Güzergahlar Kart Listesi */}
                        {loading && routes.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>Güzergahlar yükleniyor...</div>
                        ) : filteredRoutes.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                {searchQuery ? 'Aramanıza uygun güzergah bulunamadı.' : 'Bu kategoride kayıtlı güzergah bulunmuyor.'}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                                {filteredRoutes.map(route => {
                                    const isSelected = selectedRouteId === route.id;
                                    const clsKey = route.routeClass || 'araba';
                                    const clsInfo = getRouteClassInfo(clsKey);
                                    const detectedCity = detectCityForEntity(route);
                                    const currentSpeed = simSpeedMap[route.id] || 1;
                                    return (
                                        <div
                                            key={route.id}
                                            onClick={() => handleSelectRoute(route)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                backgroundColor: isSelected ? (isDarkMode ? '#334155' : '#eff6ff') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                                border: `1.5px solid ${isSelected ? (route.color || '#3b82f6') : (isDarkMode ? '#334155' : '#e2e8f0')}`,
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isSelected ? route.color : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: isSelected ? '#ffffff' : (clsInfo?.color || '#3b82f6'),
                                                    flexShrink: 0
                                                }}>
                                                    <RouteClassIcon classKey={clsKey} size={16} color={isSelected ? '#ffffff' : (clsInfo?.color || '#3b82f6')} />
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {route.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                        <span>{route.stops?.length || 0} Durak</span>
                                                        <span>•</span>
                                                        <span>{clsInfo?.label || clsKey}</span>
                                                        <span>•</span>
                                                        <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe', color: '#0284c7', fontSize: '10px', fontWeight: 600 }}>
                                                            {detectedCity}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                {(() => {
                                                    const isMetroOrSea = ['metro', 'gemi', 'tren'].includes((route.routeClass || '').toLowerCase());
                                                    const isOsrmDisabled = isGeneratingRouteId === route.id || !route.stops || route.stops.length < 2 || isMetroOrSea;
                                                    const osrmTitle = isMetroOrSea 
                                                        ? 'Metro ve raylı hatlar karayolu olmadığı için OSRM karayolu hesaplaması kullanılamaz' 
                                                        : ((!route.stops || route.stops.length < 2) ? 'Rota için en az 2 durak gereklidir' : 'OSRM ile Karayolu Rotasını Hesapla');
                                                    return (
                                                        <button
                                                            onClick={(e) => handleGenerateOsrmRoute(route.id, e)}
                                                            disabled={isOsrmDisabled}
                                                            title={osrmTitle}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: isOsrmDisabled ? '#64748b' : '#10b981',
                                                                padding: '5px',
                                                                cursor: isOsrmDisabled ? 'not-allowed' : 'pointer',
                                                                borderRadius: '5px',
                                                                opacity: isOsrmDisabled ? 0.35 : 1
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                                                        </button>
                                                    );
                                                })()}
                                                <button
                                                    className="admin-action-btn edit-icon-btn"
                                                    onClick={(e) => handleOpenEditRoute(route, e)}
                                                    title={isTr ? "Güzergahı Düzenle" : "Edit Route"}
                                                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                >
                                                    <EditIcon size={13} />
                                                </button>
                                                <button
                                                    className="admin-action-btn delete-icon-btn"
                                                    onClick={(e) => handleDeleteRoute(route.id, e)}
                                                    title={isTr ? "Güzergahı Sil" : "Delete Route"}
                                                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                >
                                                    <TrashIcon size={14} />
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
                                                {lang === 'tr' ? 'Durakları sürükleyip bırakarak güzergah sırasını değiştirin' : 'Drag and drop stops to reorder route sequence'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {/* Hattı Haritada Bük / Düzenle */}
                                        {onEditRouteGeometryOnMap && (
                                            <button
                                                type="button"
                                                onClick={() => onEditRouteGeometryOnMap(selectedRoute)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', fontWeight: '700', fontSize: '13px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.25)' }}
                                                title={lang === 'tr' ? "Bu hattın harita üzerindeki çizgisini serbestçe bükün ve kaydedin" : "Bend and customize the route line geometry freely on map"}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                {trans.btnBendRoute || (lang === 'tr' ? 'Hattı Bük' : 'Bend Route')}
                                            </button>
                                        )}

                                        {/* Kuş Uçuşu (Düz Çizgiye Sıfırla) Küçük Buton */}
                                        <button
                                            type="button"
                                            onClick={(e) => handleSwitchGeometryMode(selectedRoute.id, 'direct', e)}
                                            disabled={isGeneratingRouteId === selectedRoute.id}
                                            style={{
                                                padding: '6px 11px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                borderRadius: '7px',
                                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                cursor: 'pointer',
                                                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                            title={lang === 'tr' ? "Tüm bükümleri sıfırlayıp duraklar arası doğrudan düz çizgiye dönüştürür" : "Reset all bends and convert into direct straight lines between stops"}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="5" y1="12" x2="19" y2="12"/><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/></svg>
                                            {trans.btnDirect || (lang === 'tr' ? 'Kuş Uçuşu' : 'Direct Line')}
                                        </button>

                                        {/* Sadece Otobüs için OSRM Karayolu Rota Butonu */}
                                        {((selectedRoute.routeClass || '').toLowerCase() === 'otobus') && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleGenerateOsrmRoute(selectedRoute.id, e)}
                                                disabled={isGeneratingRouteId === selectedRoute.id || routeStops.length < 2}
                                                style={{
                                                    padding: '7px 12px',
                                                    fontSize: '12.5px',
                                                    fontWeight: 600,
                                                    borderRadius: '7px',
                                                    border: 'none',
                                                    cursor: isGeneratingRouteId === selectedRoute.id || routeStops.length < 2 ? 'not-allowed' : 'pointer',
                                                    backgroundColor: '#2563eb',
                                                    color: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    opacity: routeStops.length < 2 ? 0.5 : 1
                                                }}
                                                title={lang === 'tr' ? "OSRM ile duraklar arası gerçek karayolu rotasını hesaplar" : "Calculate real highway road routing with OSRM between stops"}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                                                {isGeneratingRouteId === selectedRoute.id ? (lang === 'tr' ? 'Hesaplanıyor...' : 'Calculating...') : (trans.btnOsrmRoute || (lang === 'tr' ? 'OSRM Rota' : 'OSRM Route'))}
                                            </button>
                                        )}

                                        {((selectedRoute.routeClass || '').toLowerCase() === 'gemi') ? (
                                            <button
                                                onClick={handleOpenAddArrival}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '7px', fontWeight: '600', fontSize: '12.5px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                {trans.btnAddArrival || (lang === 'tr' ? 'Varış Ekle' : 'Add Destination')}
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => {
                                                        setAttachPosition('end');
                                                        setAttachTargetStopId('');
                                                        setAttachSearchQuery('');
                                                        setShowAttachStopModal(true);
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '7px', fontWeight: '600', fontSize: '12px', backgroundColor: isDarkMode ? '#334155' : '#e0f2fe', color: isDarkMode ? '#38bdf8' : '#0284c7', border: `1px solid ${isDarkMode ? '#475569' : '#bae6fd'}`, cursor: 'pointer' }}
                                                    title={lang === 'tr' ? "Sistemdeki mevcut duraklardan birini bu güzergaha bağla" : "Attach an existing stop from the system to this route"}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                    <span>{trans.attachStop || (lang === 'tr' ? 'Mevcut Durak Bağla' : 'Attach Existing Stop')}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenCreateStop('start')}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '7px', fontWeight: '600', fontSize: '12px', backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe', color: '#2563eb', border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`, cursor: 'pointer' }}
                                                    title={lang === 'tr' ? "Güzergahın en başına (1. sıra) yeni durak ekle" : "Add a new stop to the beginning (1st position) of this route"}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                                                    <span>{trans.prependStop || (lang === 'tr' ? 'Başa Ekle' : 'Prepend')}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenCreateStop('end')}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '7px', fontWeight: '600', fontSize: '12px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                                                    title={lang === 'tr' ? "Güzergahın sonuna yeni durak ekle" : "Add a new stop to the end of this route"}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                    <span>{trans.appendStop || (lang === 'tr' ? 'Sona Ekle' : 'Append')}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Drag & Drop Duraklar Listesi */}
                                {routeStops.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                        {lang === 'tr' 
                                            ? 'Bu hatta henüz durak eklenmemiş. Yukarıdaki "Mevcut Durak Bağla" veya "Yeni Durak Ekle" butonlarını kullanabilirsiniz.' 
                                            : 'No stops attached to this route yet. Use "Attach Existing Stop" or "Add Stop" buttons above.'}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {routeStops.map((stop, index) => {
                                            const isDragged = draggedIndex === index;
                                            const otherRoutes = (stop.routes || []).filter(r => r.id !== selectedRouteId);
                                            return (
                                                <div
                                                    key={stop.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, index)}
                                                    onDragOver={(e) => handleDragOver(e, index)}
                                                    onDrop={(e) => handleDrop(e, index)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '10px 14px',
                                                        borderRadius: '10px',
                                                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                                                        cursor: isReordering ? 'wait' : 'grab',
                                                        opacity: isDragged ? 0.4 : 1,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                                            <button 
                                                                onClick={(e) => handleUpdateStopRank(stop, -1, e)} 
                                                                disabled={index === 0} 
                                                                style={{ background: 'none', border: 'none', color: index === 0 ? '#475569' : '#94a3b8', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: 0, fontSize: '9px' }}
                                                                title="Yukarı Taşı (Shift ile En Üste Gönder)"
                                                            >
                                                                ▲
                                                            </button>
                                                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: selectedRoute.color || '#3b82f6', color: '#ffffff', fontWeight: 'bold', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {stop.orderIndex || (index + 1)}
                                                            </span>
                                                            <button 
                                                                onClick={(e) => handleUpdateStopRank(stop, 1, e)} 
                                                                disabled={index >= routeStops.length - 1} 
                                                                style={{ background: 'none', border: 'none', color: index >= routeStops.length - 1 ? '#475569' : '#94a3b8', cursor: index >= routeStops.length - 1 ? 'not-allowed' : 'pointer', padding: 0, fontSize: '9px' }}
                                                                title="Aşağı Taşı (Shift ile En Alta Gönder)"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                <span style={{ fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                                                    {stop.name}
                                                                </span>
                                                                {stop.stopCode && (
                                                                    <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', color: '#0284c7' }}>
                                                                        {stop.stopCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                                                {stop.latitude && stop.longitude && (
                                                                    <span>{stop.latitude.toFixed(4)}° N, {stop.longitude.toFixed(4)}° E</span>
                                                                )}
                                                                {otherRoutes.length > 0 && (
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span>• Diğer Hatlar:</span>
                                                                        {otherRoutes.map(or => (
                                                                            <span key={or.id} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0', color: or.color || '#3b82f6', fontWeight: 600 }}>
                                                                                {or.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => {
                                                                setAttachPosition('after');
                                                                setAttachTargetStopId(stop.id);
                                                                setAttachSearchQuery('');
                                                                setShowAttachStopModal(true);
                                                            }}
                                                            title={`"${stop.name}" durağından hemen sonraya mevcut durak bağla`}
                                                            style={{ background: 'none', border: 'none', color: '#10b981', padding: '6px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
                                                        </button>
                                                        {onRepositionStopOnMap && (
                                                            <button
                                                                onClick={() => onRepositionStopOnMap(stop)}
                                                                title="Durağın Konumunu Haritada Taşı"
                                                                style={{ background: 'none', border: 'none', color: '#38bdf8', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            className="admin-action-btn edit-icon-btn"
                                                            onClick={() => handleOpenEditStop(stop)}
                                                            title={isTr ? "Durağı ve Bağlı Hatları Düzenle" : "Edit Stop & Connected Lines"}
                                                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                        >
                                                            <EditIcon size={13} />
                                                        </button>
                                                        <button
                                                            className="admin-action-btn delete-icon-btn"
                                                            onClick={(e) => handleRemoveStopFromCurrentRoute(stop, e)}
                                                            title={isTr ? "Durağı Bu Güzergahtan Çıkar" : "Remove Stop from Route"}
                                                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                        >
                                                            <TrashIcon size={14} />
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
            )}

            {/* TAB 2: Durak Yönetimi (Full-Width Stop Management Panel) */}
            {activeMainTab === 'stops' && (
                <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Header & Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                                </svg>
                                <span>Tüm Duraklar ve POI Yönetimi</span>
                            </h3>
                            <p style={{ margin: 0, fontSize: '12.5px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                Tüm bağımsız ve güzergaha bağlı durakların isim, rank (sıra), sınıf ve konumlarını doğrudan düzenleyin.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: isDarkMode ? '#334155' : '#e2e8f0', color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: '600' }}>
                                {filteredStops.length} / {allStops.length} Durak Listeleniyor
                            </span>
                            <button
                                onClick={handleOpenCreateStop}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '12.5px',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Yeni Durak Ekle
                            </button>
                        </div>
                    </div>

                    {/* Filtre ve Arama Çubuğu */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Arama Input */}
                            <div style={{ flex: '1 1 240px', position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Durak adı, il, açıklama veya hat adı ara..."
                                    value={stopSearchQuery}
                                    onChange={(e) => setStopSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 34px',
                                        borderRadius: '8px',
                                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                        color: isDarkMode ? '#ffffff' : '#0f172a',
                                        fontSize: '13px'
                                    }}
                                />
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                {stopSearchQuery && (
                                    <button onClick={() => setStopSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Şehir Filtresi */}
                            <select
                                value={selectedStopCityFilter}
                                onChange={(e) => setSelectedStopCityFilter(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                    color: isDarkMode ? '#ffffff' : '#0f172a',
                                    fontSize: '12.5px',
                                    fontWeight: 600
                                }}
                            >
                                <option value="ALL">{lang === 'tr' ? 'Tüm Şehirler & Bölgeler' : 'All Cities & Regions'}</option>
                                {availableStopCities.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                                <option value="Diğer">{lang === 'tr' ? 'Diğer İller' : 'Other Provinces'}</option>
                            </select>

                            {/* Sıralama */}
                            <select
                                value={stopSortBy}
                                onChange={(e) => setStopSortBy(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                    color: isDarkMode ? '#ffffff' : '#0f172a',
                                    fontSize: '12.5px'
                                }}
                            >
                                <option value="TYPE">{lang === 'tr' ? 'Türe Göre Sırala (Metro ➔ Gemi)' : 'Sort by Type (Metro ➔ Ferry)'}</option>
                                <option value="NAME">{lang === 'tr' ? 'İsme Göre (A-Z)' : 'Sort by Name (A-Z)'}</option>
                            </select>

                            {/* Bağlantı Filtresi */}
                            <select
                                value={stopRouteFilter}
                                onChange={(e) => setStopRouteFilter(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                    color: isDarkMode ? '#ffffff' : '#0f172a',
                                    fontSize: '12.5px',
                                    fontWeight: 600
                                }}
                            >
                                <option value="ALL">● {lang === 'tr' ? 'Tüm Güzergahlar & Duraklar' : 'All Routes & Stops'} ({availableStopRoutes.length})</option>
                                <optgroup label={lang === 'tr' ? `${selectedStopCityFilter === 'ALL' ? 'Tüm Şehirler' : selectedStopCityFilter} Güzergahları` : 'Filter by Route'}>
                                    {availableStopRoutes.map(r => {
                                        const clsInfo = getRouteClassInfo(r.routeClass);
                                        const shortLabel = clsInfo?.shortLabel || r.routeClass;
                                        const bullet = clsInfo?.bullet || '●';
                                        return (
                                            <option key={r.id} value={r.id}>
                                                {bullet} [{shortLabel}] {r.name}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            </select>
                        </div>

                        {/* Sınıf Filtre Butonları (Vektör İkonlar & Renkler) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[
                                { id: 'ALL', label: lang === 'tr' ? 'Tüm Sınıflar' : 'All Classes', count: cityFilteredStopsForCounts.length, color: '#64748b' },
                                { id: 'havayolu', label: lang === 'tr' ? 'Havayolu' : 'Flight', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'havayolu').length, color: '#0284c7' },
                                { id: 'otobus', label: lang === 'tr' ? 'Otobüs' : 'Bus', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'otobus').length, color: '#0284c7' },
                                { id: 'metro', label: lang === 'tr' ? 'Metro' : 'Metro', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'metro').length, color: '#ef4444' },
                                { id: 'tramvay', label: lang === 'tr' ? 'Tramvay' : 'Tram', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'tramvay').length, color: '#06b6d4' },
                                { id: 'metrobus', label: lang === 'tr' ? 'Metrobüs' : 'Metrobus', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'metrobus').length, color: '#f59e0b' },
                                { id: 'tren', label: lang === 'tr' ? 'Tren' : 'Train', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'tren').length, color: '#8b5cf6' },
                                { id: 'deniz', label: lang === 'tr' ? 'Deniz / Vapur' : 'Ferry', count: cityFilteredStopsForCounts.filter(s => normalizeTransitClass(s.stopClass) === 'deniz').length, color: '#0ea5e9' }
                            ].map(cls => {
                                const isSelected = stopClassFilter === cls.id;
                                return (
                                    <button
                                        key={cls.id}
                                        type="button"
                                        onClick={() => setStopClassFilter(cls.id)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '5px 10px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: isSelected ? 700 : 600,
                                            border: `1.5px solid ${isSelected ? cls.color : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : 'transparent',
                                            color: isSelected ? (isDarkMode ? '#ffffff' : cls.color) : (isDarkMode ? '#94a3b8' : '#64748b'),
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {cls.id !== 'ALL' && <RouteClassIcon classKey={cls.id} size={14} color={cls.color} />}
                                        <span>{cls.label}</span>
                                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '10px', backgroundColor: isSelected ? cls.color : (isDarkMode ? '#334155' : '#e2e8f0'), color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 700 }}>
                                            {cls.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SEÇİLİ ŞEHİR ÖZEL TRANSİT ÖZET KARTI */}
                    {selectedStopCityFilter !== 'ALL' && (
                        <div style={{
                            marginBottom: '14px',
                            padding: '14px 18px',
                            borderRadius: '12px',
                            background: isDarkMode 
                                ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)' 
                                : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                            border: `1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                            boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(37,99,235,0.06)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    backgroundColor: '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                                    flexShrink: 0
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                            {selectedStopCityFilter} {lang === 'tr' ? 'Toplu Taşıma Durakları' : 'Transit Stops'}
                                        </h4>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700 }}>
                                            {filteredStops.length} {lang === 'tr' ? 'Durak' : 'Stops'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                        {lang === 'tr' ? `${selectedStopCityFilter} genelinde kayıtlı duraklar filtrelendi.` : `Displaying registered stops in ${selectedStopCityFilter}.`}
                                    </div>
                                </div>
                            </div>

                            {/* Şehre Özel Tür Dağılım Hapları */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {['metro', 'otobus', 'tramvay', 'metrobus', 'tren', 'deniz'].map(typeKey => {
                                    const count = filteredStops.filter(s => normalizeTransitClass(s.stopClass) === typeKey).length;
                                    if (count === 0) return null;
                                    const clsInfo = getRouteClassInfo(typeKey);
                                    return (
                                        <span
                                            key={typeKey}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                                                border: `1px solid ${clsInfo?.color || '#3b82f6'}50`,
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: clsInfo?.color || '#3b82f6'
                                            }}
                                        >
                                            <RouteClassIcon classKey={typeKey} size={12} color={clsInfo?.color || '#3b82f6'} />
                                            <span>{clsInfo?.shortLabel || typeKey}:</span>
                                            <strong>{count}</strong>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Duraklar Tablosu / Listesi */}
                    {filteredStops.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
                            {lang === 'tr' ? 'Arama ve filtre kriterlerine uygun durak bulunamadı.' : 'No stops found matching the search and filter criteria.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
                            {filteredStops.map(stop => {
                                const routeObj = routes.find(r => r.id === stop.routeId);
                                const clsKey = (stop.stopClass || 'otobus').toLowerCase();
                                const clsInfo = getRouteClassInfo(clsKey);
                                const detectedCity = detectCityForEntity(stop);
                                return (
                                    <div
                                        key={stop.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                                            gap: '12px',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {/* Sol Taraf: Rank Badge + Rank +/- + İkon + İsim & Bilgi */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: 0 }}>
                                            {/* Sıra / Rank Düzenleyici */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                <button
                                                    onClick={(e) => handleUpdateStopRank(stop, -1, e)}
                                                    title="Yukarı Taşı (Shift ile En Üste Gönder)"
                                                    disabled={(stop.orderIndex || 1) <= 1}
                                                    style={{ background: 'none', border: 'none', color: (stop.orderIndex || 1) <= 1 ? '#475569' : '#94a3b8', cursor: (stop.orderIndex || 1) <= 1 ? 'not-allowed' : 'pointer', padding: '0', fontSize: '10px', lineHeight: '1' }}
                                                >
                                                    ▲
                                                </button>
                                                <span
                                                    title="Durak Sırası / Rank (Düzenlemek için tıkla)"
                                                    onClick={() => handleOpenEditStop(stop)}
                                                    style={{
                                                        width: '26px',
                                                        height: '26px',
                                                        borderRadius: '6px',
                                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                                        color: '#3b82f6',
                                                        fontWeight: '700',
                                                        fontSize: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: '1px solid rgba(59, 130, 246, 0.35)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {stop.orderIndex || 1}
                                                </span>
                                                <button
                                                    onClick={(e) => handleUpdateStopRank(stop, 1, e)}
                                                    title="Aşağı Taşı (Shift ile En Alta Gönder)"
                                                    disabled={!routeStops || (stop.orderIndex || 1) >= routeStops.length}
                                                    style={{ background: 'none', border: 'none', color: (!routeStops || (stop.orderIndex || 1) >= routeStops.length) ? '#475569' : '#94a3b8', cursor: (!routeStops || (stop.orderIndex || 1) >= routeStops.length) ? 'not-allowed' : 'pointer', padding: '0', fontSize: '10px', lineHeight: '1' }}
                                                >
                                                    ▼
                                                </button>
                                            </div>

                                            {/* Sınıf İkonu */}
                                            <div
                                                style={{
                                                    width: '34px',
                                                    height: '34px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <RouteClassIcon classKey={clsKey} size={18} color={clsInfo?.color || '#3b82f6'} />
                                            </div>

                                            {/* İsim, Açıklama ve Koordinat */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span
                                                        style={{
                                                            width: '9px',
                                                            height: '9px',
                                                            borderRadius: '50%',
                                                            backgroundColor: clsInfo?.color || '#3b82f6',
                                                            boxShadow: `0 0 6px ${clsInfo?.color || '#3b82f6'}99`,
                                                            display: 'inline-block',
                                                            flexShrink: 0
                                                        }}
                                                        title={`Tür: ${clsInfo?.label || clsKey}`}
                                                    />
                                                    <span style={{ fontWeight: '700', fontSize: '13.5px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                                        {stop.name}
                                                    </span>
                                                    {stop.stopCode && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.4)' }}>
                                                            {stop.stopCode}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', color: clsInfo?.color || '#3b82f6', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <RouteClassIcon classKey={clsKey} size={12} color={clsInfo?.color || '#3b82f6'} />
                                                        <span>{clsInfo?.shortLabel || clsKey}</span>
                                                    </span>
                                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe', color: '#0284c7', fontWeight: '600' }}>
                                                        {detectedCity}
                                                    </span>
                                                    {stop.imageUrl && (
                                                        <span 
                                                            style={{ 
                                                                fontSize: '10.5px', 
                                                                padding: '1px 6px', 
                                                                borderRadius: '4px', 
                                                                backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                                                                color: '#10b981', 
                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                fontWeight: '700',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px'
                                                            }}
                                                            title="Bu durağa ait fotoğraf mevcut"
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                            Fotoğraflı
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: '#94a3b8', flexWrap: 'wrap' }}>
                                                    {stop.description && (
                                                        <span>{stop.description}</span>
                                                    )}
                                                    {stop.latitude && stop.longitude && (
                                                        <span>• {stop.latitude.toFixed(4)}° N, {stop.longitude.toFixed(4)}° E</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Orta: Bağlı Güzergahlar (Çoklu Hat Rozetleri & Hızlı Hat Yönetimi) */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', maxWidth: '360px', justifyContent: 'flex-end', position: 'relative' }}>
                                            {(() => {
                                                const assignedRoutes = stop.routes && stop.routes.length > 0
                                                    ? stop.routes
                                                    : (routeObj ? [routeObj] : []);

                                                const assignedRouteIds = new Set(assignedRoutes.map(r => r.id));
                                                const unassignedRoutes = routes.filter(r => !assignedRouteIds.has(r.id));
                                                const isMenuOpen = quickRouteMenuStopId === stop.id;

                                                return (
                                                    <>
                                                        {assignedRoutes.map(r => (
                                                            <div
                                                                key={r.id}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    padding: '3px 7px',
                                                                    borderRadius: '6px',
                                                                    background: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                                                                    border: `1px solid ${r.color || '#3b82f6'}`
                                                                }}
                                                            >
                                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: r.color || '#3b82f6' }} />
                                                                <span style={{ fontSize: '11px', fontWeight: '600', color: isDarkMode ? '#93c5fd' : '#1d4ed8' }}>
                                                                    {r.name}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => handleQuickToggleRouteForStop(stop, r.id, e)}
                                                                    title={`Bu durağı "${r.name}" hattından çıkar`}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: isDarkMode ? '#94a3b8' : '#64748b',
                                                                        cursor: 'pointer',
                                                                        padding: '0 0 0 2px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 'bold',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                                    onMouseOut={(e) => e.currentTarget.style.color = isDarkMode ? '#94a3b8' : '#64748b'}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {assignedRoutes.length === 0 && (
                                                            <div style={{ padding: '4px 8px', borderRadius: '6px', background: isDarkMode ? '#334155' : '#e2e8f0', color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '11.5px', fontWeight: '500' }}>
                                                                Bağlı hat yok
                                                            </div>
                                                        )}

                                                        {/* Hızlı Hat Ekleme Butonu */}
                                                        {unassignedRoutes.length > 0 && (
                                                            <div style={{ position: 'relative' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setQuickRouteMenuStopId(isMenuOpen ? null : stop.id);
                                                                    }}
                                                                    title="Bu durağı başka bir hatta bağla"
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '6px',
                                                                        background: isDarkMode ? '#334155' : '#e0f2fe',
                                                                        border: `1px dashed ${isDarkMode ? '#64748b' : '#38bdf8'}`,
                                                                        color: isDarkMode ? '#38bdf8' : '#0284c7',
                                                                        fontSize: '11px',
                                                                        fontWeight: '600',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <span>+ Hat Bağla</span>
                                                                </button>

                                                                {isMenuOpen && (
                                                                    <div
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: 'calc(100% + 4px)',
                                                                            right: 0,
                                                                            background: isDarkMode ? '#1e293b' : '#ffffff',
                                                                            border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                                            borderRadius: '8px',
                                                                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                                                                            zIndex: 9999,
                                                                            padding: '6px',
                                                                            minWidth: '200px',
                                                                            maxHeight: '180px',
                                                                            overflowY: 'auto',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: '2px'
                                                                        }}
                                                                    >
                                                                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#94a3b8', padding: '4px 6px' }}>
                                                                            Hatta Bağla:
                                                                        </div>
                                                                        {unassignedRoutes.map(ur => (
                                                                            <button
                                                                                key={ur.id}
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    handleQuickToggleRouteForStop(stop, ur.id, e);
                                                                                    setQuickRouteMenuStopId(null);
                                                                                }}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '6px',
                                                                                    padding: '6px 8px',
                                                                                    borderRadius: '5px',
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    color: isDarkMode ? '#ffffff' : '#0f172a',
                                                                                    fontSize: '11.5px',
                                                                                    cursor: 'pointer',
                                                                                    textAlign: 'left'
                                                                                }}
                                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#eff6ff'}
                                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                            >
                                                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ur.color || '#3b82f6', flexShrink: 0 }} />
                                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ur.name}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Sağ Taraf: Aksiyon Butonları */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            {onRepositionStopOnMap && (
                                                <button
                                                    onClick={() => onRepositionStopOnMap(stop)}
                                                    title="Haritada Sürükleyerek Konumlandır"
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
                                                className="admin-action-btn edit-icon-btn"
                                                onClick={() => handleOpenEditStop(stop)}
                                                title={isTr ? "Durağı ve Rank'i Düzenle" : "Edit Stop & Rank"}
                                                style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                            >
                                                <EditIcon size={13} />
                                            </button>

                                            <button
                                                className="admin-action-btn delete-icon-btn"
                                                onClick={() => handleDeleteStop(stop.id)}
                                                title={isTr ? "Durağı Sil" : "Delete Stop"}
                                                style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                            >
                                                <TrashIcon size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Create/Edit Route */}
            {showRouteModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                {isEditingRoute ? 'Güzergahı Düzenle' : 'Yeni Güzergah Oluştur'}
                            </h3>
                            <button onClick={() => setShowRouteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
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
                                                onClick={() => {
                                                    const isSwitchingToGemi = cls.id === 'gemi';
                                                    const isSwitchingToHavayolu = cls.id === 'havayolu';
                                                    let newName = routeForm.name;
                                                    if (isSwitchingToGemi && !isEditingRoute) {
                                                        const pA = allAvailablePorts.find(p => p.id === routeForm.departurePortId) || allAvailablePorts[0];
                                                        const pB = allAvailablePorts.find(p => p.id === routeForm.arrivalPortId) || allAvailablePorts[1];
                                                        newName = `${pA?.shortName || 'Kalkış'} - ${pB?.shortName || 'Varış'} Deniz Hattı`;
                                                    } else if (isSwitchingToHavayolu && !isEditingRoute) {
                                                        const aA = allAvailableAirports.find(a => a.id === routeForm.departureAirportId) || allAvailableAirports[0];
                                                        const aB = allAvailableAirports.find(a => a.id === routeForm.arrivalAirportId) || allAvailableAirports[1];
                                                        newName = `${aA?.shortName || 'Kalkış'} - ${aB?.shortName || 'Varış'} Uçuş Hattı`;
                                                    }
                                                    setRouteForm({ 
                                                        ...routeForm, 
                                                        routeClass: cls.id,
                                                        name: newName,
                                                        color: (isSwitchingToGemi || isSwitchingToHavayolu) ? '#0284c7' : routeForm.color
                                                    });
                                                }}
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

                            {/* Havayolu / Uçuş Güzergahı Özel Alanları: İki Havalimanı Arası */}
                            {routeForm.routeClass === 'havayolu' && !isEditingRoute && (
                                <div style={{ background: isDarkMode ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff', padding: '16px', borderRadius: '12px', border: `1px solid ${isDarkMode ? 'rgba(2, 132, 199, 0.35)' : '#bae6fd'}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontSize: '13px', fontWeight: '700' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                                            </svg>
                                            <span>Havalimanları Arası Uçuş Güzergahı</span>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: '#0284c7', color: '#ffffff' }}>
                                            {allAvailableAirports.length} Havalimanı
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '11.5px', color: isDarkMode ? '#94a3b8' : '#0369a1', lineHeight: '1.4' }}>
                                        Havayolu hatları kalkış ve varış havalimanları arasında eğri uçuş koridoru ve terminalleriyle birlikte otomatik oluşturulur.
                                    </p>

                                    {/* Kalkış ve Varış Havalimanları Seçimi */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <SearchableAirportSelect
                                            label="1. Kalkış Havalimanı *"
                                            selectedId={routeForm.departureAirportId}
                                            disabledId={routeForm.arrivalAirportId}
                                            airports={allAvailableAirports}
                                            isDarkMode={isDarkMode}
                                            placeholder="Kalkış havalimanı seçiniz..."
                                            onChange={(newDepId) => {
                                                const aA = allAvailableAirports.find(a => a.id === newDepId || a.stopId === newDepId || a.iata === newDepId);
                                                const aB = allAvailableAirports.find(a => a.id === routeForm.arrivalAirportId || a.stopId === routeForm.arrivalAirportId || a.iata === routeForm.arrivalAirportId);
                                                setRouteForm({
                                                    ...routeForm,
                                                    departureAirportId: newDepId,
                                                    name: aA && aB ? `${aA.shortName} - ${aB.shortName} Uçuş Hattı` : routeForm.name
                                                });
                                            }}
                                        />

                                        <SearchableAirportSelect
                                            label="2. Varış Havalimanı *"
                                            selectedId={routeForm.arrivalAirportId}
                                            disabledId={routeForm.departureAirportId}
                                            airports={allAvailableAirports}
                                            isDarkMode={isDarkMode}
                                            placeholder="Varış havalimanı seçiniz..."
                                            onChange={(newArrId) => {
                                                const aA = allAvailableAirports.find(a => a.id === routeForm.departureAirportId || a.stopId === routeForm.departureAirportId || a.iata === routeForm.departureAirportId);
                                                const aB = allAvailableAirports.find(a => a.id === newArrId || a.stopId === newArrId || a.iata === newArrId);
                                                setRouteForm({
                                                    ...routeForm,
                                                    arrivalAirportId: newArrId,
                                                    name: aA && aB ? `${aA.shortName} - ${aB.shortName} Uçuş Hattı` : routeForm.name
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Gemi / Deniz Güzergahı Özel Alanları: Yalnızca İki Liman Arası */}
                            {routeForm.routeClass === 'gemi' && !isEditingRoute && (
                                <div style={{ background: isDarkMode ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff', padding: '16px', borderRadius: '12px', border: `1px solid ${isDarkMode ? 'rgba(2, 132, 199, 0.35)' : '#bae6fd'}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontSize: '13px', fontWeight: '700' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L20 11V4c0-.55-.45-1-1-1h-2V1h-2v2h-6V1H7v2H5c-.55 0-1 .45-1 1v7l-1.28.27c-.27.05-.48.23-.6.47-.12.24-.14.52-.06.78L3.95 19zM6 5h12v6.2l-6-1.2-6 1.2V5z"/>
                                            </svg>
                                            <span>Limanlar Arası Deniz Güzergahı</span>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: '#0284c7', color: '#ffffff' }}>
                                            {allAvailablePorts.length} Liman
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '11.5px', color: isDarkMode ? '#94a3b8' : '#0369a1', lineHeight: '1.4' }}>
                                        Deniz hatları iki liman arasında rota çizgisi ve duraklarıyla birlikte oluşturulur. Liman kutusuna tıklayarak arama yapabilir ve seçebilirsiniz.
                                    </p>

                                    {/* Kalkış ve Varış Limanları Seçimi (Açılır Arama Menüleri) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <SearchablePortSelect
                                            label="1. Kalkış Limanı *"
                                            selectedId={routeForm.departurePortId}
                                            disabledId={routeForm.arrivalPortId}
                                            ports={allAvailablePorts}
                                            isDarkMode={isDarkMode}
                                            placeholder="Kalkış limanı seçiniz..."
                                            onChange={(newDepId) => {
                                                const pA = allAvailablePorts.find(p => p.id === newDepId || p.stopId === newDepId);
                                                const pB = allAvailablePorts.find(p => p.id === routeForm.arrivalPortId || p.stopId === routeForm.arrivalPortId);
                                                setRouteForm({
                                                    ...routeForm,
                                                    departurePortId: newDepId,
                                                    name: pA && pB ? `${pA.shortName} - ${pB.shortName} Deniz Hattı` : routeForm.name
                                                });
                                            }}
                                        />

                                        <SearchablePortSelect
                                            label="2. Varış Limanı *"
                                            selectedId={routeForm.arrivalPortId}
                                            disabledId={routeForm.departurePortId}
                                            ports={allAvailablePorts}
                                            isDarkMode={isDarkMode}
                                            placeholder="Varış limanı seçiniz..."
                                            onChange={(newArrId) => {
                                                const pA = allAvailablePorts.find(p => p.id === routeForm.departurePortId || p.stopId === routeForm.departurePortId);
                                                const pB = allAvailablePorts.find(p => p.id === newArrId || p.stopId === newArrId);
                                                setRouteForm({
                                                    ...routeForm,
                                                    arrivalPortId: newArrId,
                                                    name: pA && pB ? `${pA.shortName} - ${pB.shortName} Deniz Hattı` : routeForm.name
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

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
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <rect x="4" y="4" width="16" height="13" rx="2" />
                                        <path d="M4 9h16" />
                                        <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                                        <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                                        <path d="M6 17v2.5M18 17v2.5" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold' }}>
                                        {isEditingStop ? 'Durağı Düzenle' : 'Yeni Durak Ekle'}
                                    </h3>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Durak sınıfını belirleyin ve isteğe bağlı güzergah bağlayın</span>
                                </div>
                            </div>
                            <button onClick={() => setShowStopModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Kapat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveStop} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Durak Adı ve Durak Kodu (StopCode) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '5px' }}>Durak Adı *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="örn. 15 Temmuz Kızılay, Sıhhiye, Madenli Limanı"
                                        value={stopForm.name}
                                        onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '13px' }}
                                    />
                                    <span style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                                        Farklı duraklar aynı isme sahip olabilir.
                                    </span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '5px' }}>Durak Numarası / Kodu *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="örn. 1042, BUS-1001, METRO-01"
                                        value={stopForm.stopCode}
                                        onChange={(e) => setStopForm({ ...stopForm, stopCode: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: '#0284c7', fontFamily: 'monospace', fontWeight: '700', fontSize: '12.5px' }}
                                    />
                                    <span style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                                        Her durağın ayırt edici numarasıdır.
                                    </span>
                                </div>
                            </div>

                            {/* Durak Sınıfı (6 Temel Sınıf) */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '5px' }}>Durak Sınıfı / Ulaşım Türü *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                    {ROUTE_CLASSES.map(item => {
                                        const isSelected = normalizeTransitClass(stopForm.stopClass) === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    const newClass = item.id;
                                                    // Yeni sınıfla uyumsuz olan seçili hatları filtrele
                                                    const validRouteIds = (stopForm.routeIds || []).filter(rid => {
                                                        const r = routes.find(x => x.id === rid);
                                                        return r && areTransitClassesCompatible(r.routeClass, newClass);
                                                    });
                                                    setStopForm({
                                                        ...stopForm,
                                                        stopClass: newClass,
                                                        routeIds: validRouteIds,
                                                        routeId: validRouteIds[0] || null
                                                    });
                                                }}
                                                style={{
                                                    padding: '7px 8px',
                                                    borderRadius: '8px',
                                                    border: isSelected ? `2px solid ${item.color}` : `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                    backgroundColor: isSelected ? (isDarkMode ? item.bg : '#eff6ff') : (isDarkMode ? '#0f172a' : '#ffffff'),
                                                    color: isSelected ? item.color : (isDarkMode ? '#cbd5e1' : '#475569'),
                                                    fontWeight: isSelected ? '700' : '500',
                                                    fontSize: '11.5px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <RouteClassIcon classKey={item.id} size={14} color={isSelected ? item.color : (isDarkMode ? '#94a3b8' : '#64748b')} />
                                                <span>{item.shortLabel || item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sıra / Rank (Order Index) */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <label style={{ fontSize: '12.5px', fontWeight: '600' }}>Sıra / Rank (Order Index)</label>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Güzergah ve liste önceliği</span>
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    value={stopForm.orderIndex || 1}
                                    onChange={(e) => setStopForm({ ...stopForm, orderIndex: parseInt(e.target.value, 10) || 1 })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '13px' }}
                                />
                            </div>

                            {/* Bağlı Olduğu Güzergahlar (YALNIZCA AYNI SINIFTAKİ GÜZERGAHLAR) */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <label style={{ fontSize: '12.5px', fontWeight: '600' }}>Bağlı Güzergahlar (Çoklu Hat Bağlantısı)</label>
                                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                                        {stopForm.routeIds?.length || 0} Hat Seçili
                                    </span>
                                </div>
                                {(() => {
                                    const compatibleRoutes = routes.filter(r => areTransitClassesCompatible(r.routeClass, stopForm.stopClass));
                                    return (
                                        <div style={{ maxHeight: '130px', overflowY: 'auto', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, borderRadius: '8px', padding: '6px 8px', background: isDarkMode ? '#0f172a' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {compatibleRoutes.length === 0 ? (
                                                <span style={{ fontSize: '12px', color: '#94a3b8', padding: '6px' }}>Bu sınıfa ({getRouteClassInfo(stopForm.stopClass)?.label}) ait kayıtlı güzergah bulunmuyor.</span>
                                            ) : (
                                                compatibleRoutes.map(r => {
                                                    const isChecked = (stopForm.routeIds || []).includes(r.id);
                                                    return (
                                                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '6px', background: isChecked ? (isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : 'transparent', cursor: 'pointer', fontSize: '12px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    const current = stopForm.routeIds || [];
                                                                    if (e.target.checked) {
                                                                        const updated = [...current, r.id];
                                                                        setStopForm({ ...stopForm, routeIds: updated, routeId: updated[0] || null });
                                                                    } else {
                                                                        const updated = current.filter(id => id !== r.id);
                                                                        setStopForm({ ...stopForm, routeIds: updated, routeId: updated[0] || null });
                                                                    }
                                                                }}
                                                            />
                                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.color || '#3b82f6', flexShrink: 0 }} />
                                                            <span style={{ fontWeight: isChecked ? '700' : '500', flex: 1 }}>{r.name}</span>
                                                            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>({getRouteClassInfo(r.routeClass)?.label || r.routeClass})</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    );
                                })()}
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                                    Katı Sınıf Kuralı: Bir durak yalnızca kendi sınıfındaki ({getRouteClassInfo(stopForm.stopClass)?.label}) güzergahlara 1'den fazla kez bağlanabilir.
                                </span>
                            </div>

                            {/* Açıklama */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '5px' }}>Açıklama & Not (Opsiyonel)</label>
                                <input
                                    type="text"
                                    placeholder="örn. Ana aktarma merkezi, taksi durağı yanı"
                                    value={stopForm.description}
                                    onChange={(e) => setStopForm({ ...stopForm, description: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px' }}
                                />
                            </div>

                            {/* Fotoğraf / Görsel Yükleme (Liman & Durak) */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <label style={{ fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        Durak / Liman Fotoğrafı (Opsiyonel)
                                    </label>
                                    {stopForm.imageUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setStopForm(prev => ({ ...prev, imageUrl: '' }))}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Görseli Kaldır
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Görsel URL'si girin veya dosya yükleyin (https://... veya /uploads/...)"
                                        value={stopForm.imageUrl}
                                        onChange={(e) => setStopForm({ ...stopForm, imageUrl: e.target.value })}
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px' }}
                                    />
                                    <label style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                        border: '1px solid #3b82f6',
                                        color: '#3b82f6',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        {uploadingStopImage ? 'Yükleniyor...' : 'Gözat'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            disabled={uploadingStopImage}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                try {
                                                    setUploadingStopImage(true);
                                                    // Anında yerel önizleme (FileReader)
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        if (reader.result) {
                                                            setStopForm(prev => ({ ...prev, imageUrl: reader.result }));
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);

                                                    const res = await transportApi.uploadImage(file, token);
                                                    if (res && (res.url || res.absoluteUrl)) {
                                                        setStopForm(prev => ({ ...prev, imageUrl: res.url || res.absoluteUrl }));
                                                    }
                                                    setSuccessMsg('Görsel başarıyla seçildi/yüklendi.');
                                                } catch (err) {
                                                    console.warn('Durak görsel yükleme uyarısı:', err);
                                                    setSuccessMsg('Görsel yerel olarak eklendi.');
                                                } finally {
                                                    setUploadingStopImage(false);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>

                                {stopForm.imageUrl && (
                                    <div style={{ marginTop: '8px', position: 'relative', width: '100%', height: '110px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, background: '#000000' }}>
                                        <img
                                            src={stopForm.imageUrl.startsWith('data:') || stopForm.imageUrl.startsWith('http') || stopForm.imageUrl.startsWith('blob:') ? stopForm.imageUrl : `http://localhost:5041${stopForm.imageUrl}`}
                                            alt="Durak önizleme"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Konum (WKT Point) */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', marginBottom: '5px' }}>Konum (WKT Point)</label>
                                <input
                                    type="text"
                                    placeholder="POINT(32.8543 39.9208)"
                                    value={stopForm.wkt}
                                    onChange={(e) => setStopForm({ ...stopForm, wkt: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px' }}
                                />
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                                    Haritadan eklemek için harita ekranındaki "Durak Ekle" aracını da kullanabilirsiniz.
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                                <button type="button" onClick={() => setShowStopModal(false)} style={{ padding: '8px 15px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: 'none', color: isDarkMode ? '#ffffff' : '#0f172a', cursor: 'pointer', fontSize: '13px' }}>
                                    İptal
                                </button>
                                <button type="submit" disabled={loading} style={{ padding: '8px 18px', borderRadius: '8px', background: '#3b82f6', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Gemi Güzergahına Varış Limanı Ekle */}
            {showArrivalModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                Varış Ekle
                            </h3>
                            <button onClick={() => setShowArrivalModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Kapat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddArrivalPort} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <SearchablePortSelect
                                label="Varış Limanı *"
                                selectedId={arrivalForm.arrivalPortId}
                                disabledId={routeStops[0]?.name}
                                ports={allAvailablePorts.filter(p => !routeStops.some(s => s.name === p.name))}
                                isDarkMode={isDarkMode}
                                placeholder="Varış limanı seçiniz..."
                                onChange={(newArrId) => {
                                    setArrivalForm({ ...arrivalForm, arrivalPortId: newArrId });
                                }}
                            />

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Güzergâh Adı</label>
                                <input
                                    type="text"
                                    placeholder={(() => {
                                        const dep = routeStops[0];
                                        const arr = allAvailablePorts.find(p => p.id === arrivalForm.arrivalPortId || p.stopId === arrivalForm.arrivalPortId);
                                        if (dep && arr) {
                                            const depPort = allAvailablePorts.find(p => p.name === dep.name || p.id === dep.id);
                                            if (depPort) return `${cleanPortName(depPort.shortName || depPort.name)} - ${cleanPortName(arr.shortName || arr.name)}`;
                                        }
                                        return 'örn: Mersin - Girne';
                                    })()}
                                    value={arrivalForm.routeName}
                                    onChange={(e) => setArrivalForm({ ...arrivalForm, routeName: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#ffffff' : '#0f172a' }}
                                />
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Boş bırakılırsa otomatik oluşturulur
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowArrivalModal(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: 'none', color: isDarkMode ? '#ffffff' : '#0f172a', cursor: 'pointer' }}>
                                    İptal
                                </button>
                                <button type="submit" disabled={isAddingArrival} style={{ padding: '10px 20px', borderRadius: '8px', background: '#0891b2', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                                    {isAddingArrival ? 'Oluşturuluyor...' : 'Varış Ekle ve Güzergâh Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Mevcut Durağı Güzergaha Bağla */}
            {showAttachStopModal && selectedRoute && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '16px', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, width: '100%', maxWidth: '540px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px 16px 24px', borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedRoute.color || '#3b82f6' }} />
                                    <span>Mevcut Durağı "{selectedRoute.name}" Hattına Bağla</span>
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                                    Sistemde kayıtlı bir durağı seçerek bu hatta bağlayın (Çoklu hat aktarması)
                                </p>
                            </div>
                            <button onClick={() => setShowAttachStopModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* Search Box */}
                        <div style={{ padding: '16px 24px 12px 24px' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Durak adı veya durak kodu ara (örn. Kızılay, Sıhhiye, AŞTİ)..."
                                    value={attachSearchQuery}
                                    onChange={(e) => setAttachSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: '13px' }}
                                />
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                        </div>

                        {/* Position Selector */}
                        <div style={{ padding: '0 24px 12px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                                Ekleme Konumu:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setAttachPosition('end'); setAttachTargetStopId(''); }}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: attachPosition === 'end' ? '2px solid #3b82f6' : `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                        background: attachPosition === 'end' ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                                        color: attachPosition === 'end' ? '#3b82f6' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                        fontWeight: attachPosition === 'end' ? '700' : '500',
                                        fontSize: '11.5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Sona Ekle
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAttachPosition('start'); setAttachTargetStopId(''); }}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: attachPosition === 'start' ? '2px solid #3b82f6' : `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                        background: attachPosition === 'start' ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                                        color: attachPosition === 'start' ? '#3b82f6' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                        fontWeight: attachPosition === 'start' ? '700' : '500',
                                        fontSize: '11.5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    En Başa Ekle (1. Sıra)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttachPosition('after');
                                        if (!attachTargetStopId && routeStops.length > 0) {
                                            setAttachTargetStopId(routeStops[0].id);
                                        }
                                    }}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: attachPosition === 'after' ? '2px solid #3b82f6' : `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                        background: attachPosition === 'after' ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                                        color: attachPosition === 'after' ? '#3b82f6' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                        fontWeight: attachPosition === 'after' ? '700' : '500',
                                        fontSize: '11.5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Araya Ekle
                                </button>
                            </div>

                            {attachPosition === 'after' && routeStops.length > 0 && (
                                <div style={{ marginTop: '4px' }}>
                                    <select
                                        value={attachTargetStopId || routeStops[0]?.id || ''}
                                        onChange={(e) => setAttachTargetStopId(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '7px 10px',
                                            borderRadius: '6px',
                                            border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                            background: isDarkMode ? '#0f172a' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#0f172a',
                                            fontSize: '12px'
                                        }}
                                    >
                                        {routeStops.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.orderIndex || 1}. {s.name} durağından hemen sonraya ekle
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Stop List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(() => {
                                const currentStopIds = new Set(routeStops.map(s => s.id));
                                const available = (allStops || []).filter(s => {
                                    if (currentStopIds.has(s.id)) return false;
                                    // KATI SINIF İZOLASYONU: Yalnızca seçili güzergahın sınıfına ait duraklar bağlanabilir!
                                    if (!areTransitClassesCompatible(s.stopClass, selectedRoute.routeClass)) return false;
                                    if (attachSearchQuery.trim()) {
                                        const q = attachSearchQuery.toLowerCase();
                                        const matchName = (s.name || '').toLowerCase().includes(q);
                                        const matchCode = (s.stopCode || '').toLowerCase().includes(q);
                                        const matchDesc = (s.description || '').toLowerCase().includes(q);
                                        if (!matchName && !matchCode && !matchDesc) return false;
                                    }
                                    return true;
                                });

                                if (available.length === 0) {
                                    return (
                                        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                            {attachSearchQuery 
                                                ? 'Aramanıza uygun bu sınıfta bağlanabilir durak bulunamadı.' 
                                                : `Bu hatta bağlanabilecek başka "${getRouteClassInfo(selectedRoute.routeClass)?.label}" durağı bulunmuyor.`}
                                        </div>
                                    );
                                }

                                return available.map(stop => {
                                    const clsInfo = getRouteClassInfo(stop.stopClass || 'otobus');
                                    const connectedRoutes = stop.routes || [];
                                    return (
                                        <div
                                            key={stop.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 14px',
                                                borderRadius: '10px',
                                                background: isDarkMode ? '#0f172a' : '#f8fafc',
                                                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                                                gap: '12px'
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '13px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                                        {stop.name}
                                                    </span>
                                                    {stop.stopCode && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '10.5px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', color: '#0284c7' }}>
                                                            {stop.stopCode}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', color: clsInfo?.color || '#3b82f6', fontWeight: 600 }}>
                                                        {clsInfo?.shortLabel || stop.stopClass || 'otobus'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    {connectedRoutes.length > 0 ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>Bağlı Hatlar:</span>
                                                            {connectedRoutes.map(cr => (
                                                                <span key={cr.id} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0', color: cr.color || '#3b82f6', fontWeight: 600 }}>
                                                                    {cr.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span>Bağlı hat yok</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleAttachExistingStopToRoute(stop.id, attachPosition, attachTargetStopId)}
                                                    disabled={loading}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '7px 12px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#2563eb',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        fontWeight: '600',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                                    <span>{attachPosition === 'start' ? 'Başa Bağla' : (attachPosition === 'after' ? 'Araya Bağla' : 'Sona Bağla')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 24px', borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowAttachStopModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`, background: 'none', color: isDarkMode ? '#ffffff' : '#0f172a', cursor: 'pointer', fontSize: '12.5px' }}
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

