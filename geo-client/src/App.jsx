import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import HeatmapLayer from 'ol/layer/Heatmap';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import LineString from 'ol/geom/LineString';
import { Style, Icon, Stroke, Fill, Text, Circle as CircleStyle } from 'ol/style';
import { setupPulsingSpatialBoundaryLayer, isGeomInsideBoundary } from './utils/spatialConstraint';

import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import { fromLonLat, toLonLat } from 'ol/proj';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import Collection from 'ol/Collection';
import WKT from 'ol/format/WKT';
import GeoJSON from 'ol/format/GeoJSON';

import Overlay from 'ol/Overlay';
import { getLength, getArea } from 'ol/sphere';
import { getCenter } from 'ol/extent';
import ScaleLine from 'ol/control/ScaleLine';

// PrimeReact Bileşenleri
import { Toast } from 'primereact/toast';

import { translations } from './translations';
import { AdminDashboard } from './components/admin/AdminDashboard';
import UserProfileDrawer from './components/profile/UserProfileDrawer';
import { BASEMAP_LAYERS, getBasemapConfig } from './constants/mapLayers';
import { MapLayerSwitcher } from './components/common/MapLayerSwitcher';
import { HistoricalTimelineSlider } from './components/common/HistoricalTimelineSlider';
import { adminApi } from './services/adminApi';
import { transportApi } from './services/transportApi';
import { userPersonalApi } from './services/userPersonalApi';
import { getPoiCategoryBadgeSvg, getLocalizedPoiCategoryLabel } from './constants/poiIcons';
import { simulationHubService } from './services/simulationHubService';
import { formatDuration } from './utils/formatUtils';
import { getRouteClassInfo, getVehicleClassInnerSvg, RouteClassIcon } from './constants/routeClasses';
import { calculateTransitRoute } from './utils/transitRouting';
import { getZoomSettings, DEFAULT_ZOOM_SETTINGS } from './constants/zoomSettings';
import { cleanPortName, getSeaportInfo, TURKISH_SEAPORTS } from './constants/seaports';
import { cleanAirportName, getAirportInfo, TURKISH_AIRPORTS } from './constants/airports';
import { calculateGeometryMetrics } from './utils/geometryUtils';
import './App.css';

// Açısal En Kısa Yol İnterpolasyonu (Angle Shortest Path Lerp - 360 dönüş sıçramalarını önler)
export function lerpAngle(startRad, targetRad, t) {
    let diff = (targetRad - startRad) % (2 * Math.PI);
    if (diff < -Math.PI) diff += 2 * Math.PI;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    return startRad + diff * t;
}

// CANLI SİMÜLASYON ARAÇ İKONU & ROTASYONLU STİL OLUŞTURUCU
export function createSimulatedVehicleStyle(vehicleData) {
    const bearingDeg = vehicleData?.bearing || 0;
    const bearingRad = (bearingDeg * Math.PI) / 180;
    const routeColor = vehicleData?.routeColor || '#3b82f6';
    const percent = Math.round(vehicleData?.progressPercentage || 0);
    const routeClass = vehicleData?.routeClass || vehicleData?.class || 'araba';
    const innerVectorPath = getVehicleClassInnerSvg(routeClass);

    const vehicleSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
        <defs>
            <filter id="v-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
        </defs>
        <!-- Radar Nabız Halkası -->
        <circle cx="26" cy="26" r="23" fill="${routeColor}" fill-opacity="0.22" stroke="${routeColor}" stroke-width="1.8" stroke-dasharray="3,3"/>
        <!-- Dış Daire -->
        <circle cx="26" cy="26" r="19" fill="#0f172a" stroke="#ffffff" stroke-width="2.5" filter="url(#v-shadow)"/>
        <!-- Canlı Renk Çekirdeği -->
        <circle cx="26" cy="26" r="15" fill="${routeColor}"/>
        <!-- Sınıfa Özel Araç Vektörü (Gemi, Metro, Tren, Araba, Yürüyüş, Bisiklet) -->
        <g fill="#ffffff" transform="translate(17, 16) scale(0.75)">
            ${innerVectorPath}
        </g>
        <!-- İleri Yön Göstergesi (Direction Needle Arrow) -->
        <polygon points="26,2 30,9 22,9" fill="#ffffff" stroke="#0f172a" stroke-width="0.8"/>
    </svg>
    `;

    return new Style({
        image: new Icon({
            src: 'data:image/svg+xml;utf8,' + encodeURIComponent(vehicleSvg),
            scale: 0.95,
            rotation: bearingRad,
            rotateWithView: true,
            anchor: [0.5, 0.5]
        }),
        text: new Text({
            text: `%${percent}`,
            font: 'bold 11px Inter, system-ui, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
            offsetY: 28,
            overflow: true
        }),
        zIndex: 100
    });
}

// YOL TARİFİ (DIRECTIONS) ROTA ÇİZGİSİ VE BAŞLANGIÇ/HEDEF NOKTA STİLİ
export function createDirectionsStyle(feature) {
    if (!feature) return [];
    const geom = feature.getGeometry();
    if (!geom) return [];
    const type = geom.getType();

    if (type === 'LineString') {
        const mode = feature.get('mode') || 'driving';

        if (mode === 'gemi') {
            // Gemi / Vapur Rotası (Canlı Turkuaz Deniz Yolu & Kesikli Su Hattı)
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#083344',
                        width: 8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#06b6d4',
                        width: 5,
                        lineDash: [4, 6],
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        } else if (mode === 'metro' || mode === 'tren') {
            // Metro / Raylı Sistem Rotası (Kırmızı Hat Çizgisi)
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#450a0a',
                        width: 8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#ef4444',
                        width: 5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        } else if (mode === 'transit' || mode === 'otobus') {
            // Toplu Taşıma / Otobüs Rotası (Vurgulu Canlı Mavi/Teal Çizgi)
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#0f172a',
                        width: 8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#0284c7',
                        width: 5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        } else if (mode === 'walking') {
            // Google Haritalar Tarzı Yeşil Kesikli Yaya / Yürüyüş Yolu
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#064e3b',
                        width: 7,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#10b981',
                        width: 4.5,
                        lineDash: [2, 7],
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        } else if (mode === 'cycling') {
            // Bisiklet Yolu (Mor Çizgi)
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#3b0764',
                        width: 7,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#8b5cf6',
                        width: 4.5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        } else {
            // Arabayla / Sürüş (Google Haritalar Tarzı Canlı Mavi Rota)
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#1e3a8a',
                        width: 7,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 38
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#2563eb',
                        width: 4.5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }),
                    zIndex: 39
                })
            ];
        }
    } else if (type === 'Point') {
        const isStart = feature.get('isStartPoint');
        const isEnd = feature.get('isEndPoint');
        const label = feature.get('pointLabel') || (isStart ? 'A' : (isEnd ? 'B' : '•'));
        const color = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#3b82f6');
        return new Style({
            image: new CircleStyle({
                radius: 13,
                fill: new Fill({ color }),
                stroke: new Stroke({ color: '#ffffff', width: 2.5 })
            }),
            text: new Text({
                text: label,
                fill: new Fill({ color: '#ffffff' }),
                font: 'bold 12px Inter, sans-serif'
            }),
            zIndex: 45
        });
    }
    return [];
}

// Metro / Raylı Sistem Durağı İkonu (Sayı yerine Metro Tren İkonu)
export function getMetroStopPinSvg(routeColor = '#ef4444') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
        <defs>
            <filter id="metroShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.35"/>
            </filter>
        </defs>
        <circle cx="12" cy="12" r="10" fill="${routeColor}" stroke="#ffffff" stroke-width="2" filter="url(#metroShadow)"/>
        <rect x="7.5" y="6" width="9" height="10" rx="1.5" fill="none" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="7.5" y1="11" x2="16.5" y2="11" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="9.5" cy="13.5" r="0.9" fill="#ffffff"/>
        <circle cx="14.5" cy="13.5" r="0.9" fill="#ffffff"/>
        <line x1="8.5" y1="16" x2="7" y2="18" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="15.5" y1="16" x2="17" y2="18" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
}

// Otobüs Durağı İkonu (Sayı yerine Otobüs İkonu)
export function getBusStopPinSvg(routeColor = '#0284c7') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 22 22">
        <defs>
            <filter id="busShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.35"/>
            </filter>
        </defs>
        <circle cx="11" cy="11" r="9" fill="${routeColor}" stroke="#ffffff" stroke-width="1.8" filter="url(#busShadow)"/>
        <rect x="6.8" y="5.5" width="8.4" height="9.5" rx="1.5" fill="none" stroke="#ffffff" stroke-width="1.4"/>
        <line x1="6.8" y1="9.5" x2="15.2" y2="9.5" stroke="#ffffff" stroke-width="1.1"/>
        <circle cx="8.5" cy="12.5" r="0.8" fill="#ffffff"/>
        <circle cx="13.5" cy="12.5" r="0.8" fill="#ffffff"/>
        <line x1="8" y1="15" x2="7" y2="16.5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
        <line x1="14" y1="15" x2="15" y2="16.5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`;
}

// Gemi / Vapur İskelesi Terminal Pini (Çapa İkonlu Pin)
export function getFerryTerminalPinSvg(routeColor = '#0891b2') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
        <defs>
            <filter id="ferryShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.35"/>
            </filter>
        </defs>
        <circle cx="12" cy="12" r="10" fill="${routeColor || '#0891b2'}" stroke="#ffffff" stroke-width="2" filter="url(#ferryShadow)"/>
        <path d="M12 5.5v9M8.5 9h7M7 13.5c0 2.8 2.2 5 5 5s5-2.2 5-5" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="6.5" r="1.1" fill="#ffffff"/>
    </svg>`;
}

// Genel / Standart Durak İkonu Seçici (Sayı yok, her 6 türe özel vektörel simge)
export function getStopPinSvg(routeClass = 'otobus', routeColor = '#3b82f6') {
    const rc = (routeClass || '').toLowerCase().trim();
    if (rc === 'havayolu' || rc === 'havalimani' || rc === 'ucak' || rc === 'airport') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="${routeColor || '#0284c7'}" stroke="#ffffff" stroke-width="2"/>
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#ffffff"/>
        </svg>`;
    }
    if (rc === 'metro') return getMetroStopPinSvg(routeColor);
    if (rc === 'otobus' || rc === 'bus') return getBusStopPinSvg(routeColor);
    if (rc === 'gemi' || rc === 'deniz' || rc === 'vapur') return getFerryTerminalPinSvg(routeColor);
    if (rc === 'tramvay' || rc === 'tram') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="${routeColor}" stroke="#ffffff" stroke-width="2"/>
            <path d="M17 14.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v8.5a2 2 0 0 0 1.5 1.95V18a1 1 0 0 0 1 1h1v-1h3v1h1a1 1 0 0 0 1-1v-1.55a2 2 0 0 0 1.5-1.95zM8 6h8v3H8V6zm1.5 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="#ffffff"/>
        </svg>`;
    }
    if (rc === 'metrobus') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="${routeColor}" stroke="#ffffff" stroke-width="2"/>
            <path d="M5 14c0 .8.3 1.5.8 1.9V17c0 .5.4 1 1 1h1v-1h8v1h1c.6 0 1-.5 1-1v-1.1c.5-.4.8-1.1.8-1.9V6c0-2.8-2.8-3-6.8-3s-6.8.2-6.8 3v8zm2.5.5c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm9 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zM18 9H6V5.5h12V9z" fill="#ffffff"/>
            <path d="M12 2l1.5 1.5h-3L12 2z" fill="#ffffff"/>
        </svg>`;
    }
    if (rc === 'tren' || rc === 'train') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="${routeColor}" stroke="#ffffff" stroke-width="2"/>
            <path d="M8 6h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="#ffffff" stroke-width="1.5"/>
            <line x1="6" y1="11" x2="18" y2="11" stroke="#ffffff" stroke-width="1.2"/>
            <circle cx="9" cy="14" r="0.9" fill="#ffffff"/>
            <circle cx="15" cy="14" r="0.9" fill="#ffffff"/>
            <line x1="8" y1="17" x2="6" y2="19" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="16" y1="17" x2="18" y2="19" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
        </svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7.5" fill="${routeColor}" stroke="#ffffff" stroke-width="1.8"/>
        <circle cx="10" cy="10" r="3" fill="#ffffff"/>
    </svg>`;
}

// GOOGLE MAPS TARZI AKILLI ULAŞIM GÜZERGAH STİLİ
// 1. Gemi, metro, uçak ve otobüs hatları dinamik zoom ayarına göre gösterilir
// 2. Havayolu uçuş koridorları kesikli şık parabolik yay olarak çizilir
export function createTransitRouteStyle(feature, resolution, selectedRouteId) {
    if (!feature) return null;
    const geom = feature.getGeometry();
    if (!geom) return null;

    const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : 12;
    const r = feature.get('routeData');
    const routeColor = r?.color || feature.get('routeColor') || '#3b82f6';
    const rClass = (r?.routeClass || feature.get('routeClass') || 'araba').toLowerCase().trim();
    const routeId = r?.id || feature.get('id');
    const isSelected = selectedRouteId === routeId;

    const isHavayolu = rClass === 'havayolu' || rClass === 'ucak' || rClass === 'flight' || rClass === 'airway';
    const isBus = rClass === 'otobus' || rClass === 'bus';
    const isMetro = rClass === 'metro';
    const isGemi = rClass === 'gemi' || rClass === 'deniz';
    const isTren = rClass === 'tren' || rClass === 'train';

    const zs = getZoomSettings();
    let minRouteZoom;
    if (isHavayolu) {
        minRouteZoom = zs.flightRouteMinZoom ?? 4.5;
    } else if (isGemi) {
        minRouteZoom = zs.shipRouteMinZoom ?? 8.5;
    } else if (isMetro) {
        minRouteZoom = zs.metroRouteMinZoom ?? 11.5;
    } else if (isTren) {
        minRouteZoom = zs.trainRouteMinZoom ?? 10.0;
    } else if (isBus) {
        minRouteZoom = zs.busRouteMinZoom ?? 11.5;
    } else {
        minRouteZoom = zs.routeMinZoom ?? 11.5;
    }

    // Dinamik zoom eşiği kontrolü (Admin panelinden ayarlanabilir)
    // Seçili rota her zoom seviyesinde her zaman görünür, seçili olmayanlar eşik zoom değerinde görünür
    if (!isSelected && zoom < minRouteZoom) {
        return null;
    }

    // 3. Çizgi kalınlıkları
    const baseWidth = isSelected ? 4.6 : (isHavayolu ? 3.4 : (isMetro ? 3.8 : (isTren ? 3.2 : (isBus ? 2.6 : (isGemi ? 2.4 : 2.4)))));
    const outlineWidth = baseWidth + (isSelected ? 2.8 : (isHavayolu ? 2.0 : (isMetro ? 2.2 : 1.6)));

    // 4. Kesikli çizgiler (Havayolu ve Gemi)
    const lineDash = isHavayolu ? [10, 6] : (isGemi ? [8, 8] : undefined);

    // Renkler
    let strokeColor;
    let outlineColor;

    if (isSelected) {
        strokeColor = routeColor;
        outlineColor = '#ffffff';
    } else {
        if (isHavayolu) {
            strokeColor = 'rgba(2, 132, 199, 0.90)';
            outlineColor = 'rgba(255, 255, 255, 0.70)';
        } else if (isGemi) {
            strokeColor = 'rgba(6, 182, 212, 0.70)';
            outlineColor = 'rgba(255, 255, 255, 0.60)';
        } else if (isMetro) {
            strokeColor = hexToRgba(routeColor, 0.95);
            outlineColor = '#ffffff';
        } else if (isTren) {
            strokeColor = hexToRgba(routeColor, 0.85);
            outlineColor = 'rgba(255, 255, 255, 0.65)';
        } else if (isBus) {
            strokeColor = hexToRgba(routeColor, 0.75);
            outlineColor = 'rgba(255, 255, 255, 0.55)';
        } else {
            strokeColor = hexToRgba(routeColor, 0.65);
            outlineColor = 'rgba(255, 255, 255, 0.45)';
        }
    }

    const styles = [
        // Zemin kontrast çizgisi
        new Style({
            stroke: new Stroke({
                color: outlineColor,
                width: outlineWidth,
                lineDash: lineDash,
                lineCap: 'round',
                lineJoin: 'round'
            }),
            zIndex: isSelected ? 34 : (isMetro ? 25 : (isTren ? 23 : (isGemi ? 17 : 14)))
        }),
        // Ana güzergah çizgisi
        new Style({
            stroke: new Stroke({
                color: strokeColor,
                width: baseWidth,
                lineDash: lineDash,
                lineCap: 'round',
                lineJoin: 'round'
            }),
            zIndex: isSelected ? 35 : (isMetro ? 26 : (isTren ? 24 : (isGemi ? 18 : 15)))
        })
    ];

    // 5. Hat ismi yalnızca yeterli zoom seviyesinde veya hat seçildiğinde gösterilsin (Kesişimlerde çakışmasın)
    const routeName = r?.name || feature.get('routeName') || '';
    // Gemi hatlarında çizgi üstünde sade isim göster: "Mersin - Girne" (Liman/Limanı/Port kelimeleri olmadan)
    const displayLabel = isGemi ? (() => {
        if (routeName.includes(' - ')) {
            const parts = routeName.split(' - ');
            return parts.map(p => cleanPortName(p)).join(' - ');
        }
        return cleanPortName(routeName);
    })() : routeName;
    const routeNameMinZoom = zs.routeNameMinZoom ?? 12.0;
    if (displayLabel && (zoom >= routeNameMinZoom || isSelected)) {
        styles.push(
            new Style({
                text: new Text({
                    text: displayLabel,
                    placement: 'line',
                    maxAngle: Math.PI / 6, // Keskin viraj ve kavşak çakışmalarını önle
                    repeat: isGemi ? 700 : (isMetro ? 550 : 600), // Kesişen hatların üst üste binmesini önleyen geniş aralık
                    overflow: false, // Çakışmaları engelle
                    font: isSelected
                        ? '700 11.5px Inter, -apple-system, system-ui, sans-serif'
                        : (isMetro ? '700 11px Inter, -apple-system, system-ui, sans-serif' : '600 10.5px Inter, -apple-system, system-ui, sans-serif'),
                    fill: new Fill({
                        color: isSelected ? '#0f172a' : (isMetro ? routeColor : (isGemi ? '#0891b2' : '#1e3a8a'))
                    }),
                    stroke: new Stroke({
                        color: '#ffffff',
                        width: 3.5,
                        lineJoin: 'round'
                    }),
                    offsetY: -7
                }),
                zIndex: isSelected ? 36 : (isMetro ? 27 : 20)
            })
        );
    }

    return styles;
}

// ROTA ÇİZGİSİ STİL ÜRETİCİSİ (GERİYE DÖNÜK UYUMLULUK KÖPRÜSÜ)
export function createRouteStyleWithDirectionArrows(lineGeom, routeColor = '#3b82f6') {
    return [
        new Style({
            stroke: new Stroke({
                color: 'rgba(255, 255, 255, 0.6)',
                width: 4.5,
                lineCap: 'round',
                lineJoin: 'round'
            }),
            zIndex: 11
        }),
        new Style({
            stroke: new Stroke({
                color: hexToRgba(routeColor, 0.72),
                width: 2.8,
                lineCap: 'round',
                lineJoin: 'round'
            }),
            zIndex: 12
        })
    ];
}

// Hex rengi RGBA stringe çevirme yardımcısı
function hexToRgba(hex, alpha = 0.35) {
    if (!hex) return `rgba(59, 130, 246, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PRESET_COLORS = [
    { label: 'Mavi', hex: '#3b82f6' },
    { label: 'Yeşil', hex: '#10b981' },
    { label: 'Kırmızı', hex: '#ef4444' },
    { label: 'Turuncu', hex: '#f59e0b' },
    { label: 'Mor', hex: '#8b5cf6' },
    { label: 'Pembe', hex: '#ec4899' },
    { label: 'Koyu', hex: '#1f2937' }
];

// Yüksek Detaylı Vektörel Sanatçı Renk Paleti İkonu
const DetailedPaletteIcon = ({ size = 18, color = "#ffffff" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C13.2033 22 14.18 21.0233 14.18 19.82C14.18 19.26 13.95 18.75 13.58 18.38C13.22 18.01 13 17.51 13 16.96C13 15.86 13.9 14.96 15 14.96H16.82C19.68 14.96 22 12.64 22 9.78C22 5.48 17.52 2 12 2Z" fill="rgba(255,255,255,0.25)" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="7.5" cy="11.5" r="1.4" fill="#f59e0b" />
        <circle cx="10.5" cy="7.5" r="1.4" fill="#10b981" />
        <circle cx="15.5" cy="7.5" r="1.4" fill="#ec4899" />
        <circle cx="18.5" cy="11.5" r="1.4" fill="#3b82f6" />
        <circle cx="9.5" cy="17.5" r="1.4" stroke={color} strokeWidth="1.2" />
    </svg>
);

// Vektörel Yüksek Kaliteli Bayrak İkonları (Tüm Tarayıcılarda Kusursuz Görünüm)
const TurkeyFlag = () => (
    <svg width="18" height="13" viewBox="0 0 1200 800" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
        <rect width="1200" height="800" fill="#E30A17" />
        <circle cx="425" cy="400" r="200" fill="#ffffff" />
        <circle cx="475" cy="400" r="160" fill="#E30A17" />
        <polygon points="583.3,400 684.8,433 622,346.5 622,453.5 684.8,367" fill="#ffffff" />
    </svg>
);

const UKFlag = () => (
    <svg width="18" height="13" viewBox="0 0 60 30" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
        <clipPath id="uk-clip"><rect width="60" height="30" /></clipPath>
        <g clipPath="url(#uk-clip)">
            <rect width="60" height="30" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
            <path d="M30,0 V30 M0,15 H60" stroke="#ffffff" strokeWidth="10" />
            <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
        </g>
    </svg>
);

// Modern ve Standart SVG Kapat (X) İkonu
const CloseIcon = ({ size = 15, strokeWidth = 2.4, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

function parsePoiImages(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(x => typeof x === 'string' && x.trim());
    if (typeof raw !== 'string') return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string' && x.trim());
        } catch { }
    }
    if (trimmed.startsWith('data:image/')) {
        return [trimmed];
    }
    if (trimmed.includes('||')) {
        return trimmed.split('||').map(s => s.trim()).filter(Boolean);
    }
    if (trimmed.includes(',') && !trimmed.startsWith('data:')) {
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [trimmed];
}

function serializePoiImages(images = []) {
    if (!Array.isArray(images) || images.length === 0) return null;
    const clean = images.filter(x => typeof x === 'string' && x.trim());
    if (clean.length === 0) return null;
    if (clean.length === 1) return clean[0];
    return JSON.stringify(clean);
}

// Bilinen Ankara ve Türkiye Noktaları İçin Yüksek Çözünürlüklü Yedek Galeri Veritabanı
const KNOWN_LANDMARK_GALLERY = {
    atakule: [
        'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=80',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Atakule_Ankara_Turkey.jpg/800px-Atakule_Ankara_Turkey.jpg'
    ],
    botanik: [
        'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1000&q=80'
    ],
    kugulu: [
        'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80'
    ],
    genclik: [
        'https://images.unsplash.com/photo-1572276596237-5db2c3e16c5d?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1000&q=80'
    ],
    meclis: [
        'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80'
    ],
    tbmm: [
        'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80'
    ],
    hilton: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80'
    ],
    sheraton: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80'
    ],
    karum: [
        'https://images.unsplash.com/photo-1567449303078-57ad995bd301?auto=format&fit=crop&w=1000&q=80'
    ],
    hastane: [
        'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1000&q=80'
    ],
    muze: [
        'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1574958269340-fa927503f3dd?auto=format&fit=crop&w=1000&q=80'
    ],
    cami: [
        'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1000&q=80'
    ],
    anitkabir: [
        'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1627918544976-787cbdafe87c?auto=format&fit=crop&w=1000&q=80'
    ],
    airport: [
        'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=1000&q=80'
    ]
};

// Koordinattan Dinamik Yüksek Çözünürlüklü Uydu Harita Önizlemesi Üretici
function getStaticSatellitePreviewUrl(lat, lon, zoom = 16) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        return 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1000&q=80';
    }
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const xTile = Math.floor(((lon + 180) / 360) * n);
    const yTile = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${yTile}/${xTile}`;
}

// POI Fotoğraflarını Çözümleme (Kullanıcı Yüklemesi > Bilinen Nokta Galerisi > Dinamik Uydu/Harita Önizlemesi)
function resolveAllPoiImages(poi) {
    if (!poi) return [];
    const raw = poi.imageUrl || poi.image_url || poi.photoUrl || poi.imgUrl || poi.photo;
    const parsed = parsePoiImages(raw);
    if (parsed.length > 0) {
        return parsed.map(img => ({
            url: img,
            isUserUploaded: true,
            isSatelliteFallback: false
        }));
    }

    // İsim veya Açıklamadan Bilinen Landmark Eşleştirmesi
    const nameLower = (poi.name || '').toLowerCase().replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
    for (const [key, urls] of Object.entries(KNOWN_LANDMARK_GALLERY)) {
        if (nameLower.includes(key)) {
            return urls.map(u => ({
                url: u,
                isUserUploaded: false,
                isLandmarkPreset: true,
                isSatelliteFallback: false
            }));
        }
    }

    // Koordinat Varsa Dinamik Uydu & Harita Önizlemesi
    if (poi.latitude != null && poi.longitude != null) {
        const satUrl = getStaticSatellitePreviewUrl(poi.latitude, poi.longitude, 16);
        const osmUrl = `https://tile.openstreetmap.org/16/${Math.floor(((poi.longitude + 180) / 360) * Math.pow(2, 16))}/${Math.floor(((1 - Math.asinh(Math.tan((poi.latitude * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, 16))}.png`;
        return [
            { url: satUrl, isUserUploaded: false, isSatelliteFallback: true, label: 'Esri Gerçek Zamanlı Uydu Önizlemesi' },
            { url: osmUrl, isUserUploaded: false, isSatelliteFallback: true, label: 'Sokak & Topoloji Haritası' }
        ];
    }

    // Genel Şehir Önizlemesi
    return [{
        url: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1000&q=80',
        isUserUploaded: false,
        isSatelliteFallback: true
    }];
}

// AI Destekli Görsel Odak & Konumlandırma Hesaplayıcı (Otomatik Kadraj & Hizalama)
function getAiOptimalObjectPosition(poi, currentImage) {
    if (!poi) return 'center center';
    const name = (poi.name || '').toLowerCase();
    const cat = (poi.categoryName || poi.parentCategoryName || '').toLowerCase();
    const isSat = currentImage?.isSatelliteFallback;

    if (isSat) return 'center center';

    // Kule, anıt, yüksek yapılar (Atakule vb.)
    if (name.includes('atakule') || name.includes('kule') || name.includes('tower') || name.includes('anit') || name.includes('anıtkabir')) {
        return 'center 20%';
    }
    // Dini yapılar, camiler, minareler
    if (name.includes('cami') || name.includes('kilise') || cat.includes('dini') || cat.includes('ibadet')) {
        return 'center 25%';
    }
    // Müze ve tarihi kültürel miras
    if (cat.includes('muze') || cat.includes('müze') || cat.includes('tarih') || cat.includes('saray')) {
        return 'center 30%';
    }
    // Park, botanik bahçe, doğa alanları
    if (cat.includes('park') || cat.includes('bahce') || cat.includes('botanik') || cat.includes('vadi')) {
        return 'center 45%';
    }
    // AVM, hastane, idari binalar
    if (cat.includes('avm') || cat.includes('alisveris') || cat.includes('saglik') || cat.includes('hastane')) {
        return 'center 35%';
    }
    return 'center center';
}

// Üst Başlık Banner Galeri Bileşeni (Doğrudan Tıklamayla Tam Ekran Lightbox + Otomatik AI Kadrajı)
const PoiHeaderBannerGallery = ({
    poi,
    isDarkMode = true,
    onOpenEditModal,
    onOpenFullscreen
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const imageObjects = useMemo(() => resolveAllPoiImages(poi), [poi]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [poi?.id, poi?.imageUrl, poi?.latitude, poi?.longitude]);

    if (!imageObjects || imageObjects.length === 0) return null;

    const safeIndex = Math.min(currentIndex, imageObjects.length - 1);
    const currentImgObj = imageObjects[safeIndex] || imageObjects[0];

    const resolveUrl = (img) => {
        if (!img) return '';
        const trimmed = typeof img === 'string' ? img.trim() : (img.url ? img.url.trim() : '');
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
            return trimmed;
        }
        if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
            const p = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
            return `http://localhost:5041${p}`;
        }
        if (trimmed.startsWith('/')) {
            return `http://localhost:5041${trimmed}`;
        }
        return `http://localhost:5041/${trimmed}`;
    };

    const currentImgUrl = resolveUrl(currentImgObj.url || currentImgObj);
    const aiFocalPosition = getAiOptimalObjectPosition(poi, currentImgObj);

    const handleImgError = (e) => {
        if (e.currentTarget.src && e.currentTarget.src.includes('localhost:5041/uploads/')) {
            e.currentTarget.src = e.currentTarget.src.replace('http://localhost:5041', '');
            return;
        }
        // Hata durumunda uydu önizlemesine dön
        if (poi.latitude != null && poi.longitude != null) {
            e.currentTarget.src = getStaticSatellitePreviewUrl(poi.latitude, poi.longitude, 16);
        } else {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1000&q=80';
        }
    };

    // Fotoğrafa tıklandığında doğrudan büyük halde Lightbox açılır
    const handleBannerClick = () => {
        if (onOpenFullscreen) {
            onOpenFullscreen(currentImgUrl, safeIndex);
        }
    };

    return (
        <div style={{ width: '100%', position: 'relative', overflow: 'hidden', borderTopLeftRadius: '14px', borderTopRightRadius: '14px', background: '#090d16' }}>
            {/* Banner Görsel Alanı (Tıklanınca Tam Ekran Büyütür) */}
            <div
                onClick={handleBannerClick}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '160px',
                    cursor: 'zoom-in',
                    overflow: 'hidden',
                    userSelect: 'none'
                }}
                title="Büyük boyutta görüntülemek ve fotoğraflar arası gezmek için tıklayınız"
            >
                <img
                    src={currentImgUrl}
                    alt={`${poi.name || 'POI'} - Fotoğraf ${safeIndex + 1}`}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: aiFocalPosition,
                        display: 'block',
                        transition: 'transform 0.35s ease, opacity 0.2s ease'
                    }}
                    onError={handleImgError}
                />

                {/* Karartma Gradyanı (Okunabilirlik İçin) */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.7) 0%, rgba(15, 23, 42, 0) 35%, rgba(15, 23, 42, 0.4) 70%, rgba(15, 23, 42, 0.95) 100%)',
                    pointerEvents: 'none'
                }} />

                {/* Üst Sol: Aktif POI & Kategori Rozetleri */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 2,
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '3px 9px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#f8fafc',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                        <span>{currentImgObj.isSatelliteFallback ? 'AI Uydu Önizlemesi' : 'Aktif POI'}</span>
                    </div>

                    {poi.categoryName && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: poi.categoryColor ? `${poi.categoryColor}33` : 'rgba(59, 130, 246, 0.3)',
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${poi.categoryColor || '#3b82f6'}66`,
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '10.5px',
                            fontWeight: '600',
                            color: poi.categoryColor || '#60a5fa'
                        }}>
                            {poi.categoryName}
                        </div>
                    )}
                </div>

                {/* Üst Sağ: Fotoğraf Sayacı & Büyüt Butonu */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 3
                }}>
                    {imageObjects.length > 1 && (
                        <div style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            pointerEvents: 'none'
                        }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            <span>{safeIndex + 1} / {imageObjects.length}</span>
                        </div>
                    )}

                    {onOpenFullscreen && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenFullscreen(currentImgUrl, safeIndex);
                            }}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'all 0.15s ease'
                            }}
                            title="Büyük Boyutta Aç (Lightbox)"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                    )}
                </div>

                {/* Çoklu Fotoğraf İçin Sol / Sağ Hızlı Değiştirme Butonları */}
                {imageObjects.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(prev => (prev === 0 ? imageObjects.length - 1 : prev - 1));
                            }}
                            style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                zIndex: 3,
                                transition: 'all 0.15s ease'
                            }}
                            title="Önceki Fotoğraf"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(prev => (prev === imageObjects.length - 1 ? 0 : prev + 1));
                            }}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                zIndex: 3,
                                transition: 'all 0.15s ease'
                            }}
                            title="Sonraki Fotoğraf"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                    </>
                )}

                {/* Alt Orta: Dot İndikatörleri */}
                {imageObjects.length > 1 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '5px',
                        alignItems: 'center',
                        zIndex: 2,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        padding: '3px 8px',
                        borderRadius: '12px'
                    }}>
                        {imageObjects.map((_, idx) => (
                            <span
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(idx);
                                }}
                                style={{
                                    width: idx === safeIndex ? '16px' : '6px',
                                    height: '6px',
                                    borderRadius: '3px',
                                    backgroundColor: idx === safeIndex ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Alt Mini Küçük Resim Şeridi (Birden Fazla Resim Varsa) */}
            {imageObjects.length > 1 && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: '#070b14',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    overflowX: 'auto',
                    scrollbarWidth: 'none'
                }}>
                    {imageObjects.map((imgObj, idx) => {
                        const u = resolveUrl(imgObj.url || imgObj);
                        const isActive = idx === safeIndex;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(idx);
                                }}
                                style={{
                                    width: '42px',
                                    height: '28px',
                                    flexShrink: 0,
                                    padding: 0,
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    border: isActive ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                                    opacity: isActive ? 1 : 0.6,
                                    cursor: 'pointer',
                                    background: '#000000',
                                    boxShadow: isActive ? '0 0 8px rgba(56, 189, 248, 0.5)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <img src={u} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

function parseJwt(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function App() {
    // Görünüm Modu ('map' | 'admin')
    const [currentView, setCurrentView] = useState('map');
    // PrimeReact Toast Referansı
    const toastRef = useRef(null);
    const lastToastRef = useRef({ key: '', time: 0 });
    const localStartingSimRoutesRef = useRef(new Set());

    // Akıllı ve çakışmasız bildirim (Toast) yöneticisi (Spam ve Glitch Engelleme)
    const showAppToast = (config) => {
        if (!toastRef.current || !config) return;
        const now = Date.now();
        const currentLang = localStorage.getItem('lang') || 'tr';
        let summary = config.summary;
        if (currentLang === 'en') {
            if (summary === 'Başarılı') summary = 'Success';
            else if (summary === 'Hata') summary = 'Error';
            else if (summary === 'Uyarı') summary = 'Warning';
            else if (summary === 'Bilgi') summary = 'Info';
            else if (summary === 'Başarısız') summary = 'Failed';
            else if (summary === 'Kayıt Başarılı') summary = 'Saved Successfully';
            else if (summary === 'Konum Analizi Başarılı') summary = 'Location Analysis Success';
        }
        const key = `${config.severity || 'info'}_${summary || ''}_${config.detail || ''}`;
        if (lastToastRef.current.key === key && (now - lastToastRef.current.time < 2000)) {
            return; // 2 saniye içinde aynı bildirimi tekrar gösterme (bug/spam engelleme)
        }
        lastToastRef.current = { key, time: now };
        toastRef.current.show({
            life: 3200,
            ...config,
            summary
        });
    };
    const placeColorInputRef = useRef(null);
    const drawColorInputRef = useRef(null);
    const scaleLineTargetRef = useRef(null);

    // Dil (Türkçe / İngilizce) Durumu
    const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'tr');
    const t = translations[lang] || translations.tr;
    const trans = t;
    const isTr = (lang || 'tr') === 'tr';

    const toggleLang = () => {
        setLang(prev => {
            const next = prev === 'tr' ? 'en' : 'tr';
            localStorage.setItem('lang', next);
            return next;
        });
    };

    // Tema (Karanlık / Aydınlık Mod) Durumu
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // Sol Sidebar Açık/Kapalı Durumu
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Kullanıcı ve Token Durumları (State)
    const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
    const [loggedInUsername, setLoggedInUsername] = useState(localStorage.getItem('logged_in_username') || '');

    const [userRole, setUserRole] = useState(() => {
        const storedRole = localStorage.getItem('user_role');
        if (storedRole) return storedRole;
        const payload = parseJwt(localStorage.getItem('jwt_token'));
        if (payload) {
            const r = payload.userRole || payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
            if (r) return r;
        }
        return 'Viewer';
    });

    const [isAdmin, setIsAdmin] = useState(() => {
        const role = localStorage.getItem('user_role') || (parseJwt(localStorage.getItem('jwt_token'))?.userRole);
        return role === 'Admin';
    });

    const [userSpatialBoundaryWkt, setUserSpatialBoundaryWkt] = useState('');
    const [spatialBoundariesData, setSpatialBoundariesData] = useState([]);
    const userSpatialBoundaryWktRef = useRef(userSpatialBoundaryWkt);
    const pulsingBoundaryRef = useRef(null);

    // Isı Haritası (Heatmap) Analizi Durumu ve Katman Referansları
    const [isHeatmapActive, setIsHeatmapActive] = useState(false);
    const [heatmapTypeFilter, setHeatmapTypeFilter] = useState('ALL'); // 'ALL' | 'Point' | 'Line' | 'Polygon'
    const heatmapSourceRef = useRef(new VectorSource());
    const heatmapLayerRef = useRef(null);
    const geoServerWmsSourceRef = useRef(null);
    const geoServerWmsLayerRef = useRef(null);

    // ÇOK KRİTERLİ KONUM ANALİZİ DURUMLARI (Location / Multi-Criteria Weighted Heatmap Analysis)
    const [showLocationAnalysisModal, setShowLocationAnalysisModal] = useState(false);
    const [locationAnalysisAreaMode, setLocationAnalysisAreaMode] = useState('city'); // 'city' | 'polygon'
    const [citiesList, setCitiesList] = useState([]);
    const [selectedAnalysisCityPlate, setSelectedAnalysisCityPlate] = useState('');
    const [analysisDrawnWkt, setAnalysisDrawnWkt] = useState('');
    const [isDrawingAnalysisBoundary, setIsDrawingAnalysisBoundary] = useState(false);
    const [analysisCriteria, setAnalysisCriteria] = useState([
        { id: 1, categoryId: '', weight: 50 },
        { id: 2, categoryId: '', weight: 50 }
    ]);
    const [locationAnalysisLoading, setLocationAnalysisLoading] = useState(false);
    const [locationAnalysisError, setLocationAnalysisError] = useState('');
    const [locationAnalysisResult, setLocationAnalysisResult] = useState(null);
    const [isLocationAnalysisHeatmapVisible, setIsLocationAnalysisHeatmapVisible] = useState(true);

    const locationAnalysisHeatmapSourceRef = useRef(new VectorSource());
    const locationAnalysisBoundarySourceRef = useRef(new VectorSource());
    const locationAnalysisHeatmapLayerRef = useRef(null);
    const locationAnalysisBoundaryLayerRef = useRef(null);

    // ==========================================
    // AKILLI ULAŞIM MODÜLÜ & KATMAN YÖNETİMİ
    // ==========================================
    const [routes, setRoutes] = useState([]);
    const routesRef = useRef([]);
    routesRef.current = routes;
    const [stops, setStops] = useState([]);
    const [selectedStopInfo, setSelectedStopInfo] = useState(null);
    const [selectedRouteInfo, setSelectedRouteInfo] = useState(null);
    const [selectedBoundaryInfo, setSelectedBoundaryInfo] = useState(null);
    const selectedRouteInfoRef = useRef(null);
    selectedRouteInfoRef.current = selectedRouteInfo;
    const [isModifyingRoute, setIsModifyingRoute] = useState(false);
    const [modifyingRoute, setModifyingRoute] = useState(null);
    const [modifiedRouteWkt, setModifiedRouteWkt] = useState('');
    const [routeOriginalWkt, setRouteOriginalWkt] = useState('');
    const routeModifyInteractionRef = useRef(null);

    const [isModifyingStop, setIsModifyingStop] = useState(false);
    const [modifyingStop, setModifyingStop] = useState(null);
    const [modifiedStopCoords, setModifiedStopCoords] = useState({ lat: null, lon: null, wkt: '' });
    const [stopOriginalWkt, setStopOriginalWkt] = useState('');
    const stopModifyInteractionRef = useRef(null);

    const [showAddStopModal, setShowAddStopModal] = useState(false);
    const [draftStopCoords, setDraftStopCoords] = useState({ lat: 0, lon: 0, wkt: '' });
    const [newStopForm, setNewStopForm] = useState({ name: '', stopClass: 'otobus', routeId: '', description: '' });
    const [isSubmittingStop, setIsSubmittingStop] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(6.5);

    const [layerVisibility, setLayerVisibility] = useState({
        cities: true,
        maritime: true,
        routes: true,
        stops: true,
        pois: true,
        drawings: true,
        heatmap: false,
        routeTypes: { metro: true, otobus: true, tren: true, gemi: true, araba: true },
        stopTypes: { metro: true, otobus: true, tren: true, gemi: true },
        poiCategories: {},
        poiTypes: {
            hastane: true, eczane: true, okul: true, muze: true, kutuphane: true,
            sanat: true, anit: true, spor: true, akaryakit: true, atm: true,
            plaj: true, kafe: true, restoran: true, otel: true, park: true, market: true
        }
    });
    const layerVisibilityRef = useRef(layerVisibility);
    layerVisibilityRef.current = layerVisibility;
    const [hiddenRouteIds, setHiddenRouteIds] = useState(new Set());
    const [isGeneratingOsrmOnMapId, setIsGeneratingOsrmOnMapId] = useState(null);

    const routeSourceRef = useRef(new VectorSource());
    const stopSourceRef = useRef(new VectorSource());
    const routeLayerRef = useRef(null);
    const stopLayerRef = useRef(null);
    const poiLayerRef = useRef(null);
    const drawingsLayerRef = useRef(null);
    const savedPlacesLayerRef = useRef(null);
    const cityBoundarySourceRef = useRef(new VectorSource());
    const maritimeBoundarySourceRef = useRef(new VectorSource());
    const cityBoundaryLayerRef = useRef(null);
    const maritimeBoundaryLayerRef = useRef(null);
    const vehicleAnimMapRef = useRef(new Map());
    const [simSpeedMap, setSimSpeedMap] = useState({});
    const simSpeedMapRef = useRef(simSpeedMap);
    simSpeedMapRef.current = simSpeedMap;
    const [zoomSettings, setZoomSettings] = useState(getZoomSettings);

    // DİNAMİK HARİTA ZOOM & GÖRÜNÜRLÜK AYARLARI DİNLENMESİ
    useEffect(() => {
        const refreshLayers = (settings) => {
            setZoomSettings(settings);
            if (routeLayerRef.current) routeLayerRef.current.changed();
            if (stopLayerRef.current) stopLayerRef.current.changed();
            if (poiLayerRef.current) poiLayerRef.current.changed();
            if (drawingsLayerRef.current) drawingsLayerRef.current.changed();
            if (cityBoundaryLayerRef.current) cityBoundaryLayerRef.current.changed();
            if (maritimeBoundaryLayerRef.current) maritimeBoundaryLayerRef.current.changed();
            if (mapRef.current) mapRef.current.render();
        };

        const handleZoomSettingsChanged = (e) => {
            if (e.detail) {
                refreshLayers(e.detail);
            }
        };

        const handleStorageChanged = (e) => {
            if (e.key === 'geomap_admin_zoom_settings_v2' || e.key === 'geomap_admin_zoom_settings_v1') {
                refreshLayers(getZoomSettings());
            }
        };

        window.addEventListener('geomapZoomSettingsChanged', handleZoomSettingsChanged);
        window.addEventListener('storage', handleStorageChanged);
        return () => {
            window.removeEventListener('geomapZoomSettingsChanged', handleZoomSettingsChanged);
            window.removeEventListener('storage', handleStorageChanged);
        };
    }, []);

    // CANLI ARAÇ SİMÜLASYONU & SIGNALR TAKİP REFLERİ VE STATELERİ
    const simulationSourceRef = useRef(new VectorSource());
    const simulationLayerRef = useRef(null);
    const vehicleFeaturesMapRef = useRef(new Map());
    const stoppedSimRoutesRef = useRef((() => {
        try {
            const raw = sessionStorage.getItem('stopped_sim_routes');
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    })());

    const markRouteAsStopped = (id) => {
        if (!id && id !== 0) return;
        if (!stoppedSimRoutesRef.current || typeof stoppedSimRoutesRef.current.add !== 'function') {
            stoppedSimRoutesRef.current = new Set();
        }
        const numId = Number(id);
        stoppedSimRoutesRef.current.add(numId);
        stoppedSimRoutesRef.current.add(id);
        stoppedSimRoutesRef.current.add(String(numId));
        stoppedSimRoutesRef.current.add(String(id));
        try {
            sessionStorage.setItem('stopped_sim_routes', JSON.stringify(Array.from(stoppedSimRoutesRef.current)));
        } catch (_) { }
    };

    const unmarkRouteAsStopped = (id) => {
        if (!id && id !== 0) return;
        if (!stoppedSimRoutesRef.current || typeof stoppedSimRoutesRef.current.delete !== 'function') {
            stoppedSimRoutesRef.current = new Set();
        }
        const numId = Number(id);
        stoppedSimRoutesRef.current.delete(numId);
        stoppedSimRoutesRef.current.delete(id);
        stoppedSimRoutesRef.current.delete(String(numId));
        stoppedSimRoutesRef.current.delete(String(id));
        try {
            sessionStorage.setItem('stopped_sim_routes', JSON.stringify(Array.from(stoppedSimRoutesRef.current)));
        } catch (_) { }
    };

    const [activeSimulations, setActiveSimulations] = useState({});
    const activeSimulationsRef = useRef({});
    activeSimulationsRef.current = activeSimulations;
    const [simLoadingId, setSimLoadingId] = useState(null);
    const [activeVehicles, setActiveVehicles] = useState({});
    const [followingRouteId, setFollowingRouteId] = useState(null);
    const followingRouteIdRef = useRef(null);
    followingRouteIdRef.current = followingRouteId;
    const [selectedVehicleInfo, setSelectedVehicleInfo] = useState(null);
    const [isSimLoading, setIsSimLoading] = useState(false);

    // KULLANICI PROFİL & KİŞİSEL ALAN (DRAWER)
    const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
    const [favoritePoiIds, setFavoritePoiIds] = useState(new Set());

    // İKİ NOKTA / POI ARASI YOL TARİFİ (DIRECTIONS) & KAYITLI GÜZERGAHLAR
    const [directionsState, setDirectionsState] = useState({
        active: false,
        waypoints: [], // [ { id, name, lon, lat, poiId } ]
        startCoord: null, // { lon, lat }
        startName: '',
        targetCoord: null, // { lon, lat }
        targetName: '',
        targetPoiId: null,
        targetPoi: null,
        selectingPoint: null, // null | 'point1' | 'point2' | 'waypoint'
        routeData: null,
        activeMode: 'driving', // 'driving' | 'gemi' | 'metro' | 'transit' | 'walking' | 'cycling'
        showSteps: false,
        showPreferencesModal: false,
        transitPreferences: {
            gemi: true,
            metro: true,
            otobus: true,
            tren: true
        },
        isCalculating: false
    });
    const directionsStateRef = useRef(directionsState);
    directionsStateRef.current = directionsState;

    // Sürükle - Bırak (Drag and Drop) Durak Sıralama State'leri
    const [draggedWaypointIndex, setDraggedWaypointIndex] = useState(null);
    const [dragOverWaypointIndex, setDragOverWaypointIndex] = useState(null);

    const [saveRouteModalOpen, setSaveRouteModalOpen] = useState(false);
    const [saveRouteTitle, setSaveRouteTitle] = useState('');
    const [saveRouteDescription, setSaveRouteDescription] = useState('');
    const [isSavingRoute, setIsSavingRoute] = useState(false);

    const directionsSourceRef = useRef(new VectorSource());
    const directionsLayerRef = useRef(null);

    // DURAK TAŞIRKEN BAĞLI HATTIN ANLIK DİNAMİK TAKİP REFLERİ
    const stopGeomChangeKeyRef = useRef(null);
    const modifyingStopRouteFeatureRef = useRef(null);
    const modifyingStopVertexIndexRef = useRef(-1);
    const modifyingStopRouteOrigCoordsRef = useRef(null);

    const handleToggleLayerVisibility = (layerKey) => {
        if (layerKey === 'heatmap') {
            setIsHeatmapActive(prev => !prev);
            return;
        }
        if (layerKey.startsWith('routeType_')) {
            const subKey = layerKey.replace('routeType_', '');
            setLayerVisibility(prev => {
                const cur = prev.routeTypes || { metro: true, otobus: true, tren: true, gemi: true, araba: true };
                const nextState = {
                    ...prev,
                    routeTypes: { ...cur, [subKey]: !cur[subKey] }
                };
                layerVisibilityRef.current = nextState;
                return nextState;
            });
            if (routeLayerRef.current) routeLayerRef.current.changed();
            return;
        }
        if (layerKey.startsWith('stopType_')) {
            const subKey = layerKey.replace('stopType_', '');
            setLayerVisibility(prev => {
                const cur = prev.stopTypes || { metro: true, otobus: true, tren: true, gemi: true };
                const nextState = {
                    ...prev,
                    stopTypes: { ...cur, [subKey]: !cur[subKey] }
                };
                layerVisibilityRef.current = nextState;
                return nextState;
            });
            if (stopLayerRef.current) stopLayerRef.current.changed();
            return;
        }
        if (layerKey.startsWith('poiCategory_')) {
            const rawId = layerKey.replace('poiCategory_', '');
            const numId = Number(rawId) || rawId;
            setLayerVisibility(prev => {
                const cur = prev.poiCategories || {};
                const currentVal = cur[numId] !== false && cur[rawId] !== false;
                const nextVal = !currentVal;
                const nextCategories = {
                    ...cur,
                    [numId]: nextVal,
                    [rawId]: nextVal,
                    [String(numId)]: nextVal
                };
                const allCats = poiCategoriesRef.current || [];
                const catObj = allCats.find(c => c.id === numId || c.id === rawId || String(c.id) === String(rawId));
                if (catObj?.name) {
                    nextCategories[catObj.name] = nextVal;
                    nextCategories[catObj.name.toLowerCase()] = nextVal;
                }
                const nextState = {
                    ...prev,
                    poiCategories: nextCategories
                };
                layerVisibilityRef.current = nextState;
                return nextState;
            });
            if (poiLayerRef.current) {
                poiLayerRef.current.changed();
            }
            return;
        }
        if (layerKey.startsWith('poiType_')) {
            const subKey = layerKey.replace('poiType_', '');
            setLayerVisibility(prev => {
                const cur = prev.poiTypes || { hastane: true, okul: true, eczane: true, akaryakit: true, otel: true, restoran: true, park: true, market: true };
                const nextState = {
                    ...prev,
                    poiTypes: { ...cur, [subKey]: !cur[subKey] }
                };
                layerVisibilityRef.current = nextState;
                return nextState;
            });
            if (poiLayerRef.current) poiLayerRef.current.changed();
            return;
        }

        setLayerVisibility(prev => {
            const next = { ...prev, [layerKey]: !prev[layerKey] };
            layerVisibilityRef.current = next;
            if (layerKey === 'routes' && routeLayerRef.current) routeLayerRef.current.setVisible(next.routes);
            if (layerKey === 'stops' && stopLayerRef.current) stopLayerRef.current.setVisible(next.stops);
            if (layerKey === 'pois' && poiLayerRef.current) {
                poiLayerRef.current.setVisible(next.pois);
                poiLayerRef.current.changed();
            }
            if (layerKey === 'drawings' && drawingsLayerRef.current) drawingsLayerRef.current.setVisible(next.drawings);
            if (layerKey === 'cities' && cityBoundaryLayerRef.current) cityBoundaryLayerRef.current.setVisible(next.cities);
            if (layerKey === 'maritime' && maritimeBoundaryLayerRef.current) maritimeBoundaryLayerRef.current.setVisible(next.maritime);
            return next;
        });
    };

    useEffect(() => {
        setLayerVisibility(prev => ({ ...prev, heatmap: isHeatmapActive }));
    }, [isHeatmapActive]);

    // İl Sınırları & Deniz Yetki Alanları Katman Verilerini Şehir & Bölge Yönetiminden Yükleme
    useEffect(() => {
        const loadBoundariesFromGeoManagement = async () => {
            const geojsonFormat = new GeoJSON();
            const wktFormat = new WKT();

            // 1. İL SINIRLARI YÜKLEME
            try {
                let cityFeatures = [];
                let loadedFromDbOrStorage = false;

                // A) Veritabanından Şehir Sınırlarını Çek (adminApi.getCities)
                try {
                    const dbCities = await adminApi.getCities(true, token);
                    if (Array.isArray(dbCities) && dbCities.length > 0) {
                        const activeCities = dbCities.filter(c => !c.isDeleted && (c.wkt || c.geometry));
                        if (activeCities.length > 0) {
                            cityFeatures = activeCities.map(c => {
                                let feature = null;
                                if (c.wkt) {
                                    try {
                                        feature = wktFormat.readFeature(c.wkt, {
                                            dataProjection: 'EPSG:4326',
                                            featureProjection: 'EPSG:3857'
                                        });
                                    } catch (e) {}
                                } else if (c.geometry) {
                                    try {
                                        feature = geojsonFormat.readFeature({ type: 'Feature', geometry: c.geometry }, {
                                            dataProjection: 'EPSG:4326',
                                            featureProjection: 'EPSG:3857'
                                        });
                                    } catch (e) {}
                                }
                                if (feature) {
                                    feature.setProperties({
                                        plate: c.plate || c.id,
                                        name: c.name,
                                        region: c.region,
                                        isDeleted: c.isDeleted
                                    });
                                }
                                return feature;
                            }).filter(Boolean);

                            if (cityFeatures.length > 0) {
                                loadedFromDbOrStorage = true;
                            }
                        }
                    }
                } catch (dbErr) {
                    console.warn('[City Boundaries] DB yükleme hatası, yerel depolamaya geçiliyor:', dbErr);
                }

                // B) LocalStorage (Şehir Yönetimi Yayın Kaydı)
                if (!loadedFromDbOrStorage) {
                    try {
                        const savedPublishedRaw = localStorage.getItem('admin_turkey_cities_published_v38');
                        if (savedPublishedRaw) {
                            const parsed = JSON.parse(savedPublishedRaw);
                            if (parsed && Array.isArray(parsed.cities) && parsed.cities.length > 0) {
                                const activeSaved = parsed.cities.filter(c => !c.isDeleted && (c.wkt || c.geometry));
                                cityFeatures = activeSaved.map(c => {
                                    let feature = null;
                                    if (c.wkt) {
                                        try {
                                            feature = wktFormat.readFeature(c.wkt, {
                                                dataProjection: 'EPSG:4326',
                                                featureProjection: 'EPSG:3857'
                                            });
                                        } catch (e) {}
                                    } else if (c.geometry) {
                                        try {
                                            feature = geojsonFormat.readFeature({ type: 'Feature', geometry: c.geometry }, {
                                                dataProjection: 'EPSG:4326',
                                                featureProjection: 'EPSG:3857'
                                            });
                                        } catch (e) {}
                                    }
                                    if (feature) {
                                        feature.setProperties({
                                            plate: c.plate || c.id,
                                            name: c.name,
                                            region: c.region,
                                            isDeleted: c.isDeleted
                                        });
                                    }
                                    return feature;
                                }).filter(Boolean);

                                if (cityFeatures.length > 0) {
                                    loadedFromDbOrStorage = true;
                                }
                            }
                        }
                    } catch (storageErr) {
                        console.warn('[City Boundaries] LocalStorage yükleme hatası:', storageErr);
                    }
                }

                // C) Fallback: turkey-cities.json
                if (!loadedFromDbOrStorage) {
                    const res = await fetch('/data/turkey-cities.json');
                    const geojson = await res.json();
                    cityFeatures = geojsonFormat.readFeatures(geojson, { featureProjection: 'EPSG:3857' });
                }

                if (cityBoundarySourceRef.current && cityFeatures.length > 0) {
                    cityBoundarySourceRef.current.clear();
                    cityBoundarySourceRef.current.addFeatures(cityFeatures);
                }
            } catch (err) {
                console.warn('İl sınırları yüklenemedi:', err);
            }

            // 2. DENİZ YETKİ ALANLARI / BÖLGELERİ YÜKLEME
            try {
                let maritimeFeatures = [];
                let loadedMaritimeFromStorage = false;

                // A) LocalStorage (Şehir ve Bölge yönetiminde tanımlanan deniz alanları)
                try {
                    const savedMaritimeRaw = localStorage.getItem('admin_turkey_maritime_published_v38');
                    if (savedMaritimeRaw) {
                        const parsed = JSON.parse(savedMaritimeRaw);
                        const zones = parsed?.maritimeZones || parsed?.zones;
                        if (Array.isArray(zones) && zones.length > 0) {
                            const activeZones = zones.filter(z => !z.isDeleted && (z.wkt || z.geometry));
                            maritimeFeatures = activeZones.map(z => {
                                let feature = null;
                                if (z.wkt) {
                                    try {
                                        feature = wktFormat.readFeature(z.wkt, {
                                            dataProjection: 'EPSG:4326',
                                            featureProjection: 'EPSG:3857'
                                        });
                                    } catch (e) {}
                                } else if (z.geometry) {
                                    try {
                                        feature = geojsonFormat.readFeature({ type: 'Feature', geometry: z.geometry }, {
                                            dataProjection: 'EPSG:4326',
                                            featureProjection: 'EPSG:3857'
                                        });
                                    } catch (e) {}
                                }
                                if (feature) {
                                    feature.setProperties({
                                        id: z.id,
                                        name: z.name || z.zoneName,
                                        zoneName: z.name || z.zoneName,
                                        region: z.region,
                                        sea: z.sea,
                                        isDeleted: z.isDeleted
                                    });
                                }
                                return feature;
                            }).filter(Boolean);

                            if (maritimeFeatures.length > 0) {
                                loadedMaritimeFromStorage = true;
                            }
                        }
                    }
                } catch (mErr) {
                    console.warn('[Maritime Boundaries] LocalStorage okuma hatası:', mErr);
                }

                // B) Fallback: turkey-coastal-maritime.json
                if (!loadedMaritimeFromStorage) {
                    const res = await fetch('/data/turkey-coastal-maritime.json');
                    const geojson = await res.json();
                    maritimeFeatures = geojsonFormat.readFeatures(geojson, { featureProjection: 'EPSG:3857' });
                }

                if (maritimeBoundarySourceRef.current && maritimeFeatures.length > 0) {
                    maritimeBoundarySourceRef.current.clear();
                    maritimeBoundarySourceRef.current.addFeatures(maritimeFeatures);
                }
            } catch (err) {
                console.warn('Deniz sınırları yüklenemedi:', err);
            }
        };

        loadBoundariesFromGeoManagement();

        const handleBoundariesUpdated = () => {
            loadBoundariesFromGeoManagement();
        };

        window.addEventListener('geomap_boundaries_updated', handleBoundariesUpdated);
        return () => window.removeEventListener('geomap_boundaries_updated', handleBoundariesUpdated);
    }, [token]);

    // Rol ve Yetki Kontrolleri (Operatör ve Ulaşım Kullanıcısı kısıtlamaları)
    const isTransportOperator = userRole === 'Operatör' || userRole === 'Operator';
    const isTransportUser = userRole === 'Ulaşım Kullanıcısı';
    const canManageTransport = isAdmin || userRole === 'Admin' || isTransportOperator || userRole === 'Editor' || userRole === 'Editör';
    const canStartSimulation = isAdmin || userRole === 'Admin' || isTransportOperator || userRole === 'Editor' || userRole === 'Editör';
    const canCreateDrawingsAndPoi = (isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör') && !isTransportOperator && !isTransportUser;

    useEffect(() => {
        userSpatialBoundaryWktRef.current = userSpatialBoundaryWkt;
    }, [userSpatialBoundaryWkt]);


    // Fetch active user spatial boundary (taking into account active collaborative unions and distinct editor boundaries)
    const fetchEffectiveBoundary = async () => {
        if (!token || isAdmin || userRole === 'Admin') {
            setUserSpatialBoundaryWkt('');
            setSpatialBoundariesData([]);
            return;
        }
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/effective-boundary', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.spatialBoundaryWkt) {
                    console.log('[Spatial Boundary] Aktif/Ortak yetki alanı yüklendi:', data.spatialBoundaryWkt, 'İşbirlikli:', data.isCollaborative);
                    setUserSpatialBoundaryWkt(data.spatialBoundaryWkt);
                    setSpatialBoundariesData(data.boundaries && data.boundaries.length > 0 ? data.boundaries : [{ spatialBoundaryWkt: data.spatialBoundaryWkt, isCurrentUser: true }]);
                    return;
                } else {
                    setUserSpatialBoundaryWkt('');
                    setSpatialBoundariesData([]);
                    return;
                }
            }
            // Fallback to /api/users/me
            const meRes = await fetch('http://localhost:5041/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (meRes.ok) {
                const user = await meRes.json();
                setUserSpatialBoundaryWkt(user.spatialBoundaryWkt || '');
                setSpatialBoundariesData(user.spatialBoundaryWkt ? [{ spatialBoundaryWkt: user.spatialBoundaryWkt, isCurrentUser: true, username: user.username }] : []);
            } else {
                setUserSpatialBoundaryWkt('');
                setSpatialBoundariesData([]);
            }
        } catch (err) {
            console.error('Kullanıcı coğrafi sınır bilgisi alınamadı:', err);
        }
    };

    useEffect(() => {
        fetchEffectiveBoundary();
    }, [token, isAdmin, userRole]);

    // Setup pulsing spatial boundary layer on main map ONLY for Editor / non-Admin users
    // If collaborating with other editors, each editor's boundary is rendered in its own distinct color!
    useEffect(() => {
        if (!mapRef.current) return;

        if (pulsingBoundaryRef.current) {
            pulsingBoundaryRef.current.cleanup();
            pulsingBoundaryRef.current = null;
        }

        const boundariesInput = spatialBoundariesData && spatialBoundariesData.length > 0 ? spatialBoundariesData : userSpatialBoundaryWkt;

        if (userSpatialBoundaryWkt && !isAdmin && userRole !== 'Admin') {
            const handle = setupPulsingSpatialBoundaryLayer(mapRef.current, boundariesInput);
            pulsingBoundaryRef.current = handle;
            if (handle && handle.features && handle.features.length > 0) {
                try {
                    let totalExtent = handle.features[0].getGeometry().getExtent().slice();
                    for (let i = 1; i < handle.features.length; i++) {
                        const ext = handle.features[i].getGeometry().getExtent();
                        totalExtent[0] = Math.min(totalExtent[0], ext[0]);
                        totalExtent[1] = Math.min(totalExtent[1], ext[1]);
                        totalExtent[2] = Math.max(totalExtent[2], ext[2]);
                        totalExtent[3] = Math.max(totalExtent[3], ext[3]);
                    }
                    mapRef.current.getView().fit(totalExtent, { padding: [60, 60, 60, 60], maxZoom: 11, duration: 600 });
                } catch (e) {}
            }
        }

        return () => {
            if (pulsingBoundaryRef.current) {
                pulsingBoundaryRef.current.cleanup();
                pulsingBoundaryRef.current = null;
            }
        };
    }, [userSpatialBoundaryWkt, spatialBoundariesData, isAdmin, userRole]);


    
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [registerSuccessMsg, setRegisterSuccessMsg] = useState('');
    const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

    // Oturum Kalan Süresi (Saniye Cinsinden)
    const [timeLeft, setTimeLeft] = useState(0);

    // Harita Formu Durumları (Tekil Mekan Ekleme)
    const [placeName, setPlaceName] = useState('');
    const [placeColor, setPlaceColor] = useState('#16a34a');
    const [coords, setCoords] = useState({ lon: 33.2433, lat: 38.9637 }); // Varsayılan Türkiye
    const [hasUserSelectedPin, setHasUserSelectedPin] = useState(false); // Haritaya tıklanmadığı sürece iğne görünmez / şeffaf
    const [cursorCoords, setCursorCoords] = useState({ lon: 33.2433, lat: 38.9637 });
    const [mapZoom, setMapZoom] = useState(6.5);
    const [infoMessage, setInfoMessage] = useState('');
    const [savedPlaces, setSavedPlaces] = useState([]); // Veritabanından gelen kayıtlı mekanlar

    // Harita Altlık Katman Seçimi (Google Hibrit, Siyasi, Arazi, Saf Uydu, Gece Modu, vb.)
    const [selectedBaseLayer, setSelectedBaseLayer] = useState(() => localStorage.getItem('geo_selected_basemap') || 'google_hybrid');

    const handleSelectBaseLayer = (layerId) => {
        setSelectedBaseLayer(layerId);
        localStorage.setItem('geo_selected_basemap', layerId);
        const layerConfig = getBasemapConfig(layerId);
        if (tileLayerRef.current) {
            tileLayerRef.current.setSource(
                new XYZ({
                    url: layerConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: layerConfig.maxZoom || 19
                })
            );
        }
    };

    // OpenLayers Çizim İşlemleri (Point, LineString, Polygon, Analysis)
    const [drawType, setDrawType] = useState('None');
    const [savedDrawings, setSavedDrawings] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isSavedDrawingsOpen, setIsSavedDrawingsOpen] = useState(true);

    // HARİTA FİLTRELEME DURUMLARI (Şekil Türü ve Editör/Kullanıcı Filtresi)
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
    const [selectedEditorFilter, setSelectedEditorFilter] = useState('ALL');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);

    // YÜZER MENÜ / ÖZNİTELİK FORM DURUMLARI (İsim, Renk ve Taslak WKT)
    const [drawingName, setDrawingName] = useState('');
    const [drawingColor, setDrawingColor] = useState('#3b82f6');
    const [draftWkt, setDraftWkt] = useState('');

    // GEÇİCİ ENVANTER ANALİZİ DURUMLARI
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // SEÇİLİ NOKTA BİLGİ PANELİ VE DÜZENLEME DURUMU (Info Panel / Popup Overlay)
    const [selectedPointInfo, setSelectedPointInfo] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#3b82f6');
    const [editWkt, setEditWkt] = useState('');

    // KIRILMA NOKTALARINI FARE İLE HARİTADA DÜZENLEME (Modify Interaction + Undo/Redo + Cancel Modal)
    const [isModifyingVertex, setIsModifyingVertex] = useState(false);
    const [isPopupCollapsed, setIsPopupCollapsed] = useState(false);
    const [openSidebarSection, setOpenSidebarSection] = useState('addPlace'); // 'addPlace' | 'savedPlaces' | null
    const modifyInteractionRef = useRef(null);
    const originalWktRef = useRef('');
    const geometryHistoryRef = useRef([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [cancelEditConfirm, setCancelEditConfirm] = useState(false);

    // POI (POINT OF INTEREST) & HİYERARŞİK KATEGORİ DURUMLARI
    const [pois, setPois] = useState([]);
    const [poiCategories, setPoiCategories] = useState([]);
    const poiCategoriesRef = useRef(poiCategories);
    poiCategoriesRef.current = poiCategories;
    const [selectedPoiInfo, setSelectedPoiInfo] = useState(null);
    const [showPoiLightbox, setShowPoiLightbox] = useState(false);
    const [lightboxImages, setLightboxImages] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [showCreatePoiModal, setShowCreatePoiModal] = useState(false);
    const [editingPoiModalData, setEditingPoiModalData] = useState(null); // POI düzenleme modu için
    const [uploadingPoiImage, setUploadingPoiImage] = useState(false);
    const [poiParentCatId, setPoiParentCatId] = useState('');
    const [poiDrawGeometryType, setPoiDrawGeometryType] = useState('Point'); // 'Point' | 'Polygon'
    const [draftPoiData, setDraftPoiData] = useState(null); // { wkt, lon, lat, isPolygon, area, feature }
    const [poiTimeDays, setPoiTimeDays] = useState('Hafta İçi');
    const [poiTimeStart, setPoiTimeStart] = useState('08:30');
    const [poiTimeEnd, setPoiTimeEnd] = useState('18:00');
    const [poiIs24Hours, setPoiIs24Hours] = useState(false);
    const [newPoiForm, setNewPoiForm] = useState({
        name: '',
        description: '',
        categoryId: '',
        workingHours: 'Hafta İçi 08:30 - 18:00',
        images: [],
        customImageUrl: '',
        wkt: '',
        lon: 0,
        lat: 0,
        isPolygon: false,
        area: 0
    });
    const poiSourceRef = useRef(new VectorSource());

    // POI TAŞIMA VE POLİGON DÜZENLEME DURUMLARI (Admin & Editor)
    const [editingPoiState, setEditingPoiState] = useState(null);
    const poiModifyInteractionRef = useRef(null);
    const poiTranslateInteractionRef = useRef(null);
    const [isSavingPoiGeom, setIsSavingPoiGeom] = useState(false);

    // GOOGLE MAPS TARZI POI ARAMA BARI DURUMLARI (Tüm Rollere Açık: User, Editor, Admin)
    const [poiSearchQuery, setPoiSearchQuery] = useState('');
    const [isPoiSearchFocused, setIsPoiSearchFocused] = useState(false);
    const [selectedSearchCatFilter, setSelectedSearchCatFilter] = useState('ALL');
    const poiSearchContainerRef = useRef(null);

    // Dışarı tıklandığında arama açılır kutusunu kapatma
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (poiSearchContainerRef.current && !poiSearchContainerRef.current.contains(e.target)) {
                setIsPoiSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Arama Sonuçlarını Filtreleme (Ad, Kategori, Açıklama, Çalışma Saatleri)
    const filteredSearchResults = useMemo(() => {
        const q = poiSearchQuery.trim().toLowerCase();
        return (pois || []).filter(p => {
            const matchesCat = selectedSearchCatFilter === 'ALL' || String(p.categoryId) === String(selectedSearchCatFilter);
            if (!matchesCat) return false;
            if (!q) return true;
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const catName = (p.categoryName || '').toLowerCase();
            const hours = (p.workingHours || '').toLowerCase();
            return name.includes(q) || desc.includes(q) || catName.includes(q) || hours.includes(q);
        });
    }, [poiSearchQuery, selectedSearchCatFilter, pois]);

    // Arama Sonucundan POI'ye Otomatik Yakınlaşma (Zoom & Fly-to)
    const handleZoomToSearchResultPoi = (poi) => {
        if (!poi || !mapRef.current) return;
        setIsPoiSearchFocused(false);

        let targetCoord = null;
        if (poi.wkt) {
            try {
                const wktFormat = new WKT();
                const feat = wktFormat.readFeature(poi.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                if (feat && feat.getGeometry()) {
                    const geom = feat.getGeometry();
                    if (geom.getType() === 'Point') {
                        targetCoord = geom.getCoordinates();
                    } else {
                        targetCoord = getCenter(geom.getExtent());
                    }
                }
            } catch (e) {
                console.error('POI koordinat hesaplama hatası:', e);
            }
        }

        if (targetCoord) {
            mapRef.current.getView().animate({
                center: targetCoord,
                zoom: 16.5,
                duration: 800
            });
        }

        setSelectedPoiInfo(poi);
        setSelectedStopInfo(null);
        setSelectedRouteInfo(null);
        setSelectedBoundaryInfo(null);
        setSelectedPointInfo(null);
    };

    // SHIFT TUŞU İLE POLİGON POI MODUNA GEÇİŞ DİNLEYİCİSİ
    useEffect(() => {
        if (drawType !== 'Poi') return;

        const handleKeyDown = (e) => {
            if (e.key === 'Shift' && poiDrawGeometryType !== 'Polygon') {
                setPoiDrawGeometryType('Polygon');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [drawType, poiDrawGeometryType]);

    // POI Modal Açıldığında Kategorileri Taze Çekme
    useEffect(() => {
        if (showCreatePoiModal) {
            fetchPoiCategories();
        }
    }, [showCreatePoiModal]);

    // Aşağıdaki Kaydet Butonuna Basıldığında POI Bilgi Giriş Ekranını Açma
    const handleOpenPoiModalWithDraft = async () => {
        if (!draftPoiData || !draftPoiData.wkt) {
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'warn',
                    summary: 'Çizim Eksik',
                    detail: 'Lütfen önce haritada bir nokta veya poligon alanı çizin.',
                    life: 3000
                });
            }
            return;
        }

        let currentCats = await fetchPoiCategories();
        if (!currentCats || currentCats.length === 0) {
            currentCats = poiCategories;
        }

        const defaultParent = (currentCats || []).find(c => !c.parentId) || (currentCats || [])[0];
        const defaultChild = defaultParent ? (currentCats || []).find(c => c.parentId === defaultParent.id) : null;
        const chosenCat = defaultChild || defaultParent;

        if (defaultParent) {
            setPoiParentCatId(defaultParent.id.toString());
        } else {
            setPoiParentCatId('');
        }

        setPoiTimeDays('Hafta İçi');
        setPoiTimeStart('08:30');
        setPoiTimeEnd('18:00');
        setPoiIs24Hours(false);
        setEditingPoiModalData(null);

        setNewPoiForm({
            name: '',
            description: '',
            categoryId: chosenCat ? chosenCat.id : '',
            workingHours: 'Hafta İçi 08:30 - 18:00',
            images: [],
            customImageUrl: '',
            wkt: draftPoiData.wkt,
            lon: draftPoiData.lon,
            lat: draftPoiData.lat,
            isPolygon: draftPoiData.isPolygon,
            area: draftPoiData.area || 0
        });

        setShowCreatePoiModal(true);
    };

    // Harita Bilgi Kartından POI Bilgilerini ve Fotoğraflarını Düzenleme Modalı Açma
    const handleOpenEditPoiModal = (poi) => {
        if (!poi) return;
        const canEdit = isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör' || poi.userId === loggedInUserId;
        if (!canEdit) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Yetki Gerekli', detail: 'Bu POI\'yi düzenleme yetkiniz bulunmuyor.', life: 3000 });
            }
            return;
        }

        const cat = (poiCategories || []).find(c => c.id === poi.categoryId);
        const parentId = cat?.parentId ? String(cat.parentId) : String(poi.categoryId || '');
        setPoiParentCatId(parentId);

        const wh = poi.workingHours || '';
        const is24 = wh.includes('24 Saat') || wh.includes('24 Hours');
        setPoiIs24Hours(is24);
        if (wh.includes('Her Gün')) setPoiTimeDays('Her Gün');
        else if (wh.includes('Pzt - Cmt')) setPoiTimeDays('Pzt - Cmt');
        else if (wh.includes('Hafta Sonu')) setPoiTimeDays('Hafta Sonu');
        else setPoiTimeDays('Hafta İçi');

        const timeMatch = wh.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
        if (timeMatch) {
            setPoiTimeStart(timeMatch[1]);
            setPoiTimeEnd(timeMatch[2]);
        } else {
            setPoiTimeStart('08:30');
            setPoiTimeEnd('18:00');
        }

        const rawImgs = poi.imageUrl || poi.image_url || poi.photoUrl || poi.imgUrl || poi.photo;
        const loadedImages = parsePoiImages(rawImgs);

        setEditingPoiModalData(poi);
        setNewPoiForm({
            name: poi.name || '',
            description: poi.description || '',
            categoryId: poi.categoryId || '',
            workingHours: poi.workingHours || 'Hafta İçi 08:30 - 18:00',
            images: loadedImages,
            customImageUrl: '',
            wkt: poi.wkt || '',
            lon: poi.longitude || 0,
            lat: poi.latitude || 0,
            isPolygon: poi.wkt ? poi.wkt.toUpperCase().includes('POLYGON') : false,
            area: 0
        });
        setShowCreatePoiModal(true);
    };

    // POI Kategori Ağaç / Cascading Seçim Yardımcıları
    const parentCategories = useMemo(() => {
        return (poiCategories || []).filter(c => !c.parentId);
    }, [poiCategories]);

    const currentSubCategories = useMemo(() => {
        if (!poiParentCatId) return [];
        return (poiCategories || []).filter(c => c.parentId === parseInt(poiParentCatId, 10));
    }, [poiCategories, poiParentCatId]);

    const activeCategoryObject = useMemo(() => {
        if (!newPoiForm.categoryId) return null;
        return (poiCategories || []).find(c => c.id === parseInt(newPoiForm.categoryId, 10)) || null;
    }, [poiCategories, newPoiForm.categoryId]);

    const handlePoiParentCatChange = (newParentId) => {
        const pId = parseInt(newParentId, 10);
        setPoiParentCatId(newParentId);
        const subs = (poiCategories || []).filter(c => c.parentId === pId);
        if (subs.length > 0) {
            setNewPoiForm(prev => ({ ...prev, categoryId: subs[0].id }));
        } else {
            setNewPoiForm(prev => ({ ...prev, categoryId: pId }));
        }
    };

    const handlePoiSubCatChange = (newSubCatId) => {
        setNewPoiForm(prev => ({ ...prev, categoryId: parseInt(newSubCatId, 10) }));
    };

    // Editör İşbirliği Mekanizması State'leri
    const [showCollaborationModal, setShowCollaborationModal] = useState(false);
    const [availableEditors, setAvailableEditors] = useState([]);
    const [collaborationRequests, setCollaborationRequests] = useState([]);
    const [selectedEditorId, setSelectedEditorId] = useState('');
    const [collabLoading, setCollabLoading] = useState(false);

    const loggedInUserId = useMemo(() => {
        if (!token) return 0;
        const payload = parseJwt(token);
        return payload ? parseInt(payload.userId || payload.id || payload.nameid || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || 0) : 0;
    }, [token]);

    // Editörün bu çizimi düzenleme yetkisi var mı? (Admin, Kendi Çizimi veya Onaylanmış İşbirliği - Admin Çizimleri Hariç)
    const canEditDrawing = (drawingOrInfo) => {
        if (!drawingOrInfo) return false;
        if (isAdmin || userRole === 'Admin') return true; // Admin her çizimi düzenleyebilir
        if (userRole === 'Viewer') return false;

        const ownerId = drawingOrInfo.insertedUserId;
        const ownerName = (drawingOrInfo.insertedUsername || '').toLowerCase();

        // Eğer çizim Admin'e aitse (ID: 1 veya admin kullanıcısı), normal editörler KESİNLİKLE düzenleyemez
        if (ownerId === 1 || ownerName === 'asdf.admin' || ownerName.endsWith('.admin')) {
            return false;
        }

        // Kendi çizimi ise düzenleyebilir
        if (!ownerId || ownerId === loggedInUserId) return true;

        // Onaylı işbirliği olan diğer editörün çizimi ise düzenleyebilir
        return collaborationRequests.some(r =>
            r.status === 'Approved' && (
                (r.senderUserId === loggedInUserId && r.receiverUserId === ownerId) ||
                (r.receiverUserId === loggedInUserId && r.senderUserId === ownerId)
            )
        );
    };

    const fetchCollaborations = async () => {
        if (!token || userRole === 'Viewer') return;
        try {
            const [editorsRes, requestsRes] = await Promise.all([
                fetch('http://localhost:5041/api/collaborations/available-editors', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch('http://localhost:5041/api/collaborations/my-requests', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (editorsRes.ok) {
                const editorsData = await editorsRes.json();
                setAvailableEditors(editorsData);
            }
            if (requestsRes.ok) {
                const requestsData = await requestsRes.json();
                setCollaborationRequests(requestsData);
            }
            fetchEffectiveBoundary();
        } catch (err) {
            console.error('İşbirliği verileri alınamadı:', err);
        }
    };

    const handleSendCollaborationRequest = async (e) => {
        e.preventDefault();
        if (!selectedEditorId) return;
        setCollabLoading(true);
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ receiverUserId: parseInt(selectedEditorId) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İstek gönderilemedi.');

            toastRef.current?.show({ severity: 'success', summary: 'Başarılı', detail: 'İşbirliği isteği gönderildi!', life: 3000 });
            setSelectedEditorId('');
            fetchCollaborations();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const handleRespondCollaborationRequest = async (requestId, approve) => {
        setCollabLoading(true);
        try {
            const res = await fetch('http://localhost:5041/api/collaborations/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ requestId, approve })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İşlem başarısız.');

            toastRef.current?.show({
                severity: approve ? 'success' : 'info',
                summary: approve ? (lang === 'tr' ? 'Yetki Alanları Birleştirildi' : 'Areas Merged') : 'Reddedildi',
                detail: approve 
                    ? (lang === 'tr' ? 'İşbirliği kabul edildi! Coğrafi yetki alanlarınız birleştirildi.' : 'Collaboration approved! Your spatial boundaries have been merged.')
                    : data.message,
                life: 3500
            });
            fetchCollaborations();
            fetchDrawings();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const handleCancelCollaboration = async (requestId) => {
        setCollabLoading(true);
        try {
            const res = await fetch(`http://localhost:5041/api/collaborations/${requestId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'İşbirliği iptal edilemedi.');

            toastRef.current?.show({
                severity: 'info',
                summary: lang === 'tr' ? 'Yetki Alanları Ayrıldı' : 'Areas Separated',
                detail: lang === 'tr' ? 'İşbirliği sonlandırıldı. Coğrafi yetki alanları kendi sınırlarına ayrıldı.' : 'Collaboration cancelled. Spatial boundaries separated.',
                life: 3500
            });
            fetchCollaborations();
            fetchDrawings();
            fetchEffectiveBoundary();
        } catch (err) {
            toastRef.current?.show({ severity: 'error', summary: 'Hata', detail: err.message, life: 4000 });
        } finally {
            setCollabLoading(false);
        }
    };

    const pendingIncoming = useMemo(() => {
        return collaborationRequests.filter(r => r.receiverUserId === loggedInUserId && r.status === 'Pending');
    }, [collaborationRequests, loggedInUserId]);

    useEffect(() => {
        if (token) {
            fetchCollaborations();
        }
    }, [token]);

    useEffect(() => {
        if (selectedPointInfo) {
            setEditName(selectedPointInfo.name || '');
            setEditColor(selectedPointInfo.color || '#3b82f6');
            setEditWkt(selectedPointInfo.wkt || '');
        }
    }, [selectedPointInfo]);

    // ==========================================
    // ÇOK KRİTERLİ KONUM ANALİZİ YARDIMCILARI
    // ==========================================
    const fetchCitiesList = async () => {
        try {
            const data = await adminApi.getCities(token);
            if (data && Array.isArray(data) && data.length > 0) {
                setCitiesList(data);
                return data;
            }
        } catch (err) {
            console.warn('Backend il listesi alınamadı, yerel JSON kontrol ediliyor:', err);
        }
        try {
            const res = await fetch('/data/turkey-cities.json');
            if (res.ok) {
                const localCities = await res.json();
                setCitiesList(localCities);
                return localCities;
            }
        } catch (e) {
            console.error('Yerel il verisi okunamadı:', e);
        }
        return [];
    };

    const handleOpenLocationAnalysisModal = async () => {
        setShowLocationAnalysisModal(true);
        setLocationAnalysisError('');
        if (citiesList.length === 0) {
            await fetchCitiesList();
        }
        let currentCats = poiCategories;
        if (!currentCats || currentCats.length === 0) {
            currentCats = await fetchPoiCategories();
        }
        // Varsayılan ilk 2 kriteri hazırla
        if (!analysisCriteria || analysisCriteria.length < 2) {
            const first = currentCats?.[0]?.id || '';
            const second = currentCats?.[1]?.id || (currentCats?.[0]?.id || '');
            setAnalysisCriteria([
                { id: 1, categoryId: first, weight: 50 },
                { id: 2, categoryId: second, weight: 50 }
            ]);
        }
    };

    const handleAddCriterion = () => {
        if (analysisCriteria.length >= 5) {
            toastRef.current?.show({
                severity: 'warn',
                summary: 'Kriter Sınırı',
                detail: 'En fazla 5 adet kriter ekleyebilirsiniz.',
                life: 3000
            });
            return;
        }
        const newId = Date.now();
        const usedCatIds = new Set(analysisCriteria.map(c => parseInt(c.categoryId, 10)));
        const unusedCat = poiCategories.find(c => !usedCatIds.has(c.id)) || poiCategories[0];
        
        const newCount = analysisCriteria.length + 1;
        const baseWeight = Math.floor(100 / newCount);
        const remainder = 100 - (baseWeight * newCount);

        const updated = analysisCriteria.map((c, idx) => ({
            ...c,
            weight: idx === 0 ? baseWeight + remainder : baseWeight
        }));
        updated.push({
            id: newId,
            categoryId: unusedCat ? unusedCat.id : (poiCategories[0]?.id || ''),
            weight: baseWeight
        });
        setAnalysisCriteria(updated);
    };

    const handleRemoveCriterion = (criterionId) => {
        if (analysisCriteria.length <= 2) {
            toastRef.current?.show({
                severity: 'warn',
                summary: 'Kriter Sınırı',
                detail: 'Analiz için en az 2 kriter bulunmalıdır.',
                life: 3000
            });
            return;
        }
        const filtered = analysisCriteria.filter(c => c.id !== criterionId);
        const newCount = filtered.length;
        const baseWeight = Math.floor(100 / newCount);
        const remainder = 100 - (baseWeight * newCount);
        const rebalanced = filtered.map((c, idx) => ({
            ...c,
            weight: idx === 0 ? baseWeight + remainder : baseWeight
        }));
        setAnalysisCriteria(rebalanced);
    };

    const handleCriterionWeightChange = (criterionId, newWeight) => {
        const val = Math.max(0, Math.min(100, parseInt(newWeight, 10) || 0));
        setAnalysisCriteria(prev => prev.map(c => c.id === criterionId ? { ...c, weight: val } : c));
    };

    const handleCriterionCategoryChange = (criterionId, newCatId) => {
        setAnalysisCriteria(prev => prev.map(c => c.id === criterionId ? { ...c, categoryId: parseInt(newCatId, 10) } : c));
    };

    const handleDistributeWeightsEvenly = () => {
        const count = analysisCriteria.length;
        if (count === 0) return;
        const baseWeight = Math.floor(100 / count);
        const remainder = 100 - (baseWeight * count);
        setAnalysisCriteria(prev => prev.map((c, idx) => ({
            ...c,
            weight: idx === 0 ? baseWeight + remainder : baseWeight
        })));
    };

    const handleStartDrawingAnalysisBoundary = () => {
        setShowLocationAnalysisModal(false);
        setIsDrawingAnalysisBoundary(true);
        setDrawType('LocationAnalysisBoundary');
        toastRef.current?.show({
            severity: 'info',
            summary: 'Haritada Alan Çizin',
            detail: 'Analiz yapılacak hedef bölgeyi poligon olarak çizin. Çift tıklayarak bitirin.',
            life: 4500
        });
    };

    const handleExecuteLocationAnalysis = async () => {
        setLocationAnalysisError('');
        const totalScore = analysisCriteria.reduce((sum, c) => sum + (parseInt(c.weight, 10) || 0), 0);
        
        if (analysisCriteria.length < 2 || analysisCriteria.length > 5) {
            setLocationAnalysisError('Kullanıcı analiz için en az 2, en fazla 5 adet kategori bazlı kriter eklemelidir.');
            return;
        }
        if (totalScore !== 100) {
            setLocationAnalysisError(`Her kritere 100 üzerinden bir ağırlık puanı verilmeli ve tüm kriterlerin puanları toplamı tam olarak 100 olmalıdır. Şu anki puan toplamı: ${totalScore}. Puan toplamı 100'den farklı ise analiz başlatılamaz.`);
            return;
        }
        if (analysisCriteria.some(c => !c.categoryId)) {
            setLocationAnalysisError('Lütfen tüm kriterler için geçerli bir kategori seçiniz.');
            return;
        }
        if (locationAnalysisAreaMode === 'city' && !selectedAnalysisCityPlate) {
            setLocationAnalysisError('Lütfen hedef bölge olarak iller listesinden bir il seçiniz veya haritada poligon çizin.');
            return;
        }
        if (locationAnalysisAreaMode === 'polygon' && !analysisDrawnWkt) {
            setLocationAnalysisError('Lütfen harita üzerinde bir analiz alanı (poligon) çiziniz.');
            return;
        }

        setLocationAnalysisLoading(true);

        try {
            let cityObj = null;
            if (locationAnalysisAreaMode === 'city') {
                cityObj = citiesList.find(c => String(c.plate) === String(selectedAnalysisCityPlate));
            }

            const payload = {
                cityPlate: locationAnalysisAreaMode === 'city' ? parseInt(selectedAnalysisCityPlate, 10) : null,
                boundaryWkt: locationAnalysisAreaMode === 'polygon' ? analysisDrawnWkt : (cityObj?.wkt || null),
                boundaryName: locationAnalysisAreaMode === 'city' ? `${cityObj?.name || 'Seçili İl'} İli` : 'Özel Çizilen Analiz Alanı',
                criteria: analysisCriteria.map(c => {
                    const cat = poiCategories.find(cat => cat.id === parseInt(c.categoryId, 10));
                    return {
                        categoryId: parseInt(c.categoryId, 10),
                        categoryName: cat?.name || '',
                        weight: parseInt(c.weight, 10) || 0
                    };
                })
            };

            const result = await adminApi.runLocationAnalysis(payload, token);

            if (locationAnalysisHeatmapSourceRef.current) {
                locationAnalysisHeatmapSourceRef.current.clear();
            }
            if (locationAnalysisBoundarySourceRef.current) {
                locationAnalysisBoundarySourceRef.current.clear();
            }

            // 1. Sınır Poligonunu Haritaya Ekle
            if (result.boundaryWkt && locationAnalysisBoundarySourceRef.current) {
                try {
                    const wktFormat = new WKT();
                    const boundaryFeat = wktFormat.readFeature(result.boundaryWkt, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    if (boundaryFeat) {
                        locationAnalysisBoundarySourceRef.current.addFeature(boundaryFeat);
                        if (mapRef.current) {
                            mapRef.current.getView().fit(boundaryFeat.getGeometry().getExtent(), {
                                padding: [80, 80, 80, 80],
                                duration: 1000,
                                maxZoom: 14
                            });
                        }
                    }
                } catch (e) {
                    console.error('Sınır WKT yüklenemedi:', e);
                }
            }

            // 2. Analiz Edilen POI'leri Ağırlıklarıyla Isı Haritasına Yükle
            if (result.analyzedPois && result.analyzedPois.length > 0 && locationAnalysisHeatmapSourceRef.current) {
                const features = result.analyzedPois.map(poi => {
                    const f = new Feature({
                        geometry: new Point(fromLonLat([poi.longitude, poi.latitude])),
                        weight: poi.weight, // 0.0 - 1.0 arası ağırlık
                        criterionScore: poi.criterionScore,
                        name: poi.name,
                        categoryName: poi.categoryName
                    });
                    return f;
                });
                locationAnalysisHeatmapSourceRef.current.addFeatures(features);
            }

            setLocationAnalysisResult(result);
            setIsLocationAnalysisHeatmapVisible(true);
            setShowLocationAnalysisModal(false);

            toastRef.current?.show({
                severity: 'success',
                summary: 'Konum Analizi Başarılı',
                detail: `${result.boundaryName} sınırında ${result.totalPoiCount} adet POI belirlenen kriter puanlarına göre ağırlıklandırılarak Isı Haritası üretildi.`,
                life: 5000
            });
        } catch (err) {
            console.error('Konum analizi hatası:', err);
            setLocationAnalysisError(err.message || 'Analiz gerçekleştirilirken bir hata oluştu.');
            toastRef.current?.show({
                severity: 'error',
                summary: 'Analiz Hatası',
                detail: err.message || 'Konum analizi başlatılamadı.',
                life: 4500
            });
        } finally {
            setLocationAnalysisLoading(false);
        }
    };

    const handleClearLocationAnalysis = () => {
        if (locationAnalysisHeatmapSourceRef.current) {
            locationAnalysisHeatmapSourceRef.current.clear();
        }
        if (locationAnalysisBoundarySourceRef.current) {
            locationAnalysisBoundarySourceRef.current.clear();
        }
        setLocationAnalysisResult(null);
        setIsLocationAnalysisHeatmapVisible(false);
        setAnalysisDrawnWkt('');
        toastRef.current?.show({
            severity: 'info',
            summary: 'Analiz Temizlendi',
            detail: 'Konum analizi sonuçları ve Isı Haritası temizlendi.',
            life: 3000
        });
    };

    // OpenLayers harita ve katman referansları
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const savedPlacesSourceRef = useRef(null);
    const drawingsSourceRef = useRef(null);
    const analysisSourceRef = useRef(new VectorSource());
    const drawInteractionRef = useRef(null);
    const draftFeatureRef = useRef(null);
    const tileLayerRef = useRef(null);
    const overlayContainerRef = useRef(null);
    const overlayRef = useRef(null);
    const drawTypeRef = useRef(drawType);
    const placeColorRef = useRef(placeColor);

    useEffect(() => {
        drawTypeRef.current = drawType;
    }, [drawType]);

    useEffect(() => {
        placeColorRef.current = placeColor;
    }, [placeColor]);

    // OTURUM SÜRESİ KONTROLÜ VE GERİ SAYIM ZAMANLAYICISI (Admin için Sınırsız / Infinite)
    useEffect(() => {
        if (!token) return;

        const checkSessionExpiration = () => {
            const role = localStorage.getItem('user_role') || userRole;
            const isUserAdmin = role === 'Admin' || isAdmin || localStorage.getItem('is_admin') === 'true';

            // Admin oturum süresi sınırsızdır (asla otomatik çıkış yapmaz)
            if (isUserAdmin) {
                setTimeLeft(999999);
                return;
            }

            const expirationTime = localStorage.getItem('session_expiration');
            if (!expirationTime) {
                return;
            }

            const remainingMs = parseInt(expirationTime, 10) - Date.now();
            const remainingSeconds = Math.floor(remainingMs / 1000);

            if (remainingSeconds <= 0) {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('logged_in_username');
                localStorage.removeItem('session_expiration');
                setToken('');
                setLoggedInUsername('');
                setCurrentView('map');
                setError('Oturum süreniz sona erdi.');
            } else {
                setTimeLeft(remainingSeconds);
            }
        };

        checkSessionExpiration();
        const interval = setInterval(checkSessionExpiration, 1000);
        return () => clearInterval(interval);
    }, [token, isAdmin, userRole]);


    // Toast Bildirimi Tetikleme
    useEffect(() => {
        if (infoMessage && toastRef.current) {
            const lowerMsg = infoMessage.toLowerCase();
            const isError = lowerMsg.includes('hata') || 
                            lowerMsg.includes('başarısız') ||
                            lowerMsg.includes('dışındadır') ||
                            lowerMsg.includes('dışında') ||
                            lowerMsg.includes('yetkisiz') ||
                            lowerMsg.includes('engellendi') ||
                            lowerMsg.includes('izin verilen') ||
                            lowerMsg.includes('uyarı') ||
                            lowerMsg.includes('bulunamadı') ||
                            lowerMsg.includes('geçersiz');
            toastRef.current.show({
                severity: isError ? 'error' : 'success',
                summary: isError ? 'Başarısız' : 'Başarılı',
                detail: infoMessage,
                life: isError ? 4500 : 3500
            });
        }
    }, [infoMessage]);

    // KAYITLI TÜM ÇİZİMLERİ BACKEND'DEN ÇEKME (GET /api/drawings)
    const fetchDrawings = async () => {
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch('http://localhost:5041/api/drawings', { headers });
            if (response.ok) {
                const data = await response.json();
                setSavedDrawings(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Çizim verileri getirilirken hata oluştu:', err);
        }
    };

    // POI KATEGORİLERİNİ ÇEKME YARDIMCISI
    const fetchPoiCategories = async () => {
        try {
            const catsData = await adminApi.getPoiCategories(false, token);
            if (Array.isArray(catsData)) {
                setPoiCategories(catsData);
                return catsData;
            }
        } catch (err) {
            console.error('POI Kategorileri getirilirken hata:', err);
        }
        return [];
    };

    // ZOOM SEVİYESİNE VE KATEGORİYE DUYARLI POI STİL FONKSİYONU
    const createPoiStyle = (feature, resolution) => {
        const vis = layerVisibilityRef.current || {};
        if (vis.pois === false) return [];

        const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : (mapRef.current?.getView()?.getZoom() || 0);

        const poi = feature.get('poiData') || {};
        const priority = poi.categoryDisplayOrder || 1;
        const poiColor = poi.categoryColor || '#8b5cf6';
        const catName = poi.categoryName || poi.name || '';
        const catLower = (catName || '').toLowerCase();
        const allCats = poiCategoriesRef.current || [];

        // 1. POI'nin ait olduğu ana (üst) kategoriyi ve alt kategoriyi tespit et
        let rootCatId = null;
        let rootCatName = null;
        let directCat = null;

        if (poi.categoryId && allCats.length > 0) {
            directCat = allCats.find(c => c.id === poi.categoryId);
            if (directCat) {
                if (directCat.parentId && directCat.parentId !== 0) {
                    rootCatId = directCat.parentId;
                    const parentCat = allCats.find(c => c.id === directCat.parentId);
                    rootCatName = parentCat?.name;
                } else {
                    rootCatId = directCat.id;
                    rootCatName = directCat.name;
                }
            }
        }

        // POI üstündeki parentCategoryName veya categoryName ile fallback eşleme
        if (!rootCatId && allCats.length > 0) {
            const pName = (poi.parentCategoryName || '').trim().toLowerCase();
            const cName = (poi.categoryName || '').trim().toLowerCase();
            if (pName) {
                const foundParent = allCats.find(c => (!c.parentId || c.parentId === 0) && c.name?.trim().toLowerCase() === pName);
                if (foundParent) {
                    rootCatId = foundParent.id;
                    rootCatName = foundParent.name;
                }
            }
            if (!rootCatId && cName) {
                const foundCat = allCats.find(c => c.name?.trim().toLowerCase() === cName);
                if (foundCat) {
                    rootCatId = (foundCat.parentId && foundCat.parentId !== 0) ? foundCat.parentId : foundCat.id;
                    const parentCat = (foundCat.parentId && foundCat.parentId !== 0) ? allCats.find(c => c.id === foundCat.parentId) : foundCat;
                    rootCatName = parentCat?.name;
                }
            }
        }

        // 2. KATMAN GÖRÜNÜRLÜĞÜ FİLTRESİ KONTROLÜ (Üst ve Alt Kategori)
        if (vis.poiCategories) {
            // Ana kategori ID kontrolü (number veya string)
            if (rootCatId != null) {
                if (vis.poiCategories[rootCatId] === false || vis.poiCategories[String(rootCatId)] === false) {
                    return [];
                }
            }
            // Ana kategori İsim kontrolü
            if (rootCatName && (vis.poiCategories[rootCatName] === false || vis.poiCategories[rootCatName.toLowerCase()] === false)) {
                return [];
            }
            // Doğrudan alt kategori ID kontrolü
            if (poi.categoryId != null) {
                if (vis.poiCategories[poi.categoryId] === false || vis.poiCategories[String(poi.categoryId)] === false) {
                    return [];
                }
            }
            if (poi.categoryName && (vis.poiCategories[poi.categoryName] === false || vis.poiCategories[poi.categoryName.toLowerCase()] === false)) {
                return [];
            }
        }

        // Kategori Eşleştirmesi veya Dinamik Kategori Anahtarı
        let catKey = null;
        const isAirportPoi = catLower.includes('havaliman') || catLower.includes('uçuş') || catLower.includes('ucus') || catLower.includes('airport') || poi.isSystemAirport;
        if (isAirportPoi) catKey = 'havalimani';
        else if (catLower.includes('alışveriş') || catLower.includes('alisveris') || catLower.includes('avm') || catLower.includes('mağaza') || catLower.includes('magaza') || catLower.includes('butik') || catLower.includes('giyim') || catLower.includes('kuyumcu')) catKey = 'alisveris';
        else if (catLower.includes('market') || catLower.includes('bakkal') || catLower.includes('süpermarket') || catLower.includes('supermarket') || catLower.includes('şarküteri') || catLower.includes('manav')) catKey = 'market';
        else if (catLower.includes('sağlık') || catLower.includes('saglik') || catLower.includes('hastane') || catLower.includes('klinik') || catLower.includes('doktor') || catLower.includes('tıp') || catLower.includes('poliklinik')) catKey = 'hastane';
        else if (catLower.includes('eczane') || catLower.includes('ilaç') || catLower.includes('ilac') || catLower.includes('medikal')) catKey = 'eczane';
        else if (catLower.includes('eğitim') || catLower.includes('egitim') || catLower.includes('okul') || catLower.includes('üniversite') || catLower.includes('universite') || catLower.includes('lise') || catLower.includes('kolej') || catLower.includes('fakülte')) catKey = 'okul';
        else if (catLower.includes('müze') || catLower.includes('muze') || catLower.includes('museum') || catLower.includes('ören') || catLower.includes('tarih') || catLower.includes('antik') || catLower.includes('kale')) catKey = 'muze';
        else if (catLower.includes('kütüphane') || catLower.includes('kutuphane') || catLower.includes('library') || catLower.includes('kitap') || catLower.includes('kitabevi') || catLower.includes('kırtasiye') || catLower.includes('arşiv')) catKey = 'kutuphane';
        else if (catLower.includes('sanat') || catLower.includes('kültür') || catLower.includes('kultur') || catLower.includes('galeri') || catLower.includes('tiyatro') || catLower.includes('sergi') || catLower.includes('konser') || catLower.includes('sinema')) catKey = 'sanat';
        else if (catLower.includes('anıt') || catLower.includes('anit') || catLower.includes('heykel') || catLower.includes('abide') || catLower.includes('türbe') || catLower.includes('anıtı') || catLower.includes('şehitlik')) catKey = 'anit';
        else if (catLower.includes('spor') || catLower.includes('saha') || catLower.includes('stadyum') || catLower.includes('stadium') || catLower.includes('fitness') || catLower.includes('kort') || catLower.includes('gym') || catLower.includes('havuz')) catKey = 'spor';
        else if (catLower.includes('akaryakıt') || catLower.includes('akaryakit') || catLower.includes('benzin') || catLower.includes('petrol') || catLower.includes('gaz') || catLower.includes('şarj') || catLower.includes('sarj')) catKey = 'akaryakit';
        else if (catLower.includes('tamir') || catLower.includes('sanayi') || catLower.includes('oto servis') || catLower.includes('oto yıkama') || catLower.includes('lastik') || catLower.includes('rent a car') || catLower.includes('kiralama')) catKey = 'oto_servis';
        else if (catLower.includes('otopark') || catLower.includes('park yeri')) catKey = 'otopark';
        else if (catLower.includes('atm') || catLower.includes('bankamatik') || catLower.includes('banka') || catLower.includes('finans') || catLower.includes('döviz') || catLower.includes('kredi')) catKey = 'atm';
        else if (catLower.includes('plaj') || catLower.includes('kumsal') || catLower.includes('sahil') || catLower.includes('beach') || catLower.includes('koy') || catLower.includes('marina') || catLower.includes('deniz') || catLower.includes('iskele')) catKey = 'plaj';
        else if (catLower.includes('kafe') || catLower.includes('cafe') || catLower.includes('kahve') || catLower.includes('çay') || catLower.includes('cay') || catLower.includes('pastane') || catLower.includes('tatlı') || catLower.includes('dondurma')) catKey = 'kafe';
        else if (catLower.includes('yeme') || catLower.includes('restoran') || catLower.includes('yemek') || catLower.includes('lokanta') || catLower.includes('kebap') || catLower.includes('burger') || catLower.includes('pizza') || catLower.includes('döner')) catKey = 'restoran';
        else if (catLower.includes('otel') || catLower.includes('hotel') || catLower.includes('konaklama') || catLower.includes('pansiyon') || catLower.includes('tatil') || catLower.includes('motel') || catLower.includes('resort')) catKey = 'otel';
        else if (catLower.includes('park') || catLower.includes('doğa') || catLower.includes('doga') || catLower.includes('bahçe') || catLower.includes('bahce') || catLower.includes('koru') || catLower.includes('orman') || catLower.includes('yeşil') || catLower.includes('botanik') || catLower.includes('kamp') || catLower.includes('dağ')) catKey = 'park';
        else if (catLower.includes('cami') || catLower.includes('mescit') || catLower.includes('kilise') || catLower.includes('dini') || catLower.includes('ibadethane')) catKey = 'dini';
        else if (catLower.includes('belediye') || catLower.includes('valilik') || catLower.includes('adliye') || catLower.includes('mahkeme') || catLower.includes('noter') || catLower.includes('ptt') || catLower.includes('postane') || catLower.includes('karakol') || catLower.includes('polis') || catLower.includes('itfaiye')) catKey = 'kamu';
        else if (poi.categoryId) catKey = `cat_${poi.categoryId}`;
        else if (catName) catKey = `cat_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        // Katman Görünürlüğü POI Alt Kategori Filtresi (poiTypes)
        if (vis.poiTypes && catKey && vis.poiTypes[catKey] === false) {
            return [];
        }

        const zs = getZoomSettings();
        let minPoiZoom;
        if (isAirportPoi) {
            minPoiZoom = zs.airportStopMinZoom ?? (zs.poi_havalimani_minZoom ?? 4.5);
        } else if (catKey && zs[`poi_${catKey}_minZoom`] !== undefined) {
            minPoiZoom = zs[`poi_${catKey}_minZoom`];
        } else if (poi.categoryId && zs[`poi_cat_${poi.categoryId}_minZoom`] !== undefined) {
            minPoiZoom = zs[`poi_cat_${poi.categoryId}_minZoom`];
        } else {
            const isCritical = priority <= 2 || catKey === 'hastane' || catKey === 'muze' || catKey === 'anit' || catLower.includes('ulaşım') || catLower.includes('terminal');
            minPoiZoom = isCritical ? (zs.poiCriticalMinZoom ?? 5.0) : (zs.poiMinZoom ?? 5.5);
        }

        if (zoom < minPoiZoom) {
            return [];
        }

        const catIcon = poi.categoryIcon || '';
        const name = poi.name || '';
        const geomType = feature.getGeometry() ? feature.getGeometry().getType() : 'Point';

        // İsim etiketleri: Yakın zoomda (zoom >= poiNameMinZoom) görünür
        const poiNameMinZoom = zs.poiNameMinZoom ?? 11.5;
        const showLabel = name && zoom >= poiNameMinZoom;
        const textStyle = showLabel ? new Text({
            text: name,
            font: '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 2.5 }),
            offsetY: -18,
            overflow: false
        }) : undefined;

        // Öncelik bazlı z-index
        const dynamicZIndex = Math.max(1, 100 - priority * 10);
        const categoryBadgeSvg = getPoiCategoryBadgeSvg(catName, catIcon, poiColor);

        // Zoom seviyesine göre ölçekleme (%30 büyütülmüş net rozet görünümü)
        const iconScale = zoom < 8.5 ? 0.50 : (zoom < 12 ? 0.60 : 0.68);

        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
            const interiorPt = feature.getGeometry().getInteriorPoint ? feature.getGeometry().getInteriorPoint() : new Point(getCenter(feature.getGeometry().getExtent()));
            return [
                new Style({
                    stroke: new Stroke({ color: poiColor, width: 2 }),
                    fill: new Fill({ color: hexToRgba(poiColor, 0.3) }),
                    zIndex: dynamicZIndex
                }),
                new Style({
                    geometry: interiorPt,
                    image: new Icon({
                        src: 'data:image/svg+xml;utf8,' + encodeURIComponent(categoryBadgeSvg),
                        scale: iconScale,
                        anchor: [0.5, 0.5]
                    }),
                    text: textStyle,
                    zIndex: dynamicZIndex + 1
                })
            ];
        } else {
            return new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(categoryBadgeSvg),
                    scale: iconScale,
                    anchor: [0.5, 0.5]
                }),
                text: textStyle,
                zIndex: dynamicZIndex
            });
        }
    };

    // POI (POINT OF INTEREST) VE KATEGORİLERİ ÇEKME & HARİTADA GÖSTERME
    const fetchPois = async () => {
        try {
            const [poisData, catsData] = await Promise.all([
                adminApi.getPois(null, false, token).catch(() => []),
                adminApi.getPoiCategories(false, token).catch(() => [])
            ]);

            const dbPois = Array.isArray(poisData) ? poisData : [];
            const dbPoisNameSet = new Set(dbPois.map(p => (p.name || '').toLowerCase().trim()));

            let effectiveCats = Array.isArray(catsData) ? [...catsData] : [];
            let airportCat = effectiveCats.find(c => (c.name || '').toLowerCase().includes('havaliman') || c.key === 'havalimani');
            if (!airportCat) {
                airportCat = {
                    id: 9901,
                    name: 'Havalimanı & Uçuş',
                    key: 'havalimani',
                    color: '#0284c7',
                    icon: 'plane',
                    displayOrder: 2,
                    isActive: true
                };
                effectiveCats.push(airportCat);
            }

            const airportPois = (TURKISH_AIRPORTS || []).filter(apt => !dbPoisNameSet.has(apt.name.toLowerCase().trim())).map((apt, idx) => ({
                id: apt.id || `apt_${idx + 1}`,
                name: apt.name,
                description: `${apt.type} • ${apt.runways} • IATA: ${apt.iata} • ICAO: ${apt.icao} • ${apt.description}`,
                categoryName: airportCat.name,
                parentCategoryName: 'Ulaşım',
                categoryId: airportCat.id,
                categoryColor: '#0284c7',
                categoryIcon: 'plane',
                workingHours: '7/24 Açık (24 Saat Kesintisiz Uçuş)',
                imageUrl: apt.imageUrl,
                wkt: `POINT(${apt.coordinates[0]} ${apt.coordinates[1]})`,
                latitude: apt.coordinates[1],
                longitude: apt.coordinates[0],
                username: 'Sistem Kaydı',
                createdAt: '2026-09-04 12:00',
                isActive: true,
                isAirport: true,
                iata: apt.iata,
                icao: apt.icao,
                city: apt.city,
                region: apt.region,
                runways: apt.runways,
                type: apt.type
            }));

            const combinedPois = [...dbPois, ...airportPois];
            setPois(combinedPois);
            setPoiCategories(effectiveCats);
            poiCategoriesRef.current = effectiveCats;

            if (poiSourceRef.current) {
                poiSourceRef.current.clear();
                const wktFormat = new WKT();
                combinedPois.forEach((poi) => {
                    try {
                        if (!poi.wkt) return;
                        const feat = wktFormat.readFeature(poi.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        feat.set('isPoi', true);
                        feat.set('poiData', poi);

                        poiSourceRef.current.addFeature(feat);
                    } catch (e) {
                        console.error('POI Feature render hatası:', e);
                    }
                });
                if (poiLayerRef.current) {
                    poiLayerRef.current.changed();
                }
            }
        } catch (err) {
            console.error('POI verileri getirilirken hata:', err);
        }
    };

    // GÜZERGAHLARI VE DURAKLARI ÇEKME VE HARİTADA GÖSTERME (Akıllı Ulaşım Modülü)
    const fetchRoutesAndStops = async () => {
        if (!token) return;
        try {
            const [routesData, stopsData] = await Promise.all([
                transportApi.getRoutes(token).catch(err => { console.error('getRoutes error:', err); return []; }),
                transportApi.getAllStops(token).catch(err => { console.error('getAllStops error:', err); return []; })
            ]);

            const routeList = Array.isArray(routesData) ? routesData : [];
            const allStopsList = Array.isArray(stopsData) ? stopsData : [];
            setRoutes(routeList);

            if (routeSourceRef.current) routeSourceRef.current.clear();
            if (stopSourceRef.current) stopSourceRef.current.clear();

            const wktFormat = new WKT();

            // 1. Hat Çizgilerini Ekle
            routeList.forEach((r) => {
                const routeColor = r.color || '#3b82f6';
                const sortedStops = (r.stops || []).slice().sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

                const isRouteVisible = !hiddenRouteIds.has(r.id);
                if (!isRouteVisible) return;

                let lineGeom = null;
                if (r.wkt) {
                    try {
                        const featureFromWkt = wktFormat.readFeature(r.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        lineGeom = featureFromWkt.getGeometry();
                    } catch (e) {
                        console.error('Route WKT read error:', e);
                    }
                }

                if (!lineGeom && sortedStops.length >= 2) {
                    const lineCoords = sortedStops
                        .filter(s => s.longitude != null && s.latitude != null)
                        .map(s => fromLonLat([s.longitude, s.latitude]));

                    if (lineCoords.length >= 2) {
                        lineGeom = new LineString(lineCoords);
                    }
                }

                if (lineGeom) {
                    const lineFeature = new Feature({
                        geometry: lineGeom,
                        id: r.id,
                        isRouteLine: true,
                        routeData: r,
                        routeColor: routeColor,
                        routeClass: r.routeClass || 'araba',
                        routeName: r.name
                    });

                    routeSourceRef.current?.addFeature(lineFeature);
                }
            });

            // 2. BÜTÜN Durakları (Hem Güzergaha Bağlı Olanları Hem de Bağımsız Durakları / Limanları) Haritaya Ekle
            const routeMap = new Map(routeList.map(r => [r.id, r]));

            allStopsList.forEach((s) => {
                if (s.longitude == null || s.latitude == null) return;

                const boundRoute = s.routeId ? routeMap.get(s.routeId) : null;
                const isRouteVisible = !s.routeId || !hiddenRouteIds.has(s.routeId);
                if (!isRouteVisible) return;

                const stopClass = (s.stopClass || (boundRoute ? boundRoute.routeClass : 'otobus')).toLowerCase();
                const routeColor = boundRoute ? (boundRoute.color || '#3b82f6') : (
                    stopClass === 'gemi' || stopClass === 'liman' ? '#0891b2' :
                    stopClass === 'metro' ? '#ef4444' :
                    stopClass === 'tren' ? '#f59e0b' :
                    stopClass === 'otobus' ? '#0284c7' : '#3b82f6'
                );

                const stopGeom = new Point(fromLonLat([s.longitude, s.latitude]));
                const stopFeature = new Feature({
                    geometry: stopGeom,
                    id: s.id,
                    isStop: true,
                    stopId: s.id,
                    stopClass: stopClass,
                    routeClass: stopClass,
                    routeId: s.routeId || null,
                    orderIndex: s.orderIndex || 1,
                    stopName: s.name,
                    routeColor: routeColor,
                    stopData: {
                        ...s,
                        stopClass: stopClass,
                        routeColor: routeColor,
                        routeName: boundRoute?.name || null,
                        routeClass: stopClass,
                        routeId: s.routeId || null,
                        totalStopsInRoute: boundRoute?.stops?.length || 0
                    }
                });

                stopSourceRef.current?.addFeature(stopFeature);
            });

            setStops(allStopsList);
        } catch (err) {
            console.error('Güzergah ve durak verileri getirilirken hata:', err);
        }
    };

    // Tekil güzergah görünürlüğü değiştiğinde haritayı anında yenile
    useEffect(() => {
        if (token && routes.length > 0) {
            fetchRoutesAndStops();
        }
    }, [hiddenRouteIds]);

    // Güzergah seçildiğinde durak ve hat katmanlarını yenile (otobüs güzergahları seçildiğinde görünsün)
    useEffect(() => {
        if (stopLayerRef.current) {
            stopLayerRef.current.changed();
        }
        if (routeLayerRef.current) {
            routeLayerRef.current.changed();
        }
    }, [selectedRouteInfo]);

    const handleToggleIndividualRouteVisibility = (routeId) => {
        setHiddenRouteIds(prev => {
            const next = new Set(prev);
            if (next.has(routeId)) next.delete(routeId);
            else next.add(routeId);
            return next;
        });
    };

    const handleGenerateOsrmRouteFromMap = async (routeId) => {
        try {
            setIsGeneratingOsrmOnMapId(routeId);
            const res = await transportApi.generateOsrmRoute(routeId, token);
            toastRef.current?.show({
                severity: 'success',
                summary: 'OSRM Rotası Oluşturuldu',
                detail: res.message || 'Gerçek karayolu rotası başarıyla oluşturuldu ve haritaya işlendi.',
                life: 4000
            });
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Rota Hatası',
                detail: err.message || 'OSRM ile rota üretilemedi.',
                life: 4000
            });
        } finally {
            setIsGeneratingOsrmOnMapId(null);
        }
    };

    const handleSwitchGeometryModeFromMap = async (routeId, mode) => {
        try {
            setIsGeneratingOsrmOnMapId(routeId);
            const res = await transportApi.switchGeometryMode(routeId, mode, token);
            toastRef.current?.show({
                severity: 'success',
                summary: 'Geometri Güncellendi',
                detail: res.message || 'Hat geometrisi başarıyla değiştirildi.',
                life: 4000
            });
            if (res.route) setSelectedRouteInfo(res.route);
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'İşlem Başarısız',
                detail: err.message || 'Geometri modu değiştirilemedi.',
                life: 4000
            });
        } finally {
            setIsGeneratingOsrmOnMapId(null);
        }
    };

    const handleRevertGeometryFromMap = async (routeId) => {
        try {
            setIsGeneratingOsrmOnMapId(routeId);
            const res = await transportApi.revertGeometry(routeId, token);
            toastRef.current?.show({
                severity: 'success',
                summary: 'Geri Alındı',
                detail: res.message || 'Hat geometrisi önceki haline geri döndürüldü.',
                life: 4000
            });
            if (res.route) setSelectedRouteInfo(res.route);
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Geri Alma Başarısız',
                detail: err.message || 'Önceki geometriye dönülemedi.',
                life: 4000
            });
        } finally {
            setIsGeneratingOsrmOnMapId(null);
        }
    };

    // =========================================================
    // CANLI ARAÇ SİMÜLASYONU & SIGNALR ÇİFT YÖNLÜ VERİ YÖNETİMİ
    // ULTRA AKICI 60 FPS HAREKET VE YÖN İNTERPOLASYON MOTORU
    // =========================================================
    const updateVehicleFeatureOnMap = (loc) => {
        if (!loc || !simulationSourceRef.current) return;
        const source = simulationSourceRef.current;
        const rawId = loc.routeId;
        const numId = Number(rawId);
        const targetCoord = fromLonLat([loc.longitude, loc.latitude]);
        const targetBearingDeg = loc.bearing || 0;
        const targetBearingRad = (targetBearingDeg * Math.PI) / 180;
        const targetPercent = loc.progressPercentage || 0;

        if (!vehicleFeaturesMapRef.current || typeof vehicleFeaturesMapRef.current.get !== 'function') {
            vehicleFeaturesMapRef.current = new Map();
        }
        if (!vehicleAnimMapRef.current) {
            vehicleAnimMapRef.current = new Map();
        }

        const matchedRoute = routesRef.current?.find?.(r => r.id === numId) || routes?.find?.(r => r.id === numId) || (selectedRouteInfo?.id === numId ? selectedRouteInfo : null);
        const resolvedRouteClass = loc.routeClass || matchedRoute?.routeClass || 'araba';
        const enrichedLoc = { ...loc, routeClass: resolvedRouteClass };

        let feature = null;
        try {
            feature = vehicleFeaturesMapRef.current.get(numId) || 
                      vehicleFeaturesMapRef.current.get(rawId) || 
                      vehicleFeaturesMapRef.current.get(String(numId));
        } catch (_) { }

        if (!feature) {
            feature = new Feature({
                geometry: new Point(targetCoord),
                isSimulatedVehicle: true,
                routeId: numId,
                vehicleData: enrichedLoc
            });
            feature.setStyle(createSimulatedVehicleStyle(enrichedLoc));
            feature.set('currentBearingRad', targetBearingRad);
            feature.set('lastClass', resolvedRouteClass);
            feature.set('lastColor', enrichedLoc.routeColor);
            source.addFeature(feature);

            try {
                vehicleFeaturesMapRef.current.set(numId, feature);
                vehicleFeaturesMapRef.current.set(rawId, feature);
                vehicleFeaturesMapRef.current.set(String(numId), feature);
            } catch (_) { }
        } else {
            const geom = feature.getGeometry();
            const startCoord = geom ? geom.getCoordinates() : targetCoord;
            const startAngleRad = Number.isFinite(feature.get('currentBearingRad')) ? feature.get('currentBearingRad') : targetBearingRad;

            // Stil güncellemesi gerekiyorsa (renk veya sınıf değiştiğinde) stili yenile
            const prevClass = feature.get('lastClass');
            const prevColor = feature.get('lastColor');
            if (prevClass !== resolvedRouteClass || prevColor !== enrichedLoc.routeColor) {
                feature.setStyle(createSimulatedVehicleStyle(enrichedLoc));
                feature.set('lastClass', resolvedRouteClass);
                feature.set('lastColor', enrichedLoc.routeColor);
            }

            // Önceki animasyonu durdur
            const prevAnim = vehicleAnimMapRef.current.get(numId);
            if (prevAnim?.rafId) cancelAnimationFrame(prevAnim.rafId);

            const startTime = performance.now();
            let lastTimestamp = startTime;
            let currentInterpolationT = 0;

            const animStep = (now) => {
                const currentSpeed = Number(simSpeedMapRef.current?.[numId]) || 1;
                const dt = Math.max(0, now - lastTimestamp);
                lastTimestamp = now;

                // Dinamik adaptif akışkanlık (Hız arttıkça 60 FPS pürüzsüz mikro-adım enterpolasyonu)
                const baseStepDuration = 320;
                currentInterpolationT += (dt * currentSpeed) / baseStepDuration;
                const t = Math.min(currentInterpolationT, 1);

                // Kesintisiz pürüzsüz doğrusal interpolasyon (Aksın gitsin)
                const curX = startCoord[0] + (targetCoord[0] - startCoord[0]) * t;
                const curY = startCoord[1] + (targetCoord[1] - startCoord[1]) * t;
                const curAngle = lerpAngle(startAngleRad, targetBearingRad, t);

                if (geom) {
                    geom.setCoordinates([curX, curY]);
                }
                feature.set('currentBearingRad', curAngle);

                // Nesne tahsisi yapmadan doğrudan ikon dönüş açısını güncelle (60 FPS pürüzsüz)
                const style = feature.getStyle();
                if (style && typeof style.getImage === 'function') {
                    const img = style.getImage();
                    if (img && typeof img.setRotation === 'function') {
                        img.setRotation(curAngle);
                    }
                    const txt = style.getText && style.getText();
                    if (txt) {
                        const pctStr = `%${Math.round(targetPercent)}`;
                        if (txt.getText() !== pctStr) {
                            txt.setText(pctStr);
                        }
                    }
                }

                // Kamera Otomatik Araç Takibi (Auto-pan Follow Mode) 60 FPS senkron kayma
                if (Number(followingRouteIdRef.current) === numId && mapRef.current) {
                    mapRef.current.getView().setCenter([curX, curY]);
                }

                if (t < 1) {
                    const nextRaf = requestAnimationFrame(animStep);
                    vehicleAnimMapRef.current.set(numId, { rafId: nextRaf });
                }
            };

            const rafId = requestAnimationFrame(animStep);
            vehicleAnimMapRef.current.set(numId, { rafId });

            feature.set('vehicleData', enrichedLoc);
            if (!source.getFeatures().includes(feature)) {
                source.addFeature(feature);
            }
        }

        try {
            source.changed();
            mapRef.current?.render();
        } catch (_) { }
    };

    const removeVehicleFeatureFromMap = (routeId) => {
        if (!simulationSourceRef.current) return;
        const numId = Number(routeId);

        // 0. Varsa devam eden animasyon karesini derhal durdur
        if (!vehicleAnimMapRef.current || typeof vehicleAnimMapRef.current.get !== 'function') {
            vehicleAnimMapRef.current = new Map();
        }

        try {
            const runningAnim = vehicleAnimMapRef.current.get(numId) || vehicleAnimMapRef.current.get(routeId);
            if (runningAnim?.rafId) {
                cancelAnimationFrame(runningAnim.rafId);
            }
            if (typeof vehicleAnimMapRef.current.delete === 'function') {
                vehicleAnimMapRef.current.delete(numId);
                vehicleAnimMapRef.current.delete(routeId);
                vehicleAnimMapRef.current.delete(String(numId));
                vehicleAnimMapRef.current.delete(String(routeId));
            }
        } catch (_) { }

        // 1. Ref haritasından güvenle kaldır
        if (!vehicleFeaturesMapRef.current || typeof vehicleFeaturesMapRef.current.delete !== 'function') {
            vehicleFeaturesMapRef.current = new Map();
        }

        try {
            const feature = vehicleFeaturesMapRef.current.get(numId) || 
                            vehicleFeaturesMapRef.current.get(routeId) || 
                            vehicleFeaturesMapRef.current.get(String(numId));
            if (feature) {
                try {
                    simulationSourceRef.current.removeFeature(feature);
                } catch (e) { }
            }
            if (typeof vehicleFeaturesMapRef.current.delete === 'function') {
                vehicleFeaturesMapRef.current.delete(numId);
                vehicleFeaturesMapRef.current.delete(routeId);
                vehicleFeaturesMapRef.current.delete(String(numId));
                vehicleFeaturesMapRef.current.delete(String(routeId));
            }
        } catch (_) { }

        // 2. OpenLayers katmanında kalmış olabilecek tüm ilgili feature'ları tara ve tamamen temizle
        try {
            const allFeatures = simulationSourceRef.current.getFeatures();
            allFeatures.forEach(f => {
                const fRouteId = Number(f.get('routeId') ?? f.get('vehicleData')?.routeId);
                if (fRouteId === numId || f.get('routeId') === routeId || String(fRouteId) === String(numId)) {
                    try {
                        simulationSourceRef.current.removeFeature(f);
                    } catch (e) { }
                }
            });
        } catch (e) { }

        // 3. ANINDA VE KESİN HARİTA CANVAS YENİLEMESİ (Ghost / kalıntı pikseli derhal yok et)
        try {
            simulationSourceRef.current.changed();
            mapRef.current?.render();
        } catch (e) { }
    };

    // SignalR Canlı Veri Akışı ve Olay Dinleyicileri
    useEffect(() => {
        // SignalR Bağlantısını Başlat
        simulationHubService.connect(token).then(() => {
            // Başlangıçta aktif simülasyonları sunucudan çek
            simulationHubService.getActiveSimulations().then((activeList) => {
                if (Array.isArray(activeList)) {
                    const simMap = {};
                    const vehMap = {};
                    activeList.forEach((s) => {
                        const numId = Number(s.routeId);
                        unmarkRouteAsStopped(numId);
                        unmarkRouteAsStopped(s.routeId);
                        unmarkRouteAsStopped(String(numId));

                        const cleanSim = { ...s, isRunning: true, isPaused: Boolean(s.isPaused) };
                        simMap[s.routeId] = cleanSim;
                        simMap[numId] = cleanSim;
                        simMap[String(numId)] = cleanSim;

                        if (s.lastLocation) {
                            vehMap[s.routeId] = s.lastLocation;
                            vehMap[numId] = s.lastLocation;
                            vehMap[String(numId)] = s.lastLocation;
                            updateVehicleFeatureOnMap(s.lastLocation);
                        }
                    });
                    activeSimulationsRef.current = simMap;
                    setActiveSimulations(simMap);
                    setActiveVehicles(vehMap);
                }
            });
        });

        // 1. Anlık Araç Konumu Dinleyicisi
        const unsubLocation = simulationHubService.onVehicleLocation((loc) => {
            if (!loc || !loc.routeId) return;
            const rId = Number(loc.routeId);

            // Simülasyon çalışıyorsa durdurulmuşlar listesinden kesinlikle çıkar
            const isActive = activeSimulationsRef.current[rId]?.isRunning || activeSimulationsRef.current[String(rId)]?.isRunning;
            if (isActive) {
                unmarkRouteAsStopped(rId);
            } else if (stoppedSimRoutesRef.current.has(rId) || stoppedSimRoutesRef.current.has(String(rId))) {
                removeVehicleFeatureFromMap(rId);
                return;
            }

            setActiveVehicles((prev) => ({ ...prev, [loc.routeId]: loc, [rId]: loc }));
            setActiveSimulations((prev) => {
                const currentPaused = prev[rId]?.isPaused ?? prev[loc.routeId]?.isPaused ?? Boolean(loc.isPaused);
                const updated = {
                    routeId: rId,
                    routeName: loc.routeName,
                    routeColor: loc.routeColor,
                    isRunning: !loc.isCompleted,
                    isPaused: currentPaused,
                    lastLocation: loc
                };
                const next = {
                    ...prev,
                    [loc.routeId]: updated,
                    [rId]: updated,
                    [String(rId)]: updated
                };
                activeSimulationsRef.current = next;
                return next;
            });

            // Harita üzerindeki araç simgesini pürüzsüz 60 FPS süzülme ile hareket ettir ve döndür
            updateVehicleFeatureOnMap(loc);

            // Pop-up açıksa tamamlanma yüzdesini ve durakları anlık güncelle
            setSelectedVehicleInfo((curr) => {
                if (curr && Number(curr.routeId) === rId) {
                    return loc;
                }
                return curr;
            });
        });

        // 2. Simülasyon Başlatıldı Bildirimi
        const unsubStarted = simulationHubService.onSimulationStarted((status) => {
            if (!status || !status.routeId) return;
            const rId = Number(status.routeId);
            unmarkRouteAsStopped(rId);
            unmarkRouteAsStopped(status.routeId);
            unmarkRouteAsStopped(String(rId));

            const cleanStatus = { ...status, isRunning: true, isPaused: false };
            setActiveSimulations((prev) => {
                const next = {
                    ...prev,
                    [rId]: cleanStatus,
                    [status.routeId]: cleanStatus,
                    [String(rId)]: cleanStatus
                };
                activeSimulationsRef.current = next;
                return next;
            });

            if (status.lastLocation) {
                setActiveVehicles((prev) => ({
                    ...prev,
                    [rId]: status.lastLocation,
                    [status.routeId]: status.lastLocation,
                    [String(rId)]: status.lastLocation
                }));
                updateVehicleFeatureOnMap(status.lastLocation);
            }

            // Sadece simülasyonu kendimiz başlatmadıysak (dışarıdan başka kullanıcı başlattıysa) bildirim göster
            if (!localStartingSimRoutesRef.current.has(status.routeId) && !localStartingSimRoutesRef.current.has(rId)) {
                showAppToast({
                    severity: 'info',
                    summary: 'Canlı Simülasyon Başladı',
                    detail: `${status.routeName} güzergahında araç hareketi başlatıldı.`,
                    life: 3000
                });
            }
        });

        // 3. Simülasyon Durduruldu / İptal Edildi Bildirimi
        const unsubStopped = simulationHubService.onSimulationStopped((data) => {
            const rawId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (!rawId && rawId !== 0) return;
            const rId = Number(rawId);

            // Eğer bu hat şu anda yerel olarak yeniden başlatıldıysa/çalışıyorsa gecikmeli gelen eski durdurma paketini yoksay!
            const isCurrentlyActive = activeSimulationsRef.current[rId]?.isRunning || activeSimulationsRef.current[String(rId)]?.isRunning;
            if (isCurrentlyActive) {
                return;
            }

            markRouteAsStopped(rId);
            removeVehicleFeatureFromMap(rId);

            setActiveSimulations((prev) => {
                const copy = { ...prev };
                delete copy[rId];
                delete copy[rawId];
                delete copy[String(rId)];
                activeSimulationsRef.current = copy;
                return copy;
            });
            setActiveVehicles((prev) => {
                const copy = { ...prev };
                delete copy[rId];
                delete copy[rawId];
                delete copy[String(rId)];
                return copy;
            });
            if (Number(followingRouteIdRef.current) === rId || String(followingRouteIdRef.current) === String(rId)) {
                setFollowingRouteId(null);
                followingRouteIdRef.current = null;
            }
            setSelectedVehicleInfo((curr) => (Number(curr?.routeId) === rId ? null : curr));

            try {
                if (simulationSourceRef.current) {
                    simulationSourceRef.current.changed();
                }
                mapRef.current?.render();
            } catch (e) { }
        });

        // 4. Simülasyon Durum Değişikliği (StateChanged) Dinleyicisi
        const unsubStateChanged = simulationHubService.onSimulationStateChanged((data) => {
            if (!data || !data.routeId) return;
            const rId = Number(data.routeId);
            if (data.isRunning) {
                unmarkRouteAsStopped(rId);
                unmarkRouteAsStopped(data.routeId);
                unmarkRouteAsStopped(String(rId));
                setActiveSimulations((prev) => {
                    const currentPaused = prev[rId]?.isPaused ?? false;
                    const next = {
                        ...prev,
                        [rId]: { ...(prev[rId] || {}), isRunning: true, isPaused: currentPaused },
                        [data.routeId]: { ...(prev[data.routeId] || {}), isRunning: true, isPaused: currentPaused },
                        [String(rId)]: { ...(prev[rId] || {}), isRunning: true, isPaused: currentPaused }
                    };
                    activeSimulationsRef.current = next;
                    return next;
                });
            } else {
                // Eğer yerel olarak yeniden başlatıldıysa gecikmeli paketi yoksay
                const isCurrentlyActive = activeSimulationsRef.current[rId]?.isRunning || activeSimulationsRef.current[String(rId)]?.isRunning;
                if (isCurrentlyActive) return;

                markRouteAsStopped(rId);
                removeVehicleFeatureFromMap(rId);
                setActiveSimulations((prev) => {
                    const copy = { ...prev };
                    delete copy[rId];
                    delete copy[data.routeId];
                    delete copy[String(rId)];
                    activeSimulationsRef.current = copy;
                    return copy;
                });
                setActiveVehicles((prev) => {
                    const copy = { ...prev };
                    delete copy[rId];
                    delete copy[data.routeId];
                    delete copy[String(rId)];
                    return copy;
                });
                if (Number(followingRouteIdRef.current) === rId || String(followingRouteIdRef.current) === String(rId)) {
                    setFollowingRouteId(null);
                    followingRouteIdRef.current = null;
                }
                setSelectedVehicleInfo((curr) => (Number(curr?.routeId) === rId ? null : curr));
                try {
                    simulationSourceRef.current?.changed();
                    mapRef.current?.render();
                } catch (e) { }
            }
        });

        // 5. Simülasyon Duraklatıldı Bildirimi
        const unsubPaused = simulationHubService.onSimulationPaused((data) => {
            const rawId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (!rawId && rawId !== 0) return;
            const rId = Number(rawId);
            // Eğer bu hat durdurulduysa veya iptal edildiyse gecikmeli paketi kesinlikle yoksay
            if (stoppedSimRoutesRef.current.has(rId) || stoppedSimRoutesRef.current.has(rawId) || stoppedSimRoutesRef.current.has(String(rId))) {
                return;
            }
            setActiveSimulations((prev) => {
                if (!prev[rId] && !prev[rawId] && !prev[String(rId)]) {
                    return prev;
                }
                const next = {
                    ...prev,
                    [rId]: { ...(prev[rId] || {}), isPaused: true },
                    [rawId]: { ...(prev[rawId] || {}), isPaused: true },
                    [String(rId)]: { ...(prev[String(rId)] || {}), isPaused: true }
                };
                activeSimulationsRef.current = next;
                return next;
            });
            setActiveVehicles((prev) => {
                if (!prev[rId] && !prev[rawId] && !prev[String(rId)]) {
                    return prev;
                }
                return {
                    ...prev,
                    [rId]: { ...(prev[rId] || {}), isPaused: true },
                    [rawId]: { ...(prev[rawId] || {}), isPaused: true },
                    [String(rId)]: { ...(prev[String(rId)] || {}), isPaused: true }
                };
            });
            setSelectedVehicleInfo((curr) => (Number(curr?.routeId) === rId ? { ...curr, isPaused: true } : curr));
        });

        // 6. Simülasyon Devam Ettirildi Bildirimi
        const unsubResumed = simulationHubService.onSimulationResumed((data) => {
            const rawId = typeof data === 'object' ? (data?.routeId ?? data?.RouteId) : data;
            if (!rawId && rawId !== 0) return;
            const rId = Number(rawId);
            // Eğer bu hat durdurulduysa veya iptal edildiyse gecikmeli paketi kesinlikle yoksay
            if (stoppedSimRoutesRef.current.has(rId) || stoppedSimRoutesRef.current.has(rawId) || stoppedSimRoutesRef.current.has(String(rId))) {
                return;
            }
            setActiveSimulations((prev) => {
                if (!prev[rId] && !prev[rawId] && !prev[String(rId)]) {
                    return prev;
                }
                const next = {
                    ...prev,
                    [rId]: { ...(prev[rId] || {}), isPaused: false },
                    [rawId]: { ...(prev[rawId] || {}), isPaused: false },
                    [String(rId)]: { ...(prev[String(rId)] || {}), isPaused: false }
                };
                activeSimulationsRef.current = next;
                return next;
            });
            setActiveVehicles((prev) => {
                if (!prev[rId] && !prev[rawId] && !prev[String(rId)]) {
                    return prev;
                }
                return {
                    ...prev,
                    [rId]: { ...(prev[rId] || {}), isPaused: false },
                    [rawId]: { ...(prev[rawId] || {}), isPaused: false },
                    [String(rId)]: { ...(prev[String(rId)] || {}), isPaused: false }
                };
            });
            setSelectedVehicleInfo((curr) => (Number(curr?.routeId) === rId ? { ...curr, isPaused: false } : curr));
        });

        // 7. Simülasyon Sefer Tamamlandı (Döngüsel hat çalıştığı için her turda bildirim yığılması engellendi)
        const unsubCompleted = simulationHubService.onSimulationCompleted(() => {
            // Sessiz kesintisiz tur geçişi
        });

        return () => {
            unsubLocation();
            unsubStarted();
            unsubPaused();
            unsubResumed();
            unsubStopped();
            unsubStateChanged();
            unsubCompleted();
        };
    }, [token]);

    // Simülasyon Başlatma (Admin Paneliyle Birebir Aynı Mantık)
    const handleStartSimulation = async (routeId, e) => {
        e?.stopPropagation?.();
        const numId = Number(routeId);
        if (isNaN(numId)) return;

        try {
            // Durdurulmuşlar listesinden temizle ki haritada araç engellenmesin
            try {
                const raw = sessionStorage.getItem('stopped_sim_routes');
                if (raw) {
                    const set = new Set(JSON.parse(raw));
                    set.delete(numId);
                    set.delete(routeId);
                    set.delete(String(numId));
                    set.delete(String(routeId));
                    sessionStorage.setItem('stopped_sim_routes', JSON.stringify(Array.from(set)));
                }
            } catch (_) { }

            unmarkRouteAsStopped(numId);
            unmarkRouteAsStopped(routeId);
            unmarkRouteAsStopped(String(numId));
            removeVehicleFeatureFromMap(numId);

            setSimLoadingId(routeId);
            setIsSimLoading(true);

            // Anında yerel simülasyon durumunu aktif yap
            const currentRoute = routes.find(r => r.id === numId) || selectedRouteInfo;
            const initialStatus = {
                routeId: numId,
                routeName: currentRoute?.name || selectedRouteInfo?.name || 'Güzergah',
                routeColor: currentRoute?.color || selectedRouteInfo?.color || '#3b82f6',
                isRunning: true,
                isPaused: false
            };

            setActiveSimulations((prev) => {
                const next = {
                    ...prev,
                    [numId]: initialStatus,
                    [routeId]: initialStatus,
                    [String(numId)]: initialStatus
                };
                activeSimulationsRef.current = next;
                return next;
            });

            const currentToken = token || localStorage.getItem('jwt_token');
            const res = await simulationHubService.startSimulation(routeId, currentToken);
            const statusObj = res?.status || initialStatus;
            const clean = { ...statusObj, isRunning: true, isPaused: false };

            setActiveSimulations((prev) => {
                const next = {
                    ...prev,
                    [numId]: clean,
                    [routeId]: clean,
                    [String(numId)]: clean
                };
                activeSimulationsRef.current = next;
                return next;
            });

            if (statusObj.lastLocation) {
                setActiveVehicles((prev) => ({
                    ...prev,
                    [numId]: statusObj.lastLocation,
                    [routeId]: statusObj.lastLocation,
                    [String(numId)]: statusObj.lastLocation
                }));
                updateVehicleFeatureOnMap(statusObj.lastLocation);
            }

            showAppToast({
                severity: 'success',
                summary: 'Simülasyon Başlatıldı',
                detail: res?.message || 'Canlı araç simülasyonu başarıyla başlatıldı!',
                life: 3000
            });

            handleFollowVehicle(numId, false);
        } catch (err) {
            setActiveSimulations((prev) => {
                const next = { ...prev };
                delete next[numId];
                delete next[routeId];
                delete next[String(numId)];
                activeSimulationsRef.current = next;
                return next;
            });
            showAppToast({
                severity: 'error',
                summary: 'Simülasyon Hatası',
                detail: err.message || 'Simülasyon başlatılamadı.',
                life: 4000
            });
        } finally {
            setSimLoadingId(null);
            setIsSimLoading(false);
        }
    };

    // Simülasyon Duraklatma (Admin Paneliyle Birebir Aynı Mantık)
    const handlePauseSimulation = async (routeId, e) => {
        e?.stopPropagation?.();
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            setIsSimLoading(true);

            setActiveSimulations((prev) => {
                const current = prev[numId] || prev[routeId] || prev[String(numId)] || {};
                const updated = { ...current, isPaused: true, isRunning: true };
                const next = {
                    ...prev,
                    [numId]: updated,
                    [routeId]: updated,
                    [String(numId)]: updated
                };
                activeSimulationsRef.current = next;
                return next;
            });

            const currentToken = token || localStorage.getItem('jwt_token');
            await simulationHubService.pauseSimulation(routeId, currentToken);

            showAppToast({
                severity: 'info',
                summary: 'Simülasyon Duraklatıldı',
                detail: 'Araç hareketi duraklatıldı.',
                life: 2500
            });
        } catch (err) {
            showAppToast({
                severity: 'error',
                summary: 'Duraklatma Hatası',
                detail: err.message || 'Simülasyon duraklatılamadı.',
                life: 3500
            });
        } finally {
            setSimLoadingId(null);
            setIsSimLoading(false);
        }
    };

    // Simülasyon Devam Ettirme (Admin Paneliyle Birebir Aynı Mantık)
    const handleResumeSimulation = async (routeId, e) => {
        e?.stopPropagation?.();
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            setIsSimLoading(true);

            setActiveSimulations((prev) => {
                const current = prev[numId] || prev[routeId] || prev[String(numId)] || {};
                const updated = { ...current, isPaused: false, isRunning: true };
                const next = {
                    ...prev,
                    [numId]: updated,
                    [routeId]: updated,
                    [String(numId)]: updated
                };
                activeSimulationsRef.current = next;
                return next;
            });

            const currentToken = token || localStorage.getItem('jwt_token');
            await simulationHubService.resumeSimulation(routeId, currentToken);

            showAppToast({
                severity: 'success',
                summary: 'Simülasyon Devam Ediyor',
                detail: 'Araç hareketi devam ettiriliyor.',
                life: 2500
            });
        } catch (err) {
            showAppToast({
                severity: 'error',
                summary: 'Devam Hatası',
                detail: err.message || 'Simülasyon devam ettirilemedi.',
                life: 3500
            });
        } finally {
            setSimLoadingId(null);
            setIsSimLoading(false);
        }
    };

    // Simülasyon İptal Etme / Kapatma (Admin Paneliyle Birebir Aynı Mantık)
    const handleStopSimulation = async (routeId, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        const numId = Number(routeId);
        try {
            setSimLoadingId(routeId);
            setIsSimLoading(false);

            markRouteAsStopped(numId);
            markRouteAsStopped(routeId);
            removeVehicleFeatureFromMap(numId);

            setActiveSimulations((prev) => {
                const next = { ...prev };
                delete next[routeId];
                delete next[numId];
                delete next[String(routeId)];
                delete next[String(numId)];
                activeSimulationsRef.current = next;
                return next;
            });

            setActiveVehicles((prev) => {
                const next = { ...prev };
                delete next[routeId];
                delete next[numId];
                delete next[String(routeId)];
                delete next[String(numId)];
                return next;
            });

            if (numId != null && (Number(followingRouteIdRef.current) === numId || String(followingRouteIdRef.current) === String(numId))) {
                setFollowingRouteId(null);
                followingRouteIdRef.current = null;
            }
            setSelectedVehicleInfo(null);
            handleUnfollowVehicle(false);

            const currentToken = token || localStorage.getItem('jwt_token');
            await simulationHubService.stopSimulation(numId, currentToken);

            showAppToast({
                severity: 'info',
                summary: lang === 'tr' ? 'Simülasyon Durduruldu' : 'Simulation Stopped',
                detail: lang === 'tr' ? 'Simülasyon sonlandırıldı.' : 'Simulation has ended.',
                life: 1200
            });
        } catch (err) {
            showAppToast({
                severity: 'error',
                summary: 'İptal Hatası',
                detail: err.message || 'Simülasyon işlemi başarısız oldu.',
                life: 3500
            });
        } finally {
            setSimLoadingId(null);
            setIsSimLoading(false);
        }
    };

    // Haritada Canlı Araç Takibi Başlatma
    const handleFollowVehicle = async (routeId, showFeedback = true) => {
        const numId = Number(routeId);
        setFollowingRouteId(numId);
        followingRouteIdRef.current = numId;
        await simulationHubService.joinRoute(numId);

        // Varsa mevcut araca anında kamera odakla
        const loc = activeVehicles[numId] || activeVehicles[String(numId)];
        if (loc && mapRef.current) {
            mapRef.current.getView().animate({
                center: fromLonLat([loc.longitude, loc.latitude]),
                zoom: 16,
                duration: 700
            });
        }

        if (showFeedback) {
            showAppToast({
                severity: 'info',
                summary: 'Canlı Takip Başlatıldı',
                detail: 'Kamera aracı canlı olarak takip ediyor.',
                life: 2500
            });
        }
    };

    // Canlı Takibi Bırakma
    const handleUnfollowVehicle = (showFeedback = true) => {
        const prevId = followingRouteIdRef.current || followingRouteId;
        setFollowingRouteId(null);
        followingRouteIdRef.current = null;
        if (prevId != null) {
            simulationHubService.leaveRoute(prevId);
        }
        if (showFeedback) {
            showAppToast({
                severity: 'secondary',
                summary: 'Takip Bırakıldı',
                detail: 'Kamera takibi serbest bırakıldı.',
                life: 2000
            });
        }
    };

    // ==========================================
    // HAT BÜKME & ŞEKİLLENDİRME YÖNETİMİ (MODIFY INTERACTION)
    // ==========================================
    const stopRouteVertexEditing = () => {
        if (routeModifyInteractionRef.current && mapRef.current) {
            try {
                mapRef.current.removeInteraction(routeModifyInteractionRef.current);
            } catch (e) { }
            routeModifyInteractionRef.current = null;
        }
        setIsModifyingRoute(false);
        setModifyingRoute(null);
        setModifiedRouteWkt('');
        setRouteOriginalWkt('');
    };

    const handleStartModifyingRoute = (route) => {
        if (!route || !routeSourceRef.current || !mapRef.current) return;
        stopRouteVertexEditing();
        stopVertexEditing();
        handleCancelDraw();
        setSelectedRouteInfo(null);
        setSelectedStopInfo(null);
        setSelectedPoiInfo(null);
        setSelectedPointInfo(null);

        const features = routeSourceRef.current.getFeatures();
        let targetFeature = features.find(f => f.get('id') === route.id || f.get('routeData')?.id === route.id);

        if (!targetFeature) {
            toastRef.current?.show({
                severity: 'warn',
                summary: 'Hat Çizgisi Bulunamadı',
                detail: 'Harita üzerinde bu hatta ait çizgi nesnesi bulunamadı.',
                life: 3000
            });
            return;
        }

        const wktFormat = new WKT();
        let origWkt = route.wkt;
        if (!origWkt) {
            try {
                origWkt = wktFormat.writeGeometry(targetFeature.getGeometry(), {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } catch (e) { }
        }

        setRouteOriginalWkt(origWkt || '');
        setModifiedRouteWkt(origWkt || '');
        setModifyingRoute(route);
        setIsModifyingRoute(true);

        try {
            const extent = targetFeature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, { duration: 800, maxZoom: 16, padding: [70, 70, 70, 70] });
        } catch (e) { }

        const modify = new Modify({
            features: new Collection([targetFeature])
        });

        modify.on('modifyend', () => {
            try {
                const geom = targetFeature.getGeometry();
                const newWkt = wktFormat.writeGeometry(geom, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                setModifiedRouteWkt(newWkt);
            } catch (err) {
                console.error('Route modify end error:', err);
            }
        });

        mapRef.current.addInteraction(modify);
        routeModifyInteractionRef.current = modify;

        toastRef.current?.show({
            severity: 'info',
            summary: 'Güzergah Bükme Modu Aktif',
            detail: 'Hat çizgisi üzerindeki kırılma noktalarını fareyle sürükleyebilir, çizgiye tıklayarak yeni büküm noktaları ekleyebilirsiniz.',
            life: 5000
        });
    };

    const handleSaveRouteBending = async () => {
        if (!modifyingRoute || !modifiedRouteWkt) return;
        try {
            await transportApi.updateRouteGeometry(modifyingRoute.id, modifiedRouteWkt, token);
            toastRef.current?.show({
                severity: 'success',
                summary: 'Güzergah Kaydedildi',
                detail: `"${modifyingRoute.name}" hattının büküm geometrisi başarıyla güncellendi!`,
                life: 3500
            });
            stopRouteVertexEditing();
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Kaydetme Hatası',
                detail: err.message || 'Güzergah bükümü kaydedilemedi.',
                life: 4000
            });
        }
    };

    const handleResetRouteBending = async () => {
        if (!modifyingRoute) return;
        if (!window.confirm(`"${modifyingRoute.name}" hattının özel bükümünü sıfırlayıp duraklar arası düz çizgiye dönüştürmek istiyor musunuz?`)) return;
        try {
            await transportApi.updateRouteGeometry(modifyingRoute.id, '', token);
            toastRef.current?.show({
                severity: 'info',
                summary: 'Hat Sıfırlandı',
                detail: 'Güzergah geometrisi duraklar arası standart düz çizgiye dönüştürüldü.',
                life: 3000
            });
            stopRouteVertexEditing();
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Hata',
                detail: err.message || 'Sıfırlama başarısız oldu.',
                life: 3500
            });
        }
    };

    const handleCancelRouteBending = () => {
        if (modifyingRoute && routeOriginalWkt && routeSourceRef.current) {
            const features = routeSourceRef.current.getFeatures();
            const targetFeature = features.find(f => f.get('id') === modifyingRoute.id || f.get('routeData')?.id === modifyingRoute.id);
            if (targetFeature) {
                try {
                    const wktFormat = new WKT();
                    const origGeom = wktFormat.readGeometry(routeOriginalWkt, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    targetFeature.setGeometry(origGeom);
                } catch (e) { }
            }
        }
        stopRouteVertexEditing();
        toastRef.current?.show({
            severity: 'warn',
            summary: 'İptal Edildi',
            detail: 'Hat bükme işlemi kaydedilmeden iptal edildi.',
            life: 2500
        });
    };

    // ==========================================
    // KULLANICI PROFİLİ, FAVORİ POI'LER VE YOL TARİFİ (DIRECTIONS)
    // ==========================================
    const loadFavoritePois = async () => {
        if (!token) return;
        try {
            const favs = await userPersonalApi.getFavorites(token);
            if (Array.isArray(favs)) {
                setFavoritePoiIds(new Set(favs.map(f => f.poiId)));
            }
        } catch (e) { }
    };

    useEffect(() => {
        if (token) {
            loadFavoritePois();
        }
    }, [token]);

    const handleToggleFavoritePoi = async (poi) => {
        if (!token || !poi) return;
        try {
            const res = await userPersonalApi.toggleFavorite(poi.id, token);
            setFavoritePoiIds(prev => {
                const next = new Set(prev);
                if (res.isFavorite) next.add(poi.id);
                else next.delete(poi.id);
                return next;
            });
            toastRef.current?.show({
                severity: res.isFavorite ? 'success' : 'info',
                summary: res.isFavorite ? 'Favorilere Eklendi' : 'Favorilerden Çıkarıldı',
                detail: res.message || (res.isFavorite ? `"${poi.name}" favorilerinize eklendi.` : `"${poi.name}" favorilerinizden çıkarıldı.`),
                life: 3000
            });
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Hata',
                detail: err.message || 'Favori işlemi gerçekleştirilemedi.',
                life: 3000
            });
        }
    };

    // Haritada Seçili Ulaşım Moduna Göre Rota Çizgisini ve Tüm Durak Noktalarını (A, B, C...) Çizen Yardımcı
    const renderDirectionsLineOnMap = (wktString, waypoints, mode = 'driving') => {
        if (!directionsSourceRef.current || !wktString) return;
        directionsSourceRef.current.clear();

        const wktReader = new WKT();
        const lineGeom = wktReader.readGeometry(wktString, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        const lineFeature = new Feature({ geometry: lineGeom });
        lineFeature.set('mode', mode);
        lineFeature.setStyle(createDirectionsStyle(lineFeature));

        const features = [lineFeature];

        if (Array.isArray(waypoints)) {
            waypoints.forEach((wp, idx) => {
                if (wp && wp.lon != null && wp.lat != null) {
                    const ptGeom = new Point(fromLonLat([wp.lon, wp.lat]));
                    const ptFeature = new Feature({ geometry: ptGeom });
                    const isStart = idx === 0;
                    const isEnd = idx === waypoints.length - 1;
                    const label = String.fromCharCode(65 + Math.min(idx, 25)); // A, B, C, D...
                    ptFeature.set('pointLabel', label);
                    ptFeature.set('isStartPoint', isStart);
                    ptFeature.set('isEndPoint', isEnd);
                    ptFeature.setStyle(createDirectionsStyle(ptFeature));
                    features.push(ptFeature);
                }
            });
        }

        directionsSourceRef.current.addFeatures(features);

        if (mapRef.current) {
            mapRef.current.getView().fit(lineGeom.getExtent(), {
                padding: [100, 100, 100, 100],
                maxZoom: 16,
                duration: 600
            });
        }
    };

    // Ulaşım Modları Arasında Anında Geçiş (Arabayla, Yürüyerek, Bisikletle)
    const handleSwitchDirectionsMode = (newMode) => {
        const curr = directionsStateRef.current;
        if (!curr.routeData) return;
        const modeData = curr.routeData[newMode] || (newMode === 'driving' ? curr.routeData : null);
        if (!modeData || !modeData.routeWkt) return;

        renderDirectionsLineOnMap(
            modeData.routeWkt,
            curr.waypoints,
            newMode
        );

        setDirectionsState(prev => ({
            ...prev,
            activeMode: newMode
        }));
    };

    // Ulaşım Tercihleri Değişimi (Gemi, Metro, Otobüs, vb.)
    const handleToggleTransitPreference = (prefKey) => {
        setDirectionsState(prev => {
            const nextPrefs = {
                ...prev.transitPreferences,
                [prefKey]: !prev.transitPreferences[prefKey]
            };
            setTimeout(() => {
                const curr = directionsStateRef.current;
                if (curr.waypoints && curr.waypoints.length >= 2) {
                    calculateAndRenderDirectionsRoute(null, null, curr.activeMode, curr.waypoints);
                }
            }, 50);
            return {
                ...prev,
                transitPreferences: nextPrefs
            };
        });
    };

    // 2 veya Daha Fazla Durak Arası Çok Modlu Yol Tarifi Hesaplama Yardımcısı
    const calculateAndRenderDirectionsRoute = async (start, target, preferredMode = null, customWaypoints = null) => {
        let waypoints = customWaypoints;
        if (!waypoints) {
            if (start && target && start.lon != null && target.lon != null) {
                waypoints = [
                    { id: 'start', name: start.name || '1. Konum (Başlangıç)', lon: start.lon, lat: start.lat },
                    { id: 'target', name: target.name || '2. Konum (Hedef)', lon: target.lon, lat: target.lat, poiId: target.poiId || null }
                ];
            } else {
                waypoints = directionsStateRef.current?.waypoints;
            }
        }

        if (!waypoints || waypoints.length < 2) return;

        const modeToUse = preferredMode || directionsStateRef.current?.activeMode || 'driving';
        setDirectionsState(prev => ({
            ...prev,
            isCalculating: true,
            selectingPoint: null,
            activeMode: modeToUse,
            waypoints
        }));

        try {
            const firstWp = waypoints[0];
            const lastWp = waypoints[waypoints.length - 1];

            const payload = {
                startLongitude: firstWp.lon,
                startLatitude: firstWp.lat,
                startPointName: firstWp.name,
                targetLongitude: lastWp.lon,
                targetLatitude: lastWp.lat,
                targetPoiId: lastWp.poiId || null,
                targetPoiName: lastWp.name,
                preferredMode: modeToUse,
                waypoints: waypoints.map(w => ({
                    longitude: w.lon,
                    latitude: w.lat,
                    name: w.name,
                    poiId: w.poiId || null
                }))
            };

            const result = await userPersonalApi.calculateDirections(payload, token);

            // Multimodal Transit Yollar Değerlendirmesi (Gemi/Vapur, Metro, Toplu Taşıma)
            const currentPrefs = directionsStateRef.current?.transitPreferences || { gemi: true, metro: true, otobus: true, tren: true };

            if (currentPrefs.gemi) {
                const gemiRoute = calculateTransitRoute({
                    start: firstWp,
                    target: lastWp,
                    routes,
                    mode: 'gemi',
                    preferences: currentPrefs
                });
                if (gemiRoute) result.gemi = gemiRoute;
            }

            if (currentPrefs.metro || currentPrefs.tren) {
                const metroRoute = calculateTransitRoute({
                    start: firstWp,
                    target: lastWp,
                    routes,
                    mode: 'metro',
                    preferences: currentPrefs
                });
                if (metroRoute) result.metro = metroRoute;
            }

            const generalTransit = calculateTransitRoute({
                start: firstWp,
                target: lastWp,
                routes,
                mode: 'transit',
                preferences: currentPrefs
            });
            if (generalTransit) result.transit = generalTransit;

            const activeOption = result[modeToUse] || result.driving || {
                routeWkt: result.routeWkt,
                distanceKm: result.distanceKm,
                durationMinutes: result.durationMinutes,
                formattedDistance: `${result.distanceKm} km`,
                formattedDuration: formatDuration(result.durationMinutes, lang),
                label: modeToUse === 'walking' ? 'Yürüyerek' : (modeToUse === 'gemi' ? 'Gemi / Vapur' : (modeToUse === 'metro' ? 'Metro' : (modeToUse === 'transit' ? 'Toplu Taşıma' : 'Arabayla')))
            };

            if (activeOption.routeWkt) {
                renderDirectionsLineOnMap(activeOption.routeWkt, waypoints, modeToUse);
            }

            setDirectionsState(prev => ({
                ...prev,
                active: true,
                waypoints,
                startCoord: { lon: firstWp.lon, lat: firstWp.lat },
                startName: firstWp.name,
                targetCoord: { lon: lastWp.lon, lat: lastWp.lat },
                targetName: lastWp.name,
                targetPoiId: lastWp.poiId || null,
                routeData: result,
                activeMode: modeToUse,
                showSteps: false,
                isCalculating: false
            }));

            showAppToast({
                severity: 'success',
                summary: t.routeCalculatedSuccess || 'Yol Tarifi Hazır',
                detail: `${activeOption.label || 'Arabayla'}: ${activeOption.formattedDistance || (activeOption.distanceKm + ' km')} • ~${activeOption.formattedDuration || formatDuration(activeOption.durationMinutes, lang)} (${waypoints.length} durak)`,
                life: 4000
            });
        } catch (err) {
            setDirectionsState(prev => ({ ...prev, isCalculating: false }));
            showAppToast({
                severity: 'error',
                summary: 'Rota Hesaplanamadı',
                detail: err.message || 'OSRM rota hesaplaması başarısız oldu.',
                life: 4000
            });
        }
    };

    // Durakları Sürükle - Bırak (Drag and Drop) ile Sıralama Fonksiyonları
    const handleWaypointDragStart = (e, index) => {
        setDraggedWaypointIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', `${index}`);
        } catch (err) {}
    };

    const handleWaypointDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverWaypointIndex !== index) {
            setDragOverWaypointIndex(index);
        }
    };

    const handleWaypointDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = draggedWaypointIndex;
        setDraggedWaypointIndex(null);
        setDragOverWaypointIndex(null);

        if (dragIndex == null || dragIndex === dropIndex) return;

        const curr = directionsStateRef.current;
        if (!curr.waypoints || curr.waypoints.length < 2) return;

        const newWps = [...curr.waypoints];
        const [draggedItem] = newWps.splice(dragIndex, 1);
        newWps.splice(dropIndex, 0, draggedItem);

        calculateAndRenderDirectionsRoute(null, null, curr.activeMode, newWps);
    };

    const handleWaypointDragEnd = () => {
        setDraggedWaypointIndex(null);
        setDragOverWaypointIndex(null);
    };

    // Durak Sırasını Yukarı Taşı
    const handleMoveWaypointUp = (idx) => {
        const curr = directionsStateRef.current;
        if (!curr.waypoints || idx <= 0) return;
        const newWps = [...curr.waypoints];
        const temp = newWps[idx];
        newWps[idx] = newWps[idx - 1];
        newWps[idx - 1] = temp;
        calculateAndRenderDirectionsRoute(null, null, curr.activeMode, newWps);
    };

    // Durak Sırasını Aşağı Taşı
    const handleMoveWaypointDown = (idx) => {
        const curr = directionsStateRef.current;
        if (!curr.waypoints || idx >= curr.waypoints.length - 1) return;
        const newWps = [...curr.waypoints];
        const temp = newWps[idx];
        newWps[idx] = newWps[idx + 1];
        newWps[idx + 1] = temp;
        calculateAndRenderDirectionsRoute(null, null, curr.activeMode, newWps);
    };

    // Başlangıç ve Hedefi Ters Çevir (Google Maps Reverse)
    const handleReverseWaypoints = () => {
        const curr = directionsStateRef.current;
        if (!curr.waypoints || curr.waypoints.length < 2) return;
        const newWps = [...curr.waypoints].reverse();
        calculateAndRenderDirectionsRoute(null, null, curr.activeMode, newWps);
    };

    // Ara Durak Sil
    const handleRemoveWaypoint = (idx) => {
        const curr = directionsStateRef.current;
        if (!curr.waypoints || curr.waypoints.length <= 2) {
            showAppToast({
                severity: 'warn',
                summary: 'Durak Silinemez',
                detail: 'Yol tarifi için en az 2 konum (başlangıç ve hedef) gereklidir.',
                life: 3000
            });
            return;
        }
        const newWps = curr.waypoints.filter((_, i) => i !== idx);
        calculateAndRenderDirectionsRoute(null, null, curr.activeMode, newWps);
    };

    // Yeni Durak Ekleme Moduna Geç
    const handleStartAddWaypoint = () => {
        setDirectionsState(prev => ({
            ...prev,
            selectingPoint: 'waypoint'
        }));
        showAppToast({
            severity: 'info',
            summary: 'Durak Konumunu Seçin',
            detail: 'Harita üzerinde eklemek istediğiniz durağa tıklayınız.',
            life: 4000
        });
    };

    // Sol paneldeki "Yol Tarifi Al" butonuna basıldığında
    const handleInitiateTwoPointDirections = () => {
        if (directionsSourceRef.current) {
            directionsSourceRef.current.clear();
        }
        setDirectionsState({
            active: true,
            waypoints: [],
            startCoord: null,
            startName: '',
            targetCoord: null,
            targetName: '',
            targetPoiId: null,
            targetPoi: null,
            selectingPoint: 'point1',
            routeData: null,
            activeMode: 'driving',
            showSteps: false,
            isCalculating: false
        });

        toastRef.current?.show({
            severity: 'info',
            summary: '1. Konumu Seçin',
            detail: 'Harita üzerinde yol tarifinin başlayacağı 1. konuma tıklayınız.',
            life: 4000
        });
    };

    // Haritada tıklanarak 1., 2. veya Ara Durak Konumu belirlendiğinde
    const handleSetDirectionsMapPoint = (mode, lon, lat) => {
        const curr = directionsStateRef.current;
        const formattedName = `Konum (${lon.toFixed(4)}, ${lat.toFixed(4)})`;

        if (mode === 'point1') {
            // Eğer hedef (B) zaten belirlenmişse (örn. POI'den başlatılmışsa)
            if (curr.targetCoord && curr.targetCoord.lon != null && curr.targetCoord.lat != null) {
                calculateAndRenderDirectionsRoute(
                    { lon, lat, name: formattedName },
                    { lon: curr.targetCoord.lon, lat: curr.targetCoord.lat, name: curr.targetName, poiId: curr.targetPoiId }
                );
                return;
            }

            // Normal 2-nokta akışı: 1. Noktayı kaydet, geçici pin koy ve 2. noktayı bekle
            setDirectionsState(prev => ({
                ...prev,
                waypoints: [{ id: 'start', name: `1. ${formattedName}`, lon, lat }],
                startCoord: { lon, lat },
                startName: `1. ${formattedName}`,
                selectingPoint: 'point2'
            }));

            if (directionsSourceRef.current) {
                directionsSourceRef.current.clear();
                const startPointGeom = new Point(fromLonLat([lon, lat]));
                const startFeature = new Feature({ geometry: startPointGeom });
                startFeature.set('isStartPoint', true);
                startFeature.set('pointLabel', 'A');
                startFeature.setStyle(createDirectionsStyle(startFeature));
                directionsSourceRef.current.addFeature(startFeature);
            }

            toastRef.current?.show({
                severity: 'info',
                summary: '1. Konum Belirlendi',
                detail: 'Şimdi harita üzerinde 2. Konuma (Hedef) tıklayınız.',
                life: 4000
            });
        } else if (mode === 'point2') {
            // 2. Nokta da seçildi, rotayı anında hesapla
            if (!curr.startCoord) return;
            calculateAndRenderDirectionsRoute(
                { lon: curr.startCoord.lon, lat: curr.startCoord.lat, name: curr.startName },
                { lon, lat, name: `2. ${formattedName}`, poiId: null }
            );
        } else if (mode === 'waypoint') {
            // Ara Durak Eklendi
            const wps = curr.waypoints && curr.waypoints.length >= 2
                ? [...curr.waypoints]
                : [
                    { id: 'start', name: curr.startName || 'Başlangıç', lon: curr.startCoord?.lon, lat: curr.startCoord?.lat },
                    { id: 'target', name: curr.targetName || 'Hedef', lon: curr.targetCoord?.lon, lat: curr.targetCoord?.lat, poiId: curr.targetPoiId }
                ];

            const newWaypoint = {
                id: `wp_${Date.now()}`,
                name: `Ara Durak (${lon.toFixed(4)}, ${lat.toFixed(4)})`,
                lon,
                lat
            };

            // Yeni durağı hedeften hemen önceye yerleştir
            wps.splice(wps.length - 1, 0, newWaypoint);
            calculateAndRenderDirectionsRoute(null, null, curr.activeMode, wps);
        }
    };

    const handleSetDirectionsMapPointRef = useRef(handleSetDirectionsMapPoint);
    handleSetDirectionsMapPointRef.current = handleSetDirectionsMapPoint;

    // POI Kartından Yol Tarifi Al dendiğinde
    const handleStartDirectionsToPoi = (poi) => {
        if (!poi) return;
        setSelectedPoiInfo(null);
        setSelectedStopInfo(null);
        setSelectedRouteInfo(null);
        if (directionsSourceRef.current) directionsSourceRef.current.clear();

        let lon = poi.longitude, lat = poi.latitude;
        if ((lon == null || lat == null) && poi.wkt) {
            try {
                const wktGeom = new WKT().readGeometry(poi.wkt);
                const center = getCenter(wktGeom.getExtent());
                lon = center[0];
                lat = center[1];
            } catch (e) { }
        }

        setDirectionsState({
            active: true,
            waypoints: [],
            startCoord: null,
            startName: '',
            targetCoord: { lon, lat },
            targetName: poi.name,
            targetPoiId: poi.id,
            targetPoi: poi,
            selectingPoint: 'point1',
            routeData: null,
            activeMode: 'driving',
            showSteps: false,
            isCalculating: false
        });

        toastRef.current?.show({
            severity: 'info',
            summary: 'Başlangıç Konumu Seçin',
            detail: `"${poi.name}" hedefine gitmek için haritada başlangıç konumuna tıklayınız.`,
            life: 4000
        });
    };

    const handleClearDirections = () => {
        if (directionsSourceRef.current) {
            directionsSourceRef.current.clear();
        }
        setDirectionsState({
            active: false,
            waypoints: [],
            startCoord: null,
            startName: '',
            targetCoord: null,
            targetName: '',
            targetPoiId: null,
            targetPoi: null,
            selectingPoint: null,
            routeData: null,
            activeMode: 'driving',
            showSteps: false,
            isCalculating: false
        });
    };

    const handleSaveDirectionRoute = async () => {
        if (!directionsState.routeData) return;
        try {
            setIsSavingRoute(true);
            const currentOpt = (directionsState.routeData && directionsState.routeData[directionsState.activeMode]) || directionsState.routeData;
            const modeLabel = currentOpt.label || (directionsState.activeMode === 'walking' ? 'Yürüyerek' : (directionsState.activeMode === 'cycling' ? 'Bisikletle' : 'Arabayla'));
            const defaultColor = directionsState.activeMode === 'walking' ? '#10b981' : (directionsState.activeMode === 'cycling' ? '#8b5cf6' : '#2563eb');

            const payload = {
                title: saveRouteTitle.trim() || `${directionsState.startName} → ${directionsState.targetName || directionsState.targetPoi?.name || 'Hedef'} (${modeLabel})`,
                description: saveRouteDescription.trim() || (currentOpt.summary || ''),
                startPointName: directionsState.startName,
                startWkt: directionsState.routeData.startWkt,
                targetPoiId: directionsState.targetPoi?.id,
                targetPoiName: directionsState.targetPoi?.name,
                targetWkt: directionsState.routeData.targetWkt,
                routeWkt: currentOpt.routeWkt || directionsState.routeData.routeWkt,
                distanceMeters: currentOpt.distanceMeters || directionsState.routeData.distanceMeters,
                durationSeconds: currentOpt.durationSeconds || directionsState.routeData.durationSeconds,
                color: defaultColor
            };

            await userPersonalApi.saveRoute(payload, token);
            setSaveRouteModalOpen(false);
            setSaveRouteTitle('');
            setSaveRouteDescription('');
            toastRef.current?.show({
                severity: 'success',
                summary: 'Güzergah Kaydedildi',
                detail: 'Güzergah profilinize kaydedildi. Profilinizdeki "Kaydedilen Güzergahlar" sekmesinden erişebilirsiniz.',
                life: 4000
            });
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Kayıt Başarısız',
                detail: err.message || 'Güzergah kaydedilemedi.',
                life: 4000
            });
        } finally {
            setIsSavingRoute(false);
        }
    };

    const handleLoadSavedRouteOnMap = (savedRoute) => {
        if (!savedRoute || !savedRoute.routeWkt) return;
        if (directionsSourceRef.current) {
            directionsSourceRef.current.clear();
            const wktReader = new WKT();
            const lineGeom = wktReader.readGeometry(savedRoute.routeWkt, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            const lineFeature = new Feature({ geometry: lineGeom });
            lineFeature.setStyle(createDirectionsStyle(lineFeature));
            directionsSourceRef.current.addFeature(lineFeature);

            if (mapRef.current) {
                mapRef.current.getView().fit(lineGeom.getExtent(), {
                    padding: [100, 100, 100, 100],
                    maxZoom: 16,
                    duration: 700
                });
            }

            setDirectionsState({
                active: true,
                targetPoi: { id: savedRoute.targetPoiId, name: savedRoute.targetPoiName },
                startName: savedRoute.startPointName,
                selectingStartOnMap: false,
                routeData: savedRoute,
                isCalculating: false
            });

            showAppToast({
                severity: 'info',
                summary: savedRoute.title,
                detail: `Kayıtlı Güzergah Yüklendi (${savedRoute.distanceKm} km, ~${formatDuration(savedRoute.durationMinutes, lang)})`,
                life: 4000
            });
        }
    };

    const handleFocusPoiOnMap = (poi) => {
        if (!poi) return;
        if (poi.latitude != null && poi.longitude != null && mapRef.current) {
            mapRef.current.getView().animate({
                center: fromLonLat([poi.longitude, poi.latitude]),
                zoom: 17,
                duration: 800
            });
            setSelectedPoiInfo(poi);
            setSelectedStopInfo(null);
            setSelectedRouteInfo(null);
            setSelectedBoundaryInfo(null);
            setSelectedPointInfo(null);
        }
    };

    // ==========================================
    // DURAK KONUMUNU HARİTADA SÜRÜKLEME & TAŞIMA YÖNETİMİ
    // ==========================================
    const stopStopVertexEditing = () => {
        if (stopModifyInteractionRef.current && mapRef.current) {
            try {
                mapRef.current.removeInteraction(stopModifyInteractionRef.current);
            } catch (e) { }
            stopModifyInteractionRef.current = null;
        }
        if (stopGeomChangeKeyRef.current) {
            try {
                unByKey(stopGeomChangeKeyRef.current);
            } catch (e) { }
            stopGeomChangeKeyRef.current = null;
        }
        modifyingStopRouteFeatureRef.current = null;
        modifyingStopVertexIndexRef.current = -1;
        modifyingStopRouteOrigCoordsRef.current = null;
        setIsModifyingStop(false);
        setModifyingStop(null);
        setModifiedStopCoords({ lat: null, lon: null, wkt: '' });
        setStopOriginalWkt('');
    };

    const handleStartModifyingStop = (stop) => {
        if (!stop || !stopSourceRef.current || !mapRef.current) return;
        stopStopVertexEditing();
        stopRouteVertexEditing();
        stopVertexEditing();
        handleCancelDraw();
        setSelectedStopInfo(null);
        setSelectedRouteInfo(null);
        setSelectedPoiInfo(null);
        setSelectedPointInfo(null);

        const features = stopSourceRef.current.getFeatures();
        let targetFeature = features.find(f => f.get('id') === stop.id || f.get('stopData')?.id === stop.id);

        if (!targetFeature) {
            toastRef.current?.show({
                severity: 'warn',
                summary: 'Durak Bulunamadı',
                detail: 'Harita üzerinde bu durağa ait nesne bulunamadı.',
                life: 3000
            });
            return;
        }

        const wktFormat = new WKT();
        let origWkt = stop.wkt;
        if (!origWkt) {
            try {
                origWkt = wktFormat.writeGeometry(targetFeature.getGeometry(), {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } catch (e) { }
        }

        const currentCoords = toLonLat(targetFeature.getGeometry().getCoordinates());
        const curLon = parseFloat(currentCoords[0].toFixed(6));
        const curLat = parseFloat(currentCoords[1].toFixed(6));

        setStopOriginalWkt(origWkt || `POINT(${curLon} ${curLat})`);
        setModifiedStopCoords({ lat: curLat, lon: curLon, wkt: origWkt || `POINT(${curLon} ${curLat})` });
        setModifyingStop(stop);
        setIsModifyingStop(true);

        // Bağlı olduğu güzergah çizgi nesnesini bul ve durak ile bağlantılı vertex indeksini eşleştir
        const routeFeatures = routeSourceRef.current ? routeSourceRef.current.getFeatures() : [];
        const targetRouteFeature = routeFeatures.find(f => f.get('id') === stop.routeId || f.get('routeData')?.id === stop.routeId);
        
        let closestVertexIndex = -1;
        let origRouteCoords = null;

        if (targetRouteFeature && targetRouteFeature.getGeometry()) {
            origRouteCoords = targetRouteFeature.getGeometry().getCoordinates();
            const stopCoord = targetFeature.getGeometry().getCoordinates();
            let minDist = Infinity;
            origRouteCoords.forEach((coord, idx) => {
                const dx = coord[0] - stopCoord[0];
                const dy = coord[1] - stopCoord[1];
                const dist = dx * dx + dy * dy;
                if (dist < minDist) {
                    minDist = dist;
                    closestVertexIndex = idx;
                }
            });
        }

        modifyingStopRouteFeatureRef.current = targetRouteFeature;
        modifyingStopVertexIndexRef.current = closestVertexIndex;
        modifyingStopRouteOrigCoordsRef.current = origRouteCoords ? JSON.parse(JSON.stringify(origRouteCoords)) : null;

        // Canlı Harita Sürükleme Esnasında Hattı Anında Durağa Bağlı Tutma (Real-time Rubber-banding)
        const geomListener = targetFeature.getGeometry().on('change', () => {
            try {
                const currentCoord = targetFeature.getGeometry().getCoordinates();
                if (modifyingStopRouteFeatureRef.current && modifyingStopRouteFeatureRef.current.getGeometry()) {
                    const rGeom = modifyingStopRouteFeatureRef.current.getGeometry();
                    const coords = rGeom.getCoordinates();
                    const vIdx = modifyingStopVertexIndexRef.current;
                    if (vIdx >= 0 && vIdx < coords.length) {
                        coords[vIdx] = currentCoord;
                        rGeom.setCoordinates(coords);
                    }
                }
            } catch (e) { }
        });
        stopGeomChangeKeyRef.current = geomListener;

        try {
            mapRef.current.getView().animate({
                center: targetFeature.getGeometry().getCoordinates(),
                zoom: Math.max(mapRef.current.getView().getZoom(), 16),
                duration: 500
            });
        } catch (e) { }

        const modify = new Modify({
            features: new Collection([targetFeature]),
            pixelTolerance: 14
        });

        modify.on('modifyend', () => {
            try {
                const geom = targetFeature.getGeometry();
                const coordsDeg = toLonLat(geom.getCoordinates());
                const pLon = parseFloat(coordsDeg[0].toFixed(6));
                const pLat = parseFloat(coordsDeg[1].toFixed(6));
                const newWkt = `POINT(${pLon} ${pLat})`;

                setModifiedStopCoords({ lat: pLat, lon: pLon, wkt: newWkt });

                // Hattı da yeni konuma sabitle
                if (modifyingStopRouteFeatureRef.current && modifyingStopRouteFeatureRef.current.getGeometry()) {
                    const rGeom = modifyingStopRouteFeatureRef.current.getGeometry();
                    const coords = rGeom.getCoordinates();
                    const vIdx = modifyingStopVertexIndexRef.current;
                    if (vIdx >= 0 && vIdx < coords.length) {
                        coords[vIdx] = geom.getCoordinates();
                        rGeom.setCoordinates(coords);
                    }
                }
            } catch (err) {
                console.error('Stop modify end error:', err);
            }
        });

        mapRef.current.addInteraction(modify);
        stopModifyInteractionRef.current = modify;

        toastRef.current?.show({
            severity: 'info',
            summary: 'Durak Taşıma Modu Aktif',
            detail: 'Durağı fare ile tutup istediğiniz yeni konuma sürükleyin. Güzergah çizgisi durağa bağlı kalacaktır.',
            life: 4500
        });
    };

    const handleSaveStopRepositioning = async () => {
        if (!modifyingStop || !modifiedStopCoords.wkt) return;
        try {
            const currentRouteIds = modifyingStop.routeIds && modifyingStop.routeIds.length > 0
                ? modifyingStop.routeIds
                : (modifyingStop.routes ? modifyingStop.routes.map(r => r.id) : (modifyingStop.routeId ? [modifyingStop.routeId] : []));

            // 1. Durağın Yeni Konumunu Kaydet (Mevcut tüm hat bağlantılarını koruyarak)
            await transportApi.updateStop(modifyingStop.id, {
                name: modifyingStop.name,
                stopCode: modifyingStop.stopCode,
                stopClass: modifyingStop.stopClass,
                routeId: modifyingStop.routeId,
                routeIds: currentRouteIds,
                description: modifyingStop.description,
                orderIndex: modifyingStop.orderIndex,
                wkt: modifiedStopCoords.wkt
            }, token);

            // 2. Eğer Güzergahın Geometrisi Varsa Hattın da Güncel WKT'sini Kaydet
            if (modifyingStopRouteFeatureRef.current && modifyingStopRouteFeatureRef.current.getGeometry()) {
                try {
                    const wktFormat = new WKT();
                    const updatedRouteWkt = wktFormat.writeGeometry(modifyingStopRouteFeatureRef.current.getGeometry(), {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    if (updatedRouteWkt && modifyingStop.routeId) {
                        await transportApi.updateRouteGeometry(modifyingStop.routeId, updatedRouteWkt, token);
                    }
                } catch (e) { }
            }

            // 3. Bağlı olan diğer tüm güzergahların hat çizgilerini de yeni konuma göre güncelle
            for (const rId of currentRouteIds) {
                if (rId !== modifyingStop.routeId) {
                    try {
                        await transportApi.generateOsrmRoute(rId, token);
                    } catch (e) { }
                }
            }

            toastRef.current?.show({
                severity: 'success',
                summary: 'Durak ve Hat Güncellendi',
                detail: `"${modifyingStop.name}" durağının yeni konumu ve tüm bağlı hat geometrileri başarıyla kaydedildi!`,
                life: 3500
            });

            stopStopVertexEditing();
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Kayıt Hatası',
                detail: err.message || 'Durak konumu güncellenemedi.',
                life: 4000
            });
        }
    };

    const handleCancelStopRepositioning = () => {
        if (modifyingStop && stopOriginalWkt && stopSourceRef.current) {
            const features = stopSourceRef.current.getFeatures();
            const targetFeature = features.find(f => f.get('id') === modifyingStop.id || f.get('stopData')?.id === modifyingStop.id);
            if (targetFeature) {
                try {
                    const wktFormat = new WKT();
                    const origGeom = wktFormat.readGeometry(stopOriginalWkt, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    targetFeature.setGeometry(origGeom);
                } catch (e) { }
            }
        }
        // Hattı orijinal geometrisine geri al
        if (modifyingStopRouteFeatureRef.current && modifyingStopRouteOrigCoordsRef.current) {
            try {
                modifyingStopRouteFeatureRef.current.getGeometry()?.setCoordinates(modifyingStopRouteOrigCoordsRef.current);
            } catch (e) { }
        }

        stopStopVertexEditing();
        toastRef.current?.show({
            severity: 'warn',
            summary: 'İptal Edildi',
            detail: 'Durak taşıma işlemi iptal edildi.',
            life: 2500
        });
    };

    // YENİ DURAK KAYDETME
    const handleSaveNewStop = async (e) => {
        e.preventDefault();
        if (!newStopForm.name.trim() || !draftStopCoords.wkt) {
            toastRef.current?.show({
                severity: 'warn',
                summary: 'Eksik Bilgi',
                detail: 'Lütfen durak ismini giriniz.',
                life: 3000
            });
            return;
        }

        setIsSubmittingStop(true);
        try {
            const created = await transportApi.createStop({
                name: newStopForm.name.trim(),
                stopClass: newStopForm.stopClass || 'otobus',
                routeId: newStopForm.routeId ? parseInt(newStopForm.routeId, 10) : null,
                description: newStopForm.description?.trim() || null,
                wkt: draftStopCoords.wkt
            }, token);

            toastRef.current?.show({
                severity: 'success',
                summary: 'Durak Eklendi',
                detail: `"${created.name}" durağı başarıyla eklendi!`,
                life: 3500
            });

            setShowAddStopModal(false);
            setNewStopForm({ name: '', stopClass: 'otobus', routeId: '', description: '' });
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Kayıt Hatası',
                detail: err.message || 'Durak eklenirken bir hata oluştu.',
                life: 4000
            });
        } finally {
            setIsSubmittingStop(false);
        }
    };

    // HARİTADAN DURAK SİLME
    const handleDeleteStopFromMap = async (stopId, stopName) => {
        if (!window.confirm(`"${stopName}" durağını silmek istediğinize emin misiniz?`)) return;
        try {
            await transportApi.deleteStop(stopId, token);
            toastRef.current?.show({
                severity: 'info',
                summary: 'Durak Silindi',
                detail: `"${stopName}" durağı güzergahtan kaldırıldı.`,
                life: 3000
            });
            setSelectedStopInfo(null);
            await fetchRoutesAndStops();
        } catch (err) {
            toastRef.current?.show({
                severity: 'error',
                summary: 'Silme Hatası',
                detail: err.message || 'Durak silinemedi.',
                life: 3500
            });
        }
    };

    const clearUserData = () => {
        stopVertexEditing();
        setSavedPlaces([]);
        setSavedDrawings([]);
        setPois([]);
        setRoutes([]);
        setStops([]);
        setSelectedPoiInfo(null);
        setSelectedPointInfo(null);
        setSelectedStopInfo(null);
        setSelectedTypeFilter('ALL');
        setSelectedEditorFilter('ALL');
        if (savedPlacesSourceRef.current) savedPlacesSourceRef.current.clear();
        if (drawingsSourceRef.current) drawingsSourceRef.current.clear();
        if (poiSourceRef.current) poiSourceRef.current.clear();
        if (routeSourceRef.current) routeSourceRef.current.clear();
        if (stopSourceRef.current) stopSourceRef.current.clear();
        if (vectorSourceRef.current) vectorSourceRef.current.clear();
        if (mapRef.current) {
            try {
                mapRef.current.setTarget(null);
            } catch (e) { }
            mapRef.current = null;
        }
    };

    // Giriş yapıldığında tüm çizimleri, POI'leri ve Güzergahları yükle
    useEffect(() => {
        if (token) {
            clearUserData();
            fetchDrawings();
            fetchPois();
            fetchRoutesAndStops();
        } else {
            clearUserData();
        }
    }, [token]);

    // LOGIN İŞLEMİ
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('http://localhost:5041/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const expirationTimestamp = Date.now() + TEN_MINUTES_MS;

                const returnedRole = data.role || (data.isAdmin ? 'Admin' : 'Editor');
                const userIsAdmin = data.isAdmin === true && returnedRole === 'Admin';

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('logged_in_username', data.username || username);
                localStorage.setItem('session_expiration', expirationTimestamp.toString());
                localStorage.setItem('user_role', returnedRole);
                localStorage.setItem('is_admin', userIsAdmin ? 'true' : 'false');

                setLoggedInUsername(data.username || username);
                setUserRole(returnedRole);
                setIsAdmin(userIsAdmin);
                clearUserData();
                setIsLoggingIn(true);

                setTimeout(() => {
                    setToken(data.token);
                    setTimeLeft(600);
                    setIsLoggingIn(false);
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.updateSize();
                        }
                    }, 100);
                }, 500);
            } else {
                setError(data.message || 'Giriş başarısız.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı. Projenin açık olduğundan emin ol.');
        }
    };

    // MİSAFİR GİRİŞ İŞLEMİ (VIEWER MODU)
    const handleGuestLogin = async () => {
        setError('');
        try {
            const response = await fetch('http://localhost:5041/api/auth/guest-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (response.ok) {
                const TEN_MINUTES_MS = 10 * 60 * 1000;
                const expirationTimestamp = Date.now() + TEN_MINUTES_MS;

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('logged_in_username', 'Misafir (İzleyici)');
                localStorage.setItem('session_expiration', expirationTimestamp.toString());
                localStorage.setItem('user_role', 'Viewer');
                localStorage.setItem('is_admin', 'false');

                setLoggedInUsername('Misafir (İzleyici)');
                setUserRole('Viewer');
                setIsAdmin(false);
                clearUserData();
                setIsLoggingIn(true);

                setTimeout(() => {
                    setToken(data.token);
                    setTimeLeft(600);
                    setIsLoggingIn(false);
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.updateSize();
                        }
                    }, 100);
                }, 500);
            } else {
                setError(data.message || 'Misafir girişi başarısız.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı.');
        }
    };

    // ÇIKIŞ İŞLEMİ
    const handleLogout = (customMessage = '') => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('logged_in_username');
        localStorage.removeItem('session_expiration');
        localStorage.removeItem('is_admin');
        localStorage.removeItem('user_role');
        clearUserData();
        setToken('');
        setLoggedInUsername('');
        setUserRole('Viewer');
        setIsAdmin(false);
        setCurrentView('map');
        if (customMessage) {
            setError(customMessage);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // TEMA DEĞİŞTİĞİNDE HARİTA ALTLIK KATMANINI GÜNCELLE
    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        if (mapRef.current) {
            mapRef.current.updateSize();
            mapRef.current.render();
        }
    }, [isDarkMode]);

    // OPENLAYERS HARİTA KURULUMU (SABİT HARİTA MİMARİSİ)
    useEffect(() => {
        if (!token) return;
        const container = mapContainerRef.current || document.getElementById('map');
        if (!container) return;

        if (!mapRef.current) {
            const activeMarkerSource = new VectorSource();
            vectorSourceRef.current = activeMarkerSource;

            const savedPlacesSource = new VectorSource();
            savedPlacesSourceRef.current = savedPlacesSource;

            const drawingsSource = new VectorSource();
            drawingsSourceRef.current = drawingsSource;

            const activeBaseConfig = getBasemapConfig(selectedBaseLayer);
            const baseTileLayer = new TileLayer({
                source: new XYZ({
                    url: activeBaseConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: activeBaseConfig.maxZoom || 19
                })
            });
            tileLayerRef.current = baseTileLayer;

            const analysisLayer = new VectorLayer({
                source: analysisSourceRef.current,
                style: new Style({
                    stroke: new Stroke({
                        color: '#f59e0b',
                        width: 3,
                        lineDash: [8, 8]
                    }),
                    fill: new Fill({
                        color: 'rgba(245, 158, 11, 0.25)'
                    })
                })
            });

            const heatmapLayer = new HeatmapLayer({
                source: heatmapSourceRef.current,
                blur: 24,
                radius: 20,
                weight: function () {
                    return 1;
                },
                gradient: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
                visible: false,
                zIndex: 15
            });
            heatmapLayerRef.current = heatmapLayer;

            const geoServerWmsSource = new TileWMS({
                url: 'http://localhost:5041/api/geoserver/wms',
                params: {
                    'LAYERS': 'geomap:v_points',
                    'STYLES': 'drawings_heatmap',
                    'TILED': true,
                    'CQL_FILTER': 'is_deleted = false'
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
            });
            geoServerWmsSourceRef.current = geoServerWmsSource;

            const geoServerHeatmapLayer = new TileLayer({
                source: geoServerWmsSource,
                visible: false,
                zIndex: 16
            });
            geoServerWmsLayerRef.current = geoServerHeatmapLayer;

            const savedPlacesLayer = new VectorLayer({
                source: savedPlacesSource
            });
            savedPlacesLayerRef.current = savedPlacesLayer;

            const drawingsLayer = new VectorLayer({
                source: drawingsSource,
                zIndex: 16,
                visible: layerVisibility.drawings,
                style: (feature, resolution) => {
                    const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : (mapRef.current?.getView()?.getZoom() || 10);
                    const geomType = feature.getGeometry()?.getType();
                    const itemType = feature.get('type') || (geomType === 'Point' ? 'Point' : (geomType === 'Polygon' || geomType === 'MultiPolygon' ? 'Polygon' : 'Line'));
                    const itemColor = feature.get('color') || '#8b5cf6';
                    const name = feature.get('name') || '';

                    const zs = getZoomSettings();
                    const pointMinZoom = zs.drawingPointMinZoom ?? 7.0;
                    const polyMinZoom = zs.drawingPolygonMinZoom ?? 6.0;
                    const labelMinZoom = zs.drawingLabelMinZoom ?? 11.0;

                    if (itemType === 'Point' && zoom < pointMinZoom) {
                        return null;
                    }
                    if ((itemType === 'Polygon' || itemType === 'Line') && zoom < polyMinZoom) {
                        return null;
                    }

                    const showLabel = name && zoom >= labelMinZoom;
                    const textStyle = showLabel ? new Text({
                        text: name,
                        font: '600 11.5px Inter, system-ui, sans-serif',
                        fill: new Fill({ color: '#ffffff' }),
                        stroke: new Stroke({ color: '#0f172a', width: 3 }),
                        offsetY: itemType === 'Point' ? -28 : 0,
                        overflow: false
                    }) : undefined;

                    if (itemType === 'Point') {
                        const pinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${itemColor}" stroke="#ffffff" stroke-width="2.5"/>
                          <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
                        </svg>`;
                        return new Style({
                            image: new Icon({
                                src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                                scale: 0.75,
                                anchor: [0.5, 1]
                            }),
                            text: textStyle,
                            zIndex: 22
                        });
                    } else if (itemType === 'Line') {
                        return new Style({
                            stroke: new Stroke({
                                color: itemColor,
                                width: 4
                            }),
                            text: textStyle,
                            zIndex: 20
                        });
                    } else {
                        return new Style({
                            stroke: new Stroke({
                                color: itemColor,
                                width: 3
                            }),
                            fill: new Fill({
                                color: hexToRgba(itemColor, 0.35)
                            }),
                            text: textStyle,
                            zIndex: 19
                        });
                    }
                }
            });
            drawingsLayerRef.current = drawingsLayer;

            const cityBoundaryLayer = new VectorLayer({
                source: cityBoundarySourceRef.current,
                zIndex: 6,
                visible: layerVisibility.cities,
                style: (feature, resolution) => {
                    const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : 8;
                    const name = feature.get('name') || feature.get('NAME') || feature.get('il_adi') || '';
                    return new Style({
                        stroke: new Stroke({
                            color: isDarkMode ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.55)',
                            width: 1.2
                        }),
                        fill: new Fill({
                            color: 'transparent'
                        }),
                        text: (name && zoom >= 8.5 && zoom <= 13) ? new Text({
                            text: name,
                            font: '600 11px Inter, sans-serif',
                            fill: new Fill({ color: isDarkMode ? '#94a3b8' : '#64748b' }),
                            stroke: new Stroke({ color: isDarkMode ? '#0f172a' : '#ffffff', width: 2.5 }),
                            overflow: false
                        }) : undefined
                    });
                }
            });
            cityBoundaryLayerRef.current = cityBoundaryLayer;

            const maritimeBoundaryLayer = new VectorLayer({
                source: maritimeBoundarySourceRef.current,
                zIndex: 7,
                visible: layerVisibility.maritime,
                style: (feature, resolution) => {
                    const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : 8;
                    const zoneName = feature.get('name') || feature.get('NAME') || feature.get('zoneName') || 'Deniz Yetki Alanı';
                    return new Style({
                        stroke: new Stroke({
                            color: '#0891b2',
                            width: 1.6,
                            lineDash: [6, 4]
                        }),
                        fill: new Fill({
                            color: 'rgba(8, 145, 178, 0.06)'
                        }),
                        text: (zoneName && zoom >= 7.0 && zoom <= 12) ? new Text({
                            text: zoneName,
                            font: '600 11.5px Inter, sans-serif',
                            fill: new Fill({ color: '#0891b2' }),
                            stroke: new Stroke({ color: isDarkMode ? '#0f172a' : '#ffffff', width: 2.5 }),
                            overflow: false
                        }) : undefined
                    });
                }
            });
            maritimeBoundaryLayerRef.current = maritimeBoundaryLayer;

            const routeLayer = new VectorLayer({
                source: routeSourceRef.current,
                zIndex: 18,
                visible: layerVisibility.routes,
                style: (feature, resolution) => {
                    const r = feature.get('routeData');
                    const rClass = (r?.routeClass || feature.get('routeClass') || 'araba').toLowerCase().trim();
                    if (layerVisibility.routeTypes && layerVisibility.routeTypes[rClass] === false) {
                        return null;
                    }
                    return createTransitRouteStyle(feature, resolution, selectedRouteInfoRef.current?.id);
                }
            });
            routeLayerRef.current = routeLayer;

            const poiLayer = new VectorLayer({
                source: poiSourceRef.current,
                style: createPoiStyle,
                zIndex: 14,
                declutter: true,
                visible: layerVisibility.pois
            });
            poiLayerRef.current = poiLayer;

            // ÖNBELLEKLENMİŞ DURAK STİLLERİ (Style Cache - 9.121 durak için sıfır tahsisat ve 60 FPS akıcılık)
            const stopIconStyleCache = new Map();
            const stopLabelStyleCache = new Map();

            const getCachedStopIconStyle = (routeClass, color, isSelected) => {
                const key = `${routeClass}_${color}_${isSelected}`;
                let style = stopIconStyleCache.get(key);
                if (!style) {
                    const pinSvg = getStopPinSvg(routeClass, color);
                    const isGemi = routeClass === 'gemi' || routeClass === 'liman' || routeClass === 'deniz';
                    const isBus = routeClass === 'otobus' || routeClass === 'bus';
                    style = new Style({
                        image: new Icon({
                            src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                            scale: isGemi ? 0.95 : (isBus ? 0.8 : 0.85),
                            anchor: [0.5, 0.5]
                        }),
                        zIndex: isSelected ? 28 : (isGemi ? 26 : 24)
                    });
                    stopIconStyleCache.set(key, style);
                }
                return style;
            };

            const getCachedStopLabelStyle = (name, isBus, isSelected) => {
                const key = `${name}_${isBus}_${isSelected}`;
                let style = stopLabelStyleCache.get(key);
                if (!style) {
                    style = new Style({
                        text: new Text({
                            text: name,
                            font: isBus ? '600 9.5px Inter, system-ui, sans-serif' : '600 11px Inter, system-ui, sans-serif',
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#0f172a', width: 3.5, lineJoin: 'round' }),
                            offsetY: isBus ? 12 : 16,
                            overflow: true
                        }),
                        zIndex: isSelected ? 29 : 25
                    });
                    stopLabelStyleCache.set(key, style);
                }
                return style;
            };

            // AKILLI ULAŞIM - DURAKLAR KATMANI: Yüksek Performanslı Dinamik Zoom, Stil Önbellekleme ve Seçim Kontrolü
            const stopLayer = new VectorLayer({
                source: stopSourceRef.current,
                zIndex: 25,
                declutter: true,
                style: (feature, resolution) => {
                    const zoom = resolution ? Math.log2(156543.03392804097 / resolution) : (mapRef.current?.getView()?.getZoom() || 0);
                    const featureRouteClass = (feature.get('stopClass') || feature.get('routeClass') || 'otobus').toLowerCase();
                    if (layerVisibility.stopTypes && layerVisibility.stopTypes[featureRouteClass] === false) {
                        return null;
                    }

                    const featureRouteId = feature.get('routeId');
                    const isIndependent = !featureRouteId;
                    const isAirport = featureRouteClass === 'havayolu' || featureRouteClass === 'havalimani' || featureRouteClass === 'airport' || featureRouteClass === 'ucak';
                    const isBus = featureRouteClass === 'otobus' || featureRouteClass === 'bus';
                    const isGemi = featureRouteClass === 'gemi' || featureRouteClass === 'liman' || featureRouteClass === 'deniz';
                    const isMetro = featureRouteClass === 'metro';
                    const isTren = featureRouteClass === 'tren' || featureRouteClass === 'train';
                    const isSelectedRoute = selectedRouteInfoRef.current?.id === featureRouteId;

                    const zs = getZoomSettings();
                    const minStopZoom = isAirport
                        ? (zs.airportStopMinZoom ?? 4.5)
                        : (isGemi 
                            ? (zs.shipStopMinZoom ?? 8.0) 
                            : (isMetro 
                                ? (zs.metroStopMinZoom ?? 12.0) 
                                : (isTren 
                                    ? (zs.trainStopMinZoom ?? 11.0) 
                                    : (isBus 
                                        ? (zs.busStopMinZoom ?? 14.5) 
                                        : (zs.stopMinZoom ?? 14.0)))));

                    if (!isSelectedRoute && zoom < minStopZoom) {
                        return null;
                    }

                    const routeColor = feature.get('routeColor') || '#3b82f6';
                    const stopName = feature.get('stopName') || '';

                    const iconStyle = getCachedStopIconStyle(featureRouteClass, routeColor, isSelectedRoute);

                    const stopNameMinZoom = isAirport 
                        ? (zs.airportStopMinZoom ? zs.airportStopMinZoom + 1.5 : 6.0) 
                        : (isGemi 
                            ? (zs.shipStopMinZoom ? zs.shipStopMinZoom + 1.0 : 7.5) 
                            : (isMetro 
                                ? (zs.metroStopMinZoom ? zs.metroStopMinZoom + 1.0 : 12.5) 
                                : (isTren 
                                    ? (zs.trainStopMinZoom ? zs.trainStopMinZoom + 1.0 : 11.5) 
                                    : (zs.stopNameMinZoom ?? 16.0))));
                    const showStopLabel = stopName && (zoom >= stopNameMinZoom || isSelectedRoute);

                    if (showStopLabel) {
                        const labelStyle = getCachedStopLabelStyle(stopName, isBus, isSelectedRoute);
                        return [iconStyle, labelStyle];
                    }

                    return iconStyle;
                },
                visible: layerVisibility.stops
            });
            stopLayerRef.current = stopLayer;

            const directionsLayer = new VectorLayer({
                source: directionsSourceRef.current,
                zIndex: 35,
                visible: true
            });
            directionsLayerRef.current = directionsLayer;

            const simulationLayer = new VectorLayer({
                source: simulationSourceRef.current,
                zIndex: 45,
                visible: true
            });
            simulationLayerRef.current = simulationLayer;

            const map = new Map({
                target: container,
                layers: [
                    baseTileLayer,
                    cityBoundaryLayer,
                    maritimeBoundaryLayer,
                    savedPlacesLayer,
                    drawingsLayer,
                    routeLayer,
                    poiLayer,
                    stopLayer,
                    directionsLayer,
                    simulationLayer,
                    heatmapLayer,
                    geoServerHeatmapLayer,
                    analysisLayer,
                    new VectorLayer({
                        source: locationAnalysisBoundarySourceRef.current,
                        style: new Style({
                            stroke: new Stroke({ color: '#f59e0b', width: 3.5, lineDash: [8, 6] }),
                            fill: new Fill({ color: 'rgba(245, 158, 11, 0.08)' })
                        }),
                        zIndex: 22
                    }),
                    new HeatmapLayer({
                        source: locationAnalysisHeatmapSourceRef.current,
                        blur: 24,
                        radius: 20,
                        weight: (feature) => feature.get('weight') || 0.5,
                        gradient: ['#3b82f6', '#10b981', '#eab308', '#f97316', '#ef4444'],
                        zIndex: 23
                    }),
                    new VectorLayer({
                        source: activeMarkerSource
                    })
                ],
                view: new View({
                    center: fromLonLat([33.2433, 38.9637]),
                    zoom: 6.5
                })
            });

            // DİNAMİK METRİK ÖLÇEK BARI KONTROLÜ (OpenLayers ScaleLine)
            if (scaleLineTargetRef.current) {
                const scaleLineControl = new ScaleLine({
                    target: scaleLineTargetRef.current,
                    units: 'metric',
                    minWidth: 64
                });
                map.addControl(scaleLineControl);
            }

            if (!overlayContainerRef.current) {
                const popupDiv = document.createElement('div');
                popupDiv.className = 'ol-popup-overlay-container';
                overlayContainerRef.current = popupDiv;
            }

            const overlay = new Overlay({
                element: overlayContainerRef.current,
                autoPan: {
                    animation: {
                        duration: 250,
                    },
                },
                positioning: 'bottom-center',
                offset: [0, 0],
                stopEvent: true
            });
            map.addOverlay(overlay);
            overlayRef.current = overlay;

            map.on('singleclick', function (evt) {
                if (drawTypeRef.current && drawTypeRef.current !== 'None') return;

                // POI & İki Nokta Arası Yol Tarifi: Haritadan Başlangıç veya Hedef Noktası Seçimi
                if (directionsStateRef.current?.selectingPoint) {
                    const mode = directionsStateRef.current.selectingPoint;
                    const lonLat = toLonLat(evt.coordinate);
                    const lon = parseFloat(lonLat[0].toFixed(6));
                    const lat = parseFloat(lonLat[1].toFixed(6));
                    if (handleSetDirectionsMapPointRef.current) {
                        handleSetDirectionsMapPointRef.current(mode, lon, lat);
                    }
                    return;
                }

                // 0. Canlı Simülasyon Araç Tıklaması Kontrolü (Akıllı Ulaşım - Araç Telemetrisi ve Yüzde Tamamlanma)
                let clickedVehicle = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isSimulatedVehicle')) {
                        clickedVehicle = feature.get('vehicleData');
                        return true;
                    }
                }, { hitTolerance: 12 });

                if (clickedVehicle) {
                    setSelectedVehicleInfo(clickedVehicle);
                    setSelectedStopInfo(null);
                    setSelectedPoiInfo(null);
                    setSelectedPointInfo(null);
                    // Aracın ait olduğu güzergahı da bularak güzergah popup'ını da açık tutuyoruz
                    const matchedRoute = routes.find(r => r.id === clickedVehicle.routeId);
                    if (matchedRoute) {
                        setSelectedRouteInfo(matchedRoute);
                    }
                    return;
                }

                // 1. Durak Tıklaması Kontrolü (Akıllı Ulaşım Modülü)
                let clickedStop = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isStop')) {
                        clickedStop = feature.get('stopData');
                        return true;
                    }
                });

                if (clickedStop) {
                    // Bu duraktan geçen BÜTÜN hatları dinamik olarak tespit et (1 durak birden fazla hat paylaşabilir)
                    const activeRoutesList = routesRef.current || routes || [];
                    const passingRoutes = activeRoutesList.filter(r => {
                        if (clickedStop.routeId && (r.id === clickedStop.routeId || String(r.id) === String(clickedStop.routeId))) return true;
                        if (Array.isArray(r.stops)) {
                            return r.stops.some(st => 
                                (clickedStop.id && st.id === clickedStop.id) || 
                                (st.name && clickedStop.name && st.name.trim().toLowerCase() === clickedStop.name.trim().toLowerCase()) ||
                                (st.longitude != null && clickedStop.longitude != null && 
                                 Math.abs(st.longitude - clickedStop.longitude) < 0.0008 && 
                                 Math.abs(st.latitude - clickedStop.latitude) < 0.0008)
                            );
                        }
                        return false;
                    });

                    const enrichedStop = {
                        ...clickedStop,
                        routes: passingRoutes.length > 0 ? passingRoutes : (clickedStop.routes || (clickedStop.routeId ? [{ id: clickedStop.routeId, name: clickedStop.routeName, color: clickedStop.routeColor, routeClass: clickedStop.routeClass }] : []))
                    };

                    setSelectedStopInfo(enrichedStop);
                    setSelectedPoiInfo(null);
                    setSelectedRouteInfo(null);
                    setSelectedBoundaryInfo(null);
                    setSelectedPointInfo(null);
                    return;
                }

                // 2. POI Tıklaması Kontrolü
                let clickedPoi = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isPoi')) {
                        clickedPoi = feature.get('poiData');
                        return true;
                    }
                });

                if (clickedPoi) {
                    setSelectedPoiInfo(clickedPoi);
                    setSelectedStopInfo(null);
                    setSelectedRouteInfo(null);
                    setSelectedBoundaryInfo(null);
                    setSelectedPointInfo(null);
                    return;
                }

                // 3. Güzergah & Hat Çizgisi Tıklaması Kontrolü (Akıllı Ulaşım Modülü)
                let clickedRoute = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isRouteLine')) {
                        clickedRoute = feature.get('routeData');
                        return true;
                    }
                });

                if (clickedRoute) {
                    setSelectedRouteInfo(clickedRoute);
                    setSelectedStopInfo(null);
                    setSelectedPoiInfo(null);
                    setSelectedBoundaryInfo(null);
                    setSelectedPointInfo(null);
                    return;
                }

                // 4. Deniz Yetki Alanı veya İl Sınırı Tıklaması Kontrolü (Yüzölçümü & Çevre)
                let clickedBoundary = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
                    if (layer === cityBoundaryLayerRef.current || layer === maritimeBoundaryLayerRef.current || feature.get('isMaritime') || feature.get('NAME') || feature.get('zoneName') || feature.get('il_adi')) {
                        const isMaritime = layer === maritimeBoundaryLayerRef.current || !!feature.get('isMaritime') || !!feature.get('zoneName');
                        const name = feature.get('name') || feature.get('NAME') || feature.get('zoneName') || feature.get('il_adi') || (isMaritime ? 'Deniz Yetki Alanı' : 'İl Sınırı');
                        const region = feature.get('region') || feature.get('sea') || (isMaritime ? 'Deniz Alanı' : 'Bölge');
                        const plate = feature.get('plate') || feature.get('id') || '';
                        const metrics = calculateGeometryMetrics(feature.getGeometry());
                        clickedBoundary = {
                            name,
                            region,
                            plate,
                            isMaritime,
                            areaKm2: metrics.areaKm2,
                            areaHa: metrics.areaHa,
                            formattedArea: metrics.formattedArea,
                            formattedAreaHa: metrics.formattedAreaHa,
                            perimeterKm: metrics.perimeterKm,
                            formattedPerimeter: metrics.formattedPerimeter
                        };
                        return true;
                    }
                });

                if (clickedBoundary) {
                    setSelectedBoundaryInfo(clickedBoundary);
                    setSelectedPoiInfo(null);
                    setSelectedStopInfo(null);
                    setSelectedRouteInfo(null);
                    setSelectedPointInfo(null);
                } else {
                    setSelectedBoundaryInfo(null);
                }

                const lonLat = toLonLat(evt.coordinate);
                const lon = parseFloat(lonLat[0].toFixed(6));
                const lat = parseFloat(lonLat[1].toFixed(6));

                setCoords({ lon, lat });
                setHasUserSelectedPin(true);
            });

            // HATTA ÇİFT TIKLANDIĞINDA HATTIN GENELİNİ GÖSTERME (FIT EXTENT)
            map.on('dblclick', function (evt) {
                let clickedRouteFeature = null;
                map.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    if (feature && feature.get('isRouteLine')) {
                        clickedRouteFeature = feature;
                        return true;
                    }
                }, {
                    hitTolerance: 8
                });

                if (clickedRouteFeature) {
                    const geom = clickedRouteFeature.getGeometry();
                    if (geom) {
                        const extent = geom.getExtent();
                        map.getView().fit(extent, {
                            padding: [100, 100, 100, 100],
                            maxZoom: 17,
                            duration: 700
                        });

                        const rData = clickedRouteFeature.get('routeData');
                        if (rData) {
                            setSelectedRouteInfo(rData);
                            setSelectedStopInfo(null);
                            setSelectedPoiInfo(null);
                            setSelectedPointInfo(null);
                        }
                    }
                    return false;
                }
            });

            let lastPointerMoveTime = 0;
            map.on('pointermove', function (evt) {
                if (evt.coordinate) {
                    const now = performance.now();
                    if (now - lastPointerMoveTime > 100) {
                        lastPointerMoveTime = now;
                        const [cLon, cLat] = toLonLat(evt.coordinate);
                        setCursorCoords({ lon: parseFloat(cLon.toFixed(5)), lat: parseFloat(cLat.toFixed(5)) });
                    }
                }
            });

            const updateLiveZoom = () => {
                const z = map.getView().getZoom();
                if (z != null) {
                    setCurrentZoom(z);
                    setMapZoom(z);
                }
            };

            map.getView().on('change:resolution', updateLiveZoom);
            map.on('moveend', updateLiveZoom);

            mapRef.current = map;
        } else {
            mapRef.current.setTarget(container);
        }

        const updateMapSize = () => {
            if (mapRef.current) {
                mapRef.current.updateSize();
                mapRef.current.render();
            }
        };

        updateMapSize();
        const animFrame1 = requestAnimationFrame(updateMapSize);
        const animFrame2 = requestAnimationFrame(() => requestAnimationFrame(updateMapSize));
        const timer1 = setTimeout(updateMapSize, 50);
        const timer2 = setTimeout(updateMapSize, 150);
        const timer3 = setTimeout(updateMapSize, 300);
        const timer4 = setTimeout(updateMapSize, 600);
        const timer5 = setTimeout(updateMapSize, 1200);

        let resizeObserver = null;
        if (container && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                updateMapSize();
            });
            resizeObserver.observe(container);
        }

        return () => {
            cancelAnimationFrame(animFrame1);
            cancelAnimationFrame(animFrame2);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
            clearTimeout(timer5);
            if (resizeObserver && container) {
                resizeObserver.unobserve(container);
            }
        };
    }, [token]);

    // HARİTA GÖRÜNÜMÜNE GEÇİLDİĞİNDE VEYA OTURUM AÇILDIĞINDA HARİTA BOYUTUNU DÜZELT & POI / VERİLERİ YENİLE
    useEffect(() => {
        if (currentView === 'map') {
            fetchPois();
            if (token) {
                fetchRoutesAndStops();
                fetchDrawings();
            }
            if (mapRef.current) {
                const update = () => {
                    mapRef.current?.updateSize();
                    mapRef.current?.render();
                    if (poiLayerRef.current) poiLayerRef.current.changed();
                };
                update();
                const t1 = setTimeout(update, 50);
                const t2 = setTimeout(update, 200);
                const t3 = setTimeout(update, 500);
                return () => {
                    clearTimeout(t1);
                    clearTimeout(t2);
                    clearTimeout(t3);
                };
            }
        }
    }, [currentView, token]);

    // NOKTA BİLGİ PANELİ POPUP OVERLAY KONUMLANDIRMA
    useEffect(() => {
        if (overlayRef.current) {
            if (selectedPointInfo && selectedPointInfo.lon != null && selectedPointInfo.lat != null) {
                if (isModifyingVertex) {
                    overlayRef.current.setOffset([260, -220]);
                } else if (selectedPointInfo.type === 'LineDrawing' || selectedPointInfo.type === 'PolygonDrawing' || selectedPointInfo.type === 'Line' || selectedPointInfo.type === 'Polygon') {
                    overlayRef.current.setOffset([0, -200]);
                } else {
                    overlayRef.current.setOffset([0, -350]);
                }
                overlayRef.current.setPosition(fromLonLat([selectedPointInfo.lon, selectedPointInfo.lat]));
            } else {
                overlayRef.current.setPosition(undefined);
            }
        }
    }, [selectedPointInfo, isModifyingVertex]);

    // ISI HARİTASI (HEATMAP) NOKTALARINI GÜNCELLEME VE KATMAN GÖRÜNÜRLÜĞÜ
    useEffect(() => {
        if (!heatmapLayerRef.current) return;
        heatmapLayerRef.current.setVisible(isHeatmapActive);

        if (isHeatmapActive && heatmapSourceRef.current) {
            heatmapSourceRef.current.clear();
            const wktFormat = new WKT();
            const featuresToAdd = [];

            // 1. NOKTALAR (Points & Saved Places)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Point') {
                const pointDrawings = savedDrawings.filter(d => (d.type === 'Point' || d.type === 'PointDrawing') && d.wkt);
                pointDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        featuresToAdd.push(new Feature({
                            geometry: geom,
                            name: d.name,
                            id: `pt-${d.id}`,
                            weight: 1
                        }));
                    } catch (e) {
                        console.error('Heatmap point parsing error:', e);
                    }
                });

                savedPlaces.forEach(p => {
                    if (p.longitude != null && p.latitude != null) {
                        featuresToAdd.push(new Feature({
                            geometry: new Point(fromLonLat([p.longitude, p.latitude])),
                            name: p.name,
                            id: `place-${p.id}`,
                            weight: 1
                        }));
                    }
                });
            }

            // 2. ÇİZGİLER (LineStrings - Güzergah Düğüm & Kırılma Noktaları)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Line') {
                const lineDrawings = savedDrawings.filter(d => (d.type === 'Line' || d.type === 'LineString' || d.type === 'LineDrawing') && d.wkt);
                lineDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const coords = geom.getCoordinates();
                        if (Array.isArray(coords)) {
                            coords.forEach((coord, idx) => {
                                featuresToAdd.push(new Feature({
                                    geometry: new Point(coord),
                                    name: `${d.name || 'Çizgi'} (Nokta ${idx + 1})`,
                                    id: `line-${d.id}-pt-${idx}`,
                                    weight: 0.9
                                }));
                            });
                        }
                    } catch (e) {
                        console.error('Heatmap line parsing error:', e);
                    }
                });
            }

            // 3. POLİGONLAR (Polygons - Köşe Noktaları & Ağırlık Merkezi)
            if (heatmapTypeFilter === 'ALL' || heatmapTypeFilter === 'Polygon') {
                const polyDrawings = savedDrawings.filter(d => (d.type === 'Polygon' || d.type === 'PolygonDrawing') && d.wkt);
                polyDrawings.forEach(d => {
                    try {
                        const geom = wktFormat.readGeometry(d.wkt, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const coordsArray = geom.getCoordinates();
                        if (Array.isArray(coordsArray) && coordsArray.length > 0) {
                            // Dış çevre köşe koordinatları
                            coordsArray[0].forEach((coord, idx) => {
                                featuresToAdd.push(new Feature({
                                    geometry: new Point(coord),
                                    name: `${d.name || 'Poligon'} (Köşe ${idx + 1})`,
                                    id: `poly-${d.id}-v-${idx}`,
                                    weight: 0.85
                                }));
                            });
                            // İç merkez / ağırlık noktası
                            if (geom.getInteriorPoint) {
                                featuresToAdd.push(new Feature({
                                    geometry: geom.getInteriorPoint(),
                                    name: `${d.name || 'Poligon'} (Merkez)`,
                                    id: `poly-${d.id}-center`,
                                    weight: 1
                                }));
                            }
                        }
                    } catch (e) {
                        console.error('Heatmap polygon parsing error:', e);
                    }
                });
            }

            heatmapSourceRef.current.addFeatures(featuresToAdd);
        }

        // GEOSERVER WMS KATMANI & DİNAMİK CQL_FILTER GÜNCELLEMESİ
        if (geoServerWmsSourceRef.current) {
            let cql = 'is_deleted = false';
            if (heatmapTypeFilter === 'Point') {
                cql += " AND (type = 'Point' OR type = 'PointDrawing')";
            } else if (heatmapTypeFilter === 'Line') {
                cql += " AND (type = 'Line' OR type = 'LineString' OR type = 'LineDrawing')";
            } else if (heatmapTypeFilter === 'Polygon') {
                cql += " AND (type = 'Polygon' OR type = 'PolygonDrawing')";
            }

            try {
                geoServerWmsSourceRef.current.updateParams({
                    'CQL_FILTER': cql,
                    'TIME': Date.now()
                });
            } catch (e) {
                console.warn('GeoServer WMS params update:', e);
            }
        }
    }, [isHeatmapActive, heatmapTypeFilter, savedDrawings, savedPlaces]);

    // NOKTA BİLGİ PANELİ EYLEMLERİ
    const handleCopyCoords = () => {
        if (!selectedPointInfo) return;
        const textToCopy = `${selectedPointInfo.lat}, ${selectedPointInfo.lon}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'info',
                    summary: t.pointInfoTitle,
                    detail: t.coordsCopiedToast,
                    life: 3000
                });
            }
        });
    };

    // KIRILMA NOKTALARINI FARE İLE HARİTADA DÜZENLEME (Modify Interaction + Undo/Redo + Cancel Modal)
    const stopVertexEditing = () => {
        if (modifyInteractionRef.current && mapRef.current) {
            try {
                mapRef.current.removeInteraction(modifyInteractionRef.current);
            } catch (e) { }
            modifyInteractionRef.current = null;
        }
        setIsModifyingVertex(false);
        setIsPopupCollapsed(false);
        geometryHistoryRef.current = [];
        setHistoryIndex(-1);
    };

    const updateGeometryInfoFromGeom = (targetFeature, geom) => {
        const wktFormat = new WKT();
        const newWkt = wktFormat.writeGeometry(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });

        setEditWkt(newWkt);

        let updatedLengthText = selectedPointInfo.lengthText;
        let updatedAreaText = selectedPointInfo.areaText;

        if (selectedPointInfo.type.includes('Line')) {
            const lengthMeters = getLength(geom);
            updatedLengthText = lengthMeters >= 1000 ? (lengthMeters / 1000).toFixed(2) + ' km' : Math.round(lengthMeters) + ' m';
        } else if (selectedPointInfo.type.includes('Polygon')) {
            const areaMeters = getArea(geom);
            updatedAreaText = areaMeters >= 1000000 ? (areaMeters / 1000000).toFixed(2) + ' km²' : Math.round(areaMeters).toLocaleString() + ' m²';
        }

        setSelectedPointInfo(prev => prev ? {
            ...prev,
            wkt: newWkt,
            lengthText: updatedLengthText,
            areaText: updatedAreaText
        } : null);
    };

    const startVertexEditing = () => {
        if (!selectedPointInfo || !selectedPointInfo.id || !drawingsSourceRef.current || !mapRef.current) return;

        stopVertexEditing();

        const features = drawingsSourceRef.current.getFeatures();
        const targetFeature = features.find(f => f.get('id') === selectedPointInfo.id && (f.get('type') === selectedPointInfo.type || selectedPointInfo.type.includes(f.get('type'))));

        if (!targetFeature) {
            setInfoMessage('Harita üzerinde düzenlenecek çizim objesi bulunamadı.');
            return;
        }

        originalWktRef.current = selectedPointInfo.wkt;
        const initialGeomClone = targetFeature.getGeometry().clone();
        geometryHistoryRef.current = [initialGeomClone];
        setHistoryIndex(0);

        const modify = new Modify({
            features: new Collection([targetFeature])
        });

        modify.on('modifyend', () => {
            try {
                const geom = targetFeature.getGeometry();
                const geomClone = geom.clone();

                setHistoryIndex(prevIndex => {
                    const newHistory = geometryHistoryRef.current.slice(0, prevIndex + 1);
                    newHistory.push(geomClone);
                    geometryHistoryRef.current = newHistory;
                    return newHistory.length - 1;
                });

                updateGeometryInfoFromGeom(targetFeature, geom);
                setInfoMessage('Kırılma noktaları haritada güncellendi. "Kaydet" butonuna basarak kaydedebilir veya "Geri Al" butonunu kullanabilirsiniz.');
            } catch (err) {
                console.error('Modify end hatası:', err);
            }
        });

        mapRef.current.addInteraction(modify);
        modifyInteractionRef.current = modify;
        setIsModifyingVertex(true);
        setIsPopupCollapsed(true);
        setInfoMessage('Kırılma noktalarını fare ile harita üzerinde sürükleyebilirsiniz.');
    };

    // GERİ AL (UNDO)
    const handleUndoGeometry = () => {
        if (historyIndex <= 0 || !drawingsSourceRef.current) return;
        const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
        if (!targetFeature) return;

        const newIndex = historyIndex - 1;
        const targetGeom = geometryHistoryRef.current[newIndex].clone();
        targetFeature.setGeometry(targetGeom);
        setHistoryIndex(newIndex);
        updateGeometryInfoFromGeom(targetFeature, targetGeom);
        setInfoMessage('Değişiklik geri alındı (Geri Al).');
    };

    // İLERİ AL (REDO)
    const handleRedoGeometry = () => {
        if (historyIndex < 0 || historyIndex >= geometryHistoryRef.current.length - 1 || !drawingsSourceRef.current) return;
        const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
        if (!targetFeature) return;

        const newIndex = historyIndex + 1;
        const targetGeom = geometryHistoryRef.current[newIndex].clone();
        targetFeature.setGeometry(targetGeom);
        setHistoryIndex(newIndex);
        updateGeometryInfoFromGeom(targetFeature, targetGeom);
        setInfoMessage('Değişiklik ileri alındı (İleri Al).');
    };

    // VAZGEÇ / İPTAL TALEBİ VE ESKİ GEOMETRİYE DÖNÜŞ (ERROR PREVENTION MODAL)
    const handleTriggerCancelVertexEditing = () => {
        if (historyIndex <= 0) {
            stopVertexEditing();
            return;
        }
        setCancelEditConfirm(true);
    };

    const confirmCancelVertexEditing = () => {
        setCancelEditConfirm(false);
        if (selectedPointInfo && selectedPointInfo.id && drawingsSourceRef.current && originalWktRef.current) {
            try {
                const targetFeature = drawingsSourceRef.current.getFeatures().find(f => f.get('id') === selectedPointInfo.id);
                if (targetFeature) {
                    const wktFormat = new WKT();
                    const origGeom = wktFormat.readGeometry(originalWktRef.current, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    targetFeature.setGeometry(origGeom.getGeometry());
                    setEditWkt(originalWktRef.current);
                    setSelectedPointInfo(prev => prev ? { ...prev, wkt: originalWktRef.current } : null);
                }
            } catch (e) {
                console.error('Eski geometriye dönüş hatası:', e);
            }
        }
        stopVertexEditing();
        setInfoMessage('Kırılma noktası değişiklikleri iptal edildi ve eski haline dönüldü.');
    };

    const handleClosePointInfo = () => {
        if (isModifyingVertex && historyIndex > 0) {
            setCancelEditConfirm(true);
            return;
        }
        stopVertexEditing();
        setSelectedPointInfo(null);
    };

    // POI TAŞIMA VE POLİGON DÜZENLEME MANTIĞI (Admin & Editor)
    const stopPoiEditing = () => {
        if (poiModifyInteractionRef.current && mapRef.current) {
            mapRef.current.removeInteraction(poiModifyInteractionRef.current);
            poiModifyInteractionRef.current = null;
        }
        if (poiTranslateInteractionRef.current && mapRef.current) {
            mapRef.current.removeInteraction(poiTranslateInteractionRef.current);
            poiTranslateInteractionRef.current = null;
        }
        setEditingPoiState(null);
    };

    const startPoiEditing = (poi) => {
        if (!poi || !poi.id || !poiSourceRef.current || !mapRef.current) return;

        const canEdit = isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör' || poi.userId === loggedInUserId;
        if (!canEdit) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Yetki Gerekli', detail: 'Bu POI\'yi düzenleme veya taşıma yetkiniz bulunmuyor.', life: 3000 });
            }
            return;
        }

        stopPoiEditing();

        const features = poiSourceRef.current.getFeatures();
        const targetFeature = features.find(f => f.get('poiData')?.id === poi.id);
        if (!targetFeature) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'error', summary: 'Hata', detail: 'Haritada bu POI objesi bulunamadı.', life: 3000 });
            }
            return;
        }

        const isPolygon = poi.wkt ? (poi.wkt.toUpperCase().includes('POLYGON')) : false;
        const originalGeom = targetFeature.getGeometry().clone();
        const originalWkt = poi.wkt;

        if (isPolygon) {
            targetFeature.setStyle(new Style({
                stroke: new Stroke({ color: '#2563eb', width: 3, lineDash: [8, 6] }),
                fill: new Fill({ color: 'rgba(37, 99, 235, 0.25)' }),
                zIndex: 100
            }));
        }

        // 1. Modify: Köşe ve sınır bükme/düzenleme etkileşimi
        const modify = new Modify({
            features: new Collection([targetFeature])
        });

        // 2. Translate: SADECE Nokta (Point) POI'ler için geçerlidir.
        // Poligon POI'ler bütün halinde taşınamaz; sadece sınırları bükülebilir ve düzeltilebilir.
        let translate = null;
        if (!isPolygon) {
            translate = new Translate({
                features: new Collection([targetFeature])
            });
        }

        const updateGeomWkt = () => {
            const wktFormat = new WKT();
            const currentGeom = targetFeature.getGeometry();
            const newWkt = wktFormat.writeGeometry(currentGeom, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            setEditingPoiState(prev => prev ? {
                ...prev,
                currentWkt: newWkt,
                hasChanged: true
            } : null);
        };

        modify.on('modifyend', updateGeomWkt);
        mapRef.current.addInteraction(modify);
        poiModifyInteractionRef.current = modify;

        if (translate) {
            translate.on('translateend', updateGeomWkt);
            mapRef.current.addInteraction(translate);
            poiTranslateInteractionRef.current = translate;
        }

        setEditingPoiState({
            poi,
            feature: targetFeature,
            isPolygon,
            originalWkt,
            originalGeom,
            currentWkt: originalWkt,
            hasChanged: false
        });

        setSelectedPoiInfo(null);

        if (toastRef.current) {
            toastRef.current.show({
                severity: 'info',
                summary: isPolygon ? 'Poligon Sınır Düzenleme Modu' : 'Konum Taşıma Modu',
                detail: isPolygon
                    ? 'Poligon sınırlarını ve köşelerini sürükleyerek veya bükerek şeklini değiştirebilirsiniz.'
                    : 'İşaretçiyi harita üzerinde yeni konumuna sürükleyip bırakabilirsiniz.',
                life: 4000
            });
        }
    };

    const handleSavePoiGeometry = async () => {
        if (!editingPoiState || !editingPoiState.poi || !token) return;
        setIsSavingPoiGeom(true);
        try {
            const poi = editingPoiState.poi;
            await adminApi.updatePoi(poi.id, {
                name: poi.name,
                description: poi.description || '',
                categoryId: poi.categoryId,
                workingHours: poi.workingHours || '',
                imageUrl: poi.imageUrl || null,
                wkt: editingPoiState.currentWkt,
                isActive: poi.isActive !== false
            }, token);

            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'success',
                    summary: 'Başarılı',
                    detail: editingPoiState.isPolygon ? 'POI poligonu başarıyla güncellendi.' : 'POI konumu başarıyla taşındı.',
                    life: 3000
                });
            }

            stopPoiEditing();
            await fetchPois();
        } catch (err) {
            console.error('POI geometri güncelleme hatası:', err);
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'error',
                    summary: 'Hata',
                    detail: err.message || 'POI güncellenirken bir hata oluştu.',
                    life: 4000
                });
            }
        } finally {
            setIsSavingPoiGeom(false);
        }
    };

    const handleCancelPoiEditing = () => {
        if (editingPoiState && editingPoiState.feature && editingPoiState.originalGeom) {
            editingPoiState.feature.setGeometry(editingPoiState.originalGeom);
            editingPoiState.feature.setStyle(createPoiStyle);
        }
        stopPoiEditing();
        if (toastRef.current) {
            toastRef.current.show({
                severity: 'info',
                summary: 'İptal Edildi',
                detail: 'POI üzerindeki değişiklikler iptal edildi.',
                life: 2500
            });
        }
    };

    // SEÇİLİ MAVİ PIN İŞARETÇİSİ (Haritaya tıklanmadığı sürece şeffaf / gizli)
    useEffect(() => {
        if (!vectorSourceRef.current) return;
        vectorSourceRef.current.clear();

        if (!hasUserSelectedPin) return; // Kullanıcı haritaya tıklamadığı sürece pin çizilmez

        const lon = parseFloat(coords.lon);
        const lat = parseFloat(coords.lat);

        if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
            const marker = new Feature({
                geometry: new Point(fromLonLat([lon, lat]))
            });

            // Seçili konumu diğer tüm objelerden ayıran belirgin, modern mavi cam degradeli ve hedef halkalı iğne
            const pinSvg = `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
                </filter>
                <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.75"/>
                </linearGradient>
              </defs>
              <path d="M18 1.5C9.44 1.5 2.5 8.44 2.5 17C2.5 29.5 18 46.5 18 46.5C18 46.5 33.5 29.5 33.5 17C33.5 8.44 26.56 1.5 18 1.5Z" fill="url(#pinGrad)" stroke="#ffffff" stroke-width="2.2" filter="url(#glow)"/>
              <circle cx="18" cy="17" r="6.5" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
              <circle cx="18" cy="17" r="2.8" fill="#0284c7"/>
            </svg>`;

            marker.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                    scale: 0.85,
                    anchor: [0.5, 1],
                    opacity: 0.9
                })
            }));

            vectorSourceRef.current.addFeature(marker);
        }
    }, [coords, hasUserSelectedPin, token, placeColor]);

    // KAYITLI MEKANLARI HARİTADA GÖSTER
    useEffect(() => {
        if (!savedPlacesSourceRef.current) return;
        savedPlacesSourceRef.current.clear();

        savedPlaces.forEach((place) => {
            const pinColor = place.color || '#16a34a';
            const pinSvg = `<svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${pinColor}" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
            </svg>`;

            const feature = new Feature({
                geometry: new Point(fromLonLat([place.longitude, place.latitude])),
                name: place.name
            });

            feature.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg),
                    scale: 0.75,
                    anchor: [0.5, 1]
                })
            }));

            savedPlacesSourceRef.current.addFeature(feature);
        });
    }, [savedPlaces]);

    // SEÇİLİ FİLTRELERE GÖRE ÇİZİMLERİ SÜZ
    const filteredDrawings = useMemo(() => {
        return savedDrawings.filter((item) => {
            const matchesType = selectedTypeFilter === 'ALL' || item.type === selectedTypeFilter;
            const creatorName = item.insertedUsername || (item.insertedUserId === 1 ? 'asdf.admin' : `Kullanıcı #${item.insertedUserId}`);
            const matchesEditor = selectedEditorFilter === 'ALL' || creatorName === selectedEditorFilter || item.insertedUserId.toString() === selectedEditorFilter;
            return matchesType && matchesEditor;
        });
    }, [savedDrawings, selectedTypeFilter, selectedEditorFilter]);

    const editorOptions = useMemo(() => {
        const names = new Set();
        savedDrawings.forEach(d => {
            const name = d.insertedUsername || (d.insertedUserId === 1 ? 'asdf.admin' : `Kullanıcı #${d.insertedUserId}`);
            if (name) names.add(name);
        });
        return Array.from(names);
    }, [savedDrawings]);

    // KAYITLI ÇİZİMLERİ (Point, Line, Polygon - WKT & Color) HARİTADA GÖSTER
    useEffect(() => {
        if (!drawingsSourceRef.current) return;
        drawingsSourceRef.current.clear();

        const wktFormat = new WKT();

        filteredDrawings.forEach((item) => {
            try {
                if (!item.wkt) return;

                const feature = wktFormat.readFeature(item.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                const itemColor = item.color || '#3b82f6';

                feature.set('id', item.id);
                feature.set('name', item.name);
                feature.set('type', item.type);
                feature.set('color', itemColor);
                feature.set('wkt', item.wkt);

                drawingsSourceRef.current.addFeature(feature);
            } catch (err) {
                console.error(`WKT okuma hatası (${item.id}):`, err);
            }
        });
    }, [filteredDrawings]);

    // ÇİZİME İPTAL ETME VE TEMİZLEME
    const handleCancelDraw = () => {
        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.abortDrawing();
            } catch (e) { }
            if (mapRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
            }
            drawInteractionRef.current = null;
        }

        if (draftFeatureRef.current && drawingsSourceRef.current) {
            drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
            draftFeatureRef.current = null;
        }

        setDraftWkt('');
        setDrawingName('');
        setDrawingColor('#3b82f6');
        setDrawType('None');
    };

    // GEÇİCİ ANALİZİ TEMİZLEME
    const handleClearAnalysis = () => {
        if (analysisSourceRef.current) {
            analysisSourceRef.current.clear();
        }
        setAnalysisResult(null);
        setDrawType('None');
        setInfoMessage('Geçici envanter analizi temizlendi.');
    };

    // OPENLAYERS INTERACTION YÖNETİMİ (drawend Tetikleyicisi)
    useEffect(() => {
        if (!mapRef.current || !drawingsSourceRef.current) return;

        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.abortDrawing();
            } catch (e) { }
            mapRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }

        if (drawType === 'None') {
            setDraftWkt('');
            setDrawingName('');
            return;
        }

        // Seçilen moda göre varsayılan başlık önerisi
        const typeLabel = isTr 
            ? (drawType === 'Point' ? 'Nokta' : drawType === 'LineString' ? 'Çizgi' : drawType === 'Polygon' ? 'Poligon' : 'Analiz')
            : (drawType === 'Point' ? 'Point' : drawType === 'LineString' ? 'Line' : drawType === 'Polygon' ? 'Polygon' : 'Analysis');
        const timeFormatted = new Date().toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        setDrawingName(isTr ? `${typeLabel} Çizimi - ${timeFormatted}` : `${typeLabel} Drawing - ${timeFormatted}`);
        setDrawingColor('#3b82f6');
        setDraftWkt('');

        // GEÇİCİ ENVANTER ANALİZİ ÇİZİM MODU
        if (drawType === 'Analysis') {
            const drawInteraction = new Draw({
                source: analysisSourceRef.current,
                type: 'Polygon',
                freehand: false,
                freehandCondition: () => false
            });

            drawInteraction.on('drawend', async (event) => {
                const geometry = event.feature.getGeometry();
                const wktFormat = new WKT();
                const wktString = wktFormat.writeGeometry(geometry, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                // OpenLayers olay döngüsünü bozmamak için çizim modunu asynchronous zamanlayıcı ile sıfırla
                setTimeout(() => {
                    setDrawType('None');
                }, 50);

                setIsAnalyzing(true);
                setInfoMessage('Kesişim analizi hesaplanıyor...');

                try {
                    const response = await fetch('http://localhost:5041/api/analysis/inventory', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ wkt: wktString })
                    });

                    const data = await response.json();
                    if (response.ok && data) {
                        setAnalysisResult(data);
                        setInfoMessage(`Analiz tamamlandı: Toplam ${data.totalIntersectedCount ?? 0} envanter kesişiyor.`);
                    } else {
                        setInfoMessage('Analiz hatası: ' + (data?.message || 'Bilinmeyen hata'));
                    }
                } catch (err) {
                    setInfoMessage('Analiz isteği gönderilirken hata oluştu.');
                } finally {
                    setIsAnalyzing(false);
                }
            });

            mapRef.current.addInteraction(drawInteraction);
            drawInteractionRef.current = drawInteraction;
            return;
        }

        // ÇOK KRİTERLİ KONUM ANALİZİ SINIR POLİGONU ÇİZİM MODU
        if (drawType === 'LocationAnalysisBoundary') {
            const boundaryDrawInteraction = new Draw({
                source: locationAnalysisBoundarySourceRef.current,
                type: 'Polygon',
                freehand: false,
                freehandCondition: () => false
            });

            boundaryDrawInteraction.on('drawstart', () => {
                if (locationAnalysisBoundarySourceRef.current) {
                    locationAnalysisBoundarySourceRef.current.clear();
                }
            });

            boundaryDrawInteraction.on('drawend', (event) => {
                const geom = event.feature.getGeometry();
                const wktFormat = new WKT();
                const wktStr = wktFormat.writeGeometry(geom, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                setAnalysisDrawnWkt(wktStr);
                setLocationAnalysisAreaMode('polygon');
                setIsDrawingAnalysisBoundary(false);

                setTimeout(() => {
                    setDrawType('None');
                    setShowLocationAnalysisModal(true);
                }, 50);

                toastRef.current?.show({
                    severity: 'success',
                    summary: 'Hedef Bölge Çizildi',
                    detail: 'Harita üzerinde analiz alanı belirlendi. Kriterlerinizi ayarlayıp analizi başlatabilirsiniz.',
                    life: 4000
                });
            });

            mapRef.current.addInteraction(boundaryDrawInteraction);
            drawInteractionRef.current = boundaryDrawInteraction;
            return;
        }

        // DURAK EKLEME MODU (Point - Akıllı Ulaşım Modülü)
        if (drawType === 'Stop') {
            const stopDrawInteraction = new Draw({
                source: stopSourceRef.current,
                type: 'Point',
                freehand: false,
                freehandCondition: () => false
            });

            stopDrawInteraction.on('drawend', (event) => {
                const geom = event.feature.getGeometry();
                const coord = geom.getCoordinates();
                const [lonVal, latVal] = toLonLat(coord);
                const lon = parseFloat(lonVal.toFixed(6));
                const lat = parseFloat(latVal.toFixed(6));
                const wktStr = `POINT(${lon} ${lat})`;

                setDraftStopCoords({ lon, lat, wkt: wktStr });
                setNewStopForm({
                    name: '',
                    routeId: routes.length > 0 ? String(routes[0].id) : '',
                    description: ''
                });

                // Geçici çizim noktasını kaldır, modal onaylanınca gerçek durak verisi çizilecek
                setTimeout(() => {
                    if (stopSourceRef.current) {
                        try {
                            stopSourceRef.current.removeFeature(event.feature);
                        } catch (e) {}
                    }
                    setDrawType('None');
                    setShowAddStopModal(true);
                }, 50);
            });

            mapRef.current.addInteraction(stopDrawInteraction);
            drawInteractionRef.current = stopDrawInteraction;
            return;
        }

        // POI (POINT OF INTEREST) NOKTA VEYA POLİGON EKLEME MODU (Shift Destekli)
        if (drawType === 'Poi') {
            const poiDrawInteraction = new Draw({
                source: drawingsSourceRef.current,
                type: poiDrawGeometryType,
                freehand: false,
                freehandCondition: () => false,
                condition: (event) => event.originalEvent.button === 0
            });

            poiDrawInteraction.on('drawstart', (event) => {
                if (draftFeatureRef.current && drawingsSourceRef.current) {
                    try {
                        drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
                    } catch (e) { }
                }
                draftFeatureRef.current = event.feature;
            });

            poiDrawInteraction.on('drawend', async (event) => {
                const geom = event.feature.getGeometry();
                const geomType = geom.getType();
                draftFeatureRef.current = event.feature;
                let lon = 0, lat = 0, wktStr = '', areaMeters = 0;

                if (geomType === 'Point') {
                    const coord = geom.getCoordinates();
                    const [pLon, pLat] = toLonLat(coord);
                    lon = parseFloat(pLon.toFixed(6));
                    lat = parseFloat(pLat.toFixed(6));
                    wktStr = `POINT(${lon} ${lat})`;
                } else {
                    const wktFormat = new WKT();
                    wktStr = wktFormat.writeGeometry(geom, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    const interiorPt = geom.getInteriorPoint ? geom.getInteriorPoint().getCoordinates() : getCenter(geom.getExtent());
                    const [pLon, pLat] = toLonLat(interiorPt);
                    lon = parseFloat(pLon.toFixed(6));
                    lat = parseFloat(pLat.toFixed(6));
                    areaMeters = getArea(geom);
                }

                // Spatial boundary check
                if (!isAdmin && userRole !== 'Admin' && userSpatialBoundaryWktRef.current) {
                    try {
                        const wktFormat = new WKT();
                        const bFeature = wktFormat.readFeature(userSpatialBoundaryWktRef.current, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        const geojsonFormat = new GeoJSON();
                        const bGeoJsonObj = geojsonFormat.writeGeometryObject(bFeature.getGeometry());
                        const drawnGeoJsonObj = geojsonFormat.writeGeometryObject(geom);
                        const isAllowed = isGeomInsideBoundary(drawnGeoJsonObj, bGeoJsonObj);

                        if (!isAllowed) {
                            if (draftFeatureRef.current && drawingsSourceRef.current) {
                                drawingsSourceRef.current.removeFeature(draftFeatureRef.current);
                                draftFeatureRef.current = null;
                            }
                            setDraftPoiData(null);
                            if (toastRef.current) {
                                toastRef.current.show({
                                    severity: 'error',
                                    summary: 'Yetkisiz Alan',
                                    detail: 'POI konumu tanımlı coğrafi yetki sınırınızın dışındadır! Lütfen izin verilen bölge içerisine POI ekleyiniz.',
                                    life: 5000
                                });
                            }
                            return;
                        }
                    } catch (e) {
                        console.error('POI spatial check error:', e);
                    }
                }

                setDraftPoiData({
                    wkt: wktStr,
                    lon: lon,
                    lat: lat,
                    isPolygon: geomType === 'Polygon' || geomType === 'MultiPolygon',
                    area: areaMeters,
                    feature: event.feature
                });

                if (toastRef.current) {
                    toastRef.current.show({
                        severity: 'info',
                        summary: geomType === 'Polygon' ? 'Poligon Hazır' : 'Nokta Hazır',
                        detail: 'Konum seçildi. Bilgileri girip haritaya eklemek için aşağıdaki "Kaydet" butonuna tıklayınız.',
                        life: 3000
                    });
                }
            });

            mapRef.current.addInteraction(poiDrawInteraction);
            drawInteractionRef.current = poiDrawInteraction;
            return;
        }

        // STANDART ÇİZİM MODLARI (Point, LineString, Polygon)
        const stdDrawInteraction = new Draw({
            source: drawingsSourceRef.current,
            type: drawType,
            freehand: false,
            freehandCondition: () => false,
            condition: (event) => event.originalEvent.button === 0
        });

        stdDrawInteraction.on('drawstart', (event) => {
            draftFeatureRef.current = event.feature;
        });

        // 2. MADDE: Haritada çizim tamamlandığı anda (drawend) WKT Alır ve Yüzer Menüye Aktarır (Sınır Dışına Çıkma Kontrolü İle)
        stdDrawInteraction.on('drawend', (event) => {
            const geometry = event.feature.getGeometry();
            draftFeatureRef.current = event.feature;

            const wktFormat = new WKT();
            const wktString = wktFormat.writeGeometry(geometry, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });

            // STRICT SPATIAL BOUNDARY ENFORCEMENT CHECK (Only for non-Admin / Editor users)
            if (!isAdmin && userRole !== 'Admin' && userSpatialBoundaryWktRef.current) {

                try {
                    const bFeature = wktFormat.readFeature(userSpatialBoundaryWktRef.current, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    const geojsonFormat = new GeoJSON();
                    const bGeoJsonObj = geojsonFormat.writeGeometryObject(bFeature.getGeometry());
                    const drawnGeoJsonObj = geojsonFormat.writeGeometryObject(geometry);

                    const isAllowed = isGeomInsideBoundary(drawnGeoJsonObj, bGeoJsonObj);

                    if (!isAllowed) {
                        setTimeout(() => {
                            if (drawingsSourceRef.current && draftFeatureRef.current) {
                                try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                draftFeatureRef.current = null;
                            }
                        }, 50);
                        setDraftWkt('');
                        if (toastRef.current) {
                            toastRef.current.show({
                                severity: 'error',
                                summary: 'Yetkisiz Alan',
                                detail: 'Çiziminiz tanımlı coğrafi yetki sınırınızın dışına çıktı! Çizim engellendi. Lütfen yalnızca kırmızı yanıp sönen coğrafi sınır içerisine çizim yapınız.',
                                life: 6000
                            });
                        }
                        return;
                    }
                } catch (spatialErr) {
                    console.error('Sınır denetim hatası:', spatialErr);
                }
            }

            setDraftWkt(wktString);
        });


        mapRef.current.addInteraction(stdDrawInteraction);
        drawInteractionRef.current = stdDrawInteraction;

        return () => {
            if (mapRef.current && drawInteractionRef.current) {
                mapRef.current.removeInteraction(drawInteractionRef.current);
            }
        };
    }, [drawType, poiDrawGeometryType, token]);

    // POI HARİTADAN KAYDETME & GÜNCELLEME (Operatör / Editör / Admin)
    const handleSaveNewPoi = async (e) => {
        e.preventDefault();
        if (!newPoiForm.name.trim()) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Eksik Alan', detail: 'Lütfen POI adını giriniz.', life: 3000 });
            }
            return;
        }
        if (!newPoiForm.categoryId) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'warn', summary: 'Eksik Alan', detail: 'Lütfen bir kategori seçiniz.', life: 3000 });
            }
            return;
        }

        try {
            const serializedImage = serializePoiImages(newPoiForm.images);

            if (editingPoiModalData) {
                // POI DÜZENLEME
                await adminApi.updatePoi(editingPoiModalData.id, {
                    name: newPoiForm.name.trim(),
                    description: newPoiForm.description?.trim(),
                    categoryId: parseInt(newPoiForm.categoryId, 10),
                    workingHours: newPoiForm.workingHours?.trim(),
                    imageUrl: serializedImage,
                    wkt: editingPoiModalData.wkt || newPoiForm.wkt,
                    isActive: editingPoiModalData.isActive !== false
                }, token);

                if (toastRef.current) {
                    toastRef.current.show({
                        severity: 'success',
                        summary: 'Başarılı',
                        detail: `"${newPoiForm.name}" adlı POI başarıyla güncellendi!`,
                        life: 3500
                    });
                }

                // Seçili POI info panelini de anında yeni fotoğraflarla güncelle
                setSelectedPoiInfo(prev => (prev && prev.id === editingPoiModalData.id ? {
                    ...prev,
                    name: newPoiForm.name.trim(),
                    description: newPoiForm.description?.trim(),
                    categoryId: parseInt(newPoiForm.categoryId, 10),
                    categoryName: activeCategoryObject?.name || prev.categoryName,
                    parentCategoryName: activeCategoryObject?.parentName || prev.parentCategoryName,
                    categoryColor: activeCategoryObject?.color || prev.categoryColor,
                    categoryIcon: activeCategoryObject?.icon || prev.categoryIcon,
                    workingHours: newPoiForm.workingHours?.trim(),
                    imageUrl: serializedImage
                } : prev));
            } else {
                // YENİ POI OLUŞTURMA
                await adminApi.createPoi({
                    name: newPoiForm.name.trim(),
                    description: newPoiForm.description?.trim(),
                    categoryId: parseInt(newPoiForm.categoryId, 10),
                    workingHours: newPoiForm.workingHours?.trim(),
                    imageUrl: serializedImage,
                    wkt: newPoiForm.wkt
                }, token);

                if (draftFeatureRef.current && drawingsSourceRef.current) {
                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                    draftFeatureRef.current = null;
                }
                setDraftPoiData(null);
                setDrawType('None');

                if (toastRef.current) {
                    toastRef.current.show({
                        severity: 'success',
                        summary: 'Başarılı',
                        detail: `"${newPoiForm.name}" adlı POI haritaya başarıyla eklendi!`,
                        life: 3500
                    });
                }
            }

            setShowCreatePoiModal(false);
            setEditingPoiModalData(null);
            fetchPois();
        } catch (err) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'error', summary: 'Hata', detail: err.message || 'POI kaydedilemedi.', life: 4000 });
            }
        }
    };

    const handleDeletePoiFromMap = async (poiId, poiName) => {
        if (!window.confirm(`"${poiName}" adlı POI'yi silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deletePoi(poiId, token);
            if (toastRef.current) {
                toastRef.current.show({
                    severity: 'info',
                    summary: 'Silindi',
                    detail: 'POI başarıyla kaldırıldı.',
                    life: 3000
                });
            }
            setSelectedPoiInfo(null);
            fetchPois();
        } catch (err) {
            if (toastRef.current) {
                toastRef.current.show({ severity: 'error', summary: 'Hata', detail: err.message || 'Silme başarısız.', life: 4000 });
            }
        }
    };

    // YÜZER ÇİZİM BARI ÜZERİNDEN VERİTABANINA KAYDETME
    const handleSaveDrawingFromFloatingBox = async () => {
        if (!drawType || drawType === 'None') return;

        if (drawInteractionRef.current) {
            try {
                drawInteractionRef.current.finishDrawing();
            } catch (e) { }
        }

        let wktToSend = draftWkt;

        if (!wktToSend && draftFeatureRef.current) {
            const wktFormat = new WKT();
            wktToSend = wktFormat.writeGeometry(draftFeatureRef.current.getGeometry(), {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        }

        if (!wktToSend) {
            setInfoMessage('Lütfen önce haritada çiziminizi tamamlayın.');
            return;
        }

        const typeLabel = drawType === 'Point' ? 'Nokta' : drawType === 'LineString' ? 'Çizgi' : 'Poligon';
        const finalName = drawingName.trim() || `${typeLabel} Çizimi`;

        let endpoint = 'http://localhost:5041/api/drawings/';
        if (drawType === 'Point') endpoint += 'point';
        else if (drawType === 'LineString') endpoint += 'line';
        else if (drawType === 'Polygon') endpoint += 'polygon';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: finalName,
                    color: drawingColor,
                    wkt: wktToSend
                })
            });

            const data = await response.json();
            if (response.ok) {
                setInfoMessage(`${typeLabel} veritabanına (${drawingColor} rengiyle) başarıyla kaydedildi!`);
                draftFeatureRef.current = null;
                setDraftWkt('');
                setDrawingName('');
                setDrawingColor('#3b82f6');
                setDrawType('None');
                fetchDrawings();
            } else {
                setInfoMessage('Kayıt başarısız: ' + (data.message || 'Hata oluştu'));
            }
        } catch (err) {
            setInfoMessage('Çizim verisi sunucuya gönderilirken hata oluştu.');
        }
    };

    // MEKANA ODAKLANMA (showInfo = false varsayılan)
    const handleSelectSavedPlace = (place, showInfo = false) => {
        setCoords({ lon: place.longitude, lat: place.latitude });
        setPlaceName(place.name);
        if (place.color) setPlaceColor(place.color);

        if (showInfo) {
            setSelectedPointInfo({
                name: place.name,
                type: 'SavedPlace',
                lon: place.longitude,
                lat: place.latitude,
                color: place.color || '#16a34a',
                wkt: `POINT(${place.longitude} ${place.latitude})`
            });
        }

        if (mapRef.current) {
            mapRef.current.getView().animate({
                center: fromLonLat([place.longitude, place.latitude]),
                zoom: 13,
                duration: 1000
            });
        }
    };

    // ÇİZİME ODAKLANMA (showInfo = false varsayılan)
    const handleSelectDrawing = (drawing, showInfo = false) => {
        if (!mapRef.current || !drawing.wkt) return;
        try {
            const wktFormat = new WKT();
            const feature = wktFormat.readFeature(drawing.wkt, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, { duration: 1000, maxZoom: 15, padding: [50, 50, 50, 50] });

            if (showInfo) {
                const geom = feature.getGeometry();

                if (drawing.type === 'Point') {
                    const coordsDeg = toLonLat(geom.getCoordinates());
                    const pLon = parseFloat(coordsDeg[0].toFixed(6));
                    const pLat = parseFloat(coordsDeg[1].toFixed(6));

                    setCoords({ lon: pLon, lat: pLat });
                    if (drawing.color) setPlaceColor(drawing.color);

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'PointDrawing',
                        lon: pLon,
                        lat: pLat,
                        color: drawing.color || '#ef4444',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });
                } else if (drawing.type === 'Line') {
                    const centerCoord = getCenter(extent);
                    const coordsDeg = toLonLat(centerCoord);
                    const cLon = parseFloat(coordsDeg[0].toFixed(6));
                    const cLat = parseFloat(coordsDeg[1].toFixed(6));
                    const lengthMeters = getLength(geom);
                    const lengthText = lengthMeters >= 1000 ? (lengthMeters / 1000).toFixed(2) + ' km' : Math.round(lengthMeters) + ' m';

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'LineDrawing',
                        lon: cLon,
                        lat: cLat,
                        lengthText: lengthText,
                        color: drawing.color || '#3b82f6',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });
                } else if (drawing.type === 'Polygon') {
                    let centerCoord;
                    if (geom.getInteriorPoint) {
                        centerCoord = geom.getInteriorPoint().getCoordinates();
                    } else {
                        centerCoord = getCenter(extent);
                    }
                    const coordsDeg = toLonLat(centerCoord);
                    const cLon = parseFloat(coordsDeg[0].toFixed(6));
                    const cLat = parseFloat(coordsDeg[1].toFixed(6));
                    const areaMeters = getArea(geom);
                    const areaText = areaMeters >= 1000000 ? (areaMeters / 1000000).toFixed(2) + ' km²' : Math.round(areaMeters).toLocaleString() + ' m²';

                    setSelectedPointInfo({
                        id: drawing.id,
                        name: drawing.name,
                        type: 'PolygonDrawing',
                        lon: cLon,
                        lat: cLat,
                        areaText: areaText,
                        color: drawing.color || '#10b981',
                        wkt: drawing.wkt,
                        insertedUserId: drawing.insertedUserId,
                        insertedUsername: drawing.insertedUsername
                    });

                    runSavedPolygonAnalysis(drawing);
                }
            }
        } catch (err) {
            console.error('Odaklanma hatası:', err);
        }
    };

    // KAYITLI POLİGON İÇİN KESİŞİM ANALİZİ ÇALIŞTIRMA (Gereksinim 3.1)
    // KAYITLI POLİGON İÇİN KESİŞİM ANALİZİ ÇALIŞTIRMA
    const runSavedPolygonAnalysis = async (drawing) => {
        try {
            setIsAnalyzing(true);
            const response = await fetch('http://localhost:5041/api/analysis/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ wkt: drawing.wkt })
            });

            const data = await response.json();
            if (response.ok && data) {
                setAnalysisResult(data);
            }
        } catch (err) {
            console.error('Kayıtlı poligon analizi hatası:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // SİLME UYARISI
    const triggerDeletePlace = (place, e) => {
        e.stopPropagation();
        setDeleteTarget({
            kind: 'place',
            id: place.id,
            name: place.name
        });
    };

    const triggerDeleteDrawing = (drawing, e) => {
        e.stopPropagation();
        setDeleteTarget({
            kind: 'drawing',
            drawingType: drawing.type,
            id: drawing.id,
            name: drawing.name
        });
    };

    // HARİTADAKİ OBJE DETAY POPUP ÜZERİNDEN GÜNCELLEME İÇİN ONAY MODALI (ERROR PREVENTION)
    const [updateConfirmTarget, setUpdateConfirmTarget] = useState(null);

    const handleUpdateDrawingFromPopup = () => {
        if (!selectedPointInfo || !selectedPointInfo.id) {
            setInfoMessage('Güncellenecek çizim id bilgisi bulunamadı.');
            return;
        }

        setUpdateConfirmTarget({
            id: selectedPointInfo.id,
            name: editName.trim() || selectedPointInfo.name,
            type: selectedPointInfo.type
        });
    };

    const executeDrawingUpdateConfirmed = async () => {
        if (!selectedPointInfo || !selectedPointInfo.id) return;
        setUpdateConfirmTarget(null);

        let drawingType = selectedPointInfo.type;
        if (drawingType === 'PointDrawing') drawingType = 'Point';
        if (drawingType === 'LineDrawing') drawingType = 'Line';
        if (drawingType === 'PolygonDrawing') drawingType = 'Polygon';

        try {
            const response = await fetch(`http://localhost:5041/api/drawings/${drawingType.toLowerCase()}/${selectedPointInfo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName.trim() || selectedPointInfo.name,
                    color: editColor,
                    wkt: editWkt.trim() || selectedPointInfo.wkt
                })
            });

            const data = await response.json();
            if (response.ok) {
                stopVertexEditing();
                setInfoMessage(`"${editName.trim() || selectedPointInfo.name}" çizimi (İsim/Renk/Geometri) başarıyla güncellendi!`);
                fetchDrawings();
                setSelectedPointInfo(prev => prev ? { ...prev, name: editName, color: editColor, wkt: editWkt } : null);
            } else {
                setInfoMessage('Güncelleme başarısız: ' + (data.message || 'Hata oluştu'));
            }
        } catch (err) {
            setInfoMessage('Güncelleme işleminde hata oluştu: ' + err.message);
        }
    };

    const triggerDeleteDrawingFromPopup = () => {
        if (!selectedPointInfo || !selectedPointInfo.id) return;
        let drawingType = selectedPointInfo.type;
        if (drawingType === 'PointDrawing') drawingType = 'Point';
        if (drawingType === 'LineDrawing') drawingType = 'Line';
        if (drawingType === 'PolygonDrawing') drawingType = 'Polygon';

        setDeleteTarget({
            kind: 'drawing',
            drawingType: drawingType,
            id: selectedPointInfo.id,
            name: editName || selectedPointInfo.name
        });
    };

    // SİLME İŞLEMİNİ ONAYLAMA (SOFT DELETE)
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { kind, id, drawingType, name } = deleteTarget;
        setDeleteTarget(null);

        try {
            const endpointType = kind === 'place' ? 'point' : drawingType.toLowerCase();
            const response = await fetch(`http://localhost:5041/api/drawings/${endpointType}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setInfoMessage(`"${name}" kaydı başarıyla silindi.`);
                handleClosePointInfo();
                fetchDrawings();
            } else {
                setInfoMessage('Silme işleminde hata oluştu.');
            }
        } catch (err) {
            setInfoMessage('Silme işleminde hata oluştu: ' + err.message);
        }
    };

    // NOKTA MEKAN VE KOORDİNAT KAYDETME (tbl_point BİRLEŞİK MİMARİSİ)
    const handleSavePlace = async (e) => {
        e.preventDefault();
        setInfoMessage('');

        try {
            const lon = parseFloat(coords.lon);
            const lat = parseFloat(coords.lat);
            const wktString = `POINT(${lon} ${lat})`;

            const responsePoint = await fetch('http://localhost:5041/api/drawings/point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: placeName.trim() || 'Nokta Mekan Kaydı',
                    color: placeColor,
                    wkt: wktString
                })
            });

            const data = await responsePoint.json();

            if (responsePoint.ok) {
                setInfoMessage(data.message || 'Nokta veritabanına (tbl_point) başarıyla kaydedildi!');
                setPlaceName('');
                fetchDrawings();
            } else {
                setInfoMessage(data.message || 'Kayıt başarısız oldu.');
            }
        } catch (err) {
            setInfoMessage('Veri gönderilirken bir hata oluştu: ' + err.message);
        }
    };

    // KULLANICI KAYIT İŞLEMİ (REGISTER)
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setRegisterSuccessMsg('');
        setIsSubmittingRegister(true);

        try {
            const response = await fetch('http://localhost:5041/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, phone, password })
            });

            const data = await response.json();

            if (response.ok) {
                toastRef.current?.show({
                    severity: 'success',
                    summary: 'Kayıt Başarılı',
                    detail: data.message || t.registerSuccess,
                    life: 4000
                });
                setRegisterSuccessMsg(data.message || t.registerSuccess);
                setIsRegisterMode(false);
                setEmail('');
                setPhone('');
                setPassword('');
            } else {
                setError(data.message || t.registerFailed);
            }
        } catch (err) {
            setError('Kayıt oluşturulurken bağlantı hatası: ' + err.message);
        } finally {
            setIsSubmittingRegister(false);
        }
    };

    // LOGIN EKRANI
    if (!token || isLoggingIn) {
        return (
            <div className={`login-wrapper ${isLoggingIn ? 'is-logging-in' : ''}`}>
                <Toast ref={toastRef} />

                {/* Giriş Ekranı Sağ Alt Köşe Dil Seçim Butonu (Sadece Vektörel Bayrak) */}
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999 }}>
                    <button
                        type="button"
                        onClick={toggleLang}
                        title={t.languageSelect}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '24px',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            border: '1.5px solid rgba(255, 255, 255, 0.3)',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '700',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(8px)',
                            transition: 'transform 0.2s ease'
                        }}
                    >
                        {lang === 'tr' ? <><TurkeyFlag /> <span>TR</span></> : <><UKFlag /> <span>EN</span></>}
                    </button>
                </div>

                <div className="login-sidebar">
                    <div className="login-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="/logo.png" alt="GeoMap Logo" className="login-brand-logo-img" />
                        <div>
                            <h1 className="brand-title">Georaph.map</h1>
                            <p className="brand-subtitle">{isRegisterMode ? t.registerSubtitle : t.loginSubtitle}</p>
                        </div>
                    </div>

                    <div className="login-card">
                        <h2>{isRegisterMode ? t.registerTitle : t.loginTitle}</h2>
                        {registerSuccessMsg && <div className="success-msg">{registerSuccessMsg}</div>}
                        {error && <div className="error-msg">{error}</div>}

                        <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
                            <div className="input-group">
                                <label className="input-label">{t.usernameLabel}</label>
                                <input
                                    type="text"
                                    placeholder={t.usernamePlaceholder}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            {isRegisterMode && (
                                <>
                                    <div className="input-group">
                                        <label className="input-label">{t.emailLabel}</label>
                                        <input
                                            type="email"
                                            placeholder={t.emailPlaceholder}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">{t.phoneLabel}</label>
                                        <input
                                            type="tel"
                                            placeholder={t.phonePlaceholder}
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="input-group">
                                <label className="input-label">{t.passwordLabel}</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className="login-btn">
                                {isRegisterMode
                                    ? (isSubmittingRegister ? t.registering : t.registerButton)
                                    : (isLoggingIn ? t.loggingIn : t.loginButton)}
                            </button>
                        </form>

                        {!isRegisterMode && (
                            <div style={{ textAlign: 'center', marginTop: '14px' }}>
                                <button
                                    type="button"
                                    onClick={handleGuestLogin}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#38bdf8',
                                        fontSize: '13.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        opacity: 0.9,
                                        transition: 'all 0.2s ease',
                                        padding: '4px 8px'
                                    }}
                                    onMouseEnter={(e) => { e.target.style.opacity = '1'; e.target.style.textDecoration = 'underline'; }}
                                    onMouseLeave={(e) => { e.target.style.opacity = '0.9'; e.target.style.textDecoration = 'none'; }}
                                >
                                    Misafir Girişi (Viewer Modu)
                                </button>
                            </div>
                        )}

                        <div className="auth-toggle-wrapper" style={{ textAlign: 'center' }}>
                            <button
                                type="button"
                                className="btn-toggle-auth"
                                onClick={() => {
                                    setIsRegisterMode(!isRegisterMode);
                                    setError('');
                                    setRegisterSuccessMsg('');
                                }}
                            >
                                {isRegisterMode ? t.haveAccount : t.needAccount}
                            </button>
                        </div>
                    </div>

                    <div className="login-footer">
                        <span>&copy; {new Date().getFullYear()} Georaph.map. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
                    </div>
                </div>

                <div className="login-map-backdrop">
                    <svg className="map-vector" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="roadGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                            </linearGradient>
                            <linearGradient id="roadGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.3" />
                            </linearGradient>
                            <linearGradient id="lakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.1" />
                            </linearGradient>
                            <radialGradient id="pulseGlow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(96, 165, 250, 0.2)" strokeWidth="1" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#gridPattern)" />

                        <path d="M 250,-50 C 400,100 350,300 550,400 C 750,500 700,750 900,850 L 1050,850 L 1050,-50 Z" fill="url(#lakeGrad)" />

                        <path d="M -50,200 Q 200,150 450,320 T 950,250" fill="none" stroke="rgba(96, 165, 250, 0.35)" strokeWidth="2" strokeDasharray="6 6" />
                        <path d="M -50,400 Q 300,350 550,520 T 1050,450" fill="none" stroke="rgba(96, 165, 250, 0.25)" strokeWidth="2" strokeDasharray="8 8" />
                        <path d="M -50,600 Q 250,550 650,700 T 1050,650" fill="none" stroke="rgba(96, 165, 250, 0.2)" strokeWidth="1.5" />

                        <path d="M 100,850 C 200,600 300,450 500,300 C 650,180 800,100 1050,50" fill="none" stroke="url(#roadGrad1)" strokeWidth="5" strokeLinecap="round" />
                        <path d="M -50,350 C 250,380 400,200 600,150 C 750,110 850,-50 900,-50" fill="none" stroke="url(#roadGrad2)" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 350,850 C 450,650 500,500 750,400 C 880,350 980,300 1050,280" fill="none" stroke="url(#roadGrad1)" strokeWidth="3" strokeDasharray="12 6" />

                        <line x1="500" y1="300" x2="600" y2="150" stroke="rgba(96, 165, 250, 0.4)" strokeWidth="2" strokeDasharray="4 4" />
                        <line x1="300" y1="450" x2="450" y2="650" stroke="rgba(96, 165, 250, 0.4)" strokeWidth="2" strokeDasharray="4 4" />
                        <line x1="750" y1="400" x2="800" y2="100" stroke="rgba(96, 165, 250, 0.35)" strokeWidth="2" strokeDasharray="4 4" />

                        <g className="map-node node-1">
                            <circle cx="500" cy="300" r="30" fill="url(#pulseGlow)" className="pulse-ring" />
                            <circle cx="500" cy="300" r="7" fill="#60a5fa" />
                            <circle cx="500" cy="300" r="3" fill="#ffffff" />
                        </g>

                        <g className="map-node node-2">
                            <circle cx="600" cy="150" r="24" fill="url(#pulseGlow)" className="pulse-ring delay-1" />
                            <circle cx="600" cy="150" r="6" fill="#38bdf8" />
                            <circle cx="600" cy="150" r="2.5" fill="#ffffff" />
                        </g>

                        <g className="map-node node-3">
                            <circle cx="750" cy="400" r="32" fill="url(#pulseGlow)" className="pulse-ring delay-2" />
                            <circle cx="750" cy="400" r="8" fill="#3b82f6" />
                            <circle cx="750" cy="400" r="3.5" fill="#ffffff" />
                        </g>

                        <g className="map-node node-4">
                            <circle cx="300" cy="450" r="22" fill="url(#pulseGlow)" className="pulse-ring delay-3" />
                            <circle cx="300" cy="450" r="5" fill="#93c5fd" />
                        </g>
                    </svg>

                    <div className="map-overlay-vignette"></div>
                </div>
            </div>
        );
    }

    // HARİTA VE ANA UYGULAMA EKRANI
    return (
        <div className={`map-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <Toast ref={toastRef} position="top-right" baseZIndex={100000} />

            {/* ADMIN / OPERATÖR / EDİTÖR PANELİ TAM EKRAN KAPLAMA (OVERLAY) */}
            {currentView === 'admin' && (isAdmin || userRole === 'Admin' || isTransportOperator || userRole === 'Editor' || userRole === 'Editör') && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}>
                    <AdminDashboard 
                        token={token} 
                        userRole={userRole} 
                        initialTab={(isTransportOperator || userRole === 'Editor' || userRole === 'Editör') ? 'routes' : 'users'}
                        activeSimulations={activeSimulations}
                        setActiveSimulations={setActiveSimulations}
                        simLoadingId={simLoadingId}
                        setSimLoadingId={setSimLoadingId}
                        lang={lang}
                        toggleLang={toggleLang}
                        isDarkMode={isDarkMode}
                        setIsDarkMode={setIsDarkMode}
                        loggedInUsername={loggedInUsername}
                        onBackToMap={() => {
                            setCurrentView('map');
                            fetchRoutesAndStops();
                            // Güzergah yönetiminden haritaya dönüldüğünde canlı simülasyonları anında haritada senkronize et
                            simulationHubService.getActiveSimulations().then((activeList) => {
                                if (Array.isArray(activeList)) {
                                    const simMap = {};
                                    const vehMap = {};
                                    if (simulationSourceRef.current) {
                                        simulationSourceRef.current.clear();
                                    }
                                    activeList.forEach((s) => {
                                        const numId = Number(s.routeId);
                                        unmarkRouteAsStopped(numId);
                                        unmarkRouteAsStopped(s.routeId);
                                        unmarkRouteAsStopped(String(numId));

                                        const cleanSim = { ...s, isRunning: true, isPaused: Boolean(s.isPaused) };
                                        simMap[s.routeId] = cleanSim;
                                        simMap[numId] = cleanSim;
                                        simMap[String(numId)] = cleanSim;

                                        if (s.lastLocation) {
                                            vehMap[s.routeId] = s.lastLocation;
                                            vehMap[numId] = s.lastLocation;
                                            vehMap[String(numId)] = s.lastLocation;
                                            updateVehicleFeatureOnMap(s.lastLocation);
                                        }
                                    });
                                    activeSimulationsRef.current = simMap;
                                    setActiveSimulations(simMap);
                                    setActiveVehicles(vehMap);
                                    try {
                                        simulationSourceRef.current?.changed();
                                        mapRef.current?.render();
                                    } catch (e) { }
                                }
                            });
                            setTimeout(() => {
                                mapRef.current?.updateSize();
                            }, 50);
                        }}
                        onEditRouteGeometryOnMap={(route) => {
                            setCurrentView('map');
                            setTimeout(() => {
                                mapRef.current?.updateSize();
                                handleStartModifyingRoute(route);
                            }, 250);
                        }}
                        onRepositionStopOnMap={(stop) => {
                            setCurrentView('map');
                            setTimeout(() => {
                                mapRef.current?.updateSize();
                                handleStartModifyingStop(stop);
                            }, 250);
                        }}
                    />
                </div>
            )}

            {/* Sol Panel */}
            <div className={`map-sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
                {/* Sekmenin Dış Tarafına Monte Edilmiş Küçültme Tuşu (Sadece açıkken) */}
                {isSidebarOpen && (
                    <button
                        className="sidebar-close-btn-outside"
                        onClick={() => {
                            setIsSidebarOpen(false);
                            setTimeout(() => mapRef.current?.updateSize(), 300);
                        }}
                        title={t.closeSidebar}
                    >
                        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                )}

                <div className="map-sidebar-top">
                    {/* Marka Header */}
                    <div className="map-brand-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src="/logo.png" alt="GeoMap Logo" className="brand-logo-img" />
                            <h2 className="map-brand-title">Georaph.map</h2>
                        </div>
                    </div>

                    {/* Oturum Süresi Geri Sayım Rozeti (Admin için gizlenir) */}
                    {!isAdmin && userRole !== 'Admin' && (
                        <div className="session-timer-badge">
                            <div className="timer-label">
                                <span className="live-dot"></span>
                                <span>{t.sessionTime}</span>
                            </div>
                            <strong>{formatTime(timeLeft)}</strong>
                        </div>
                    )}

                    <div className="sidebar-divider"></div>

                    {/* Mekan Ekleme Formu */}
                    {userRole === 'Viewer' ? (
                        <div className="add-place-section">
                            <h3 className="section-title">İzleyici Modu</h3>
                            <div style={{ padding: '12px', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '12.5px', lineHeight: '1.5' }}>
                                <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '4px' }}>Salt-Okunur Erişim</strong>
                                İzleyici rolündeyiz. Çizim yapma yetkisi bulunmamaktadır. Editörler tarafından çizilen nesneleri haritada inceleyebilirsiniz.
                            </div>
                        </div>
                    ) : (
                        <div className="add-place-section">
                            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="3" fill="#3b82f6" />
                                </svg>
                                {t.addPlaceTitle}
                            </h3>
                            <p className="section-subtitle">
                                {t.addPlaceSubtitle}
                            </p>

                            <form onSubmit={handleSavePlace} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">{t.placeNameLabel}</label>
                                    <input
                                        type="text"
                                        value={placeName}
                                        onChange={(e) => setPlaceName(e.target.value)}
                                        placeholder={t.placeNamePlaceholder}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="input-label">{t.longitudeLabel}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={coords.lon}
                                            onChange={(e) => setCoords(prev => ({ ...prev, lon: e.target.value }))}
                                            placeholder={t.longitudePlaceholder}
                                            required
                                        />
                                    </div>

                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="input-label">{t.latitudeLabel}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={coords.lat}
                                            onChange={(e) => setCoords(prev => ({ ...prev, lat: e.target.value }))}
                                            placeholder={t.latitudePlaceholder}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">
                                        {t.colorPaletteLabel}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#ffffff', padding: '5px 7px', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1', boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                                        <button
                                            type="button"
                                            className="palette-icon-btn"
                                            onClick={() => {
                                                if (placeColorInputRef.current?.showPicker) {
                                                    placeColorInputRef.current.showPicker();
                                                } else {
                                                    placeColorInputRef.current?.click();
                                                }
                                            }}
                                            title="Renk Paletini Aç (Color Picker)"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '28px',
                                                height: '26px',
                                                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                                border: '1.5px solid #3b82f6',
                                                borderRadius: '5px',
                                                cursor: 'pointer',
                                                color: '#3b82f6',
                                                boxShadow: 'none',
                                                transition: 'transform 0.15s ease',
                                                flexShrink: 0
                                            }}
                                        >
                                            <DetailedPaletteIcon size={16} />
                                        </button>

                                        <input
                                            ref={placeColorInputRef}
                                            type="color"
                                            value={placeColor}
                                            onChange={(e) => setPlaceColor(e.target.value)}
                                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                        />

                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    type="button"
                                                    key={c.hex}
                                                    onClick={() => setPlaceColor(c.hex)}
                                                    style={{
                                                        width: '15px',
                                                        height: '15px',
                                                        borderRadius: '50%',
                                                        backgroundColor: c.hex,
                                                        border: placeColor === c.hex ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0f172a') : (isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.25)'),
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    title={`${c.label} (${c.hex})`}
                                                />
                                            ))}
                                        </div>

                                        <div
                                            title={`Seçili Nokta Rengi: ${placeColor}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '2px 5px',
                                                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                border: `1.5px solid ${placeColor}`,
                                                borderRadius: '5px',
                                                marginLeft: 'auto',
                                                flexShrink: 0
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: placeColor,
                                                    display: 'inline-block',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: isDarkMode ? '#f8fafc' : '#0f172a', fontFamily: 'monospace' }}>
                                                {placeColor.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                                    <button
                                        type="submit"
                                        style={{
                                            height: '38px',
                                            width: '100%',
                                            backgroundColor: '#16a34a',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                            boxSizing: 'border-box',
                                            margin: 0,
                                            padding: '0 6px',
                                            boxShadow: 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                            <polyline points="17 21 17 13 7 13 7 21" />
                                            <polyline points="7 3 7 8 15 8" />
                                        </svg>
                                        <span>{t.saveLocationBtn || 'Konum Kaydet'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleInitiateTwoPointDirections}
                                        style={{
                                            height: '38px',
                                            width: '100%',
                                            backgroundColor: directionsState.active && directionsState.selectingPoint ? '#2563eb' : '#3b82f6',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                            boxSizing: 'border-box',
                                            margin: 0,
                                            padding: '0 6px',
                                            boxShadow: 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = (directionsState.active && directionsState.selectingPoint ? '#2563eb' : '#3b82f6')}
                                        title={t.tabDirections || 'İki Nokta Arası Yol Tarifi Al'}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <polygon points="12 2 22 12 12 22 2 12" />
                                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                                        </svg>
                                        <span>{t.tabDirections || 'Yol Tarifi Al'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="sidebar-divider"></div>

                    {/* KAYITLI KONUMLAR VE ÇİZİMLER LİSTESİ (AÇILIR / KAPANIR BÖLME) */}
                    <div className="saved-places-section">
                        <div 
                            className="section-header" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                marginBottom: isSavedDrawingsOpen ? '10px' : '0',
                                cursor: 'pointer',
                                userSelect: 'none',
                                padding: '4px 0',
                                gap: '8px',
                                width: '100%'
                            }}
                            onClick={() => setIsSavedDrawingsOpen(prev => !prev)}
                            title="Kayıtlı Çizimler Bölmesini Aç / Kapat"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                <svg 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2.4" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    style={{ 
                                        transform: isSavedDrawingsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', 
                                        transition: 'transform 0.2s ease',
                                        color: '#3b82f6',
                                        flexShrink: 0
                                    }}
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                                <h3 className="section-title" style={{ margin: 0, fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                                    {t.savedPlacesTitle}
                                </h3>
                            </div>
                            <span 
                                className="places-count-badge"
                                style={{ 
                                    whiteSpace: 'nowrap', 
                                    flexShrink: 0, 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: '3px',
                                    lineHeight: 1
                                }}
                            >
                                {filteredDrawings.length} {t.recordsBadge}
                            </span>
                        </div>

                        {isSavedDrawingsOpen && (
                            filteredDrawings.length === 0 ? (
                                <p className="no-places-msg">{t.noRecordsMsg}</p>
                            ) : (
                                <div className="saved-places-list">
                                    {/* Kayıtlı Çizimler / Konumlar */}
                                    {filteredDrawings.map((drawing) => (
                                        <div
                                            key={`drawing-${drawing.type}-${drawing.id}`}
                                            className="saved-place-item"
                                            onClick={() => handleSelectDrawing(drawing, false)}
                                        >
                                            <div className="place-item-icon">
                                                {drawing.type === 'Point' ? (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <circle cx="12" cy="12" r="7.5" fill={drawing.color || "#3b82f6"} stroke={drawing.color === '#ffffff' || drawing.color?.toLowerCase() === '#fff' ? '#94a3b8' : '#ffffff'} strokeWidth="1.5" />
                                                    </svg>
                                                ) : drawing.type === 'Line' ? (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#3b82f6"} strokeWidth="3.5" strokeLinecap="round">
                                                        <path d="M4 20L20 4" />
                                                    </svg>
                                                ) : (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={drawing.color || "#10b981"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="12 2 22 8.5 18 19 6 19 2 8.5" fill={hexToRgba(drawing.color || '#10b981', 0.6)} />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="place-item-info" style={{ flex: 1 }}>
                                                <span className="place-item-name">{drawing.name}</span>
                                                <span className="place-item-coords">
                                                    {drawing.type === 'Line' ? t.lineTypeLabel : drawing.type === 'Polygon' ? t.polygonTypeLabel : t.pointTypeLabel}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                className="btn-info-drawing"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectDrawing(drawing, true);
                                                }}
                                                title={t.btnInfoTooltip || "Bilgisini Göster"}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                </svg>
                                            </button>

                                            {userRole !== 'Viewer' && canEditDrawing(drawing) && (
                                                <button
                                                    className="btn-delete-drawing"
                                                    onClick={(e) => triggerDeleteDrawing(drawing, e)}
                                                    title="Çizimi Sil"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className="map-sidebar-bottom">
                    {/* GİRİŞ YAPAN KULLANICI PROFİL KUTUSU & YANINDA TEMA + DİL BUTONLARI */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        {token && (
                            <div
                                className="user-profile-badge-box"
                                onClick={() => setIsProfileDrawerOpen(true)}
                                title={t.profileMenu || "Kullanıcı Profili ve Kişisel Alan"}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    flex: 1,
                                    minWidth: 0,
                                    height: '42px',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <div className="user-profile-avatar" style={{ backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(loggedInUsername || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="user-profile-details" style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <span className="user-profile-username" title={loggedInUsername || 'Kullanıcı'} style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {loggedInUsername || 'Kullanıcı'}
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </span>
                                    <span className={`user-profile-role-tag ${userRole?.toLowerCase()}`}>
                                        {userRole || 'Viewer'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Karanlık / Aydınlık Mod Butonu (Yalnızca İkon) */}
                        <button
                            type="button"
                            className="theme-toggle-btn"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? t.lightMode : t.darkMode}
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                color: isDarkMode ? '#f8fafc' : '#1e293b',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                        >
                            {isDarkMode ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            )}
                        </button>

                        {/* Dil Seçim Butonu */}
                        <button
                            type="button"
                            className="theme-toggle-btn lang-toggle-btn"
                            onClick={toggleLang}
                            title={t.languageSelect}
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                        >
                            {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                        </button>
                    </div>

                    {/* ALT EYLEM BUTONLARI: 1. ADMİN, 2. ÇIKIŞ YAP (MINI BAR İLE SENKRON) */}
                    <div className="map-sidebar-bottom-actions">
                        {/* Admin / Güzergah Yönetim Paneli Butonu (Yalnızca Admin ve Operatör İçin) */}
                        {(isAdmin || userRole === 'Admin' || isTransportOperator) && (
                            <button
                                className="btn-admin-sidebar-compact"
                                onClick={() => setCurrentView('admin')}
                                title={isAdmin ? (t.adminPanel || "Admin Paneli") : (t.routeManagement || "Güzergah Yönetimi")}
                                style={{
                                    flex: 1,
                                    backgroundColor: isTransportOperator ? '#0284c7' : undefined
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>{isAdmin ? (t.adminPanel || "Admin") : (t.routeManagement || "Güzergah")}</span>
                            </button>
                        )}

                        {/* Editör İşbirliği Butonu (Editörler İçin) */}
                        {!isAdmin && (userRole === 'Editor' || userRole === 'Editör') && (
                            <button
                                className="btn-admin-sidebar-compact btn-collab-header"
                                onClick={() => {
                                    fetchCollaborations();
                                    setShowCollaborationModal(true);
                                }}
                                title="Editör İşbirliği & İstekler"
                                style={{
                                    position: 'relative',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <span>{t.collaborationShortBtn}</span>
                                {pendingIncoming.length > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        backgroundColor: '#ef4444',
                                        color: '#ffffff',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid #ffffff',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                    }}>
                                        {pendingIncoming.length}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Küçültülmüş Çıkış Yap Butonu */}
                        <button onClick={() => handleLogout()} className="btn-logout-compact" title={t.logout}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>{t.logout}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KÜÇÜLTÜLMÜŞ SOL BAR (SOL MENÜ KAPANDIĞINDA ÇALIŞAN MINIMAL DOCK) */}
            {!isSidebarOpen && (
                <div
                    className="map-sidebar-mini"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Üst Grup: Menüyü Aç, Yol Tarifi, Editör İşbirliği */}
                    <div className="mini-sidebar-group">
                        {/* Menüyü Aç (Sidebar Expand) */}
                        <button
                            type="button"
                            className="mini-sidebar-btn mini-sidebar-toggle-btn"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                setTimeout(() => mapRef.current?.updateSize(), 300);
                            }}
                            title={t.openSidebar || 'Menüyü Aç'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                        <div className="mini-sidebar-divider" />

                        {/* Yol Tarifi Al Tuşu */}
                        <button
                            type="button"
                            className={`mini-sidebar-btn ${directionsState.active ? 'active-directions' : ''}`}
                            onClick={handleInitiateTwoPointDirections}
                            title={t.directionsTitle || 'Yol Tarifi Al'}
                            style={{
                                color: directionsState.active ? '#ffffff' : (isDarkMode ? '#38bdf8' : '#2563eb')
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                            </svg>
                        </button>

                        {/* Editör İşbirliği Tuşu (Editörler için) */}
                        {!isAdmin && (userRole === 'Editor' || userRole === 'Editör') && (
                            <button
                                type="button"
                                className="mini-sidebar-btn"
                                onClick={() => {
                                    fetchCollaborations();
                                    setShowCollaborationModal(true);
                                }}
                                title="Editör İşbirliği & İstekler"
                                style={{
                                    position: 'relative',
                                    color: '#2563eb'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                {pendingIncoming.length > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        backgroundColor: '#ef4444',
                                        color: '#ffffff',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        width: '15px',
                                        height: '15px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1.5px solid #ffffff'
                                    }}>
                                        {pendingIncoming.length}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Alt Grup: Karanlık Mod, Dil ve Bölümlendirilmiş Profil, Admin, Çıkış Yap */}
                    <div className="mini-sidebar-group">
                        {/* Karanlık Mod Tuşu */}
                        <button
                            type="button"
                            className="mini-sidebar-btn"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? t.lightMode : t.darkMode}
                        >
                            {isDarkMode ? (
                                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            ) : (
                                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            )}
                        </button>

                        {/* Dil Tuşu */}
                        <button
                            type="button"
                            className="mini-sidebar-btn"
                            onClick={toggleLang}
                            title={t.languageSelect}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {lang === 'tr' ? <TurkeyFlag /> : <UKFlag />}
                        </button>

                        <div className="mini-sidebar-divider" />

                        {/* 1. Profil Menüsü Tuşu */}
                        {token && (
                            <button
                                type="button"
                                className="mini-sidebar-btn"
                                onClick={() => setIsProfileDrawerOpen(true)}
                                title={loggedInUsername ? `Profil: ${loggedInUsername} (${userRole || 'Viewer'})` : "Kullanıcı Profili"}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
                                }}>
                                    {(loggedInUsername || 'U').charAt(0).toUpperCase()}
                                </div>
                            </button>
                        )}

                        {/* 2. Admin / Güzergah Yönetim Tuşu */}
                        {(isAdmin || userRole === 'Admin' || isTransportOperator) && (
                            <button
                                type="button"
                                className="mini-sidebar-btn"
                                onClick={() => setCurrentView('admin')}
                                title={isAdmin ? (t.adminPanel || "Admin Paneli") : (t.routeManagement || "Güzergah Yönetimi")}
                                style={{
                                    color: isDarkMode ? '#cbd5e1' : '#475569'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </button>
                        )}

                        {/* 3. Çıkış Yap Tuşu */}
                        <button
                            type="button"
                            className="mini-sidebar-btn mini-sidebar-logout-btn"
                            onClick={() => handleLogout()}
                            title={t.logout}
                            style={{ color: '#ef4444' }}
                        >
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* GOOGLE MAPS TARZI POI VE MEKAN ARAMA BARI (TÜM ROLLERE AÇIK) */}
            <div
                ref={poiSearchContainerRef}
                className="poi-search-floating-wrapper"
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: isSidebarOpen ? '430px' : '86px',
                    zIndex: 1004,
                    transition: 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: '380px',
                    maxWidth: 'calc(100vw - 120px)'
                }}
            >
                <div className={`poi-search-box ${isPoiSearchFocused ? 'focused' : ''}`}>
                    <div className="poi-search-icon-left">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>

                    <input
                        type="text"
                        className="poi-search-input"
                        placeholder={t.poiSearchPlaceholder || "POI veya mekan ara (Örn: Kafe, Hastane, Park)..."}
                        value={poiSearchQuery}
                        onChange={(e) => {
                            setPoiSearchQuery(e.target.value);
                            setIsPoiSearchFocused(true);
                        }}
                        onFocus={() => setIsPoiSearchFocused(true)}
                    />

                    {poiSearchQuery && (
                        <button
                            type="button"
                            className="poi-search-clear-btn"
                            onClick={() => {
                                setPoiSearchQuery('');
                                setSelectedSearchCatFilter('ALL');
                            }}
                            title={t.clearSearch || "Aramayı Temizle"}
                        >
                            <CloseIcon size={12} />
                        </button>
                    )}

                    <div className="poi-search-badge-count">
                        {filteredSearchResults.length > 0 ? `${filteredSearchResults.length} POI` : (pois.length > 0 ? `${pois.length} POI` : '')}
                    </div>
                </div>

                {/* ARAMA SONUÇLARI AÇILIR LİSTESİ */}
                {isPoiSearchFocused && (
                    <div className="poi-search-dropdown-menu">
                        {/* KATEGORİ HIZLI FİLTRELEME ÇİPLERİ */}
                        {poiCategories.length > 0 && (
                            <div className="poi-search-category-chips">
                                <button
                                    type="button"
                                    className={`poi-cat-chip ${selectedSearchCatFilter === 'ALL' ? 'active' : ''}`}
                                    onClick={() => setSelectedSearchCatFilter('ALL')}
                                >
                                    {t.allPois || 'Tümü'} ({pois.length})
                                </button>
                                {poiCategories.filter(c => !c.parentId).map(cat => {
                                    const count = pois.filter(p => p.categoryId === cat.id).length;
                                    const catLocalizedName = getLocalizedPoiCategoryLabel(cat.name, lang);
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`poi-cat-chip ${selectedSearchCatFilter === String(cat.id) ? 'active' : ''}`}
                                            onClick={() => setSelectedSearchCatFilter(String(cat.id))}
                                            style={{
                                                borderColor: selectedSearchCatFilter === String(cat.id) ? cat.color : undefined
                                            }}
                                        >
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color || '#3b82f6', display: 'inline-block', marginRight: '4px' }} />
                                            {catLocalizedName} ({count})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* SONUÇ LİSTESİ */}
                        <div className="poi-search-results-list">
                            {filteredSearchResults.length > 0 ? (
                                filteredSearchResults.map(poi => {
                                    const catColor = poi.categoryColor || '#3b82f6';
                                    const isPolygon = (poi.wkt || '').toUpperCase().includes('POLYGON');
                                    return (
                                        <div
                                            key={poi.id}
                                            className="poi-search-result-item"
                                            onClick={() => handleZoomToSearchResultPoi(poi)}
                                        >
                                            <div
                                                className="poi-result-icon-circle"
                                                style={{ border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                dangerouslySetInnerHTML={{
                                                    __html: getPoiCategoryBadgeSvg(poi.categoryName || '', poi.categoryIcon || '', catColor)
                                                }}
                                            />

                                            <div className="poi-result-info">
                                                <div className="poi-result-title-row">
                                                    <span className="poi-result-name">{poi.name}</span>
                                                    <span className="poi-result-cat-badge" style={{ backgroundColor: hexToRgba(catColor, 0.2), color: catColor, borderColor: hexToRgba(catColor, 0.3) }}>
                                                        {poi.categoryName || (lang === 'tr' ? 'Genel' : 'General')}
                                                    </span>
                                                </div>
                                                {poi.description && (
                                                    <div className="poi-result-desc">{poi.description}</div>
                                                )}
                                                {poi.workingHours && (
                                                    <div className="poi-result-hours">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '4px' }}>
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        {poi.workingHours}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="poi-result-arrow">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="poi-search-empty-state">
                                    {poiSearchQuery ? (
                                        <>
                                            <p style={{ margin: 0, fontWeight: 600, color: '#f87171' }}>{t.noResultsFound || 'Sonuç bulunamadı'}</p>
                                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>"{poiSearchQuery}" {t.noMatchingPoi || 'ile eşleşen POI kaydı yok.'}</span>
                                        </>
                                    ) : (
                                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>{t.noCategoryPoi || 'Bu kategoride kayıtlı POI bulunmamaktadır.'}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* GOOGLE EARTH TARZI TARİHSEL UYDU ZAMAN ÇİZELGESİ (ESRI WAYBACK) */}
            <HistoricalTimelineSlider
                selectedLayerId={selectedBaseLayer}
                onSelectLayer={handleSelectBaseLayer}
                onClose={() => handleSelectBaseLayer('google_hybrid')}
                isSidebarOpen={isSidebarOpen}
            />

            {/* HARİTA FİLTRELEME YÜZER PANELİ */}
            {showFilterPanel && (
                <div
                    className="map-filter-panel-floating"
                    style={{
                        position: 'absolute',
                        top: '128px',
                        right: '76px',
                        width: '280px',
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        border: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                        zIndex: 1005,
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            {t.mapFilterTitle || (isTr ? 'Harita Filtreleme' : 'Map Filtering')}
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowFilterPanel(false)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={t.closeBtn || 'Kapat'}
                        >
                            <CloseIcon size={15} />
                        </button>
                    </div>

                    {/* 1. ŞEKİL TÜRÜ FİLTRESİ */}
                    <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            {t.filterByGeometryType || (isTr ? 'Şekil Türüne Göre' : 'By Feature Type')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                            {[
                                { id: 'ALL', label: t.allPois || (isTr ? 'Tümü' : 'All') },
                                { id: 'Point', label: t.toolPointLabel || (isTr ? 'Nokta' : 'Point') },
                                { id: 'Line', label: t.toolLineLabel || (isTr ? 'Çizgi' : 'Line') },
                                { id: 'Polygon', label: t.toolPolygonLabel || (isTr ? 'Poligon' : 'Polygon') }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedTypeFilter(item.id)}
                                    style={{
                                        padding: '5px 0',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: selectedTypeFilter === item.id ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                        backgroundColor: selectedTypeFilter === item.id ? '#2563eb' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                                        color: selectedTypeFilter === item.id ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                        cursor: 'pointer'
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. EDİTÖR / KULLANICI FİLTRESİ */}
                    <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            {t.filterByEditor || (isTr ? 'Editöre / Kullanıcıya Göre' : 'By Editor / User')}
                        </label>
                        <select
                            value={selectedEditorFilter}
                            onChange={(e) => setSelectedEditorFilter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 10px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                border: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                                color: isDarkMode ? '#f8fafc' : '#0f172a',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL">{t.allEditorsUsers || (isTr ? 'Tüm Editörler / Kullanıcılar' : 'All Editors / Users')}</option>
                            {Array.from(new Set(savedDrawings.map(d => d.insertedUsername || (d.insertedUserId === 1 ? 'asdf.admin' : `${isTr ? 'Kullanıcı' : 'User'} #${d.insertedUserId}`))))
                                .filter(Boolean)
                                .map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* TEMİZLEME BUTONU */}
                    {(selectedTypeFilter !== 'ALL' || selectedEditorFilter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTypeFilter('ALL');
                                setSelectedEditorFilter('ALL');
                            }}
                            style={{
                                padding: '6px',
                                fontSize: '11px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid #ef4444',
                                color: '#f87171',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginTop: '4px'
                            }}
                        >
                            {t.clearFiltersBtn || (isTr ? 'Filtreleri Temizle' : 'Clear Filters')}
                        </button>
                    )}
                </div>
            )}

            {/* HARİTA ÜZERİNDEKİ SAĞ ARAÇ ÇUBUĞU (AMAÇLARINA GÖRE GRUPLANDIRILMIŞ) */}
            <div className="map-draw-toolbar-floating">
                {/* 1. GRUP: KATMAN & FİLTRELEME ARAÇLARI */}
                <div className="toolbar-group" title={isTr ? "Katman ve Filtreleme" : "Layer and Filtering"}>
                    {/* HARİTA KATMANLARI VE GÖRÜNÜRLÜK SEÇİCİ */}
                    <MapLayerSwitcher
                        selectedLayerId={selectedBaseLayer}
                        onSelectLayer={handleSelectBaseLayer}
                        direction="left"
                        layerVisibility={layerVisibility}
                        onToggleLayerVisibility={handleToggleLayerVisibility}
                        currentZoom={currentZoom}
                        heatmapTypeFilter={heatmapTypeFilter}
                        onChangeHeatmapFilter={setHeatmapTypeFilter}
                        heatmapFeatureCount={heatmapSourceRef.current ? heatmapSourceRef.current.getFeatures().length : 0}
                        isOpen={showLayerMenu}
                        poiCategories={poiCategories}
                        lang={lang}
                        onToggleOpen={(val) => {
                            setShowLayerMenu(val);
                            if (val) setShowFilterPanel(false);
                        }}
                    />

                    {/* HARİTA KATMAN FİLTRELEME BUTONU */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className={`map-tool-icon-btn ${showFilterPanel ? 'active' : ''}`}
                            onClick={() => {
                                setShowFilterPanel(prev => {
                                    const next = !prev;
                                    if (next) setShowLayerMenu(false);
                                    return next;
                                });
                            }}
                            title="Harita Katman & Veri Filtresi"
                            data-tooltip="Filtreleme Menüsü"
                            style={{ position: 'relative' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                        </button>

                        {/* HARİTA KATMAN VE VERİ FİLTRELEME PANELİ (YÜZER KART - CHECKBOX'LI) */}
                        {showFilterPanel && (
                            <div
                                className="map-layer-selector-card"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 'calc(100% + 12px)',
                                    width: '320px',
                                    zIndex: 1005,
                                    animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                            >
                                {/* Header */}
                                <div className="layer-selector-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                        </svg>
                                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>
                                            Harita Katman Filtresi
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowFilterPanel(false)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Kapat"
                                    >
                                        <CloseIcon size={14} />
                                    </button>
                                </div>

                                <div style={{ padding: '10px 12px 14px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3 }}>
                                        Haritada gösterilmesini istediğiniz katmanları checkbox'lar ile filtreleyin:
                                    </div>

                                    {/* 1. TOPLU TAŞIMA DURAKLARI CHECKBOX */}
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: layerVisibility.stops ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${layerVisibility.stops ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                            <div style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '6px',
                                                background: 'rgba(239, 68, 68, 0.2)',
                                                color: '#ef4444',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="4" y="4" width="16" height="13" rx="2" />
                                                    <path d="M4 9h16" />
                                                    <circle cx="7.5" cy="14" r="1.2" fill="currentColor" />
                                                    <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
                                                    <path d="M6 17v2.5M18 17v2.5" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Ulaşım Durakları</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Toplu Taşıma & Otobüs Durakları</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!layerVisibility.stops}
                                            onChange={() => handleToggleLayerVisibility('stops')}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#ef4444' }}
                                        />
                                    </label>

                                    {/* 2. GÜZERGAH VE HAT ÇİZGİLERİ CHECKBOX */}
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: layerVisibility.routes ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${layerVisibility.routes ? 'rgba(2, 132, 199, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                            <div style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '6px',
                                                background: 'rgba(2, 132, 199, 0.2)',
                                                color: '#38bdf8',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 12h4l3 8 4-16 3 8h4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Hat & Güzergah Çizgileri</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Metro & Otobüs Rotaları</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!layerVisibility.routes}
                                            onChange={() => handleToggleLayerVisibility('routes')}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#0284c7' }}
                                        />
                                    </label>

                                    {/* Bireysel Güzergah Açma / Kapatma Listesi (Katman Kontrolü) */}
                                    {layerVisibility.routes && routes.length > 0 && (
                                        <div style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : '#f1f5f9',
                                            maxHeight: '140px',
                                            overflowY: 'auto'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1' }}>
                                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Güzergahlar ({routes.length})</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHiddenRouteIds(new Set())}
                                                        style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                                    >
                                                        Tümü
                                                    </button>
                                                    <span style={{ color: '#64748b', fontSize: '10px' }}>•</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHiddenRouteIds(new Set(routes.map(r => r.id)))}
                                                        style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                                    >
                                                        Gizle
                                                    </button>
                                                </div>
                                            </div>
                                            {routes.map(r => {
                                                const isVisible = !hiddenRouteIds.has(r.id);
                                                const isSelected = selectedRouteInfo?.id === r.id;
                                                const currentSim = activeSimulations[r.id] || activeSimulations[Number(r.id)] || activeSimulations[String(r.id)];
                                                const isRunning = Boolean(currentSim?.isRunning);
                                                const isPaused = Boolean(currentSim?.isPaused);

                                                return (
                                                    <div
                                                        key={r.id}
                                                        onClick={() => {
                                                            setSelectedRouteInfo(r);
                                                            setSelectedStopInfo(null);
                                                            setSelectedPoiInfo(null);
                                                            setSelectedPointInfo(null);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '5px 7px',
                                                            borderRadius: '6px',
                                                            backgroundColor: isSelected
                                                                ? (isDarkMode ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)')
                                                                : (isVisible ? (isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#ffffff') : 'transparent'),
                                                            border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            gap: '6px',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title="Güzergahı seç ve simülasyon panelini aç"
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.color || '#3b82f6', flexShrink: 0 }} />
                                                            {(() => {
                                                                const rClassInfo = getRouteClassInfo(r.routeClass);
                                                                return (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }} title={`Sınıf: ${rClassInfo.label}`}>
                                                                        <RouteClassIcon classKey={rClassInfo.id} size={13} color={rClassInfo.color} />
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span style={{ color: isVisible ? (isDarkMode ? '#f1f5f9' : '#0f172a') : '#64748b', fontWeight: isVisible ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {r.name}
                                                            </span>
                                                            {isRunning && (
                                                                <span className="sim-live-indicator" style={{ padding: '1px 5px', fontSize: '9px', gap: '4px' }} title={isPaused ? "Simülasyon Duraklatıldı" : "Canlı Araç Simülasyonu Aktif"}>
                                                                    <span className="live-pulse-dot" style={{ width: '6px', height: '6px', backgroundColor: isPaused ? '#f59e0b' : '#10b981' }}></span>
                                                                    <span style={{ color: isPaused ? '#f59e0b' : '#10b981' }}>{isPaused ? 'DURAK' : 'CANLI'}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* SİMÜLASYON KONTROL BUTONLARI & KATMAN CHECKBOX */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                                            {isRunning ? (
                                                                <>
                                                                    {isPaused ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleResumeSimulation(r.id, e)}
                                                                            disabled={simLoadingId === r.id || isSimLoading}
                                                                            title="Duraklatılan simülasyona devam et"
                                                                            style={{
                                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                                border: '1px solid #10b981',
                                                                                color: '#10b981',
                                                                                padding: '3px 6px',
                                                                                cursor: 'pointer',
                                                                                borderRadius: '4px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '3px',
                                                                                fontSize: '10px',
                                                                                fontWeight: 700
                                                                            }}
                                                                        >
                                                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                                                            <span>Devam Et</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handlePauseSimulation(r.id, e)}
                                                                            disabled={simLoadingId === r.id || isSimLoading}
                                                                            title="Simülasyon hareketini duraklat"
                                                                            style={{
                                                                                background: 'rgba(245, 158, 11, 0.15)',
                                                                                border: '1px solid #f59e0b',
                                                                                color: '#f59e0b',
                                                                                padding: '3px 6px',
                                                                                cursor: 'pointer',
                                                                                borderRadius: '4px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '3px',
                                                                                fontSize: '10px',
                                                                                fontWeight: 700
                                                                            }}
                                                                        >
                                                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                                                            <span>Duraklat</span>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleStopSimulation(r.id, e)}
                                                                        disabled={simLoadingId === r.id || isSimLoading}
                                                                        title="Simülasyonu kapat ve aracı haritadan kaldır"
                                                                        style={{
                                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                                            border: '1px solid #ef4444',
                                                                            color: '#ef4444',
                                                                            padding: '3px 6px',
                                                                            cursor: 'pointer',
                                                                            borderRadius: '4px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            fontSize: '10px',
                                                                            fontWeight: 700
                                                                        }}
                                                                    >
                                                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                                                                        <span>İptal Et</span>
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                    <select
                                                                        value={simSpeedMap[r.id] || 1}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            setSimSpeedMap(prev => ({ ...prev, [r.id]: val }));
                                                                        }}
                                                                        title="Simülasyon Hızı"
                                                                        style={{
                                                                            padding: '2px 4px',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                                                                            color: isDarkMode ? '#94a3b8' : '#64748b',
                                                                            fontSize: '10px',
                                                                            fontWeight: 700,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <option value="1">1x</option>
                                                                        <option value="1.5">1.5x</option>
                                                                        <option value="2">2x</option>
                                                                        <option value="2.5">2.5x</option>
                                                                    </select>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleStartSimulation(r.id, e)}
                                                                        disabled={simLoadingId === r.id || isSimLoading}
                                                                        title="Canlı araç simülasyonu başlat"
                                                                        style={{
                                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                                            border: '1px solid #10b981',
                                                                            color: '#10b981',
                                                                            padding: '3px 6px',
                                                                            cursor: 'pointer',
                                                                            borderRadius: '4px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            fontSize: '10px',
                                                                            fontWeight: 700
                                                                        }}
                                                                    >
                                                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                                                        <span>Simülasyonu Başlat</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <input
                                                                type="checkbox"
                                                                checked={isVisible}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={() => handleToggleIndividualRouteVisibility(r.id)}
                                                                style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: r.color || '#3b82f6', marginLeft: '3px' }}
                                                                title="Katman görünürlüğünü aç/kapat"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* 3. POI (İLGİ NOKTALARI) CHECKBOX */}
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: layerVisibility.pois ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${layerVisibility.pois ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                            <div style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '6px',
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                color: '#10b981',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>POI (İlgi Noktaları)</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Mekan ve Kategori Pinleri</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!layerVisibility.pois}
                                            onChange={() => handleToggleLayerVisibility('pois')}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#10b981' }}
                                        />
                                    </label>

                                    {/* 4. KULLANICI ÇİZİMLERİ CHECKBOX */}
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: layerVisibility.drawings ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${layerVisibility.drawings ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                            <div style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '6px',
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                color: '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Kullanıcı Çizimleri</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Nokta, Çizgi, Poligonlar</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!layerVisibility.drawings}
                                            onChange={() => handleToggleLayerVisibility('drawings')}
                                            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                        />
                                    </label>

                                    {/* BUTONLAR: TÜMÜNÜ SEÇ & TÜMÜNÜ GİZLE */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLayerVisibility({ routes: true, stops: true, pois: true, drawings: true, heatmap: isHeatmapActive });
                                                if (routeLayerRef.current) routeLayerRef.current.setVisible(true);
                                                if (stopLayerRef.current) stopLayerRef.current.setVisible(true);
                                                if (poiLayerRef.current) poiLayerRef.current.setVisible(true);
                                                if (drawingsLayerRef.current) drawingsLayerRef.current.setVisible(true);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '6px 8px',
                                                background: 'rgba(37, 99, 235, 0.2)',
                                                border: '1px solid rgba(37, 99, 235, 0.4)',
                                                borderRadius: '6px',
                                                color: '#60a5fa',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Tümünü Seç
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLayerVisibility({ routes: false, stops: false, pois: false, drawings: false, heatmap: false });
                                                if (routeLayerRef.current) routeLayerRef.current.setVisible(false);
                                                if (stopLayerRef.current) stopLayerRef.current.setVisible(false);
                                                if (poiLayerRef.current) poiLayerRef.current.setVisible(false);
                                                if (drawingsLayerRef.current) drawingsLayerRef.current.setVisible(false);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '6px 8px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                borderRadius: '6px',
                                                color: '#ef4444',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Tümünü Gizle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. GRUP: AKILLI ULAŞIM ARAÇLARI (Operatör, Admin & Editör) */}
                {canManageTransport && (
                    <>
                        <div className="map-draw-toolbar-divider" />
                        <div className="toolbar-group" title="Akıllı Ulaşım Araçları">
                            {/* GÜZERGAH & DURAK YÖNETİMİ BUTONU (Yalnızca Editör ve Operatör İçin - Admin Sol Menüden Erişir) */}
                            {!isAdmin && userRole !== 'Admin' && (
                                <button
                                    className="map-tool-icon-btn route-tool-btn"
                                    onClick={() => {
                                        setCurrentView('admin');
                                    }}
                                    title="Güzergah & Durak Yönetimi Paneli"
                                    data-tooltip="Güzergah & Duraklar"
                                    style={{
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        boxShadow: 'none'
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="4" width="16" height="13" rx="2" />
                                        <path d="M4 9h16" />
                                        <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                                        <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                                        <path d="M6 17v2.5M18 17v2.5" />
                                    </svg>
                                </button>
                            )}

                            {/* DURAK EKLEME ARACI */}
                            <button
                                className={`map-tool-icon-btn stop-tool-btn ${drawType === 'Stop' ? 'active' : ''}`}
                                onClick={() => {
                                    if (drawType === 'Stop') handleCancelDraw();
                                    else {
                                        setDrawType('Stop');
                                        setInfoMessage(t.stopToastPickLocation || (isTr ? 'Durak eklemek istediğiniz konuma harita üzerinde tıklayınız.' : 'Click on the map to select the stop location.'));
                                        toastRef.current?.show({
                                            severity: 'info',
                                            summary: isTr ? 'Durak Ekleme Modu Aktif' : 'Add Stop Mode Active',
                                            detail: t.stopToastPickLocation || (isTr ? 'Haritada durağın bulunacağı noktaya tıklayınız.' : 'Click on the map where you want to add the stop.'),
                                            life: 3000
                                        });
                                    }
                                }}
                                title={isTr ? "Haritada Durak Ekle (Point)" : "Add Transit Stop (Point)"}
                                data-tooltip={isTr ? "Durak Ekle" : "Add Stop"}
                                style={{
                                    backgroundColor: drawType === 'Stop' ? '#dc2626' : undefined,
                                    color: drawType === 'Stop' ? '#ffffff' : '#ef4444',
                                    boxShadow: 'none'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}

                {/* 3. GRUP: ÇİZİM & POI ARAÇLARI (Admin & Editör) */}
                {canCreateDrawingsAndPoi && (
                    <>
                        <div className="map-draw-toolbar-divider" />
                        <div className="toolbar-group" title={isTr ? "Çizim ve İlgi Noktası (POI) Araçları" : "Drawing & POI Tools"}>
                            {/* POI NOKTASI EKLEME ARACI */}
                            <button
                                className={`map-tool-icon-btn poi-tool-btn ${drawType === 'Poi' ? 'active' : ''}`}
                                onClick={() => {
                                    if (drawType === 'Poi') handleCancelDraw();
                                    else {
                                        setDrawType('Poi');
                                        const poiMsg = t.poiToastPickLocation || (isTr ? 'POI eklemek istediğiniz konuma harita üzerinde tıklayınız.' : 'Click on the map where you want to add the POI.');
                                        setInfoMessage(poiMsg);
                                        toastRef.current?.show({
                                            severity: 'success',
                                            summary: isTr ? 'Başarılı' : 'Success',
                                            detail: poiMsg,
                                            life: 3000
                                        });
                                    }
                                }}
                                title={isTr ? "POI Noktası Ekle (Point)" : "Add POI (Point/Polygon)"}
                                data-tooltip={isTr ? "POI Ekle" : "Add POI"}
                                style={{ boxShadow: 'none' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </button>

                            {/* ÇİZGİ ÇİZİM ARACI */}
                            <button
                                className={`map-tool-icon-btn ${drawType === 'LineString' ? 'active' : ''}`}
                                onClick={() => {
                                    if (drawType === 'LineString') handleCancelDraw();
                                    else setDrawType('LineString');
                                }}
                                title={t.toolLineTitle}
                                data-tooltip={t.drawingLineMode}
                                style={{ boxShadow: 'none' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 20L20 4" />
                                    <circle cx="4" cy="20" r="2.5" fill="currentColor" />
                                    <circle cx="20" cy="4" r="2.5" fill="currentColor" />
                                </svg>
                            </button>

                            {/* POLİGON ÇİZİM ARACI */}
                            <button
                                className={`map-tool-icon-btn ${drawType === 'Polygon' ? 'active' : ''}`}
                                onClick={() => {
                                    if (drawType === 'Polygon') handleCancelDraw();
                                    else setDrawType('Polygon');
                                }}
                                title={t.toolPolygonTitle}
                                data-tooltip={t.drawingPolygonMode}
                                style={{ boxShadow: 'none' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}

                {/* 4. GRUP: MEKANSAL ANALİZ VE ISI HARİTASI ARAÇLARI */}
                <div className="map-draw-toolbar-divider" />
                <div className="toolbar-group" title="Analiz ve Isı Haritası Araçları">
                    {/* GEÇİCİ ENVANTER ANALİZİ ARACI (Admin & Editör) */}
                    {canCreateDrawingsAndPoi && (
                        <button
                            className={`map-tool-icon-btn analysis-tool-btn ${drawType === 'Analysis' ? 'active' : ''}`}
                            onClick={() => {
                                if (drawType === 'Analysis') handleCancelDraw();
                                else {
                                    setDrawType('Analysis');
                                }
                            }}
                            title={t.toolAnalysisTitle}
                            data-tooltip={t.toolAnalysisTitle}
                            style={{ boxShadow: 'none' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                <polygon points="10 8 13 11 11 14 8 12" />
                            </svg>
                        </button>
                    )}

                    {/* ÇOK KRİTERLİ KONUM ANALİZİ BUTONU (User Dahil Tüm Rollere Açık) */}
                    <button
                        className={`map-tool-icon-btn location-analysis-tool-btn ${showLocationAnalysisModal || locationAnalysisResult ? 'active' : ''}`}
                        onClick={handleOpenLocationAnalysisModal}
                        title={t.locationAnalysisBtnTooltip || (isTr ? "Çok Kriterli Konum Analizi (Ağırlıklı Isı Haritası)" : "Multi-Criteria Location Analysis (Weighted Heatmap)")}
                        data-tooltip={t.locationAnalysisTitle || (isTr ? "Konum Analizi" : "Location Analysis")}
                        style={{
                            background: (showLocationAnalysisModal || locationAnalysisResult) ? '#2563eb' : undefined,
                            color: (showLocationAnalysisModal || locationAnalysisResult) ? '#ffffff' : undefined,
                            border: (showLocationAnalysisModal || locationAnalysisResult) ? '1.5px solid #1d4ed8' : undefined,
                            boxShadow: 'none'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="6" />
                            <circle cx="12" cy="12" r="2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* POI TAŞIMA & POLİGON DÜZENLEME AKTİF BARI (Admin & Editor) */}
            {editingPoiState && (
                <div
                    className="floating-draw-bottom-bar poi-editing-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1015,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    {/* Mod Rozeti */}
                    <span
                        style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="5 9 2 12 5 15" />
                            <polyline points="9 5 12 2 15 5" />
                            <polyline points="15 19 12 22 9 19" />
                            <polyline points="19 9 22 12 19 15" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <line x1="12" y1="2" x2="12" y2="22" />
                        </svg>
                        <span>{editingPoiState.isPolygon ? (isTr ? 'POLİGON DÜZENLEME' : 'POLYGON EDITING') : (isTr ? 'KONUM TAŞIMA' : 'REPOSITION')}</span>
                    </span>

                    {/* POI Adı ve Yönerge */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{editingPoiState.poi.name}</strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {editingPoiState.isPolygon
                                ? (isTr ? 'Sınırları ve köşeleri sürükleyip bükerek şeklini düzenleyin' : 'Drag or bend vertices to adjust boundaries')
                                : (isTr ? 'İşaretçiyi haritada yeni yerine sürükleyin' : 'Drag pin to its new position on map')}
                        </span>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                        <button
                            type="button"
                            onClick={handleSavePoiGeometry}
                            disabled={isSavingPoiGeom}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: isSavingPoiGeom ? 'wait' : 'pointer',
                                boxShadow: 'none'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            <span>{isSavingPoiGeom ? (isTr ? 'Kaydediliyor...' : 'Saving...') : (isTr ? 'Kaydet' : 'Save')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCancelPoiEditing}
                            disabled={isSavingPoiGeom}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                borderRadius: '7px',
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                color: '#cbd5e1',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: 'pointer',
                                boxShadow: 'none'
                            }}
                        >
                            {isTr ? 'Vazgeç' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            {/* SADE VE NET YÜZER ÇİZİM BARI (Vektör Çizimler: Point, LineString, Polygon) */}
            {drawType !== 'None' && drawType !== 'Analysis' && drawType !== 'Poi' && drawType !== 'Stop' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: `1.5px solid ${drawingColor || '#3b82f6'}`,
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    {/* Mod Rozeti (Düz Renk - Gradyansız) */}
                    <span
                        style={{
                            backgroundColor: drawType === 'Polygon' ? '#8b5cf6' : drawType === 'LineString' ? '#06b6d4' : '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        {drawType === 'Point' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        )}
                        {drawType === 'LineString' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19L20 5" />
                                <circle cx="4" cy="19" r="2" />
                                <circle cx="20" cy="5" r="2" />
                            </svg>
                        )}
                        {drawType === 'Polygon' && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
                            </svg>
                        )}
                        {drawType === 'Point' ? (t.pointDrawingBanner || (isTr ? 'NOKTA ÇİZİMİ' : 'POINT DRAWING')) : drawType === 'LineString' ? (t.lineDrawingBanner || (isTr ? 'ÇİZGİ ÇİZİMİ' : 'LINE DRAWING')) : (t.polygonDrawingBanner || (isTr ? 'POLİGON ÇİZİMİ' : 'POLYGON DRAWING'))}
                    </span>

                    {/* İsim Girişi */}
                    <input
                        type="text"
                        className="floating-input"
                        style={{
                            width: '160px',
                            padding: '6px 10px',
                            fontSize: '12.5px',
                            borderRadius: '7px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            outline: 'none'
                        }}
                        value={drawingName}
                        onChange={(e) => setDrawingName(e.target.value)}
                        placeholder={t.drawingNamePlaceholder || (isTr ? "Çizim Adı" : "Drawing Name")}
                    />

                    {/* Eski Renk Seçimi Tasarımı (Palet Butonu + Renk Noktaları + Hex Gösterge Rozeti) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', flexWrap: 'nowrap' }}>
                        <button
                            type="button"
                            className="palette-icon-btn"
                            onClick={() => {
                                if (drawColorInputRef.current?.showPicker) {
                                    drawColorInputRef.current.showPicker();
                                } else {
                                    drawColorInputRef.current?.click();
                                }
                            }}
                            title="Renk Paleti"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '26px',
                                height: '26px',
                                backgroundColor: '#1e293b',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                color: '#3b82f6',
                                padding: 0,
                                flexShrink: 0
                            }}
                        >
                            <DetailedPaletteIcon size={16} />
                        </button>

                        <input
                            ref={drawColorInputRef}
                            type="color"
                            value={drawingColor}
                            onChange={(e) => setDrawingColor(e.target.value)}
                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                            {PRESET_COLORS.map(c => (
                                <button
                                    type="button"
                                    key={c.hex}
                                    onClick={() => setDrawingColor(c.hex)}
                                    style={{
                                        width: '15px',
                                        height: '15px',
                                        borderRadius: '50%',
                                        backgroundColor: c.hex,
                                        border: drawingColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                    title={`${c.label} (${c.hex})`}
                                />
                            ))}
                        </div>

                        {/* Sağ Tarafta Hex Renk Gösterge Rozeti */}
                        <div
                            title={`Seçili Çizim Rengi: ${drawingColor}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: `1.5px solid ${drawingColor}`,
                                borderRadius: '5px',
                                marginLeft: '2px',
                                flexShrink: 0
                            }}
                        >
                            <span
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: drawingColor,
                                    display: 'inline-block',
                                    flexShrink: 0
                                }}
                            />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                                {drawingColor.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Durum Metni */}
                    <span style={{ fontSize: '12.5px', color: '#cbd5e1', minWidth: '110px' }}>
                        {draftWkt ? (
                            <span style={{ color: '#4ade80', fontWeight: 600 }}>{t.drawingCompleted || 'Çizildi'}</span>
                        ) : (
                            <span style={{ color: '#94a3b8' }}>{t.drawingInProgress || 'Haritada çizin...'}</span>
                        )}
                    </span>

                    {/* Aksiyon Butonları */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={handleSaveDrawingFromFloatingBox}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            <span>{t.btnSaveToDb || 'Kaydet'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCancelDraw}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            {t.btnCancelDraw || 'İptal'}
                        </button>
                    </div>
                </div>
            )}

            {/* KESİŞİM KONTROLÜ BARI */}
            {drawType === 'Analysis' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#f59e0b',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        {t.intersectionCheckBadge || (isTr ? 'KESİŞİM KONTROLÜ' : 'INTERSECTION CHECK')}
                    </span>

                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        {isAnalyzing ? (t.intersectionCheckAnalyzing || (isTr ? 'Kesişim analizi yapılıyor...' : 'Analyzing intersection...')) : (t.intersectionCheckHint || (isTr ? 'Analiz yapılacak alanı haritada çizin (bitirmek için çift tıklayın).' : 'Draw the analysis area on the map (double click to finish).'))}
                    </span>

                    <button
                        type="button"
                        onClick={handleCancelDraw}
                        style={{
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            borderRadius: '7px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            cursor: 'pointer',
                            marginLeft: '4px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {t.btnCancelDraw || (isTr ? 'İptal' : 'Cancel')}
                    </button>
                </div>
            )}

            {/* DURAK EKLEME MODU KOMPAKT ALT BARI */}
            {drawType === 'Stop' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #ef4444',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="13" rx="2" />
                            <path d="M4 9h16" />
                            <circle cx="7.5" cy="14" r="1.2" fill="currentColor" />
                            <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
                        </svg>
                        {t.addStopTitle || (isTr ? 'DURAK EKLE' : 'ADD STOP')}
                    </span>

                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        {t.addStopHint || (isTr ? 'Durağın konumunu haritada seçmek için bir noktaya tıklayın.' : 'Click on the map to select the stop location.')}
                    </span>

                    <button
                        type="button"
                        onClick={handleCancelDraw}
                        style={{
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            borderRadius: '7px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            cursor: 'pointer',
                            marginLeft: '4px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {t.btnCancelDraw || (isTr ? 'İptal' : 'Cancel')}
                    </button>
                </div>
            )}

            {/* POI ÇİZİM VE DİNAMİK ALAN (POLİGON) KOMPAKT BARI */}
            {drawType === 'Poi' && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #3b82f6',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        {t.addPoiTitle || (isTr ? 'POI EKLE' : 'ADD POI')}
                    </span>

                    {/* Nokta / Poligon Segment Butonları */}
                    <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setPoiDrawGeometryType('Point');
                                if (draftPoiData && draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                            }}
                            style={{
                                padding: '5px 12px',
                                fontSize: '12.5px',
                                fontWeight: poiDrawGeometryType === 'Point' ? 700 : 500,
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: poiDrawGeometryType === 'Point' ? '#3b82f6' : 'transparent',
                                color: poiDrawGeometryType === 'Point' ? '#ffffff' : '#94a3b8',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {t.poiPointMode || (isTr ? 'Nokta' : 'Point')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPoiDrawGeometryType('Polygon');
                                if (draftPoiData && draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 12px',
                                fontSize: '12.5px',
                                fontWeight: poiDrawGeometryType === 'Polygon' ? 700 : 500,
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: poiDrawGeometryType === 'Polygon' ? '#3b82f6' : 'transparent',
                                color: poiDrawGeometryType === 'Polygon' ? '#ffffff' : '#94a3b8',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
                            </svg>
                            {t.poiPolygonMode || (isTr ? 'Poligon (Shift)' : 'Polygon (Shift)')}
                        </button>
                    </div>

                    {/* Durum Metni */}
                    <span style={{ fontSize: '12.5px', color: '#cbd5e1', minWidth: '120px' }}>
                        {draftPoiData ? (
                            draftPoiData.isPolygon ? (
                                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                                    {(t.areaLabel || (isTr ? 'Alan' : 'Area'))}: {draftPoiData.area >= 1000000 ? (draftPoiData.area / 1000000).toFixed(2) + ' km²' : Math.round(draftPoiData.area).toLocaleString() + ' m²'}
                                </span>
                            ) : (
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {t.pointSelected || (isTr ? 'Nokta Seçildi' : 'Point Selected')}
                                </span>
                            )
                        ) : (
                            <span style={{ color: '#94a3b8' }}>
                                {poiDrawGeometryType === 'Point' ? (t.clickMapForPoiPoint || (isTr ? 'Haritada nokta seçin' : 'Select point on map')) : (t.clickMapForPoiPolygon || (isTr ? 'Köşeleri tıklayın' : 'Click vertices on map'))}
                            </span>
                        )}
                    </span>

                    {/* Sıralı Aksiyon Butonları */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={handleOpenPoiModalWithDraft}
                            disabled={!draftPoiData}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: draftPoiData ? '#16a34a' : 'rgba(255,255,255,0.06)',
                                color: draftPoiData ? '#ffffff' : '#64748b',
                                border: 'none',
                                cursor: draftPoiData ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s ease'
                            }}
                            title={draftPoiData ? (t.saveDraftPoiTooltip || (isTr ? 'POI Bilgi Giriş Ekranını Aç' : 'Open POI Details Modal')) : (t.saveDraftPoiDisabledTooltip || (isTr ? 'Lütfen önce haritada bir nokta veya poligon çizin' : 'Please first draw a point or polygon on the map'))}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            <span>{t.btnSaveToDb || (isTr ? 'Kaydet' : 'Save')}</span>
                        </button>

                        {draftPoiData && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (draftFeatureRef.current && drawingsSourceRef.current) {
                                        try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                        draftFeatureRef.current = null;
                                    }
                                    setDraftPoiData(null);
                                }}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '12.5px',
                                    borderRadius: '7px',
                                    backgroundColor: 'rgba(255,255,255,0.08)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    cursor: 'pointer'
                                }}
                                title={isTr ? "Çizimi sıfırla ve yeniden çiz" : "Reset drawing and redraw"}
                            >
                                {t.redrawBtn || (isTr ? 'Yeniden Çiz' : 'Redraw')}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                if (draftFeatureRef.current && drawingsSourceRef.current) {
                                    try { drawingsSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                                    draftFeatureRef.current = null;
                                }
                                setDraftPoiData(null);
                                handleCancelDraw();
                            }}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            {t.btnCancelDraw || (isTr ? 'İptal' : 'Cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* ŞEKİL DÜZENLEME MODU ALT YÜZER EYLEM BARI */}
            {isModifyingVertex && (
                <div
                    className="floating-draw-bottom-bar vertex-editing-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: '1.5px solid #22c55e',
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#22c55e',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        DÜZENLEME MODU
                    </span>

                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        Kırılma noktalarını fare ile sürükleyin.
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={handleUndoGeometry}
                            disabled={historyIndex <= 0}
                            title="Geri Al (Undo)"
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                borderRadius: '7px',
                                backgroundColor: historyIndex <= 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                                color: historyIndex <= 0 ? '#64748b' : '#38bdf8',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Geri
                        </button>

                        <button
                            type="button"
                            onClick={handleRedoGeometry}
                            disabled={historyIndex >= geometryHistoryRef.current.length - 1}
                            title="İleri Al (Redo)"
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                borderRadius: '7px',
                                backgroundColor: historyIndex >= geometryHistoryRef.current.length - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                                color: historyIndex >= geometryHistoryRef.current.length - 1 ? '#64748b' : '#38bdf8',
                                border: '1px solid rgba(255,255,255,0.15)',
                                cursor: historyIndex >= geometryHistoryRef.current.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            İleri
                        </button>

                        <button
                            type="button"
                            onClick={handleUpdateDrawingFromPopup}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Kaydet</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleTriggerCancelVertexEditing}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* KESİŞİM VE ENVANTER ANALİZ SONUÇ PANELLERİ */}
            {analysisResult && (
                <div className="analysis-result-card-floating">
                    <div className="analysis-card-header">
                        <div className="analysis-header-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                            <h3>{t.analysisReportTitle}</h3>
                        </div>
                        <button className="btn-close-analysis" onClick={handleClearAnalysis} title={t.clearAnalysisBtn}>
                            <CloseIcon size={14} />
                        </button>
                    </div>

                    <div className="analysis-card-body">
                        <div className="analysis-total-badge">
                            <span className="total-number">{analysisResult.totalIntersectedCount ?? 0}</span>
                            <span className="total-label">{t.totalIntersectedLabel}</span>
                        </div>

                        <div className="analysis-breakdown-grid">
                            <div className="breakdown-item">
                                <span className="item-count">{(analysisResult.pointsCount || 0) + (analysisResult.placesCount || 0)}</span>
                                <span className="item-type">{t.pointLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.linesCount ?? 0}</span>
                                <span className="item-type">{t.lineLayerLabel}</span>
                            </div>
                            <div className="breakdown-item">
                                <span className="item-count">{analysisResult.polygonsCount ?? 0}</span>
                                <span className="item-type">{t.polygonLayerLabel}</span>
                            </div>
                        </div>

                        {Array.isArray(analysisResult.details) && analysisResult.details.length > 0 && (
                            <div className="analysis-details-list">
                                <h4>Kesişen Nesne Detayları:</h4>
                                <ul>
                                    {analysisResult.details.map((item, idx) => (
                                        <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="analysis-card-footer">
                        <button className="btn-clear-analysis-action" onClick={handleClearAnalysis}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Analizi ve Haritayı Temizle
                        </button>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (SİLME ONAYI) */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge warning">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Silme İşlemini Onaylayın</h3>
                        <p className="modal-description">
                            <strong>"{deleteTarget.name}"</strong> kaydını silmek üzeresiniz. Bu işlem haritadan kaldırılacaktır. Devam etmek istiyor musunuz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setDeleteTarget(null)}>
                                İptal (Vazgeç)
                            </button>
                            <button className="modal-btn btn-danger-confirm" onClick={confirmDelete}>
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITÖR İŞBİRLİĞİ & İSTEKLER MODAL */}
            {showCollaborationModal && (
                <div className="modal-overlay" onClick={() => setShowCollaborationModal(false)}>
                    <div
                        className="collab-modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '90%',
                            maxWidth: '560px',
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '24px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{t.collaborationTitle}</h3>
                            </div>
                            <button
                                onClick={() => setShowCollaborationModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                title="Kapat"
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>

                        {/* İŞBİRLİĞİ İSTEĞİ GÖNDER FORMU */}
                        <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: isDarkMode ? 'rgba(30,41,59,0.7)' : '#f8fafc', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13.5px', color: '#3b82f6', fontWeight: 700 }}>{t.sendRequestBtn}</h4>
                            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                {lang === 'tr'
                                    ? 'İşbirliği onaylandığında editörlerin coğrafi yetki alanları otomatik olarak birleşir (Union). Birbirinizin şekillerini görüntüleyebilir ve düzenleyebilirsiniz. İşbirliği iptal edildiğinde yetki alanları tekrar ayrılır.'
                                    : 'Once collaboration is approved, spatial boundaries are automatically merged (Union). When cancelled, boundaries separate back.'}
                            </p>

                            <form onSubmit={handleSendCollaborationRequest} style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    value={selectedEditorId}
                                    onChange={(e) => setSelectedEditorId(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        borderRadius: '7px',
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        fontSize: '13px'
                                    }}
                                    required
                                >
                                    <option value="">-- {lang === 'tr' ? 'Editör Seçin' : 'Select Editor'} --</option>
                                    {availableEditors.map((ed) => (
                                        <option key={ed.id} value={ed.id}>
                                            {ed.username} ({ed.email || 'Editor'})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    disabled={collabLoading || !selectedEditorId}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '7px',
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        cursor: collabLoading ? 'wait' : 'pointer'
                                    }}
                                >
                                    {t.sendRequestBtn}
                                </button>
                            </form>
                        </div>

                        {/* GELEN İSTEKLER */}
                        {pendingIncoming.length > 0 && (
                            <div style={{ marginBottom: '18px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#f59e0b', fontWeight: 700 }}>
                                    {lang === 'tr' ? 'Onay Bekleyen Gelen İstekler' : 'Pending Incoming Requests'} ({pendingIncoming.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                                    {pendingIncoming.map((req) => (
                                        <div
                                            key={req.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                                borderRadius: '8px'
                                            }}
                                        >
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                                <strong>{req.senderUsername}</strong> {lang === 'tr' ? 'sizden çizim işbirliği istiyor.' : 'wants to collaborate on map drawings.'}
                                            </span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondCollaborationRequest(req.id, true)}
                                                    style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '5px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    {t.acceptBtn}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondCollaborationRequest(req.id, false)}
                                                    style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '5px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    {t.declineBtn}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TÜM İSTEKLER VE AKTİF İŞBİRLİKLERİ LİSTESİ */}
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 700 }}>
                                {lang === 'tr' ? 'Tüm İşbirliği İstekleri ve Durumları' : 'All Collaboration Requests & Statuses'}
                            </h4>
                            {collaborationRequests.length === 0 ? (
                                <p style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                                    {lang === 'tr' ? 'Henüz gönderilmiş veya alınmış bir işbirliği isteği bulunmuyor.' : 'No sent or received collaboration requests yet.'}
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                    {collaborationRequests.map((r) => {
                                        const isSender = r.senderUserId === loggedInUserId;
                                        const otherUser = isSender ? r.receiverUsername : r.senderUsername;
                                        return (
                                            <div
                                                key={r.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '8px 12px',
                                                    backgroundColor: isDarkMode ? 'rgba(30,41,59,0.5)' : '#f1f5f9',
                                                    borderRadius: '7px',
                                                    fontSize: '12.5px'
                                                }}
                                            >
                                                <div>
                                                    <strong>{otherUser}</strong> ({isSender ? (lang === 'tr' ? 'Gönderilen' : 'Sent') : (lang === 'tr' ? 'Gelen' : 'Received')})
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span
                                                        style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            backgroundColor: r.status === 'Approved' ? '#16a34a' : r.status === 'Rejected' ? '#ef4444' : '#f59e0b',
                                                            color: '#ffffff'
                                                        }}
                                                    >
                                                        {r.status === 'Approved'
                                                            ? (lang === 'tr' ? 'Aktif İşbirliği' : 'Active Collaboration')
                                                            : r.status === 'Rejected'
                                                                ? (lang === 'tr' ? 'Reddedildi' : 'Rejected')
                                                                : (lang === 'tr' ? 'Onay Bekliyor' : 'Pending')}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleCancelCollaboration(r.id)}
                                                        title={lang === 'tr' ? 'İşbirliğini / İsteği İptal Et (Sil)' : 'Cancel / Remove Collaboration'}
                                                        style={{
                                                            padding: '3px 8px',
                                                            fontSize: '11px',
                                                            borderRadius: '5px',
                                                            backgroundColor: 'rgba(239, 68, 68, 0.18)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {lang === 'tr' ? 'İptal Et' : 'Cancel'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <button
                                type="button"
                                onClick={() => setShowCollaborationModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '7px', backgroundColor: '#64748b', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '12.5px' }}
                            >
                                {t.closeBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPERATÖR & EDİTÖR POI EKLEME / DÜZENLEME MODALI */}
            {showCreatePoiModal && (
                <div className="modal-overlay" onClick={() => { setShowCreatePoiModal(false); setEditingPoiModalData(null); }}>
                    <div
                        className="poi-create-modal-container"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                        {editingPoiModalData ? 'POI Bilgilerini & Fotoğraflarını Düzenle' : 'Yeni POI (İlgi Noktası) Ekle'}
                                    </h3>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        {editingPoiModalData ? 'POI detaylarını ve fotoğraflarını güncelleyiniz.' : 'Haritada işaretlenen konuma POI detaylarını giriniz.'}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowCreatePoiModal(false); setEditingPoiModalData(null); }}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                title="Kapat"
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewPoi} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">POI / Mekan İsmi *</label>
                                <input
                                    type="text"
                                    className="poi-modal-input"
                                    placeholder="Örn: Merkez Kütüphane, Şehir Hastanesi, Atatürk Parkı, Semt Polikliniği..."
                                    value={newPoiForm.name}
                                    onChange={(e) => setNewPoiForm({ ...newPoiForm, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: currentSubCategories.length > 0 ? '1fr 1fr' : '1fr', gap: '10px' }}>
                                <div className="poi-modal-form-group">
                                    <label className="poi-modal-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>1. Ana Kategori *</span>
                                    </label>
                                    <select
                                        className="poi-modal-input"
                                        value={poiParentCatId}
                                        onChange={(e) => handlePoiParentCatChange(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>-- Ana Kategori Seçiniz --</option>
                                        {parentCategories.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {currentSubCategories.length > 0 && (
                                    <div className="poi-modal-form-group">
                                        <label className="poi-modal-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>2. Alt Kategori (Dallanma) *</span>
                                        </label>
                                        <select
                                            className="poi-modal-input"
                                            value={newPoiForm.categoryId}
                                            onChange={(e) => handlePoiSubCatChange(e.target.value)}
                                            required
                                        >
                                            {currentSubCategories.map(sub => (
                                                <option key={sub.id} value={sub.id}>
                                                    {sub.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {activeCategoryObject && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '7px 12px',
                                    background: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.9)',
                                    borderRadius: '8px',
                                    border: `1px solid ${activeCategoryObject.color || '#3b82f6'}40`,
                                    fontSize: '12px'
                                }}>
                                    <span style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: activeCategoryObject.color || '#3b82f6',
                                        display: 'inline-block',
                                        boxShadow: 'none'
                                    }} />
                                    <span style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>Seçili Harita İşaretçisi:</span>
                                    <strong style={{ color: activeCategoryObject.color || '#3b82f6', fontWeight: 600 }}>
                                        {activeCategoryObject.parentName ? `${activeCategoryObject.parentName} → ${activeCategoryObject.name}` : activeCategoryObject.name}
                                    </strong>
                                </div>
                            )}

                            {/* ÇALIŞMA SAATLERİ (SEÇİCİ & ŞABLONLAR) */}
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Mesai / Çalışma Saatleri</label>

                                <div style={{ display: 'grid', gridTemplateColumns: poiIs24Hours ? '1fr' : '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                                    <div>
                                        <select
                                            className="poi-modal-input"
                                            value={poiTimeDays}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPoiTimeDays(val);
                                                if (poiIs24Hours) {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${val} 24 Saat Açık` }));
                                                } else {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${val} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                }
                                            }}
                                        >
                                            <option value="Hafta İçi">Hafta İçi (Pzt - Cuma)</option>
                                            <option value="Her Gün">Her Gün (7 Gün Açık)</option>
                                            <option value="Pzt - Cmt">Pazartesi - Cumartesi</option>
                                            <option value="Hafta Sonu">Hafta Sonu (Cmt - Paz)</option>
                                        </select>
                                    </div>

                                    {!poiIs24Hours && (
                                        <>
                                            <div>
                                                <input
                                                    type="time"
                                                    className="poi-modal-input"
                                                    value={poiTimeStart}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPoiTimeStart(val);
                                                        setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${val} - ${poiTimeEnd}` }));
                                                    }}
                                                    title="Açılış Saati"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="time"
                                                    className="poi-modal-input"
                                                    value={poiTimeEnd}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPoiTimeEnd(val);
                                                        setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${val}` }));
                                                    }}
                                                    title="Kapanış Saati"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                        Seçilen Mesai: <strong style={{ color: '#38bdf8' }}>{newPoiForm.workingHours || 'Belirtilmedi'}</strong>
                                    </span>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={poiIs24Hours}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setPoiIs24Hours(checked);
                                                if (checked) {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: '24 Saat Açık' }));
                                                } else {
                                                    setNewPoiForm(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                }
                                            }}
                                        />
                                        <span>24 Saat Kesintisiz Açık</span>
                                    </label>
                                </div>
                            </div>

                            {/* POI ÇOKLU FOTOĞRAF / GÖRSEL YÖNETİMİ */}
                            <div className="poi-modal-form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="poi-modal-form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        POI Fotoğrafları (Birden Fazla Eklenebilir)
                                        {newPoiForm.images.length > 0 && (
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                                {newPoiForm.images.length} Fotoğraf
                                            </span>
                                        )}
                                    </label>
                                    {newPoiForm.images.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setNewPoiForm(prev => ({ ...prev, images: [] }))}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Tümünü Temizle
                                        </button>
                                    )}
                                </div>

                                {/* URL Ekle & Dosya Seç Butonları */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="poi-modal-input"
                                        placeholder="Fotoğraf URL girip 'Ekle'ye basın (https://...)"
                                        value={newPoiForm.customImageUrl || ''}
                                        onChange={(e) => setNewPoiForm({ ...newPoiForm, customImageUrl: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (newPoiForm.customImageUrl?.trim()) {
                                                    const url = newPoiForm.customImageUrl.trim();
                                                    setNewPoiForm(prev => ({
                                                        ...prev,
                                                        images: [...prev.images, url],
                                                        customImageUrl: ''
                                                    }));
                                                }
                                            }
                                        }}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (newPoiForm.customImageUrl?.trim()) {
                                                const url = newPoiForm.customImageUrl.trim();
                                                setNewPoiForm(prev => ({
                                                    ...prev,
                                                    images: [...prev.images, url],
                                                    customImageUrl: ''
                                                }));
                                            }
                                        }}
                                        disabled={!newPoiForm.customImageUrl?.trim()}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                                            border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                            color: isDarkMode ? '#ffffff' : '#0f172a',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: newPoiForm.customImageUrl?.trim() ? 'pointer' : 'not-allowed',
                                            opacity: newPoiForm.customImageUrl?.trim() ? 1 : 0.6
                                        }}
                                    >
                                        URL Ekle
                                    </button>
                                    <label style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                        border: '1px solid #3b82f6',
                                        color: '#3b82f6',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        {uploadingPoiImage ? 'Yükleniyor...' : 'Çoklu Dosya Seç'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            style={{ display: 'none' }}
                                            disabled={uploadingPoiImage}
                                            onChange={async (e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length === 0) return;
                                                try {
                                                    setUploadingPoiImage(true);
                                                    const uploadPromises = files.map(file => adminApi.uploadImage(file, token).catch(() => null));
                                                    const results = await Promise.all(uploadPromises);
                                                    const successfulUrls = results.filter(r => r && (r.url || r.absoluteUrl)).map(r => r.url || r.absoluteUrl);

                                                    if (successfulUrls.length > 0) {
                                                        setNewPoiForm(prev => ({
                                                            ...prev,
                                                            images: [...prev.images, ...successfulUrls]
                                                        }));
                                                        if (toastRef.current) {
                                                            toastRef.current.show({ severity: 'success', summary: 'Başarılı', detail: `${successfulUrls.length} fotoğraf yüklendi.`, life: 2500 });
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.error('Fotoğraf yükleme hatası:', err);
                                                } finally {
                                                    setUploadingPoiImage(false);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                    </label>
                                </div>

                                {/* Fotoğraf Küçük Önizleme Şeridi */}
                                {newPoiForm.images.length > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        overflowX: 'auto',
                                        padding: '8px 0 4px 0',
                                        marginTop: '4px'
                                    }}>
                                        {newPoiForm.images.map((img, idx) => {
                                            const src = img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:') || img.startsWith('blob:')
                                                ? img
                                                : (img.startsWith('/') ? `http://localhost:5041${img}` : `http://localhost:5041/${img}`);
                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        position: 'relative',
                                                        width: '64px',
                                                        height: '64px',
                                                        borderRadius: '6px',
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                        border: '1px solid #475569',
                                                        backgroundColor: '#0f172a'
                                                    }}
                                                >
                                                    <img
                                                        src={src}
                                                        alt={`Önizleme ${idx + 1}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23334155"/><text x="50%" y="50%" fill="%2394a3b8" dominant-baseline="middle" text-anchor="middle" font-size="10">Resim Yok</text></svg>'; }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewPoiForm(prev => ({
                                                            ...prev,
                                                            images: prev.images.filter((_, i) => i !== idx)
                                                        }))}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            right: '2px',
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            backgroundColor: 'rgba(239, 68, 68, 0.9)',
                                                            border: 'none',
                                                            color: '#ffffff',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            padding: 0
                                                        }}
                                                        title="Fotoğrafı Sil"
                                                    >
                                                        <CloseIcon size={11} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Açıklama / Detay</label>
                                <textarea
                                    className="poi-modal-input"
                                    rows="2"
                                    placeholder="POI hakkında ek bilgiler..."
                                    value={newPoiForm.description}
                                    onChange={(e) => setNewPoiForm({ ...newPoiForm, description: e.target.value })}
                                />
                            </div>

                            <div className="poi-modal-location-badge">
                                {newPoiForm.isPolygon ? (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                                        </svg>
                                        <span>
                                            <strong style={{ color: '#10b981' }}>Poligon POI:</strong> {newPoiForm.area >= 1000000 ? (newPoiForm.area / 1000000).toFixed(2) + ' km²' : Math.round(newPoiForm.area).toLocaleString() + ' m²'} (Merkez: {newPoiForm.lat?.toFixed(5)}° K, {newPoiForm.lon?.toFixed(5)}° D)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <circle cx="12" cy="12" r="10" />
                                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                                        </svg>
                                        <span><strong>Nokta Konumu:</strong> {newPoiForm.lat?.toFixed(5)}° K, {newPoiForm.lon?.toFixed(5)}° D</span>
                                    </>
                                )}
                            </div>

                            <div className="poi-modal-actions">
                                <button type="button" className="poi-btn-cancel" onClick={() => { setShowCreatePoiModal(false); setEditingPoiModalData(null); }}>
                                    İptal
                                </button>
                                <button type="submit" className="poi-btn-save">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>{editingPoiModalData ? 'Değişiklikleri Kaydet' : 'Haritaya Kaydet'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SEÇİLİ POI BİLGİ PANELİ (INFO CARD / POPUP - KATMAN KARTI BANNER STİLİ) */}
            {selectedPoiInfo && (
                <div className="poi-info-floating-card">
                    {/* ÜST GÖRSEL BANNER (Katman Kartı Stili + Fotoğraf Geçişi + AI Analizi) */}
                    <PoiHeaderBannerGallery
                        poi={selectedPoiInfo}
                        isDarkMode={isDarkMode}
                        onOpenEditModal={() => handleStartEditPoi(selectedPoiInfo)}
                        onOpenFullscreen={(url, idx) => {
                            const allImages = resolveAllPoiImages(selectedPoiInfo);
                            setLightboxImages(allImages.map(x => x.url || x));
                            setLightboxIndex(idx || 0);
                            setShowPoiLightbox(true);
                        }}
                    />

                    <div className="poi-card-header">
                        <div className="poi-card-title-group">
                            <div
                                className="poi-card-icon-wrap"
                                style={{
                                    backgroundColor: selectedPoiInfo.categoryColor ? `${selectedPoiInfo.categoryColor}25` : 'rgba(59, 130, 246, 0.2)',
                                    color: selectedPoiInfo.categoryColor || '#3b82f6'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 className="poi-card-title">{selectedPoiInfo.name}</h3>
                                <span className="poi-card-subtitle">POI Detayları</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedPoiInfo(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                            title="Kapat"
                        >
                            <CloseIcon size={14} />
                        </button>
                    </div>

                    <div className="poi-card-body">
                        <div className="poi-detail-row">
                            <span className="poi-detail-label">Kategori:</span>
                            <span
                                className="poi-badge"
                                style={{
                                    backgroundColor: selectedPoiInfo.categoryColor ? `${selectedPoiInfo.categoryColor}20` : 'rgba(59, 130, 246, 0.15)',
                                    color: selectedPoiInfo.categoryColor || '#3b82f6'
                                }}
                            >
                                {selectedPoiInfo.parentCategoryName ? `${selectedPoiInfo.parentCategoryName} → ` : ''}{selectedPoiInfo.categoryName}
                            </span>
                        </div>

                        {selectedPoiInfo.workingHours && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Mesai Saatleri:</span>
                                <span className="poi-detail-value" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <strong>{selectedPoiInfo.workingHours}</strong>
                                </span>
                            </div>
                        )}

                        <div className="poi-detail-row">
                            <span className="poi-detail-label">Ekleyen:</span>
                            <span className="poi-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <strong>{selectedPoiInfo.username || 'Sistem'}</strong>
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>(ID: {selectedPoiInfo.userId})</span>
                            </span>
                        </div>

                        {selectedPoiInfo.createdDate && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Kayıt Tarihi:</span>
                                <span className="poi-detail-value" style={{ color: '#94a3b8' }}>
                                    {new Date(selectedPoiInfo.createdDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        )}

                        {selectedPoiInfo.latitude != null && selectedPoiInfo.longitude != null && (
                            <div className="poi-detail-row">
                                <span className="poi-detail-label">Konum:</span>
                                <span className="poi-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{selectedPoiInfo.latitude.toFixed(5)}°, {selectedPoiInfo.longitude.toFixed(5)}°</span>
                                    <button
                                        type="button"
                                        className="btn-copy-inline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${selectedPoiInfo.latitude}, ${selectedPoiInfo.longitude}`);
                                            if (toastRef.current) {
                                                toastRef.current.show({ severity: 'info', summary: 'Kopyalandı', detail: 'Koordinatlar panoya kopyalandı.', life: 2500 });
                                            }
                                        }}
                                        title="Koordinatları Kopyala"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        )}

                        {selectedPoiInfo.description && (
                            <div className="poi-detail-row" style={{ flexDirection: 'column', gap: '4px' }}>
                                <span className="poi-detail-label">Açıklama:</span>
                                <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.4 }}>
                                    {selectedPoiInfo.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="poi-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {/* YOL TARİFİ BUTONU */}
                            <button
                                type="button"
                                className="poi-btn-directions"
                                onClick={() => handleStartDirectionsToPoi(selectedPoiInfo)}
                                title="Bu noktaya yol tarifi oluştur"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                </svg>
                                <span>Yol Tarifi Al</span>
                            </button>

                            {/* FAVORİYE EKLE / ÇIKAR BUTONU */}
                            <button
                                type="button"
                                className={`poi-btn-fav ${favoritePoiIds.has(selectedPoiInfo.id) ? 'active' : 'inactive'}`}
                                onClick={() => handleToggleFavoritePoi(selectedPoiInfo)}
                                title={favoritePoiIds.has(selectedPoiInfo.id) ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={favoritePoiIds.has(selectedPoiInfo.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span>{favoritePoiIds.has(selectedPoiInfo.id) ? 'Favorilerde' : 'Favorile'}</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {(isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör' || selectedPoiInfo.userId === loggedInUserId) && (
                                <button
                                    type="button"
                                    className="poi-btn-edit-action"
                                    onClick={() => handleOpenEditPoiModal(selectedPoiInfo)}
                                    title="POI Bilgilerini ve Fotoğraflarını Düzenle"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '6px 10px',
                                        borderRadius: '7px',
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                        border: '1px solid #3b82f6',
                                        color: '#3b82f6',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>Düzenle</span>
                                </button>
                            )}

                            {(isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör' || selectedPoiInfo.userId === loggedInUserId) && (
                                <button
                                    type="button"
                                    className="poi-btn-edit-action"
                                    onClick={() => startPoiEditing(selectedPoiInfo)}
                                    title={selectedPoiInfo.wkt?.toUpperCase().includes('POLYGON') ? 'POI Poligon Sınırlarını ve Köşelerini Düzenle' : 'POI Konumunu Haritada Taşı'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="5 9 2 12 5 15" />
                                        <polyline points="9 5 12 2 15 5" />
                                        <polyline points="15 19 12 22 9 19" />
                                        <polyline points="19 9 22 12 19 15" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <line x1="12" y1="2" x2="12" y2="22" />
                                    </svg>
                                    <span>{selectedPoiInfo.wkt?.toUpperCase().includes('POLYGON') ? 'Poligonu Düzenle' : 'Konumu Taşı'}</span>
                                </button>
                            )}

                            {(isAdmin || userRole === 'Admin' || userRole === 'Editor' || userRole === 'Editör' || selectedPoiInfo.userId === loggedInUserId) && (
                                <button
                                    type="button"
                                    className="poi-btn-delete-icon"
                                    onClick={() => handleDeletePoiFromMap(selectedPoiInfo.id, selectedPoiInfo.name)}
                                    title="POI'yi Sil"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SEÇİLİ DURAK BİLGİ KUTUCUĞU (AKILLI ULAŞIM MODÜLÜ - POPUP CARD) */}
            {selectedStopInfo && (
                <div className="stop-info-floating-card">
                    <div className="stop-card-header">
                        <div className="stop-card-title-group">
                            <div
                                className="stop-card-badge-icon"
                                style={{
                                    backgroundColor: selectedStopInfo.routeColor || '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <RouteClassIcon classKey={(selectedStopInfo.stopClass || selectedStopInfo.routeClass || 'otobus').toLowerCase()} size={15} color="#ffffff" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <h3 className="stop-card-title" style={{ margin: 0 }}>{selectedStopInfo.name}</h3>
                                    {(selectedStopInfo.stopCode || selectedStopInfo.id) && (
                                        <span
                                            title="Durak Numarası"
                                            style={{
                                                fontFamily: 'monospace',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: 'rgba(2, 132, 199, 0.2)',
                                                color: '#38bdf8',
                                                border: '1px solid rgba(2, 132, 199, 0.4)'
                                            }}
                                        >
                                            #{selectedStopInfo.stopCode || selectedStopInfo.id}
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {selectedStopInfo.routeName ? `Hat Durağı (${selectedStopInfo.routeName})` : (selectedStopInfo.routes && selectedStopInfo.routes.length > 0 ? selectedStopInfo.routes.map(r => r.name).join(', ') : 'Ulaşım Durağı')}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedStopInfo(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                            title="Kapat"
                        >
                            <CloseIcon size={14} />
                        </button>
                    </div>

                    <div className="stop-card-body">
                        {selectedStopInfo.imageUrl && (
                            <div style={{ width: '100%', height: '130px', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.1)', background: '#000000' }}>
                                <img
                                    src={selectedStopInfo.imageUrl.startsWith('http') ? selectedStopInfo.imageUrl : `http://localhost:5041${selectedStopInfo.imageUrl}`}
                                    alt={selectedStopInfo.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                        )}
                        {/* Durak Numarası Satırı */}
                        <div className="stop-detail-row">
                            <span className="stop-detail-label">Durak Numarası:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '12px' }}>
                                #{selectedStopInfo.stopCode || selectedStopInfo.id}
                            </span>
                        </div>
                        {/* Ulaşım Sınıfı */}
                        {(() => {
                            const stopClass = (selectedStopInfo.stopClass || selectedStopInfo.routeClass || 'otobus').toLowerCase();
                            const isBusStop = stopClass === 'otobus';
                            const classInfo = getRouteClassInfo(stopClass);
                            return (
                                <div className="stop-detail-row">
                                    <span className="stop-detail-label">Durak Türü:</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <span
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                                backgroundColor: classInfo.bg, color: classInfo.color, border: `1px solid ${classInfo.border}`
                                            }}
                                        >
                                            <RouteClassIcon classKey={classInfo.id} size={13} color={classInfo.color} />
                                            {classInfo.label}
                                        </span>
                                        {isBusStop && selectedStopInfo.routeId && selectedStopInfo.routeName && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const parentRoute = routes.find(rt => rt.id === selectedStopInfo.routeId);
                                                    if (parentRoute) {
                                                        setSelectedRouteInfo(parentRoute);
                                                        setSelectedStopInfo(null);
                                                    }
                                                }}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                                    backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7',
                                                    border: '1px solid rgba(2, 132, 199, 0.3)', cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title="Hat güzergahını göster"
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>
                                                Hat: {selectedStopInfo.routeName}
                                            </button>
                                        )}
                                    </span>
                                </div>
                            );
                        })()}

                        <div className="stop-detail-row" style={{ alignItems: 'flex-start' }}>
                            <span className="stop-detail-label" style={{ marginTop: '3px' }}>{lang === 'tr' ? 'Geçen Hatlar:' : 'Passing Routes:'}</span>
                            {(() => {
                                const routeList = Array.isArray(selectedStopInfo.routes) && selectedStopInfo.routes.length > 0
                                    ? selectedStopInfo.routes
                                    : (selectedStopInfo.routeId ? [{ id: selectedStopInfo.routeId, name: selectedStopInfo.routeName || (lang === 'tr' ? 'Bağlı Hat' : 'Route'), color: selectedStopInfo.routeColor, routeClass: selectedStopInfo.routeClass }] : []);

                                if (routeList.length === 0) {
                                    return (
                                        <span
                                            className="stop-badge"
                                            style={{
                                                backgroundColor: 'rgba(100, 116, 139, 0.15)',
                                                color: '#94a3b8',
                                                border: '1px solid rgba(100, 116, 139, 0.3)'
                                            }}
                                        >
                                            {lang === 'tr' ? 'Bağlı Hat Yok' : 'No Bound Route'}
                                        </span>
                                    );
                                }

                                return (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                                        {routeList.map(r => {
                                            const rColor = r.color || '#3b82f6';
                                            const isCurrentSelected = selectedRouteInfo?.id === r.id;
                                            return (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const targetRoute = routes.find(rt => rt.id === r.id) || r;
                                                        setSelectedRouteInfo(targetRoute);

                                                        // Hat geometrisine kamerayı yumuşakça odakla
                                                        const lineFeat = routeSourceRef.current?.getFeatures()?.find(f => f.get('id') === r.id || f.get('routeData')?.id === r.id);
                                                        if (lineFeat && mapRef.current) {
                                                            try {
                                                                const extent = lineFeat.getGeometry().getExtent();
                                                                mapRef.current.getView().fit(extent, {
                                                                    padding: [90, 90, 90, 90],
                                                                    maxZoom: 16,
                                                                    duration: 650
                                                                });
                                                            } catch (err) { }
                                                        }

                                                        toastRef.current?.show({
                                                            severity: 'info',
                                                            summary: r.name || (lang === 'tr' ? 'Güzergah Seçildi' : 'Route Selected'),
                                                            detail: lang === 'tr' ? 'Hat güzergahı ve durakları haritada görüntülendi.' : 'Route trajectory displayed on map.',
                                                            life: 2500
                                                        });
                                                    }}
                                                    className="stop-route-interactive-btn"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '4px 10px',
                                                        borderRadius: '8px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        backgroundColor: isCurrentSelected ? `${rColor}` : `${rColor}22`,
                                                        color: isCurrentSelected ? '#ffffff' : rColor,
                                                        border: `1.5px solid ${isCurrentSelected ? rColor : `${rColor}66`}`,
                                                        cursor: 'pointer',
                                                        boxShadow: isCurrentSelected ? `0 2px 8px ${rColor}50` : 'none',
                                                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                                                    }}
                                                    title={`${r.name} - ${lang === 'tr' ? 'Güzergahı ve araçları haritada göster' : 'Show route on map'}`}
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.9 }}>
                                                        <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                                                    </svg>
                                                    <span>{r.name}</span>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Liman & Deniz Yetki Alanı Bilgileri (Küçük ve Sade Menü) */}
                        {(() => {
                            const sc = (selectedStopInfo.stopClass || selectedStopInfo.routeClass || '').toLowerCase();
                            if (sc === 'gemi' || sc === 'liman' || selectedStopInfo.name?.toLowerCase().includes('liman') || selectedStopInfo.name?.toLowerCase().includes('iskele')) {
                                const portInfo = getSeaportInfo(selectedStopInfo.name);
                                if (portInfo) {
                                    return (
                                        <div style={{
                                            margin: '8px 0',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: isDarkMode ? 'rgba(8, 145, 178, 0.12)' : '#ecfeff',
                                            border: '1px solid rgba(8, 145, 178, 0.35)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" /></svg>
                                                    Deniz Yetki Alanı
                                                </span>
                                                <span style={{ fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(8, 145, 178, 0.2)', color: '#0891b2' }}>
                                                    {portInfo.maritimeZoneId}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                                <span style={{ color: '#94a3b8' }}>Bölge / Havza:</span>
                                                <span style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>{portInfo.region} ({portInfo.sea})</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                                <span style={{ color: '#94a3b8' }}>Bağlı İl:</span>
                                                <span style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>{portInfo.city}</span>
                                            </div>
                                            {portInfo.address && (
                                                <div style={{ fontSize: '10.5px', color: isDarkMode ? '#94a3b8' : '#475569', marginTop: '2px', borderTop: '1px dashed rgba(8, 145, 178, 0.25)', paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                    <span>{portInfo.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            }
                            return null;
                        })()}

                        {selectedStopInfo.routeId && (
                            <div className="stop-detail-row">
                                <span className="stop-detail-label">Durak Sırası:</span>
                                <span className="stop-detail-value" style={{ fontWeight: 700, color: selectedStopInfo.routeColor || '#3b82f6' }}>
                                    #{selectedStopInfo.orderIndex}. Durak {selectedStopInfo.totalStopsInRoute ? `(Toplam ${selectedStopInfo.totalStopsInRoute} durak)` : ''}
                                </span>
                            </div>
                        )}

                        {selectedStopInfo.latitude != null && selectedStopInfo.longitude != null && (
                            <div className="stop-detail-row">
                                <span className="stop-detail-label">Koordinatlar:</span>
                                <span className="stop-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{selectedStopInfo.latitude.toFixed(5)}° K, {selectedStopInfo.longitude.toFixed(5)}° D</span>
                                    <button
                                        type="button"
                                        className="btn-copy-inline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${selectedStopInfo.latitude}, ${selectedStopInfo.longitude}`);
                                            if (toastRef.current) {
                                                toastRef.current.show({ severity: 'info', summary: 'Kopyalandı', detail: 'Durak koordinatları panoya kopyalandı.', life: 2500 });
                                            }
                                        }}
                                        title="Koordinatları Kopyala"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        )}

                        {selectedStopInfo.description && (
                            <div className="stop-detail-row" style={{ flexDirection: 'column', gap: '4px' }}>
                                <span className="stop-detail-label">Açıklama:</span>
                                <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.4 }}>
                                    {selectedStopInfo.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="stop-card-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
                        {/* Yol Tarifi Al Butonu (POI gibi) */}
                        <button
                            type="button"
                            onClick={() => handleStartDirectionsToPoi(selectedStopInfo)}
                            title="Bu durağa yol tarifi hesapla"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: 'none'
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                            </svg>
                            <span>Yol Tarifi Al</span>
                        </button>

                        {canManageTransport && (
                            <>
                                <button
                                    type="button"
                                    className="stop-btn-manage"
                                    onClick={() => handleStartModifyingStop(selectedStopInfo)}
                                    title="Bu durağı haritada fare ile sürükleyerek yeni bir konuma taşıyın"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '7px 11px',
                                        borderRadius: '6px',
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        boxShadow: 'none'
                                    }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="5 9 2 12 5 15" />
                                        <polyline points="9 5 12 2 15 5" />
                                        <polyline points="15 19 12 22 9 19" />
                                        <polyline points="19 9 22 12 19 15" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <line x1="12" y1="2" x2="12" y2="22" />
                                    </svg>
                                    <span>Konumu Sürükle</span>
                                </button>

                                <button
                                    type="button"
                                    className="stop-btn-delete-icon"
                                    onClick={() => handleDeleteStopFromMap(selectedStopInfo.id, selectedStopInfo.name)}
                                    title="Durağı Sil"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* SEÇİLİ İL / DENİZ ALANI SINIR BİLGİ KUTUCUĞU (YÜZÖLÇÜMÜ & ÇEVRE UZUNLUĞU) */}
            {selectedBoundaryInfo && (
                <div className="stop-info-floating-card" style={{ maxWidth: '320px', zIndex: 1050 }}>
                    <div className="stop-card-header">
                        <div className="stop-card-title-group">
                            <div
                                className="stop-card-badge-icon"
                                style={{
                                    backgroundColor: selectedBoundaryInfo.isMaritime ? '#0284c7' : '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {selectedBoundaryInfo.isMaritime ? (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2"><path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" /></svg>
                                ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2"><path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 2L2 7h20L12 2z" /></svg>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 className="stop-card-title">{selectedBoundaryInfo.name}</h3>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {selectedBoundaryInfo.isMaritime ? 'Deniz Yetki Alanı' : 'İl İdari Sınırı'} {selectedBoundaryInfo.plate ? `(Kod: ${selectedBoundaryInfo.plate})` : ''}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedBoundaryInfo(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                            title="Kapat"
                        >
                            <CloseIcon size={14} />
                        </button>
                    </div>

                    <div className="stop-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="stop-detail-row">
                            <span className="stop-detail-label">Bölge / Havza:</span>
                            <span className="stop-detail-value" style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
                                {selectedBoundaryInfo.region || 'Belirtilmemiş'}
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            marginTop: '4px',
                            padding: '8px',
                            borderRadius: '8px',
                            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.35)' : '#f1f5f9',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Yüzölçümü</span>
                                <strong style={{ fontSize: '12.5px', color: selectedBoundaryInfo.isMaritime ? '#38bdf8' : '#3b82f6' }}>
                                    {selectedBoundaryInfo.formattedArea}
                                </strong>
                                {selectedBoundaryInfo.areaHa > 0 && (
                                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>({selectedBoundaryInfo.formattedAreaHa})</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Çevre / Kıyı</span>
                                <strong style={{ fontSize: '12.5px', color: '#a78bfa' }}>
                                    {selectedBoundaryInfo.formattedPerimeter}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DURAK KONUMUNU SÜRÜKLEME & TAŞIMA YÜZER BARI (STOP DRAG BAR) */}
            {isModifyingStop && modifyingStop && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: `1.5px solid ${modifyingStop.routeColor || '#ef4444'}`,
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="13" rx="2" />
                            <path d="M4 9h16" />
                            <circle cx="7.5" cy="14" r="1.2" fill="currentColor" />
                            <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
                        </svg>
                        DURAK TAŞIMA
                    </span>

                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        <strong style={{ color: '#f8fafc' }}>{modifyingStop.name}:</strong> Durağı yeni konumuna sürükleyin.
                    </span>

                    {modifiedStopCoords.lat != null && modifiedStopCoords.lon != null && (
                        <span style={{ fontSize: '11.5px', color: '#10b981', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '5px' }}>
                            {modifiedStopCoords.lat.toFixed(5)}°, {modifiedStopCoords.lon.toFixed(5)}°
                        </span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={handleSaveStopRepositioning}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Konumu Kaydet</span>
                        </button>

                        <button
                            type="button"
                            onClick={stopStopVertexEditing}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* SAĞ ÜST KÖŞE: GÜZERGAH VE CANLI ARAÇ BİLGİ POPUP YIĞINI (STACK) */}
            {(selectedRouteInfo || selectedVehicleInfo) && (
                <div className="route-cards-stack-container">
                    {/* 1. ÜSTTE: GÜZERGAH / HAT BİLGİ PANELİ */}
                    {selectedRouteInfo && (
                        <div className="stop-info-floating-card" style={{ borderLeft: `4px solid ${selectedRouteInfo.color || '#3b82f6'}` }}>
                            <div className="stop-card-header">
                                <div className="stop-card-title-group">
                                    <div
                                        className="stop-card-badge-icon"
                                        style={{
                                            backgroundColor: selectedRouteInfo.color || '#3b82f6'
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 12h4l3 8 4-16 3 8h4" />
                                        </svg>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 className="stop-card-title">{selectedRouteInfo.name}</h3>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Güzergah & Hat Bilgileri</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRouteInfo(null)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                    title="Kapat"
                                >
                                    <CloseIcon size={14} />
                                </button>
                            </div>

                            <div className="stop-card-body">
                                <div className="stop-detail-row">
                                    <span className="stop-detail-label">Durak Sayısı:</span>
                                    <span className="stop-detail-value" style={{ fontWeight: 700, color: selectedRouteInfo.color || '#3b82f6' }}>
                                        {selectedRouteInfo.stops?.length || selectedRouteInfo.stopCount || 0} Durak
                                    </span>
                                </div>

                                {(() => {
                                    const rClass = getRouteClassInfo(selectedRouteInfo.routeClass);
                                    return (
                                        <div className="stop-detail-row">
                                            <span className="stop-detail-label">Ulaşım Sınıfı:</span>
                                            <span className="stop-detail-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: rClass.color }}>
                                                <RouteClassIcon classKey={rClass.id} size={14} color={rClass.color} />
                                                <span>{rClass.label}</span>
                                            </span>
                                        </div>
                                    );
                                })()}

                                <div className="stop-detail-row">
                                    <span className="stop-detail-label">Hat Geometrisi:</span>
                                    <span className="stop-detail-value" style={{ color: selectedRouteInfo.wkt ? '#10b981' : '#38bdf8', fontWeight: 600 }}>
                                        {selectedRouteInfo.wkt ? 'Özel Bükülmüş Geometri' : 'Standart Durak Çizgisi'}
                                    </span>
                                </div>

                                {selectedRouteInfo.description && (
                                    <div className="stop-detail-row" style={{ flexDirection: 'column', gap: '4px' }}>
                                        <span className="stop-detail-label">Açıklama:</span>
                                        <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.4 }}>
                                            {selectedRouteInfo.description}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="stop-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                {/* 1. SATIR: CANLI SİMÜLASYON & SIGNALR TAKİP AKSİYONLARI */}
                                {(() => {
                                    const rId = Number(selectedRouteInfo.id ?? selectedRouteInfo.routeId);
                                    const currentSim = activeSimulations[rId] || activeSimulations[String(rId)];
                                    const isRunning = Boolean(currentSim?.isRunning);
                                    const isPaused = Boolean(currentSim?.isPaused);
                                    const isCurrentRouteLoading = simLoadingId === rId || simLoadingId === String(rId) || isSimLoading;
                                    const isFollowingThisRoute = Boolean(followingRouteId && Number(followingRouteId) === rId);
                                    const currentSpeed = simSpeedMap[rId] || 1;

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                            {/* SİMÜLASYON CANLI HIZ SEÇİCİ BARI (ÇALIŞIRKEN VE DURURKEN ANINDA DEĞİŞTİRİLEBİLİR) */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc',
                                                padding: '4px 8px',
                                                borderRadius: '8px',
                                                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`
                                            }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    color: isDarkMode ? '#94a3b8' : '#64748b',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    <span>{lang === 'tr' ? 'Simülasyon Hızı:' : 'Sim Speed:'}</span>
                                                </span>

                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    {[1, 1.5, 2, 2.5, 3].map(spd => {
                                                        const isSpdActive = currentSpeed === spd;
                                                        return (
                                                            <button
                                                                key={spd}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSimSpeedMap(prev => ({ ...prev, [rId]: spd }));
                                                                }}
                                                                title={`${spd}x Hız`}
                                                                style={{
                                                                    padding: '3px 7px',
                                                                    borderRadius: '5px',
                                                                    fontSize: '11px',
                                                                    fontWeight: isSpdActive ? 700 : 500,
                                                                    cursor: 'pointer',
                                                                    border: isSpdActive ? '1px solid #3b82f6' : (isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #cbd5e1'),
                                                                    backgroundColor: isSpdActive ? '#2563eb' : (isDarkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                                                                    color: isSpdActive ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                {spd}x
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* SİMÜLASYON ÇALIŞMA BUTONLARI (3 EŞİT SÜTUN) */}
                                            {isRunning ? (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', width: '100%' }}>
                                                    {/* DURAKLAT VEYA DEVAM ET BUTONU */}
                                                    {isPaused ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleResumeSimulation(rId, e)}
                                                            disabled={isCurrentRouteLoading}
                                                            title="Duraklatılan simülasyona kaldığı yerden devam et"
                                                            style={{
                                                                height: '36px',
                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                border: '1px solid #10b981',
                                                                color: '#10b981',
                                                                padding: '0 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '5px',
                                                                fontSize: '11.5px',
                                                                fontWeight: 700,
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                <polygon points="5 3 19 12 5 21 5 3" />
                                                            </svg>
                                                            <span>Devam Et</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handlePauseSimulation(rId, e)}
                                                            disabled={isCurrentRouteLoading}
                                                            title="Simülasyon hareketini anlık olarak duraklat"
                                                            style={{
                                                                height: '36px',
                                                                background: 'rgba(245, 158, 11, 0.15)',
                                                                border: '1px solid #f59e0b',
                                                                color: '#f59e0b',
                                                                padding: '0 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '5px',
                                                                fontSize: '11.5px',
                                                                fontWeight: 700,
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                                                <rect x="14" y="4" width="4" height="16" rx="1" />
                                                            </svg>
                                                            <span>Duraklat</span>
                                                        </button>
                                                    )}

                                                    {/* İPTAL ET / SİMÜLASYONU TAMAMEN KAPAT BUTONU */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleStopSimulation(rId, e)}
                                                        disabled={isCurrentRouteLoading}
                                                        title="Simülasyonu anında kapat ve aracı haritadan kaldır"
                                                        style={{
                                                            height: '36px',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: '1px solid #ef4444',
                                                            color: '#ef4444',
                                                            padding: '0 8px',
                                                            cursor: 'pointer',
                                                            borderRadius: '8px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '5px',
                                                            fontSize: '11.5px',
                                                            fontWeight: 700,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                            <rect x="4" y="4" width="16" height="16" rx="2" />
                                                        </svg>
                                                        <span>İptal Et</span>
                                                    </button>

                                                    {/* TAKİP ET / TAKİBİ BIRAK BUTONU */}
                                                    {isFollowingThisRoute ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnfollowVehicle()}
                                                            title="Kamera otomatik takibinden çık"
                                                            style={{
                                                                height: '36px',
                                                                background: 'rgba(59, 130, 246, 0.2)',
                                                                border: '1px solid #3b82f6',
                                                                color: '#38bdf8',
                                                                padding: '0 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '5px',
                                                                fontSize: '11.5px',
                                                                fontWeight: 700,
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                            </svg>
                                                            <span>Takibi Bırak</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFollowVehicle(rId)}
                                                            title="Aracı harita üzerinde canlı takip et"
                                                            style={{
                                                                height: '36px',
                                                                background: '#2563eb',
                                                                border: '1px solid #1d4ed8',
                                                                color: '#ffffff',
                                                                padding: '0 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '5px',
                                                                fontSize: '11.5px',
                                                                fontWeight: 700,
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                                <circle cx="12" cy="13" r="4" />
                                                            </svg>
                                                            <span>Takip Et</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleStartSimulation(rId, e)}
                                                    disabled={isCurrentRouteLoading}
                                                    title={lang === 'tr' ? "Güzergah üzerinde canlı araç simülasyonu başlat" : "Start live vehicle simulation along route"}
                                                    style={{
                                                        width: '100%',
                                                        height: '36px',
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        border: '1px solid #10b981',
                                                        color: '#10b981',
                                                        padding: '0 12px',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                    <span>{lang === 'tr' ? 'Simülasyonu Başlat' : 'Start Simulation'}</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* 2. SATIR: ROTA YÖNETİM BUTONLARI (HATTI BÜK, KUŞ UÇUŞU, OSRM, GERİ AL - EŞİTLENMİŞ 3 SÜTUN GRİD) */}
                                {canManageTransport && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '6px',
                                        width: '100%'
                                    }}>
                                        {/* HATTI BÜK BUTONU */}
                                        <button
                                            type="button"
                                            className="stop-btn-manage"
                                            onClick={() => handleStartModifyingRoute(selectedRouteInfo)}
                                            title={lang === 'tr' ? "Bu güzergahın harita üzerindeki çizgisini fare ile bükün ve şekillendirin" : "Bend and customize the route line geometry on map"}
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 4px rgba(37,99,235,0.25)',
                                                fontSize: '11.5px',
                                                fontWeight: 700,
                                                padding: '0 8px',
                                                height: '36px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <path d="M12 20h9"></path>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                            </svg>
                                            <span>{t.btnBendRoute || 'Hattı Bük'}</span>
                                        </button>

                                        {/* KUŞ UÇUŞU SIFIRLAMA BUTONU */}
                                        <button
                                            type="button"
                                            className="stop-btn-manage"
                                            onClick={() => handleSwitchGeometryModeFromMap(selectedRouteInfo.id, 'direct')}
                                            disabled={isGeneratingOsrmOnMapId === selectedRouteInfo.id}
                                            title={lang === 'tr' ? "Tüm bükümleri sıfırlayıp duraklar arası doğrudan düz çizgiye dönüştürür" : "Reset all bends to straight direct lines between stops"}
                                            style={{
                                                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                borderRadius: '8px',
                                                boxShadow: 'none',
                                                padding: '0 8px',
                                                height: '36px',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                cursor: isGeneratingOsrmOnMapId === selectedRouteInfo.id ? 'not-allowed' : 'pointer',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <line x1="5" y1="12" x2="19" y2="12"/><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/>
                                            </svg>
                                            <span>{t.btnDirect || 'Kuş Uçuşu'}</span>
                                        </button>

                                        {/* SADECE OTOBÜS İÇİN OSRM ROTA BUTONU VEYA GERİ AL BUTONU */}
                                        {selectedRouteInfo.previousWkt !== undefined ? (
                                            <button
                                                type="button"
                                                className="stop-btn-manage"
                                                onClick={() => handleRevertGeometryFromMap(selectedRouteInfo.id)}
                                                disabled={isGeneratingOsrmOnMapId === selectedRouteInfo.id}
                                                title={lang === 'tr' ? "Bir önceki geometri haline geri dön" : "Revert back to the previous geometry state"}
                                                style={{
                                                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                                                    color: isDarkMode ? '#e2e8f0' : '#334155',
                                                    border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                    borderRadius: '8px',
                                                    boxShadow: 'none',
                                                    padding: '0 8px',
                                                    height: '36px',
                                                    fontSize: '11.5px',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <polyline points="1 4 1 10 7 10"></polyline>
                                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                                </svg>
                                                <span>{t.undo || 'Geri Al'}</span>
                                            </button>
                                        ) : (((selectedRouteInfo.routeClass || '').toLowerCase() === 'otobus') ? (
                                            <button
                                                type="button"
                                                className="stop-btn-manage"
                                                onClick={() => handleGenerateOsrmRouteFromMap(selectedRouteInfo.id)}
                                                disabled={isGeneratingOsrmOnMapId === selectedRouteInfo.id}
                                                title={lang === 'tr' ? "OSRM ile duraklar arası gerçek karayolu rotasını hesapla ve haritaya çiz" : "Calculate real highway road routing with OSRM and draw on map"}
                                                style={{
                                                    backgroundColor: '#059669',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    boxShadow: 'none',
                                                    fontSize: '11.5px',
                                                    fontWeight: 700,
                                                    padding: '0 8px',
                                                    height: '36px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                    cursor: isGeneratingOsrmOnMapId === selectedRouteInfo.id ? 'not-allowed' : 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                                </svg>
                                                <span>{isGeneratingOsrmOnMapId === selectedRouteInfo.id ? '...' : (t.btnOsrmRoute || 'OSRM')}</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="stop-btn-manage"
                                                onClick={() => handleRevertGeometryFromMap(selectedRouteInfo.id)}
                                                disabled={true}
                                                style={{
                                                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                                                    color: isDarkMode ? '#475569' : '#94a3b8',
                                                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                                                    borderRadius: '8px',
                                                    boxShadow: 'none',
                                                    padding: '0 8px',
                                                    height: '36px',
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                    cursor: 'not-allowed',
                                                    opacity: 0.6,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <polyline points="1 4 1 10 7 10"></polyline>
                                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                                </svg>
                                                <span>{t.undo || 'Geri Al'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. GÜZERGAH BİLGİ PANELİNİN HEMEN ALTINDA: CANLI ARAÇ BİLGİ & YÜZDE TAMAMLANMA KARTI */}
                    {selectedVehicleInfo && (
                        <div className="vehicle-info-floating-card" style={{ borderLeft: `5px solid ${selectedVehicleInfo.routeColor || '#3b82f6'}` }}>
                            <div className="vehicle-card-header">
                                <div className="vehicle-header-left">
                                    <div className="vehicle-badge-icon" style={{ backgroundColor: selectedVehicleInfo.routeColor || '#3b82f6' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2" />
                                            <circle cx="7" cy="17" r="2" />
                                            <path d="M9 17h6" />
                                            <circle cx="17" cy="17" r="2" />
                                        </svg>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 className="vehicle-card-title">{selectedVehicleInfo.routeName}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                            <span className="sim-live-indicator">
                                                <span className="live-pulse-dot"></span>
                                                <span>CANLI ARAÇ TAKİBİ</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedVehicleInfo(null)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                    title="Kapat"
                                >
                                    <CloseIcon size={16} />
                                </button>
                            </div>

                            {/* GÜZERGAHIN YÜZDE KAÇININ TAMAMLANDIĞI BİLGİSİ VE İLERLEME ÇUBUĞU (DÜZ FLAT BAR) */}
                            <div className="vehicle-progress-section">
                                <div className="vehicle-progress-header">
                                    <span className="vehicle-progress-label">Güzergah Tamamlanma Oranı</span>
                                    <span className="vehicle-progress-percent">%{selectedVehicleInfo.progressPercentage?.toFixed(1) || 0} Tamamlandı</span>
                                </div>
                                <div className="vehicle-progress-track">
                                    <div
                                        className="vehicle-progress-fill"
                                        style={{
                                            width: `${Math.min(100, Math.max(0, selectedVehicleInfo.progressPercentage || 0))}%`,
                                            background: '#10b981'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* DURAK BİLGİLERİ IZGARASI */}
                            <div className="vehicle-stops-grid">
                                <div className="vehicle-stop-box">
                                    <span className="vehicle-stop-title">Son Geçilen Durak</span>
                                    <span className="vehicle-stop-name" title={selectedVehicleInfo.currentStopName}>
                                        {selectedVehicleInfo.currentStopName || 'Başlangıç Durağı'}
                                    </span>
                                </div>
                                <div className="vehicle-stop-box">
                                    <span className="vehicle-stop-title">Sıradaki Durak</span>
                                    <span className="vehicle-stop-name" style={{ color: '#38bdf8' }} title={selectedVehicleInfo.nextStopName}>
                                        {selectedVehicleInfo.nextStopName || 'Son Durak (Varış)'}
                                    </span>
                                </div>
                            </div>

                            {/* TELEMETRİ: HIZ VE SEYİR DURUMU */}
                            <div className="vehicle-telemetry-row">
                                <div className="vehicle-speed-badge">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M12 2v4" />
                                        <path d="m4.93 4.93 2.83 2.83" />
                                        <path d="M2 12h4" />
                                        <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                                    </svg>
                                    <span>Hız: ~{selectedVehicleInfo.speedKmH || 45} km/s</span>
                                </div>
                                <span style={{
                                    color: selectedVehicleInfo.isPaused ? '#f59e0b' : (selectedVehicleInfo.isCompleted ? '#10b981' : '#38bdf8'),
                                    fontWeight: 600,
                                    fontSize: '11.5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {selectedVehicleInfo.isPaused ? 'Duraklatıldı' : (selectedVehicleInfo.isCompleted ? 'Sefer Tamamlandı' : 'Seyir Halinde')}
                                </span>
                            </div>

                            {/* AKSİYON BUTONLARI (DÜZ VE EŞİT FLAT BUTONLAR) */}
                            <div className="vehicle-card-actions" style={{
                                display: 'grid',
                                gridTemplateColumns: followingRouteId === selectedVehicleInfo.routeId ? '1.2fr 1fr 1fr' : '2fr 1fr',
                                gap: '8px',
                                marginTop: '12px'
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        height: '36px',
                                        borderRadius: '6px',
                                        background: '#2563eb',
                                        border: '1px solid #1d4ed8',
                                        color: '#ffffff',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        if (mapRef.current && selectedVehicleInfo.longitude && selectedVehicleInfo.latitude) {
                                            mapRef.current.getView().animate({
                                                center: fromLonLat([selectedVehicleInfo.longitude, selectedVehicleInfo.latitude]),
                                                zoom: 16,
                                                duration: 700
                                            });
                                            handleFollowVehicle(selectedVehicleInfo.routeId);
                                        }
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span>{followingRouteId === selectedVehicleInfo.routeId ? (isTr ? 'Kamerayı Odakla' : 'Focus Camera') : (isTr ? 'Kamerayı Odakla & Takip Et' : 'Focus & Follow')}</span>
                                </button>

                                {followingRouteId === selectedVehicleInfo.routeId && (
                                    <button
                                        type="button"
                                        style={{
                                            height: '36px',
                                            borderRadius: '6px',
                                            background: '#ca8a04',
                                            border: '1px solid #a16207',
                                            color: '#ffffff',
                                            fontSize: '11.5px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onClick={() => handleUnfollowVehicle()}
                                    >
                                        {isTr ? 'Takibi Bırak' : 'Unfollow'}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    style={{
                                        height: '36px',
                                        borderRadius: '6px',
                                        background: '#334155',
                                        border: '1px solid #475569',
                                        color: '#cbd5e1',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onClick={() => setSelectedVehicleInfo(null)}
                                >
                                    {isTr ? 'Kapat' : 'Close'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* POI TAM EKRAN FOTOĞRAF GALERİSİ & AI GÖRSEL İNCELEME MODALI */}
            {showPoiLightbox && lightboxImages.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        backgroundColor: 'rgba(3, 7, 18, 0.95)',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '20px',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={() => setShowPoiLightbox(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setShowPoiLightbox(false);
                        if (e.key === 'ArrowLeft') setLightboxIndex(prev => (prev === 0 ? lightboxImages.length - 1 : prev - 1));
                        if (e.key === 'ArrowRight') setLightboxIndex(prev => (prev === lightboxImages.length - 1 ? 0 : prev + 1));
                    }}
                    tabIndex={0}
                >
                    {/* Üst Bar */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            zIndex: 2
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                                color: '#38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                                    {selectedPoiInfo?.name || 'POI Fotoğraf Galerisi'}
                                </h3>
                                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                    {selectedPoiInfo?.categoryName || 'İlgi Noktası'} • Fotoğraf {lightboxIndex + 1} / {lightboxImages.length}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <a
                                href={lightboxImages[lightboxIndex]}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                title="Orijinal Boyutta Aç"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                <span>Orijinal</span>
                            </a>

                            <button
                                type="button"
                                onClick={() => setShowPoiLightbox(false)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                                title="Kapat (ESC)"
                            >
                                <CloseIcon size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Ana Resim & Navigasyon Alanı */}
                    <div
                        style={{
                            position: 'relative',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '16px 0',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (lightboxImages.length > 1) {
                                setLightboxIndex(prev => (prev + 1) % lightboxImages.length);
                            }
                        }}
                    >
                        <img
                            src={lightboxImages[lightboxIndex]}
                            alt={`Galeri Fotoğrafı ${lightboxIndex + 1}`}
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '72vh',
                                objectFit: 'contain',
                                borderRadius: '12px',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        />

                        {/* Sol Ok */}
                        {lightboxImages.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxIndex(prev => (prev === 0 ? lightboxImages.length - 1 : prev - 1));
                                }}
                                style={{
                                    position: 'absolute',
                                    left: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                                title="Önceki (Sol Yön Tuşu)"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                        )}

                        {/* Sağ Ok */}
                        {lightboxImages.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxIndex(prev => (prev === lightboxImages.length - 1 ? 0 : prev + 1));
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                                title="Sonraki (Sağ Yön Tuşu)"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Alt Küçük Resim Şeridi */}
                    {lightboxImages.length > 1 && (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '10px',
                                overflowX: 'auto',
                                zIndex: 2
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {lightboxImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setLightboxIndex(idx)}
                                    style={{
                                        width: '60px',
                                        height: '40px',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        padding: 0,
                                        border: idx === lightboxIndex ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                                        opacity: idx === lightboxIndex ? 1 : 0.5,
                                        cursor: 'pointer',
                                        boxShadow: idx === lightboxIndex ? '0 0 12px rgba(56, 189, 248, 0.6)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <img src={img} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* GÜZERGAH BÜKME & ŞEKİLLENDİRME YÜZER BARI (ROUTE MODIFY BAR) */}
            {isModifyingRoute && modifyingRoute && (
                <div
                    className="floating-draw-bottom-bar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1010,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#0f172a',
                        border: `1.5px solid ${modifyingRoute.color || '#3b82f6'}`,
                        borderRadius: '12px',
                        padding: '10px 18px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        minWidth: 'auto',
                        width: 'auto'
                    }}
                >
                    <span
                        style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            letterSpacing: '0.4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12h4l3 8 4-16 3 8h4" />
                        </svg>
                        HAT BÜKME
                    </span>

                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        <strong style={{ color: '#f8fafc' }}>{modifyingRoute.name}:</strong> Kırılma noktalarını sürükleyin, yeni nokta için hatta tıklayın.
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={handleResetRouteBending}
                            title="Varsayılan Düz Çizgiye Dönüştür (Özel Bükümü Sıfırla)"
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: '#e2e8f0',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                cursor: 'pointer'
                            }}
                        >
                            Düzleştir
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveRouteBending}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                borderRadius: '7px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Hattı Kaydet</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCancelRouteBending}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                borderRadius: '7px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* HARİTADA DURAK EKLEME MODALI (OPERATÖR & ADMİN) */}
            {showAddStopModal && (
                <div className="modal-overlay" onClick={() => setShowAddStopModal(false)}>
                    <div
                        className="poi-create-modal-container"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '460px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="4" width="16" height="13" rx="2" />
                                        <path d="M4 9h16" />
                                        <circle cx="7.5" cy="14" r="1.3" fill="currentColor" />
                                        <circle cx="16.5" cy="14" r="1.3" fill="currentColor" />
                                        <path d="M6 17v2.5M18 17v2.5" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Haritada Yeni Durak Ekle</h3>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>İşaretlenen noktaya durak tanımlayıp güzergaha bağlayın.</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddStopModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                title="Kapat"
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewStop} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Durak İsmi *</label>
                                <input
                                    type="text"
                                    className="poi-modal-input"
                                    placeholder="Örn: Kadıköy Rıhtım, Taksim Meydan, Çengelköy..."
                                    value={newStopForm.name}
                                    onChange={(e) => setNewStopForm({ ...newStopForm, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Durak Sınıfı / Türü *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                    {[
                                        { id: 'otobus', label: 'Otobüs' },
                                        { id: 'metro', label: 'Metro/Raylı' },
                                        { id: 'gemi', label: 'Liman/İskele' },
                                        { id: 'tren', label: 'Tren/Gar' },
                                        { id: 'araba', label: 'Karayolu' }
                                    ].map(item => {
                                        const isSelected = (newStopForm.stopClass || 'otobus').toLowerCase() === item.id;
                                        const clsInfo = getRouteClassInfo(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setNewStopForm({ ...newStopForm, stopClass: item.id })}
                                                style={{
                                                    padding: '6px 8px',
                                                    borderRadius: '8px',
                                                    border: isSelected ? `1.5px solid ${clsInfo.color}` : '1px solid rgba(255,255,255,0.12)',
                                                    backgroundColor: isSelected ? `${clsInfo.color}25` : 'rgba(255,255,255,0.04)',
                                                    color: isSelected ? '#ffffff' : '#94a3b8',
                                                    fontWeight: isSelected ? '700' : '500',
                                                    fontSize: '11.5px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <RouteClassIcon classKey={item.id} size={14} color={isSelected ? clsInfo.color : '#94a3b8'} />
                                                <span>{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="poi-modal-form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="poi-modal-form-label" style={{ margin: 0 }}>Güzergah Seçiniz</label>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>(Opsiyonel)</span>
                                </div>
                                <select
                                    className="poi-modal-input"
                                    value={newStopForm.routeId}
                                    onChange={(e) => setNewStopForm({ ...newStopForm, routeId: e.target.value })}
                                    style={{ marginTop: '5px' }}
                                >
                                    <option value="">-- Hat Seçilmedi (Bağlantısız) --</option>
                                    {routes.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} ({r.stops?.length || 0} Durak)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">Açıklama (Opsiyonel)</label>
                                <textarea
                                    className="poi-modal-input"
                                    rows="2"
                                    placeholder="Örn: Aktarma merkezi, metro bağlantısı mevcut..."
                                    value={newStopForm.description}
                                    onChange={(e) => setNewStopForm({ ...newStopForm, description: e.target.value })}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {/* KOORDİNAT GÖSTERGESİ */}
                            <div className="poi-coord-preview-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10" />
                                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                                </svg>
                                <span><strong>Durak Konumu:</strong> {draftStopCoords.lat?.toFixed(5)}° K, {draftStopCoords.lon?.toFixed(5)}° D</span>
                            </div>

                            <div className="poi-modal-actions">
                                <button type="button" className="poi-btn-cancel" onClick={() => setShowAddStopModal(false)}>
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="poi-btn-save"
                                    disabled={isSubmittingStop}
                                    style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }}
                                >
                                    {isSubmittingStop ? (
                                        <span>Kaydediliyor...</span>
                                    ) : (
                                        <>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            <span>Durağı Kaydet</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (GÜNCELLEME / TAMAMLA ONAYI) */}
            {updateConfirmTarget && (
                <div className="modal-overlay" onClick={() => setUpdateConfirmTarget(null)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Çizim Güncellemesini Onaylayın</h3>
                        <p className="modal-description">
                            <strong>"{updateConfirmTarget.name}"</strong> nesnesinin yeni konumu (WKT), kırılma noktaları ve görsel özellikleri veritabanına kaydedilecektir. Devam etmek istiyor musunuz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setUpdateConfirmTarget(null)}>
                                Vazgeç (İptal)
                            </button>
                            <button className="modal-btn btn-primary-confirm" onClick={executeDrawingUpdateConfirmed} style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                                Evet, Kaydet ve Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR PREVENTION MODAL (DÜZENLEMELERİ İPTAL ET / ESKİ HALİNE DÖN) */}
            {cancelEditConfirm && (
                <div className="modal-overlay" onClick={() => setCancelEditConfirm(false)}>
                    <div className="error-prevention-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon-badge warning">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h3 className="modal-title">Değişiklikleri İptal Etmeyi Onaylayın</h3>
                        <p className="modal-description">
                            Haritada yaptığınız kırılma noktası değişiklikleri silinecek ve çizim orijinal haline geri dönecektir. Emin misiniz?
                        </p>

                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel" onClick={() => setCancelEditConfirm(false)}>
                                Düzenlemeye Devam Et
                            </button>
                            <button className="modal-btn btn-danger-confirm" onClick={confirmCancelVertexEditing} style={{ backgroundColor: '#f59e0b', borderColor: '#d97706' }}>
                                Evet, İptal Et (Eski Hali)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NOKTA, ÇİZGİ VE POLİGON ÇİZİM DETAY BİLGİ VE DÜZENLEME PANELİ (SAĞ ÜST KART) */}
            {selectedPointInfo && (
                <div className={`ol-popup-card ${isPopupCollapsed ? 'collapsed' : ''}`} style={{ borderLeft: `4px solid ${editColor || selectedPointInfo.color || '#3b82f6'}` }}>
                    <div className="ol-popup-header">
                        <div className="ol-popup-title-wrapper">
                            <span
                                className="ol-popup-color-dot"
                                style={{ backgroundColor: editColor || selectedPointInfo.color || '#3b82f6' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 className="ol-popup-title">{editName || selectedPointInfo.name}</h4>
                                <span className="ol-popup-badge">
                                    {selectedPointInfo.type === 'SavedPlace' && t.savedPlaceBadge}
                                    {(selectedPointInfo.type === 'PointDrawing' || selectedPointInfo.type === 'Point') && t.pointDrawingBadge}
                                    {(selectedPointInfo.type === 'LineDrawing' || selectedPointInfo.type === 'Line') && t.lineTypeLabel}
                                    {(selectedPointInfo.type === 'PolygonDrawing' || selectedPointInfo.type === 'Polygon') && t.polygonTypeLabel}
                                    {selectedPointInfo.type === 'SelectedPoint' && t.selectedPointBadge}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                type="button"
                                className="ol-popup-minimize-btn"
                                onClick={() => setIsPopupCollapsed(!isPopupCollapsed)}
                                title={isPopupCollapsed ? "Paneli Genişlet" : "Paneli Küçült/Gizle"}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {isPopupCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
                                </svg>
                            </button>
                            <button className="ol-popup-close-btn" onClick={handleClosePointInfo} title={t.btnCloseInfoPanel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <CloseIcon size={14} />
                            </button>
                        </div>
                    </div>

                    {!isPopupCollapsed && (
                        <div className="ol-popup-body" style={{ padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                            {selectedPointInfo.id && selectedPointInfo.type !== 'SavedPlace' && canEditDrawing(selectedPointInfo) ? (
                                <>
                                    <div className="ol-popup-field-group" style={{ marginBottom: 0 }}>
                                        <label className="ol-popup-field-label" style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9"/>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                            </svg>
                                            Obje İsmi:
                                        </label>
                                        <input
                                            type="text"
                                            className="ol-popup-input"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="İsim girin..."
                                            style={{ width: '100%', boxSizing: 'border-box', height: '30px', fontSize: '12px', padding: '4px 8px' }}
                                        />
                                    </div>

                                    <div className="ol-popup-field-group" style={{ marginBottom: 0 }}>
                                        <label className="ol-popup-field-label" style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/>
                                                <circle cx="12" cy="12" r="4"/>
                                            </svg>
                                            Renk:
                                        </label>
                                        <div className="ol-popup-color-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div className="ol-popup-color-presets" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {PRESET_COLORS.map((c) => (
                                                    <button
                                                        key={c.hex}
                                                        type="button"
                                                        className={`ol-popup-color-swatch ${editColor === c.hex ? 'active' : ''}`}
                                                        style={{
                                                            backgroundColor: c.hex,
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            border: editColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                                            boxShadow: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0
                                                        }}
                                                        onClick={() => setEditColor(c.hex)}
                                                        title={c.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {/* Metrik Bilgileri (Uzunluk / Alan / Konum) */}
                            {selectedPointInfo.lengthText && (
                                <div className="drawing-stat-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '7px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><path d="M4 20L20 4" /></svg>
                                        {t.totalLengthLabel}:
                                    </span>
                                    <strong style={{ fontSize: '12px', color: editColor || '#3b82f6', fontWeight: 700 }}>{selectedPointInfo.lengthText}</strong>
                                </div>
                            )}

                            {selectedPointInfo.areaText && (
                                <div className="drawing-stat-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '7px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polygon points="12 2 22 8.5 18 19 6 19 2 8.5" /></svg>
                                        {t.totalAreaLabel}:
                                    </span>
                                    <strong style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>{selectedPointInfo.areaText}</strong>
                                </div>
                            )}

                            {selectedPointInfo.lat != null && selectedPointInfo.lon != null && (
                                <div className="drawing-stat-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Konum:</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <strong style={{ fontSize: '11.5px', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{selectedPointInfo.lat.toFixed ? selectedPointInfo.lat.toFixed(5) : selectedPointInfo.lat}°, {selectedPointInfo.lon.toFixed ? selectedPointInfo.lon.toFixed(5) : selectedPointInfo.lon}°</strong>
                                        <button
                                            type="button"
                                            className="btn-copy-inline"
                                            onClick={handleCopyCoords}
                                            title="Koordinatları Kopyala"
                                        >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* WKT Kopyalama Kısa Butonu */}
                            {selectedPointInfo.wkt && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', paddingTop: '2px' }}>
                                    <span>WKT Geometrisi:</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(editWkt || selectedPointInfo.wkt);
                                            if (toastRef.current) {
                                                toastRef.current.show({ severity: 'info', summary: 'Kopyalandı', detail: 'WKT geometrisi panoya kopyalandı.', life: 2500 });
                                            }
                                        }}
                                        title="WKT Metnini Kopyala"
                                        style={{ background: 'none', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '11px', padding: '2px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        <span>WKT Kopyala</span>
                                    </button>
                                </div>
                            )}

                            {/* Sadece Kırılma Noktaları Düzenlenirken Aktif Uyarı */}
                            {isModifyingVertex && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '7px', color: '#86efac', fontSize: '11.5px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    <span>Noktaları sürükleyin, bitirmek için "Kaydet"e basın.</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="ol-popup-footer">
                        {userRole !== 'Viewer' && selectedPointInfo.id && selectedPointInfo.type !== 'SavedPlace' && (
                            canEditDrawing(selectedPointInfo) ? (
                                <>
                                    <button
                                        type="button"
                                        className="ol-popup-btn btn-save-update"
                                        onClick={handleUpdateDrawingFromPopup}
                                        title="Değişiklikleri Kaydet ve Güncelle"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>Kaydet</span>
                                    </button>

                                    <button
                                        type="button"
                                        className={`ol-popup-btn btn-vertex-edit ${isModifyingVertex ? 'active-vertex' : ''}`}
                                        onClick={isModifyingVertex ? handleTriggerCancelVertexEditing : startVertexEditing}
                                        title={isModifyingVertex ? "Düzenlemeyi İptal Et (Vazgeç)" : "Kırılma Noktalarını Fare ile Düzenle"}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            {isModifyingVertex ? (
                                                <>
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </>
                                            ) : (
                                                <>
                                                    <circle cx="12" cy="12" r="3"/>
                                                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                                                </>
                                            )}
                                        </svg>
                                    </button>

                                    {isModifyingVertex && (
                                        <>
                                            <button
                                                type="button"
                                                className="ol-popup-btn btn-undo-redo"
                                                onClick={handleUndoGeometry}
                                                disabled={historyIndex <= 0}
                                                title="Geri Al (Undo)"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 7v6h6"/>
                                                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="ol-popup-btn btn-undo-redo"
                                                onClick={handleRedoGeometry}
                                                disabled={historyIndex < 0 || historyIndex >= geometryHistoryRef.current.length - 1}
                                                title="İleri Al (Redo)"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 7v6h-6"/>
                                                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                                                </svg>
                                            </button>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        className="ol-popup-btn btn-delete-soft"
                                        onClick={triggerDeleteDrawingFromPopup}
                                        title="Çizimi Sil (Soft Delete)"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', width: '100%', textAlign: 'center' }}>
                                    {(selectedPointInfo.insertedUserId === 1 || (selectedPointInfo.insertedUsername || '').toLowerCase().includes('admin'))
                                        ? 'Yönetici Çizimi (Yalnızca Admin Tarafından Düzenlenebilir)'
                                        : 'Yalnızca Görüntüleme Modu (Düzenlemek için İşbirliği Gerekir)'}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* ISI HARİTASI LEJANTI (SAĞ ALT KÖŞE) */}
            {isHeatmapActive && (
                <div className="heatmap-legend-floating-card">
                    <div className="heatmap-legend-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>Nokta Yoğunluğu (Isı Haritası)</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsHeatmapActive(false)}
                            className="heatmap-legend-close"
                            title="Lejantı Kapat"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                        >
                            <CloseIcon size={13} />
                        </button>
                    </div>

                    {/* GEOMETRİ TÜRÜ FİLTRELEME BUTONLARI (TÜMÜ / NOKTA / ÇİZGİ / POLİGON) */}
                    <div className="heatmap-filter-pill-group">
                        {[
                            { id: 'ALL', label: 'Tümü' },
                            { id: 'Point', label: 'Nokta' },
                            { id: 'Line', label: 'Çizgi' },
                            { id: 'Polygon', label: 'Poligon' }
                        ].map(f => (
                            <button
                                key={f.id}
                                type="button"
                                className={`heatmap-filter-pill-btn ${heatmapTypeFilter === f.id ? 'active' : ''}`}
                                onClick={() => setHeatmapTypeFilter(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Renk Skalası Şeridi (0.0 Mavi -> Camgöbeği -> Yeşil -> Sarı -> 1.0 Kırmızı) */}
                    <div className="heatmap-gradient-strip" />

                    {/* 0.0 - 1.0 Değer Aralıkları */}
                    <div className="heatmap-scale-labels">
                        <span>0.0 (Düşük)</span>
                        <span>0.5 (Orta)</span>
                        <span>1.0 (Yüksek)</span>
                    </div>

                    <div className="heatmap-legend-footer">
                        <span>Analiz Kapsamı:</span>
                        <strong style={{ color: '#f97316' }}>
                            {heatmapSourceRef.current ? heatmapSourceRef.current.getFeatures().length : 0} Konum / Nokta
                        </strong>
                    </div>
                </div>
            )}

            {/* HARİTADA POLİGON ÇİZME SIRASINDA BİLGİ BARI */}
            {isDrawingAnalysisBoundary && (
                <div
                    style={{
                        position: 'absolute',
                        top: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1200,
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
                        border: '2px solid #8b5cf6',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        boxShadow: '0 12px 36px rgba(139, 92, 246, 0.35)',
                        color: isDarkMode ? '#f8fafc' : '#0f172a'
                    }}
                >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        Analiz yapılacak hedef bölgeyi harita üzerine poligon olarak çizin (bitirmek için çift tıklayın)...
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsDrawingAnalysisBoundary(false);
                            setDrawType('None');
                            setShowLocationAnalysisModal(true);
                        }}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        İptal
                    </button>
                </div>
            )}

            {/* ÇOK KRİTERLİ KONUM ANALİZİ MODALI */}
            {showLocationAnalysisModal && (
                <div className="modal-overlay" onClick={() => setShowLocationAnalysisModal(false)}>
                    <div
                        className="location-analysis-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="location-analysis-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <div className="location-analysis-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="6" />
                                        <circle cx="12" cy="12" r="2" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.2px' }}>
                                        {t.locationAnalysisTitle || (isTr ? 'Konum Analizi' : 'Location Analysis')}
                                    </h3>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                        {t.locationAnalysisSubtitle || (isTr ? 'Kriterlere göre ağırlıklı Isı Haritası analizi' : 'Weighted heatmap analysis based on criteria')}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLocationAnalysisModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                title={t.closeBtn || (isTr ? 'Kapat' : 'Close')}
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="location-analysis-modal-body">
                            {/* 1. HEDEF BÖLGE SEÇİMİ */}
                            <div className="analysis-step-card">
                                <div className="analysis-step-header">
                                    <span className="step-badge">1</span>
                                    <h4 className="step-title">{t.targetRegionSelection || (isTr ? 'Hedef Bölge / Alan Seçimi' : 'Target Region / Area Selection')}</h4>
                                </div>

                                <div className="analysis-area-toggle-group">
                                    <button
                                        type="button"
                                        className={`area-toggle-btn ${locationAnalysisAreaMode === 'city' ? 'active' : ''}`}
                                        onClick={() => setLocationAnalysisAreaMode('city')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="4" y="2" width="16" height="20" rx="2" />
                                            <line x1="9" y1="22" x2="9" y2="22.01" />
                                            <line x1="15" y1="22" x2="15" y2="22.01" />
                                        </svg>
                                        {t.selectFromProvinces || (isTr ? 'İller Listesinden Seç' : 'Select from Provinces')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`area-toggle-btn ${locationAnalysisAreaMode === 'polygon' ? 'active' : ''}`}
                                        onClick={() => setLocationAnalysisAreaMode('polygon')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 22 7.5 18 19 6 19 2 8.5" />
                                        </svg>
                                        {t.drawPolygonOnMap || (isTr ? 'Haritada Poligon Çiz' : 'Draw Polygon on Map')}
                                    </button>
                                </div>

                                {locationAnalysisAreaMode === 'city' ? (
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                                            {t.selectProvinceForAnalysis || (isTr ? 'Analiz Yapılacak İli Seçiniz:' : 'Select Province for Analysis:')}
                                        </label>
                                        <select
                                            className="analysis-select"
                                            value={selectedAnalysisCityPlate}
                                            onChange={(e) => setSelectedAnalysisCityPlate(e.target.value)}
                                        >
                                            <option value="">{t.selectProvincePlaceholder || (isTr ? '-- Bir İl Seçiniz (Örn: Ankara, İstanbul, İzmir...) --' : '-- Select a Province (e.g. Ankara, Istanbul, Izmir...) --')}</option>
                                            {citiesList.map(city => (
                                                <option key={city.plate || city.id} value={city.plate || city.id}>
                                                    {city.plate ? `${String(city.plate).padStart(2, '0')} - ` : ''}{city.name} {city.region ? `(${city.region})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn-draw-boundary-action"
                                                onClick={handleStartDrawingAnalysisBoundary}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                                </svg>
                                                {analysisDrawnWkt 
                                                    ? (t.redrawAreaOnMap || (isTr ? 'Alanı Haritada Yeniden Çiz' : 'Redraw Area on Map')) 
                                                    : (t.drawPolygonArea || (isTr ? 'Haritada Poligon Alanı Çiz' : 'Draw Polygon Area on Map'))}
                                            </button>
                                            {analysisDrawnWkt && (
                                                <span className="drawn-wkt-status-badge">
                                                    {t.polygonAreaSelected || (isTr ? 'Poligon Alanı Seçildi' : 'Polygon Area Selected')}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {t.drawBoundaryHint || (isTr ? 'Harita üzerine tıklayarak analiz sınırını çizebilir, çift tıklayarak tamamlayabilirsiniz.' : 'Click on map to draw analysis boundary, double-click to finish.')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 2. KRİTER BELİRLEME & AĞIRLIKLI PUAN DAĞILIMI */}
                            <div className="analysis-step-card">
                                <div className="analysis-step-header" style={{ justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="step-badge">2</span>
                                        <h4 className="step-title">{t.categoryCriteriaWeight || (isTr ? 'Kategori Kriterleri & Ağırlık Dağılımı' : 'Category Criteria & Weight Distribution')}</h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            type="button"
                                            className="btn-criteria-header-action"
                                            onClick={handleDistributeWeightsEvenly}
                                            title={isTr ? "Tüm kriter puanlarını eşit olarak dağıtır" : "Distributes all criteria weights equally"}
                                        >
                                            {t.distributeEvenly || (isTr ? 'Eşit Dağıt' : 'Distribute Equally')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-criteria-header-action"
                                            onClick={handleAddCriterion}
                                            disabled={analysisCriteria.length >= 5}
                                            title={isTr ? "Yeni kriter ekler (En fazla 5)" : "Add new criterion (Max 5)"}
                                        >
                                            {t.addCriterion || '+ Kriter Ekle'} ({analysisCriteria.length}/5)
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                        {isTr 
                                            ? <>En az <strong>2</strong>, en fazla <strong>5</strong> kriter. Puan toplamı tam <strong>100</strong> olmalıdır.</>
                                            : <>Min <strong>2</strong>, max <strong>5</strong> criteria. Total score must equal <strong>100</strong>.</>}
                                    </span>
                                    {/* Toplam Puan Rozeti */}
                                    {(() => {
                                        const sum = analysisCriteria.reduce((acc, c) => acc + (parseInt(c.weight, 10) || 0), 0);
                                        const isExact100 = sum === 100;
                                        return (
                                            <span
                                                className={`total-score-badge ${isExact100 ? 'valid' : 'invalid'}`}
                                            >
                                                {isExact100 
                                                    ? (t.totalScoreValid || (isTr ? `Toplam Puan: 100 / 100 (Geçerli)` : `Total Score: 100 / 100 (Valid)`))
                                                    : (isTr ? `Toplam: ${sum} / 100 (${100 - sum > 0 ? `+${100 - sum} eksik` : `${sum - 100} fazla`})` : `Total: ${sum} / 100 (${100 - sum > 0 ? `+${100 - sum} remaining` : `${sum - 100} excess`})`)}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Kriter Kartları Listesi */}
                                <div className="criteria-list-container">
                                    {analysisCriteria.map((criterion, index) => {
                                        return (
                                            <div key={criterion.id} className="criterion-row-card">
                                                <div className="criterion-index-circle">
                                                    {index + 1}
                                                </div>

                                                {/* Kategori Seçici (Hiyerarşik & Renk Göstergeli) */}
                                                <div style={{ flex: 1.2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {(() => {
                                                        const selectedCat = poiCategories.find(c => String(c.id) === String(criterion.categoryId));
                                                        return selectedCat ? (
                                                            <span
                                                                style={{
                                                                    width: '10px',
                                                                    height: '10px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: selectedCat.color || '#3b82f6',
                                                                    boxShadow: 'none',
                                                                    flexShrink: 0,
                                                                    display: 'inline-block'
                                                                }}
                                                                title={`Kategori Rengi: ${selectedCat.color || '#3b82f6'}`}
                                                            />
                                                        ) : (
                                                            <span style={{ width: '10px', height: '10px', flexShrink: 0, display: 'inline-block' }} />
                                                        );
                                                    })()}
                                                    <select
                                                        className="analysis-select"
                                                        value={criterion.categoryId}
                                                        onChange={(e) => handleCriterionCategoryChange(criterion.id, e.target.value)}
                                                        style={{ flex: 1 }}
                                                    >
                                                        <option value="">{t.selectCategoryPlaceholder || (isTr ? '-- Kategori Seçiniz --' : '-- Select Category --')}</option>
                                                        {poiCategories.filter(p => !p.parentId).map(parent => {
                                                            const subCats = poiCategories.filter(c => c.parentId === parent.id);
                                                            return (
                                                                <optgroup key={`optgroup-${parent.id}`} label={`● ${parent.name}`}>
                                                                    <option value={parent.id} style={{ fontWeight: 700 }}>
                                                                        {parent.name} ({t.allSubCategories || (isTr ? 'Tüm Alt Kategoriler' : 'All Sub-Categories')})
                                                                    </option>
                                                                    {subCats.map(sub => (
                                                                        <option key={sub.id} value={sub.id}>
                                                                            &nbsp;&nbsp;↳ {sub.name}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                {/* Ağırlık Puanı Slider & Input */}
                                                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={criterion.weight}
                                                        onChange={(e) => handleCriterionWeightChange(criterion.id, e.target.value)}
                                                        className="criterion-range-slider"
                                                    />
                                                    <div className="criterion-weight-box">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={criterion.weight}
                                                            onChange={(e) => handleCriterionWeightChange(criterion.id, e.target.value)}
                                                            className="criterion-weight-input"
                                                        />
                                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{t.scoreUnit || (isTr ? 'Puan' : 'Score')}</span>
                                                    </div>
                                                </div>

                                                {/* Silme Butonu */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCriterion(criterion.id)}
                                                    disabled={analysisCriteria.length <= 2}
                                                    className="btn-remove-criterion"
                                                    title={analysisCriteria.length <= 2 ? (t.minCriteriaRequired || 'En az 2 kriter bulunmalıdır') : (t.removeCriterionTooltip || 'Kriteri Sil')}
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* HATA MESAJI (VARSA) */}
                            {locationAnalysisError && (
                                <div className="analysis-error-banner">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span>{locationAnalysisError}</span>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="location-analysis-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {(() => {
                                const totalWeight = analysisCriteria.reduce((sum, c) => sum + (parseInt(c.weight, 10) || 0), 0);
                                const isReady = totalWeight === 100 &&
                                    analysisCriteria.length >= 2 &&
                                    analysisCriteria.length <= 5 &&
                                    analysisCriteria.every(c => !!c.categoryId) &&
                                    (locationAnalysisAreaMode === 'city' ? !!selectedAnalysisCityPlate : !!analysisDrawnWkt);

                                return (
                                    <button
                                        type="button"
                                        onClick={handleExecuteLocationAnalysis}
                                        disabled={!isReady || locationAnalysisLoading}
                                        className={`analysis-btn-submit ${isReady ? 'ready' : 'disabled'}`}
                                    >
                                        {locationAnalysisLoading ? (
                                            <>
                                                <span className="spinner-mini" />
                                                {t.calculatingAnalysis || (isTr ? 'Analiz Hesaplanıyor...' : 'Calculating Analysis...')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                </svg>
                                                {t.startAnalysisGenerateHeatmap || (isTr ? 'Analizi Başlat (Isı Haritası Üret)' : 'Start Analysis (Generate Heatmap)')}
                                            </>
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* KONUM ANALİZİ SONUÇ KARTI (SAĞ / SOL ALTTA YÜZER PANEL) */}
            {locationAnalysisResult && (
                <div className="location-analysis-result-card">
                    <div className="analysis-result-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
                            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700 }}>
                                {t.locationAnalysisResultTitle || (isTr ? 'Konum Analizi:' : 'Location Analysis:')} {locationAnalysisResult.boundaryName}
                            </h4>
                        </div>
                        <button
                            type="button"
                            onClick={handleClearLocationAnalysis}
                            className="analysis-result-close-btn"
                            title={t.clearAnalysis || (isTr ? 'Analizi Temizle' : 'Clear Analysis')}
                        >
                            &times;
                        </button>
                    </div>

                    <div className="analysis-result-body">
                        {/* Toplam POI ve Skor Özeti */}
                        <div className="analysis-metric-grid">
                            <div className="metric-box">
                                <span className="metric-value" style={{ color: '#8b5cf6' }}>
                                    {locationAnalysisResult.totalPoiCount}
                                </span>
                                <span className="metric-label">{t.analyzedPoiCount || (isTr ? 'Analiz Edilen POI' : 'Analyzed POIs')}</span>
                            </div>
                            <div className="metric-box">
                                <span className="metric-value" style={{ color: '#10b981' }}>
                                    %{Math.round(locationAnalysisResult.overallScore)}
                                </span>
                                <span className="metric-label">{t.criteriaFulfillment || (isTr ? 'Kriter Karşılanma' : 'Criteria Fulfillment')}</span>
                            </div>
                        </div>

                        {/* Kriter Bazında Dağılım Çubukları */}
                        <div className="result-criteria-list">
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {t.criteriaContributionDistribution || (isTr ? 'Kriter Bazında Katkı Dağılımı:' : 'Contribution by Criteria:')}
                            </span>
                            {locationAnalysisResult.criteriaSummaries?.map(summary => (
                                <div key={summary.categoryId} className="result-criterion-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: summary.categoryColor || '#3b82f6', display: 'inline-block' }} />
                                            {summary.categoryName} ({summary.poiCount} POI)
                                        </span>
                                        <strong style={{ color: summary.categoryColor || '#8b5cf6' }}>
                                            %{summary.weight} {t.scoreUnit || (isTr ? 'Puan' : 'Score')}
                                        </strong>
                                    </div>
                                    <div className="result-progress-track">
                                        <div
                                            className="result-progress-bar"
                                            style={{
                                                width: `${summary.weight}%`,
                                                backgroundColor: summary.categoryColor || '#8b5cf6'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="analysis-result-footer">
                        <button
                            type="button"
                            className="btn-analysis-reconfigure"
                            onClick={() => setShowLocationAnalysisModal(true)}
                        >
                            {t.editCriteria || (isTr ? 'Kriterleri Düzenle' : 'Edit Criteria')}
                        </button>
                        <button
                            type="button"
                            className="btn-analysis-clear"
                            onClick={handleClearLocationAnalysis}
                        >
                            {t.clearAnalysis || (isTr ? 'Analizi Temizle' : 'Clear Analysis')}
                        </button>
                    </div>
                </div>
            )}

            {/* YOL TARİFİ DURAK VE KONUM YÖNETİM PANELİ (KOMPAKT & POI ARAMA BARI ALTINDA) */}
            {directionsState.active && (
                <div
                    style={{
                        position: 'absolute',
                        top: '74px',
                        left: isSidebarOpen ? '430px' : '86px',
                        zIndex: 1003,
                        width: '330px',
                        maxWidth: 'calc(100vw - 120px)',
                        transition: 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        backgroundColor: '#0b1329',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65)',
                        color: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        animation: 'fadeInDown 0.18s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Panel Başlığı ve Hızlı İşlemler */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                                {t.waypointsTitle || 'Duraklar'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                                {directionsState.waypoints?.length || 2}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <button
                                type="button"
                                onClick={handleReverseWaypoints}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#38bdf8',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '10.5px',
                                    fontWeight: 600
                                }}
                                title={t.reverseOrder || "Sırayı Ters Çevir"}
                            >
                                <span>⇅</span>
                                <span>{lang === 'tr' ? 'Ters' : 'Reverse'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClearDirections}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '3px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                title={t.closeBtn || "Kapat"}
                            >
                                <CloseIcon size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Duraklar Sıralı Listesi (Kompakt Sürükle - Bırak) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                        {(() => {
                            const waypoints = directionsState.waypoints && directionsState.waypoints.length > 0
                                ? directionsState.waypoints
                                : [
                                    { id: 'start', name: directionsState.startName || (lang === 'tr' ? 'Başlangıç' : 'Start'), lon: directionsState.startCoord?.lon, lat: directionsState.startCoord?.lat },
                                    { id: 'target', name: directionsState.targetName || (lang === 'tr' ? 'Hedef' : 'Destination'), lon: directionsState.targetCoord?.lon, lat: directionsState.targetCoord?.lat, poiId: directionsState.targetPoiId }
                                ];

                            return waypoints.map((wp, idx) => {
                                const isStart = idx === 0;
                                const isEnd = idx === waypoints.length - 1;
                                const letter = String.fromCharCode(65 + Math.min(idx, 25));
                                const badgeColor = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#3b82f6');
                                const roleLabel = isStart ? (lang === 'tr' ? 'Başlangıç' : 'Start') : (isEnd ? (lang === 'tr' ? 'Hedef' : 'Destination') : `${lang === 'tr' ? 'Durak' : 'Stop'} ${idx}`);
                                const isDragging = draggedWaypointIndex === idx;
                                const isDragOver = dragOverWaypointIndex === idx && !isDragging;

                                return (
                                    <div
                                        key={wp.id || idx}
                                        draggable={true}
                                        onDragStart={(e) => handleWaypointDragStart(e, idx)}
                                        onDragOver={(e) => handleWaypointDragOver(e, idx)}
                                        onDrop={(e) => handleWaypointDrop(e, idx)}
                                        onDragEnd={handleWaypointDragEnd}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 7px',
                                            backgroundColor: isDragOver
                                                ? 'rgba(56, 189, 248, 0.16)'
                                                : (isDragging ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.03)'),
                                            border: isDragging
                                                ? '1.2px dashed #38bdf8'
                                                : (isDragOver ? '1.2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.06)'),
                                            borderRadius: '6px',
                                            opacity: isDragging ? 0.45 : 1,
                                            transform: isDragOver ? 'scale(1.01)' : 'none',
                                            transition: 'all 0.12s ease',
                                            cursor: 'grab',
                                            userSelect: 'none'
                                        }}
                                        title={t.dragToReorder || "Sürükleyip bırakarak sırasını değiştirin"}
                                    >
                                        {/* Tutamaç */}
                                        <div style={{ cursor: 'grab', color: '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                            <svg width="8" height="13" viewBox="0 0 10 15" fill="#64748b">
                                                <circle cx="3" cy="2.5" r="1.4" />
                                                <circle cx="7" cy="2.5" r="1.4" />
                                                <circle cx="3" cy="7.5" r="1.4" />
                                                <circle cx="7" cy="7.5" r="1.4" />
                                                <circle cx="3" cy="12.5" r="1.4" />
                                                <circle cx="7" cy="12.5" r="1.4" />
                                            </svg>
                                        </div>

                                        {/* Harf Rozeti */}
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: badgeColor,
                                                color: '#ffffff',
                                                fontWeight: 800,
                                                fontSize: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}
                                            title={roleLabel}
                                        >
                                            {letter}
                                        </div>

                                        {/* Nokta Başlığı */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {wp.name || roleLabel}
                                            </div>
                                        </div>

                                        {/* Ara duraklar için Silme Butonu */}
                                        {!isStart && !isEnd && waypoints.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveWaypoint(idx);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#94a3b8',
                                                    cursor: 'pointer',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px',
                                                    fontSize: '10px',
                                                    fontWeight: 700
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                                title={t.removeWaypoint || "Durağı Kaldır"}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* + Durak Ekle Butonu */}
                    <div>
                        {directionsState.selectingPoint === 'waypoint' ? (
                            <div
                                style={{
                                    padding: '5px 8px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                    border: '1.2px dashed #10b981',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '4px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 1.2s infinite' }} />
                                    <span>{t.clickMapForStop || 'Haritadan durağa tıklayın...'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDirectionsState(prev => ({ ...prev, selectingPoint: null }))}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10.5px' }}
                                >
                                    {t.btnCancel || 'İptal'}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleStartAddWaypoint}
                                style={{
                                    width: '100%',
                                    padding: '5px 10px',
                                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                                    border: '1px dashed rgba(56, 189, 248, 0.35)',
                                    borderRadius: '6px',
                                    color: '#38bdf8',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    transition: 'all 0.12s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)'; }}
                            >
                                <span style={{ fontSize: '13px', fontWeight: 700 }}>+</span>
                                <span>{t.addWaypoint || 'Durak Ekle'}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* POI YOL TARİFİ (DIRECTIONS) ALT BİLGİ VE KONTROL KARTI - KOMPAKT & SADE */}
            {directionsState.active && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: 'calc(50% + 80px)',
                        transform: 'translateX(-50%)',
                        zIndex: 1020,
                        width: '370px',
                        maxWidth: '94vw',
                        backgroundColor: '#0b1329',
                        border: `1.2px solid ${directionsState.activeMode === 'walking' ? '#10b981' : (directionsState.activeMode === 'cycling' ? '#8b5cf6' : (directionsState.activeMode === 'gemi' ? '#06b6d4' : (directionsState.activeMode === 'metro' ? '#ef4444' : (directionsState.activeMode === 'transit' ? '#0284c7' : '#3b82f6'))))}`,
                        borderRadius: '11px',
                        padding: '8px 12px',
                        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
                        color: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                        animation: 'slideUpFloating 0.2s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.07)', paddingBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                                style={{
                                    backgroundColor: directionsState.activeMode === 'walking' ? '#10b981' : (directionsState.activeMode === 'cycling' ? '#8b5cf6' : (directionsState.activeMode === 'gemi' ? '#06b6d4' : (directionsState.activeMode === 'metro' ? '#ef4444' : (directionsState.activeMode === 'transit' ? '#0284c7' : '#2563eb')))),
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '9.5px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    letterSpacing: '0.3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                }}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                </svg>
                                {t.routeLabel || 'ROTA'}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                                {directionsState.targetName || directionsState.targetPoi?.name || (lang === 'tr' ? 'Hedef' : 'Destination')}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {/* Ulaşım Tercihleri Butonu */}
                            <button
                                type="button"
                                onClick={() => setDirectionsState(prev => ({ ...prev, showPreferencesModal: !prev.showPreferencesModal }))}
                                style={{
                                    background: directionsState.showPreferencesModal ? 'rgba(56, 189, 248, 0.2)' : 'none',
                                    border: 'none',
                                    color: directionsState.showPreferencesModal ? '#38bdf8' : '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '3px 5px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    transition: 'all 0.12s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
                                onMouseOut={(e) => { if (!directionsState.showPreferencesModal) e.currentTarget.style.color = '#94a3b8'; }}
                                title="Ulaşım Tercihleri (Gemi, Metro, Otobüs)"
                            >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="21" x2="4" y2="14" />
                                    <line x1="4" y1="10" x2="4" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12" y2="3" />
                                    <line x1="20" y1="21" x2="20" y2="16" />
                                    <line x1="20" y1="12" x2="20" y2="3" />
                                    <line x1="1" y1="14" x2="7" y2="14" />
                                    <line x1="9" y1="8" x2="15" y2="8" />
                                    <line x1="17" y1="16" x2="23" y2="16" />
                                </svg>
                                <span>Tercihler</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClearDirections}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                title={t.closeBtn || "Kapat"}
                            >
                                <CloseIcon size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Ulaşım Tercihleri Açılır Paneli */}
                    {directionsState.showPreferencesModal && (
                        <div style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '7px',
                            padding: '6px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            animation: 'fadeIn 0.15s ease-out'
                        }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Ulaşım Tercihleri (Yol Tarifi)</span>
                                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 400 }}>Kayıtlı Hatlar Dahil Edilir</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {[
                                    { id: 'gemi', label: 'Gemi / Vapur', color: '#06b6d4' },
                                    { id: 'metro', label: 'Metro / Raylı', color: '#ef4444' },
                                    { id: 'otobus', label: 'Otobüs', color: '#0284c7' },
                                    { id: 'tren', label: 'Tren / Tramvay', color: '#f59e0b' }
                                ].map(p => {
                                    const isChecked = directionsState.transitPreferences?.[p.id] !== false;
                                    return (
                                        <label
                                            key={p.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                cursor: 'pointer',
                                                padding: '3px 5px',
                                                borderRadius: '4px',
                                                backgroundColor: isChecked ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                                border: `1px solid ${isChecked ? p.color + '44' : 'rgba(255, 255, 255, 0.06)'}`,
                                                fontSize: '10px',
                                                color: isChecked ? '#f1f5f9' : '#64748b',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleTransitPreference(p.id)}
                                                style={{ accentColor: p.color, width: '12px', height: '12px', cursor: 'pointer' }}
                                            />
                                            <span>{p.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Body Content */}
                    {directionsState.selectingPoint ? (
                        <div style={{ padding: '6px 8px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px dashed rgba(56, 189, 248, 0.35)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                                {directionsState.selectingPoint === 'point1'
                                    ? (t.clickMapForStart || 'Haritada başlangıç noktasını seçin.')
                                    : (t.clickMapForTarget || 'Haritada hedef noktasını seçin.')}
                            </span>
                        </div>
                    ) : directionsState.isCalculating ? (
                        <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#93c5fd' }}>
                            <span className="spinner-mini" style={{ width: '12px', height: '12px', border: '2px solid rgba(147, 197, 253, 0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <span>{t.directionsCalculating || 'Rota hesaplanıyor...'}</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* GOOGLE MAPS TARZI KOMPAKT MOD SEÇİM SEKMELERİ */}
                            {directionsState.routeData && (() => {
                                const routeData = directionsState.routeData;
                                const activeMode = directionsState.activeMode || 'driving';

                                const renderDirectionModeIcon = (modeId, color = 'currentColor') => {
                                    if (modeId === 'gemi') {
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                                                <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.15" />
                                                <path d="M10 10V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6" />
                                                <line x1="12" y1="1" x2="12" y2="4" />
                                            </svg>
                                        );
                                    }
                                    if (modeId === 'metro') {
                                        return (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="4" y="3" width="16" height="15" rx="2" />
                                                <line x1="4" y1="11" x2="20" y2="11" />
                                                <line x1="12" y1="3" x2="12" y2="11" />
                                                <circle cx="8" cy="15" r="1" fill={color} />
                                                <circle cx="16" cy="15" r="1" fill={color} />
                                                <path d="m8 18-3 3" />
                                                <path d="m16 18 3 3" />
                                            </svg>
                                        );
                                    }
                                    if (modeId === 'transit') {
                                        return (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="4" y="3" width="16" height="16" rx="2" />
                                                <line x1="4" y1="11" x2="20" y2="11" />
                                                <circle cx="8" cy="15" r="1" fill={color} />
                                                <circle cx="16" cy="15" r="1" fill={color} />
                                                <path d="m6 19-2 2" />
                                                <path d="m18 19 2 2" />
                                            </svg>
                                        );
                                    }
                                    if (modeId === 'walking') {
                                        return (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="13.5" cy="4.5" r="2" />
                                                <path d="M13.5 6.5v5l-3 4-2.5 5" />
                                                <path d="M13.5 11.5l3 3.5v5" />
                                                <path d="M10 9.5l3.5-3 3.5 3" />
                                            </svg>
                                        );
                                    }
                                    if (modeId === 'cycling') {
                                        return (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="18.5" cy="17.5" r="3.5" />
                                                <circle cx="5.5" cy="17.5" r="3.5" />
                                                <circle cx="15" cy="5" r="1" />
                                                <path d="M12 17.5V14l-3-3 4-3 2 3h3" />
                                            </svg>
                                        );
                                    }
                                    return (
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3C2 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                                            <circle cx="7" cy="17" r="2" />
                                            <path d="M9 17h6" />
                                            <circle cx="17" cy="17" r="2" />
                                        </svg>
                                    );
                                };

                                const modesList = [
                                    {
                                        id: 'driving',
                                        label: t.drivingMode || 'Araba',
                                        color: '#3b82f6',
                                        bg: 'rgba(59, 130, 246, 0.2)',
                                        data: routeData.driving || {
                                            formattedDuration: formatDuration(routeData.durationMinutes, lang),
                                            formattedDistance: `${routeData.distanceKm} km`
                                        }
                                    },
                                    ...(routeData.gemi ? [{
                                        id: 'gemi',
                                        label: 'Gemi',
                                        color: '#06b6d4',
                                        bg: 'rgba(6, 182, 212, 0.22)',
                                        data: routeData.gemi
                                    }] : []),
                                    ...(routeData.metro ? [{
                                        id: 'metro',
                                        label: 'Metro',
                                        color: '#ef4444',
                                        bg: 'rgba(239, 68, 68, 0.22)',
                                        data: routeData.metro
                                    }] : []),
                                    ...(routeData.transit && !routeData.gemi && !routeData.metro ? [{
                                        id: 'transit',
                                        label: 'Toplu Taşıma',
                                        color: '#0284c7',
                                        bg: 'rgba(2, 132, 199, 0.22)',
                                        data: routeData.transit
                                    }] : []),
                                    {
                                        id: 'walking',
                                        label: t.walkingMode || 'Yürüyüş',
                                        color: '#10b981',
                                        bg: 'rgba(16, 185, 129, 0.2)',
                                        data: routeData.walking || {
                                            formattedDuration: formatDuration(Math.round(((routeData.distanceKm || 1) / 4.8) * 60), lang),
                                            formattedDistance: `${routeData.distanceKm} km`
                                        }
                                    },
                                    {
                                        id: 'cycling',
                                        label: t.cyclingMode || 'Bisiklet',
                                        color: '#a855f7',
                                        bg: 'rgba(168, 85, 247, 0.2)',
                                        data: routeData.cycling || {
                                            formattedDuration: formatDuration(Math.round(((routeData.distanceKm || 1) / 16.0) * 60), lang),
                                            formattedDistance: `${routeData.distanceKm} km`
                                        }
                                    }
                                ];

                                const activeOption = routeData[activeMode] || routeData.driving || {
                                    formattedDuration: formatDuration(routeData.durationMinutes, lang),
                                    formattedDistance: `${routeData.distanceKm} km`,
                                    durationMinutes: routeData.durationMinutes,
                                    distanceKm: routeData.distanceKm,
                                    summary: '',
                                    steps: []
                                };

                                // Tahmini Varış Zamanı (ETA)
                                const totalSeconds = activeOption.durationSeconds || ((activeOption.durationMinutes || 0) * 60);
                                const etaDate = new Date(Date.now() + totalSeconds * 1000);
                                const etaTimeStr = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <>
                                        {/* Mod Sekmeleri (Kompakt Tek Satır) */}
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${modesList.length}, 1fr)`, gap: '4px' }}>
                                            {modesList.map(m => {
                                                const isSelected = activeMode === m.id;
                                                const dur = m.data?.formattedDuration || '—';

                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => handleSwitchDirectionsMode(m.id)}
                                                        style={{
                                                            padding: '5px 3px',
                                                            borderRadius: '6px',
                                                            border: `1.2px solid ${isSelected ? m.color : 'rgba(255, 255, 255, 0.08)'}`,
                                                            backgroundColor: isSelected ? m.bg : 'rgba(15, 23, 42, 0.5)',
                                                            color: isSelected ? '#ffffff' : '#94a3b8',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '3px',
                                                            transition: 'all 0.12s ease'
                                                        }}
                                                        title={`${m.label}: ${dur}`}
                                                    >
                                                        {renderDirectionModeIcon(m.id, isSelected ? m.color : '#94a3b8')}
                                                        <span style={{ fontSize: '10.5px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                                                            {dur}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Sade Süre, Mesafe ve Varış Özeti */}
                                        <div style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            borderRadius: '7px',
                                            padding: '6px 10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '11.5px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                                                    {activeOption.formattedDuration || `~${formatDuration(activeOption.durationMinutes, lang)}`}
                                                </span>
                                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                                                    ({activeOption.formattedDistance || `${activeOption.distanceKm} km`})
                                                </span>
                                            </div>
                                            <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '11px' }}>
                                                {t.etaLabel || 'Varış'}: {etaTimeStr}
                                            </div>
                                        </div>

                                        {/* İsteğe Bağlı Adımlar Butonu */}
                                        {activeOption.steps && activeOption.steps.length > 0 && (
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setDirectionsState(prev => ({ ...prev, showSteps: !prev.showSteps }))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#94a3b8',
                                                        fontSize: '10.5px',
                                                        cursor: 'pointer',
                                                        padding: '2px 0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <span>{directionsState.showSteps ? `▲ ${lang === 'tr' ? 'Adımları Gizle' : 'Hide Steps'}` : `▼ ${activeOption.steps.length} ${lang === 'tr' ? 'Yönlendirme Adımı' : 'Direction Steps'}`}</span>
                                                </button>

                                                {directionsState.showSteps && (
                                                    <div style={{
                                                        maxHeight: '110px',
                                                        overflowY: 'auto',
                                                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        borderRadius: '6px',
                                                        padding: '6px 8px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px',
                                                        fontSize: '10.5px',
                                                        marginTop: '4px'
                                                    }}>
                                                        {activeOption.steps.map((st, sIdx) => (
                                                            <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                                                                <span style={{ color: '#64748b', fontSize: '9.5px', width: '14px' }}>{sIdx + 1}.</span>
                                                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.instruction}</span>
                                                                {st.formattedDistance && st.formattedDistance !== '0 m' && (
                                                                    <span style={{ color: '#94a3b8', fontSize: '9.5px', flexShrink: 0 }}>{st.formattedDistance}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Alt Aksiyon Butonları (Kompakt) */}
                            {directionsState.routeData && (
                                <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const activeOpt = (directionsState.routeData && directionsState.routeData[directionsState.activeMode]) || directionsState.routeData;
                                            const modeName = activeOpt.label || (directionsState.activeMode === 'walking' ? (t.walkingMode || 'Yürüyerek') : (t.drivingMode || 'Arabayla'));
                                            setSaveRouteTitle(`${directionsState.startName} → ${directionsState.targetName || (lang === 'tr' ? 'Hedef' : 'Destination')} (${modeName})`);
                                            setSaveRouteDescription(activeOpt.summary || '');
                                            setSaveRouteModalOpen(true);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '5px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            backgroundColor: '#10b981',
                                            color: '#ffffff',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                            <polyline points="17 21 17 13 7 13 7 21" />
                                        </svg>
                                        <span>{t.btnSaveRoute || 'Kaydet'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleClearDirections}
                                        style={{
                                            padding: '5px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <CloseIcon size={11} />
                                        <span>{t.clearRoute || 'Temizle'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* GÜZERGAH KAYDETME MODALI */}
            {saveRouteModalOpen && (
                <div className="modal-overlay" onClick={() => setSaveRouteModalOpen(false)}>
                    <div className="poi-create-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{t.saveRouteModalTitle || 'Güzergahı Profiline Kaydet'}</h3>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{t.saveRouteModalSubtitle || 'OSRM tarafından hesaplanan yol tarifini hesabınıza kaydedin.'}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSaveRouteModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                title={t.closeBtn || 'Kapat'}
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">{t.routeTitleLabel || 'Güzergah Başlığı *'}</label>
                                <input
                                    type="text"
                                    className="poi-modal-input"
                                    placeholder={t.routeTitlePlaceholder || 'Örn: Evden İşe Güzergahı...'}
                                    value={saveRouteTitle}
                                    onChange={(e) => setSaveRouteTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="poi-modal-form-group">
                                <label className="poi-modal-form-label">{t.routeDescLabel || 'Açıklama / Not (Opsiyonel)'}</label>
                                <textarea
                                    className="poi-modal-input"
                                    rows="2"
                                    placeholder={t.routeDescPlaceholder || 'Güzergahla ilgili notlar...'}
                                    value={saveRouteDescription}
                                    onChange={(e) => setSaveRouteDescription(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {directionsState.routeData && (
                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', color: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t.distanceLabel || 'Mesafe:'} <strong>{directionsState.routeData.distanceKm} {t.kmUnit || 'km'}</strong></span>
                                    <span>{t.durationLabel || 'Tahmini Süre:'} <strong>~{formatDuration(directionsState.routeData.durationMinutes, lang)}</strong></span>
                                </div>
                            )}

                            <div className="poi-modal-actions" style={{ marginTop: '8px' }}>
                                <button type="button" className="poi-btn-cancel" onClick={() => setSaveRouteModalOpen(false)}>
                                    {t.btnCancel || 'İptal'}
                                </button>
                                <button
                                    type="button"
                                    className="poi-btn-save"
                                    disabled={isSavingRoute || !saveRouteTitle.trim()}
                                    onClick={handleSaveDirectionRoute}
                                    style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                                >
                                    {isSavingRoute ? (lang === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (t.btnSaveToDb || 'Kaydet')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KULLANICI PROFİLİ VE KİŞİSEL ALAN YÜZEN MODALI */}
            <UserProfileDrawer
                isOpen={isProfileDrawerOpen}
                onClose={() => setIsProfileDrawerOpen(false)}
                currentUser={{
                    username: loggedInUsername,
                    role: userRole,
                    id: loggedInUserId,
                    email: ''
                }}
                token={token}
                isDarkMode={isDarkMode}
                t={t}
                lang={lang}
                onLoadSavedRouteOnMap={handleLoadSavedRouteOnMap}
                onFocusPoiOnMap={handleFocusPoiOnMap}
                onStartDirectionsToPoi={handleStartDirectionsToPoi}
                onLogout={handleLogout}
            />

            {/* CANLI İMLEÇ KOORDİNAT & HARİTA ÖLÇEK ÇUBUĞU (SAĞ ALT KÖŞE) */}
            <div className="map-coords-scale-bar">
                <div className="coords-display-section" title="İmlecin Bulunduğu Coğrafi Koordinatlar (Enlem, Boylam)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                    <span>
                        {cursorCoords.lat.toFixed(5)}° K, {cursorCoords.lon.toFixed(5)}° D
                    </span>
                </div>

                <div className="coords-scale-divider" />

                <div className="scale-display-section" title="Harita Yakınlaştırma Düzeyi (Canlı Zoom)">
                    <span>Zoom {(currentZoom ?? mapZoom ?? 6.5).toFixed(1)}</span>
                </div>

                <div className="coords-scale-divider" />

                {/* DİNAMİK METRİK ÖLÇEK BARI */}
                <div 
                    ref={scaleLineTargetRef} 
                    className="custom-scale-line-target" 
                    title="Harita Metrik Ölçeği (Ölçek Barı)"
                />
            </div>

            {/* OpenLayers Harita Container */}
            <div id="map" ref={mapContainerRef}></div>
        </div>
    );
}

export default App;