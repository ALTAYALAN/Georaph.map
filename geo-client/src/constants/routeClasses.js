import React from 'react';

// Güzergah Sınıfları Tanımları (Ulaşım Modları)
export const ROUTE_CLASSES = [
    {
        id: 'otobus',
        label: 'Otobüs',
        shortLabel: 'Otobüs',
        icon: 'bus',
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.15)',
        border: '#0284c7',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`
    },
    {
        id: 'metro',
        label: 'Metro',
        shortLabel: 'Metro',
        icon: 'metro',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: '#ef4444',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`
    },
    {
        id: 'araba',
        label: 'Araba',
        shortLabel: 'Araba',
        icon: 'car',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.15)',
        border: '#3b82f6',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`
    },
    {
        id: 'tren',
        label: 'Tren / Tramvay',
        shortLabel: 'Tren',
        icon: 'train',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: '#f59e0b',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zm0 2c3.5 0 6 .34 6 2v2H6V6c0-1.66 2.5-2 6-2zm-4.5 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`
    },
    {
        id: 'gemi',
        label: 'Gemi / Vapur',
        shortLabel: 'Gemi',
        icon: 'ship',
        color: '#06b6d4',
        bg: 'rgba(6, 182, 212, 0.15)',
        border: '#06b6d4',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L20 11V4c0-.55-.45-1-1-1h-2V1h-2v2h-6V1H7v2H5c-.55 0-1 .45-1 1v7l-1.28.27c-.27.05-.48.23-.6.47-.12.24-.14.52-.06.78L3.95 19zM6 5h12v6.2l-6-1.2-6 1.2V5z"/></svg>`
    },
    {
        id: 'yuruyus',
        label: 'Yürüyüş',
        shortLabel: 'Yürüyüş',
        icon: 'walking',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: '#10b981',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/></svg>`
    },
    {
        id: 'bisiklet',
        label: 'Bisiklet',
        shortLabel: 'Bisiklet',
        icon: 'bicycle',
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.15)',
        border: '#8b5cf6',
        svgIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.2 1.2 3 1.9 4.8 1.9v-2c-1.3 0-2.6-.5-3.5-1.4l-1.9-1.9c-.4-.4-.9-.7-1.4-.7s-1 .3-1.4.7L7.8 8.6c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L10 13.5V19h2v-6.5l-1.2-1.5zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>`
    }
];

export function getRouteClassInfo(classKey) {
    if (!classKey) return ROUTE_CLASSES[0];
    const normalized = String(classKey).toLowerCase().trim();
    if (normalized === 'bus') return ROUTE_CLASSES.find(c => c.id === 'otobus') || ROUTE_CLASSES[0];
    return ROUTE_CLASSES.find(c => c.id === normalized) || ROUTE_CLASSES[0];
}

// Araç simülasyonu için sınıfa özel SVG iç vektör grafiği
export function getVehicleClassInnerSvg(classKey) {
    const key = (classKey || 'araba').toLowerCase().trim();
    switch (key) {
        case 'otobus':
        case 'bus':
            return `<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`;
        case 'gemi':
            return `<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L20 11V4c0-.55-.45-1-1-1h-2V1h-2v2h-6V1H7v2H5c-.55 0-1 .45-1 1v7l-1.28.27c-.27.05-.48.23-.6.47-.12.24-.14.52-.06.78L3.95 19zM6 5h12v6.2l-6-1.2-6 1.2V5z"/>`;
        case 'metro':
            return `<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`;
        case 'tren':
            return `<path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zm0 2c3.5 0 6 .34 6 2v2H6V6c0-1.66 2.5-2 6-2zm-4.5 13c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>`;
        case 'yuruyus':
            return `<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>`;
        case 'bisiklet':
            return `<path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.2 1.2 3 1.9 4.8 1.9v-2c-1.3 0-2.6-.5-3.5-1.4l-1.9-1.9c-.4-.4-.9-.7-1.4-.7s-1 .3-1.4.7L7.8 8.6c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L10 13.5V19h2v-6.5l-1.2-1.5zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>`;
        case 'araba':
        default:
            return `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`;
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
