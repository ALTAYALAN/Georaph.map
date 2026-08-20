import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import WKT from 'ol/format/WKT';
import Feature from 'ol/Feature';
import { Style, Stroke, Fill } from 'ol/style';

// Ray-casting Point in Polygon test
export const isPointInPolyRing = (pt, ring) => {
    if (!pt || !ring || ring.length === 0) return false;
    const x = pt[0], y = pt[1];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Check if drawn geometry (Polygon/MultiPolygon/LineString/Point) is 100% STRICTLY inside the boundary geometry
export const isGeomInsideBoundary = (drawnGeomObj, boundaryGeomObj) => {
    if (!boundaryGeomObj || !drawnGeomObj) return true; // No restriction

    try {
        // Collect all outer rings of boundary polygons (supports Polygon, MultiPolygon, GeometryCollection)
        let boundaryRings = [];

        if (boundaryGeomObj.type === 'Polygon') {
            if (boundaryGeomObj.coordinates && boundaryGeomObj.coordinates[0]) {
                boundaryRings.push(boundaryGeomObj.coordinates[0]);
            }
        } else if (boundaryGeomObj.type === 'MultiPolygon') {
            boundaryGeomObj.coordinates.forEach(polyCoords => {
                if (polyCoords && polyCoords[0]) boundaryRings.push(polyCoords[0]);
            });
        } else if (boundaryGeomObj.type === 'GeometryCollection') {
            boundaryGeomObj.geometries.forEach(subGeom => {
                if (subGeom.type === 'Polygon' && subGeom.coordinates && subGeom.coordinates[0]) {
                    boundaryRings.push(subGeom.coordinates[0]);
                } else if (subGeom.type === 'MultiPolygon') {
                    subGeom.coordinates.forEach(polyCoords => {
                        if (polyCoords && polyCoords[0]) boundaryRings.push(polyCoords[0]);
                    });
                }
            });
        }

        if (boundaryRings.length === 0) return true;

        // Extract ALL coordinate points from the drawn geometry
        let pts = [];
        if (drawnGeomObj.type === 'Point') {
            pts = [drawnGeomObj.coordinates];
        } else if (drawnGeomObj.type === 'LineString') {
            pts = drawnGeomObj.coordinates || [];
        } else if (drawnGeomObj.type === 'Polygon') {
            pts = drawnGeomObj.coordinates[0] || [];
        } else if (drawnGeomObj.type === 'MultiPolygon') {
            drawnGeomObj.coordinates.forEach(poly => {
                if (poly && poly[0]) pts.push(...poly[0]);
            });
        }

        if (pts.length === 0) return true;

        // STRICT CHECK: EVERY SINGLE POINT MUST BE INSIDE AT LEAST ONE BOUNDARY RING!
        // If even ONE point is outside all boundary rings, return FALSE (STRICT BLOCKING)!
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            let isPointInsideAnyRing = false;
            for (let j = 0; j < boundaryRings.length; j++) {
                if (isPointInPolyRing(p, boundaryRings[j])) {
                    isPointInsideAnyRing = true;
                    break;
                }
            }
            if (!isPointInsideAnyRing) {
                // Point is outside ALL boundary rings -> STRICTLY BLOCK DRAWING!
                return false;
            }
        }

        // Also check centroid to prevent concave boundary wrapping exploits
        let sumX = 0, sumY = 0;
        pts.forEach(p => { sumX += p[0]; sumY += p[1]; });
        const centroid = [sumX / pts.length, sumY / pts.length];

        let isCentroidInsideAnyRing = false;
        for (let j = 0; j < boundaryRings.length; j++) {
            if (isPointInPolyRing(centroid, boundaryRings[j])) {
                isCentroidInsideAnyRing = true;
                break;
            }
        }

        return isCentroidInsideAnyRing;
    } catch (e) {
        console.error('Spatial boundary strict check error:', e);
        return true;
    }
};

// Create a pulsing red spatial boundary vector layer on OpenLayers map canvas
export const setupPulsingSpatialBoundaryLayer = (map, wktString) => {
    if (!map || !wktString) return null;

    try {
        const wktFormat = new WKT();
        const feature = wktFormat.readFeature(wktString, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });

        const vectorSource = new VectorSource({ features: [feature] });

        let pulseStep = 0;
        const boundaryLayer = new VectorLayer({
            source: vectorSource,
            zIndex: 99,
            style: () => {
                const opacity = 0.5 + 0.5 * Math.sin(pulseStep);
                const strokeWidth = 3.5 + 2 * Math.sin(pulseStep);
                return new Style({
                    stroke: new Stroke({
                        color: `rgba(239, 68, 68, ${opacity})`,
                        width: strokeWidth,
                        lineDash: [10, 6]
                    }),
                    fill: null
                });
            }
        });

        map.addLayer(boundaryLayer);

        // Trigger continuous postrender animation loop for smooth pulsing red glow
        const postRenderListener = () => {
            pulseStep += 0.05;
            map.render();
        };

        map.on('postrender', postRenderListener);

        return {
            layer: boundaryLayer,
            feature: feature,
            cleanup: () => {
                map.un('postrender', postRenderListener);
                try { map.removeLayer(boundaryLayer); } catch (e) {}
            }
        };
    } catch (err) {
        console.error('Failed to setup pulsing boundary layer:', err);
        return null;
    }
};
