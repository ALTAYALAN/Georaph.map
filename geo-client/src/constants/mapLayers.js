// Comprehensive Map Layers Definitions (Google Maps, Satellite, Political, Terrain, Dark/Light)
// No emojis, rich vector styling & live tile preview snapshots

export const BASEMAP_LAYERS = [
    {
        id: 'google_hybrid',
        name: 'Google Hibrit Uydu',
        nameEn: 'Google Hybrid Satellite',
        sub: 'Yüksek Çözünürlüklü Uydu + Yollar & Sınırlar',
        subEn: 'High-Resolution Satellite + Roads & Boundaries',
        iconType: 'hybrid',
        tag: 'Hibrit',
        tagEn: 'Hybrid',
        tagColor: '#10b981',
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=y&x=152&y=99&z=8',
        maxZoom: 20,
        category: 'satellite'
    },
    {
        id: 'esri_wayback',
        name: 'Esri Harita',
        nameEn: 'Esri Satellite (Timeline)',
        sub: '2011 – 2024 Gerçek Uydu Arşivi (Zaman Çizelgeli)',
        subEn: '2011 – 2024 Historical Satellite Archive',
        iconType: 'history',
        tag: 'Zamanlı',
        tagEn: 'Timeline',
        tagColor: '#06b6d4',
        url: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/mapserver/tile/49059/{z}/{y}/{x}',
        previewUrl: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/mapserver/tile/49059/8/99/152',
        maxZoom: 18,
        category: 'history'
    },
    {
        id: 'google_roadmap',
        name: 'Google Siyasi / Yol',
        nameEn: 'Google Street / Roadmap',
        sub: 'Standart Google Şehir, İlçe ve Sınır Haritası',
        subEn: 'Standard Google City, District & Boundary Map',
        iconType: 'roadmap',
        tag: 'Siyasi',
        tagEn: 'Political',
        tagColor: '#3b82f6',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=m&x=152&y=99&z=8',
        maxZoom: 20,
        category: 'political'
    },
    {
        id: 'google_terrain',
        name: 'Google Arazi / Topografik',
        nameEn: 'Google Terrain / Topographic',
        sub: 'Yükselti, Dağ Kabartmaları ve Fiziki Coğrafya',
        subEn: 'Elevation, Mountain Relief & Physical Geography',
        iconType: 'terrain',
        tag: 'Arazi',
        tagEn: 'Terrain',
        tagColor: '#f59e0b',
        url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=p&x=152&y=99&z=8',
        maxZoom: 19,
        category: 'terrain'
    },
    {
        id: 'google_satellite',
        name: 'Google Saf Uydu',
        nameEn: 'Google Pure Satellite',
        sub: 'Yazısız ve Çizgisiz Doğal Yeryüzü Fotoğrafı',
        subEn: 'Natural Satellite Imagery Without Labels',
        iconType: 'satellite',
        tag: 'Saf Uydu',
        tagEn: 'Satellite',
        tagColor: '#8b5cf6',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=s&x=152&y=99&z=8',
        maxZoom: 20,
        category: 'satellite'
    },
    {
        id: 'carto_dark',
        name: 'Karanlık Gece Modu (Dark)',
        nameEn: 'Dark Night Mode (Dark)',
        sub: 'Vektörel Yüksek Kontrastlı Koyu Tema',
        subEn: 'High-Contrast Dark Canvas Base Map',
        iconType: 'dark',
        tag: 'Gece',
        tagEn: 'Dark',
        tagColor: '#64748b',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        previewUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/8/99/152',
        maxZoom: 16,
        category: 'theme'
    },
    {
        id: 'carto_light',
        name: 'Aydınlık Siyasi (Light)',
        nameEn: 'Light Political (Light)',
        sub: 'Temiz Açık Gri Arka Plan & Sınırlar',
        subEn: 'Clean Light Gray Background & Boundaries',
        iconType: 'light',
        tag: 'Açık',
        tagEn: 'Light',
        tagColor: '#0ea5e9',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=m&x=152&y=99&z=8',
        maxZoom: 20,
        category: 'political'
    },
    {
        id: 'osm',
        name: 'OpenStreetMap (OSM)',
        nameEn: 'OpenStreetMap (OSM)',
        sub: 'Açık Kaynak Topluluk Haritası',
        subEn: 'Open Source Community Map',
        iconType: 'osm',
        tag: 'OSM',
        tagEn: 'OSM',
        tagColor: '#ec4899',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        previewUrl: 'https://tile.openstreetmap.org/8/152/99.png',
        maxZoom: 19,
        category: 'osm'
    }
];

export function getLocalizedBasemapName(layer, lang = 'tr') {
    if (!layer) return '';
    return lang === 'en' ? (layer.nameEn || layer.name) : layer.name;
}

export function getLocalizedBasemapSub(layer, lang = 'tr') {
    if (!layer) return '';
    return lang === 'en' ? (layer.subEn || layer.sub) : layer.sub;
}

export function getLocalizedBasemapTag(layer, lang = 'tr') {
    if (!layer) return '';
    return lang === 'en' ? (layer.tagEn || layer.tag) : layer.tag;
}

