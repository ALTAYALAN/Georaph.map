import React, { useState, useEffect } from 'react';
import { DEFAULT_ZOOM_SETTINGS, getZoomSettings, saveZoomSettings } from '../../constants/zoomSettings';

export const ZoomSettingsManagement = ({ lang = 'tr', isDarkMode }) => {
    const isTr = lang === 'tr';
    const [settings, setSettings] = useState(getZoomSettings);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    useEffect(() => {
        setSettings(getZoomSettings());
    }, []);

    const showToast = (text, type = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleChange = (key, value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;
        setSettings(prev => ({ ...prev, [key]: num }));
    };

    const handleSave = () => {
        const ok = saveZoomSettings(settings);
        if (ok) {
            setSavedSuccessfully(true);
            showToast(isTr ? 'Görünürlük ve zoom ayarları başarıyla kaydedildi.' : 'Visibility and zoom settings saved successfully.', 'success');
            setTimeout(() => setSavedSuccessfully(false), 2000);
        } else {
            showToast(isTr ? 'Ayarlar kaydedilirken hata oluştu.' : 'Failed to save settings.', 'error');
        }
    };

    const handleReset = () => {
        setSettings({ ...DEFAULT_ZOOM_SETTINGS });
        saveZoomSettings(DEFAULT_ZOOM_SETTINGS);
        showToast(isTr ? 'Tüm zoom seviyeleri sistem varsayılanlarına sıfırlandı.' : 'All zoom levels reset to system defaults.', 'info');
    };

    const renderSlider = (key, label, description, min = 1, max = 20, step = 0.5) => {
        const val = settings[key] !== undefined ? settings[key] : DEFAULT_ZOOM_SETTINGS[key];
        return (
            <div className="zoom-slider-card">
                <div className="zoom-slider-header">
                    <div className="zoom-slider-info">
                        <label className="zoom-slider-label">{label}</label>
                        <p className="zoom-slider-desc">{description}</p>
                    </div>
                    <div className="zoom-slider-value-badge">
                        <span>Zoom {val.toFixed(1)}</span>
                    </div>
                </div>
                <div className="zoom-slider-control-row">
                    <span className="zoom-scale-mark">1.0</span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={val}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="zoom-range-input"
                    />
                    <span className="zoom-scale-mark">20.0</span>
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={val}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="zoom-number-input"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="zoom-mgmt-container">
            {toastMessage && (
                <div className={`admin-toast ${toastMessage.type}`}>
                    <span>{toastMessage.text}</span>
                </div>
            )}

            <div className="zoom-header">
                <div>
                    <h2 className="zoom-title">{isTr ? 'Harita Görünürlük & Zoom Seviyeleri Yönetimi' : 'Map Visibility & Zoom Level Management'}</h2>
                    <p className="zoom-subtitle">
                        {isTr ? 'Güzergahların, durakların, POI ve çizim işaretlerinin haritada hangi yakınlaştırma (zoom) seviyesinde görünür olacağını yapılandırın.' : 'Configure the minimum zoom levels at which transit lines, stops, POIs, and markers become visible on the map.'}
                    </p>
                </div>
                <div className="zoom-actions">
                    <button className="btn btn-secondary btn-sm" onClick={handleReset} title={isTr ? 'Varsayılanlara Sıfırla' : 'Reset to Defaults'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        <span>{isTr ? 'Varsayılanlara Sıfırla' : 'Reset Defaults'}</span>
                    </button>
                    <button className={`btn btn-sm ${savedSuccessfully ? 'btn-success' : 'btn-primary'}`} onClick={handleSave} title={isTr ? 'Ayarları Kaydet' : 'Save Settings'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        <span>{savedSuccessfully ? (isTr ? 'Kaydedildi' : 'Saved') : (isTr ? 'Değişiklikleri Kaydet' : 'Save Changes')}</span>
                    </button>
                </div>
            </div>

            <div className="zoom-sections-grid">
                {/* 1. GÜZERGAH & HAT GÖRÜNÜRLÜK AYARLARI */}
                <div className="zoom-section-card">
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="13" rx="2" /><path d="M4 9h16" /><circle cx="7.5" cy="14" r="1.3" fill="currentColor" /><circle cx="16.5" cy="14" r="1.3" fill="currentColor" /><path d="M6 17v2.5M18 17v2.5" /></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? 'Ulaşım Güzergahları & Hat Çizgileri' : 'Transit Routes & Line Strings'}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Hatların haritada çizilmeye başlayacağı minimum zoom eşikleri' : 'Minimum zoom thresholds for rendering transit lines'}</p>
                        </div>
                    </div>
                    <div className="zoom-sliders-list">
                        {renderSlider('shipRouteMinZoom', isTr ? 'Gemi & Deniz Hatları' : 'Ferry & Marine Routes', isTr ? 'Deniz rotaları ve vapur hatlarının görünürlük seviyesi' : 'Visibility zoom level for ferry and maritime routes')}
                        {renderSlider('metroRouteMinZoom', isTr ? 'Metro & Raylı Hatlar' : 'Metro & Rail Lines', isTr ? 'Yeraltı ve yerüstü raylı sistem hat çizgileri' : 'Visibility zoom level for metro and rail lines')}
                        {renderSlider('busRouteMinZoom', isTr ? 'Otobüs & Minibüs Hatları' : 'Bus & Transit Lines', isTr ? 'Belediye ve özel halk otobüsü hat çizgileri' : 'Visibility zoom level for bus and transit routes')}
                        {renderSlider('trainRouteMinZoom', isTr ? 'Şehirlerarası Demiryolu' : 'Intercity Rail Lines', isTr ? 'TCDD ana hat ve YHT tren demiryolu hatları' : 'Visibility zoom level for intercity railway lines')}
                        {renderSlider('routeNameMinZoom', isTr ? 'Hat İsim Etiketleri' : 'Route Name Labels', isTr ? 'Hat üstündeki güzergah isim yazısının görünme zoom eşiği' : 'Minimum zoom for displaying route name labels')}
                    </div>
                </div>

                {/* 2. DURAKLAR & İSTASYONLAR GÖRÜNÜRLÜK AYARLARI */}
                <div className="zoom-section-card">
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? 'Duraklar, İskeleler & İstasyonlar' : 'Stops, Piers & Stations'}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Farklı ulaşım türlerine ait durak pinlerinin ve isimlerinin görünme seviyeleri' : 'Visibility zoom levels for transport stops and station pin markers'}</p>
                        </div>
                    </div>
                    <div className="zoom-sliders-list">
                        {renderSlider('shipStopMinZoom', isTr ? 'Liman & İskele Durakları' : 'Port & Ferry Stops', isTr ? 'Deniz limanları, Ro-Ro ve feribot iskeleleri' : 'Visibility zoom level for sea ports and ferry docks')}
                        {renderSlider('metroStopMinZoom', isTr ? 'Metro & Tramvay İstasyonları' : 'Metro & Tram Stations', isTr ? 'Metro istasyon pinlerinin haritada belireceği zoom eşiği' : 'Visibility zoom level for metro stations')}
                        {renderSlider('busStopMinZoom', isTr ? 'Otobüs Durakları' : 'Bus Stops', isTr ? 'Cadde ve sokak otobüs durak simgeleri' : 'Visibility zoom level for bus stop pins')}
                        {renderSlider('trainStopMinZoom', isTr ? 'Tren Garları & İstasyonları' : 'Train Stations', isTr ? 'Tren garı ve banliyö durak işaretleri' : 'Visibility zoom level for railway stations')}
                        {renderSlider('stopNameMinZoom', isTr ? 'Durak İsim Yazıları (Etiketler)' : 'Stop Name Text Labels', isTr ? 'Durak isimlerinin metin olarak haritada okunabilir olacağı zoom' : 'Minimum zoom for displaying stop name text')}
                    </div>
                </div>

                {/* 3. POI (ÖNEMLİ NOKTALAR) AYARLARI */}
                <div className="zoom-section-card">
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? 'Önemli Noktalar (POI)' : 'Points of Interest (POI)'}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Hastaneler, okullar, kamu binaları ve işletmelerin görünürlük seviyeleri' : 'Visibility zoom thresholds for categories and POI markers'}</p>
                        </div>
                    </div>
                    <div className="zoom-sliders-list">
                        {renderSlider('poiCriticalMinZoom', isTr ? 'Kritik POI (Sağlık, Terminal, vb.)' : 'Critical POI (Health, Terminal)', isTr ? 'Hastane, otogar ve acil hizmet noktaları' : 'Visibility zoom level for hospitals and major transport hubs')}
                        {renderSlider('poiMinZoom', isTr ? 'Genel POI İkonları' : 'General POI Icons', isTr ? 'Tüm POI kategori rozetlerinin haritada açılacağı zoom' : 'General visibility zoom level for POI category icons')}
                        {renderSlider('poiNameMinZoom', isTr ? 'POI İsim Etiketleri' : 'POI Name Text Labels', isTr ? 'POI isimlerinin haritada metin olarak belireceği zoom eşiği' : 'Minimum zoom for displaying POI name text labels')}
                    </div>
                </div>

                {/* 4. KULLANICI ÇİZİMLERİ & ALANLAR */}
                <div className="zoom-section-card">
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? 'Çizimler & Özel İşaretler' : 'Custom Drawings & Markers'}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Kullanıcıların eklediği geometrik çizim ve özel işaretlerin görünüm ayarları' : 'Visibility zoom levels for user-created shapes and markers'}</p>
                        </div>
                    </div>
                    <div className="zoom-sliders-list">
                        {renderSlider('drawingPolygonMinZoom', isTr ? 'Alanlar & Poligonlar' : 'Polygons & Areas', isTr ? 'Bölge ve alan çizimlerinin haritada gösterilme zoom eşiği' : 'Visibility zoom level for polygon drawings')}
                        {renderSlider('drawingPointMinZoom', isTr ? 'Noktalar & Özel Markerlar' : 'Points & Custom Markers', isTr ? 'Özel nokta ve marker simgelerinin gösterilme zoom eşiği' : 'Visibility zoom level for point drawings')}
                        {renderSlider('drawingLabelMinZoom', isTr ? 'Çizim İsim Etiketleri' : 'Drawing Text Labels', isTr ? 'Çizim başlık ve açıklamalarının haritada gösterilme zoom eşiği' : 'Minimum zoom level for drawing labels')}
                    </div>
                </div>
            </div>
        </div>
    );
};
