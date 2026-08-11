import { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import './App.css';

function App() {
    // Kullanıcı ve Token Durumları (State)
    const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Oturum Kalan Süresi (Saniye Cinsinden)
    const [timeLeft, setTimeLeft] = useState(0);

    // Harita Formu Durumları
    const [placeName, setPlaceName] = useState('');
    const [coords, setCoords] = useState({ lon: 32.8597, lat: 39.9334 }); // Varsayılan Ankara
    const [infoMessage, setInfoMessage] = useState('');

    // OpenLayers harita nesnesini referans olarak tutuyoruz
    const mapRef = useRef(null);

    //  OTURUM SÜRESİ KONTROLÜ VE GERİ SAYIM ZAMANLAYICISI (10 Dakika)
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
                // OTURUM SÜRESİ DOLDU - Otomatik Çıkış Yap
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('session_expiration');
                setToken('');
                setError('Oturum süreniz sona erdi.');
            } else {
                setTimeLeft(remainingSeconds);
            }
        };

        // Sayfa açıldığında ilk kontrolü yap
        checkSessionExpiration();

        // Her 1 saniyede bir geri sayımı güncelle
        const interval = setInterval(checkSessionExpiration, 1000);

        return () => clearInterval(interval);
    }, [token]);

    // MANÜEL LOGIN İŞLEMİ (10 Dakikalık Oturum Başlatma)
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
                // 10 Dakika = 600.000 Milisaniye
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const expirationTimestamp = Date.now() + TEN_MINUTES_MS;

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('session_expiration', expirationTimestamp.toString());

                setToken(data.token);
                setTimeLeft(600); // 600 saniye = 10 dakika
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

    // Dakika:Saniye Formatlama (örn: 09:45)
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // OPENLAYERS HARİTA KURULUMU (Sadece giriş yapıldıysa çalışır)
    useEffect(() => {
        if (!token) return;

        const map = new Map({
            target: 'map',
            layers: [
                new TileLayer({
                    source: new OSM()
                })
            ],
            view: new View({
                center: fromLonLat([35.2433, 38.9637]),
                zoom: 6
            })
        });

        mapRef.current = map;

        map.on('click', function (evt) {
            const coordinate = map.getCoordinateFromPixel(evt.pixel);
            const lonLat = map.getView().getProjection().toGlobalLonLat(coordinate);

            setCoords({
                lon: parseFloat(lonLat[0].toFixed(6)),
                lat: parseFloat(lonLat[1].toFixed(6))
            });
        });

        return () => map.setTarget(null);
    }, [token]);

    // HARİTADAN ALINAN VERİYİ JWT TOKEN İLE BACKEND'E KAYDETME (POST)
    const handleSavePlace = async (e) => {
        e.preventDefault();
        setInfoMessage('');

        try {
            const response = await fetch('http://localhost:5041/api/places', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: placeName,
                    longitude: coords.lon,
                    latitude: coords.lat
                })
            });

            const data = await response.json();
            if (response.ok) {
                setInfoMessage('Mekan veritabanına JWT yetkisiyle başarıyla kaydedildi!');
                setPlaceName('');
            } else {
                setInfoMessage('Kayıt başarısız: ' + (data.message || response.statusText));
            }
        } catch (err) {
            setInfoMessage('Veri gönderilirken bir hata oluştu.');
        }
    };

    // 1. DURUM: KULLANICI GİRİŞ YAPMAMIŞSA (LOGIN EKRANI)
    if (!token) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h2>GeoMap Giriş</h2>
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Kullanıcı Adı"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="Şifre"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn">Giriş Yap</button>
                    </form>
                </div>
            </div>
        );
    }

    // 2. DURUM: GİRİŞ BAŞARILIYSA (OPENLAYERS HARİTA EKRANI)
    return (
        <div className="map-container">
            {/* Sol Panel: Veri Girişi Formu & Oturum Sayacı */}
            <div className="map-sidebar">
                {/* Oturum Süresi Geri Sayım Rozeti */}
                <div className="session-timer-badge">
                    <span>Oturum Süresi:</span>
                    <strong>{formatTime(timeLeft)}</strong>
                </div>

                <h3>Mekan Ekle</h3>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 15px 0' }}>
                    Haritada bir yere tıklayarak koordinat seçebilirsiniz.
                </p>

                <form onSubmit={handleSavePlace}>
                    <div className="input-group">
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Mekan Adı:</label>
                        <input
                            type="text"
                            value={placeName}
                            onChange={(e) => setPlaceName(e.target.value)}
                            placeholder="Örn: Millet Kütüphanesi"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <span style={{ fontSize: '13px' }}><strong>Boylam (Lon):</strong> {coords.lon}</span><br />
                        <span style={{ fontSize: '13px' }}><strong>Enlem (Lat):</strong> {coords.lat}</span>
                    </div>
                    <button type="submit" className="login-btn" style={{ background: '#28a745' }}>
                        Konumu Veritabanına Yaz
                    </button>
                </form>

                {infoMessage && <p style={{ marginTop: '10px', color: 'blue', fontSize: '14px' }}>{infoMessage}</p>}

                <button onClick={() => handleLogout()} className="login-btn" style={{ background: '#dc3545', marginTop: '20px', padding: '8px' }}>
                    Güvenli Çıkış Yap
                </button>
            </div>

            {/* OpenLayers Haritasının Çizileceği Ana Div */}
            <div id="map"></div>
        </div>
    );
}

export default App;