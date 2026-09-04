// Harita Görünürlük & Zoom Seviyeleri Yapılandırması

export const DEFAULT_ZOOM_SETTINGS = {
    // Güzergah & Hat Görünürlük Zoom Seviyeleri
    routeMinZoom: 11.5,
    flightRouteMinZoom: 4.5,
    busRouteMinZoom: 11.5,
    metroRouteMinZoom: 11.5,
    shipRouteMinZoom: 8.5,
    trainRouteMinZoom: 10.0,
    routeNameMinZoom: 12.0,

    // Duraklar & İstasyonlar Görünürlük Zoom Seviyeleri
    stopMinZoom: 14.0,
    airportStopMinZoom: 4.5,
    shipStopMinZoom: 8.0,
    metroStopMinZoom: 12.0,
    busStopMinZoom: 14.5,
    trainStopMinZoom: 11.0,
    stopNameMinZoom: 16.0,

    // POI (Önemli Noktalar) Zoom Seviyeleri (Tüm Türkiye ve İl Ölçeğinde Görünür)
    poiMinZoom: 5.5,
    poiNameMinZoom: 11.5,
    poiCriticalMinZoom: 5.0,

    // POI Kategorisi Özel Zoom Seviyeleri
    poi_alisveris_minZoom: 7.0,
    poi_market_minZoom: 7.5,
    poi_hastane_minZoom: 5.0,
    poi_eczane_minZoom: 7.0,
    poi_okul_minZoom: 6.5,
    poi_muze_minZoom: 5.0,
    poi_kutuphane_minZoom: 6.5,
    poi_sanat_minZoom: 6.0,
    poi_anit_minZoom: 5.5,
    poi_spor_minZoom: 7.0,
    poi_akaryakit_minZoom: 7.0,
    poi_oto_servis_minZoom: 7.5,
    poi_otopark_minZoom: 8.0,
    poi_atm_minZoom: 7.5,
    poi_plaj_minZoom: 5.5,
    poi_kafe_minZoom: 7.5,
    poi_restoran_minZoom: 7.0,
    poi_otel_minZoom: 6.0,
    poi_park_minZoom: 6.5,
    poi_dini_minZoom: 6.0,
    poi_kamu_minZoom: 6.0,

    // Çizimler & Markerlar Zoom Seviyeleri
    drawingPointMinZoom: 7.0,
    drawingPolygonMinZoom: 6.0,
    drawingLabelMinZoom: 11.0
};

export const ZOOM_STORAGE_KEY = 'geomap_admin_zoom_settings_v2';

export function getZoomSettings() {
    try {
        const stored = localStorage.getItem(ZOOM_STORAGE_KEY) || localStorage.getItem('geomap_admin_zoom_settings_v1');
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                ...DEFAULT_ZOOM_SETTINGS,
                ...parsed
            };
        }
    } catch (e) {
        console.error('Zoom settings read error:', e);
    }
    return { ...DEFAULT_ZOOM_SETTINGS };
}

export function saveZoomSettings(newSettings) {
    try {
        const merged = { ...DEFAULT_ZOOM_SETTINGS, ...newSettings };
        localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('geomapZoomSettingsChanged', { detail: merged }));
        return true;
    } catch (e) {
        console.error('Zoom settings save error:', e);
        return false;
    }
}
