import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import WKT from 'ol/format/WKT';
import Feature from 'ol/Feature';
import { Style, Stroke, Fill, Text } from 'ol/style';

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

        // Helper: Check if a point is inside any allowed boundary ring (or within margin)
        const isPtInside = (p) => {
            for (let j = 0; j < boundaryRings.length; j++) {
                if (isPointInPolyRing(p, boundaryRings[j])) {
                    return true;
                }
            }
            return false;
        };

        // 1. Check all vertices of the drawn geometry
        for (let i = 0; i < pts.length; i++) {
            if (!isPtInside(pts[i])) {
                return false;
            }
        }

        // 2. Sample intermediate points along segments to ensure no line/polygon escapes boundary union
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            // Sample 3 midpoints per segment
            for (let step = 1; step <= 3; step++) {
                const fraction = step / 4;
                const midX = p1[0] + (p2[0] - p1[0]) * fraction;
                const midY = p1[1] + (p2[1] - p1[1]) * fraction;
                if (!isPtInside([midX, midY])) {
                    // Check if it's on a shared border between adjacent rings with tiny epsilon tolerance
                    const eps = 0.0001;
                    const onBorder = isPtInside([midX + eps, midY]) || isPtInside([midX - eps, midY]) ||
                                     isPtInside([midX, midY + eps]) || isPtInside([midX, midY - eps]);
                    if (!onBorder) {
                        return false;
                    }
                }
            }
        }

        return true;
    } catch (e) {
        console.error('Spatial boundary check error:', e);
        return true;
    }
};

// Create a pulsing spatial boundary vector layer on OpenLayers map canvas
// Supports individual color coding when collaborating with other editors!
export const setupPulsingSpatialBoundaryLayer = (map, boundariesInput) => {
    if (!map || !boundariesInput) return null;

    let items = [];
    if (typeof boundariesInput === 'string') {
        items = [{ wkt: boundariesInput, isCurrentUser: true, username: 'Kendi Sınırınız' }];
    } else if (Array.isArray(boundariesInput)) {
        items = boundariesInput.map(b => ({
            wkt: b.spatialBoundaryWkt || b.wkt,
            isCurrentUser: b.isCurrentUser !== false,
            username: b.username || (b.isCurrentUser !== false ? 'Kendi Sınırınız' : 'İşbirlikçi Editör')
        })).filter(b => !!b.wkt);
    } else if (boundariesInput.boundaries && Array.isArray(boundariesInput.boundaries)) {
        items = boundariesInput.boundaries.map(b => ({
            wkt: b.spatialBoundaryWkt || b.wkt,
            isCurrentUser: b.isCurrentUser !== false,
            username: b.username || (b.isCurrentUser !== false ? 'Kendi Sınırınız' : 'İşbirlikçi Editör')
        })).filter(b => !!b.wkt);
    } else if (boundariesInput.spatialBoundaryWkt) {
        items = [{ wkt: boundariesInput.spatialBoundaryWkt, isCurrentUser: true, username: 'Kendi Sınırınız' }];
    }

    if (items.length === 0) return null;

    try {
        const wktFormat = new WKT();
        const features = [];

        items.forEach((item, idx) => {
            try {
                const feat = wktFormat.readFeature(item.wkt, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                feat.set('isCurrentUser', item.isCurrentUser);
                feat.set('username', item.username);
                feat.set('boundaryIndex', idx);
                features.push(feat);
            } catch (e) {
                console.warn('WKT read error for boundary:', e);
            }
        });

        if (features.length === 0) return null;

        const vectorSource = new VectorSource({ features });

        let pulseStep = 0;
        const boundaryLayer = new VectorLayer({
            source: vectorSource,
            zIndex: 99,
            style: (feature) => {
                const isCurrentUser = feature.get('isCurrentUser');
                const username = feature.get('username') || '';
                const opacity = 0.55 + 0.45 * Math.sin(pulseStep);
                const strokeWidth = 3.5 + 1.5 * Math.sin(pulseStep);

                // Kendi yetki alanı: Mavi (#3b82f6), İşbirlikçi yetki alanı: Zümrüt Yeşili (#10b981)
                const strokeColor = isCurrentUser
                    ? `rgba(59, 130, 246, ${opacity})`
                    : `rgba(16, 185, 129, ${opacity})`;

                const fillColor = isCurrentUser
                    ? 'rgba(59, 130, 246, 0.09)'
                    : 'rgba(16, 185, 129, 0.09)';

                return new Style({
                    stroke: new Stroke({
                        color: strokeColor,
                        width: strokeWidth,
                        lineDash: isCurrentUser ? [10, 6] : [6, 6]
                    }),
                    fill: new Fill({
                        color: fillColor
                    })
                });
            }
        });

        map.addLayer(boundaryLayer);

        // Continuous postrender animation loop for pulsing glow
        const postRenderListener = () => {
            pulseStep += 0.05;
            map.render();
        };

        map.on('postrender', postRenderListener);

        return {
            layer: boundaryLayer,
            features: features,
            feature: features[0],
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
