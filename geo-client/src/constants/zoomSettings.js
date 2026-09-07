// Harita Görünürlük & Zoom Seviyeleri Yapılandırması

export const DEFAULT_ZOOM_SETTINGS = {
    // Güzergah & Hat Görünürlük Zoom Seviyeleri
    routeMinZoom: 6.0,
    flightRouteMinZoom: 4.0,
    busRouteMinZoom: 8.0,
    metroRouteMinZoom: 6.0,
    shipRouteMinZoom: 4.0,
    trainRouteMinZoom: 5.0,
    routeNameMinZoom: 10.5,

    // Duraklar & İstasyonlar Görünürlük Zoom Seviyeleri (Tüm Türkiye ve Şehir Ölçeğinde Net Görünür)
    stopMinZoom: 6.0,
    airportStopMinZoom: 4.0,
    shipStopMinZoom: 4.0,
    metroStopMinZoom: 6.0,
    busStopMinZoom: 6.0,
    trainStopMinZoom: 5.0,
    stopNameMinZoom: 11.0,

    // POI (Önemli Noktalar) Zoom Seviyeleri (Tüm Türkiye ve İl Ölçeğinde Görünür)
    poiMinZoom: 5.0,
    poiNameMinZoom: 11.0,
    poiCriticalMinZoom: 4.5,

    // POI Kategorisi Özel Zoom Seviyeleri
    poi_alisveris_minZoom: 6.5,
    poi_market_minZoom: 7.0,
    poi_hastane_minZoom: 5.0,
    poi_eczane_minZoom: 6.5,
    poi_okul_minZoom: 6.0,
    poi_muze_minZoom: 5.0,
    poi_kutuphane_minZoom: 6.0,
    poi_sanat_minZoom: 5.5,
    poi_anit_minZoom: 5.0,
    poi_spor_minZoom: 6.5,
    poi_akaryakit_minZoom: 6.5,
    poi_oto_servis_minZoom: 7.0,
    poi_otopark_minZoom: 7.5,
    poi_atm_minZoom: 7.0,
    poi_plaj_minZoom: 5.0,
    poi_kafe_minZoom: 7.0,
    poi_restoran_minZoom: 6.5,
    poi_otel_minZoom: 5.5,
    poi_park_minZoom: 6.0,
    poi_dini_minZoom: 5.5,
    poi_kamu_minZoom: 5.5,

    // Çizimler & Markerlar Zoom Seviyeleri
    drawingPointMinZoom: 6.0,
    drawingPolygonMinZoom: 5.0,
    drawingLabelMinZoom: 10.5
};

export const ZOOM_STORAGE_KEY = 'geomap_admin_zoom_settings_v10';

// Hızlı Hazır Zoom Profilleri (Presets)
export const ZOOM_PRESETS = {
    balanced: {
        ...DEFAULT_ZOOM_SETTINGS
    },
    // Tüm Türkiye ve bölge ölçeğinde daha erken görünürlük (Düşük zoom eşikleri)
    wideView: {
        ...DEFAULT_ZOOM_SETTINGS,
        routeMinZoom: 4.5,
        flightRouteMinZoom: 3.0,
        busRouteMinZoom: 6.0,
        metroRouteMinZoom: 5.0,
        shipRouteMinZoom: 3.5,
        trainRouteMinZoom: 4.0,
        routeNameMinZoom: 9.0,
        stopMinZoom: 4.5,
        airportStopMinZoom: 3.0,
        shipStopMinZoom: 3.5,
        metroStopMinZoom: 5.0,
        busStopMinZoom: 5.0,
        trainStopMinZoom: 4.0,
        stopNameMinZoom: 9.5,
        poiMinZoom: 4.0,
        poiNameMinZoom: 9.5,
        poiCriticalMinZoom: 3.5,
        drawingPointMinZoom: 4.5,
        drawingPolygonMinZoom: 3.5,
        drawingLabelMinZoom: 9.0
    },
    // Performans odaklı: Yalnızca harita yakınlaştırıldığında göster (Yüksek zoom eşikleri)
    performance: {
        ...DEFAULT_ZOOM_SETTINGS,
        routeMinZoom: 8.0,
        flightRouteMinZoom: 5.0,
        busRouteMinZoom: 10.0,
        metroRouteMinZoom: 7.5,
        shipRouteMinZoom: 5.5,
        trainRouteMinZoom: 6.5,
        routeNameMinZoom: 12.0,
        stopMinZoom: 8.0,
        airportStopMinZoom: 5.0,
        shipStopMinZoom: 5.5,
        metroStopMinZoom: 7.5,
        busStopMinZoom: 8.0,
        trainStopMinZoom: 6.5,
        stopNameMinZoom: 12.5,
        poiMinZoom: 6.5,
        poiNameMinZoom: 12.5,
        poiCriticalMinZoom: 5.5,
        drawingPointMinZoom: 7.5,
        drawingPolygonMinZoom: 6.5,
        drawingLabelMinZoom: 12.0
    }
};

let _cachedSettings = null;

export function getZoomSettings() {
    if (_cachedSettings) {
        return _cachedSettings;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('geomap_admin_zoom_settings_v8');
            localStorage.removeItem('geomap_admin_zoom_settings_v7');
            const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                _cachedSettings = {
                    ...DEFAULT_ZOOM_SETTINGS,
                    ...parsed
                };
                return _cachedSettings;
            }
        }
    } catch (e) {
        console.error('Zoom settings read error:', e);
    }
    _cachedSettings = { ...DEFAULT_ZOOM_SETTINGS };
    return _cachedSettings;
}

export function saveZoomSettings(newSettings) {
    try {
        const merged = { ...DEFAULT_ZOOM_SETTINGS, ...newSettings };
        _cachedSettings = merged;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(merged));
        }
        window.dispatchEvent(new CustomEvent('geomapZoomSettingsChanged', { detail: merged }));
        return true;
    } catch (e) {
        console.error('Zoom settings save error:', e);
        return false;
    }
}


