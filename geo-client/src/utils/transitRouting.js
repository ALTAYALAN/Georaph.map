// Multimodal Transit Routing Engine (Gemi/Vapur, Metro, Tren, Otobüs)
// Evaluates active system routes, computes multi-leg journeys, and generates realistic routing geometries & steps
import { formatDuration } from './formatUtils';

/**
 * Calculates Haversine distance between two [lon, lat] coordinates in meters
 */
export function getDistanceMeters(coord1, coord2) {
    if (!coord1 || !coord2) return 0;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const deltaPhi = (lat2 - lat1) * rad;
    const deltaLambda = (lon2 - lon1) * rad;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Parses WKT Point into [lon, lat]
 */
export function parsePointWkt(wkt) {
    if (!wkt || typeof wkt !== 'string') return null;
    const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (!match) return null;
    return [parseFloat(match[1]), parseFloat(match[2])];
}

/**
 * Parses WKT LineString into an array of [lon, lat] points
 */
export function parseLineStringWkt(wkt) {
    if (!wkt || typeof wkt !== 'string') return [];
    const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/i);
    if (!match) return [];
    const coordsStr = match[1].trim();
    return coordsStr.split(',').map(pair => {
        const parts = pair.trim().split(/\s+/);
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
}

/**
 * Creates a WKT LineString from an array of [lon, lat] points
 */
export function createLineStringWkt(points) {
    if (!Array.isArray(points) || points.length < 2) return '';
    const coords = points.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join(', ');
    return `LINESTRING(${coords})`;
}

/**
 * Formats distance into km or m
 */
export function formatDistance(meters) {
    if (!meters || meters <= 0) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Average transit operational speeds in meters per second
 */
const TRANSIT_SPEEDS = {
    gemi: 8.5,    // ~31 km/h (16.5 knots - ferry/ship)
    metro: 13.8,  // ~50 km/h (urban metro)
    tren: 16.6,   // ~60 km/h (commuter rail/train)
    otobus: 7.5,  // ~27 km/h (urban bus)
    walking: 1.25 // ~4.5 km/h (walking speed)
};

/**
 * Computes a multimodal transit route using existing system routes (Gemi, Metro, Otobüs, Tren)
 * 
 * @param {Object} params
 * @param {Object} params.start - { lon, lat, name }
 * @param {Object} params.target - { lon, lat, name }
 * @param {Array} params.routes - List of all registered RouteFeature objects
 * @param {string} params.mode - 'gemi' | 'metro' | 'otobus' | 'transit'
 * @param {Object} params.preferences - { gemi: boolean, metro: boolean, otobus: boolean, tren: boolean }
 * @returns {Object|null} Formatted route option or null if no viable transit route
 */
export function calculateTransitRoute({
    start,
    target,
    routes = [],
    mode = 'transit',
    preferences = { gemi: true, metro: true, otobus: true, tren: true }
}) {
    if (!start || !target || start.lon == null || target.lon == null || !Array.isArray(routes) || routes.length === 0) {
        return null;
    }

    const startCoord = [start.lon, start.lat];
    const targetCoord = [target.lon, target.lat];
    const directDistance = getDistanceMeters(startCoord, targetCoord);

    // Filter candidate routes based on target mode and user preferences
    const candidateRoutes = routes.filter(r => {
        if (!r.isActive || r.isDeleted) return false;
        const rClass = (r.routeClass || 'araba').toLowerCase().trim();

        if (mode === 'gemi') return rClass === 'gemi';
        if (mode === 'metro') return rClass === 'metro' || rClass === 'tren';
        if (mode === 'otobus') return rClass === 'otobus';

        // General 'transit' mode: respects user preferences
        if (preferences && preferences[rClass] === false) return false;
        return ['gemi', 'metro', 'tren', 'otobus'].includes(rClass);
    });

    if (candidateRoutes.length === 0) return null;

    let bestSolution = null;
    let minScore = Infinity;

    for (const r of candidateRoutes) {
        const rClass = (r.routeClass || 'otobus').toLowerCase().trim();
        const lineCoords = parseLineStringWkt(r.wkt);

        // Normalize route stops
        let stops = (r.stops || []).map(s => {
            const coord = s.geometry ? [s.geometry.coordinates[0], s.geometry.coordinates[1]] : parsePointWkt(s.wkt);
            return {
                id: s.id,
                name: s.name || 'Durak',
                orderIndex: s.orderIndex || 0,
                coord
            };
        }).filter(s => s.coord != null).sort((a, b) => a.orderIndex - b.orderIndex);

        // If stops are missing but line geometry exists, synthesize terminal stops
        if (stops.length < 2 && lineCoords.length >= 2) {
            stops = [
                { id: `synth_start_${r.id}`, name: `${r.name} Başlangıç İskelesi/İstasyonu`, orderIndex: 1, coord: lineCoords[0] },
                { id: `synth_end_${r.id}`, name: `${r.name} Varış İskelesi/İstasyonu`, orderIndex: 2, coord: lineCoords[lineCoords.length - 1] }
            ];
        }

        if (stops.length < 2) continue;

        // Find the closest stop to Start (Boarding Stop) and Target (Alighting Stop)
        let boardStop = null;
        let alightStop = null;
        let minStartDist = Infinity;
        let minTargetDist = Infinity;

        stops.forEach(s => {
            const dStart = getDistanceMeters(startCoord, s.coord);
            const dTarget = getDistanceMeters(targetCoord, s.coord);

            if (dStart < minStartDist) {
                minStartDist = dStart;
                boardStop = s;
            }
            if (dTarget < minTargetDist) {
                minTargetDist = dTarget;
                alightStop = s;
            }
        });

        if (!boardStop || !alightStop || boardStop.id === alightStop.id) continue;

        // Determine direction along stops: from boardStop to alightStop
        const boardIdx = stops.findIndex(s => s.id === boardStop.id);
        const alightIdx = stops.findIndex(s => s.id === alightStop.id);

        // Collect transit line points between board and alight
        let transitPoints = [];
        if (lineCoords.length >= 2) {
            // Find closest indices in lineCoords to boardStop and alightStop
            let lineBoardIdx = 0;
            let lineAlightIdx = lineCoords.length - 1;
            let minLineBoardDist = Infinity;
            let minLineAlightDist = Infinity;

            lineCoords.forEach((pt, idx) => {
                const db = getDistanceMeters(pt, boardStop.coord);
                const da = getDistanceMeters(pt, alightStop.coord);
                if (db < minLineBoardDist) {
                    minLineBoardDist = db;
                    lineBoardIdx = idx;
                }
                if (da < minLineAlightDist) {
                    minLineAlightDist = da;
                    lineAlightIdx = idx;
                }
            });

            if (lineBoardIdx <= lineAlightIdx) {
                transitPoints = lineCoords.slice(lineBoardIdx, lineAlightIdx + 1);
            } else {
                transitPoints = lineCoords.slice(lineAlightIdx, lineBoardIdx + 1).reverse();
            }
        } else {
            // Fallback to straight stops interpolation
            const step = boardIdx < alightIdx ? 1 : -1;
            for (let i = boardIdx; i !== alightIdx + step; i += step) {
                transitPoints.push(stops[i].coord);
            }
        }

        // Calculate distance along transit line
        let transitLineMeters = 0;
        for (let i = 0; i < transitPoints.length - 1; i++) {
            transitLineMeters += getDistanceMeters(transitPoints[i], transitPoints[i + 1]);
        }
        if (transitLineMeters <= 0) {
            transitLineMeters = getDistanceMeters(boardStop.coord, alightStop.coord);
        }

        const accessMeters = minStartDist;
        const egressMeters = minTargetDist;
        const totalDistanceMeters = accessMeters + transitLineMeters + egressMeters;

        // Speed and duration calculations
        const transitSpeed = TRANSIT_SPEEDS[rClass] || TRANSIT_SPEEDS.otobus;
        const walkSpeed = TRANSIT_SPEEDS.walking;

        const accessSeconds = accessMeters / walkSpeed;
        const waitSeconds = 5 * 60; // 5 min average wait/boarding buffer
        const rideSeconds = transitLineMeters / transitSpeed;
        const egressSeconds = egressMeters / walkSpeed;
        const totalDurationSeconds = accessSeconds + waitSeconds + rideSeconds + egressSeconds;

        // Evaluate solution viability:
        // For 'gemi' (ferry across water): Always viable if user wants ferry or if direct road has huge detour
        // For land transit: total journey should offer competitive access
        let score = totalDurationSeconds;
        if (rClass === 'gemi') {
            // Favor ferry when chosen or over large water crossings
            score *= 0.85;
        }

        if (score < minScore) {
            minScore = score;
            const fullPoints = [startCoord, ...transitPoints, targetCoord];
            const fullWkt = createLineStringWkt(fullPoints);

            const intermediateStopsCount = Math.abs(alightIdx - boardIdx);
            const classLabel = rClass === 'gemi' ? 'Gemi / Vapur' : (rClass === 'metro' ? 'Metro' : (rClass === 'tren' ? 'Tren / Tramvay' : 'Otobüs'));
            const verb = rClass === 'gemi' ? 'denizyolu ile geçin' : (rClass === 'metro' ? 'metrosuna binin' : 'hattına binin');

            const steps = [
                {
                    stepIndex: 1,
                    instruction: `Başlangıç noktasından ${boardStop.name} durağına/iskelesine ulaşın`,
                    streetName: boardStop.name,
                    distanceMeters: Math.round(accessMeters),
                    formattedDistance: formatDistance(accessMeters),
                    durationSeconds: Math.round(accessSeconds),
                    formattedDuration: formatDuration(accessSeconds / 60),
                    type: 'depart',
                    icon: 'walking'
                },
                {
                    stepIndex: 2,
                    instruction: `${r.name} (${classLabel}) ile ${boardStop.name} noktasından ${alightStop.name} yönüne ${verb} (${intermediateStopsCount} durak)`,
                    streetName: r.name,
                    distanceMeters: Math.round(transitLineMeters),
                    formattedDistance: formatDistance(transitLineMeters),
                    durationSeconds: Math.round(rideSeconds + waitSeconds),
                    formattedDuration: formatDuration((rideSeconds + waitSeconds) / 60),
                    type: 'transit',
                    icon: rClass
                },
                {
                    stepIndex: 3,
                    instruction: `${alightStop.name} durağında inin ve hedef noktaya ulaşın`,
                    streetName: target.name || 'Hedef',
                    distanceMeters: Math.round(egressMeters),
                    formattedDistance: formatDistance(egressMeters),
                    durationSeconds: Math.round(egressSeconds),
                    formattedDuration: formatDuration(egressSeconds / 60),
                    type: 'arrive',
                    icon: 'walking'
                }
            ];

            bestSolution = {
                mode: rClass,
                label: classLabel,
                icon: rClass === 'gemi' ? 'ship' : (rClass === 'metro' ? 'metro' : (rClass === 'tren' ? 'train' : 'bus')),
                distanceMeters: Math.round(totalDistanceMeters),
                distanceKm: parseFloat((totalDistanceMeters / 1000).toFixed(1)),
                durationSeconds: Math.round(totalDurationSeconds),
                durationMinutes: parseFloat((totalDurationSeconds / 60).toFixed(1)),
                formattedDistance: formatDistance(totalDistanceMeters),
                formattedDuration: formatDuration(totalDurationSeconds / 60),
                routeWkt: fullWkt,
                summary: `${r.name} (${boardStop.name} → ${alightStop.name})`,
                transitRoute: r,
                boardingStop: boardStop,
                alightingStop: alightStop,
                stopsCount: intermediateStopsCount,
                steps
            };
        }
    }

    return bestSolution;
}
