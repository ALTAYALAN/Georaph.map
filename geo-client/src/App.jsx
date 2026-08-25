import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import HeatmapLayer from 'ol/layer/Heatmap';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { Style, Icon, Stroke, Fill, Text, Circle as CircleStyle } from 'ol/style';
import { setupPulsingSpatialBoundaryLayer, isGeomInsideBoundary } from './utils/spatialConstraint';

import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import { fromLonLat, toLonLat } from 'ol/proj';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Collection from 'ol/Collection';
import WKT from 'ol/format/WKT';
import GeoJSON from 'ol/format/GeoJSON';

import Overlay from 'ol/Overlay';
import { getLength, getArea } from 'ol/sphere';
import { getCenter } from 'ol/extent';

// PrimeReact Bileşenleri
import { Toast } from 'primereact/toast';

import { translations } from './translations';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { BASEMAP_LAYERS } from './constants/mapLayers';
import { MapLayerSwitcher } from './components/common/MapLayerSwitcher';
import { adminApi } from './services/adminApi';
import { getPoiCategoryBadgeSvg } from './constants/poiIcons';
import './App.css';

// Hex rengi RGBA stringe çevirme yardımcısı
function hexToRgba(hex, alpha = 0.35) {
    if (!hex) return `rgba(59, 130, 246, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PRESET_COLORS = [
    { label: 'Mavi', hex: '#3b82f6' },
    { label: 'Yeşil', hex: '#10b981' },
    { label: 'Kırmızı', hex: '#ef4444' },
    { label: 'Turuncu', hex: '#f59e0b' },
    { label: 'Mor', hex: '#8b5cf6' },
    { label: 'Pembe', hex: '#ec4899' },
    { label: 'Koyu', hex: '#1f2937' }
];

// Yüksek Detaylı Vektörel Sanatçı Renk Paleti İkonu
const DetailedPaletteIcon = ({ size = 18, color = "#ffffff" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C13.2033 22 14.18 21.0233 14.18 19.82C14.18 19.26 13.95 18.75 13.58 18.38C13.22 18.01 13 17.51 13 16.96C13 15.86 13.9 14.96 15 14.96H16.82C19.68 14.96 22 12.64 22 9.78C22 5.48 17.52 2 12 2Z" fill="rgba(255,255,255,0.25)" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="7.5" cy="11.5" r="1.4" fill="#f59e0b" />
        <circle cx="10.5" cy="7.5" r="1.4" fill="#10b981" />
        <circle cx="15.5" cy="7.5" r="1.4" fill="#ec4899" />
        <circle cx="18.5" cy="11.5" r="1.4" fill="#3b82f6" />
        <circle cx="9.5" cy="17.5" r="1.4" stroke={color} strokeWidth="1.2" />
    </svg>
);

// Vektörel Yüksek Kaliteli Bayrak İkonları (Tüm Tarayıcılarda Kusursuz Görünüm)
const TurkeyFlag = () => (
    <svg width="18" height="13" viewBox="0 0 1200 800" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
        <rect width="1200" height="800" fill="#E30A17" />
        <circle cx="425" cy="400" r="200" fill="#ffffff" />
        <circle cx="475" cy="400" r="160" fill="#E30A17" />
        <polygon points="583.3,400 684.8,433 622,346.5 622,453.5 684.8,367" fill="#ffffff" />
    </svg>
);

const UKFlag = () => (
    <svg width="18" height="13" viewBox="0 0 60 30" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
        <clipPath id="uk-clip"><rect width="60" height="30" /></clipPath>
        <g clipPath="url(#uk-clip)">
            <rect width="60" height="30" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
            <path d="M30,0 V30 M0,15 H60" stroke="#ffffff" strokeWidth="10" />
            <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
        </g>
    </svg>
);

function parseJwt(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function App() {
    // Görünüm Modu ('map' | 'admin')
    const [currentView, setCurrentView] = useState('map');
    // PrimeReact Toast Referansı
    const toastRef = useRef(null);
    const placeColorInputRef = useRef(null);
    const drawColorInputRef = useRef(null);

    // Dil (Türkçe / İngilizce) Durumu
    const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'tr');
    const t = translations[lang] || translations.tr;

    const toggleLang = () => {
        setLang(prev => {
            const next = prev === 'tr' ? 'en' : 'tr';
            localStorage.setItem('lang', next);
            return next;
        });
    };

    // Tema (Karanlık / Aydınlık Mod) Durumu
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // Sol Sidebar Açık/Kapalı Durumu
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Kullanıcı ve Token Durumları (State)
    const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
    const [loggedInUsername, setLoggedInUsername] = useState(localStorage.getItem('logged_in_username') || '');

    const [userRole, setUserRole] = useState(() => {
        const storedRole = localStorage.getItem('user_role');
        if (storedRole) return storedRole;
        const payload = parseJwt(localStorage.getItem('jwt_token'));
        if (payload) {
            const r = payload.userRole || payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
            if (r) return r;
        }
        return 'Viewer';
    });

    const [isAdmin, setIsAdmin] = useState(() => {
        const role = localStorage.getItem('user_role') || (parseJwt(localStorage.getItem('jwt_token'))?.userRole);
        return role === 'Admin';
    });

    const [userSpatialBoundaryWkt, setUserSpatialBoundaryWkt] = useState('');
    const [spatialBoundariesData, setSpatialBoundariesData] = useState([]);
    const userSpatialBoundaryWktRef = useRef(userSpatialBoundaryWkt);
    const pulsingBoundaryRef = useRef(null);

    // Isı Haritası (Heatmap) Analizi Durumu ve Katman Referansları
    const [isHeatmapActive, setIsHeatmapActive] = useState(false);
    const [heatmapTypeFilter, setHeatmapTypeFilter] = useState('ALL'); // 'ALL' | 'Point' | 'Line' | 'Polygon'
    const heatmapSourceRef = useRef(new VectorSource());
    const heatmapLayerRef = useRef(null);
    const geoServerWmsSourceRef = useRef(null);
    const geoServerWmsLayerRef = useRef(null);

    useEffect(() => {
        userSpatialBoundaryWktRef.current = userSpatialBoundaryWkt;
    }, [userSpatialBoundaryWkt]);


    // Fetch active user spatial boundary (taking into account active collaborative unions and distinct editor boundaries)
    const fetchEffectiveBoundary = async () => {
        if (!token || isAdmin || userRole === 'Admin') {
            setUserSpatialBoundaryWkt('');
            setSpatialBoundariesData([]);
            return;
        }
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/effective-boundary', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.spatialBoundaryWkt) {
                    console.log('[Spatial Boundary] Aktif/Ortak yetki alanı yüklendi:', data.spatialBoundaryWkt, 'İşbirlikli:', data.isCollaborative);
                    setUserSpatialBoundaryWkt(data.spatialBoundaryWkt);
                    setSpatialBoundariesData(data.boundaries && data.boundaries.length > 0 ? data.boundaries : [{ spatialBoundaryWkt: data.spatialBoundaryWkt, isCurrentUser: true }]);
                    return;
                } else {
                    setUserSpatialBoundaryWkt('');
                    setSpatialBoundariesData([]);
                    return;
                }
            }
            // Fallback to /api/users/me
            const meRes = await fetch('http://localhost:5041/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (meRes.ok) {
                const user = await meRes.json();
                setUserSpatialBoundaryWkt(user.spatialBoundaryWkt || '');
                setSpatialBoundariesData(user.spatialBoundaryWkt ? [{ spatialBoundaryWkt: user.spatialBoundaryWkt, isCurrentUser: true, username: user.username }] : []);
            } else {
                setUserSpatialBoundaryWkt('');
                setSpatialBoundariesData([]);
            }
        } catch (err) {
            console.error('Kullanıcı coğrafi sınır bilgisi alınamadı:', err);
        }
    };

    useEffect(() => {
        fetchEffectiveBoundary();
    }, [token, isAdmin, userRole]);

    // Setup pulsing spatial boundary layer on main map ONLY for Editor / non-Admin users
    // If collaborating with other editors, each editor's boundary is rendered in its own distinct color!
    useEffect(() => {
        if (!mapRef.current) return;

        if (pulsingBoundaryRef.current) {
            pulsingBoundaryRef.current.cleanup();
            pulsingBoundaryRef.current = null;
        }

        const boundariesInput = spatialBoundariesData && spatialBoundariesData.length > 0 ? spatialBoundariesData : userSpatialBoundaryWkt;

        if (userSpatialBoundaryWkt && !isAdmin && userRole !== 'Admin') {
            const handle = setupPulsingSpatialBoundaryLayer(mapRef.current, boundariesInput);
            pulsingBoundaryRef.current = handle;
            if (handle && handle.features && handle.features.length > 0) {
                try {
                    let totalExtent = handle.features[0].getGeometry().getExtent().slice();
                    for (let i = 1; i < handle.features.length; i++) {
                        const ext = handle.features[i].getGeometry().getExtent();
                        totalExtent[0] = Math.min(totalExtent[0], ext[0]);
                        totalExtent[1] = Math.min(totalExtent[1], ext[1]);
                        totalExtent[2] = Math.max(totalExtent[2], ext[2]);
                        totalExtent[3] = Math.max(totalExtent[3], ext[3]);
                    }
                    mapRef.current.getView().fit(totalExtent, { padding: [60, 60, 60, 60], maxZoom: 11, duration: 600 });
                } catch (e) {}
            }
        }

        return () => {
            if (pulsingBoundaryRef.current) {
                pulsingBoundaryRef.current.cleanup();
                pulsingBoundaryRef.current = null;
            }
        };
    }, [userSpatialBoundaryWkt, spatialBoundariesData, isAdmin, userRole]);


    
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [registerSuccessMsg, setRegisterSuccessMsg] = useState('');
    const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

    // Oturum Kalan Süresi (Saniye Cinsinden)
    const [timeLeft, setTimeLeft] = useState(0);

    // Harita Formu Durumları (Tekil Mekan Ekleme)
    const [placeName, setPlaceName] = useState('');
    const [placeColor, setPlaceColor] = useState('#16a34a');
    const [coords, setCoords] = useState({ lon: 33.2433, lat: 38.9637 }); // Varsayılan Türkiye
    const [hasUserSelectedPin, setHasUserSelectedPin] = useState(false); // Haritaya tıklanmadığı sürece iğne görünmez / şeffaf
    const [cursorCoords, setCursorCoords] = useState({ lon: 33.2433, lat: 38.9637 });
    const [mapZoom, setMapZoom] = useState(6.5);
    const [infoMessage, setInfoMessage] = useState('');
    const [savedPlaces, setSavedPlaces] = useState([]); // Veritabanından gelen kayıtlı mekanlar

    // Harita Altlık Katman Seçimi (Google Hibrit, Siyasi, Arazi, Saf Uydu, Gece Modu, vb.)
    const [selectedBaseLayer, setSelectedBaseLayer] = useState(() => localStorage.getItem('geo_selected_basemap') || 'google_hybrid');

    const handleSelectBaseLayer = (layerId) => {
        setSelectedBaseLayer(layerId);
        localStorage.setItem('geo_selected_basemap', layerId);
        const layerConfig = BASEMAP_LAYERS.find(l => l.id === layerId) || BASEMAP_LAYERS[0];
        if (tileLayerRef.current) {
            tileLayerRef.current.setSource(
                new XYZ({
                    url: layerConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: 20
                })
            );
        }
    };

    // OpenLayers Çizim İşlemleri (Point, LineString, Polygon, Analysis)
    const [drawType, setDrawType] = useState('None');
    const [savedDrawings, setSavedDrawings] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // HARİTA FİLTRELEME DURUMLARI (Şekil Türü ve Editör/Kullanıcı Filtresi)
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
    const [selectedEditorFilter, setSelectedEditorFilter] = useState('ALL');
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // YÜZER MENÜ / ÖZNİTELİK FORM DURUMLARI (İsim, Renk ve Taslak WKT)
    const [drawingName, setDrawingName] = useState('');
    const [drawingColor, setDrawingColor] = useState('#3b82f6');
    const [draftWkt, setDraftWkt] = useState('');

    // GEÇİCİ ENVANTER ANALİZİ DURUMLARI
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // SEÇİLİ NOKTA BİLGİ PANELİ VE DÜZENLEME DURUMU (Info Panel / Popup Overlay)
    const [selectedPointInfo, setSelectedPointInfo] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#3b82f6');
    const [editWkt, setEditWkt] = useState('');

    // KIRILMA NOKTALARINI FARE İLE HARİTADA DÜZENLEME (Modify Interaction + Undo/Redo + Cancel Modal)
    const [isModifyingVertex, setIsModifyingVertex] = useState(false);
    const [isPopupCollapsed, setIsPopupCollapsed] = useState(false);
    const modifyInteractionRef = useRef(null);
    const originalWktRef = useRef('');
    const geometryHistoryRef = useRef([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [cancelEditConfirm, setCancelEditConfirm] = useState(false);

    // POI (POINT OF INTEREST) & HİYERARŞİK KATEGORİ DURUMLARI
    const [pois, setPois] = useState([]);
    const [poiCategories, setPoiCategories] = useState([]);
    const [selectedPoiInfo, setSelectedPoiInfo] = useState(null);
    const [showCreatePoiModal, setShowCreatePoiModal] = useState(false);
    const [poiParentCatId, setPoiParentCatId] = useState('');
    const [poiDrawGeometryType, setPoiDrawGeometryType] = useState('Point'); // 'Point' | 'Polygon'
    const [draftPoiData, setDraftPoiData] = useState(null); // { wkt, lon, lat, isPolygon, area, feature }
    const [poiTimeDays, setPoiTimeDays] = useState('Hafta İçi');
    const [poiTimeStart, setPoiTimeStart] = useState('08:30');
    const [poiTimeEnd, setPoiTimeEnd] = useState('18:00');
    const [poiIs24Hours, setPoiIs24Hours] = useState(false);
    const [newPoiForm, setNewPoiForm] = useState({
        name: '',
        description: '',
        categoryId: '',
        workingHours: 'Hafta İçi 08:30 - 18:00',
        wkt: '',
        lon: 0,
        lat: 0,
        isPolygon: false,
        area: 0
    });
    const poiSourceRef = useRef(new VectorSource());

    // GOOGLE MAPS TARZI POI ARAMA BARI DURUMLARI (Tüm Rollere Açık: User, Editor, Admin)
    const [poiSearchQuery, setPoiSearchQuery] = useState('');
    const [isPoiSearchFocused, setIsPoiSearchFocused] = useState(false);
    const [selectedSearchCatFilter, setSelectedSearchCatFilter] = useState('ALL');
    const poiSearchContainerRef = useRef(null);

    // Dışarı tıklandığında arama açılır kutusunu kapatma
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (poiSearchContainerRef.current && !poiSearchContainerRef.current.contains(e.target)) {
                setIsPoiSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Arama Sonuçlarını Filtreleme (Ad, Kategori, Açıklama, Çalışma Saatleri)
    const filteredSearchResults = useMemo(() => {
        if (!poiSearchQuery.trim() && selectedSearchCatFilter === 'ALL') return [];
        const q = poiSearchQuery.trim().toLowerCase();
        return (pois || []).filter(p => {
            const matchesCat = selectedSearchCatFilter === 'ALL' || String(p.categoryId) === String(selectedSearchCatFilter);
            if (!matchesCat) return false;
            if (!q) return true;
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const catName = (p.categoryName || '').toLowerCase();
            const hours = (p.workingHours || '').toLowerCase();
            return name.includes(q) || desc.includes(q) || catName.includes(q) || hours.includes(q);
        }).slice(0, 10);
    }, [poiSearchQuery, selectedSearchCatFilter, pois]);

    // Arama Sonucundan POI'ye Otomatik Yakınlaşma (Zoom & Fly-to)
    const handleZoomToSearchResultPoi = (poi) => {
        if (!poi || !mapRef.current) return;
        setIsPoiSearchFocused(false);

        let targetCoord = null;
        if (poi.wkt) {
            try {
                const wktFormat = new WKT();
                const feat = wktFormat.readFeature(poi.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                if (feat && feat.getGeometry()) {
                    const geom = feat.getGeometry();
                    if (geom.getType() === 'Point') {
                        targetCoord = geom.getCoordinates();
                    } else {
                        targetCoord = getCenter(geom.getExtent());
                    }
                }
            } catch (e) {
                console.error('POI koordinat hesaplama hatası:', e);
            }
        }

        if (targetCoord) {
            mapRef.current.getView().animate({
                center: targetCoord,
                zoom: 16.5,
                duration: 800
            });
        }

        setSelectedPoiInfo(poi);
    };

    // SHIFT TUŞU İLE POLİGON POI MODUNA GEÇİŞ DİNLEYİCİSİ
    useEffect(() => {
        if (drawType !== 'Poi') return;

        const handleKeyDown = (e) => {
            if (e.key === 'Shift' && poiDrawGeometryType !== 'Polygon') {
                setPoiDrawGeometryType('Polygon');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [drawType, poiDrawGeometryType]);

    // POI Modal Açıldığında Kategorileri Taze Çekme
    useEffect(() => {
        if (showCreatePoiModal) {
            fetchPoiCategories();
        }
    }, [showCreatePoiModal]);

    // Aşağıdaki Kaydet Butonuna Basıldığında POI Bilgi Giriş Ekranını Açma
    const handleOpenPoiModalWithDraft = async () => {
        if (!draftPoiData || !draftPoiData.wkt) {
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'warn',
                    summary: 'Çizim Eksik',
                    detail: 'Lütfen önce haritada bir nokta veya poligon alanı çizin.',
                    life: 3000
                });
            }
            return;
        }

        let currentCats = await fetchPoiCategories();
        if (!currentCats || currentCats.length === 0) {
            currentCats = poiCategories;
        }

        const defaultParent = (currentCats || []).find(c => !c.parentId) || (currentCats || [])[0];
        const defaultChild = defaultParent ? (currentCats || []).find(c => c.parentId === defaultParent.id) : null;
        const chosenCat = defaultChild || defaultParent;

        if (defaultParent) {
            setPoiParentCatId(defaultParent.id.toString());
        } else {
            setPoiParentCatId('');
        }

        setPoiTimeDays('Hafta İçi');
        setPoiTimeStart('08:30');
        setPoiTimeEnd('18:00');
        setPoiIs24Hours(false);

        setNewPoiForm({
            name: '',
            description: '',
            categoryId: chosenCat ? chosenCat.id : '',
            workingHours: 'Hafta İçi 08:30 - 18:00',
            wkt: draftPoiData.wkt,
            lon: draftPoiData.lon,
            lat: draftPoiData.lat,
            isPolygon: draftPoiData.isPolygon,
            area: draftPoiData.area || 0
        });

        setShowCreatePoiModal(true);
    };

    // POI Kategori Ağaç / Cascading Seçim Yardımcıları
    const parentCategories = useMemo(() => {
        return (poiCategories || []).filter(c => !c.parentId);
    }, [poiCategories]);

    const currentSubCategories = useMemo(() => {
        if (!poiParentCatId) return [];
        return (poiCategories || []).filter(c => c.parentId === parseInt(poiParentCatId, 10));
    }, [poiCategories, poiParentCatId]);

    const activeCategoryObject = useMemo(() => {
        if (!newPoiForm.categoryId) return null;
        return (poiCategories || []).find(c => c.id === parseInt(newPoiForm.categoryId, 10)) || null;
    }, [poiCategories, newPoiForm.categoryId]);

    const handlePoiParentCatChange = (newParentId) => {
        const pId = parseInt(newParentId, 10);
        setPoiParentCatId(newParentId);
        const subs = (poiCategories || []).filter(c => c.parentId === pId);
        if (subs.length > 0) {
            setNewPoiForm(prev => ({ ...prev, categoryId: subs[0].id }));
        } else {
            setNewPoiForm(prev => ({ ...prev, categoryId: pId }));
        }
    };

    const handlePoiSubCatChange = (newSubCatId) => {
        setNewPoiForm(prev => ({ ...prev, categoryId: parseInt(newSubCatId, 10) }));
    };

    // Editör İşbirliği Mekanizması State'leri
    const [showCollaborationModal, setShowCollaborationModal] = useState(false);
    const [availableEditors, setAvailableEditors] = useState([]);
    const [collaborationRequests, setCollaborationRequests] = useState([]);
    const [selectedEditorId, setSelectedEditorId] = useState('');
    const [collabLoading, setCollabLoading] = useState(false);

    const loggedInUserId = useMemo(() => {
        if (!token) return 0;
        const payload = parseJwt(token);
        return payload ? parseInt(payload.userId || payload.id || payload.nameid || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || 0) : 0;
    }, [token]);

    // Editörün bu çizimi düzenleme yetkisi var mı? (Admin, Kendi Çizimi veya Onaylanmış İşbirliği - Admin Çizimleri Hariç)
    const canEditDrawing = (drawingOrInfo) => {
        if (!drawingOrInfo) return false;
        if (isAdmin || userRole === 'Admin') return true; // Admin her çizimi düzenleyebilir
        if (userRole === 'Viewer') return false;

        const ownerId = drawingOrInfo.insertedUserId;
        const ownerName = (drawingOrInfo.insertedUsername || '').toLowerCase();

        // Eğer çizim Admin'e aitse (ID: 1 veya admin kullanıcısı), normal editörler KESİNLİKLE düzenleyemez
        if (ownerId === 1 || ownerName === 'asdf.admin' || ownerName.endsWith('.admin')) {
            return false;
        }

        // Kendi çizimi ise düzenleyebilir
        if (!ownerId || ownerId === loggedInUserId) return true;

        // Onaylı işbirliği olan diğer editörün çizimi ise düzenleyebilir
        return collaborationRequests.some(r =>
            r.status === 'Approved' && (
                (r.senderUserId === loggedInUserId && r.receiverUserId === ownerId) ||
                (r.receiverUserId === loggedInUserId && r.senderUserId === ownerId)
            )
        );
    };

    const fetchCollaborations = async () => {
        if (!token || userRole === 'Viewer') return;
        try {
            const [editorsRes, requestsRes] = await Promise.all([
                fetch('http://localhost:5041/api/collaborations/available-editors', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch('http://localhost:5041/api/collaborations/my-requests', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (editorsRes.ok) {
                const editorsData = await editorsRes.json();
                setAvailableEditors(editorsData);
            }
            if (requestsRes.ok) {
                const requestsData = await requestsRes.json();
                setCollaborationRequests(requestsData);
            }
            fetchEffectiveBoundary();
        } catch (err) {
            console.error('İşbirliği verileri alınamadı:', err);
        }
    };

    const handleSendCollaborationRequest = async (e) => {
        e.preventDefault();
        if (!selectedEditorId) return;
        setCollabLoading(true);
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ receiverUserId: parseInt(selectedEditorId) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İstek gönderilemedi.');

            toastRef.current?.show({ severity: 'success', summary: 'Başarılı', detail: 'İşbirliği isteği gönderildi!', life: 3000 });
            setSelectedEditorId('');
            fetchCollaborations();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const handleRespondCollaborationRequest = async (requestId, approve) => {
        setCollabLoading(true);
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ requestId, approve })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İşlem başarısız.');

            toastRef.current?.show({
                severity: approve ? 'success' : 'info',
                summary: approve ? (lang === 'tr' ? 'Yetki Alanları Birleştirildi' : 'Areas Merged') : 'Reddedildi',
                detail: approve 
                    ? (lang === 'tr' ? 'İşbirliği kabul edildi! Coğrafi yetki alanlarınız birleştirildi.' : 'Collaboration approved! Your spatial boundaries have been merged.')
                    : data.message,
                life: 3500
            });
            fetchCollaborations();
            fetchDrawings();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const handleCancelCollaboration = async (requestId) => {
        setCollabLoading(true);
        try {
            const res = await fetch(`http://localhost:5041/api/collaborations/${requestId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İşbirliği iptal edilemedi.');

            toastRef.current?.show({
                severity: 'info',
                summary: lang === 'tr' ? 'Yetki Alanları Ayrıldı' : 'Areas Separated',
                detail: lang === 'tr' ? 'İşbirliği sonlandırıldı. Coğrafi yetki alanları kendi sınırlarına ayrıldı.' : 'Collaboration cancelled. Spatial boundaries separated.',
                life: 3500
            });
            fetchCollaborations();
            fetchDrawings();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const pendingIncoming = useMemo(() => {
        return collaborationRequests.filter(r => r.receiverUserId === loggedInUserId && r.status === 'Pending');
    }, [collaborationRequests, loggedInUserId]);

    useEffect(() => {
        if (token) {
            fetchCollaborations();
        }
    }, [token]);

    useEffect(() => {
        if (selectedPointInfo) {
            setEditName(selectedPointInfo.name || '');
            setEditColor(selectedPointInfo.color || '#3b82f6');
            setEditWkt(selectedPointInfo.wkt || '');
        }
    }, [selectedPointInfo]);

    // OpenLayers harita ve katman referansları
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const savedPlacesSourceRef = useRef(null);
    const drawingsSourceRef = useRef(null);
    const analysisSourceRef = useRef(new VectorSource());
    const drawInteractionRef = useRef(null);
    const draftFeatureRef = useRef(null);
    const tileLayerRef = useRef(null);
    const overlayContainerRef = useRef(null);
    const overlayRef = useRef(null);
    const drawTypeRef = useRef(drawType);
    const placeColorRef = useRef(placeColor);

    useEffect(() => {
        drawTypeRef.current = drawType;
    }, [drawType]);

    useEffect(() => {
        placeColorRef.current = placeColor;
    }, [placeColor]);

    // OTURUM SÜRESİ KONTROLÜ VE GERİ SAYIM ZAMANLAYICISI (Admin için Sınırsız / Infinite)
    useEffect(() => {
        if (!token) return;

        const checkSessionExpiration = () => {
            const role = localStorage.getItem('user_role') || userRole;
            const isUserAdmin = role === 'Admin' || isAdmin || localStorage.getItem('is_admin') === 'true';

            // Admin oturum süresi sınırsızdır (asla otomatik çıkış yapmaz)
            if (isUserAdmin) {
                setTimeLeft(999999);
                return;
            }

            const expirationTime = localStorage.getItem('session_expiration');
            if (!expirationTime) {
                return;
            }

            const remainingMs = parseInt(expirationTime, 10) - Date.now();
            const remainingSeconds = Math.floor(remainingMs / 1000);

            if (remainingSeconds <= 0) {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('logged_in_username');
                localStorage.removeItem('session_expiration');
                setToken('');
                setLoggedInUsername('');
                setCurrentView('map');
                setError('Oturum süreniz sona erdi.');
            } else {
                setTimeLeft(remainingSeconds);
            }
        };

        checkSessionExpiration();
        const interval = setInterval(checkSessionExpiration, 1000);
        return () => clearInterval(interval);
    }, [token, isAdmin, userRole]);


    // Toast Bildirimi Tetikleme
    useEffect(() => {
        if (infoMessage && toastRef.current) {
            const lowerMsg = infoMessage.toLowerCase();
            const isError = lowerMsg.includes('hata') || 
                            lowerMsg.includes('başarısız') ||
                            lowerMsg.includes('dışındadır') ||
                            lowerMsg.includes('dışında') ||
                            lowerMsg.includes('yetkisiz') ||
                            lowerMsg.includes('engellendi') ||
                            lowerMsg.includes('izin verilen') ||
                            lowerMsg.includes('uyarı') ||
                            lowerMsg.includes('bulunamadı') ||
                            lowerMsg.includes('geçersiz');
            toastRef.current.show({
                severity: isError ? 'error' : 'success',
                summary: isError ? 'Başarısız' : 'Başarılı',
                detail: infoMessage,
                life: isError ? 4500 : 3500
            });
        }
    }, [infoMessage]);

    // KAYITLI TÜM ÇİZİMLERİ BACKEND'DEN ÇEKME (GET /api/drawings)
    const fetchDrawings = async () => {
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch('http://localhost:5041/api/drawings', { headers });
            if (response.ok) {
                const data = await response.json();
                setSavedDrawings(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Çizim verileri getirilirken hata oluştu:', err);
        }
    };

    // POI KATEGORİLERİNİ ÇEKME YARDIMCISI
    const fetchPoiCategories = async () => {
        try {
            const catsData = await adminApi.getPoiCategories(false, token);
            if (Array.isArray(catsData)) {
                setPoiCategories(catsData);
                return catsData;
            }
        } catch (err) {
            console.error('POI Kategorileri getirilirken hata:', err);
        }
        return [];
    };

    // ZOOM SEVİYESİNE VE ÖNCELİK SIRALAMASINA (LEVEL OF DETAIL) DUYARLI POI STİL FONKSİYONU
    // (Önemli kategoriler uzak zoomda da görünür, çakışmalarda yüksek öncelikli ikonlar üstte kalır)
    const createPoiStyle = (feature, resolution) => {
        const poi = feature.get('poiData') || {};
        const priority = poi.categoryDisplayOrder || 1; // 1: Çok Yüksek, 5: Detay

        // Kademeli Ölçeklendirme (Level of Detail):
        // Öncelik 1 (Çok Yüksek): resolution <= 600 (Zoom 8+)
        // Öncelik 2 (Yüksek):     resolution <= 300 (Zoom 9+)
        // Öncelik 3 (Orta):       resolution <= 150 (Zoom 10+)
        // Öncelik 4 (Standart):   resolution <= 76  (Zoom 11+)
        // Öncelik 5 (Detay):      resolution <= 38  (Zoom 12+)
        let maxAllowedResolution = 38;
        if (priority === 1) maxAllowedResolution = 600;
        else if (priority === 2) maxAllowedResolution = 300;
        else if (priority === 3) maxAllowedResolution = 150;
        else if (priority === 4) maxAllowedResolution = 76;
        else maxAllowedResolution = 38;

        if (resolution > maxAllowedResolution) {
            return [];
        }

        const poiColor = poi.categoryColor || '#3b82f6';
        const catName = poi.categoryName || poi.name || '';
        const catIcon = poi.categoryIcon || '';
        const name = poi.name || '';
        const geomType = feature.getGeometry() ? feature.getGeometry().getType() : 'Point';

        // İsim etiketleri sadece harita yeterince yakınken (resolution <= 76) görünür, genel bakışta sadece temiz ikon kalır
        const showLabel = name && resolution <= 76;
        const textStyle = showLabel ? new Text({
            text: name,
            font: 'bold 12px Inter, Arial, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
            offsetY: -26,
            overflow: false
        }) : undefined;

        // Öncelik bazlı z-index: Öncelik 1 olan en üstte (zIndex: 90) çizilir ve declutter çakışmasını kazanır
        const dynamicZIndex = Math.max(1, 100 - priority * 10);
        const categoryBadgeSvg = getPoiCategoryBadgeSvg(catName, catIcon, poiColor);

        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
            const interiorPt = feature.getGeometry().getInteriorPoint ? feature.getGeometry().getInteriorPoint() : new Point(getCenter(feature.getGeometry().getExtent()));
            return [
                new Style({
                    stroke: new Stroke({ color: poiColor, width: 2.5 }),
                    fill: new Fill({ color: hexToRgba(poiColor, 0.35) }),
                    zIndex: dynamicZIndex
                }),
                new Style({
                    geometry: interiorPt,
                    image: new Icon({
                        src: 'data:image/svg+xml;utf8,' + encodeURIComponent(categoryBadgeSvg),
                        scale: priority <= 2 ? 1.0 : 0.85,
                        anchor: [0.5, 0.5]
                    }),
                    text: textStyle,
                    zIndex: dynamicZIndex + 1
                })
            ];
        } else {
            return new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(categoryBadgeSvg),
                    scale: priority <= 2 ? 1.0 : 0.9,
                    anchor: [0.5, 0.5]
                }),
                text: textStyle,
                zIndex: dynamicZIndex
            });
        }
    };

    // POI (POINT OF INTEREST) VE KATEGORİLERİ ÇEKME & HARİTADA GÖSTERME
    const fetchPois = async () => {
        try {
            const [poisData, catsData] = await Promise.all([
                adminApi.getPois(null, false, token).catch(() => []),
                adminApi.getPoiCategories(false, token).catch(() => [])
            ]);
            setPois(poisData || []);
            if (Array.isArray(catsData)) {
                setPoiCategories(catsData);
            }

            if (poiSourceRef.current) {
                poiSourceRef.current.clear();
                const wktFormat = new WKT();
                (poisData || []).forEach((poi) => {
                    try {
                        if (!poi.wkt) return;
                        const feat = wktFormat.readFeature(poi.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        feat.set('isPoi', true);
                        feat.set('poiData', poi);
                        feat.setStyle(createPoiStyle);

                        poiSourceRef.current.addFeature(feat);
                    } catch (e) {
                        console.error('POI Feature render hatası:', e);
                    }
                });
            }
        } catch (err) {
            console.error('POI verileri getirilirken hata:', err);
        }
    };

    const clearUserData = () => {
        stopVertexEditing();
        setSavedPlaces([]);
        setSavedDrawings([]);
        setPois([]);
        setSelectedPoiInfo(null);
        setSelectedPointInfo(null);
        setSelectedTypeFilter('ALL');
        setSelectedEditorFilter('ALL');
        if (savedPlacesSourceRef.current) savedPlacesSourceRef.current.clear();
        if (drawingsSourceRef.current) drawingsSourceRef.current.clear();
        if (poiSourceRef.current) poiSourceRef.current.clear();
        if (vectorSourceRef.current) vectorSourceRef.current.clear();
        if (mapRef.current) {
            try {
                mapRef.current.setTarget(null);
            } catch (e) { }
            mapRef.current = null;
        }
    };

    // Giriş yapıldığında tüm çizimleri ve POI'leri yükle
    useEffect(() => {
        if (token) {
            clearUserData();
            fetchDrawings();
            fetchPois();
        } else {
            clearUserData();
        }
    }, [token]);

    // LOGIN İŞLEMİ
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('http://localhost:5041/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const expirationTimestamp = Date.now() + TEN_MINUTES_MS;

                const returnedRole = data.role || (data.isAdmin ? 'Admin' : 'Editor');
                const userIsAdmin = data.isAdmin === true && returnedRole === 'Admin';

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('logged_in_username', data.username || username);
                localStorage.setItem('session_expiration', expirationTimestamp.toString());
                localStorage.setItem('user_role', returnedRole);
                localStorage.setItem('is_admin', userIsAdmin ? 'true' : 'false');

                setLoggedInUsername(data.username || username);
                setUserRole(returnedRole);
                setIsAdmin(userIsAdmin);
                clearUserData();
                setIsLoggingIn(true);

                setTimeout(() => {
                    setToken(data.token);
                    setTimeLeft(600);
                    setIsLoggingIn(false);
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.updateSize();
                        }
                    }, 100);
                }, 500);
            } else {
                setError(data.message || 'Giriş başarısız.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı. Projenin açık olduğundan emin ol.');
        }
    };

    // MİSAFİR GİRİŞ İŞLEMİ (VIEWER MODU)
    const handleGuestLogin = async () => {
        setError('');
        try {
            const response = await fetch('http://localhost:5041/api/auth/guest-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (response.ok) {
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const expirationTimestamp = Date.now() + TEN_MINUTES_MS;

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('logged_in_username', 'Misafir (İzleyici)');
                localStorage.setItem('session_expiration', expirationTimestamp.toString());
                localStorage.setItem('user_role', 'Viewer');
                localStorage.setItem('is_admin', 'false');

                setLoggedInUsername('Misafir (İzleyici)');
                setUserRole('Viewer');
                setIsAdmin(false);
                clearUserData();
                setIsLoggingIn(true);

                setTimeout(() => {
                    setToken(data.token);
                    setTimeLeft(600);
                    setIsLoggingIn(false);
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.updateSize();
                        }
                    }, 100);
                }, 500);
            } else {
                setError(data.message || 'Misafir girişi başarısız.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı.');
        }
    };

    // ÇIKIŞ İŞLEMİ
    const handleLogout = (customMessage = '') => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('logged_in_username');
        localStorage.removeItem('session_expiration');
        localStorage.removeItem('is_admin');
        localStorage.removeItem('user_role');
        clearUserData();
        setToken('');
        setLoggedInUsername('');
        setUserRole('Viewer');
        setIsAdmin(false);
        setCurrentView('map');
        if (customMessage) {
            setError(customMessage);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // TEMA DEĞİŞTİĞİNDE HARİTA ALTLIK KATMANINI GÜNCELLE
    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        if (mapRef.current) {
            mapRef.current.updateSize();
            mapRef.current.render();
        }
    }, [isDarkMode]);

    // OPENLAYERS HARİTA KURULUMU (SABİT HARİTA MİMARİSİ)
    useEffect(() => {
        if (!token) return;
        const container = mapContainerRef.current || document.getElementById('map');
        if (!container) return;

        if (!mapRef.current) {
            const activeMarkerSource = new VectorSource();
            vectorSourceRef.current = activeMarkerSource;

            const savedPlacesSource = new VectorSource();
            savedPlacesSourceRef.current = savedPlacesSource;

            const drawingsSource = new VectorSource();
            drawingsSourceRef.current = drawingsSource;

            const activeBaseConfig = BASEMAP_LAYERS.find(l => l.id === selectedBaseLayer) || BASEMAP_LAYERS[0];
            const baseTileLayer = new TileLayer({
                source: new XYZ({
                    url: activeBaseConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: 20
                })
            });
            tileLayerRef.current = baseTileLayer;

            const analysisLayer = new VectorLayer({
                source: analysisSourceRef.current,
                style: new Style({
                    stroke: new Stroke({
                        color: '#f59e0b',
                        width: 3,
                        lineDash: [8, 8]
                    }),
                    fill: new Fill({
                        color: 'rgba(245, 158, 11, 0.25)'
                    })
                })
            });

            const heatmapLayer = new HeatmapLayer({
                source: heatmapSourceRef.current,
                blur: 24,
                radius: 20,
                weight: function () {
                    return 1;
                },
                gradient: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
                visible: false,
                zIndex: 15
            });
            heatmapLayerRef.current = heatmapLayer;

            const geoServerWmsSource = new TileWMS({
                url: 'http://localhost:5041/api/geoserver/wms',
                params: {
                    'LAYERS': 'geomap:v_points',
                    'STYLES': 'drawings_heatmap',
                    'TILED': true,
                    'CQL_FILTER': 'is_deleted = false'
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
            });
            geoServerWmsSourceRef.current = geoServerWmsSource;

            const geoServerHeatmapLayer = new TileLayer({
                source: geoServerWmsSource,
                visible: false,
                zIndex: 16
            });
            geoServerWmsLayerRef.current = geoServerHeatmapLayer;

            const map = new Map({
                target: container,
                layers: [
                    baseTileLayer,
                    new VectorLayer({
                        source: savedPlacesSource
                    }),
                    new VectorLayer({
                        source: drawingsSource
                    }),
                    new VectorLayer({
                        source: poiSourceRef.current,
                        style: createPoiStyle,
                        zIndex: 14,
                        declutter: true
                    }),
                    heatmapLayer,
                    geoServerHeatmapLayer,
                    analysisLayer,
                    new VectorLayer({
                        source: activeMarkerSource
                    })
                ],
                view: new View({
                    center: fromLonLat([33.2433, 38.9637]),
                    zoom: 6.5
                })
            });

            if (!overlayContainerRef.current) {
                const popupDiv = document.createElement('div');
                popupDiv.className = 'ol-popup-overlay-container';
                overlayContainerRef.current = popupDiv;
            }

            const overlay = new Overlay({
                element: overlayContainerRef.current,
                autoPan: {
                    animation: {
                        duration: 250,
                    },
                },
                positioning: 'bottom-center',
                offset: [0, 0],
                stopEvent: true
            });
            map.addOverlay(overlay);
            overlayRef.current = overlay;

            map.on('singleclick', function (evt) {
                if (drawTypeRef.current && drawTypeRef.current !== 'None') return;

                let clickedPoi = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isPoi')) {
                        clickedPoi = feature.get('poiData');
                        return true;
                    }
                });

                if (clickedPoi) {
                    setSelectedPoiInfo(clickedPoi);
                    return;
                }

                const lonLat = toLonLat(evt.coordinate);
                const lon = parseFloat(lonLat[0].toFixed(6));
                const lat = parseFloat(lonLat[1].toFixed(6));

                setCoords({ lon, lat });
                setHasUserSelectedPin(true);
            });

            map.on('pointermove', function (evt) {
                if (evt.coordinate) {
                    const [cLon, cLat] = toLonLat(evt.coordinate);
                    setCursorCoords({ lon: parseFloat(cLon.toFixed(5)), lat: parseFloat(cLat.toFixed(5)) });
                }
            });

            map.getView().on('change:resolution', function () {
                const z = map.getView().getZoom();
                if (z != null) setMapZoom(z);
            });

            mapRef.current = map;
        } else {
            mapRef.current.setTarget(container);
        }

        const updateMapSize = () => {
            if (mapRef.current) {
                mapRef.current.updateSize();
                mapRef.current.render();
            }
        };

        updateMapSize();
        const animFrame1 = requestAnimationFrame(updateMapSize);
        const animFrame2 = requestAnimationFrame(() => requestAnimationFrame(updateMapSize));
        const timer1 = setTimeout(updateMapSize, 50);
        const timer2 = setTimeout(updateMapSize, 150);
        const timer3 = setTimeout(updateMapSize, 300);
        const timer4 = setTimeout(updateMapSize, 600);
        const timer5 = setTimeout(updateMapSize, 1200);

        let resizeObserver = null;
        if (container && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                updateMapSize();
            });
            resizeObserver.observe(container);
        }

        return () => {
            cancelAnimationFrame(animFrame1);
            cancelAnimationFrame(animFrame2);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
            clearTimeout(timer5);
            if (resizeObserver && container) {
                resizeObserver.unobserve(container);
            }
        };
    }, [token]);

    // HARİTA GÖRÜNÜMÜNE GEÇİLDİĞİNDE VEYA OTURUM AÇILDIĞINDA HARİTA BOYUTUNU DÜZELT
    useEffect(() => {
        if (currentView === 'map' && mapRef.current) {
            const update = () => {
                mapRef.current?.updateSize();
                mapRef.current?.render();
            };
            update();
            const t1 = setTimeout(update, 50);
            const t2 = setTimeout(update, 200);
            const t3 = setTimeout(update, 500);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }
    }, [currentView, token]);

    // NOKTA BİLGİ PANELİ POPUP OVERLAY KONUMLANDIRMA
    useEffect(() => {
        if (overlayRef.current) {
            if (selectedPointInfo && selectedPointInfo.lon != null && selectedPointInfo.lat != null) {
                if (isModifyingVertex) {
                    overlayRef.current.setOffset([260, -220]);
                } else if (selectedPointInfo.type === 'LineDrawing' || selectedPointInfo.type === 'PolygonDrawing' || selectedPointInfo.type === 'Line' || selectedPointInfo.type === 'Polygon') {
                    overlayRef.current.setOffset([0, -200]);
                } else {
                    overlayRef.current.setOffset([0, -350]);
                }
                overlayRef.current.setPosition(fromLonLat([selectedPointInfo.lon, selectedPointInfo.lat]));
            } else {
                overlayRef.current.setPosition(undefined);
            }
        }
    }, [selectedPointInfo, isModifyingVertex]);

    // ISI HARİTASI (HEATMAP) NOKTALARINI GÜNCELLEME VE KATMAN GÖRÜNÜRLÜĞÜ
    useEffect(() => {
        if (!heatmapLayerRef.current) return;
        heatmapLayerRef.current.setVisible(isHeatmapActive);

        if (isHeatmapActive && heatmapSourceRef.current) {
            heatmapSourceRef.current.clear();
            const wktFormat = new WKT();
            const featuresToAdd = [];

            // 1. NOKTALAR (Points & Saved Places)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Point') {
                const pointDrawings = savedDrawings.filter(d => (d.type === 'Point' || d.type === 'PointDrawing') && d.wkt);
                pointDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        featuresToAdd.push(new Feature({
                            geometry: geom,
                            name: d.name,
                            id: `pt-${d.id}`,
                            weight: 1
                        }));
                    } catch (e) {
                        console.error('Heatmap point parsing error:', e);
                    }
                });

                savedPlaces.forEach(p => {
                    if (p.longitude != null && p.latitude != null) {
                        featuresToAdd.push(new Feature({
                            geometry: new Point(fromLonLat([p.longitude, p.latitude])),
                            name: p.name,
                            id: `place-${p.id}`,
                            weight: 1
                        }));
                    }
                });
            }

            // 2. ÇİZGİLER (LineStrings - Güzergah Düğüm & Kırılma Noktaları)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Line') {
                const lineDrawings = savedDrawings.filter(d => (d.type === 'Line' || d.type === 'LineString' || d.type === 'LineDrawing') && d.wkt);
                lineDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const coords = geom.getCoordinates();
                        if (Array.isArray(coords)) {
                            coords.forEach((coord, idx) => {
                                featuresToAdd.push(new Feature({
                                    geometry: new Point(coord),
                                    name: `${d.name || 'Çizgi'} (Nokta ${idx + 1})`,
                                    id: `line-${d.id}-pt-${idx}`,
                                    weight: 0.9
                                }));
                            });
                        }
                    } catch (e) {
                        console.error('Heatmap line parsing error:', e);
                    }
                });
            }

            // 3. POLİGONLAR (Polygons - Köşe Noktaları & Ağırlık Merkezi)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Polygon') {
                const polyDrawings = savedDrawings.filter(d => (d.type === 'Polygon' || d.type === 'PolygonDrawing') && d.wkt);
                polyDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const coordsArray = geom.getCoordinates();
                        if (Array.isArray(coordsArray) && coordsArray.length > 0) {
                            // Dış çevre köşe koordinatları
                            coordsArray[0].forEach((coord, idx) => {
                                featuresToAdd.push(new Feature({
                                    geometry: new Point(coord),
                                    name: `${d.name || 'Poligon'} (Köşe ${idx + 1})`,
                                    id: `poly-${d.id}-v-${idx}`,
                                    weight: 0.85
                                }));
                            });
                            // İç merkez / ağırlık noktası
                            if (geom.getInteriorPoint) {
                                featuresToAdd.push(new Feature({
                                    geometry: geom.getInteriorPoint(),
                                    name: `${d.name || 'Poligon'} (Merkez)`,
                                    id: `poly-${d.id}-center`,
                                    weight: 1
                                }));
                            }
                        }
                    } catch (e) {
                        console.error('Heatmap polygon parsing error:', e);
                    }
                });
            }

            heatmapSourceRef.current.addFeatures(featuresToAdd);
        }

        // GEOSERVER WMS KATMANI & DİNAMİK CQL_FILTER GÜNCELLEMESİ
        if (geoServerWmsSourceRef.current) {
            let cql = 'is_deleted = false';
            if (heatmapTypeFilter === 'Point') {
                cql += " AND (type = 'Point' OR type = 'PointDrawing')";
            } else if (heatmapTypeFilter === 'Line') {
                cql += " AND (type = 'Line' OR type = 'LineString' OR type = 'LineDrawing')";
            } else if (heatmapTypeFilter === 'Polygon') {
                cql += " AND (type = 'Polygon' OR type = 'PolygonDrawing')";
            }

            try {
                geoServerWmsSourceRef.current.updateParams({
                    'CQL_FILTER': cql,
                    'TIME': Date.now()
                });
            } catch (e) {
                console.warn('GeoServer WMS params update:', e);
            }
        }
    }, [isHeatmapActive, heatmapTypeFilter, savedDrawings, savedPlaces]);

    // NOKTA BİLGİ PANELİ EYLEMLERİ
    const handleCopyCoords = () => {
        if (!selectedPointInfo) return;
        const textToCopy = `${selectedPointInfo.lat}, ${selectedPointInfo.lon}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'info',
                    summary: t.pointInfoTitle,
                    detail: t.coordsCopiedToast,
                    life: 3000
                });
            }
        });
    };

    // KIRILMA NOKTALARINI FARE İLE HARİTADA DÜZENLEME (Modify Interaction + Undo/Redo + Cancel Modal)
    const stopVertexEditing = () => {
        if (modifyInteractionRef.current && mapRef.current) {
            try {
                mapRef.current.removeInteraction(modifyInteractionRef.current);
            } catch (e) { }
            modifyInteractionRef.current = null;
        }
        setIsModifyingVertex(false);
        setIsPopupCollapsed(false);
        geometryHistoryRef.current = [];
        setHistoryIndex(-1);
    };

    const updateGeometryInfoFromGeom = (targetFeature, geom) => {
        const wktFormat = new WKT();
        const newWkt = wktFormat.writeGeometry(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });

        setEditWkt(newWkt);

        let updatedLengthText = selectedPointInfo.lengthText;
        let updatedAreaText = selectedPointInfo.areaText;

        if (selectedPointInfo.type.includes('Line')) {
            const lengthMeters = getLength(geom);
            updatedLengthText = lengthMeters >= 1000 ? (lengthMeters / 1000).toFixed(2) + ' km' : Math.round(lengthMeters) + ' m';
        } else if (selectedPointInfo.type.includes('Polygon')) {
            const areaMeters = getArea(geom);
            updatedAreaText = areaMeters >= 1000000 ? (areaMeters / 1000000).toFixed(2) + ' km²' : Math.round(areaMeters).toLocaleString() + ' m²';
        }

        setSelectedPointInfo(prev => prev ? {
            ...prev,
            wkt: newWkt,
            lengthText: updatedLengthText,
            areaText: updatedAreaText
        } : null);
    };

    const startVertexEditing = () => {
        if (!selectedPointInfo || !selectedPointInfo.id || !drawingsSourceRef.current || !mapRef.current) return;

        stopVertexEditing();

        const features = drawingsSourceRef.current.getFeatures();
        const targetFeature = features.find(f => f.get('id') === selectedPointInfo.id && (f.get('type') === selectedPointInfo.type || selectedPointInfo.type.includes(f.get('type'))));

        if (!targetFeature) {
            setInfoMessage('Harita üzerinde düzenlenecek çizim objesi bulunamadı.');
            return;
        }

        originalWktRef.current = selectedPointInfo.wkt;
        const initialGeomClone = targetFeature.getGeometry().clone();
        geometryHistoryRef.current = [initialGeomClone];
        setHistoryIndex(0);

        const modify = new Modify({
            features: new Collection([targetFeature])
        });

        modify.on('modifyend', () => {
            try {
                const geom = targetFeature.getGeometry();
                const geomClone = geom.clone();

                setHistoryIndex(prevIndex => {
                    const newHistory = geometryHistoryRef.current.slice(0, prevIndex + 1);
                    newHistory.push(geomClone);
                    geometryHistoryRef.current = newHistory;
                    return newHistory.length - 1;
                });

                updateGeometryInfoFromGeom(targetFeature, geom);
                setInfoMessage('Kırılma noktaları haritada güncellendi. "Kaydet" butonuna basarak kaydedebilir veya "Geri Al" butonunu kullanabilirsiniz.');
            } catch (err) {
                console.error('Modify end hatası:', err);
            }
        });

        mapRef.current.addInteraction(modify);
        modifyInteractionRef.current = modify;
        setIsModifyingVertex(true);
        setIsPopupCollapsed(true);
        setInfoMessage('Kırılma noktalarını fare ile harita üzerinde sürükleyebilirsiniz.');
    };

    // GERİ AL (UNDO)
    const handleUndoGeometry = () => {
        if (historyIndex <= 0 || !drawingsSourceRef.current) return;
        const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
        if (!targetFeature) return;

        const newIndex = historyIndex - 1;
        const targetGeom = geometryHistoryRef.current[newIndex].clone();
        targetFeature.setGeometry(targetGeom);
        setHistoryIndex(newIndex);
        updateGeometryInfoFromGeom(targetFeature, targetGeom);
        setInfoMessage('Değişiklik geri alındı (Geri Al).');
    };

    // İLERİ AL (REDO)
    const handleRedoGeometry = () => {
        if (historyIndex < 0 || historyIndex >= geometryHistoryRef.current.length - 1 || !drawingsSourceRef.current) return;
        const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
        if (!targetFeature) return;

        const newIndex = historyIndex + 1;
        const targetGeom = geometryHistoryRef.current[newIndex].clone();
        targetFeature.setGeometry(targetGeom);
        setHistoryIndex(newIndex);
        updateGeometryInfoFromGeom(targetFeature, targetGeom);
        setInfoMessage('Değişiklik ileri alındı (İleri Al).');
    };

    // VAZGEÇ / İPTAL TALEBİ VE ESKİ GEOMETRİYE DÖNÜŞ (ERROR PREVENTION MODAL)
    const handleTriggerCancelVertexEditing = () => {
        if (historyIndex <= 0) {
            stopVertexEditing();
            return;
        }
        setCancelEditConfirm(true);
    };

    const confirmCancelVertexEditing = () => {
        setCancelEditConfirm(false);
        if (selectedPointInfo && selectedPointInfo.id && drawingsSourceRef.current && originalWktRef.current) {
            try {
                const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
                if (targetFeature) {
                    const wktFormat = new WKT();
                    const origGeom = wktFormat.readGeometry(originalWktRef.current, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    targetFeature.setGeometry(origGeom.getGeometry());
                    setEditWkt(originalWktRef.current);
                    setSelectedPointInfo(prev => prev ? { ...prev, wkt: originalWktRef.current } : null);
                }
            } catch (e) {
                console.error('Eski geometriye dönüş hatası:', e);
            }
        }
        stopVertexEditing();
        setInfoMessage('Kırılma noktası değişiklikleri iptal edildi ve eski haline dönüldü.');
    };

    const handleClosePointInfo = () => {
        if (isModifyingVertex && historyIndex > 0) {
            setCancelEditConfirm(true);
            return;
        }
        stopVertexEditing();
        setSelectedPointInfo(null);
    };

    // SEÇİLİ MAVİ PIN İŞARETÇİSİ (Haritaya tıklanmadığı sürece şeffaf / gizli)
    useEffect(() => {
        if (!vectorSourceRef.current) return;
        vectorSourceRef.current.clear();

        if (!hasUserSelectedPin) return; // Kullanıcı haritaya tıklamadığı sürece pin çizilmez

        const lon = parseFloat(coords.lon);
        const lat = parseFloat(coords.lat);

        if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
            const marker = new Feature({
                geometry: new Point(fromLonLat([lon, lat]))
            });

            // Seçili konumu diğer tüm objelerden ayıran belirgin, modern mavi cam degradeli ve hedef halkalı iğne
            const pinSvg = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0284c7" flood-opacity="0.6"/>
                </filter>
                <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.75"/>
                </linearGradient>
              </defs>
              <path d="M18 1.5C9.44 1.5 2.5 8.44 2.5 17C2.5 29.5 18 46.5 18 46.5C18 46.5 33.5 29.5 33.5 17C33.5 8.44 26.56 1.5 18 1.5Z" fill="url(#pinGrad)" stroke="#ffffff" stroke-width="2.2" filter="url(#glow)"/>
              <circle cx="18" cy="17" r="6.5" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
              <circle cx="18" cy="17" r="2.8" fill="#0284c7"/>
            </svg>`;

            marker.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                    scale: 0.85,
                    anchor: [0.5, 1],
                    opacity: 0.9
                })
            }));

            vectorSourceRef.current.addFeature(marker);
        }
    }, [coords, hasUserSelectedPin, token, placeColor]);

    // KAYITLI MEKANLARI HARİTADA GÖSTER
    useEffect(() => {
        if (!savedPlacesSourceRef.current) return;
        savedPlacesSourceRef.current.clear();

        savedPlaces.forEach((place) => {
            const pinColor = place.color || '#16a34a';
            const pinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${pinColor}" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
            </svg>`;

            const feature = new Feature({
                geometry: new Point(fromLonLat([place.longitude, place.latitude])),
                name: place.name
            });

            feature.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                    scale: 0.75,
                    anchor: [0.5, 1]
                })
            }));

            savedPlacesSourceRef.current.addFeature(feature);
        });
    }, [savedPlaces]);

    // SEÇİLİ FİLTRELERE GÖRE ÇİZİMLERİ SÜZ
    const filteredDrawings = useMemo(() => {
        return savedDrawings.filter((item) => {
            const matchesType = selectedTypeFilter === 'ALL' || item.type === selectedTypeFilter;
            const creatorName = item.insertedUsername || (item.insertedUserId === 1 ? 'asdf.admin' : `Kullanıcı #${item.insertedUserId}`);
            const matchesEditor = selectedEditorFilter === 'ALL' || creatorName === selectedEditorFilter || item.insertedUserId.toString() === selectedEditorFilter;
            return matchesType && matchesEditor;
        });
    }, [savedDrawings, selectedTypeFilter, selectedEditorFilter]);

    const editorOptions = useMemo(() => {
        const names = new Set();
        savedDrawings.forEach(d => {
            const name = d.insertedUsername || (d.insertedUserId === 1 ? 'asdf.admin' : `Kullanıcı #${d.insertedUserId}`);
            if (name) names.add(name);
        });
        return Array.from(names);
    }, [savedDrawings]);

    // KAYITLI ÇİZİMLERİ (Point, Line, Polygon - WKT & Color) HARİTADA GÖSTER
    useEffect(() => {
        if (!drawingsSourceRef.current) return;
        drawingsSourceRef.current.clear();

        const wktFormat = new WKT();

        filteredDrawings.forEach((item) => {
            try {
                if (!item.wkt) return;

                const feature = wktFormat.readFeature(item.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                const itemColor = item.color || '#3b82f6';

                feature.set('id', item.id);
                feature.set('name', item.name);
                feature.set('type', item.type);
                feature.set('color', itemColor);
                feature.set('wkt', item.wkt);

                if (item.type === 'Point') {
                    const pinColor = itemColor;
                    const pinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${pinColor}" stroke="#ffffff" stroke-width="2.5"/>
                      <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
                    </svg>`;

                    feature.setStyle(new Style({
                        image: new Icon({
                            src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                            scale: 0.75,
                            anchor: [0.5, 1]
                        })
                    }));
                } else if (item.type === 'Line') {
                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: itemColor,
                            width: 4
                        })
                    }));
                } else if (item.type === 'Polygon') {
                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: itemColor,
                            width: 3
                        }),
                        fill: new Fill({
                            color: hexToRgba(itemColor, 0.35)
                        })
                    }));
                }

                drawingsSourceRef.current.addFeature(feature);
            } catch (err) {
                console.error(`WKT okuma hatası (${item.id}):`, err);
            }
        });
    }, [filteredDrawings]);

    // ÇİZİME İPTAL ETME VE TEMİZLEME
    const handleCancelDraw = () => {
        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.abortDrawing();
            } catch (e) { }
            if (mapRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
            }
            drawInteractionRef.current = null;
        }

        if (draftFeatureRef.current && drawingsSourceRef.current) {
            drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
            draftFeatureRef.current = null;
        }

        setDraftWkt('');
        setDrawingName('');
        setDrawingColor('#3b82f6');
        setDrawType('None');
    };

    // GEÇİCİ ANALİZİ TEMİZLEME
    const handleClearAnalysis = () => {
        if (analysisSourceRef.current) {
            analysisSourceRef.current.clear();
        }
        setAnalysisResult(null);
        setDrawType('None');
        setInfoMessage('Geçici envanter analizi temizlendi.');
    };

    // OPENLAYERS INTERACTION YÖNETİMİ (drawend Tetikleyicisi)
    useEffect(() => {
        if (!mapRef.current || !drawingsSourceRef.current) return;

        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.abortDrawing();
            } catch (e) { }
            mapRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }

        if (drawType === 'None') {
            setDraftWkt('');
            setDrawingName('');
            return;
        }

        // Seçilen moda göre varsayılan başlık önerisi
        const typeLabel = drawType === 'Point' ? 'Nokta' : drawType === 'LineString' ? 'Çizgi' : drawType === 'Polygon' ? 'Poligon' : 'Analiz';
        setDrawingName(`${typeLabel} Çizimi - ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
        setDrawingColor('#3b82f6');
        setDraftWkt('');

        // GEÇİCİ ENVANTER ANALİZİ ÇİZİM MODU
        if (drawType === 'Analysis') {
            const drawInteraction = new Draw({
                source: analysisSourceRef.current,
                type: 'Polygon'
            });

            drawInteraction.on('drawend', async (event) => {
                const geometry = event.feature.getGeometry();
                const wktFormat = new WKT();
                const wktString = wktFormat.writeGeometry(geometry, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                // OpenLayers olay döngüsünü bozmamak için çizim modunu asynchronous zamanlayıcı ile sıfırla
                setTimeout(() => {
                    setDrawType('None');
                }, 50);

                setIsAnalyzing(true);
                setInfoMessage('Kesişim analizi hesaplanıyor...');

                try {
                    const response = await fetch('http://localhost:5041/api/analysis/inventory', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ wkt: wktString })
                    });

                    const data = await response.json();
                    if (response.ok && data) {
                        setAnalysisResult(data);
                        setInfoMessage(`Analiz tamamlandı: Toplam ${data.totalIntersectedCount ?? 0} envanter kesişiyor.`);
                    } else {
                        setInfoMessage('Analiz hatası: ' + (data?.message || 'Bilinmeyen hata'));
                    }
                } catch (err) {
                    setInfoMessage('Analiz isteği gönderilirken hata oluştu.');
                } finally {
                    setIsAnalyzing(false);
                }
            });

            mapRef.current.addInteraction(drawInteraction);
            drawInteractionRef.current = drawInteraction;
            return;
        }

        // POI (POINT OF INTEREST) NOKTA VEYA POLİGON EKLEME MODU (Shift Destekli)
        if (drawType === 'Poi') {
            const poiDrawInteraction = new Draw({
                source: drawingsSourceRef.current,
                type: poiDrawGeometryType
            });

            poiDrawInteraction.on('drawstart', (event) => {
                if (draftFeatureRef.current && drawingsSourceRef.current) {
                    try {
                        drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
                    } catch (e) { }
                }
                draftFeatureRef.current = event.feature;
            });

            poiDrawInteraction.on('drawend', async (event) => {
                const geom = event.feature.getGeometry();
                const geomType = geom.getType();
                draftFeatureRef.current = event.feature;
                let lon = 0, lat = 0, wktStr = '', areaMeters = 0;

                if (geomType === 'Point') {
                    const coord = geom.getCoordinates();
                    const [pLon, pLat] = toLonLat(coord);
                    lon = parseFloat(pLon.toFixed(6));
                    lat = parseFloat(pLat.toFixed(6));
                    wktStr = `POINT(${lon} ${lat})`;
                } else {
                    const wktFormat = new WKT();
                    wktStr = wktFormat.writeGeometry(geom, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    const interiorPt = geom.getInteriorPoint ? geom.getInteriorPoint().getCoordinates() : getCenter(geom.getExtent());
                    const [pLon, pLat] = toLonLat(interiorPt);
                    lon = parseFloat(pLon.toFixed(6));
                    lat = parseFloat(pLat.toFixed(6));
                    areaMeters = getArea(geom);
                }

                // Spatial boundary check
                if (!isAdmin && userRole !== 'Admin' && userSpatialBoundaryWktRef.current) {
                    try {
                        const wktFormat = new WKT();
                        const bFeature = wktFormat.readFeature(userSpatialBoundaryWktRef.current, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const geojsonFormat = new GeoJSON();
                        const bGeoJsonObj = geojsonFormat.writeGeometryObject(bFeature.getGeometry());
                        const drawnGeoJsonObj = geojsonFormat.writeGeometryObject(geom);
                        const isAllowed = isGeomInsideBoundary(drawnGeoJsonObj, bGeoJsonObj);

                        if (!isAllowed) {
                            if (draftFeatureRef.current && drawingsSourceRef.current) {
                                drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
                                draftFeatureRef.current = null;
                            }
                            setDraftPoiData(null);
                            if (toastRef.current) {
                                toastRef.current.show({
                                    severity: 'error',
                                    summary: 'Yetkisiz Alan',
                                    detail: 'POI konumu tanımlı coğrafi yetki sınırınızın dışındadır! Lütfen izin verilen bölge içerisine POI ekleyiniz.',
                                    life: 5000
                                });
                            }
                            return;
                        }
                    } catch (e) {
                        console.error('POI spatial check error:', e);
                    }
                }

                setDraftPoiData({
                    wkt: wktStr,
                    lon: lon,
                    lat: lat,
                    isPolygon: geomType === 'Polygon' || geomType === 'MultiPolygon',
                    area: areaMeters,
                    feature: event.feature
                });

                if (toastRef.current) {
                    toastRef.current.show({
                        severity: 'info',
                        summary: geomType === 'Polygon' ? 'Poligon Hazır' : 'Nokta Hazır',
                        detail: 'Konum seçildi. Bilgileri girip haritaya eklemek için aşağıdaki "Kaydet" butonuna tıklayınız.',
                        life: 3000
                    });
                }
            });

            mapRef.current.addInteraction(poiDrawInteraction);
            drawInteractionRef.current = poiDrawInteraction;
            return;
        }

        // STANDART ÇİZİM MODLARI (Point, LineString, Polygon)
        const stdDrawInteraction = new Draw({
            source: drawingsSourceRef.current,
            type: drawType
        });

        stdDrawInteraction.on('drawstart', (event) => {
            draftFeatureRef.current = event.feature;
        });

        // 2. MADDE: Haritada çizim tamamlandığı anda (drawend) WKT Alır ve Yüzer Menüye Aktarır (Sınır Dışına Çıkma Kontrolü İle)
        stdDrawInteraction.on('drawend', (event) => {
            const geometry = event.feature.getGeometry();
            draftFeatureRef.current = event.feature;

            const wktFormat = new WKT();
            const wktString = wktFormat.writeGeometry(geometry, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });

            // STRICT SPATIAL BOUNDARY ENFORCEMENT CHECK (Only for non-Admin / Editor users)
            if (!isAdmin && userRole !== 'Admin' && userSpatialBoundaryWktRef.current) {

                try {
                    const bFeature = wktFormat.readFeature(userSpatialBoundaryWktRef.current, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    const geojsonFormat = new GeoJSON();
                    const bGeoJsonObj = geojsonFormat.writeGeometryObject(bFeature.getGeometry());
                    const drawnGeoJsonObj = geojsonFormat.writeGeometryObject(geometry);

                    const isAllowed = isGeomInsideBoundary(drawnGeoJsonObj, bGeoJsonObj);

                    if (!isAllowed) {
                        setTimeout(() => {
                            if (drawingsSourceRef.current && draftFeatureRef.current) {
                                try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                draftFeatureRef.current = null;
                            }
                        }, 50);
                        setDraftWkt('');
                        if (toastRef.current) {
                            toastRef.current.show({
                                severity: 'error',
                                summary: 'Yetkisiz Alan',
                                detail: 'Çiziminiz tanımlı coğrafi yetki sınırınızın dışına çıktı! Çizim engellendi. Lütfen yalnızca kırmızı yanıp sönen coğrafi sınır içerisine çizim yapınız.',
                                life: 6000
                            });
                        }
                        return;
                    }
                } catch (spatialErr) {
                    console.error('Sınır denetim hatası:', spatialErr);
                }
            }

            setDraftWkt(wktString);
        });


        mapRef.current.addInteraction(stdDrawInteraction);
        drawInteractionRef.current = stdDrawInteraction;

        return () => {
            if (mapRef.current && drawInteractionRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
            }
        };
    }, [drawType, poiDrawGeometryType, token]);

    // POI HARİTADAN KAYDETME (Operatör / Editör / Admin)
    const handleSaveNewPoi = async (e) => {
        e.preventDefault();
        if (!newPoiForm.name.trim()) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Eksik Alan', detail: 'Lütfen POI adını giriniz.', life: 3000 });
            }
            return;
        }
        if (!newPoiForm.categoryId) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Eksik Alan', detail: 'Lütfen bir kategori seçiniz.', life: 3000 });
            }
            return;
        }

        try {
            await adminApi.createPoi({
                name: newPoiForm.name.trim(),
                description: newPoiForm.description?.trim(),
                categoryId: parseInt(newPoiForm.categoryId, 10),
                workingHours: newPoiForm.workingHours?.trim(),
                wkt: newPoiForm.wkt
            }, token);

            if (draftFeatureRef.current && drawingsSourceRef.current) {
                try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                draftFeatureRef.current = null;
            }
            setDraftPoiData(null);
            setDrawType('None');

            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'success',
                    summary: 'Başarılı',
                    detail: `"${newPoiForm.name}" adlı POI haritaya başarıyla eklendi!`,
                    life: 3500
                });
            }

            setShowCreatePoiModal(false);
            fetchPois();
        } catch (err) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'error', summary: 'Hata', detail: err.message || 'POI kaydedilemedi.', life: 4000 });
            }
        }
    };

    const handleDeletePoiFromMap = async (poiId, poiName) => {
        if (!window.confirm(`"${poiName}" adlı POI'yi silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deletePoi(poiId, token);
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'info',
                    summary: 'Silindi',
                    detail: 'POI başarıyla kaldırıldı.',
                    life: 3000
                });
            }
            setSelectedPoiInfo(null);
            fetchPois();
        } catch (err) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'error', summary: 'Hata', detail: err.message || 'Silme başarısız.', life: 4000 });
            }
        }
    };

    // YÜZER ÇİZİM BARI ÜZERİNDEN VERİTABANINA KAYDETME
    const handleSaveDrawingFromFloatingBox = async () => {
        if (!drawType || drawType === 'None') return;

        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.finishDrawing();
            } catch (e) { }
        }

        let wktToSend = draftWkt;

        if (!wktToSend && draftFeatureRef.current) {
            const wktFormat = new WKT();
            wktToSend = wktFormat.writeGeometry(draftFeatureRef.current.getGeometry(), {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        }

        if (!wktToSend) {
            setInfoMessage('Lütfen önce haritada çiziminizi tamamlayın.');
            return;
        }

        const typeLabel = drawType === 'Point' ? 'Nokta' : drawType === 'LineString' ? 'Çizgi' : 'Poligon';
        const finalName = drawingName.trim() || `${typeLabel} Çizimi`;

        let endpoint = 'http://localhost:5041/api/drawings/';
        if (drawType === 'Point') endpoint += 'point';
        else if (drawType === 'LineString') endpoint += 'line';
        else if (drawType === 'Polygon') endpoint += 'polygon';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: finalName,
                    color: drawingColor,
                    wkt: wktToSend
                })
            });

            const data = await response.json();
            if (response.ok) {
                setInfoMessage(`${typeLabel} veritabanına (${drawingColor} rengiyle) başarıyla kaydedildi!`);
                draftFeatureRef.current = null;
                setDraftWkt('');
                setDrawingName('');
                setDrawingColor('#3b82f6');
                setDrawType('None');
                fetchDrawings();
            } else {
                setInfoMessage('Kayıt başarısız: ' + (data.message || 'Hata oluştu'));
            }
        } catch (err) {
            setInfoMessage('Çizim verisi sunucuya gönderilirken hata oluştu.');
        }
    };

    // MEKANA ODAKLANMA (showInfo = false varsayılan)
    const handleSelectSavedPlace = (place, showInfo = false) => {
        setCoords({ lon: place.longitude, lat: place.latitude });
        setPlaceName(place.name);
        if (place.color) setPlaceColor(place.color);

        if (showInfo) {
            setSelectedPointInfo({
                name: place.name,
                type: 'SavedPlace',
                lon: place.longitude,
                lat: place.latitude,
                color: place.color || '#16a34a',
                wkt: `POINT(${place.longitude} ${place.latitude})`
            });
        }

        if (mapRef.current) {
            mapRef.current.getView().animate({
                center: fromLonLat([place.longitude, place.latitude]),
                zoom: 13,
                duration: 1000
            });
        }
    };

    // ÇİZİME ODAKLANMA (showInfo = false varsayılan)
    const handleSelectDrawing = (drawing, showInfo = false) => {
        if (!mapRef.current || !drawing.wkt) return;
        try {
            const wktFormat = new WKT();
            const feature = wktFormat.readFeature(drawing.wkt, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, { duration: 1000, maxZoom: 15, padding: [50, 50, 50, 50] });

            if (showInfo) {
                const geom = feature.getGeometry();

                if (drawing.type === 'Point') {
                    const coordsDeg = toLonLat(geom.getCoordinates());
                    const pLon = parseFloat(coordsDeg[0].toFixed(6));
                    const pLat = parseFloat(coordsDeg[1].toFixed(6));

                    setCoords({ lon: pLon, lat: pLat });
                    if (drawing.color) setPlaceColor(drawing.color);

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'PointDrawing',
                        lon: pLon,
                        lat: pLat,
                        color: drawing.color || '#ef4444',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });
                } else if (drawing.type === 'Line') {
                    const centerCoord = getCenter(extent);
                    const coordsDeg = toLonLat(centerCoord);
                    const cLon = parseFloat(coordsDeg[0].toFixed(6));
                    const cLat = parseFloat(coordsDeg[1].toFixed(6));
                    const lengthMeters = getLength(geom);
                    const lengthText = lengthMeters >= 1000 ? (lengthMeters / 1000).toFixed(2) + ' km' : Math.round(lengthMeters) + ' m';

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'LineDrawing',
                        lon: cLon,
                        lat: cLat,
                        lengthText: lengthText,
                        color: drawing.color || '#3b82f6',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });
                } else if (drawing.type === 'Polygon') {
                    let centerCoord;
                    if (geom.getInteriorPoint) {
                        centerCoord = geom.getInteriorPoint().getCoordinates();
                    } else {
                        centerCoord = getCenter(extent);
                    }
                    const coordsDeg = toLonLat(centerCoord);
                    const cLon = parseFloat(coordsDeg[0].toFixed(6));
                    const cLat = parseFloat(coordsDeg[1].toFixed(6));
                    const areaMeters = getArea(geom);
                    const areaText = areaMeters >= 1000000 ? (areaMeters / 1000000).toFixed(2) + ' km²' : Math.round(areaMeters).toLocaleString() + ' m²';

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'PolygonDrawing',
                        lon: cLon,
                        lat: cLat,
                        areaText: areaText,
                        color: drawing.color || '#10b981',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });

                    runSavedPolygonAnalysis(drawing);
                }
            }
        } catch (err) {
            console.error('Odaklanma hatası:', err);
        }
    };

    // KAYITLI POLİGON İÇİN KESİŞİM ANALİZİ ÇALIŞTIRMA (Gereksinim 3.1)
    // KAYITLI POLİGON İÇİN KESİŞİM ANALİZİ ÇALIŞTIRMA
    const runSavedPolygonAnalysis = async (drawing) => {
        try {
            setIsAnalyzing(true);
            const response = await fetch('http://localhost:5041/api/analysis/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ wkt: drawing.wkt })
            });

            const data = await response.json();
            if (response.ok && data) {
                setAnalysisResult(data);
            }
        } catch (err) {
            console.error('Kayıtlı poligon analizi hatası:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // SİLME UYARISI
    const triggerDeletePlace = (place, e) => {
        e.stopPropagation();
        setDeleteTarget({
            kind: 'place',
            id: place.id,
            name: place.name
        });
    };

    const triggerDeleteDrawing = (drawing, e) => {
        e.stopPropagation();
        setDeleteTarget({
            kind: 'drawing',
            drawingType: drawing.type,
            id: drawing.id,
            name: drawing.name
        });
    };

    // HARİTADAKİ OBJE DETAY POPUP ÜZERİNDEN GÜNCELLEME İÇİN ONAY MODALI (ERROR PREVENTION)
    const [updateConfirmTarget, setUpdateConfirmTarget] = useState(null);

    const handleUpdateDrawingFromPopup = () => {
        if (!selectedPointInfo || !selectedPointInfo.id) {
            setInfoMessage('Güncellenecek çizim id bilgisi bulunamadı.');
            return;
        }

        setUpdateConfirmTarget({
            id: selectedPointInfo.id,
            name: editName.trim() || selectedPointInfo.name,
            type: selectedPointInfo.type
        });
    };

    const executeDrawingUpdateConfirmed = async () => {
        if (!selectedPointInfo || !selectedPointInfo.id) return;
        setUpdateConfirmTarget(null);

        let drawingType = selectedPointInfo.type;
        if (drawingType === 'PointDrawing') drawingType = 'Point';
        if (drawingType === 'LineDrawing') drawingType = 'Line';
        if (drawingType === 'PolygonDrawing') drawingType = 'Polygon';

        try {
            const response = await fetch(`http://localhost:5041/api/drawings/${drawingType.toLowerCase()}/${selectedPointInfo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName.trim() || selectedPointInfo.name,
                    color: editColor,
                    wkt: editWkt.trim() || selectedPointInfo.wkt
                })
            });

            const data = await response.json();
            if (response.ok) {
                stopVertexEditing();
                setInfoMessage(`"${editName.trim() || selectedPointInfo.name}" çizimi (İsim/Renk/Geometri) başarıyla güncellendi!`);
                fetchDrawings();
                setSelectedPointInfo(prev => prev ? { ...prev, name: editName, color: editColor, wkt: editWkt } : null);
            } else {
                setInfoMessage('Güncelleme başarısız: ' + (data.message || 'Hata oluştu'));
            }
        } catch (err) {
            setInfoMessage('Güncelleme işleminde hata oluştu: ' + err.message);
        }
    };

    const triggerDeleteDrawingFromPopup = () => {
        if (!selectedPointInfo || !selectedPointInfo.id) return;
        let drawingType = selectedPointInfo.type;
        if (drawingType === 'PointDrawing') drawingType = 'Point';
        if (drawingType === 'LineDrawing') drawingType = 'Line';
        if (drawingType === 'PolygonDrawing') drawingType = 'Polygon';

        setDeleteTarget({
            kind: 'drawing',
            drawingType: drawingType,
            id: selectedPointInfo.id,
            name: editName || selectedPointInfo.name
        });
    };

    // SİLME İŞLEMİNİ ONAYLAMA (SOFT DELETE)
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { kind, id, drawingType, name } = deleteTarget;
        setDeleteTarget(null);

        try {
            const endpointType = kind === 'place' ? 'point' : drawingType.toLowerCase();
            const response = await fetch(`http://localhost:5041/api/drawings/${endpointType}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setInfoMessage(`"${name}" kaydı başarıyla silindi.`);
                handleClosePointInfo();
                fetchDrawings();
            } else {
                setInfoMessage('Silme işleminde hata oluştu.');
            }
        } catch (err) {
            setInfoMessage('Silme işleminde hata oluştu: ' + err.message);
        }
    };

    // NOKTA MEKAN VE KOORDİNAT KAYDETME (tbl_point BİRLEŞİK MİMARİSİ)
    const handleSavePlace = async (e) => {
        e.preventDefault();
        setInfoMessage('');

        try {
            const lon = parseFloat(coords.lon);
            const lat = parseFloat(coords.lat);
            const wktString = `POINT(${lon} ${lat})`;

            const responsePoint = await fetch('http://localhost:5041/api/drawings/point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: placeName.trim() || 'Nokta Mekan Kaydı',
                    color: placeColor,
                    wkt: wktString
                })
            });

            const data = await responsePoint.json();

            if (responsePoint.ok) {
                setInfoMessage(data.message || 'Nokta veritabanına (tbl_point) başarıyla kaydedildi!');
                setPlaceName('');
                fetchDrawings();
            } else {
                setInfoMessage(data.message || 'Kayıt başarısız oldu.');
            }
        } catch (err) {
            setInfoMessage('Veri gönderilirken bir hata oluştu: ' + err.message);
        }
    };

    // KULLANICI KAYIT İŞLEMİ (REGISTER)
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setRegisterSuccessMsg('');
        setIsSubmittingRegister(true);

        try {
            const response = await fetch('http://localhost:5041/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, phone, password })
            });

            const data = await response.json();

            if (response.ok) {
                toastRef.current?.show({
                    severity: 'success',
                    summary: 'Kayıt Başarılı',
                    detail: data.message || t.registerSuccess,
                    life: 4000
                });
                setRegisterSuccessMsg(data.message || t.registerSuccess);
                setIsRegisterMode(false);
                setEmail('');
                setPhone('');
                setPassword('');
            } else {
                setError(data.message || t.registerFailed);
            }
        } catch (err) {
            setError('Kayıt oluşturulurken bağlantı hatası: ' + err.message);
        } finally {
            setIsSubmittingRegister(false);
        }
    };

    // LOGIN EKRANI
    if (!token || isLoggingIn) {
        return (
            <div className={`login-wrapper ${isLoggingIn ? 'is-logging-in' : ''}`}>
                <Toast ref={toastRef} />

                {/* Giriş Ekranı Sağ Alt Köşe Dil Seçim Butonu (Sadece Vektörel Bayrak) */}
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999 }}>
                    <button
                        type="button"
                        onClick={toggleLang}
                        title={t.languageSelect}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '24px',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            border: '1.5px solid rgba(255, 255, 255, 0.3)',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '700',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(8px)',
                            transition: 'transform 0.2s ease'
                        }}
                    >
                        {lang === 'tr' ? <><TurkeyFlag /> <span>TR</span></> : <><UKFlag /> <span>EN</span></>}
                    </button>
                </div>

                <div className="login-sidebar">
                    <div className="login-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="/logo.png" alt="GeoMap Logo" className="login-brand-logo-img" />
                        <div>
                            <h1 className="brand-title">Georaph.map</h1>
                            <p className="brand-subtitle">{isRegisterMode ? t.registerSubtitle : t.loginSubtitle}</p>
                        </div>
                    </div>

                    <div className="login-card">
                        <h2>{isRegisterMode ? t.registerTitle : t.loginTitle}</h2>
                        {registerSuccessMsg && <div className="success-msg">{registerSuccessMsg}</div>}
                        {error && <div className="error-msg">{error}</div>}

                        <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
                            <div className="input-group">
                                <label className="input-label">{t.usernameLabel}</label>
                                <input
                                    type="text"
                                    placeholder={t.usernamePlaceholder}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            {isRegisterMode && (
                                <>
                                    <div className="input-group">
                                        <label className="input-label">{t.emailLabel}</label>
                                        <input
                                            type="email"
                                            placeholder={t.emailPlaceholder}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">{t.phoneLabel}</label>
                                        <input
                                            type="tel"
                                            placeholder={t.phonePlaceholder}
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="input-group">
                                <label className="input-label">{t.passwordLabel}</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className="login-btn">
                                {isRegisterMode
                                    ? (isSubmittingRegister ? t.registering : t.registerButton)
                                    : (isLoggingIn ? t.loggingIn : t.loginButton)}
                            </button>
                        </form>

                        {!isRegisterMode && (
                            <div style={{ textAlign: 'center', marginTop: '14px' }}>
                                <button
                                    type="button"
                                    onClick={handleGuestLogin}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#38bdf8',
                                        fontSize: '13.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        opacity: 0.9,
                                        transition: 'all 0.2s ease',
                                        padding: '4px 8px'
                                    }}
                                    onMouseEnter={(e) => { e.target.style.opacity = '1'; e.target.style.textDecoration = 'underline'; }}
                                    onMouseLeave={(e) => { e.target.style.opacity = '0.9'; e.target.style.textDecoration = 'none'; }}
                                >
                                    Misafir Girişi (Viewer Modu)
                                </button>
                            </div>
                        )}

                        <div className="auth-toggle-wrapper" style={{ textAlign: 'center' }}>
                            <button
                                type="button"
                                className="btn-toggle-auth"
                                onClick={() => {
                                    setIsRegisterMode(!isRegisterMode);
                                    setError('');
                                    setRegisterSuccessMsg('');
                                }}
                            >
                                {isRegisterMode ? t.haveAccount : t.needAccount}
                            </button>
                        </div>
                    </div>

                    <div className="login-footer">
                        <span>&copy; {new Date().getFullYear()} Georaph.map. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
                    </div>
                </div>

                <div className="login-map-backdrop">
                    <svg className="map-vector" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="roadGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                            </linearGradient>
                            <linearGradient id="roadGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.3" />
                            </linearGradient>
                            <linearGradient id="lakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.1" />
                            </linearGradient>
                            <radialGradient id="pulseGlow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(96, 165, 250, 0.2)" strokeWidth="1" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#gridPattern)" />

                        <path d="M 250,-50 C 400,100 350,300 550,400 C 750,500 700,750 900,850 L 1050,850 L 1050,-50 Z" fill="url(#lakeGrad)" />

                        <path d="M -50,200 Q 200,150 450,320 T 950,250" fill="none" stroke="rgba(96, 165, 250, 0.35)" strokeWidth="2" strokeDasharray="6 6" />
                        <path d="M -50,400 Q 300,350 550,520 T 1050,450" fill="none" stroke="rgba(96, 165, 250, 0.25)" strokeWidth="2" strokeDasharray="8 8" />
                        <path d="M -50,600 Q 250,550 650,700 T 1050,650" fill="none" stroke="rgba(96, 165, 250, 0.2)" strokeWidth="1.5" />

                        <path d="M 100,850 C 200,600 300,450 500,300 C 650,180 800,100 1050,50" fill="none" stroke="url(#roadGrad1)" strokeWidth="5" strokeLinecap="round" />
                        <path d="M -50,350 C 250,380 400,200 600,150 C 750,110 850,-50 900,-50" fill="none" stroke="url(#roadGrad2)" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 350,850 C 450,650 500,500 750,400 C 880,350 980,300 1050,280" fill="none" stroke="url(#roadGrad1)" strokeWidth="3" strokeDasharray="12 6" />

                        <line x1="500" y1="300" x2="600" y2="150" stroke="rgba(96, 165, 250, 0.4)" strokeWidth="2" strokeDasharray="4 4" />
                        <line x1="300" y1="450" x2="450" y2="650" stroke="rgba(96, 165, 250, 0.4)" strokeWidth="2" strokeDasharray="4 4" />
                        <line x1="750" y1="400" x2="800" y2="100" stroke="rgba(96, 165, 250, 0.35)" strokeWidth="2" strokeDasharray="4 4" />

                        <g className="map-node node-1">
                            <circle cx="500" cy="300" r="30" fill="url(#pulseGlow)" className="pulse-ring" />
                            <circle cx="500" cy="300" r="7" fill="#60a5fa" />
                            <circle cx="500" cy="300" r="3" fill="#ffffff" />
                        </g>

                        <g className="map-node node-2">
                            <circle cx="600" cy="150" r="24" fill="url(#pulseGlow)" className="pulse-ring delay-1" />
                            <circle cx="600" cy="150" r="6" fill="#38bdf8" />
                            <circle cx="600" cy="150" r="2.5" fill="#ffffff" />
                        </g>

                        <g className="map-node node-3">
                            <circle cx="750" cy="400" r="32" fill="url(#pulseGlow)" className="pulse-ring delay-2" />
                            <circle cx="750" cy="400" r="8" fill="#3b82f6" />
                            <circle cx="750" cy="400" r="3.5" fill="#ffffff" />
                        </g>

                        <g className="map-node node-4">
                            <circle cx="300" cy="450" r="22" fill="url(#pulseGlow)" className="pulse-ring delay-3" />
                            <circle cx="300" cy="450" r="5" fill="#93c5fd" />
                        </g>
                    </svg>

                    <div className="map-overlay-vignette"></div>
                </div>
            </div>
        );
    }

    // HARİTA VE ANA UYGULAMA EKRANI
    return (
        <div className={`map-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <Toast ref={toastRef} />

            {/* ADMIN PANELİ TAM EKRAN KAPLAMA (OVERLAY) */}
            {currentView === 'admin' && isAdmin && userRole === 'Admin' && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}>
                    <AdminDashboard token={token} onBackToMap={() => {
                        setCurrentView('map');
                        setTimeout(() => {
                            mapRef.current?.updateSize();
                        }, 50);
                    }} />
                </div>
            )}

            {/* Sol Panel */}
            <div className={`map-sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
                {/* Sekmenin Dış Tarafına Monte Edilmiş Küçültme/Açma Tuşu */}
                <button
                    className="sidebar-close-btn-outside"
                    onClick={() => {
                        setIsSidebarOpen(!isSidebarOpen);
                        setTimeout(() => mapRef.current?.updateSize(), 300);
                    }}
                    title={isSidebarOpen ? t.closeSidebar : t.openSidebar}
                >
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {isSidebarOpen ? (
                            <polyline points="15 18 9 12 15 6" />
                        ) : (
                            <polyline points="9 18 15 12 9 6" />
                        )}
                    </svg>
                </button>

                <div className="map-sidebar-top">
                    {/* Marka Header */}
                    <div className="map-brand-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src="/logo.png" alt="GeoMap Logo" className="brand-logo-img" />
                            <h2 className="map-brand-title">Georaph.map</h2>
                        </div>
                        <div className="header-action-buttons">
                            {/* Tema (Karanlık / Aydınlık Mod) Butonu */}
                            <button
                                className="theme-toggle-btn"
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                title={isDarkMode ? t.lightMode : t.darkMode}
                            >
                                {isDarkMode ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Oturum Süresi Geri Sayım Rozeti (Admin için gizlenir) */}
                    {!isAdmin && userRole !== 'Admin' && (
                        <div className="session-timer-badge">
                            <div className="timer-label">
                                <span className="live-dot"></span>
                                <span>{t.sessionTime}</span>
                            </div>
                            <strong>{formatTime(timeLeft)}</strong>
                        </div>
                    )}

                    <div className="sidebar-divider"></div>

                    {/* Mekan Ekleme Formu */}
                    {userRole === 'Viewer' ? (
                        <div className="add-place-section">
                            <h3 className="section-title">İzleyici Modu</h3>
                            <div style={{ padding: '12px', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '12.5px', lineHeight: '1.5' }}>
                                <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '4px' }}>Salt-Okunur Erişim</strong>
                                İzleyici rolündeyiz. Çizim yapma yetkisi bulunmamaktadır. Editörler tarafından çizilen nesneleri haritada inceleyebilirsiniz.
                            </div>
                        </div>
                    ) : (
                        <div className="add-place-section">
                            <h3 className="section-title">{t.addPlaceTitle}</h3>
                            <p className="section-subtitle">
                                {t.addPlaceSubtitle}
                            </p>

                            <form onSubmit={handleSavePlace} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">{t.placeNameLabel}</label>
                                    <input
                                        type="text"
                                        value={placeName}
                                        onChange={(e) => setPlaceName(e.target.value)}
                                        placeholder={t.placeNamePlaceholder}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="input-label">{t.longitudeLabel}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={coords.lon}
                                            onChange={(e) => setCoords(prev => ({ ...prev, lon: e.target.value }))}
                                            placeholder={t.longitudePlaceholder}
                                            required
                                        />
                                    </div>

                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="input-label">{t.latitudeLabel}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={coords.lat}
                                            onChange={(e) => setCoords(prev => ({ ...prev, lat: e.target.value }))}
                                            placeholder={t.latitudePlaceholder}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">
                                        {t.colorPaletteLabel}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#ffffff', padding: '5px 7px', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1', boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                                        <button
                                            type="button"
                                            className="palette-icon-btn"
                                            onClick={() => {
                                                if (placeColorInputRef.current?.showPicker) {
                                                    placeColorInputRef.current.showPicker();
                                                } else {
                                                    placeColorInputRef.current?.click();
                                                }
                                            }}
                                            title="Renk Paletini Aç (Color Picker)"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '28px',
                                                height: '26px',
                                                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                                border: '1.5px solid #3b82f6',
                                                borderRadius: '5px',
                                                cursor: 'pointer',
                                                color: '#3b82f6',
                                                boxShadow: 'none',
                                                transition: 'transform 0.15s ease',
                                                flexShrink: 0
                                            }}
                                        >
                                            <DetailedPaletteIcon size={16} />
                                        </button>

                                        <input
                                            ref={placeColorInputRef}
                                            type="color"
                                            value={placeColor}
                                            onChange={(e) => setPlaceColor(e.target.value)}
                                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                        />

                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    type="button"
                                                    key={c.hex}
                                                    onClick={() => setPlaceColor(c.hex)}
                                                    style={{
                                                        width: '15px',
                                                        height: '15px',
                                                        borderRadius: '50%',
                                                        backgroundColor: c.hex,
                                                        border: placeColor === c.hex ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0f172a') : (isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.25)'),
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    title={`${c.label} (${c.hex})`}
                                                />
                                            ))}
                                        </div>

                                        {/* SAĞ TARAFTA KÜÇÜK RENK GÖSTERGE PENCERESİ (TAŞMAZ UYUMLU) */}
                                        <div
                                            title={`Seçili Nokta Rengi: ${placeColor}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '2px 5px',
                                                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                border: `1.5px solid ${placeColor}`,
                                                borderRadius: '5px',
                                                marginLeft: 'auto',
                                                flexShrink: 0
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: placeColor,
                                                    display: 'inline-block',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: isDarkMode ? '#f8fafc' : '#0f172a', fontFamily: 'monospace' }}>
                                                {placeColor.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="map-btn btn-save" style={{ height: '36px', padding: '0 12px', fontSize: '13px', borderRadius: '7px' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    {t.saveLocationBtn}
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="sidebar-divider"></div>

                    {/* KAYITLI KONUMLAR VE ÇİZİMLER LİSTESİ */}
                    <div className="saved-places-section">
                        <div className="section-header">
                            <h3 className="section-title">{t.savedPlacesTitle}</h3>
                            <span className="places-count-badge">{filteredDrawings.length} {t.recordsBadge}</span>
                        </div>

                        {filteredDrawings.length === 0 ? (
                            <p className="no-places-msg">{t.noRecordsMsg}</p>
                        ) : (
                            <div className="saved-places-list">

                                {/* Kayıtlı Çizimler */}
                                {filteredDrawings.map((drawing) => (
                                    <div
                                        key={`drawing-${drawing.type}-${drawing.id}`}
                                        className="saved-place-item"
                                        onClick={() => handleSelectDrawing(drawing, false)}
                                    >
                                        <div className="place-item-icon">
                                            {drawing.type === 'Point' ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <circle cx="12" cy="12" r="7.5" fill={drawing.color || "#3b82f6"} stroke={drawing.color === '#ffffff' || drawing.color?.toLowerCase() === '#fff' ? '#94a3b8' : '#ffffff'} strokeWidth="1.5" />
                                                </svg>
                                            ) : drawing.type === 'Line' ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#3b82f6"} strokeWidth="3.5" strokeLinecap="round">
                                                    <path d="M4 20L20 4" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#10b981"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 22 8.5 18 19 6 19 2 8.5" fill={hexToRgba(drawing.color || '#10b981', 0.6)} />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="place-item-info" style={{ flex: 1 }}>
                                            <span className="place-item-name">{drawing.name}</span>
                                            <span className="place-item-coords">
                                                {drawing.type === 'Line' ? t.lineTypeLabel : drawing.type === 'Polygon' ? t.polygonTypeLabel : t.pointTypeLabel}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn-info-drawing"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectDrawing(drawing, true);
                                            }}
                                            title={t.btnInfoTooltip || "Bilgisini Göster"}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </svg>
                                        </button>

                                        {userRole !== 'Viewer' && canEditDrawing(drawing) && (
                                            <button
                                                className="btn-delete-drawing"
                                                onClick={(e) => triggerDeleteDrawing(drawing, e)}
                                                title="Çizimi Sil"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Kayıtlı POI'ler (Points of Interest) */}
                                {pois.map((poi) => (
                                    <div
                                        key={`poi-${poi.id}`}
                                        className="saved-place-item"
                                        onClick={() => {
                                            if (mapRef.current && poi.longitude && poi.latitude) {
                                                mapRef.current.getView().animate({
                                                    center: fromLonLat([poi.longitude, poi.latitude]),
                                                    zoom: 15,
                                                    duration: 800
                                                });
                                            }
                                            setSelectedPoiInfo(poi);
                                        }}
                                    >
                                        <div className="place-item-icon" style={{ color: poi.categoryColor || '#3b82f6' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                        </div>
                                        <div className="place-item-info" style={{ flex: 1 }}>
                                            <span className="place-item-name">{poi.name}</span>
                                            <span className="place-item-coords" style={{ color: poi.categoryColor || '#3b82f6', fontWeight: 600 }}>
                                                {poi.parentCategoryName ? `${poi.parentCategoryName} → ` : ''}{poi.categoryName}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn-info-drawing"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPoiInfo(poi);
                                            }}
                                            title="POI Detaylarını Göster"
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </svg>
                                        </button>

                                        {(isAdmin || poi.userId === loggedInUserId) && (
                                            <button
                                                className="btn-delete-drawing"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePoiFromMap(poi.id, poi.name);
                                                }}
                                                title="POI'yi Sil"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="map-sidebar-bottom">
                    {/* GİRİŞ YAPAN KULLANICI PROFİL KUTUSU */}
                    {token && (
                        <div className="user-profile-badge-box">
                            <div className="user-profile-avatar">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <div className="user-profile-details">
                                <span className="user-profile-username" title={loggedInUsername || 'Kullanıcı'}>
                                    {loggedInUsername || 'Kullanıcı'}
                                </span>
                                <span className={`user-profile-role-tag ${userRole?.toLowerCase()}`}>
                                    {userRole || 'Viewer'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ALT EYLEM BUTONLARI (ÇIKIŞ, ADMİN/İŞBİRLİĞİ, DİL) */}
                    <div className="map-sidebar-bottom-actions">
                        {/* Küçültülmüş Çıkış Yap Butonu */}
                        <button onClick={() => handleLogout()} className="btn-logout-compact" title={t.logout}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>{t.logout}</span>
                        </button>

                        {/* Admin Paneli Butonu (Çıkış Yap ile Dil Seçeneği Arasında) */}
                        {isAdmin && (
                            <button
                                className="btn-admin-sidebar-compact"
                                onClick={() => setCurrentView('admin')}
                                title="Admin Paneli"
                            >
                                <span>Admin</span>
                            </button>
                        )}

                        {/* Editör İşbirliği Butonu (Admin Butonunun Yerinde - Editörler İçin) */}
                        {!isAdmin && userRole === 'Editor' && (
                            <button
                                className="btn-admin-sidebar-compact btn-collab-header"
                                onClick={() => {
                                    fetchCollaborations();
                                    setShowCollaborationModal(true);
                                }}
                                title="Editör İşbirliği & İstekler"
                                style={{
                                    position: 'relative',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <span>{t.collaborationShortBtn}</span>
                                {pendingIncoming.length > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        backgroundColor: '#ef4444',
                                        color: '#ffffff',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid #ffffff',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                    }}>
                                        {pendingIncoming.length}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Dil Seçim Butonu */}
                        <button
                            className="theme-toggle-btn lang-toggle-btn"
                            onClick={toggleLang}
                            title={t.languageSelect}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '38px',
                                height: '38px',
                                padding: 0,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                flexShrink: 0
                            }}
                        >
                            {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                        </button>
                    </div>
                </div>
            </div>

            {/* GOOGLE MAPS TARZI POI VE MEKAN ARAMA BARI (TÜM ROLLERE AÇIK) */}
            <div
                ref={poiSearchContainerRef}
                className="poi-search-floating-wrapper"
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: isSidebarOpen ? '430px' : '86px',
                    zIndex: 1004,
                    transition: 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: '380px',
                    maxWidth: 'calc(100vw - 120px)'
                }}
            >
                <div className={`poi-search-box ${isPoiSearchFocused ? 'focused' : ''}`}>
                    <div className="poi-search-icon-left">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>

                    <input
                        type="text"
                        className="poi-search-input"
                        placeholder="POI veya mekan ara (Örn: Kafe, Hastane, Park)..."
                        value={poiSearchQuery}
                        onChange={(e) => {
                            setPoiSearchQuery(e.target.value);
                            setIsPoiSearchFocused(true);
                        }}
                        onFocus={() => setIsPoiSearchFocused(true)}
                    />

                    {poiSearchQuery && (
                        <button
                            type="button"
                            className="poi-search-clear-btn"
                            onClick={() => {
                                setPoiSearchQuery('');
                                setSelectedSearchCatFilter('ALL');
                            }}
                            title="Aramayı Temizle"
                        >
                            &times;
                        </button>
                    )}

                    <div className="poi-search-badge-count">
                        {filteredSearchResults.length > 0 ? `${filteredSearchResults.length} POI` : (pois.length > 0 ? `${pois.length} POI` : '')}
                    </div>
                </div>

                {/* ARAMA SONUÇLARI AÇILIR LİSTESİ */}
                {isPoiSearchFocused && (
                    <div className="poi-search-dropdown-menu">
                        {/* KATEGORİ HIZLI FİLTRELEME ÇİPLERİ */}
                        {poiCategories.length > 0 && (
                            <div className="poi-search-category-chips">
                                <button
                                    type="button"
                                    className={`poi-cat-chip ${selectedSearchCatFilter === 'ALL' ? 'active' : ''}`}
                                    onClick={() => setSelectedSearchCatFilter('ALL')}
                                >
                                    Tümü ({pois.length})
                                </button>
                                {poiCategories.filter(c => !c.parentId).map(cat => {
                                    const count = pois.filter(p => p.categoryId === cat.id).length;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`poi-cat-chip ${selectedSearchCatFilter === String(cat.id) ? 'active' : ''}`}
                                            onClick={() => setSelectedSearchCatFilter(String(cat.id))}
                                            style={{
                                                borderColor: selectedSearchCatFilter === String(cat.id) ? cat.color : undefined
                                            }}
                                        >
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color || '#3b82f6', display: 'inline-block', marginRight: '4px' }} />
                                            {cat.name} ({count})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* SONUÇ LİSTESİ */}
                        <div className="poi-search-results-list">
                            {filteredSearchResults.length > 0 ? (
                                filteredSearchResults.map(poi => {
                                    const catColor = poi.categoryColor || '#3b82f6';
                                    const isPolygon = (poi.wkt || '').toUpperCase().includes('POLYGON');
                                    return (
                                        <div
                                            key={poi.id}
                                            className="poi-search-result-item"
                                            onClick={() => handleZoomToSearchResultPoi(poi)}
                                        >
                                            <div
                                                className="poi-result-icon-circle"
                                                style={{ border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                dangerouslySetInnerHTML={{
                                                    __html: getPoiCategoryBadgeSvg(poi.categoryName || '', poi.categoryIcon || '', catColor)
                                                }}
                                            />

                                            <div className="poi-result-info">
                                                <div className="poi-result-title-row">
                                                    <span className="poi-result-name">{poi.name}</span>
                                                    <span className="poi-result-cat-badge" style={{ backgroundColor: hexToRgba(catColor, 0.2), color: catColor, borderColor: hexToRgba(catColor, 0.3) }}>
                                                        {poi.categoryName || 'Genel'}
                                                    </span>
                                                </div>
                                                {poi.description && (
                                                    <div className="poi-result-desc">{poi.description}</div>
                                                )}
                                                {poi.workingHours && (
                                                    <div className="poi-result-hours">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '4px' }}>
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        {poi.workingHours}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="poi-result-arrow">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="poi-search-empty-state">
                                    {poiSearchQuery ? (
                                        <>
                                            <p style={{ margin: 0, fontWeight: 600, color: '#f87171' }}>Sonuç bulunamadı</p>
                                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>"{poiSearchQuery}" ile eşleşen POI kaydı yok.</span>
                                        </>
                                    ) : (
                                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Aramak istediğiniz mekan veya POI adını yazın.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* HARİTA FİLTRELEME YÜZER PANELİ */}
            {showFilterPanel && (
                <div
                    className="map-filter-panel-floating"
                    style={{
                        position: 'absolute',
                        top: '128px',
                        right: '76px',
                        width: '280px',
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        border: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                        zIndex: 1005,
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            Harita Filtreleme
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowFilterPanel(false)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', lineHeight: 1 }}
                        >
                            &times;
                        </button>
                    </div>

                    {/* 1. ŞEKİL TÜRÜ FİLTRESİ */}
                    <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            Şekil Türüne Göre
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                            {[
                                { id: 'ALL', label: 'Tümü' },
                                { id: 'Point', label: 'Nokta' },
                                { id: 'Line', label: 'Çizgi' },
                                { id: 'Polygon', label: 'Poligon' }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedTypeFilter(item.id)}
                                    style={{
                                        padding: '5px 0',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: selectedTypeFilter === item.id ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                        backgroundColor: selectedTypeFilter === item.id ? '#2563eb' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                                        color: selectedTypeFilter === item.id ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                        cursor: 'pointer'
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. EDİTÖR / KULLANICI FİLTRESİ */}
                    <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            Editöre / Kullanıcıya Göre
                        </label>
                        <select
                            value={selectedEditorFilter}
                            onChange={(e) => setSelectedEditorFilter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                border: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                                color: isDarkMode ? '#f8fafc' : '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL">Tüm Editörler / Kullanıcılar</option>
                            {Array.from(new Set(savedDrawings.map(d => d.insertedUsername || (d.insertedUserId === 1 ? 'asdf.admin' : `Kullanıcı #${d.insertedUserId}`))))
                                .filter(Boolean)
                                .map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* TEMİZLEME BUTONU */}
                    {(selectedTypeFilter !== 'ALL' || selectedEditorFilter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTypeFilter('ALL');
                                setSelectedEditorFilter('ALL');
                            }}
                            style={{
                                padding: '6px',
                                fontSize: '11px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid #ef4444',
                                color: '#f87171',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginTop: '4px'
                            }}
                        >
                            Filtreleri Temizle
                        </button>
                    )}
                </div>
            )}

            {/* HARİTA ÜZERİNDEKİ ÇİZİM & ANALİZ & KATMAN & FİLTRE ARAÇ ÇUBUĞU (SAĞ ÜST) */}
            <div className="map-draw-toolbar-floating">
                {/* HARİTA KATMANLARI SEÇİCİ (GOOGLE UYDU, SİYASİ, ARAZİ, GECE MODU) */}
                <MapLayerSwitcher
                    selectedLayerId={selectedBaseLayer}
                    onSelectLayer={handleSelectBaseLayer}
                    direction="left"
                />

                {/* HARİTA KATMAN FİLTRELEME BUTONU (KATMAN BUTONUNUN HEMEN ALTINDA) */}
                <button
                    className={`map-tool-icon-btn ${showFilterPanel ? 'active' : ''}`}
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    title="Harita Çizim Filtresi"
                    data-tooltip="Filtreleme Menüsü"
                    style={{ position: 'relative' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    {(selectedTypeFilter !== 'ALL' || selectedEditorFilter !== 'ALL') && (
                        <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '1.5px solid #ffffff' }} />
                    )}
                </button>

                {userRole !== 'Viewer' && (
                    <>
                        <div className="map-draw-toolbar-divider" />

                        {/* POI NOKTASI EKLEME ARACI (Point - Operatör & Admin) */}
                        <button
                            className={`map-tool-icon-btn poi-tool-btn ${drawType === 'Poi' ? 'active' : ''}`}
                            onClick={() => {
                                if (drawType === 'Poi') handleCancelDraw();
                                else {
                                    setDrawType('Poi');
                                    setInfoMessage('POI eklemek istediğiniz konuma harita üzerinde tıklayınız.');
                                }
                            }}
                            title="POI Noktası Ekle (Point)"
                            data-tooltip="POI Noktası Ekle"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                        </button>

                        {/* ÇİZGİ ÇİZİM ARACI */}
                        <button
                            className={`map-tool-icon-btn ${drawType === 'LineString' ? 'active' : ''}`}
                            onClick={() => {
                                if (drawType === 'LineString') handleCancelDraw();
                                else setDrawType('LineString');
                            }}
                            title={t.toolLineTitle}
                            data-tooltip={t.drawingLineMode}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 20L20 4" />
                                <circle cx="4" cy="20" r="2.5" fill="currentColor" />
                                <circle cx="20" cy="4" r="2.5" fill="currentColor" />
                            </svg>
                        </button>

                        {/* POLİGON ÇİZİM ARACI */}
                        <button
                            className={`map-tool-icon-btn ${drawType === 'Polygon' ? 'active' : ''}`}
                            onClick={() => {
                                if (drawType === 'Polygon') handleCancelDraw();
                                else setDrawType('Polygon');
                            }}
                            title={t.toolPolygonTitle}
                            data-tooltip={t.drawingPolygonMode}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                            </svg>
                        </button>

                        {/* GEÇİCİ ENVANTER ANALİZİ ARACI */}
                        <button
                            className={`map-tool-icon-btn analysis-tool-btn ${drawType === 'Analysis' ? 'active' : ''}`}
                            onClick={() => {
                                if (drawType === 'Analysis') handleCancelDraw();
                                else {
                                    setDrawType('Analysis');
                                }
                            }}
                            title={t.toolAnalysisTitle}
                            data-tooltip={t.toolAnalysisTitle}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                <polygon points="10 8 13 11 11 14 8 12" />
                            </svg>
                        </button>
                    </>
                )}

                {/* ISI HARİTASI (HEATMAP) ANALİZİ BUTONU */}
                <button
                    className={`map-tool-icon-btn heatmap-tool-btn ${isHeatmapActive ? 'active' : ''}`}
                    onClick={() => setIsHeatmapActive(!isHeatmapActive)}
                    title="Isı Haritası Analizi (Nokta Yoğunluğu)"
                    data-tooltip="Isı Haritası"
                    style={{
                        background: isHeatmapActive ? '#f97316' : undefined,
                        color: isHeatmapActive ? '#ffffff' : undefined,
                        border: isHeatmapActive ? '1.5px solid #fdba74' : undefined,
                        boxShadow: isHeatmapActive ? '0 0 12px rgba(249, 115, 22, 0.5)' : undefined
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                </button>
            </div>

            {/* SADE VE NET YÜZER ÇİZİM BARI */}
            {drawType !== 'None' && drawType !== 'Analysis' && drawType !== 'Poi' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDblClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 18px', minWidth: '400px' }}
                >
                    <div className="floating-draw-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="drawing-mode-badge">
                            {drawType === 'Point' && t.drawingPointMode}
                            {drawType === 'LineString' && t.drawingLineMode}
                            {drawType === 'Polygon' && t.drawingPolygonMode}
                        </span>
                        <span className="floating-hint">
                            {draftWkt ? (
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>{t.drawingCompleted}</span>
                            ) : t.drawingInProgress}
                        </span>
                    </div>

                    <div className="floating-draw-form" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="floating-input"
                                style={{ flex: 1 }}
                                value={drawingName}
                                onChange={(e) => setDrawingName(e.target.value)}
                                placeholder={t.drawingNamePlaceholder}
                            />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '4px 6px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', flexWrap: 'nowrap' }}>
                                <button
                                    type="button"
                                    className="palette-icon-btn"
                                    onClick={() => {
                                        if (drawColorInputRef.current?.showPicker) {
                                            drawColorInputRef.current.showPicker();
                                        } else {
                                            drawColorInputRef.current?.click();
                                        }
                                    }}
                                    title="Color Picker"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '26px',
                                        backgroundColor: '#1e293b',
                                        border: '1.5px solid #3b82f6',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        color: '#3b82f6',
                                        boxShadow: 'none',
                                        transition: 'transform 0.15s ease',
                                        flexShrink: 0
                                    }}
                                >
                                    <DetailedPaletteIcon size={16} />
                                </button>

                                <input
                                    ref={drawColorInputRef}
                                    type="color"
                                    value={drawingColor}
                                    onChange={(e) => setDrawingColor(e.target.value)}
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                />
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            type="button"
                                            key={c.hex}
                                            onClick={() => setDrawingColor(c.hex)}
                                            style={{
                                                width: '15px',
                                                height: '15px',
                                                borderRadius: '50%',
                                                backgroundColor: c.hex,
                                                border: drawingColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                                cursor: 'pointer'
                                            }}
                                            title={`${c.label} (${c.hex})`}
                                        />
                                    ))}
                                </div>

                                {/* SAĞ TARAFTA KÜÇÜK RENK GÖSTERGE PENCERESİ */}
                                <div
                                    title={`Seçili Çizim Rengi: ${drawingColor}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 5px',
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        border: `1.5px solid ${drawingColor}`,
                                        borderRadius: '5px',
                                        marginLeft: 'auto',
                                        flexShrink: 0
                                    }}
                                >
                                    <span
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: drawingColor,
                                            display: 'inline-block',
                                            flexShrink: 0
                                        }}
                                    />
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                                        {drawingColor.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="floating-btn-group" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                className="floating-action-btn btn-save-draw"
                                onClick={handleSaveDrawingFromFloatingBox}
                                style={{ backgroundColor: drawingColor, borderColor: drawingColor }}
                            >
                                {t.btnSaveToDb}
                            </button>
                            <button
                                className="floating-action-btn btn-cancel-draw-bar"
                                onClick={handleCancelDraw}
                            >
                                {t.btnCancelDraw}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ŞIK VE BEYAZ METİNLİ KESİŞME KONTROLÜ BARI */}
            {drawType === 'Analysis' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', borderRadius: '10px' }}
                >
                    <span className="drawing-mode-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '6px 12px', borderRadius: '6px', boxShadow: 'none' }}>
                        {t.intersectionCheckBadge}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>
                        {isAnalyzing ? t.intersectionCheckAnalyzing : t.intersectionCheckHint}
                    </span>
                    <button
                        className="floating-action-btn btn-cancel-draw-bar"
                        onClick={handleCancelDraw}
                        style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
                    >
                        {t.btnCancelDraw}
                    </button>
                </div>
            )}

            {/* POI ÇİZİM VE DİNAMİK ALAN (POLİGON) BARI */}
            {drawType === 'Poi' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #3b82f6',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff'
                    }}
                >
                    <span className="drawing-mode-badge" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}>
                        POI MODU
                    </span>

                    {/* Nokta / Poligon Modu Seçimi */}
                    <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '7px', padding: '2px', gap: '3px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setPoiDrawGeometryType('Point');
                                if (draftPoiData && draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                            }}
                            style={{
                                padding: '5px 11px',
                                fontSize: '12px',
                                fontWeight: poiDrawGeometryType === 'Point' ? 700 : 500,
                                borderRadius: '5px',
                                border: 'none',
                                backgroundColor: poiDrawGeometryType === 'Point' ? '#3b82f6' : 'transparent',
                                color: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Nokta POI
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPoiDrawGeometryType('Polygon');
                                if (draftPoiData && draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                            }}
                            style={{
                                padding: '5px 11px',
                                fontSize: '12px',
                                fontWeight: poiDrawGeometryType === 'Polygon' ? 700 : 500,
                                borderRadius: '5px',
                                border: 'none',
                                backgroundColor: poiDrawGeometryType === 'Polygon' ? '#3b82f6' : 'transparent',
                                color: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Poligon POI (Shift)
                        </button>
                    </div>

                    {/* Çizim Durumu Metni */}
                    <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>
                        {draftPoiData ? (
                            draftPoiData.isPolygon ? (
                                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                                    Poligon Çizildi ({draftPoiData.area >= 1000000 ? (draftPoiData.area / 1000000).toFixed(2) + ' km²' : Math.round(draftPoiData.area).toLocaleString() + ' m²'})
                                </span>
                            ) : (
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    Nokta Seçildi ({draftPoiData.lat?.toFixed(4)}°, {draftPoiData.lon?.toFixed(4)}°)
                                </span>
                            )
                        ) : (
                            poiDrawGeometryType === 'Point'
                                ? 'Haritada tek tıkla nokta belirleyin (veya SHIFT ile alana geçin).'
                                : 'Haritada köşe noktalarını tıklayarak poligon çizin (Bitirmek için çift tıklayın).'
                        )}
                    </span>

                    {/* KAYDET BUTONU (POI Bilgi Giriş Ekranını Açar) */}
                    <button
                        type="button"
                        onClick={handleOpenPoiModalWithDraft}
                        disabled={!draftPoiData}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 15px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            borderRadius: '7px',
                            backgroundColor: draftPoiData ? '#16a34a' : 'rgba(255,255,255,0.1)',
                            color: draftPoiData ? '#ffffff' : '#64748b',
                            border: 'none',
                            cursor: draftPoiData ? 'pointer' : 'not-allowed',
                            boxShadow: draftPoiData ? '0 0 12px rgba(22, 163, 74, 0.5)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                        title={draftPoiData ? 'POI Bilgi Giriş Ekranını Aç' : 'Lütfen önce haritada bir nokta veya poligon çizin'}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        <span>Kaydet</span>
                    </button>

                    {draftPoiData && (
                        <button
                            type="button"
                            onClick={() => {
                                if (draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                            }}
                            style={{
                                padding: '6px 11px',
                                fontSize: '11.5px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                color: '#cbd5e1',
                                border: '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer'
                            }}
                            title="Çizimi sıfırla ve yeniden çiz"
                        >
                            Yeniden Çiz
                        </button>
                    )}

                    <button
                        className="floating-action-btn btn-cancel-draw-bar"
                        onClick={() => {
                            if (draftFeatureRef.current && drawingsSourceRef.current) {
                                try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                draftFeatureRef.current = null;
                            }
                            setDraftPoiData(null);
                            handleCancelDraw();
                        }}
                        style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
                    >
                        {t.btnCancelDraw}
                    </button>
                </div>
            )}

            {/* ŞEKİL DÜZENLEME MODU ALT YÜZER EYLEM BARI */}
            {isModifyingVertex && (
                <div
                    className="floating-draw-bottom-bar vertex-editing-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #22c55e',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: '#22c55e', color: '#ffffff', fontWeight: 700, fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}>
                            DÜZENLEME MODU AKTİF
                        </span>
                        <span style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 500 }}>
                            Haritadaki kırılma noktalarını fare ile sürükleyebilirsiniz.
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                        <button
                            type="button"
                            onClick={handleUndoGeometry}
                            disabled={historyIndex <= 0}
                            title="Geri Al (Undo)"
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                backgroundColor: historyIndex <= 0 ? 'rgba(255,255,255,0.05)' : '#1e293b',
                                color: historyIndex <= 0 ? '#64748b' : '#38bdf8',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ↩ Geri Al
                        </button>

                        <button
                            type="button"
                            onClick={handleRedoGeometry}
                            disabled={historyIndex >= geometryHistoryRef.current.length - 1}
                            title="İleri Al (Redo)"
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                backgroundColor: historyIndex >= geometryHistoryRef.current.length - 1 ? 'rgba(255,255,255,0.05)' : '#1e293b',
                                color: historyIndex >= geometryHistoryRef.current.length - 1 ? '#64748b' : '#38bdf8',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: historyIndex >= geometryHistoryRef.current.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ↪ İleri Al
                        </button>

                        <button
                            type="button"
                            onClick={handleUpdateDrawingFromPopup}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            Kaydet
                        </button>

                        <button
                            type="button"
                            onClick={handleTriggerCancelVertexEditing}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            Vazgeç
                        </button>
                    </div>
                </div>
            )}

            {/* KESİŞİM VE ENVANTER ANALİZ SONUÇ PANELLERİ */}
            {analysisResult && (
                <div className="analysis-result-card-floating">
                    <div className="analysis-card-header">
                        <div className="analysis-header-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                            <h3>{t.analysisReportTitle}</h3>
                        </div>
                        <button className="btn-close-analysis" onClick={handleClearAnalysis} title={t.clearAnalysisBtn}>
                            &times;
                        </button>
                    </div>

                    <div className="analysis-card-body">
                        <div className="analysis-total-badge">
                            <span className="total-number">{analysisResult.totalIntersectedCount ?? 0}</span>
                            <span className="total-label">{t.totalIntersectedLabel}</span>
                        </div>

                        <div className="analysis-breakdown-grid">
                            <div className="breakdown-item">
                                <span className="item-count">{(analysisResult.pointsCount || 0) + (analysisResult.placesCount || 0)}</span>
                                <span className="item-type">{t.pointLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.linesCount ?? 0}</span>
                                <span className="item-type">{t.lineLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.polygonsCount ?? 0}</span>
                                <span className="item-type">{t.polygonLayerLabel}</span>
                            </div>
                        </div>

                        {Array.isArray(analysisResult.details) && analysisResult.details.length > 0 && (
                            <div className="analysis-details-list">
                                <h4>Kesişen Nesne Detayları:</h4>
                                <ul>
                                    {analysisResult.details.map((item, idx) => (
                                        <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="analysis-card-footer">
                        <button className="btn-clear-analysis-action" onClick={handleClearAnalysis}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Analizi ve Haritayı Temizle
                        </button>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (SİLME ONAYI) */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge warning">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Silme İşlemini Onaylayın</h3>
                        <p className="modal-description">
                            <strong>"{deleteTarget.name}"</strong> kaydını silmek üzeresiniz. Bu işlem haritadan kaldırılacaktır. Devam etmek istiyor musunuz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setDeleteTarget(null)}>
                                İptal (Vazgeç)
                            </button>
                            <button className="modal-btn btn-danger-confirm" onClick={confirmDelete}>
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITÖR İŞBİRLİĞİ & İSTEKLER MODAL */}
            {showCollaborationModal && (
                <div className="modal-overlay" onClick={() => setShowCollaborationModal(false)}>
                    <div
                        className="collab-modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '90%',
                            maxWidth: '560px',
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '24px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{t.collaborationTitle}</h3>
                            </div>
                            <button
                                onClick={() => setShowCollaborationModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* İŞBİRLİĞİ İSTEĞİ GÖNDER FORMU */}
                        <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: isDarkMode ? 'rgba(30,41,59,0.7)' : '#f8fafc', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13.5px', color: '#3b82f6', fontWeight: 700 }}>{t.sendRequestBtn}</h4>
                            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                {lang === 'tr'
                                    ? '🤝 İşbirliği onaylandığında editörlerin coğrafi yetki alanları otomatik olarak birleşir (Union). Birbirinizin şekillerini görüntüleyebilir ve düzenleyebilirsiniz. İşbirliği iptal edildiğinde yetki alanları tekrar ayrılır.'
                                    : '🤝 Once collaboration is approved, spatial boundaries are automatically merged (Union). When cancelled, boundaries separate back.'}
                            </p>

                            <form onSubmit={handleSendCollaborationRequest} style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    value={selectedEditorId}
                                    onChange={(e) => setSelectedEditorId(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        borderRadius: '7px',
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        fontSize: '13px'
                                    }}
                                    required
                                >
                                    <option value="">-- {lang === 'tr' ? 'Editör Seçin' : 'Select Editor'} --</option>
                                    {availableEditors.map((ed) => (
                                        <option key={ed.id} value={ed.id}>
                                            {ed.username} ({ed.email || 'Editor'})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    disabled={collabLoading || !selectedEditorId}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '7px',
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        cursor: collabLoading ? 'wait' : 'pointer'
                                    }}
                                >
                                    {t.sendRequestBtn}
                                </button>
                            </form>
                        </div>

                        {/* GELEN İSTEKLER */}
                        {pendingIncoming.length > 0 && (
                            <div style={{ marginBottom: '18px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#f59e0b', fontWeight: 700 }}>
                                    {lang === 'tr' ? 'Onay Bekleyen Gelen İstekler' : 'Pending Incoming Requests'} ({pendingIncoming.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                                    {pendingIncoming.map((req) => (
                                        <div
                                            key={req.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                                borderRadius: '8px'
                                            }}
                                        >
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                                <strong>{req.senderUsername}</strong> {lang === 'tr' ? 'sizden çizim işbirliği istiyor.' : 'wants to collaborate on map drawings.'}
                                            </span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondCollaborationRequest(req.id, true)}
                                                    style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '5px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    {t.acceptBtn}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondCollaborationRequest(req.id, false)}
                                                    style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '5px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    {t.declineBtn}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TÜM İSTEKLER VE AKTİF İŞBİRLİKLERİ LİSTESİ */}
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 700 }}>
                                {lang === 'tr' ? 'Tüm İşbirliği İstekleri ve Durumları' : 'All Collaboration Requests & Statuses'}
                            </h4>
                            {collaborationRequests.length === 0 ? (
                                <p style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                                    {lang === 'tr' ? 'Henüz gönderilmiş veya alınmış bir işbirliği isteği bulunmuyor.' : 'No sent or received collaboration requests yet.'}
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                    {collaborationRequests.map((r) => {
                                        const isSender = r.senderUserId === loggedInUserId;
                                        const otherUser = isSender ? r.receiverUsername : r.senderUsername;
                                        return (
                                            <div
                                                key={r.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '8px 12px',
                                                    backgroundColor: isDarkMode ? 'rgba(30,41,59,0.5)' : '#f1f5f9',
                                                    borderRadius: '7px',
                                                    fontSize: '12.5px'
                                                }}
                                            >
                                                <div>
                                                    <strong>{otherUser}</strong> ({isSender ? (lang === 'tr' ? 'Gönderilen' : 'Sent') : (lang === 'tr' ? 'Gelen' : 'Received')})
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span
                                                        style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            backgroundColor: r.status === 'Approved' ? '#16a34a' : r.status === 'Rejected' ? '#ef4444' : '#f59e0b',
                                                            color: '#ffffff'
                                                        }}
                                                    >
                                                        {r.status === 'Approved'
                                                            ? (lang === 'tr' ? 'Aktif İşbirliği' : 'Active Collaboration')
                                                            : r.status === 'Rejected'
                                                                ? (lang === 'tr' ? 'Reddedildi' : 'Rejected')
                                                                : (lang === 'tr' ? 'Onay Bekliyor' : 'Pending')}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleCancelCollaboration(r.id)}
                                                        title={lang === 'tr' ? 'İşbirliğini / İsteği İptal Et (Sil)' : 'Cancel / Remove Collaboration'}
                                                        style={{
                                                            padding: '3px 8px',
                                                            fontSize: '11px',
                                                            borderRadius: '5px',
                                                            backgroundColor: 'rgba(239, 68, 68, 0.18)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {lang === 'tr' ? 'İptal Et' : 'Cancel'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <button
                                type="button"
                                onClick={() => setShowCollaborationModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '7px', backgroundColor: '#64748b', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '12.5px' }}
                            >
                                {t.closeBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPERATÖR POI EKLEME MODALI */}
            {showCreatePoiModal && (
                <div className="modal-overlay" onClick={() => setShowCreatePoiModal(false)}>
                    <div
                        className="poi-create-modal-container"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Yeni POI (İlgi Noktası) Ekle</h3>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Haritada işaretlenen konuma POI detaylarını giriniz.</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreatePoiModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px', padding: '4px 8px', borderRadius: '6px', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewPoi} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">POI / Mekan İsmi *</label>
                                <input
                                    type="text"
                                    className="poi-modal-input"
                                    placeholder="Örn: Merkez Kütüphane, Şehir Hastanesi, Atatürk Parkı, Semt Polikliniği..."
                                    value={newPoiForm.name}
                                    onChange={(e) => setNewPoiForm({ ...newPoiForm, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: currentSubCategories.length > 0 ? '1fr 1fr' : '1fr', gap: '10px' }}>
                                <div className="poi-modal-form-group">
                                    <label className="poi-modal-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>1. Ana Kategori *</span>
                                    </label>
                                    <select
                                        className="poi-modal-input"
                                        value={poiParentCatId}
                                        onChange={(e) => handlePoiParentCatChange(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>-- Ana Kategori Seçiniz --</option>
                                        {parentCategories.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {currentSubCategories.length > 0 && (
                                    <div className="poi-modal-form-group">
                                        <label className="poi-modal-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>2. Alt Kategori (Dallanma) *</span>
                                        </label>
                                        <select
                                            className="poi-modal-input"
                                            value={newPoiForm.categoryId}
                                            onChange={(e) => handlePoiSubCatChange(e.target.value)}
                                            required
                                        >
                                            {currentSubCategories.map(sub => (
                                                <option key={sub.id} value={sub.id}>
                                                    {sub.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {activeCategoryObject && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '7px 12px',
                                    background: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.9)',
                                    borderRadius: '8px',
                                    border: `1px solid ${activeCategoryObject.color || '#3b82f6'}40`,
                                    fontSize: '12px'
                                }}>
                                    <span style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: activeCategoryObject.color || '#3b82f6',
                                        display: 'inline-block',
                                        boxShadow: `0 0 6px ${activeCategoryObject.color || '#3b82f6'}80`
                                    }} />
                                    <span style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>Seçili Harita İşaretçisi:</span>
                                    <strong style={{ color: activeCategoryObject.color || '#3b82f6', fontWeight: 600 }}>
                                        {activeCategoryObject.parentName ? `${activeCategoryObject.parentName} → ${activeCategoryObject.name}` : activeCategoryObject.name}
                                    </strong>
                                </div>
                            )}

                            {/* ÇALIŞMA SAATLERİ (SEÇİCİ & ŞABLONLAR) */}
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Mesai / Çalışma Saatleri</label>

                                <div style={{ display: 'grid', gridTemplateColumns: poiIs24Hours ? '1fr' : '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                                    <div>
                                        <select
                                            className="poi-modal-input"
                                            value={poiTimeDays}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPoiTimeDays(val);
                                                if (poiIs24Hours) {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${val} 24 Saat Açık` }));
                                                } else {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${val} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                }
                                            }}
                                        >
                                            <option value="Hafta İçi">Hafta İçi (Pzt - Cuma)</option>
                                            <option value="Her Gün">Her Gün (7 Gün Açık)</option>
                                            <option value="Pzt - Cmt">Pazartesi - Cumartesi</option>
                                            <option value="Hafta Sonu">Hafta Sonu (Cmt - Paz)</option>
                                        </select>
                                    </div>

                                    {!poiIs24Hours && (
                                        <>
                                            <div>
                                                <input
                                                    type="time"
                                                    className="poi-modal-input"
                                                    value={poiTimeStart}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPoiTimeStart(val);
                                                        setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${val} - ${poiTimeEnd}` }));
                                                    }}
                                                    title="Açılış Saati"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="time"
                                                    className="poi-modal-input"
                                                    value={poiTimeEnd}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPoiTimeEnd(val);
                                                        setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${val}` }));
                                                    }}
                                                    title="Kapanış Saati"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                        Seçilen Mesai: <strong style={{ color: '#38bdf8' }}>{newPoiForm.workingHours || 'Belirtilmedi'}</strong>
                                    </span>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={poiIs24Hours}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setPoiIs24Hours(checked);
                                                if (checked) {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: '24 Saat Açık' }));
                                                } else {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                }
                                            }}
                                        />
                                        <span>24 Saat Kesintisiz Açık</span>
                                    </label>
                                </div>
                            </div>

                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Açıklama / Detay</label>
                                <textarea
                                    className="poi-modal-input"
                                    rows="2"
                                    placeholder="POI hakkında ek bilgiler..."
                                    value={newPoiForm.description}
                                    onChange={(e) => setNewPoiForm({ ...newPoiForm, description: e.target.value })}
                                />
                            </div>

                            <div className="poi-modal-location-badge">
                                {newPoiForm.isPolygon ? (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                                        </svg>
                                        <span>
                                            <strong style={{ color: '#10b981' }}>Poligon POI:</strong> {newPoiForm.area >= 1000000 ? (newPoiForm.area / 1000000).toFixed(2) + ' km²' : Math.round(newPoiForm.area).toLocaleString() + ' m²'} (Merkez: {newPoiForm.lat?.toFixed(5)}° K, {newPoiForm.lon?.toFixed(5)}° D)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <circle cx="12" cy="12" r="10" />
                                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                                        </svg>
                                        <span><strong>Nokta Konumu:</strong> {newPoiForm.lat?.toFixed(5)}° K, {newPoiForm.lon?.toFixed(5)}° D</span>
                                    </>
                                )}
                            </div>

                            <div className="poi-modal-actions">
                                <button type="button" className="poi-btn-cancel" onClick={() => setShowCreatePoiModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="poi-btn-save">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Haritaya Kaydet</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SEÇİLİ POI BİLGİ PANELİ (INFO CARD / POPUP) */}
            {selectedPoiInfo && (
                <div className="poi-info-floating-card">
                    <div className="poi-card-header">
                        <div className="poi-card-title-group">
                            <div
                                className="poi-card-icon-wrap"
                                style={{
                                    backgroundColor: selectedPoiInfo.categoryColor ? `${selectedPoiInfo.categoryColor}25` : 'rgba(59, 130, 246, 0.2)',
                                    color: selectedPoiInfo.categoryColor || '#3b82f6'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="poi-card-title">{selectedPoiInfo.name}</h3>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>POI Detayları</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedPoiInfo(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                        >
                            &times;
                        </button>
                    </div>

                    <div className="poi-card-body">
                        <div className="poi-detail-row">
                            <span className="poi-detail-label">Kategori:</span>
                            <span
                                className="poi-badge"
                                style={{
                                    backgroundColor: selectedPoiInfo.categoryColor ? `${selectedPoiInfo.categoryColor}20` : 'rgba(59, 130, 246, 0.15)',
                                    color: selectedPoiInfo.categoryColor || '#3b82f6'
                                }}
                            >
                                {selectedPoiInfo.parentCategoryName ? `${selectedPoiInfo.parentCategoryName} → ` : ''}{selectedPoiInfo.categoryName}
                            </span>
                        </div>

                        {selectedPoiInfo.workingHours && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Mesai Saatleri:</span>
                                <span className="poi-detail-value" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <strong>{selectedPoiInfo.workingHours}</strong>
                                </span>
                            </div>
                        )}

                        <div className="poi-detail-row">
                            <span className="poi-detail-label">Ekleyen:</span>
                            <span className="poi-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <strong>{selectedPoiInfo.username || 'Sistem'}</strong>
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>(ID: {selectedPoiInfo.userId})</span>
                            </span>
                        </div>

                        {selectedPoiInfo.createdDate && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Kayıt Tarihi:</span>
                                <span className="poi-detail-value" style={{ color: '#94a3b8' }}>
                                    {new Date(selectedPoiInfo.createdDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        )}

                        {selectedPoiInfo.latitude != null && selectedPoiInfo.longitude != null && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Konum:</span>
                                <span className="poi-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{selectedPoiInfo.latitude.toFixed(5)}°, {selectedPoiInfo.longitude.toFixed(5)}°</span>
                                    <button
                                        type="button"
                                        className="btn-copy-inline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${selectedPoiInfo.latitude}, ${selectedPoiInfo.longitude}`);
                                            if (toastRef.current) {
                                                toastRef.current.show({ severity: 'info', summary: 'Kopyalandı', detail: 'Koordinatlar panoya kopyalandı.', life: 2500 });
                                            }
                                        }}
                                        title="Koordinatları Kopyala"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        )}

                        {selectedPoiInfo.description && (
                            <div className="poi-detail-row" style={{ flexDirection: 'column', gap: '4px' }}>
                                <span className="poi-detail-label">Açıklama:</span>
                                <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.4 }}>
                                    {selectedPoiInfo.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="poi-card-footer">
                        {(isAdmin || selectedPoiInfo.userId === loggedInUserId) && (
                            <button
                                type="button"
                                className="poi-btn-delete-icon"
                                onClick={() => handleDeletePoiFromMap(selectedPoiInfo.id, selectedPoiInfo.name)}
                                title="POI'yi Sil"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            className="poi-btn-close-card"
                            onClick={() => setSelectedPoiInfo(null)}
                        >
                            Kapat
                        </button>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (GÜNCELLEME / TAMAMLA ONAYI) */}
            {updateConfirmTarget && (
                <div className="modal-overlay" onClick={() => setUpdateConfirmTarget(null)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Çizim Güncellemesini Onaylayın</h3>
                        <p className="modal-description">
                            <strong>"{updateConfirmTarget.name}"</strong> nesnesinin yeni konumu (WKT), kırılma noktaları ve görsel özellikleri veritabanına kaydedilecektir. Devam etmek istiyor musunuz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setUpdateConfirmTarget(null)}>
                                Vazgeç (İptal)
                            </button>
                            <button className="modal-btn btn-primary-confirm" onClick={executeDrawingUpdateConfirmed} style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                                Evet, Kaydet ve Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (DÜZENLEMELERİ İPTAL ET / ESKİ HALİNE DÖN) */}
            {cancelEditConfirm && (
                <div className="modal-overlay" onClick={() => setCancelEditConfirm(false)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge warning">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Değişiklikleri İptal Etmeyi Onaylayın</h3>
                        <p className="modal-description">
                            Haritada yaptığınız kırılma noktası değişiklikleri silinecek ve çizim orijinal haline geri dönecektir. Emin misiniz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setCancelEditConfirm(false)}>
                                Düzenlemeye Devam Et
                            </button>
                            <button className="modal-btn btn-danger-confirm" onClick={confirmCancelVertexEditing} style={{ backgroundColor: '#f59e0b', borderColor: '#d97706' }}>
                                Evet, İptal Et (Eski Hali)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPENLAYERS OVERLAY: NOKTA VE ÇİZİM DETAY BİLGİ VE DÜZENLEME PANELİ */}
            {selectedPointInfo && overlayContainerRef.current && createPortal(
                <div className={`ol-popup-card ${isPopupCollapsed ? 'collapsed' : ''}`}>
                    <div className="ol-popup-header">
                        <div className="ol-popup-title-wrapper">
                            <span
                                className="ol-popup-color-dot"
                                style={{ backgroundColor: editColor || selectedPointInfo.color || '#3b82f6' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h4 className="ol-popup-title">{editName || selectedPointInfo.name}</h4>
                                <span className="ol-popup-badge">
                                    {selectedPointInfo.type === 'SavedPlace' && t.savedPlaceBadge}
                                    {(selectedPointInfo.type === 'PointDrawing' || selectedPointInfo.type === 'Point') && t.pointDrawingBadge}
                                    {(selectedPointInfo.type === 'LineDrawing' || selectedPointInfo.type === 'Line') && t.lineTypeLabel}
                                    {(selectedPointInfo.type === 'PolygonDrawing' || selectedPointInfo.type === 'Polygon') && t.polygonTypeLabel}
                                    {selectedPointInfo.type === 'SelectedPoint' && t.selectedPointBadge}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                type="button"
                                className="ol-popup-minimize-btn"
                                onClick={() => setIsPopupCollapsed(!isPopupCollapsed)}
                                title={isPopupCollapsed ? "Paneli Genişlet" : "Paneli Küçült/Gizle"}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {isPopupCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
                                </svg>
                            </button>
                            <button className="ol-popup-close-btn" onClick={handleClosePointInfo} title={t.btnCloseInfoPanel}>
                                &times;
                            </button>
                        </div>
                    </div>

                    {!isPopupCollapsed && (
                        <div className="ol-popup-body">
                            {selectedPointInfo.id && selectedPointInfo.type !== 'SavedPlace' ? (
                                <>
                                    <div className="ol-popup-field-group">
                                        <label className="ol-popup-field-label">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9"/>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                            </svg>
                                            Obje İsmi:
                                        </label>
                                        <input
                                            type="text"
                                            className="ol-popup-input"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="İsim girin..."
                                        />
                                    </div>

                                    <div className="ol-popup-field-group">
                                        <label className="ol-popup-field-label">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2.5 6.5 6 6.5 1 0 1.5-.5 1.5-1 0-.5-.2-1-.5-1.5-.3-.5-.5-1-.5-1.5 0-1.1.9-2 2-2h1.5c3.6 0 6.5-2.9 6.5-6.5C18.5 5.5 15.6 2 12 2z"/>
                                            </svg>
                                            Renk Seçimi:
                                        </label>
                                        <div className="ol-popup-color-row">
                                            <input
                                                type="color"
                                                className="ol-popup-color-picker"
                                                value={editColor}
                                                onChange={(e) => setEditColor(e.target.value)}
                                            />
                                            <div className="ol-popup-color-presets">
                                                {PRESET_COLORS.map((c) => (
                                                    <button
                                                        key={c.hex}
                                                        type="button"
                                                        className={`ol-popup-color-swatch ${editColor === c.hex ? 'active' : ''}`}
                                                        style={{ backgroundColor: c.hex }}
                                                        onClick={() => setEditColor(c.hex)}
                                                        title={c.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ol-popup-field-group">
                                        <label className="ol-popup-field-label">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="2" y1="12" x2="22" y2="12"/>
                                            </svg>
                                            Geometri (WKT Konum):
                                        </label>
                                        <input
                                            type="text"
                                            className="ol-popup-input ol-popup-wkt-input"
                                            value={editWkt}
                                            onChange={(e) => setEditWkt(e.target.value)}
                                            placeholder="WKT Geometri..."
                                        />
                                    </div>
                                </>
                            ) : null}

                            {selectedPointInfo.lengthText ? (
                                <div className="ol-popup-coord-row">
                                    <span className="coord-label">{t.totalLengthLabel}</span>
                                    <strong className="coord-value" style={{ color: editColor }}>{selectedPointInfo.lengthText}</strong>
                                </div>
                            ) : selectedPointInfo.areaText ? (
                                <div className="ol-popup-coord-row">
                                    <span className="coord-label">{t.totalAreaLabel}</span>
                                    <strong className="coord-value" style={{ color: editColor }}>{selectedPointInfo.areaText}</strong>
                                </div>
                            ) : null}

                            {selectedPointInfo.lat != null && selectedPointInfo.lon != null && (
                                <div className="ol-popup-coord-row">
                                    <span className="coord-label">Konum:</span>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <strong className="coord-value">{selectedPointInfo.lat}°, {selectedPointInfo.lon}°</strong>
                                        <button
                                            type="button"
                                            className="btn-copy-inline"
                                            onClick={handleCopyCoords}
                                            title={t.btnCopyCoords || "Konum Koordinatlarını Kopyala"}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* BİLGİ KUTUSU / TIP BANNER (Noktaları Düzenle İpucu) */}
                            {selectedPointInfo.id && selectedPointInfo.type !== 'SavedPlace' && (
                                <div className={`vertex-edit-info-box ${isModifyingVertex ? 'active-mode' : ''}`}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isModifyingVertex ? '#22c55e' : '#f59e0b'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                                        {isModifyingVertex ? (
                                            <polyline points="20 6 9 17 4 12" />
                                        ) : (
                                            <>
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </>
                                        )}
                                    </svg>
                                    <span>
                                        {isModifyingVertex
                                            ? 'Düzenleme Modu Aktif: Noktaları sürükleyin. Kaydetmek için "Kaydet"e, vazgeçmek için "Vazgeç"e tıklayın.'
                                            : 'İpucu: Haritadaki kırılma noktalarını/köşelerini fare ile sürükleyerek değiştirmek için "Noktalar" butonuna basın.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="ol-popup-footer">
                        {userRole !== 'Viewer' && selectedPointInfo.id && selectedPointInfo.type !== 'SavedPlace' && (
                            canEditDrawing(selectedPointInfo) ? (
                                <>
                                    <button
                                        type="button"
                                        className="ol-popup-btn btn-save-update"
                                        onClick={handleUpdateDrawingFromPopup}
                                        title="Değişiklikleri Kaydet ve Güncelle"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>Kaydet</span>
                                    </button>

                                    <button
                                        type="button"
                                        className={`ol-popup-btn btn-vertex-edit ${isModifyingVertex ? 'active-vertex' : ''}`}
                                        onClick={isModifyingVertex ? handleTriggerCancelVertexEditing : startVertexEditing}
                                        title={isModifyingVertex ? "Düzenlemeyi İptal Et (Vazgeç)" : "Kırılma Noktalarını Fare ile Düzenle"}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            {isModifyingVertex ? (
                                                <>
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </>
                                            ) : (
                                                <>
                                                    <circle cx="12" cy="12" r="3"/>
                                                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                                                </>
                                            )}
                                        </svg>
                                    </button>

                                    {isModifyingVertex && (
                                        <>
                                            <button
                                                type="button"
                                                className="ol-popup-btn btn-undo-redo"
                                                onClick={handleUndoGeometry}
                                                disabled={historyIndex <= 0}
                                                title="Geri Al (Undo)"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 7v6h6"/>
                                                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="ol-popup-btn btn-undo-redo"
                                                onClick={handleRedoGeometry}
                                                disabled={historyIndex < 0 || historyIndex >= geometryHistoryRef.current.length - 1}
                                                title="İleri Al (Redo)"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 7v6h-6"/>
                                                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                                                </svg>
                                            </button>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        className="ol-popup-btn btn-delete-soft"
                                        onClick={triggerDeleteDrawingFromPopup}
                                        title="Çizimi Sil (Soft Delete)"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', width: '100%', textAlign: 'center' }}>
                                    {(selectedPointInfo.insertedUserId === 1 || (selectedPointInfo.insertedUsername || '').toLowerCase().includes('admin'))
                                        ? 'Yönetici Çizimi (Yalnızca Admin Tarafından Düzenlenebilir)'
                                        : 'Yalnızca Görüntüleme Modu (Düzenlemek için İşbirliği Gerekir)'}
                                </div>
                            )
                        )}
                    </div>
                </div>,
                overlayContainerRef.current
            )}

            {/* ISI HARİTASI LEJANTI (SAĞ ALT KÖŞE) */}
            {isHeatmapActive && (
                <div className="heatmap-legend-floating-card">
                    <div className="heatmap-legend-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>Nokta Yoğunluğu (Isı Haritası)</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsHeatmapActive(false)}
                            className="heatmap-legend-close"
                            title="Lejantı Kapat"
                        >
                            &times;
                        </button>
                    </div>

                    {/* GEOMETRİ TÜRÜ FİLTRELEME BUTONLARI (TÜMÜ / NOKTA / ÇİZGİ / POLİGON) */}
                    <div className="heatmap-filter-pill-group">
                        {[
                            { id: 'ALL', label: 'Tümü' },
                            { id: 'Point', label: 'Nokta' },
                            { id: 'Line', label: 'Çizgi' },
                            { id: 'Polygon', label: 'Poligon' }
                        ].map(f => (
                            <button
                                key={f.id}
                                type="button"
                                className={`heatmap-filter-pill-btn ${heatmapTypeFilter === f.id ? 'active' : ''}`}
                                onClick={() => setHeatmapTypeFilter(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Renk Skalası Şeridi (0.0 Mavi -> Camgöbeği -> Yeşil -> Sarı -> 1.0 Kırmızı) */}
                    <div className="heatmap-gradient-strip" />

                    {/* 0.0 - 1.0 Değer Aralıkları */}
                    <div className="heatmap-scale-labels">
                        <span>0.0 (Düşük)</span>
                        <span>0.5 (Orta)</span>
                        <span>1.0 (Yüksek)</span>
                    </div>

                    <div className="heatmap-legend-footer">
                        <span>Analiz Kapsamı:</span>
                        <strong style={{ color: '#f97316' }}>
                            {heatmapSourceRef.current ? heatmapSourceRef.current.getFeatures().length : 0} Konum / Nokta
                        </strong>
                    </div>
                </div>
            )}

            {/* CANLI İMLEÇ KOORDİNAT & HARİTA ÖLÇEK ÇUBUĞU (SAĞ ALT KÖŞE) */}
            <div className="map-coords-scale-bar">
                <div className="coords-display-section" title="İmlecin Bulunduğu Coğrafi Koordinatlar (Enlem, Boylam)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                    <span>
                        {cursorCoords.lat.toFixed(5)}° K, {cursorCoords.lon.toFixed(5)}° D
                    </span>
                </div>

                <div className="coords-scale-divider" />

                <div className="scale-display-section" title="Yakınlaştırma Düzeyi">
                    <span>Zoom {mapZoom.toFixed(1)}</span>
                </div>
            </div>

            {/* OpenLayers Harita Container */}
            <div id="map" ref={mapContainerRef}></div>
        </div>
    );
}

export default App;