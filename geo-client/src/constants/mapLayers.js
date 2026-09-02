// Comprehensive Map Layers Definitions (Google Maps, Satellite, Political, Terrain, Dark/Light)
// No emojis, rich vector styling & live tile preview snapshots
export const BASEMAP_LAYERS = [
    {
        id: 'google_hybrid',
        name: 'Google Hibrit Uydu',
        sub: 'Yüksek Çözünürlüklü Uydu + Yollar & Sınırlar',
        iconType: 'hybrid',
        tag: 'Hibrit',
        tagColor: '#10b981',
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=y&x=152&y=99&z=8',
        category: 'satellite'
    },
    {
        id: 'google_roadmap',
        name: 'Google Siyasi / Yol',
        sub: 'Standart Google Şehir, İlçe ve Sınır Haritası',
        iconType: 'roadmap',
        tag: 'Siyasi',
        tagColor: '#3b82f6',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=m&x=152&y=99&z=8',
        category: 'political'
    },
    {
        id: 'google_terrain',
        name: 'Google Arazi / Topografik',
        sub: 'Yükselti, Dağ Kabartmaları ve Fiziki Coğrafya',
        iconType: 'terrain',
        tag: 'Arazi',
        tagColor: '#f59e0b',
        url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=p&x=152&y=99&z=8',
        category: 'terrain'
    },
    {
        id: 'google_satellite',
        name: 'Google Saf Uydu',
        sub: 'Yazısız ve Çizgisiz Doğal Yeryüzü Fotoğrafı',
        iconType: 'satellite',
        tag: 'Saf Uydu',
        tagColor: '#8b5cf6',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        previewUrl: 'https://mt1.google.com/vt/lyrs=s&x=152&y=99&z=8',
        category: 'satellite'
    },
    {
        id: 'carto_dark',
        name: 'Karanlık Gece Modu (Dark)',
        sub: 'Vektörel Yüksek Kontrastlı Koyu Tema (ESRI Canvas)',
        iconType: 'dark',
        tag: 'Gece',
        tagColor: '#64748b',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        previewUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/6/24/38',
        category: 'theme'
    },
    {
        id: 'carto_light',
        name: 'Aydınlık Siyasi (Light)',
        sub: 'Temiz Açık Gri Arka Plan & Sınırlar (ESRI Canvas)',
        iconType: 'light',
        tag: 'Açık',
        tagColor: '#0ea5e9',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        previewUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/6/24/38',
        category: 'political'
    },
    {
        id: 'osm',
        name: 'OpenStreetMap (OSM)',
        sub: 'Açık Kaynak Topluluk Haritası',
        iconType: 'osm',
        tag: 'OSM',
        tagColor: '#ec4899',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        previewUrl: 'https://tile.openstreetmap.org/8/152/99.png',
        category: 'osm'
    }
];

export const DEFAULT_BASEMAP_ID = 'google_hybrid';