// =========================================================================
// TARİHSEL UYDU KATMANLARI (GERÇEK UYDU ÇEKİM TARİHLERİ: 2011 - 2024)
// Tekrar eden aynı tarihli görüntüler elenmiş, yalnızca benzersiz çekimler tutulmuştur.
// =========================================================================
export const ENABLE_HISTORICAL_WAYBACK = true;

export const HISTORICAL_WAYBACK_YEARS = [
    {
        year: 2011,
        id: '5232',
        date: '2011-08-24',
        label: '24 Ağustos 2011',
        provider: 'DigitalGlobe (0.5m)',
        release: 'WB_2014_R11'
    },
    {
        year: 2013,
        id: '24007',
        date: '2013-03-02',
        label: '02 Mart 2013',
        provider: 'Airbus Pléiades (0.5m)',
        release: 'WB_2015_R11'
    },
    {
        year: 2017,
        id: '8249',
        date: '2017-06-14',
        label: '14 Haziran 2017',
        provider: 'DigitalGlobe (0.31m)',
        release: 'WB_2018_R09'
    },
    {
        year: 2020,
        id: '8432',
        date: '2020-08-02',
        label: '02 Ağustos 2020',
        provider: 'Maxar (0.5m)',
        release: 'WB_2021_R15'
    },
    {
        year: 2021,
        id: '47963',
        date: '2021-11-22',
        label: '22 Kasım 2021',
        provider: 'Maxar (0.5m)',
        release: 'WB_2023_R07'
    },
    {
        year: 2023,
        id: '39767',
        date: '2023-07-12',
        label: '12 Temmuz 2023',
        provider: 'Maxar Vivid (0.31m)',
        release: 'WB_2024_R07'
    },
    {
        year: 2024,
        id: '49059',
        date: '2024-02-06',
        label: '06 Şubat 2024',
        provider: 'Maxar (0.31m)',
        release: 'WB_2026_R04'
    }
];

export const HISTORICAL_WAYBACK_LAYERS = HISTORICAL_WAYBACK_YEARS.map(item => ({
    id: `wayback_${item.year}`,
    year: item.year,
    date: item.date,
    dateLabel: item.label,
    releaseId: item.id,
    name: `Esri Uydu (${item.year})`,
    sub: `${item.label} Tarihli Yüksek Çözünürlüklü Arşiv`,
    iconType: 'history',
    tag: `${item.year}`,
    tagColor: item.year >= 2023 ? '#06b6d4' : (item.year >= 2020 ? '#3b82f6' : (item.year >= 2017 ? '#6366f1' : '#8b5cf6')),
    url: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/mapserver/tile/${item.id}/{z}/{y}/{x}`,
    previewUrl: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/mapserver/tile/${item.id}/8/99/152`,
    category: 'history'
}));

export const LATEST_WAYBACK_LAYER = HISTORICAL_WAYBACK_LAYERS[HISTORICAL_WAYBACK_LAYERS.length - 1];

export const isWaybackLayer = (layerId) => Boolean(layerId && (layerId === 'esri_wayback' || layerId.startsWith('wayback_')));

export const getWaybackYearInfo = (layerId) => {
    if (!isWaybackLayer(layerId)) return null;
    if (layerId === 'esri_wayback') {
        return HISTORICAL_WAYBACK_YEARS[HISTORICAL_WAYBACK_YEARS.length - 1];
    }
    const yearStr = layerId.replace('wayback_', '');
    const yearNum = parseInt(yearStr, 10);
    // Backward compatibility if previous years (e.g. 2026, 2014) were stored in localStorage:
    if (yearNum === 2026 || yearNum === 2025) return HISTORICAL_WAYBACK_YEARS[6]; // 2024
    if (yearNum === 2014) return HISTORICAL_WAYBACK_YEARS[0]; // 2011
    if (yearNum === 2015 || yearNum === 2016) return HISTORICAL_WAYBACK_YEARS[1]; // 2013
    if (yearNum === 2018 || yearNum === 2019) return HISTORICAL_WAYBACK_YEARS[2]; // 2017
    if (yearNum === 2022) return HISTORICAL_WAYBACK_YEARS[3]; // 2020
    return HISTORICAL_WAYBACK_YEARS.find(y => y.year === yearNum) || HISTORICAL_WAYBACK_YEARS[HISTORICAL_WAYBACK_YEARS.length - 1];
};

export const getBasemapConfig = (layerId) => {
    if (layerId === 'esri_wayback') {
        const latest = HISTORICAL_WAYBACK_LAYERS[HISTORICAL_WAYBACK_LAYERS.length - 1];
        const esriOption = BASEMAP_LAYERS.find(l => l.id === 'esri_wayback');
        return {
            ...esriOption,
            url: latest.url,
            previewUrl: latest.previewUrl
        };
    }
    if (layerId && layerId.startsWith('wayback_')) {
        const info = getWaybackYearInfo(layerId);
        if (info) {
            const found = HISTORICAL_WAYBACK_LAYERS.find(l => l.year === info.year);
            if (found) return found;
        }
        return HISTORICAL_WAYBACK_LAYERS.find(l => l.id === layerId) || BASEMAP_LAYERS[0];
    }
    return BASEMAP_LAYERS.find(l => l.id === layerId) || BASEMAP_LAYERS[0];
};

export const DEFAULT_BASEMAP_ID = 'google_hybrid';
