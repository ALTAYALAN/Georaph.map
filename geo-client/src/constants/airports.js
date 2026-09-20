// Türkiye Havalimanları ve Hava Taşımacılığı Düğüm Noktaları Kaydı (Turkish Airports Registry)
// Tüm aktif sivil, uluslararası ve bölgesel havalimanlarının kapsamlı veri seti

import airportCatalog from '../../../shared/airports.json';

export const TURKISH_AIRPORTS = airportCatalog;

export function cleanAirportName(name = '') {
    return String(name || '')
        .replace(/\[[A-Z0-9]{3}\]/gi, '')
        .replace(/Havalimanı|Havaalanı|Airport/gi, '')
        .replace(/\(.*?\)/g, '')
        .trim();
}

export function getAirportInfo(nameOrId = '') {
    if (!nameOrId) return null;
    const query = String(nameOrId).trim().toLowerCase();
    return TURKISH_AIRPORTS.find(a => 
        a.id.toLowerCase() === query ||
        a.iata.toLowerCase() === query ||
        a.icao.toLowerCase() === query ||
        a.name.toLowerCase().includes(query) ||
        query.includes(a.name.toLowerCase()) ||
        a.shortName.toLowerCase().includes(query) ||
        query.includes(a.shortName.toLowerCase()) ||
        a.city.toLowerCase() === query
    ) || null;
}

export function isAirportCandidate(name = '') {
    if (!name) return false;
    const n = String(name).toLowerCase();
    return n.includes('havaliman') || n.includes('havaalan') || n.includes('airport') || n.includes('pist') || n.includes('terminal');
}

// İki Havalimanı Arası Uçuş Koridoru WKT LineString Üretici (Doğal Ortotropik Yay Eğrisi)
export function generateFlightRouteWkt(aptA, aptB, segments = 16) {
    if (!aptA || !aptB || !aptA.coordinates || !aptB.coordinates) return null;
    const [lon1, lat1] = aptA.coordinates;
    const [lon2, lat2] = aptB.coordinates;

    const points = [];
    const dist = Math.hypot(lon2 - lon1, lat2 - lat1);
    const arcHeight = Math.min(dist * 0.08, 0.6);

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const lon = lon1 + (lon2 - lon1) * t;
        const lat = lat1 + (lat2 - lat1) * t;
        const arc = Math.sin(Math.PI * t) * arcHeight;
        points.push(`${(lon).toFixed(6)} ${(lat + arc).toFixed(6)}`);
    }
    return `LINESTRING(${points.join(', ')})`;
}
