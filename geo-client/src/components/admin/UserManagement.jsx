import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import WKT from 'ol/format/WKT';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import GeometryCollection from 'ol/geom/GeometryCollection';
import { Style, Stroke, Fill, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';

export const getRoleColorStyle = (roleName, roleId) => {
    const name = (roleName || '').toLowerCase();
    
    if (name.includes('admin') || roleId === 1) {
        return {
            bg: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: 'rgba(239, 68, 68, 0.35)',
        };
    }
    if (name.includes('edit') || name.includes('yönetici') || roleId === 2) {
        return {
            bg: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            border: 'rgba(59, 130, 246, 0.35)',
        };
    }
    if (name.includes('user') || name.includes('kullanıcı') || roleId === 3) {
        return {
            bg: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            border: 'rgba(16, 185, 129, 0.35)',
        };
    }
    if (name.includes('mod') || name.includes('denetçi') || roleId === 4) {
        return {
            bg: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            border: 'rgba(139, 92, 246, 0.35)',
        };
    }

    const palette = [
        { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.35)' },
        { bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.35)' },
        { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.35)' },
        { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.35)' },
        { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.35)' },
    ];
    const idx = Math.abs((roleId || 0) + name.length) % palette.length;
    return palette[idx];
};
import { adminApi } from '../../services/adminApi';

// SVG Icons
const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const PlusIcon = ({ size = 16, strokeWidth = 3.5, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const MailIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const PhoneIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const EditIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const PauseIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
);

const PlayIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const TrashIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const KeyIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
);

const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const SpatialBoundaryIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon
            points="4,6 10,3 19,4 22,10 18,18 12,21 5,18 2,12"
            strokeDasharray="3.5 2"
            strokeWidth="2"
        />
        <line x1="2" y1="22" x2="22" y2="2" strokeWidth="2.5" />
    </svg>
);

const UndoIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
);

const RedoIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
);

// İL İSİMLERİNİ TÜRKÇE KARAKTER VE YAZIM FARKLILIKLARINA KARŞI NORMALLİŞTİRME
export const normalizeCityName = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/i̇/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/afyonkarahisar/g, 'afyon')
        .replace(/\s+/g, '')
        .trim();
};

// COĞRAFİ BÖLGELERE AİT İLLER VE PLAKA NUMARALARI
export const REGION_PROVINCES_MAP = {
    'Marmara Bölgesi': [34, 22, 39, 59, 41, 54, 11, 16, 10, 17, 77],
    'Ege Bölgesi': [35, 9, 20, 48, 45, 3, 43, 64],
    'Akdeniz Bölgesi': [1, 7, 15, 31, 32, 46, 33, 80],
    'İç Anadolu Bölgesi': [6, 42, 38, 26, 58, 71, 68, 70, 40, 51, 50, 66, 18],
    'Karadeniz Bölgesi': [5, 8, 74, 69, 14, 19, 81, 28, 29, 78, 37, 52, 53, 55, 57, 60, 61, 67],
    'Doğu Anadolu Bölgesi': [4, 75, 12, 13, 23, 24, 25, 30, 76, 36, 44, 49, 62, 65],
    'Güneydoğu Anadolu Bölgesi': [2, 72, 21, 27, 79, 47, 56, 63, 73]
};

// PLAKA VEYA NORMALLİŞTİRİLMİŞ İSİM İLE GEOJSON FEATURE BULUCU
export const findCityFeature = (features, query) => {
    if (!features || !query) return null;

    // 1. Plaka numarasına göre 100% kesin eşleşme
    const plateNum = typeof query === 'number' ? query : (query.plate || parseInt(query, 10));
    if (plateNum && !isNaN(plateNum) && plateNum >= 1 && plateNum <= 81) {
        const found = features.find(f => {
            const num = parseInt(f.get('number') || f.get('id') || f.get('plate') || f.get('PLATE') || 0, 10);
            return num === plateNum;
        });
        if (found) return found;
    }

    // 2. Normallaştirilmiş il ismine göre eşleşme
    const nameStr = typeof query === 'string' ? query : (query.name || '');
    if (nameStr) {
        const targetNorm = normalizeCityName(nameStr);
        const found = features.find(f => {
            const featName = f.get('name') || f.get('NAME') || f.get('title') || '';
            return normalizeCityName(featName) === targetNorm;
        });
        if (found) return found;
    }

    return null;
};

// TÜRKİYE 7 COĞRAFİ BÖLGE LİSTESİ
export const TURKEY_REGIONS = [
    { name: 'Marmara Bölgesi' },
    { name: 'Ege Bölgesi' },
    { name: 'Akdeniz Bölgesi' },
    { name: 'İç Anadolu Bölgesi' },
    { name: 'Karadeniz Bölgesi' },
    { name: 'Doğu Anadolu Bölgesi' },
    { name: 'Güneydoğu Anadolu Bölgesi' }
];

