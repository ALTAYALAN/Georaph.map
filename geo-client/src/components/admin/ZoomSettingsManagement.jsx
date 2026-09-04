import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_ZOOM_SETTINGS, getZoomSettings, saveZoomSettings } from '../../constants/zoomSettings';
import { POI_FILTER_CATEGORIES, getGlyphByIconId, getMergedPoiCategories } from '../../constants/poiIcons';
import { adminApi } from '../../services/adminApi';

export const ZoomSettingsManagement = ({ lang = 'tr', isDarkMode, token, poiCategories = [] }) => {
    const isTr = lang === 'tr';
    const [settings, setSettings] = useState(getZoomSettings);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [dbCategories, setDbCategories] = useState(poiCategories);

    useEffect(() => {
        setSettings(getZoomSettings());
    }, []);

    // Veritabanından güncel kategorileri yükleme
    useEffect(() => {
        let isMounted = true;
        const loadCategories = async () => {
            try {
                const cats = await adminApi.getPoiCategories(false, token);
                if (isMounted && Array.isArray(cats) && cats.length > 0) {
                    setDbCategories(cats);
                }
            } catch (err) {
                console.warn('ZoomSettings: Could not fetch dynamic POI categories:', err);
            }
        };

        if (token || !dbCategories || dbCategories.length === 0) {
            loadCategories();
        }

        const handleCategoriesUpdated = () => {
            loadCategories();
        };

        window.addEventListener('poiCategoriesUpdated', handleCategoriesUpdated);
        return () => {
            isMounted = false;
            window.removeEventListener('poiCategoriesUpdated', handleCategoriesUpdated);
        };
    }, [token]);

    const allCategories = useMemo(() => {
        return getMergedPoiCategories(dbCategories);
    }, [dbCategories]);

    const showToast = (text, type = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleChange = (key, value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;
        setSettings(prev => {
            const updated = { ...prev, [key]: num };
            // Anında hafızaya ve haritaya canlı kaydet
            saveZoomSettings(updated);
            return updated;
        });
    };

    const handleSave = () => {
        const ok = saveZoomSettings(settings);
        if (ok) {
            setSavedSuccessfully(true);
            showToast(isTr ? 'Görünürlük ve zoom ayarları başarıyla kaydedildi.' : 'Visibility and zoom settings saved successfully.', 'success');
            setTimeout(() => setSavedSuccessfully(false), 2500);
        } else {
            showToast(isTr ? 'Ayarlar kaydedilirken hata oluştu.' : 'Failed to save settings.', 'error');
        }
    };

    const handleReset = () => {
        if (window.confirm(isTr ? 'Tüm zoom seviyelerini sistem varsayılanlarına sıfırlamak istediğinize emin misiniz?' : 'Are you sure you want to reset all zoom levels to system defaults?')) {
            setSettings({ ...DEFAULT_ZOOM_SETTINGS });
            saveZoomSettings(DEFAULT_ZOOM_SETTINGS);
            showToast(isTr ? 'Tüm zoom seviyeleri sistem varsayılanlarına sıfırlandı.' : 'All zoom levels reset to system defaults.', 'info');
        }
    };

    const renderSlider = (key, label, description, min = 1, max = 20, step = 0.5, iconBadge = null) => {
        const val = settings[key] !== undefined ? settings[key] : (DEFAULT_ZOOM_SETTINGS[key] !== undefined ? DEFAULT_ZOOM_SETTINGS[key] : 6.0);
        return (
            <div className="zoom-slider-card">
                <div className="zoom-slider-header">
                    <div className="zoom-slider-info-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {iconBadge && (
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: `${iconBadge.color}20`,
                                    border: `1px solid ${iconBadge.color}40`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: iconBadge.color,
                                    flexShrink: 0
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <g dangerouslySetInnerHTML={{ __html: iconBadge.glyph }} />
                                </svg>
                            </div>
                        )}
                        <div className="zoom-slider-info">
                            <label className="zoom-slider-label">{label}</label>
                            <p className="zoom-slider-desc">{description}</p>
                        </div>
                    </div>
                    <div className="zoom-slider-value-badge" style={{ background: savedSuccessfully ? '#10b98122' : undefined, borderColor: savedSuccessfully ? '#10b98166' : undefined }}>
                        <span style={{ color: savedSuccessfully ? '#10b981' : undefined }}>Zoom {val.toFixed(1)}</span>
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

    // POI Kategorileri Açıklamaları
    const poiCategoryDescriptions = {
        alisveris: { tr: 'Alışveriş merkezleri (AVM), butikler, giyim, kuyumcu ve mağazalar', en: 'Shopping malls, boutiques, apparel, jewelry and retail stores' },
        market: { tr: 'Süpermarketler, bakkallar, şarküteri ve gıda perakendecileri', en: 'Supermarkets, groceries, delis and food stores' },
        hastane: { tr: 'Hastaneler, klinikler, sağlık ocakları ve acil servis noktaları', en: 'Hospitals, clinics, health centers and emergency services' },
        eczane: { tr: 'Eczaneler, ilaç ve medikal malzeme tedarik noktaları', en: 'Pharmacies and medical supply stores' },
        okul: { tr: 'Okullar, liseler, üniversiteler ve eğitim kampüsleri', en: 'Schools, high schools, universities and campuses' },
        muze: { tr: 'Müzeler, ören yerleri ve arkeolojik sergi alanları', en: 'Museums, ruins and archaeological sites' },
        kutuphane: { tr: 'Halk ve üniversite kütüphaneleri, araştırma arşivleri', en: 'Public & university libraries and archives' },
        sanat: { tr: 'Kültür ve sanat merkezleri, tiyatrolar, sergi salonları', en: 'Arts and cultural centers, theaters and galleries' },
        anit: { tr: 'Tarihi anıtlar, heykeller, abideler ve türbeler', en: 'Monuments, statues, memorials and shrines' },
        spor: { tr: 'Stadyumlar, spor sahaları, kortlar ve fitness salonları', en: 'Stadiums, sports fields, courts and gyms' },
        akaryakit: { tr: 'Benzin istasyonları, akaryakıt ve elektrikli araç şarj noktaları', en: 'Gas stations, fuel and EV charging points' },
        oto_servis: { tr: 'Oto tamirhaneleri, sanayi siteleri, oto yıkama ve servisler', en: 'Car repair shops, auto services and car washes' },
        otopark: { tr: 'Açık/kapalı otoparklar, katlı otoparklar ve park alanları', en: 'Open/covered parking lots and multistory garages' },
        atm: { tr: 'Banka şubeleri, ATM\'ler ve finansal hizmet noktaları', en: 'Banks, ATMs and financial service points' },
        plaj: { tr: 'Plajlar, halk kumsalları, koylar ve sahil rekreasyon alanları', en: 'Beaches, coves, coastal spots and marinas' },
        kafe: { tr: 'Kafeler, kahve dükkanları ve pastaneler', en: 'Cafes, coffee shops and bakeries' },
        restoran: { tr: 'Restoranlar, lokantalar ve yeme-içme mekanları', en: 'Restaurants, dining and eateries' },
        otel: { tr: 'Oteller, tatil köyleri, pansiyonlar ve konaklama tesisleri', en: 'Hotels, resorts and accommodations' },
        park: { tr: 'Şehir parkları, botanik bahçeleri, korular ve mesire alanları', en: 'City parks, botanical gardens and nature reserves' },
        dini: { tr: 'Camiler, mescitler, tarihi ibadethaneler ve külliyeler', en: 'Mosques, shrines, historical places of worship' },
        kamu: { tr: 'Belediyeler, valilikler, adliyeler, PTT ve resmi kurumlar', en: 'Municipalities, courts, post offices and public offices' }
    };

    return (
        <div className="zoom-mgmt-container" style={{ paddingBottom: '90px', position: 'relative' }}>
            {toastMessage && (
                <div className={`admin-toast ${toastMessage.type}`} style={{ zIndex: 9999 }}>
                    <span>{toastMessage.text}</span>
                </div>
            )}

            <div className="zoom-header">
                <div>
                    <h2 className="zoom-title">{isTr ? 'Harita Görünürlük & Zoom Seviyeleri Yönetimi' : 'Map Visibility & Zoom Level Management'}</h2>
                    <p className="zoom-subtitle">
                        {isTr ? 'Güzergahların, durakların, 16 farklı POI kategorisinin ve çizim işaretlerinin haritada hangi zoom seviyesinde belireceğini yapılandırın. (Değerler otomatik olarak canlı kaydedilir).' : 'Configure the minimum zoom levels at which transit lines, stops, 16 POI categories, and markers become visible on the map. (Values auto-save instantly).'}
                    </p>
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
                        {renderSlider('flightRouteMinZoom', isTr ? 'Havayolu & Uçak Hatları' : 'Airways & Flight Corridors', isTr ? 'Hava koridorları ve uçak uçuş hatlarının görünürlük seviyesi' : 'Visibility zoom level for air corridors and flight routes')}
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
                        {renderSlider('airportStopMinZoom', isTr ? 'Havalimanı & Terminal Durakları' : 'Airports & Terminal Stops', isTr ? 'Uluslararası ve bölgesel havalimanları terminal pinleri' : 'Visibility zoom level for airport and terminal stop pins')}
                        {renderSlider('shipStopMinZoom', isTr ? 'Liman & İskele Durakları' : 'Port & Ferry Stops', isTr ? 'Deniz limanları, Ro-Ro ve feribot iskeleleri' : 'Visibility zoom level for sea ports and ferry docks')}
                        {renderSlider('metroStopMinZoom', isTr ? 'Metro & Tramvay İstasyonları' : 'Metro & Tram Stations', isTr ? 'Metro istasyon pinlerinin haritada belireceği zoom eşiği' : 'Visibility zoom level for metro stations')}
                        {renderSlider('busStopMinZoom', isTr ? 'Otobüs Durakları' : 'Bus Stops', isTr ? 'Cadde ve sokak otobüs durak simgeleri' : 'Visibility zoom level for bus stop pins')}
                        {renderSlider('trainStopMinZoom', isTr ? 'Tren Garları & İstasyonları' : 'Train Stations', isTr ? 'Tren garı ve banliyö durak işaretleri' : 'Visibility zoom level for railway stations')}
                        {renderSlider('stopNameMinZoom', isTr ? 'Durak İsim Yazıları (Etiketler)' : 'Stop Name Text Labels', isTr ? 'Durak isimlerinin metin olarak haritada okunabilir olacağı zoom' : 'Minimum zoom for displaying stop name text')}
                    </div>
                </div>

                {/* 3. POI KATEGORİLERİ GÖRÜNÜRLÜK AYARLARI (16 AYRI KATEGORİ) */}
                <div className="zoom-section-card" style={{ gridColumn: 'span 2' }}>
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? `İlgi Noktaları (POI) - (${allCategories.length}) Kategori Zoom Seviyeleri` : `Points of Interest (POI) - (${allCategories.length}) Category Zoom Levels`}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Her bir POI kategorisinin (yeni eklenen dinamik kategoriler dahil) ve isim etiketlerinin haritada hangi zoom seviyesinde belireceğini bağımsız olarak özelleştirin.' : 'Individually customize the visibility zoom thresholds for each POI category (including newly added dynamic categories) and labels.'}</p>
                        </div>
                    </div>
                    
                    {/* Genel POI Ayarları */}
                    <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                            {renderSlider('poiNameMinZoom', isTr ? 'POI İsim Yazıları (Etiketler)' : 'POI Name Text Labels', isTr ? 'POI isimlerinin haritada metin olarak belireceği zoom eşiği' : 'Minimum zoom for displaying POI name text labels')}
                            {renderSlider('poiMinZoom', isTr ? 'Genel / Tanımsız POI İkonları' : 'General / Unclassified POI Icons', isTr ? 'Özel kategorisi bulunmayan diğer POI rozetlerinin zoom eşiği' : 'Fallback zoom level for unclassified POIs')}
                        </div>
                    </div>

                    {/* Kategori Slider Listesi (Standart + Veritabanına Yeni Eklenenler) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
                        {allCategories.map(cat => {
                            const glyph = getGlyphByIconId(cat.iconId);
                            const desc = poiCategoryDescriptions[cat.key] 
                                ? (isTr ? poiCategoryDescriptions[cat.key].tr : poiCategoryDescriptions[cat.key].en) 
                                : (cat.description || (isTr ? `${cat.label} noktalarının haritada görünürlük seviyesi` : `Visibility zoom level for ${cat.label} points`));
                            return (
                                <React.Fragment key={cat.key}>
                                    {renderSlider(
                                        `poi_${cat.key}_minZoom`,
                                        cat.label,
                                        desc,
                                        1,
                                        20,
                                        0.5,
                                        { glyph, color: cat.color || '#8b5cf6' }
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* 4. KULLANICI ÇİZİMLERİ & ALANLAR */}
                <div className="zoom-section-card" style={{ gridColumn: 'span 2' }}>
                    <div className="zoom-section-header">
                        <div className="zoom-section-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                        </div>
                        <div>
                            <h3 className="zoom-section-title">{isTr ? 'Çizimler & Özel İşaretler' : 'Custom Drawings & Markers'}</h3>
                            <p className="zoom-section-sub">{isTr ? 'Kullanıcıların eklediği geometrik çizim ve özel işaretlerin görünüm ayarları' : 'Visibility zoom levels for user-created shapes and markers'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        {renderSlider('drawingPolygonMinZoom', isTr ? 'Alanlar & Poligonlar' : 'Polygons & Areas', isTr ? 'Bölge ve alan çizimlerinin haritada gösterilme zoom eşiği' : 'Visibility zoom level for polygon drawings')}
                        {renderSlider('drawingPointMinZoom', isTr ? 'Noktalar & Özel Markerlar' : 'Points & Custom Markers', isTr ? 'Özel nokta ve marker simgelerinin gösterilme zoom eşiği' : 'Visibility zoom level for point drawings')}
                        {renderSlider('drawingLabelMinZoom', isTr ? 'Çizim İsim Etiketleri' : 'Drawing Text Labels', isTr ? 'Çizim başlık ve açıklamalarının haritada gösterilme zoom eşiği' : 'Minimum zoom level for drawing labels')}
                    </div>
                </div>
            </div>

            {/* STICKY BOTTOM SAVE ACTION BAR */}
            <div style={{
                position: 'fixed',
                bottom: '16px',
                right: '24px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                background: isDarkMode ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '12px',
                boxShadow: isDarkMode ? '0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)' : '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
            }}>
                <div className="zoom-live-badge">
                    <span className="zoom-live-dot" />
                    <span>{isTr ? 'Canlı Senkronize' : 'Live Synced'}</span>
                </div>
                <button
                    className="btn-modern-secondary"
                    onClick={handleReset}
                    title={isTr ? 'Varsayılanlara Sıfırla' : 'Reset to Defaults'}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    <span>{isTr ? 'Varsayılanlar' : 'Defaults'}</span>
                </button>
                <button
                    className={savedSuccessfully ? 'btn-modern-success' : 'btn-modern-primary'}
                    onClick={handleSave}
                    title={isTr ? 'Ayarları Kaydet' : 'Save Settings'}
                >
                    {savedSuccessfully ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    )}
                    <span>{savedSuccessfully ? (isTr ? 'Kaydedildi' : 'Saved') : (isTr ? 'Değişiklikleri Kaydet' : 'Save Changes')}</span>
                </button>
            </div>
        </div>
    );
};


