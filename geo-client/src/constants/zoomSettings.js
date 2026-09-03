// Harita Görünürlük & Zoom Seviyeleri Yapılandırması

export const DEFAULT_ZOOM_SETTINGS = {
    // Güzergah & Hat Görünürlük Zoom Seviyeleri
    routeMinZoom: 11.5,
    busRouteMinZoom: 11.5,
    metroRouteMinZoom: 11.5,
    shipRouteMinZoom: 8.5,
    trainRouteMinZoom: 10.0,
    routeNameMinZoom: 12.0,

    // Duraklar & İstasyonlar Görünürlük Zoom Seviyeleri
    stopMinZoom: 14.0,
    shipStopMinZoom: 8.0,
    metroStopMinZoom: 12.0,
    busStopMinZoom: 14.5,
    trainStopMinZoom: 11.0,
    stopNameMinZoom: 16.0,

    // POI (Önemli Noktalar) Zoom Seviyeleri
    poiMinZoom: 13.5,
    poiNameMinZoom: 15.5,
    poiCriticalMinZoom: 12.0,

    // Çizimler & Markerlar Zoom Seviyeleri
    drawingPointMinZoom: 9.0,
    drawingPolygonMinZoom: 7.0,
    drawingLabelMinZoom: 13.0
};

export const ZOOM_STORAGE_KEY = 'geomap_admin_zoom_settings_v1';

export function getZoomSettings() {
    try {
        const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_ZOOM_SETTINGS, ...JSON.parse(stored) };
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
