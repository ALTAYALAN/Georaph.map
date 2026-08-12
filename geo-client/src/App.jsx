import { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Icon, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import Draw from 'ol/interaction/Draw';
import WKT from 'ol/format/WKT';

// PrimeReact Bileşenleri
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

import './App.css';

function App() {
    // PrimeReact Toast Referansı
    const toastRef = useRef(null);

    // Tema (Karanlık / Aydınlık Mod) Durumu
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // Kullanıcı ve Token Durumları (State)
    const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false); // Giriş Başarılı Geçiş Animasyonu Durumu

    // Oturum Kalan Süresi (Saniye Cinsinden)
    const [timeLeft, setTimeLeft] = useState(0);

    // Harita Formu Durumları (Tekil Mekan Ekleme)
    const [placeName, setPlaceName] = useState('');
    const [coords, setCoords] = useState({ lon: 33.2433, lat: 38.9637 }); // Varsayılan Türkiye
    const [infoMessage, setInfoMessage] = useState('');
    const [savedPlaces, setSavedPlaces] = useState([]); // Veritabanından gelen kayıtlı mekanlar

    // OpenLayers Çizim İşlemleri (Interactions - Point, Line, Polygon)
    const [drawType, setDrawType] = useState('None'); // 'None', 'Point', 'LineString', 'Polygon'
    const [savedDrawings, setSavedDrawings] = useState([]); // tbl_point, tbl_line, tbl_polygon verileri
    const [activeTab, setActiveTab] = useState('places'); // 'places' veya 'drawings'
    const [deleteTarget, setDeleteTarget] = useState(null); // Error Prevention Modal için silinecek hedef öğe

    // Yüzen Alt Kutu & Taslak Çizim Durumları
    const [drawingName, setDrawingName] = useState('');
    const [draftWkt, setDraftWkt] = useState('');
    const draftFeatureRef = useRef(null);

    // OpenLayers harita ve vektör katmanı referansları
    const mapRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const savedPlacesSourceRef = useRef(null);
    const drawingsSourceRef = useRef(null);
    const drawInteractionRef = useRef(null);

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

    // PrimeReact Toast Bildirimi Tetikleme
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

    // MANÜEL LOGIN İŞLEMİ (ÇIKIŞ ANİMASYONLU)
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

                // Yarım saniyelik (500ms) sembolik noktaların dışarı çıkış animasyonunu başlat
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

    // Dakika:Saniye Formatlama
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const tileLayerRef = useRef(null);

    // TEMA DEĞİŞTİĞİNDE HARİTA ALTLIK KATMANINI VE LOCALSTORAGE'I GÜNCELLE
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

        const map = new Map({
            target: 'map',
            layers: [
                baseTileLayer,
                new VectorLayer({
                    source: savedPlacesSource,
                    style: new Style({
                        image: new Icon({
                            src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#16a34a" stroke="#ffffff" stroke-width="2.5"/><circle cx="17" cy="17" r="6.5" fill="#ffffff"/></svg>`),
                            scale: 0.75,
                            anchor: [0.5, 1]
                        })
                    })
                }),
                new VectorLayer({
                    source: drawingsSource
                }),
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

        // Haritaya tıklanınca koordinat alma (Çizim modu etkin değilse)
        map.on('click', function (evt) {
            const lonLat = toLonLat(evt.coordinate);
            setCoords({
                lon: parseFloat(lonLat[0].toFixed(6)),
                lat: parseFloat(lonLat[1].toFixed(6))
            });
        });

        return () => map.setTarget(null);
    }, [token]);

    // SEÇİLİ MAVİ PIN İŞARETÇİSİNİ GÜNCELLE
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
              <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
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
    }, [coords, token]);

    // KAYITLI MEKANLARI (PLACES) HARİTADA GÖSTER
    useEffect(() => {
        if (!savedPlacesSourceRef.current) return;
        savedPlacesSourceRef.current.clear();

        const greenPinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#16a34a" stroke="#ffffff" stroke-width="2.5"/>
          <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
        </svg>`;

        savedPlaces.forEach((place) => {
            const feature = new Feature({
                geometry: new Point(fromLonLat([place.longitude, place.latitude])),
                name: place.name
            });

            feature.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(greenPinSvg),
                    scale: 0.75,
                    anchor: [0.5, 1]
                })
            }));

            savedPlacesSourceRef.current.addFeature(feature);
        });
    }, [savedPlaces]);

    // KAYITLI ÇİZİMLERİ (Point, Line, Polygon - WKT) HARİTADA GÖSTER & DÖNÜŞTÜR (EPSG:4326 -> EPSG:3857)
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

                if (item.type === 'Point') {
                    feature.setStyle(new Style({
                        image: new CircleStyle({
                            radius: 8,
                            fill: new Fill({ color: '#ef4444' }),
                            stroke: new Stroke({ color: '#ffffff', width: 2.5 })
                        })
                    }));
                } else if (item.type === 'Line') {
                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: '#3b82f6',
                            width: 4
                        })
                    }));
                } else if (item.type === 'Polygon') {
                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: '#10b981',
                            width: 3
                        }),
                        fill: new Fill({
                            color: 'rgba(16, 185, 129, 0.35)'
                        })
                    }));
                }

                drawingsSourceRef.current.addFeature(feature);
            } catch (err) {
                console.error(`WKT okuma hatası (${item.id}):`, err);
            }
        });
    }, [savedDrawings]);

    // ÇİZİMİ TAMAMEN İPTAL ETME VE TEMİZLEME FONKSİYONU
    const handleCancelDraw = () => {
        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.abortDrawing();
            } catch (e) {
                console.log('Abort draw exception suppressed:', e);
            }
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
        setDrawType('None');
        setInfoMessage('Çizim modu iptal edildi.');
    };

    // OPENLAYERS INTERACTION YÖNETİMİ
    useEffect(() => {
        if (!mapRef.current || !drawingsSourceRef.current) return;

        // Mevcut aktif çizim etkileşimini kaldır ve iptal et
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

        // Çizim modu değiştikçe yeni isim önerisi hazırlar
        const typeLabel = drawType === 'Point' ? 'Nokta' : drawType === 'LineString' ? 'Çizgi' : 'Poligon';
        setDrawingName(`${typeLabel} Çizimi - ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
        setDraftWkt('');

        // Seçilen türe göre Draw Etkileşimi Başlat
        const drawInteraction = new Draw({
            source: drawingsSourceRef.current,
            type: drawType
        });

        drawInteraction.on('drawstart', (event) => {
            draftFeatureRef.current = event.feature;
        });

        // Çizim Tamamlandığında (drawend) WKT Alır ve Alt Yüzen Kutuya Yazar
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

    // YÜZEN KUTUDAN VERİTABANINA KAYDETME (POST /api/drawings)
    const handleSaveDrawingFromFloatingBox = async () => {
        if (!drawType || drawType === 'None') return;

        // Çizim etkileşimi henüz bitmediyse aktif çizimi resmi olarak sonlandır (fare imleci uzantısını temizler)
        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.finishDrawing();
            } catch (e) { }
        }

        let wktToSend = draftWkt;

        // Eğer henüz drawend tetiklenmediyse fakat taslak çizim varsa WKT oluştur
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
                    wkt: wktToSend
                })
            });

            const data = await response.json();
            if (response.ok) {
                setInfoMessage(`${typeLabel} veritabanına (${drawType === 'Point' ? 'tbl_point' : drawType === 'LineString' ? 'tbl_line' : 'tbl_polygon'}) başarıyla kaydedildi!`);
                draftFeatureRef.current = null;
                setDraftWkt('');
                setDrawingName('');
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
        } catch (err) {
            console.error('Odaklanma hatası:', err);
        }
    };

    // SİLME UYARISI (ERROR PREVENTION MODAL - TRIGGER)
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

    // SİLME İŞLEMİNİ ONAYLAMA VE GERÇEKLEŞTİRME
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

    // NOKTA VE MEKAN KAYDETME (POST /api/places)
    const handleSavePlace = async (e) => {
        e.preventDefault();
        setInfoMessage('');

        try {
            const lon = parseFloat(coords.lon);
            const lat = parseFloat(coords.lat);
            const wktString = `POINT(${lon} ${lat})`;

            const responsePlaces = await fetch('http://localhost:5041/api/places', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: placeName,
                    wkt: wktString,
                    longitude: lon,
                    latitude: lat
                })
            });

            const data = await responsePlaces.json();

            if (responsePlaces.ok) {
                setInfoMessage(data.message || 'Nokta konumu veritabanına başarıyla kaydedildi!');
                setPlaceName('');
                fetchPlaces();
            } else {
                setInfoMessage(data.message || 'Kayıt başarısız oldu.');
            }
        } catch (err) {
            setInfoMessage('Veri gönderilirken bir hata oluştu: ' + err.message);
        }
    };

    // 1. DURUM: KULLANICI GİRİŞ YAPMAMIŞSA VEYA GEÇİŞ ANİMASYONUNDAYSA (LOGIN EKRANI)
    if (!token || isLoggingIn) {
        return (
            <div className={`login-wrapper ${isLoggingIn ? 'is-logging-in' : ''}`}>
                <Toast ref={toastRef} />
                <div className="login-sidebar">
                    <div className="login-brand">
                        <h1 className="brand-title">Georaph.map</h1>
                        <p className="brand-subtitle">Coğrafi Konum ve Mekan Yönetim Platformu</p>
                    </div>

                    <div className="login-card">
                        <h2>Giriş Yap</h2>
                        {error && <div className="error-msg">{error}</div>}
                        <form onSubmit={handleLogin}>
                            <div className="input-group">
                                <label className="input-label">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    placeholder="Kullanıcı adınızı girin"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Şifre</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="login-btn">Sisteme Giriş Yap</button>
                        </form>
                    </div>

                    <div className="login-footer">
                        <span>&copy; {new Date().getFullYear()} Georaph.map. Tüm hakları saklıdır.</span>
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

                        <text x="520" y="295" fill="rgba(147, 197, 253, 0.9)" fontSize="11" fontFamily="monospace" fontWeight="600">39.9207° N, 32.8541° E</text>
                        <text x="620" y="145" fill="rgba(147, 197, 253, 0.8)" fontSize="10" fontFamily="monospace">41.0082° N, 28.9784° E</text>
                        <text x="770" y="395" fill="rgba(147, 197, 253, 0.8)" fontSize="10" fontFamily="monospace">38.4237° N, 27.1428° E</text>
                    </svg>

                    <div className="map-overlay-vignette"></div>
                </div>
            </div>
        );
    }

    // 2. DURUM: GİRİŞ BAŞARILIYSA (HARİTA EKRANI)
    return (
        <div className={`map-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <Toast ref={toastRef} />
            {/* Sol Panel */}
            <div className="map-sidebar">
                <div className="map-sidebar-top">
                    {/* Marka Header & Tema Değiştirme Butonu */}
                    <div className="map-brand-header">
                        <h2 className="map-brand-title">Georaph.map</h2>
                        <button
                            className="theme-toggle-btn"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? "Aydınlık Moduna Geç" : "Karanlık Moduna Geç"}
                        >
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                    </div>

                    {/* Oturum Süresi Geri Sayım Rozeti */}
                    <div className="session-timer-badge">
                        <div className="timer-label">
                            <span className="live-dot"></span>
                            <span>Oturum Süresi:</span>
                        </div>
                        <strong>{formatTime(timeLeft)}</strong>
                    </div>

                    <div className="sidebar-divider"></div>

                    <div className="add-place-section">
                        <h3 className="section-title">Nokta Mekan Kaydı</h3>
                        <p className="section-subtitle">
                            Haritada bir noktaya tıklayarak enlem/boylam seçebilirsiniz.
                        </p>

                        <form onSubmit={handleSavePlace}>
                            <div className="input-group">
                                <label className="input-label">Mekan Adı</label>
                                <input
                                    type="text"
                                    value={placeName}
                                    onChange={(e) => setPlaceName(e.target.value)}
                                    placeholder="Örn: Anıtkabir, Kızılay"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Boylam (Longitude)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={coords.lon}
                                    onChange={(e) => setCoords(prev => ({ ...prev, lon: e.target.value }))}
                                    placeholder="Örn: 33.2433"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Enlem (Latitude)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={coords.lat}
                                    onChange={(e) => setCoords(prev => ({ ...prev, lat: e.target.value }))}
                                    placeholder="Örn: 38.9637"
                                    required
                                />
                            </div>

                            <button type="submit" className="map-btn btn-save">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Konumu Kaydet
                            </button>
                        </form>
                    </div>

                    <div className="sidebar-divider"></div>

                    {/* BİRLEŞİK KAYITLI KONUMLAR VE ÇİZİMLER LİSTESİ */}
                    <div className="saved-places-section">
                        <div className="section-header">
                            <h3 className="section-title">Kayıtlı Konumlar</h3>
                            <span className="places-count-badge">{savedPlaces.length + savedDrawings.length} Kayıt</span>
                        </div>

                        {savedPlaces.length === 0 && savedDrawings.length === 0 ? (
                            <p className="no-places-msg">Henüz kayıtlı konum bulunmuyor.</p>
                        ) : (
                            <div className="saved-places-list">
                                {/* Kayıtlı Mekanlar */}
                                {savedPlaces.map((place) => (
                                    <div
                                        key={`place-${place.id}`}
                                        className="saved-place-item"
                                        onClick={() => handleSelectSavedPlace(place)}
                                    >
                                        <div className="place-item-icon">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                        </div>
                                        <div className="place-item-info" style={{ flex: 1 }}>
                                            <span className="place-item-name">{place.name}</span>
                                            <span className="place-item-coords">
                                                {place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}°
                                            </span>
                                        </div>
                                        <button
                                            className="btn-delete-drawing"
                                            onClick={(e) => triggerDeletePlace(place, e)}
                                            title="Konumu Sil"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                ))}

                                {/* Kayıtlı Çizimler (Line, Polygon) - Kayıtlı Konumlar Tasarımında */}
                                {savedDrawings.map((drawing) => (
                                    <div
                                        key={`drawing-${drawing.type}-${drawing.id}`}
                                        className="saved-place-item"
                                        onClick={() => handleSelectDrawing(drawing)}
                                    >
                                        <div className="place-item-icon">
                                            {drawing.type === 'Line' ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M4 20L20 4" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 22 8.5 18 19 6 19 2 8.5" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="place-item-info" style={{ flex: 1 }}>
                                            <span className="place-item-name">{drawing.name}</span>
                                            <span className="place-item-coords">
                                                {drawing.type === 'Line' ? 'Çizgi Çizimi (WKT)' : 'Poligon Çizimi (WKT)'}
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
                        Çıkış Yap
                    </button>
                </div>
            </div>

            {/* HARİTA ÜZERİNDEKİ YÜZEN ÇİZİM BUTONLARI (SAĞ ÜST) */}
            <div className="map-draw-toolbar-floating">
                <button
                    className={`map-tool-icon-btn ${drawType === 'LineString' ? 'active' : ''}`}
                    onClick={() => {
                        if (drawType === 'LineString') handleCancelDraw();
                        else setDrawType('LineString');
                    }}
                    title="Çizgi Çizimi (tbl_line)"
                >
                    📏
                </button>
                <button
                    className={`map-tool-icon-btn ${drawType === 'Polygon' ? 'active' : ''}`}
                    onClick={() => {
                        if (drawType === 'Polygon') handleCancelDraw();
                        else setDrawType('Polygon');
                    }}
                    title="Poligon Çizimi (tbl_polygon)"
                >
                    ⬡
                </button>
            </div>

            {/* ÇİZİM MODU AÇILDIĞINDA ALT KISIMDA GÖRÜNEN YÜZEN KAYIT VE İPTAL KUTUSU */}
            {drawType !== 'None' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDblClick={(e) => e.stopPropagation()}
                >
                    <div className="floating-draw-header">
                        <span className="drawing-mode-badge">
                            {drawType === 'Point' && 'Nokta Çizim Modu'}
                            {drawType === 'LineString' && 'Çizgi Çizim Modu'}
                            {drawType === 'Polygon' && 'Poligon Çizim Modu'}
                        </span>
                        <span className="floating-hint">
                            {draftWkt ? '✓ Çizim yapıldı, kaydedebilirsiniz.' : 'Haritada tıklayarak çizimi yapın.'}
                        </span>
                    </div>

                    <div className="floating-draw-form">
                        <input
                            type="text"
                            className="floating-input"
                            value={drawingName}
                            onChange={(e) => setDrawingName(e.target.value)}
                            placeholder="Çizim Adı Girin..."
                        />
                        <div className="floating-btn-group">
                            <button
                                className="floating-action-btn btn-save-draw"
                                onClick={handleSaveDrawingFromFloatingBox}
                            >
                                Veritabanına Kaydet
                            </button>
                            <button
                                className="floating-action-btn btn-cancel-draw-bar"
                                onClick={handleCancelDraw}
                            >
                                ❌ İptal Et
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (SİLME ONAYI PENCERESİ) */}
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

            {/* OpenLayers Haritası */}
            <div id="map"></div>
        </div>
    );
}

export default App;