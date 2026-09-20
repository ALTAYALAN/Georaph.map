import React from 'react';

// 6 Temel Toplu Taşıma / Güzergah Sınıfları (Ulaşım Modları)
export const ROUTE_CLASSES = [
    {
        id: 'otobus',
        label: 'Otobüs',
        shortLabel: 'Otobüs',
        icon: 'bus',
        color: '#0284c7',
        bullet: '●',
        bg: 'rgba(2, 132, 199, 0.15)',
        border: '#0284c7',
        description: 'Şehir içi belediye ve halk otobüs hatları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`
    },
    {
        id: 'metro',
        label: 'Metro',
        shortLabel: 'Metro',
        icon: 'metro',
        color: '#ef4444',
        bullet: '●',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: '#ef4444',
        description: 'Yeraltı ve yerüstü hızlı metro raylı sistem hatları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`
    },
    {
        id: 'tramvay',
        label: 'Tramvay',
        shortLabel: 'Tramvay',
        icon: 'tram',
        color: '#06b6d4',
        bullet: '●',
        bg: 'rgba(6, 182, 212, 0.15)',
        border: '#06b6d4',
        description: 'Cadde üzeri ve hafif raylı tramvay hatları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 16.5V6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v10.5a2.5 2.5 0 0 0 2 2.45V21a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2h4v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2.05a2.5 2.5 0 0 0 2-2.45zM7 6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4H7V6zm2 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`
    },
    {
        id: 'metrobus',
        label: 'Metrobüs',
        shortLabel: 'Metrobüs',
        icon: 'metrobus',
        color: '#f59e0b',
        bullet: '●',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: '#f59e0b',
        description: 'Ayrılmış özel yollu metrobüs ve ekspres transit hatları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm2.5-12h11c.83 0 1.5.67 1.5 1.5V10H5V5.5C5 4.67 5.67 4 6.5 4zm1 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 2l2 2h-4l2-2z"/></svg>`
    },
    {
        id: 'tren',
        label: 'Tren',
        shortLabel: 'Tren',
        icon: 'train',
        color: '#8b5cf6',
        bullet: '●',
        bg: 'rgba(139, 92, 246, 0.15)',
        border: '#8b5cf6',
        description: 'TCDD, Banliyö (Marmaray, İZBAN, Başkentray) ve bölgesel trenler',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zm0 2c3.5 0 6 .34 6 2v2H6V6c0-1.66 2.5-2 6-2zm-4.5 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`
    },
    {
        id: 'deniz',
        label: 'Deniz / Vapur',
        shortLabel: 'Deniz',
        icon: 'ship',
        color: '#0ea5e9',
        bullet: '●',
        bg: 'rgba(14, 165, 233, 0.15)',
        border: '#0ea5e9',
        description: 'Şehir Hatları vapur, deniz otobüsü ve arabalı feribot hatları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L20 11V4c0-.55-.45-1-1-1h-2V1h-2v2h-6V1H7v2H5c-.55 0-1 .45-1 1v7l-1.28.27c-.27.05-.48.23-.6.47-.12.24-.14.52-.06.78L3.95 19zM6 5h12v6.2l-6-1.2-6 1.2V5z"/></svg>`
    },
    {
        id: 'havayolu',
        label: 'Havayolu / Uçak',
        shortLabel: 'Havayolu',
        icon: 'plane',
        color: '#0284c7',
        bullet: '●',
        bg: 'rgba(2, 132, 199, 0.15)',
        border: '#0284c7',
        description: 'Yurtiçi ve uluslararası tarifeli havayolu uçuş rotaları',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`
    }
];

export function getTransitPrefix(classKey) {
    const info = getRouteClassInfo(classKey);
    return info ? `${info.bullet || '●'} [${info.shortLabel}]` : '';
}

// Desteklenen tüm sınıfları ve eşanlamlılarını standart bir anahtara dönüştürür
export function normalizeTransitClass(classKey) {
    if (!classKey) return 'otobus';
    const key = String(classKey).toLowerCase().trim();
    if (key === 'havayolu' || key === 'ucak' || key === 'uçak' || key === 'plane' || key === 'flight' || key === 'air' || key === 'airway') return 'havayolu';
    if (key === 'gemi' || key === 'deniz' || key === 'liman' || key === 'vapur' || key === 'feribot' || key === 'ship' || key === 'port') return 'deniz';
    if (key === 'bus' || key === 'otobus' || key === 'iett' || key === 'ego' || key === 'eshot') return 'otobus';
    if (key === 'metro' || key === 'm' || key === 'subway') return 'metro';
    if (key === 'tramvay' || key === 'tram' || key === 'nostaljik') return 'tramvay';
    if (key === 'metrobus' || key === 'metrobüs' || key === 'brt') return 'metrobus';
    if (key === 'tren' || key === 'train' || key === 'tcdd' || key === 'marmaray' || key === 'izban' || key === 'baskentray' || key === 'demiryolu') return 'tren';
    if (key === 'araba' || key === 'car') return 'otobus'; // Geriye dönük uyumluluk
    return key;
}

// İki sınıfın birbirine bağlanabilir olup olmadığını kontrol eder (Sadece aynı sınıflar bağlanabilir!)
export function areTransitClassesCompatible(class1, class2) {
    const c1 = normalizeTransitClass(class1);
    const c2 = normalizeTransitClass(class2);
    return c1 === c2;
}

export function getRouteClassInfo(classKey) {
    const normalized = normalizeTransitClass(classKey);
    return ROUTE_CLASSES.find(c => c.id === normalized) || ROUTE_CLASSES[0];
}

// Araç simülasyonu için sınıfa özel SVG iç vektör grafiği
export function getVehicleClassInnerSvg(classKey) {
    const normalized = normalizeTransitClass(classKey);
    switch (normalized) {
        case 'havayolu':
            return `<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>`;
        case 'metro':
            return `<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`;
        case 'tramvay':
            return `<path d="M19 16.5V6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v10.5a2.5 2.5 0 0 0 2 2.45V21a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2h4v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2.05a2.5 2.5 0 0 0 2-2.45zM7 6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4H7V6zm2 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>`;
        case 'metrobus':
            return `<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm2.5-12h11c.83 0 1.5.67 1.5 1.5V10H5V5.5C5 4.67 5.67 4 6.5 4zm1 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 2l2 2h-4l2-2z"/>`;
        case 'tren':
            return `<path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zm0 2c3.5 0 6 .34 6 2v2H6V6c0-1.66 2.5-2 6-2zm-4.5 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>`;
        case 'deniz':
            return `<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L20 11V4c0-.55-.45-1-1-1h-2V1h-2v2h-6V1H7v2H5c-.55 0-1 .45-1 1v7l-1.28.27c-.27.05-.48.23-.6.47-.12.24-.14.52-.06.78L3.95 19zM6 5h12v6.2l-6-1.2-6 1.2V5z"/>`;
        case 'otobus':
        default:
            return `<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`;
    }
}

// React SVG İkon Bileşeni (Emojiler Yerine Temiz Vektörel İkon)
export function RouteClassIcon({ classKey, size = 14, color = 'currentColor', style = {} }) {
    const info = getRouteClassInfo(classKey);
    const svgStr = (info.svgIcon || '')
        .replace(/width="14"/, `width="${size}"`)
        .replace(/height="14"/, `height="${size}"`)
        .replace(/fill="currentColor"/, `fill="${color}"`);

    return React.createElement('span', {
        style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, ...style },
        dangerouslySetInnerHTML: { __html: svgStr }
    });
}