// TÜRKİYE 81 İL WKT GEOMETRİ KÜMESİ (WGS84 EPSG:4326)
export const TURKEY_PROVINCES = [
    { plate: 1, name: 'Adana', wkt: 'POLYGON((34.8 36.5, 36.1 36.5, 36.1 37.8, 34.8 37.8, 34.8 36.5))' },
    { plate: 2, name: 'Adıyaman', wkt: 'POLYGON((37.4 37.4, 39.2 37.4, 39.2 38.2, 37.4 38.2, 37.4 37.4))' },
    { plate: 3, name: 'Afyonkarahisar', wkt: 'POLYGON((29.7 38.1, 31.4 38.1, 31.4 39.3, 29.7 39.3, 29.7 38.1))' },
    { plate: 4, name: 'Ağrı', wkt: 'POLYGON((42.4 39.1, 44.5 39.1, 44.5 40.1, 42.4 40.1, 42.4 39.1))' },
    { plate: 5, name: 'Amasya', wkt: 'POLYGON((35.0 40.3, 36.5 40.3, 36.5 41.0, 35.0 41.0, 35.0 40.3))' },
    { plate: 6, name: 'Ankara', wkt: 'POLYGON((31.9 39.4, 33.3 39.4, 33.3 40.4, 31.9 40.4, 31.9 39.4))' },
    { plate: 7, name: 'Antalya', wkt: 'POLYGON((29.2 36.1, 32.6 36.1, 32.6 37.5, 29.2 37.5, 29.2 36.1))' },
    { plate: 8, name: 'Artvin', wkt: 'POLYGON((41.1 40.7, 42.6 40.7, 42.6 41.5, 41.1 41.5, 41.1 40.7))' },
    { plate: 9, name: 'Aydın', wkt: 'POLYGON((27.0 37.3, 28.8 37.3, 28.8 38.1, 27.0 38.1, 27.0 37.3))' },
    { plate: 10, name: 'Balıkesir', wkt: 'POLYGON((26.6 39.1, 28.6 39.1, 28.6 40.6, 26.6 40.6, 26.6 39.1))' },
    { plate: 11, name: 'Bilecik', wkt: 'POLYGON((29.6 39.7, 30.5 39.7, 30.5 40.5, 29.6 40.5, 29.6 39.7))' },
    { plate: 12, name: 'Bingöl', wkt: 'POLYGON((40.0 38.5, 41.4 38.5, 41.4 39.4, 40.0 39.4, 40.0 38.5))' },
    { plate: 13, name: 'Bitlis', wkt: 'POLYGON((41.6 38.1, 43.1 38.1, 43.1 39.0, 41.6 39.0, 41.6 38.1))' },
    { plate: 14, name: 'Bolu', wkt: 'POLYGON((30.8 40.3, 32.2 40.3, 32.2 41.1, 30.8 41.1, 30.8 40.3))' },
    { plate: 15, name: 'Burdur', wkt: 'POLYGON((29.4 36.9, 30.9 36.9, 30.9 37.9, 29.4 37.9, 29.4 36.9))' },
    { plate: 16, name: 'Bursa', wkt: 'POLYGON((28.1 39.6, 29.8 39.6, 29.8 40.6, 28.1 40.6, 28.1 39.6))' },
    { plate: 17, name: 'Çanakkale', wkt: 'POLYGON((25.6 39.4, 27.8 39.4, 27.8 40.7, 25.6 40.7, 25.6 39.4))' },
    { plate: 18, name: 'Çankırı', wkt: 'POLYGON((32.8 40.3, 34.1 40.3, 34.1 41.2, 32.8 41.2, 32.8 40.3))' },
    { plate: 19, name: 'Çorum', wkt: 'POLYGON((34.0 40.0, 35.5 40.0, 35.5 41.3, 34.0 41.3, 34.0 40.0))' },
    { plate: 20, name: 'Denizli', wkt: 'POLYGON((28.5 37.2, 29.8 37.2, 29.8 38.3, 28.5 38.3, 28.5 37.2))' },
    { plate: 21, name: 'Diyarbakır', wkt: 'POLYGON((39.4 37.4, 41.2 37.4, 41.2 38.8, 39.4 38.8, 39.4 37.4))' },
    { plate: 22, name: 'Edirne', wkt: 'POLYGON((26.0 40.5, 26.9 40.5, 26.9 42.1, 26.0 42.1, 26.0 40.5))' },
    { plate: 23, name: 'Elazığ', wkt: 'POLYGON((38.3 38.2, 40.2 38.2, 40.2 39.2, 38.3 39.2, 38.3 38.2))' },
    { plate: 24, name: 'Erzincan', wkt: 'POLYGON((38.3 39.3, 40.6 39.3, 40.6 40.3, 38.3 40.3, 38.3 39.3))' },
    { plate: 25, name: 'Erzurum', wkt: 'POLYGON((40.2 39.2, 42.6 39.2, 42.6 40.9, 40.2 40.9, 40.2 39.2))' },
    { plate: 26, name: 'Eskişehir', wkt: 'POLYGON((30.0 39.1, 32.1 39.1, 32.1 40.2, 30.0 40.2, 30.0 39.1))' },
    { plate: 27, name: 'Gaziantep', wkt: 'POLYGON((36.5 36.6, 37.8 36.6, 37.8 37.4, 36.5 37.4, 36.5 36.6))' },
    { plate: 28, name: 'Giresun', wkt: 'POLYGON((38.0 40.1, 39.2 40.1, 39.2 41.1, 38.0 41.1, 38.0 40.1))' },
    { plate: 29, name: 'Gümüşhane', wkt: 'POLYGON((38.8 39.8, 39.9 39.8, 39.9 40.7, 38.8 40.7, 38.8 39.8))' },
    { plate: 30, name: 'Hakkari', wkt: 'POLYGON((43.1 36.9, 44.8 36.9, 44.8 37.9, 43.1 37.9, 43.1 36.9))' },
    { plate: 31, name: 'Hatay', wkt: 'POLYGON((35.8 35.8, 36.7 35.8, 36.7 36.9, 35.8 36.9, 35.8 35.8))' },
    { plate: 32, name: 'Isparta', wkt: 'POLYGON((30.3 37.3, 31.6 37.3, 31.6 38.4, 30.3 38.4, 30.3 37.3))' },
    { plate: 33, name: 'Mersin', wkt: 'POLYGON((32.6 36.0, 35.0 36.0, 35.0 37.4, 32.6 37.4, 32.6 36.0))' },
    { plate: 34, name: 'İstanbul', wkt: 'POLYGON((28.1 40.8, 29.9 40.8, 29.9 41.6, 28.1 41.6, 28.1 40.8))' },
    { plate: 35, name: 'İzmir', wkt: 'POLYGON((26.3 37.8, 27.5 37.8, 27.5 39.2, 26.3 39.2, 26.3 37.8))' },
    { plate: 36, name: 'Kars', wkt: 'POLYGON((42.3 40.0, 43.8 40.0, 43.8 41.1, 42.3 41.1, 42.3 40.0))' },
    { plate: 37, name: 'Kastamonu', wkt: 'POLYGON((32.8 41.0, 34.6 41.0, 34.6 42.1, 32.8 42.1, 32.8 41.0))' },
    { plate: 38, name: 'Kayseri', wkt: 'POLYGON((34.9 37.8, 36.9 37.8, 36.9 39.2, 34.9 39.2, 34.9 37.8))' },
    { plate: 39, name: 'Kırklareli', wkt: 'POLYGON((26.9 41.2, 28.2 41.2, 28.2 42.0, 26.9 42.0, 26.9 41.2))' },
    { plate: 40, name: 'Kırşehir', wkt: 'POLYGON((33.7 39.0, 34.6 39.0, 34.6 39.8, 33.7 39.8, 33.7 39.0))' },
    { plate: 41, name: 'Kocaeli', wkt: 'POLYGON((29.3 40.6, 30.4 40.6, 30.4 41.2, 29.3 41.2, 29.3 40.6))' },
    { plate: 42, name: 'Konya', wkt: 'POLYGON((31.3 36.7, 34.1 36.7, 34.1 39.3, 31.3 39.3, 31.3 36.7))' },
    { plate: 43, name: 'Kütahya', wkt: 'POLYGON((28.9 38.7, 30.4 38.7, 30.4 39.9, 28.9 39.9, 28.9 38.7))' },
    { plate: 44, name: 'Malatya', wkt: 'POLYGON((37.5 38.0, 39.1 38.0, 39.1 39.1, 37.5 39.1, 37.5 38.0))' },
    { plate: 45, name: 'Manisa', wkt: 'POLYGON((27.1 38.2, 28.9 38.2, 28.9 39.4, 27.1 39.4, 27.1 38.2))' },
    { plate: 46, name: 'Kahramanmaraş', wkt: 'POLYGON((36.2 37.2, 37.6 37.2, 37.6 38.5, 36.2 38.5, 36.2 37.2))' },
    { plate: 47, name: 'Mardin', wkt: 'POLYGON((40.0 36.9, 42.0 36.9, 42.0 37.7, 40.0 37.7, 40.0 36.9))' },
    { plate: 48, name: 'Muğla', wkt: 'POLYGON((27.2 36.3, 29.7 36.3, 29.7 37.6, 27.2 37.6, 27.2 36.3))' },
    { plate: 49, name: 'Muş', wkt: 'POLYGON((41.0 38.5, 42.3 38.5, 42.3 39.3, 41.0 39.3, 41.0 38.5))' },
    { plate: 50, name: 'Nevşehir', wkt: 'POLYGON((34.2 38.4, 35.1 38.4, 35.1 39.2, 34.2 39.2, 34.2 38.4))' },
    { plate: 51, name: 'Niğde', wkt: 'POLYGON((34.4 37.4, 35.3 37.4, 35.3 38.4, 34.4 38.4, 34.4 37.4))' },
    { plate: 52, name: 'Ordu', wkt: 'POLYGON((36.8 40.5, 38.1 40.5, 38.1 41.2, 36.8 41.2, 36.8 40.5))' },
    { plate: 53, name: 'Rize', wkt: 'POLYGON((40.3 40.5, 41.3 40.5, 41.3 41.3, 40.3 41.3, 40.3 40.5))' },
    { plate: 54, name: 'Sakarya', wkt: 'POLYGON((30.0 40.4, 30.9 40.4, 30.9 41.2, 30.0 41.2, 30.0 40.4))' },
    { plate: 55, name: 'Samsun', wkt: 'POLYGON((35.0 40.8, 37.2 40.8, 37.2 41.7, 35.0 41.7, 35.0 40.8))' },
    { plate: 56, name: 'Siirt', wkt: 'POLYGON((41.6 37.7, 42.5 37.7, 42.5 38.3, 41.6 38.3, 41.6 37.7))' },
    { plate: 57, name: 'Sinop', wkt: 'POLYGON((34.2 41.2, 35.4 41.2, 35.4 42.1, 34.2 42.1, 34.2 41.2))' },
    { plate: 58, name: 'Sivas', wkt: 'POLYGON((35.8 38.5, 38.5 38.5, 38.5 40.4, 35.8 40.4, 35.8 38.5))' },
    { plate: 59, name: 'Tekirdağ', wkt: 'POLYGON((26.7 40.6, 28.2 40.6, 28.2 41.5, 26.7 41.5, 26.7 40.6))' },
    { plate: 60, name: 'Tokat', wkt: 'POLYGON((36.0 40.0, 37.5 40.0, 37.5 40.8, 36.0 40.8, 36.0 40.0))' },
    { plate: 61, name: 'Trabzon', wkt: 'POLYGON((39.2 40.5, 40.5 40.5, 40.5 41.2, 39.2 41.2, 39.2 40.5))' },
    { plate: 62, name: 'Tunceli', wkt: 'POLYGON((38.9 38.8, 39.9 38.8, 39.9 39.6, 38.9 39.6, 38.9 38.8))' },
    { plate: 63, name: 'Şanlıurfa', wkt: 'POLYGON((37.7 36.6, 39.9 36.6, 39.9 37.9, 37.7 37.9, 37.7 36.6))' },
    { plate: 64, name: 'Uşak', wkt: 'POLYGON((28.8 38.3, 29.8 38.3, 29.8 38.9, 28.8 38.9, 28.8 38.3))' },
    { plate: 65, name: 'Van', wkt: 'POLYGON((42.6 37.7, 44.4 37.7, 44.4 39.4, 42.6 39.4, 42.6 37.7))' },
    { plate: 66, name: 'Yozgat', wkt: 'POLYGON((34.5 39.2, 36.0 39.2, 36.0 40.3, 34.5 40.3, 34.5 39.2))' },
    { plate: 67, name: 'Zonguldak', wkt: 'POLYGON((31.3 41.1, 32.1 41.1, 32.1 41.6, 31.3 41.6, 31.3 41.1))' },
    { plate: 68, name: 'Aksaray', wkt: 'POLYGON((33.4 38.0, 34.4 38.0, 34.4 38.9, 33.4 38.9, 33.4 38.0))' },
    { plate: 69, name: 'Bayburt', wkt: 'POLYGON((39.9 40.0, 40.6 40.0, 40.6 40.5, 39.9 40.5, 39.9 40.0))' },
    { plate: 70, name: 'Karaman', wkt: 'POLYGON((32.5 36.7, 34.0 36.7, 34.0 37.5, 32.5 37.5, 32.5 36.7))' },
    { plate: 71, name: 'Kırıkkale', wkt: 'POLYGON((33.1 39.5, 34.0 39.5, 34.0 40.2, 33.1 40.2, 33.1 39.5))' },
    { plate: 72, name: 'Batman', wkt: 'POLYGON((41.0 37.4, 41.7 37.4, 41.7 38.3, 41.0 38.3, 41.0 37.4))' },
    { plate: 73, name: 'Şırnak', wkt: 'POLYGON((41.6 37.1, 43.1 37.1, 43.1 37.8, 41.6 37.8, 41.6 37.1))' },
    { plate: 74, name: 'Bartın', wkt: 'POLYGON((32.1 41.4, 32.8 41.4, 32.8 41.8, 32.1 41.8, 32.1 41.4))' },
    { plate: 75, name: 'Ardahan', wkt: 'POLYGON((42.3 40.8, 43.5 40.8, 43.5 41.5, 42.3 41.5, 42.3 40.8))' },
    { plate: 76, name: 'Iğdır', wkt: 'POLYGON((43.6 39.7, 44.8 39.7, 44.8 40.1, 43.6 40.1, 43.6 39.7))' },
    { plate: 77, name: 'Yalova', wkt: 'POLYGON((28.9 40.5, 29.5 40.5, 29.5 40.7, 28.9 40.7, 28.9 40.5))' },
    { plate: 78, name: 'Karabük', wkt: 'POLYGON((32.2 41.0, 33.0 41.0, 33.0 41.6, 32.2 41.6, 32.2 41.0))' },
    { plate: 79, name: 'Kilis', wkt: 'POLYGON((36.8 36.6, 37.4 36.6, 37.4 36.9, 36.8 36.9, 36.8 36.6))' },
    { plate: 80, name: 'Osmaniye', wkt: 'POLYGON((35.8 36.9, 36.6 36.9, 36.6 37.6, 35.8 37.6, 35.8 36.9))' },
    { plate: 81, name: 'Düzce', wkt: 'POLYGON((30.8 40.7, 31.5 40.7, 31.5 41.1, 30.8 41.1, 30.8 40.7))' }
];

const MapIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);

export const UserManagement = ({ token, lang: propLang }) => {
    const lang = propLang || localStorage.getItem('lang') || 'tr';
    const isTr = lang === 'tr';
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [spatialModalUser, setSpatialModalUser] = useState(null);
    const [editingUser, setEditingUser] = useState(null); // null for new user
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        isActive: true,
        selectedRoleIds: [],
        selectedDirectPermIds: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const getRolePriority = (user) => {
        if (!user.roles || user.roles.length === 0) return 4;
        const roleNames = user.roles.map(r => (r.name || '').toLowerCase());
        if (roleNames.some(name => name.includes('admin') || name.includes('yönetici'))) return 1;
        if (roleNames.some(name => name.includes('edit') || name.includes('yazan'))) return 2;
        if (roleNames.some(name => name.includes('view') || name.includes('izle') || name.includes('kullanıcı'))) return 3;
        return 4;
    };

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [usersData, rolesData, permsData] = await Promise.all([
                adminApi.getUsers(token),
                adminApi.getRoles(token),
                adminApi.getPermissions(token)
            ]);

            const sortedUsers = [...usersData].sort((a, b) => {
                const priorityA = getRolePriority(a);
                const priorityB = getRolePriority(b);
                if (priorityA !== priorityB) return priorityA - priorityB;
                return a.username.localeCompare(b.username);
            });

            setUsers(sortedUsers);
            setRoles(rolesData);
            setPermissions(permsData);
        } catch (err) {
            setError(err.message || 'Veriler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            phone: '',
            password: '',
            isActive: true,
            selectedRoleIds: [],
            selectedDirectPermIds: []
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        const roleIds = user.roles ? user.roles.map(r => r.id) : [];
        const directPermIds = user.permissions
            ? user.permissions.filter(p => p.isDirect).map(p => p.permissionId)
            : [];

        setFormData({
            username: user.username,
            email: user.email || '',
            phone: user.phone || '',
            password: '',
            isActive: user.isActive,
            selectedRoleIds: roleIds,
            selectedDirectPermIds: directPermIds
        });
        setShowModal(true);
    };

    const handleToggleStatus = async (userId) => {
        try {
            await adminApi.toggleUserStatus(userId, token);
            setSuccessMessage('Kullanıcı durumu başarıyla güncellendi.');
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deleteUser(userId, token);
            setSuccessMessage('Kullanıcı başarıyla silindi.');
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRoleToggle = (roleId) => {
        setFormData(prev => {
            const exists = prev.selectedRoleIds.includes(roleId);
            const newRoleIds = exists
                ? prev.selectedRoleIds.filter(id => id !== roleId)
                : [...prev.selectedRoleIds, roleId];

            return { ...prev, selectedRoleIds: newRoleIds };
        });
    };

    const handleDirectPermToggle = (permId) => {
        setFormData(prev => {
            const exists = prev.selectedDirectPermIds.includes(permId);
            const newDirect = exists
                ? prev.selectedDirectPermIds.filter(id => id !== permId)
                : [...prev.selectedDirectPermIds, permId];

            return { ...prev, selectedDirectPermIds: newDirect };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editingUser) {
                await adminApi.updateUser(editingUser.id, {
                    username: formData.username,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password || null,
                    isActive: formData.isActive,
                    roleIds: formData.selectedRoleIds,
                    directPermissionIds: formData.selectedDirectPermIds
                }, token);
                setSuccessMessage('Kullanıcı başarıyla güncellendi.');
            } else {
                await adminApi.createUser({
                    username: formData.username,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    roleIds: formData.selectedRoleIds,
                    directPermissionIds: formData.selectedDirectPermIds
                }, token);
                setSuccessMessage('Yeni kullanıcı başarıyla eklendi.');
            }
            setShowModal(false);
            loadData();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    // Helper: Compute inherited permissions from currently selected roles in form
    const getInheritedPermissionsFromSelectedRoles = () => {
        const inheritedMap = {};
        formData.selectedRoleIds.forEach(roleId => {
            const role = roles.find(r => r.id === roleId);
            if (role && role.permissions) {
                role.permissions.forEach(p => {
                    if (!inheritedMap[p.id]) {
                        inheritedMap[p.id] = role.name;
                    }
                });
            }
        });
        return inheritedMap;
    };

    const inheritedPerms = getInheritedPermissionsFromSelectedRoles();

    return (
        <div className="admin-view-container">
            <div className="admin-header">
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserIcon /> {isTr ? 'Kullanıcı Yönetimi' : 'User Management'}
                    </h2>
                    <p className="admin-subtext">
                        {isTr 
                            ? 'Sistemdeki kullanıcıları listeleyin, ekleyin, düzenleyin ve dinamik yetkilerini belirleyin.' 
                            : 'List, add, edit users in the system and define their dynamic permissions.'}
                    </p>
                </div>
                <button className="admin-primary-btn" onClick={handleOpenCreateModal}>
                    <PlusIcon /> {isTr ? 'Yeni Kullanıcı Ekle' : 'Add New User'}
                </button>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {successMessage && <div className="admin-alert success">{successMessage}</div>}

            {loading ? (
                <div className="admin-loading">{isTr ? 'Kullanıcılar yükleniyor...' : 'Loading users...'}</div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>{isTr ? 'Kullanıcı Adı' : 'Username'}</th>
                                <th>{isTr ? 'Rol' : 'Role'}</th>
                                <th>{isTr ? 'Durum' : 'Status'}</th>
                                <th>{isTr ? 'Yetki' : 'Permissions'}</th>
                                <th>{isTr ? 'E-Posta' : 'Email'}</th>
                                <th>{isTr ? 'Telefon' : 'Phone'}</th>
                                <th style={{ textAlign: 'right' }}>{isTr ? 'İşlemler' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center">{isTr ? 'Kullanıcı bulunamadı.' : 'No users found.'}</td>
                                </tr>
                            ) : (
                                users.map(u => {
                                    const isViewerOnly = !u.roles || u.roles.length === 0 || u.roles.every(r => {
                                        const name = (r.name || '').toLowerCase();
                                        return name.includes('viewer') || name.includes('izleyici') || name.includes('görüntüleyici');
                                    });

                                    return (
                                        <tr key={u.id}>
                                            <td>#{u.id}</td>
                                            <td>
                                                <strong className="user-name">{u.username}</strong>
                                            </td>
                                            <td>
                                                <div className="badge-list">
                                                    {u.roles && u.roles.length > 0 ? (
                                                        u.roles.map(r => {
                                                            const style = getRoleColorStyle(r.name, r.id);
                                                            return (
                                                                <span
                                                                    key={r.id}
                                                                    className="badge role-badge"
                                                                    style={{
                                                                        backgroundColor: 'transparent',
                                                                        color: style.color,
                                                                        border: `1.5px solid ${style.color}`,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: '3px 10px',
                                                                        borderRadius: '6px',
                                                                        fontWeight: 700,
                                                                        fontSize: '12px',
                                                                        letterSpacing: '0.3px'
                                                                    }}
                                                                >
                                                                    {r.name}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="badge muted-badge">{isTr ? 'Rolsüz' : 'No Role'}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                                                    {u.isActive ? (isTr ? 'Aktif' : 'Active') : (isTr ? 'Pasif' : 'Inactive')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="perm-summary">
                                                    {u.permissions ? (
                                                        <span>
                                                            {u.permissions.filter(p => p.isFromRole || p.isDirect).length} {isTr ? 'Yetki' : 'Perms'}
                                                        </span>
                                                    ) : (isTr ? '0 Yetki' : '0 Perms')}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <MailIcon /> {u.email || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <PhoneIcon /> {u.phone || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="admin-action-btn edit-icon-btn"
                                                        title={isTr ? "Düzenle ve Yetkileri Yönet" : "Edit & Manage Permissions"}
                                                        onClick={() => handleOpenEditModal(u)}
                                                    >
                                                        <EditIcon size={16} />
                                                    </button>
                                                    {!isViewerOnly && (
                                                        <button
                                                            className="admin-action-btn spatial-icon-btn"
                                                            title={u.spatialBoundaryWkt 
                                                                ? (isTr ? 'Coğrafi Sınır Tanımlı (Sınır Düzenle)' : 'Geographic Boundary Defined (Edit)') 
                                                                : (isTr ? 'Coğrafi Yetki Alanı (Sınır) Tanımla' : 'Define Geographic Boundary Area')}
                                                            onClick={() => setSpatialModalUser(u)}
                                                            style={{
                                                                width: '34px',
                                                                padding: 0,
                                                                backgroundColor: u.spatialBoundaryWkt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                                                                color: u.spatialBoundaryWkt ? '#10b981' : '#3b82f6',
                                                                borderColor: u.spatialBoundaryWkt ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.3)'
                                                            }}
                                                        >
                                                            <SpatialBoundaryIcon size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="admin-action-btn delete-icon-btn"
                                                        title={isTr ? "Kullanıcıyı Sil" : "Delete User"}
                                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                                    >
                                                        <TrashIcon size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL */}
            {showModal && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <div className="admin-modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingUser ? <><EditIcon /> {isTr ? 'Kullanıcı Düzenle' : 'Edit User'}: {editingUser.username}</> : <><PlusIcon /> {isTr ? 'Yeni Kullanıcı Ekle' : 'Add New User'}</>}
                            </h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>x</button>
                        </div>
                        <form onSubmit={handleSubmit} className="admin-modal-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{isTr ? 'Kullanıcı Adı *' : 'Username *'}</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        placeholder={isTr ? "Kullanıcı adı girin..." : "Enter username..."}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>
                                        {editingUser 
                                            ? (isTr ? 'Yeni Şifre (Boş bırakılabilir)' : 'New Password (Optional)') 
                                            : (isTr ? 'Şifre *' : 'Password *')}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser 
                                            ? (isTr ? 'Değiştirmek istemiyorsanız boş bırakın' : 'Leave empty if unchanged') 
                                            : (isTr ? 'Şifre girin...' : 'Enter password...')}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{isTr ? 'E-Posta' : 'Email'}</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="user@geomap.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{isTr ? 'Telefon' : 'Phone'}</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="05xxxxxxxxx"
                                    />
                                </div>
                            </div>

                            {/* ROLES SECTION */}
                            <div className="section-divider">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldIcon /> {isTr ? 'Rol Seçimi' : 'Role Selection'}
                                </h4>
                                <p className="section-help">{isTr ? 'Kullanıcıya tanımlanacak rolleri seçin.' : 'Select roles to assign to the user.'}</p>
                            </div>
                            <div className="roles-checkbox-grid">
                                {roles.map(r => {
                                    const style = getRoleColorStyle(r.name, r.id);
                                    const isSelected = formData.selectedRoleIds.includes(r.id);
                                    return (
                                        <label
                                            key={r.id}
                                            className={`checkbox-card ${isSelected ? 'selected' : ''}`}
                                            style={{
                                                borderColor: isSelected ? style.color : 'rgba(255, 255, 255, 0.1)',
                                                backgroundColor: isSelected ? style.bg : 'transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleRoleToggle(r.id)}
                                            />
                                            <div className="checkbox-info">
                                                <strong style={{ color: isSelected ? style.color : 'inherit' }}>{r.name}</strong>
                                                <small>{r.description}</small>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            {/* DYNAMIC PERMISSIONS SECTION */}
                            <div className="section-divider">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <KeyIcon /> {isTr ? 'Kullanıcı Yetkileri (Dinamik Yetkilendirme)' : 'User Permissions (Dynamic Authorization)'}
                                </h4>
                                <p className="section-help">
                                    {isTr 
                                        ? 'Aşağıda sistemdeki tüm yetkiler listelenmektedir. Seçili rollerden gelen yetkiler otomatik olarak seçili ve kilitlidir.' 
                                        : 'All system permissions are listed below. Permissions from selected roles are automatically checked and locked.'}
                                </p>
                            </div>

                            <div className="permissions-grid">
                                {permissions.map(p => {
                                    const isInherited = !!inheritedPerms[p.id];
                                    const roleName = inheritedPerms[p.id];
                                    const isDirectChecked = formData.selectedDirectPermIds.includes(p.id);
                                    const isChecked = isInherited || isDirectChecked;

                                    return (
                                        <div
                                            key={p.id}
                                            className={`perm-item-card ${isInherited ? 'inherited' : isDirectChecked ? 'direct-checked' : ''}`}
                                        >
                                            <div className="perm-item-header">
                                                <input
                                                    type="checkbox"
                                                    id={`perm-${p.id}`}
                                                    checked={isChecked}
                                                    disabled={isInherited}
                                                    onChange={() => !isInherited && handleDirectPermToggle(p.id)}
                                                />
                                                <label htmlFor={`perm-${p.id}`} className="perm-label">
                                                    <strong>{p.name}</strong>
                                                    <span className="perm-code">({p.code})</span>
                                                </label>
                                            </div>

                                            <div className="perm-description">{p.description}</div>

                                            <div className="perm-source-tag">
                                                {isInherited ? (
                                                    <span className="badge inherited-badge" title={isTr ? "Bu yetki kullanıcının rolünden gelmektedir ve tekrar değiştirilemez." : "This permission is inherited from role and cannot be modified."}>
                                                        <ShieldIcon /> {isTr ? 'Rolden Geliyor' : 'From Role'} ({roleName})
                                                    </span>
                                                ) : isDirectChecked ? (
                                                    <span className="badge direct-badge">
                                                        <CheckIcon /> {isTr ? 'Doğrudan Atanmış' : 'Directly Assigned'}
                                                    </span>
                                                ) : (
                                                    <span className="badge unassigned-badge">
                                                        {isTr ? 'Atanmadı' : 'Unassigned'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="admin-modal-footer">
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowModal(false)}>
                                    {isTr ? 'İptal' : 'Cancel'}
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingUser ? (isTr ? 'Kullanıcıyı Güncelle' : 'Update User') : (isTr ? 'Kullanıcıyı Kaydet' : 'Save User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* SPATIAL BOUNDARY MAP MODAL */}
            {spatialModalUser && (
                <SpatialBoundaryModal
                    user={spatialModalUser}
                    token={token}
                    onClose={() => setSpatialModalUser(null)}
                    onSaveSuccess={(newWkt) => {
                        setSuccessMessage(`"${spatialModalUser.username}" için coğrafi yetki sınırı kaydedildi.`);
                        setSpatialModalUser(null);
                        loadData();
                        setTimeout(() => setSuccessMessage(''), 4000);
                    }}
                />
            )}
        </div>
    );
};

export const readWktFeatureSafely = (wktStr, wktFormatInst) => {
    if (!wktStr) return null;
    const wktFormat = wktFormatInst || new WKT();
    try {
        const cleanWkt = wktStr.replace(/^SRID=\d+;/i, '').trim();
        if (!cleanWkt) return null;

        const matches = cleanWkt.match(/-?\d+(\.\d+)?/g);
        if (matches && matches.length >= 2) {
            const v1 = Math.abs(parseFloat(matches[0]));
            const v2 = Math.abs(parseFloat(matches[1]));
            if (v1 <= 180 && v2 <= 180) {
                return wktFormat.readFeature(cleanWkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            }
        }
        return wktFormat.readFeature(cleanWkt);
    } catch (e) {
        console.error('Safe WKT parse error:', e);
        return null;
    }
};

// BRAND NEW REBUILT SPATIAL BOUNDARY MODAL (100% GLITCH-FREE)
const SpatialBoundaryModal = ({ user, token, onClose, onSaveSuccess }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const citiesSourceRef = useRef(null);
    const vectorLayerRef = useRef(null);
    const citiesVectorLayerRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const selectedPlatesSetRef = useRef(new Set());

    const [currentWkt, setCurrentWkt] = useState(user?.spatialBoundaryWkt || '');
    const [isDrawing, setIsDrawing] = useState(false);
    const isDrawingRef = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        isDrawingRef.current = isDrawing;
    }, [isDrawing]);

    const historyRef = useRef(user?.spatialBoundaryWkt ? [user.spatialBoundaryWkt] : []);
    const historyIndexRef = useRef(user?.spatialBoundaryWkt ? 0 : -1);

    const [history, setHistory] = useState(user?.spatialBoundaryWkt ? [user.spatialBoundaryWkt] : []);
    const [historyIndex, setHistoryIndex] = useState(user?.spatialBoundaryWkt ? 0 : -1);

    const [dynamicCities, setDynamicCities] = useState([]);
    const [showRegionSelector, setShowRegionSelector] = useState(false);
    const [presetTab, setPresetTab] = useState('regions'); // 'regions' | 'provinces'
    const [presetSearch, setPresetSearch] = useState('');

    const activeProvinces = useMemo(() => {
        if (dynamicCities && dynamicCities.length > 0) {
            return dynamicCities
                .filter(c => !c.isDeleted)
                .map(c => ({
                    plate: Number(c.plate || c.id),
                    name: c.name,
                    region: c.region || '',
                    wkt: c.wkt || ''
                }))
                .sort((a, b) => a.plate - b.plate);
        }
        return TURKEY_PROVINCES;
    }, [dynamicCities]);

    const { activeRegions, activeRegionProvincesMap } = useMemo(() => {
        const regionMap = {};
        Object.keys(REGION_PROVINCES_MAP).forEach(k => {
            regionMap[k] = [...REGION_PROVINCES_MAP[k]];
        });
        const regionsSet = new Set(TURKEY_REGIONS.map(r => r.name));

        activeProvinces.forEach(p => {
            if (p.region && p.region.trim()) {
                const rName = p.region.trim();
                regionsSet.add(rName);
                if (!regionMap[rName]) {
                    regionMap[rName] = [];
                }
                if (!regionMap[rName].includes(p.plate)) {
                    regionMap[rName].push(p.plate);
                }
            }
        });

        return {
            activeRegions: Array.from(regionsSet).map(name => ({ name })),
            activeRegionProvincesMap: regionMap
        };
    }, [activeProvinces]);

    const refreshSelectedPlatesSet = () => {
        const nextSet = new Set();
        if (vectorSourceRef.current) {
            vectorSourceRef.current.getFeatures().forEach(f => {
                const p = f.get('plate') || f.get('number');
                const n = f.get('name');
                if (p) {
                    nextSet.add(p);
                    nextSet.add(Number(p));
                    nextSet.add(String(p));
                }
                if (n) {
                    nextSet.add(n);
                    nextSet.add(String(n).toLowerCase());
                    nextSet.add(String(n).toUpperCase());
                }
            });
        }
        selectedPlatesSetRef.current = nextSet;
        if (vectorLayerRef.current) vectorLayerRef.current.changed();
        if (citiesVectorLayerRef.current) citiesVectorLayerRef.current.changed();
        if (mapRef.current) mapRef.current.render();
    };

    const pushHistory = (wktStr) => {
        const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        nextHistory.push(wktStr);
        historyRef.current = nextHistory;
        historyIndexRef.current = nextHistory.length - 1;
        setHistory([...nextHistory]);
        setHistoryIndex(nextHistory.length - 1);
        setCurrentWkt(wktStr);
    };

    const updateWktFromVectorSource = () => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (features.length === 0) {
            pushHistory('');
            refreshSelectedPlatesSet();
            return;
        }
        const geoms = features.map(f => f.getGeometry());
        let wktStr = '';
        const wktFormat = new WKT();
        if (geoms.length === 1) {
            wktStr = wktFormat.writeGeometry(geoms[0], {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        } else {
            const collection = new GeometryCollection(geoms);
            wktStr = wktFormat.writeGeometry(collection, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        }
        pushHistory(wktStr);

        if (mapRef.current) {
            const extent = vectorSourceRef.current.getExtent();
            mapRef.current.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 11 });
        }

        refreshSelectedPlatesSet();
    };

    const handleSelectPresetBoundary = (item, e) => {
        const isShift = e && e.shiftKey;
        if (!vectorSourceRef.current || !citiesSourceRef.current) return;

        const features = citiesSourceRef.current.getFeatures();
        const regionProvinces = activeRegionProvincesMap[item.name];

        if (regionProvinces) {
            const regionCityFeatures = regionProvinces
                .map(provQuery => findCityFeature(features, provQuery))
                .filter(Boolean);

            const existingFeatures = vectorSourceRef.current.getFeatures();
            const allAlreadySelected = regionCityFeatures.length > 0 && regionCityFeatures.every(cityFeat => {
                const p = cityFeat.get('number') || cityFeat.get('plate');
                return existingFeatures.some(f => (f.get('plate') || f.get('number')) === p);
            });

            if (allAlreadySelected) {
                regionCityFeatures.forEach(cityFeat => {
                    const p = cityFeat.get('number') || cityFeat.get('plate');
                    const foundEx = vectorSourceRef.current.getFeatures().find(f => (f.get('plate') || f.get('number')) === p);
                    if (foundEx) {
                        vectorSourceRef.current.removeFeature(foundEx);
                    }
                });
            } else {
                if (!isShift) {
                    vectorSourceRef.current.clear();
                }
                regionCityFeatures.forEach(cityFeat => {
                    const p = cityFeat.get('number') || cityFeat.get('plate');
                    const currentFeats = vectorSourceRef.current.getFeatures();
                    const alreadyIn = currentFeats.some(f => (f.get('plate') || f.get('number')) === p);
                    if (!alreadyIn) {
                        const clonedGeom = cityFeat.getGeometry().clone();
                        const newFeature = new Feature({ geometry: clonedGeom });
                        newFeature.set('plate', p);
                        newFeature.set('name', cityFeat.get('name'));
                        vectorSourceRef.current.addFeature(newFeature);
                    }
                });
            }
        } else {
            const found = findCityFeature(features, item);
            if (found) {
                const plate = found.get('number') || found.get('plate');
                const existingFeatures = vectorSourceRef.current.getFeatures();
                const existingFeature = existingFeatures.find(f => (f.get('plate') || f.get('number')) === plate);

                if (existingFeature) {
                    vectorSourceRef.current.removeFeature(existingFeature);
                } else {
                    if (!isShift) {
                        vectorSourceRef.current.clear();
                    }
                    const clonedGeom = found.getGeometry().clone();
                    const newFeature = new Feature({ geometry: clonedGeom });
                    newFeature.set('plate', plate);
                    newFeature.set('name', found.get('name'));
                    vectorSourceRef.current.addFeature(newFeature);
                }
            }
        }

        updateWktFromVectorSource();
    };

    const applyWktToSource = (wktStr) => {
        if (!vectorSourceRef.current) return;
        vectorSourceRef.current.clear();
        if (!wktStr) {
            refreshSelectedPlatesSet();
            return;
        }
        try {
            const wktFormat = new WKT();
            const feature = readWktFeatureSafely(wktStr, wktFormat);
            if (feature) {
                vectorSourceRef.current.addFeature(feature);
            }
        } catch (err) {
            console.error('WKT haritaya uygulanamadı:', err);
        }
        refreshSelectedPlatesSet();
    };

    const handleUndo = () => {
        if (historyIndexRef.current > 0) {
            const newIndex = historyIndexRef.current - 1;
            const targetWkt = historyRef.current[newIndex];
            historyIndexRef.current = newIndex;
            setHistoryIndex(newIndex);
            setCurrentWkt(targetWkt);
            applyWktToSource(targetWkt);
        } else if (historyIndexRef.current === 0) {
            historyIndexRef.current = -1;
            setHistoryIndex(-1);
            setCurrentWkt('');
            applyWktToSource('');
        }
    };

    const handleRedo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            const newIndex = historyIndexRef.current + 1;
            const targetWkt = historyRef.current[newIndex];
            historyIndexRef.current = newIndex;
            setHistoryIndex(newIndex);
            setCurrentWkt(targetWkt);
            applyWktToSource(targetWkt);
        }
    };

    useEffect(() => {
        if (!mapContainerRef.current) return;

        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            zIndex: 10,
            style: new Style({
                stroke: new Stroke({
                    color: '#ef4444',
                    width: 3.5,
                    lineDash: [8, 8]
                }),
                fill: new Fill({
                    color: 'rgba(239, 68, 68, 0.38)'
                })
            })
        });
        vectorLayerRef.current = vectorLayer;

        const citiesSource = new VectorSource();
        citiesSourceRef.current = citiesSource;

        const citiesVectorLayer = new VectorLayer({
            source: citiesSource,
            zIndex: 5,
            style: (feature) => {
                const plate = feature.get('plate') || feature.get('number');
                const name = feature.get('name');
                const isSelected = (plate && (selectedPlatesSetRef.current.has(plate) || selectedPlatesSetRef.current.has(String(plate)) || selectedPlatesSetRef.current.has(Number(plate)))) ||
                                   (name && (selectedPlatesSetRef.current.has(name) || selectedPlatesSetRef.current.has(String(name).toLowerCase()) || selectedPlatesSetRef.current.has(String(name).toUpperCase())));

                if (isSelected) {
                    return new Style({
                        fill: new Fill({ color: 'rgba(239, 68, 68, 0.60)' }),
                        stroke: new Stroke({ color: '#ef4444', width: 3.5 }),
                        text: new Text({
                            text: feature.get('name') || '',
                            font: 'bold 12px Inter, sans-serif',
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#000000', width: 4 })
                        })
                    });
                }

                return new Style({
                    fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
                    stroke: new Stroke({ color: '#2563eb', width: 1.5 }),
                    text: new Text({
                        text: feature.get('name') || '',
                        font: '11px Inter, sans-serif',
                        fill: new Fill({ color: '#cbd5e1' }),
                        stroke: new Stroke({ color: '#0f172a', width: 2 })
                    })
                });
            }
        });
        citiesVectorLayerRef.current = citiesVectorLayer;

        const map = new Map({
            target: mapContainerRef.current,
            layers: [
                new TileLayer({
                    source: new XYZ({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
                        maxZoom: 19
                    })
                }),
                citiesVectorLayer,
                vectorLayer
            ],
            view: new View({
                center: fromLonLat([35.2433, 38.9637]),
                zoom: 6.2
            })
        });
        mapRef.current = map;

        // ResizeObserver guarantees 100% canvas sizing when container resizes or modal finishes animation
        const resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
                mapRef.current.updateSize();
                mapRef.current.render();
            }
        });
        resizeObserver.observe(mapContainerRef.current);

        const loadFeatures = async () => {
            let features = [];
            const wktFormat = new WKT();
            const geojsonFormat = new GeoJSON();

            // 1. PRIMARY SOURCE: Try loading live city data directly from Şehir ve Bölge Yönetimi (GeoManagement DB Table / API)
            try {
                const dbCities = await adminApi.getCities(false, token);
                if (dbCities && Array.isArray(dbCities) && dbCities.length > 0) {
                    setDynamicCities(dbCities);
                    dbCities.forEach(c => {
                        if (!c.isDeleted) {
                            let f = null;
                            if (c.wkt) {
                                try {
                                    f = readWktFeatureSafely(c.wkt, wktFormat);
                                } catch (e) {}
                            }
                            if (!f && c.geometry) {
                                try {
                                    f = geojsonFormat.readFeature({ type: 'Feature', geometry: c.geometry }, {
                                        dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'
                                    });
                                } catch (e) {}
                            }
                            if (f) {
                                const plateVal = parseInt(c.plate || c.id || 0, 10);
                                f.set('plate', plateVal);
                                f.set('number', plateVal);
                                f.set('name', c.name);
                                features.push(f);
                            }
                        }
                    });
                    console.log('[SpatialBoundaryModal] Loaded', features.length, 'live cities from GeoManagement DB API (/api/cities)');
                }
            } catch (e) {
                console.warn('[SpatialBoundaryModal] DB cities API fetch error, falling back to storage:', e);
            }

            // 2. SECONDARY SOURCE: Try loading from GeoManagement published LocalStorage (v36 & v35)
            if (features.length === 0) {
                const storageKeys = ['admin_turkey_cities_published_v36', 'admin_turkey_cities_published_v35'];
                for (const key of storageKeys) {
                    const storedStr = localStorage.getItem(key);
                    if (storedStr) {
                        try {
                            const parsed = JSON.parse(storedStr);
                            const cityList = parsed.cities || (Array.isArray(parsed) ? parsed : []);
                            if (cityList && cityList.length > 0) {
                                cityList.forEach(c => {
                                    if (!c.isDeleted) {
                                        let f = null;
                                        if (c.geometry && c.geometry.coordinates) {
                                            try {
                                                f = geojsonFormat.readFeature({ type: 'Feature', geometry: c.geometry }, {
                                                    dataProjection: 'EPSG:4326',
                                                    featureProjection: 'EPSG:3857'
                                                });
                                            } catch (e) {}
                                        }
                                        if (!f && c.wkt) {
                                            try {
                                                f = readWktFeatureSafely(c.wkt, wktFormat);
                                            } catch (e) {}
                                        }
                                        if (f) {
                                            const plateVal = parseInt(c.plate || c.id || 0, 10);
                                            f.set('plate', plateVal);
                                            f.set('number', plateVal);
                                            f.set('name', c.name);
                                            features.push(f);
                                        }
                                    }
                                });
                                if (features.length > 0) {
                                    console.log('[SpatialBoundaryModal] Loaded', features.length, 'cities from GeoManagement storage key:', key);
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                }
            }

            // 3. FALLBACK SOURCE: If both DB and Storage are empty, fallback to base turkey-cities.json
            if (features.length === 0) {
                try {
                    const res = await fetch(`/data/turkey-cities.json?v=${Date.now()}`);
                    const data = await res.json();
                    features = geojsonFormat.readFeatures(data, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    console.log('[SpatialBoundaryModal] Fallback: Loaded', features.length, 'cities from turkey-cities.json');
                } catch (e) {
                    console.error('Turkey cities fetch error:', e);
                }
            }

            features.forEach(f => {
                const p = parseInt(f.get('plate') || f.get('number') || f.get('id') || f.get('PLATE') || 0, 10);
                const n = f.get('name') || f.get('NAME') || f.get('title') || '';
                if (p) {
                    f.set('plate', p);
                    f.set('number', p);
                }
                if (n) {
                    f.set('name', n);
                }
            });

            if (citiesSourceRef.current) {
                citiesSourceRef.current.clear();
                citiesSourceRef.current.addFeatures(features);

                if (user && user.spatialBoundaryWkt) {
                    try {
                        const initFeat = readWktFeatureSafely(user.spatialBoundaryWkt, wktFormat);
                        if (initFeat && vectorSourceRef.current) {
                            vectorSourceRef.current.clear();

                            const iGeom = initFeat.getGeometry();
                            if (iGeom) {
                                const iExt = iGeom.getExtent();
                                features.forEach(cf => {
                                    if (cf.getGeometry()) {
                                        const cExt = cf.getGeometry().getExtent();
                                        const cCenter = [(cExt[0] + cExt[2]) / 2, (cExt[1] + cExt[3]) / 2];
                                        let isMatch = false;
                                        try {
                                            if (iGeom.intersectsCoordinate(cCenter)) isMatch = true;
                                        } catch (e) {}
                                        if (!isMatch) {
                                            if (!(cExt[0] > iExt[2] || cExt[2] < iExt[0] || cExt[1] > iExt[3] || cExt[3] < iExt[1])) {
                                                isMatch = true;
                                            }
                                        }
                                        if (isMatch) {
                                            const p = cf.get('plate') || cf.get('number');
                                            const n = cf.get('name');
                                            if (p) initFeat.set('plate', p);
                                            if (n) initFeat.set('name', n);
                                        }
                                    }
                                });
                            }

                            vectorSourceRef.current.addFeature(initFeat);
                        }
                    } catch (e) {}
                }

                refreshSelectedPlatesSet();

                if (mapRef.current) {
                    try {
                        const extent = vectorSourceRef.current && vectorSourceRef.current.getFeatures().length > 0 ?
                            vectorSourceRef.current.getExtent() : citiesSourceRef.current.getExtent();
                        mapRef.current.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 10 });
                    } catch (e) {}

                    mapRef.current.updateSize();
                    mapRef.current.render();
                }

                if (citiesVectorLayerRef.current) {
                    citiesVectorLayerRef.current.changed();
                }

                setTimeout(() => {
                    refreshSelectedPlatesSet();
                    if (mapRef.current) {
                        mapRef.current.updateSize();
                        mapRef.current.render();
                    }
                }, 100);
            }
        };

        loadFeatures();

        // SINGLE CLICK HANDLER FOR MAP SELECTION
        map.on('singleclick', (evt) => {
            if (isDrawingRef.current) return;
            if (!citiesSourceRef.current || !vectorSourceRef.current) return;
            const isShift = evt.originalEvent && evt.originalEvent.shiftKey;

            let clickedCity = null;
            const pixel = map.getEventPixel(evt.originalEvent);

            map.forEachFeatureAtPixel(pixel, (feature) => {
                if (clickedCity) return;
                const plate = feature.get('plate') || feature.get('number');
                const name = feature.get('name');
                if (plate || name) {
                    const cityFeat = citiesSourceRef.current.getFeatures().find(f => {
                        const p = f.get('plate') || f.get('number');
                        const n = f.get('name');
                        return (plate && p === plate) || (name && n === name);
                    });
                    if (cityFeat) {
                        clickedCity = cityFeat;
                    }
                }
            });

            if (clickedCity) {
                const clickedPlate = clickedCity.get('number') || clickedCity.get('plate');
                const existingFeatures = vectorSourceRef.current.getFeatures();
                const existingFeature = existingFeatures.find(f => (f.get('plate') || f.get('number')) === clickedPlate);

                if (existingFeature) {
                    vectorSourceRef.current.removeFeature(existingFeature);
                } else {
                    if (!isShift) {
                        vectorSourceRef.current.clear();
                    }
                    const cityGeom = clickedCity.getGeometry().clone();
                    const newFeature = new Feature({ geometry: cityGeom });
                    newFeature.set('plate', clickedPlate);
                    newFeature.set('name', clickedCity.get('name'));
                    vectorSourceRef.current.addFeature(newFeature);
                }

                updateWktFromVectorSource();
            }
        });

        map.on('pointermove', (evt) => {
            if (evt.dragging || !citiesSourceRef.current) return;
            const pixel = map.getEventPixel(evt.originalEvent);
            const features = map.getFeaturesAtPixel(pixel);
            const hit = features && features.length > 0;
            map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });

        const modify = new Modify({ source: vectorSource });
        let snapshotBeforeModify = null;
        modify.on('modifystart', () => {
            const features = vectorSource.getFeatures();
            if (features.length > 0) {
                const geom = features[0].getGeometry();
                const wktFormat = new WKT();
                snapshotBeforeModify = wktFormat.writeGeometry(geom, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            }
        });

        modify.on('modifyend', () => {
            const features = vectorSource.getFeatures();
            if (features.length > 0) {
                const geom = features[0].getGeometry();
                const wktFormat = new WKT();
                const wktStr = wktFormat.writeGeometry(geom, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                if (historyIndexRef.current < 0 && snapshotBeforeModify) {
                    historyRef.current = [snapshotBeforeModify];
                    historyIndexRef.current = 0;
                }
                pushHistory(wktStr);
            }
        });
        map.addInteraction(modify);

        return () => {
            resizeObserver.disconnect();
            if (mapRef.current) {
                mapRef.current.setTarget(null);
            }
        };
    }, [user]);

    const handleZoomIn = () => {
        if (!mapRef.current) return;
        const view = mapRef.current.getView();
        view.animate({ zoom: view.getZoom() + 0.8, duration: 250 });
    };

    const handleZoomOut = () => {
        if (!mapRef.current) return;
        const view = mapRef.current.getView();
        view.animate({ zoom: view.getZoom() - 0.8, duration: 250 });
    };

    const handleToggleDraw = () => {
        if (!mapRef.current || !vectorSourceRef.current) return;

        if (isDrawing || drawInteractionRef.current) {
            if (drawInteractionRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
                drawInteractionRef.current = null;
            }
            setIsDrawing(false);
            return;
        }

        setIsDrawing(true);

        const draw = new Draw({
            source: vectorSourceRef.current,
            type: 'Polygon',
            freehand: false,
            freehandCondition: () => false
        });

        draw.on('drawend', (event) => {
            const geom = event.feature.getGeometry();
            const wktFormat = new WKT();
            const wktStr = wktFormat.writeGeometry(geom, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });

            pushHistory(wktStr);
            setIsDrawing(false);
            if (mapRef.current && drawInteractionRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
                drawInteractionRef.current = null;
            }
            refreshSelectedPlatesSet();
        });

        mapRef.current.addInteraction(draw);
        drawInteractionRef.current = draw;
    };

    const handleClearBoundary = () => {
        if (drawInteractionRef.current && mapRef.current) {
            mapRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (vectorSourceRef.current) {
            vectorSourceRef.current.clear();
        }
        setCurrentWkt('');
        pushHistory('');
        refreshSelectedPlatesSet();
    };

    const handleSaveSpatialBoundary = async () => {
        setSaving(true);
        setError('');
        try {
            await adminApi.setSpatialBoundary(user.id, currentWkt, token);
            onSaveSuccess(currentWkt);
        } catch (err) {
            setError(err.message || 'Coğrafi yetki sınırı kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="admin-modal" style={{ maxWidth: '1100px', width: '95vw', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <button
                    className="close-btn"
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '20px',
                        zIndex: 100,
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Kapat"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="modal-header-section" style={{ marginBottom: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '18px' }}>
                        <SpatialBoundaryIcon size={20} />
                        Coğrafi Sınır & Yetki Tanımlama: <span style={{ color: '#38bdf8' }}>{user.username}</span>
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                        Kullanıcının haritada erişebileceği alanı Türkiye'nin 81 ili ve coğrafi bölgeleri arasından seçebilir veya sağdaki poligon çizim aracıyla serbestçe belirleyebilirsiniz.
                    </p>
                </div>

                {error && (
                    <div className="admin-alert error" style={{ marginBottom: '12px' }}>
                        {error}
                    </div>
                )}

                <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', marginBottom: '18px' }}>
                    <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

                    {/* LIVE DRAWING HELPER BADGE */}
                    {isDrawing && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '16px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 100,
                                background: 'rgba(37, 99, 235, 0.95)',
                                backdropFilter: 'blur(12px)',
                                color: '#ffffff',
                                padding: '6px 16px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                pointerEvents: 'none',
                                border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}
                        >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                            <span>Poligon Çizimi Aktif: Haritada köşeleri tıklayın, bitirmek için çift tıklayın (İptal için butona tekrar basın)</span>
                        </div>
                    )}

                    {/* UNIFIED ZOOM BUTTONS CARD (TOP) */}
                    <div
                        className="toolbar-zoom-card"
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            zIndex: 10
                        }}
                    >
                        <button className="zoom-btn-exact" onClick={handleZoomIn} title="Yakınlaştır (+)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                        <button className="zoom-btn-exact" onClick={handleZoomOut} title="Uzaklaştır (-)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                    </div>

                    {/* UNIFIED MAP TOOLS CARD (BOTTOM - ALIGNED UNDER ZOOM) */}
                    <div
                        className="toolbar-tools-card"
                        style={{
                            position: 'absolute',
                            top: '122px',
                            right: '20px',
                            zIndex: 10
                        }}
                    >
                        <button
                            type="button"
                            className={`tool-btn-exact dark-style ${isDrawing ? 'active' : ''}`}
                            onClick={handleToggleDraw}
                            title={isDrawing ? 'Poligon Çizimini İptal Et / Kapat' : 'Özel Poligon Sınırı Çiz'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className={`tool-btn-exact dark-style ${showRegionSelector ? 'active' : ''}`}
                            onClick={() => setShowRegionSelector(!showRegionSelector)}
                            title="İl veya Coğrafi Bölge Sınırı Ekle"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                        </button>

                        <div className="toolbar-inner-divider" style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

                        <button
                            type="button"
                            className="tool-btn-exact grey-style"
                            onClick={handleUndo}
                            disabled={historyIndex < 0}
                            title="Geri Al"
                        >
                            <UndoIcon size={18} />
                        </button>

                        <button
                            type="button"
                            className="tool-btn-exact grey-style"
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            title="İleri Al"
                        >
                            <RedoIcon size={18} />
                        </button>

                        {currentWkt && (
                            <button
                                type="button"
                                className="tool-btn-exact red-style"
                                onClick={handleClearBoundary}
                                title="Sınırı Temizle"
                            >
                                <TrashIcon size={18} />
                            </button>
                        )}
                    </div>

                    {/* İL / BÖLGE SEÇİM PANELİ */}
                    {showRegionSelector && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '16px',
                                left: '16px',
                                width: '250px',
                                maxHeight: '420px',
                                zIndex: 100,
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '10px',
                                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                color: '#f8fafc'
                            }}
                        >
                            <div style={{ padding: '8px 12px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    İl / Bölge Seç
                                </span>
                                <button
                                    onClick={() => setShowRegionSelector(false)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Kapat"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div style={{ display: 'flex', padding: '6px', gap: '4px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                                <button
                                    type="button"
                                    onClick={() => setPresetTab('regions')}
                                    style={{
                                        flex: 1,
                                        padding: '5px 2px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: presetTab === 'regions' ? '#2563eb' : '#1e293b',
                                        color: '#ffffff'
                                    }}
                                >
                                    Bölgeler (7)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPresetTab('provinces')}
                                    style={{
                                        flex: 1,
                                        padding: '5px 2px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: presetTab === 'provinces' ? '#2563eb' : '#1e293b',
                                        color: '#ffffff'
                                    }}
                                >
                                    İller (81)
                                </button>
                            </div>

                            {presetTab === 'provinces' && (
                                <div style={{ padding: '6px 8px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                                    <input
                                        type="text"
                                        placeholder="İl ara (Örn: Ankara)..."
                                        value={presetSearch}
                                        onChange={(e) => setPresetSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '5px 8px',
                                            fontSize: '11.5px',
                                            borderRadius: '5px',
                                            border: '1px solid #334155',
                                            backgroundColor: '#1e293b',
                                            color: '#ffffff',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            )}

                            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {presetTab === 'regions' ? (
                                    activeRegions.map((reg, idx) => (
                                        <div
                                            key={idx}
                                            onClick={(e) => handleSelectPresetBoundary(reg, e)}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #334155',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(ev) => ev.currentTarget.style.borderColor = '#38bdf8'}
                                            onMouseLeave={(ev) => ev.currentTarget.style.borderColor = '#334155'}
                                        >
                                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                                                {reg.name}
                                            </span>
                                            <button
                                                type="button"
                                                title="Yetki Alanına Ekle"
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    minWidth: '24px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#2563eb',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    padding: 0,
                                                    margin: 0,
                                                    lineHeight: 0,
                                                    flexShrink: 0,
                                                    marginLeft: 'auto'
                                                }}
                                            >
                                                <PlusIcon size={13} style={{ display: 'block', margin: 0, padding: 0 }} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    activeProvinces
                                        .filter(p => {
                                            if (!presetSearch || !presetSearch.trim()) return true;
                                            const q = presetSearch.trim();
                                            const normQ = normalizeCityName(q);
                                            const normP = normalizeCityName(p.name);
                                            const plateStr = p.plate.toString();
                                            const platePadded = plateStr.padStart(2, '0');
                                            return normP.includes(normQ) || plateStr.includes(q) || platePadded.includes(q);
                                        })
                                        .map((prov) => (
                                            <div
                                                key={prov.plate}
                                                onClick={(e) => handleSelectPresetBoundary(prov, e)}
                                                style={{
                                                    padding: '5px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid #334155',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={(ev) => ev.currentTarget.style.borderColor = '#38bdf8'}
                                                onMouseLeave={(ev) => ev.currentTarget.style.borderColor = '#334155'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                                                    <span style={{ padding: '1px 5px', backgroundColor: '#334155', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800, color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                                                        {prov.plate < 10 ? `0${prov.plate}` : prov.plate}
                                                    </span>
                                                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {prov.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    title="Yetki Alanına Ekle"
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        minWidth: '24px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#2563eb',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        padding: 0,
                                                        margin: 0,
                                                        lineHeight: 0,
                                                        flexShrink: 0,
                                                        marginLeft: 'auto'
                                                    }}
                                                >
                                                    <PlusIcon size={13} style={{ display: 'block', margin: 0, padding: 0 }} />
                                                </button>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: currentWkt ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentWkt ? '#10b981' : '#64748b' }} />
                        {currentWkt ? 'Sınır Poligonu Tanımlandı' : 'Henüz coğrafi sınır tanımlanmadı (Tüm Türkiye kısıtlamasız).'}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="admin-secondary-btn" onClick={onClose} disabled={saving}>
                            İptal
                        </button>
                        <button
                            type="button"
                            className="admin-primary-btn"
                            onClick={handleSaveSpatialBoundary}
                            disabled={saving}
                            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                        >
                            {saving ? 'Kaydediliyor...' : 'Coğrafi Sınırı Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
