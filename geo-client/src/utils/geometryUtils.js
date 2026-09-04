import GeoJSON from 'ol/format/GeoJSON';
import WKT from 'ol/format/WKT';
import { getArea, getLength } from 'ol/sphere';
import * as turf from '@turf/turf';

const geojsonFormat = new GeoJSON();
const wktFormat = new WKT();

/**
 * Detects whether geometry is in EPSG:4326 (Degrees [-180, 180]) or EPSG:3857 (Meters)
 */
function detectProjection(geometry) {
    if (!geometry) return 'EPSG:3857';
    try {
        let firstCoord = null;
        const type = typeof geometry.getType === 'function' ? geometry.getType() : null;
        if (type === 'Polygon') {
            firstCoord = geometry.getCoordinates()[0]?.[0];
        } else if (type === 'MultiPolygon') {
            firstCoord = geometry.getCoordinates()[0]?.[0]?.[0];
        } else if (type === 'LineString') {
            firstCoord = geometry.getCoordinates()[0];
        } else if (type === 'MultiLineString') {
            firstCoord = geometry.getCoordinates()[0]?.[0];
        } else if (type === 'Point') {
            firstCoord = geometry.getCoordinates();
        }
        if (firstCoord && Array.isArray(firstCoord)) {
            const [x, y] = firstCoord;
            if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
                return 'EPSG:4326';
            }
        }
    } catch (e) {}
    return 'EPSG:3857';
}

/**
 * Calculates accurate geodesic area (km², ha, m²) and perimeter/circumference (km, m)
 * for any given OpenLayers Geometry, OpenLayers Feature, GeoJSON geometry, or WKT string.
 */
