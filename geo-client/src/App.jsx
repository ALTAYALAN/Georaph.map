import { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { Style, Icon, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import Draw from 'ol/interaction/Draw';
import WKT from 'ol/format/WKT';

// PrimeReact Bileşenleri
import { Toast } from 'primereact/toast';

import { translations } from './translations';
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

function App() {
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
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Oturum Kalan Süresi (Saniye Cinsinden)
    const [timeLeft, setTimeLeft] = useState(0);

    // Harita Formu Durumları (Tekil Mekan Ekleme)
    const [placeName, setPlaceName] = useState('');
    const [placeColor, setPlaceColor] = useState('#16a34a');
    const [coords, setCoords] = useState({ lon: 33.2433, lat: 38.9637 }); // Varsayılan Türkiye
    const [infoMessage, setInfoMessage] = useState('');
    const [savedPlaces, setSavedPlaces] = useState([]); // Veritabanından gelen kayıtlı mekanlar

    // OpenLayers Çizim İşlemleri (Point, LineString, Polygon, Analysis)
    const [drawType, setDrawType] = useState('None');
    const [savedDrawings, setSavedDrawings] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // YÜZER MENÜ / ÖZNİTELİK FORM DURUMLARI (İsim, Renk ve Taslak WKT)
    const [drawingName, setDrawingName] = useState('');
    const [drawingColor, setDrawingColor] = useState('#3b82f6');
    const [draftWkt, setDraftWkt] = useState('');

    // GEÇİCİ ENVANTER ANALİZİ DURUMLARI
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // OpenLayers harita ve katman referansları
    const mapRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const savedPlacesSourceRef = useRef(null);
    const drawingsSourceRef = useRef(null);
    const analysisSourceRef = useRef(new VectorSource());
    const drawInteractionRef = useRef(null);
    const draftFeatureRef = useRef(null);
    const tileLayerRef = useRef(null);

    // OTURUM SÜRESİ KONTROLÜ VE GERİ SAYIM ZAMANLAYICISI (10 Dakika)
    useEffect(() => {
        if (!token) return;

        const checkSessionExpiration = () => {
            const expirationTime = localStorage.getItem('session_expiration');
            if (!expirationTime) {
                handleLogout('Oturum bilgisi bulunamadı.');
                return;
            }

            const remainingMs = parseInt(expirationTime, 10) - Date.now();
            const remainingSeconds = Math.floor(remainingMs / 1000);

            if (remainingSeconds <= 0) {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('session_expiration');
                setToken('');
                setError('Oturum süreniz sona erdi.');
            } else {
                setTimeLeft(remainingSeconds);
            }
        };

        checkSessionExpiration();
        const interval = setInterval(checkSessionExpiration, 1000);
        return () => clearInterval(interval);
    }, [token]);

    // Toast Bildirimi Tetikleme
    useEffect(() => {
        if (infoMessage && toastRef.current) {
            const isError = infoMessage.toLowerCase().includes('hata') || infoMessage.toLowerCase().includes('başarısız');
            toastRef.current.show({
                severity: isError ? 'error' : 'success',
                summary: isError ? 'İşlem Uyarısı' : 'Başarılı',
                detail: infoMessage,
                life: 3500
            });
        }
    }, [infoMessage]);

    // KAYITLI MEKANLARI BACKEND'DEN ÇEKME (GET /api/places)
    const fetchPlaces = async () => {
        if (!token) return;
        try {
            const response = await fetch('http://localhost:5041/api/places', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSavedPlaces(data);
            }
        } catch (err) {
            console.error('Kayıtlı mekanlar getirilirken hata oluştu:', err);
        }
    };

    // KAYITLI TÜM ÇİZİMLERİ BACKEND'DEN ÇEKME (GET /api/drawings)
    const fetchDrawings = async () => {
        if (!token) return;
        try {
            const response = await fetch('http://localhost:5041/api/drawings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSavedDrawings(data);
            }
        } catch (err) {
            console.error('Çizim verileri getirilirken hata oluştu:', err);
        }
    };

    // Giriş yapıldığında tüm mekan ve çizimleri yükle
    useEffect(() => {
        if (token) {
            fetchPlaces();
            fetchDrawings();
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

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('session_expiration', expirationTimestamp.toString());

                setIsLoggingIn(true);

                setTimeout(() => {
                    setToken(data.token);
                    setTimeLeft(600);
                    setIsLoggingIn(false);
                }, 500);
            } else {
                setError(data.message || 'Giriş başarısız.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı. Projenin açık olduğundan emin ol.');
        }
    };

    // ÇIKIŞ İŞLEMİ
    const handleLogout = (customMessage = '') => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('session_expiration');
        setToken('');
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
        if (tileLayerRef.current) {
            if (isDarkMode) {
                tileLayerRef.current.setSource(new XYZ({
                    url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                }));
            } else {
                tileLayerRef.current.setSource(new OSM());
            }
        }
    }, [isDarkMode]);

    // OPENLAYERS HARİTA KURULUMU
    useEffect(() => {
        if (!token) return;

        const activeMarkerSource = new VectorSource();
        vectorSourceRef.current = activeMarkerSource;

        const savedPlacesSource = new VectorSource();
        savedPlacesSourceRef.current = savedPlacesSource;

        const drawingsSource = new VectorSource();
        drawingsSourceRef.current = drawingsSource;

        const baseTileLayer = new TileLayer({
            source: isDarkMode ? new XYZ({ url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' }) : new OSM()
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

        const map = new Map({
            target: 'map',
            layers: [
                baseTileLayer,
                new VectorLayer({
                    source: savedPlacesSource
                }),
                new VectorLayer({
                    source: drawingsSource
                }),
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

        mapRef.current = map;

        map.on('click', function (evt) {
            const lonLat = toLonLat(evt.coordinate);
            setCoords({
                lon: parseFloat(lonLat[0].toFixed(6)),
                lat: parseFloat(lonLat[1].toFixed(6))
            });
        });

        return () => map.setTarget(null);
    }, [token]);

    // SEÇİLİ MAVİ PIN İŞARETÇİSİ
    useEffect(() => {
        if (!vectorSourceRef.current) return;
        vectorSourceRef.current.clear();

        const lon = parseFloat(coords.lon);
        const lat = parseFloat(coords.lat);

        if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
            const marker = new Feature({
                geometry: new Point(fromLonLat([lon, lat]))
            });

            const pinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${placeColor}" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
            </svg>`;

            marker.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                    scale: 0.75,
                    anchor: [0.5, 1]
                })
            }));

            vectorSourceRef.current.addFeature(marker);
        }
    }, [coords, token, placeColor]);

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

    // KAYITLI ÇİZİMLERİ (Point, Line, Polygon - WKT & Color) HARİTADA GÖSTER
    useEffect(() => {
        if (!drawingsSourceRef.current) return;
        drawingsSourceRef.current.clear();

        const wktFormat = new WKT();

        savedDrawings.forEach((item) => {
            try {
                if (!item.wkt) return;

                const feature = wktFormat.readFeature(item.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                feature.set('id', item.id);
                feature.set('name', item.name);
                feature.set('type', item.type);

                const itemColor = item.color || '#3b82f6';

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
    }, [savedDrawings]);

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

                setDrawType('None');
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
                    if (response.ok) {
                        setAnalysisResult(data);
                        setInfoMessage(`Analiz tamamlandı: Toplam ${data.totalIntersectedCount} envanter kesişiyor.`);
                    } else {
                        setInfoMessage('Analiz hatası: ' + (data.message || 'Bilinmeyen hata'));
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

        // STANDART ÇİZİM MODLARI (Point, LineString, Polygon)
        const drawInteraction = new Draw({
            source: drawingsSourceRef.current,
            type: drawType
        });

        drawInteraction.on('drawstart', (event) => {
            draftFeatureRef.current = event.feature;
        });

        // 2. MADDE: Haritada çizim tamamlandığı anda (drawend) WKT Alır ve Yüzer Menüye Aktarır
        drawInteraction.on('drawend', (event) => {
            const geometry = event.feature.getGeometry();
            draftFeatureRef.current = event.feature;

            const wktFormat = new WKT();
            const wktString = wktFormat.writeGeometry(geometry, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });

            setDraftWkt(wktString);
        });

        mapRef.current.addInteraction(drawInteraction);
        drawInteractionRef.current = drawInteraction;

        return () => {
            if (mapRef.current && drawInteractionRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
            }
        };
    }, [drawType, token]);

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

    // MEKANA ODAKLANMA
    const handleSelectSavedPlace = (place) => {
        setCoords({ lon: place.longitude, lat: place.latitude });
        setPlaceName(place.name);

        if (mapRef.current) {
            mapRef.current.getView().animate({
                center: fromLonLat([place.longitude, place.latitude]),
                zoom: 13,
                duration: 1000
            });
        }
    };

    // ÇİZİME ODAKLANMA
    const handleSelectDrawing = (drawing) => {
        if (!mapRef.current || !drawing.wkt) return;
        try {
            const wktFormat = new WKT();
            const feature = wktFormat.readFeature(drawing.wkt, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, { duration: 1000, maxZoom: 15, padding: [50, 50, 50, 50] });

            if (drawing.type === 'Polygon') {
                runSavedPolygonAnalysis(drawing);
            }
        } catch (err) {
            console.error('Odaklanma hatası:', err);
        }
    };

    // KAYITLI POLİGON İÇİN KESİŞİM ANALİZİ ÇALIŞTIRMA (Gereksinim 3.1)
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
            if (response.ok) {
                setAnalysisResult(data);
                setInfoMessage(`"${drawing.name}" analizi: Toplam ${data.totalIntersectedCount} envanter kesişiyor.`);
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

    // SİLME İŞLEMİNİ ONAYLAMA
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { kind, id, drawingType, name } = deleteTarget;
        setDeleteTarget(null);

        try {
            if (kind === 'place') {
                const response = await fetch(`http://localhost:5041/api/places/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    setInfoMessage(`"${name}" konumu başarıyla silindi.`);
                    fetchPlaces();
                } else {
                    setInfoMessage('Silme işleminde hata oluştu.');
                }
            } else if (kind === 'drawing') {
                const response = await fetch(`http://localhost:5041/api/drawings/${drawingType.toLowerCase()}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    setInfoMessage(`"${name}" çizimi başarıyla silindi.`);
                    fetchDrawings();
                } else {
                    setInfoMessage('Silme işleminde hata oluştu.');
                }
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
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            border: '1.5px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(8px)',
                            transition: 'transform 0.2s ease'
                        }}
                    >
                        {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                    </button>
                </div>

                <div className="login-sidebar">
                    <div className="login-brand">
                        <h1 className="brand-title">Georaph.map</h1>
                        <p className="brand-subtitle">{t.loginSubtitle}</p>
                    </div>

                    <div className="login-card">
                        <h2>{t.loginTitle}</h2>
                        {error && <div className="error-msg">{error}</div>}
                        <form onSubmit={handleLogin}>
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
                            <button type="submit" className="login-btn">{isLoggingIn ? t.loggingIn : t.loginButton}</button>
                        </form>
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                        <h2 className="map-brand-title">Georaph.map</h2>
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

                            {/* Dil Seçim Butonu (Sadece Vektörel Bayrak) */}
                            <button
                                className="theme-toggle-btn lang-toggle-btn"
                                onClick={toggleLang}
                                title={t.languageSelect}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', padding: 0, borderRadius: '8px', cursor: 'pointer', backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                            >
                                {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                            </button>
                        </div>
                    </div>

                    {/* Oturum Süresi Geri Sayım Rozeti */}
                    <div className="session-timer-badge">
                        <div className="timer-label">
                            <span className="live-dot"></span>
                            <span>{t.sessionTime}</span>
                        </div>
                        <strong>{formatTime(timeLeft)}</strong>
                    </div>

                    <div className="sidebar-divider"></div>

                    {/* Mekan Ekleme Formu */}
                    <div className="add-place-section">
                        <h3 className="section-title">{t.addPlaceTitle}</h3>
                        <p className="section-subtitle">
                            {t.addPlaceSubtitle}
                        </p>

                        <form onSubmit={handleSavePlace}>
                            <div className="input-group">
                                <label className="input-label">{t.placeNameLabel}</label>
                                <input
                                    type="text"
                                    value={placeName}
                                    onChange={(e) => setPlaceName(e.target.value)}
                                    placeholder={t.placeNamePlaceholder}
                                    required
                                />
                            </div>

                            <div className="input-group">
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

                            <div className="input-group">
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

                            <div className="input-group">
                                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Nokta Renk Paleti
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                                            width: '38px',
                                            height: '34px',
                                            backgroundColor: '#2563eb',
                                            border: '1.5px solid #ffffff',
                                            borderRadius: '7px',
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                                            transition: 'transform 0.15s ease'
                                        }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2.5 6.5 6 6.5 1 0 1.5-.5 1.5-1 0-.5-.2-1-.5-1.5-.3-.5-.5-1-.5-1.5 0-1.1.9-2 2-2h1.5c3.6 0 6.5-2.9 6.5-6.5C18.5 5.5 15.6 2 12 2z" />
                                            <circle cx="13.5" cy="6.5" r="1.1" fill="#fbbf24" />
                                            <circle cx="17.5" cy="10.5" r="1.1" fill="#34d399" />
                                            <circle cx="8.5" cy="7.5" r="1.1" fill="#f43f5e" />
                                            <circle cx="6.5" cy="12.5" r="1.1" fill="#60a5fa" />
                                        </svg>
                                    </button>

                                    <input
                                        ref={placeColorInputRef}
                                        type="color"
                                        value={placeColor}
                                        onChange={(e) => setPlaceColor(e.target.value)}
                                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                    />

                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                type="button"
                                                key={c.hex}
                                                onClick={() => setPlaceColor(c.hex)}
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    backgroundColor: c.hex,
                                                    border: placeColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                                    boxShadow: placeColor === c.hex ? `0 0 6px ${c.hex}` : 'none',
                                                    cursor: 'pointer'
                                                }}
                                                title={`${c.label} (${c.hex})`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="map-btn btn-save">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                {t.saveLocationBtn}
                            </button>
                        </form>
                    </div>

                    <div className="sidebar-divider"></div>

                    {/* KAYITLI KONUMLAR VE ÇİZİMLER LİSTESİ */}
                    <div className="saved-places-section">
                        <div className="section-header">
                            <h3 className="section-title">{t.savedPlacesTitle}</h3>
                            <span className="places-count-badge">{savedDrawings.length} {t.recordsBadge}</span>
                        </div>

                        {savedDrawings.length === 0 ? (
                            <p className="no-places-msg">{t.noRecordsMsg}</p>
                        ) : (
                            <div className="saved-places-list">

                                {/* Kayıtlı Çizimler */}
                                {savedDrawings.map((drawing) => (
                                    <div
                                        key={`drawing-${drawing.type}-${drawing.id}`}
                                        className="saved-place-item"
                                        onClick={() => handleSelectDrawing(drawing)}
                                    >
                                        <div className="place-item-icon">
                                            {drawing.type === 'Point' ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#ef4444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="8" fill={drawing.color || "#ef4444"} />
                                                </svg>
                                            ) : drawing.type === 'Line' ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#3b82f6"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M4 20L20 4" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#10b981"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 22 8.5 18 19 6 19 2 8.5" fill={hexToRgba(drawing.color || '#10b981', 0.4)} />
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
                                            className="btn-delete-drawing"
                                            onClick={(e) => triggerDeleteDrawing(drawing, e)}
                                            title="Çizimi Sil"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="map-sidebar-bottom">
                    <button onClick={() => handleLogout()} className="map-btn btn-logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {t.logout}
                    </button>
                </div>
            </div>

            {/* HARİTA ÜZERİNDEKİ ÇİZİM & ANALİZ ARAÇ ÇUBUĞU (SAĞ ÜST) */}
            <div className="map-draw-toolbar-floating">
                <button
                    className={`map-tool-icon-btn ${drawType === 'Point' ? 'active' : ''}`}
                    onClick={() => {
                        if (drawType === 'Point') handleCancelDraw();
                        else setDrawType('Point');
                    }}
                    title={t.toolPointTitle}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="8" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                </button>

                <button
                    className={`map-tool-icon-btn ${drawType === 'LineString' ? 'active' : ''}`}
                    onClick={() => {
                        if (drawType === 'LineString') handleCancelDraw();
                        else setDrawType('LineString');
                    }}
                    title={t.toolLineTitle}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 20L20 4" />
                        <circle cx="4" cy="20" r="2.5" fill="currentColor" />
                        <circle cx="20" cy="4" r="2.5" fill="currentColor" />
                    </svg>
                </button>

                <button
                    className={`map-tool-icon-btn ${drawType === 'Polygon' ? 'active' : ''}`}
                    onClick={() => {
                        if (drawType === 'Polygon') handleCancelDraw();
                        else setDrawType('Polygon');
                    }}
                    title={t.toolPolygonTitle}
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
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        <polygon points="10 8 13 11 11 14 8 12" />
                    </svg>
                </button>
            </div>

            {/* SADE VE NET YÜZER ÇİZİM BARI */}
            {drawType !== 'None' && drawType !== 'Analysis' && (
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' }}>
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
                                        width: '38px',
                                        height: '34px',
                                        backgroundColor: '#2563eb',
                                        border: '1.5px solid #ffffff',
                                        borderRadius: '7px',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                                        transition: 'transform 0.15s ease'
                                    }}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2.5 6.5 6 6.5 1 0 1.5-.5 1.5-1 0-.5-.2-1-.5-1.5-.3-.5-.5-1-.5-1.5 0-1.1.9-2 2-2h1.5c3.6 0 6.5-2.9 6.5-6.5C18.5 5.5 15.6 2 12 2z" />
                                        <circle cx="13.5" cy="6.5" r="1.1" fill="#fbbf24" />
                                        <circle cx="17.5" cy="10.5" r="1.1" fill="#34d399" />
                                        <circle cx="8.5" cy="7.5" r="1.1" fill="#f43f5e" />
                                        <circle cx="6.5" cy="12.5" r="1.1" fill="#60a5fa" />
                                    </svg>
                                </button>

                                <input
                                    ref={drawColorInputRef}
                                    type="color"
                                    value={drawingColor}
                                    onChange={(e) => setDrawingColor(e.target.value)}
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                />
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            type="button"
                                            key={c.hex}
                                            onClick={() => setDrawingColor(c.hex)}
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                backgroundColor: c.hex,
                                                border: drawingColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                                boxShadow: drawingColor === c.hex ? `0 0 6px ${c.hex}` : 'none',
                                                cursor: 'pointer'
                                            }}
                                            title={`${c.label} (${c.hex})`}
                                        />
                                    ))}
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
                    <span className="drawing-mode-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', fontWeight: 700, fontSize: '12px', padding: '6px 12px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)' }}>
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
                            <span className="total-number">{analysisResult.totalIntersectedCount}</span>
                            <span className="total-label">{t.totalIntersectedLabel}</span>
                        </div>

                        <div className="analysis-breakdown-grid">
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.pointsCount + (analysisResult.placesCount || 0)}</span>
                                <span className="item-type">{t.pointLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.linesCount}</span>
                                <span className="item-type">{t.lineLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.polygonsCount}</span>
                                <span className="item-type">{t.polygonLayerLabel}</span>
                            </div>
                        </div>

                        {analysisResult.details && analysisResult.details.length > 0 && (
                            <div className="analysis-details-list">
                                <h4>Kesişen Nesne Detayları:</h4>
                                <ul>
                                    {analysisResult.details.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="analysis-card-footer">
                        <button className="btn-clear-analysis-action" onClick={handleClearAnalysis}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path>
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

            {/* OpenLayers Harita Container */}
            <div id="map"></div>
        </div>
    );
}

export default App;