export function calculateGeometryMetrics(entityOrGeom) {
    if (!entityOrGeom) {
        return {
            areaKm2: 0,
            areaHa: 0,
            areaM2: 0,
            perimeterKm: 0,
            perimeterM: 0,
            formattedArea: '0 km²',
            formattedAreaHa: '0 ha',
            formattedPerimeter: '0 km'
        };
    }

    let olGeom = null;
    let turfFeature = null;

    // 1. Direct OpenLayers Geometry
    if (typeof entityOrGeom.getType === 'function') {
        olGeom = entityOrGeom;
    }
    // 2. OpenLayers Feature
    else if (typeof entityOrGeom.getGeometry === 'function') {
        olGeom = entityOrGeom.getGeometry();
    }
    // 3. Object with .geometry property (GeoJSON feature or custom entity)
    else if (entityOrGeom.geometry) {
        try {
            if (entityOrGeom.geometry.type && entityOrGeom.geometry.coordinates) {
                turfFeature = { type: 'Feature', geometry: entityOrGeom.geometry, properties: {} };
            }
            const feat = geojsonFormat.readFeature({ type: 'Feature', geometry: entityOrGeom.geometry });
            olGeom = feat.getGeometry();
        } catch (e) {}
    }

    // 4. Object with .wkt property or raw WKT string
    let rawWkt = typeof entityOrGeom === 'string' ? entityOrGeom : (entityOrGeom.wkt || '');
    if (!olGeom && rawWkt && typeof rawWkt === 'string') {
        const cleanWkt = rawWkt.replace(/^SRID=\d+;/i, '').trim();
        const upper = cleanWkt.toUpperCase();
        if (upper.startsWith('POLYGON') || upper.startsWith('MULTIPOLYGON') || upper.startsWith('LINESTRING') || upper.startsWith('MULTILINESTRING')) {
            try {
                const feat = wktFormat.readFeature(cleanWkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:4326'
                });
                olGeom = feat.getGeometry();
                if (!turfFeature) {
                    const geojsonObj = geojsonFormat.writeFeatureObject(feat);
                    turfFeature = geojsonObj;
                }
            } catch (e) {}
        }
    }

    // A) Try calculating with Turf if GeoJSON is available
    if (turfFeature) {
        try {
            const areaM2 = turf.area(turfFeature);
            const areaKm2 = areaM2 / 1_000_000;
            const areaHa = areaM2 / 10_000;

            let perimeterKm = 0;
            const geomType = turfFeature.geometry.type;
            if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                const lines = turf.polygonToLine(turfFeature);
                if (lines.type === 'FeatureCollection') {
                    lines.features.forEach(f => {
                        perimeterKm += turf.length(f, { units: 'kilometers' });
                    });
                } else {
                    perimeterKm = turf.length(lines, { units: 'kilometers' });
                }
            } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                perimeterKm = turf.length(turfFeature, { units: 'kilometers' });
            }

            if (areaKm2 > 0 || perimeterKm > 0) {
                return {
                    areaKm2: Number(areaKm2.toFixed(2)),
                    areaHa: Number(areaHa.toFixed(1)),
                    areaM2: Number(areaM2.toFixed(0)),
                    perimeterKm: Number(perimeterKm.toFixed(2)),
                    perimeterM: Number((perimeterKm * 1000).toFixed(0)),
                    formattedArea: `${(Math.round(areaKm2 * 100) / 100).toLocaleString('tr-TR')} km²`,
                    formattedAreaHa: `${(Math.round(areaHa * 10) / 10).toLocaleString('tr-TR')} ha`,
                    formattedPerimeter: `${(Math.round(perimeterKm * 100) / 100).toLocaleString('tr-TR')} km`
                };
            }
        } catch (e) {
            console.warn('Turf hesaplama hatası:', e);
        }
    }

    // B) Calculate with OpenLayers sphere with dynamic projection detection
    if (olGeom) {
        try {
            const proj = detectProjection(olGeom);
            const areaM2 = Math.abs(getArea(olGeom, { projection: proj }));
            const areaKm2 = areaM2 / 1_000_000;
            const areaHa = areaM2 / 10_000;

            const lengthM = Math.abs(getLength(olGeom, { projection: proj }));
            const perimeterKm = lengthM / 1_000;

            if (areaKm2 > 0 || perimeterKm > 0) {
                return {
                    areaKm2: Number(areaKm2.toFixed(2)),
                    areaHa: Number(areaHa.toFixed(1)),
                    areaM2: Number(areaM2.toFixed(0)),
                    perimeterKm: Number(perimeterKm.toFixed(2)),
                    perimeterM: Number(lengthM.toFixed(0)),
                    formattedArea: `${(Math.round(areaKm2 * 100) / 100).toLocaleString('tr-TR')} km²`,
                    formattedAreaHa: `${(Math.round(areaHa * 10) / 10).toLocaleString('tr-TR')} ha`,
                    formattedPerimeter: `${(Math.round(perimeterKm * 100) / 100).toLocaleString('tr-TR')} km`
                };
            }
        } catch (e) {
            console.warn('OpenLayers sphere hesaplama hatası:', e);
        }
    }

    // C) Fallback to entity properties if already defined
    const fallbackArea = entityOrGeom.areaKm2 || entityOrGeom.area || 0;
    const fallbackPerimeter = entityOrGeom.coastlineKm || entityOrGeom.perimeterKm || entityOrGeom.perimeter || 0;

    return {
        areaKm2: fallbackArea,
        areaHa: fallbackArea * 100,
        areaM2: fallbackArea * 1_000_000,
        perimeterKm: fallbackPerimeter,
        perimeterM: fallbackPerimeter * 1_000,
        formattedArea: fallbackArea ? `${Number(fallbackArea).toLocaleString('tr-TR')} km²` : '0 km²',
        formattedAreaHa: fallbackArea ? `${Number(fallbackArea * 100).toLocaleString('tr-TR')} ha` : '0 ha',
        formattedPerimeter: fallbackPerimeter ? `${Number(fallbackPerimeter).toLocaleString('tr-TR')} km` : '0 km'
    };
}
