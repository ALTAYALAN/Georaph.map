import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';
import WKT from 'ol/format/WKT';
import Feature from 'ol/Feature';
import Modify from 'ol/interaction/Modify';
import Draw from 'ol/interaction/Draw';
import { Style, Stroke, Fill, Text } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';

import * as turf from '@turf/turf';
import { adminApi } from '../../services/adminApi';
import { BASEMAP_LAYERS } from '../../constants/mapLayers';
import { MapLayerSwitcher } from '../common/MapLayerSwitcher';

// Safe helper to parse WKT into OpenLayers feature
const readWktFeatureSafely = (wktStr, wktFormat) => {
    if (!wktStr) return null;
    try {
        const fmt = wktFormat || new WKT();
        return fmt.readFeature(wktStr, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
    } catch (e) {
        console.error('Failed to parse WKT:', e);
        return null;
    }
};

const REGION_OPTIONS = [
    'Marmara Bölgesi',
    'Ege Bölgesi',
    'Akdeniz Bölgesi',
    'İç Anadolu Bölgesi',
    'Karadeniz Bölgesi',
    'Doğu Anadolu Bölgesi',
    'Güneydoğu Anadolu Bölgesi'
];

const PUBLISHED_STORAGE_KEY = 'admin_turkey_cities_published_v36';
const BACKUPS_STORAGE_KEY = 'admin_turkey_cities_backups_v36';
const DELETED_PLATES_KEY = 'admin_deleted_plates_v36';

// Purge all old legacy storage keys to eliminate any incomplete/corrupt saved payloads
const purgeAllLegacyStorageKeys = () => {
    const KEYS_TO_PURGE = [
        'admin_turkey_cities_published_v35',
        'admin_turkey_cities_published_v30',
        'admin_turkey_cities_published_v25',
        'admin_turkey_cities_published_v20',
        'admin_turkey_cities_published_v15',
        'admin_turkey_cities_published_v12',
        'admin_turkey_cities_published_clean_v10',
        'admin_turkey_cities_published_final_v3',
        'admin_turkey_cities_published_permanent_v2',
        'admin_turkey_cities_published_permanent',
        'admin_turkey_cities_published_v7',
        'admin_turkey_cities_published_v6',
        'admin_turkey_cities_published_v5',
        'admin_turkey_cities_published_v4',
        'admin_turkey_cities_published_v3',
        'admin_deleted_plates_v35',
        'admin_deleted_plates_v30',
        'admin_deleted_plates_v25',
        'admin_deleted_plates_v20',
        'admin_deleted_plates_v15',
        'admin_deleted_plates_v12',
        'admin_deleted_plates_clean_v10',
        'admin_deleted_plates_permanent_v2',
        'admin_deleted_plates_permanent',
        'admin_deleted_plates_v7'
    ];
    KEYS_TO_PURGE.forEach(key => {
        try { localStorage.removeItem(key); } catch (e) {}
    });
};

// Helper to extract first coordinate pair from Polygon or MultiPolygon geometry
const getFirstCoordinatePair = (geom) => {
    if (!geom || !geom.coordinates) return null;
    if (geom.type === 'Polygon' && geom.coordinates[0] && geom.coordinates[0][0]) {
        return geom.coordinates[0][0];
    }
    if (geom.type === 'MultiPolygon' && geom.coordinates[0] && geom.coordinates[0][0] && geom.coordinates[0][0][0]) {
        return geom.coordinates[0][0][0];
    }
    return null;
};

// Perform exact spatial difference cut (Turf.difference) between drawn eraser polygon and city polygons (handles MultiPolygons & Islands)
const performSpatialErasure = (currentCities, eraserFeatureEPSG3857) => {
    let erasedCount = 0;
    const geojsonFormat = new GeoJSON();
    const wktFormat = new WKT();

    // 1. Convert drawn eraser feature from EPSG:3857 (map canvas) to EPSG:4326 WGS84 GeoJSON
    let eraserTurfFeature = null;
    try {
        const clonedEraserGeom = eraserFeatureEPSG3857.getGeometry().clone();
        clonedEraserGeom.transform('EPSG:3857', 'EPSG:4326');
        const eraserGeoJsonGeom = geojsonFormat.writeGeometryObject(clonedEraserGeom);
        eraserTurfFeature = turf.feature(eraserGeoJsonGeom);
    } catch (e) {
        console.error('Failed to prepare eraser geometry:', e);
        return { updatedCities: currentCities, erasedCount: 0 };
    }

    if (!eraserTurfFeature || !eraserTurfFeature.geometry) {
        return { updatedCities: currentCities, erasedCount: 0 };
    }

    const updatedCities = currentCities.map(c => {
        if (c.isDeleted) return c;

        // 2. Get clean Turf Feature for city in EPSG:4326 WGS84 (with self-healing coordinate projection detection)
        let cityTurfFeature = null;
        if (c.geometry) {
            let cleanGeom = c.geometry;
            const firstCoord = getFirstCoordinatePair(cleanGeom);
            if (firstCoord && (Math.abs(firstCoord[0]) > 180 || Math.abs(firstCoord[1]) > 90)) {
                try {
                    const olGeom = geojsonFormat.readGeometry(cleanGeom);
                    olGeom.transform('EPSG:3857', 'EPSG:4326');
                    cleanGeom = geojsonFormat.writeGeometryObject(olGeom);
                } catch (e) {}
            }
            cityTurfFeature = turf.feature({ type: 'Feature', geometry: cleanGeom });
        } else if (c.wkt) {
            try {
                const olFeat = wktFormat.readFeature(c.wkt); // WKT is in EPSG:4326
                let geomObj = geojsonFormat.writeGeometryObject(olFeat.getGeometry());
                const firstCoord = getFirstCoordinatePair(geomObj);
                if (firstCoord && (Math.abs(firstCoord[0]) > 180 || Math.abs(firstCoord[1]) > 90)) {
                    const olGeom = geojsonFormat.readGeometry(geomObj);
                    olGeom.transform('EPSG:3857', 'EPSG:4326');
                    geomObj = geojsonFormat.writeGeometryObject(olGeom);
                }
                cityTurfFeature = turf.feature(geomObj);
            } catch (e) {}
        }

        if (!cityTurfFeature || !cityTurfFeature.geometry) return c;

        const cityGeom = cityTurfFeature.geometry;

        // 3. Break city geometry into individual Polygon features (handles both Polygon & MultiPolygon)
        let subPolygons = [];
        if (cityGeom.type === 'Polygon') {
            subPolygons.push(turf.polygon(cityGeom.coordinates));
        } else if (cityGeom.type === 'MultiPolygon') {
            cityGeom.coordinates.forEach(polyCoords => {
                subPolygons.push(turf.polygon(polyCoords));
            });
        }

        if (subPolygons.length === 0) return c;

        let cityModified = false;
        let remainingSubPolyCoords = [];

        subPolygons.forEach(subPoly => {
            let touches = false;
            // 1. Direct booleanIntersects / contains / within
            try {
                touches = turf.booleanIntersects(subPoly, eraserTurfFeature) || 
                          turf.booleanContains(eraserTurfFeature, subPoly) ||
                          turf.booleanWithin(subPoly, eraserTurfFeature);
            } catch (e) {}

            // 2. Sub-polygon centroid check
            if (!touches) {
                try {
                    const center = turf.centroid(subPoly);
                    if (turf.booleanPointInPolygon(center, eraserTurfFeature)) {
                        touches = true;
                    }
                } catch (e) {}
            }

            // 3. Sub-polygon vertex points check
            if (!touches) {
                try {
                    const coords = subPoly.geometry.coordinates[0] || [];
                    for (let i = 0; i < coords.length; i++) {
                        if (turf.booleanPointInPolygon(turf.point(coords[i]), eraserTurfFeature)) {
                            touches = true;
                            break;
                        }
                    }
                } catch (e) {}
            }

            if (!touches) {
                // Sub-polygon does NOT touch eraser polygon -> KEEP IT
                remainingSubPolyCoords.push(subPoly.geometry.coordinates);
            } else {
                cityModified = true;
                // Sub-polygon TOUCHES eraser polygon
                // Check if sub-polygon (e.g. island) is COMPLETELY inside eraser polygon
                let isCompletelyInside = false;
                try {
                    isCompletelyInside = turf.booleanContains(eraserTurfFeature, subPoly) || 
                                         turf.booleanWithin(subPoly, eraserTurfFeature) ||
                                         turf.booleanPointInPolygon(turf.centroid(subPoly), eraserTurfFeature);
                } catch (e) {}

                if (isCompletelyInside) {
                    // Island/polygon is completely erased -> DO NOT INCLUDE in remaining!
                } else {
                    // Sub-polygon partially intersects -> run Turf.difference to slice off eraser part
                    try {
                        const fc = turf.featureCollection([subPoly, eraserTurfFeature]);
                        const diffResult = turf.difference(fc);

                        if (diffResult && diffResult.geometry && diffResult.geometry.coordinates && diffResult.geometry.coordinates.length > 0) {
                            if (diffResult.geometry.type === 'Polygon') {
                                remainingSubPolyCoords.push(diffResult.geometry.coordinates);
                            } else if (diffResult.geometry.type === 'MultiPolygon') {
                                diffResult.geometry.coordinates.forEach(coords => {
                                    remainingSubPolyCoords.push(coords);
                                });
                            }
                        }
                    } catch (diffErr) {
                        console.error(`Sub-polygon difference error for ${c.name}:`, diffErr);
                    }
                }
            }
        });

        if (!cityModified) return c;

        erasedCount++;

        if (remainingSubPolyCoords.length === 0) {
            // All sub-polygons of this city were erased
            return {
                ...c,
                isDeleted: true,
                geometry: null,
                wkt: ''
            };
        }

        // Reconstruct city geometry
        let newGeometry = null;
        if (remainingSubPolyCoords.length === 1) {
            newGeometry = {
                type: 'Polygon',
                coordinates: remainingSubPolyCoords[0]
            };
        } else {
            newGeometry = {
                type: 'MultiPolygon',
                coordinates: remainingSubPolyCoords
            };
        }

        // Create new WKT representation
        let newWktStr = '';
        try {
            const olFeat = geojsonFormat.readFeature({
                type: 'Feature',
                geometry: newGeometry
            }, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:4326'
            });
            newWktStr = wktFormat.writeGeometry(olFeat.getGeometry());
        } catch (wktErr) {
            console.error('WKT generation error:', wktErr);
        }

        return {
            ...c,
            geometry: newGeometry,
            wkt: newWktStr,
            isDeleted: false
        };
    });

    return { updatedCities, erasedCount };
};

export const GeoManagement = ({ token, isDarkMode, toggleTheme, lang: propLang }) => {
    const lang = propLang || localStorage.getItem('lang') || 'tr';
    const isTr = lang === 'tr';

    const [cities, setCities] = useState([]);
    const [filteredCities, setFilteredCities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'DELETED'
    
    // Save & Backup state management
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastSavedDate, setLastSavedDate] = useState(null);
    const [backupsList, setBackupsList] = useState([]);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

    // Side Panel Collapsible Drawer State
    const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);

    // Single & Multi Selection State
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedCities, setSelectedCities] = useState([]); // Multiple selection for merging

    // Undo / Redo Stacks for Polygon Editing
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [activeMapTool, setActiveMapTool] = useState('pan'); // 'pan' | 'modify' | 'draw' | 'erase_selection'
    const activeMapToolRef = useRef(activeMapTool);

    useEffect(() => {
        activeMapToolRef.current = activeMapTool;
    }, [activeMapTool]);

    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Dynamic Regions: Merge built-in regions with any custom regions added to cities
    const availableRegions = useMemo(() => {
        const set = new Set(REGION_OPTIONS);
        (cities || []).forEach(c => {
            if (c.region && typeof c.region === 'string' && c.region.trim()) {
                set.add(c.region.trim());
            }
        });
        return Array.from(set);
    }, [cities]);

    // Form state (Region is completely optional and can be custom created)
    const [formData, setFormData] = useState({
        plate: '',
        name: '',
        region: '',
        wkt: ''
    });

    // Base Map Layer state (Google Hybrid, Roadmap, Satellite, Terrain, Dark, Light)
    const [selectedBaseLayer, setSelectedBaseLayer] = useState(() => localStorage.getItem('geo_admin_basemap') || 'google_hybrid');
    const baseTileLayerRef = useRef(null);

    const handleSelectBaseLayer = (layerId) => {
        setSelectedBaseLayer(layerId);
        localStorage.setItem('geo_admin_basemap', layerId);
        const layerConfig = BASEMAP_LAYERS.find(l => l.id === layerId) || BASEMAP_LAYERS[0];
        if (baseTileLayerRef.current) {
            baseTileLayerRef.current.setSource(
                new XYZ({
                    url: layerConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: 20
                })
            );
        }
    };

    const mapRef = useRef(null);
    const mapElementRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const modifyInteractionRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const draftFeatureRef = useRef(null);
    const citiesRef = useRef(cities);




    // Keep citiesRef continuously synchronized with latest cities state
    useEffect(() => {
        citiesRef.current = cities;
    }, [cities]);

    // Push state snapshot to undo stack
    const pushStateToUndo = (currentCities) => {
        const snapshot = currentCities || citiesRef.current;
        setUndoStack(prev => [...prev.slice(-15), JSON.stringify(snapshot)]);
        setRedoStack([]);
        setHasUnsavedChanges(true);
    };

    // Show toast notification
    const showToast = (msg, type = 'success') => {
        setToastMessage({ text: msg, type });
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Zoom Controls
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

    // Helper: Update live OpenLayers map features & state
    const applyCitiesToStateAndMap = (updatedList) => {
        const hydrated = hydrateCitiesFromStorage(updatedList);
        setCities(hydrated);
        updateMapVectorFeatures(hydrated);
    };

    // Compress cities payload safely for LocalStorage with WGS84 WKT Conversion
    const compressCitiesForStorage = (citiesList) => {
        const geojsonFormat = new GeoJSON();
        const wktFormat = new WKT();

        return citiesList.map(c => {
            let wktStr = c.wkt || '';
            if (!wktStr && c.geometry) {
                try {
                    const feat = geojsonFormat.readFeature({ type: 'Feature', geometry: c.geometry });
                    wktStr = wktFormat.writeGeometry(feat.getGeometry());
                } catch (e) {}
            }
            return {
                id: c.id,
                plate: c.plate,
                name: c.name,
                region: c.region,
                isDeleted: !!c.isDeleted,
                wkt: c.isDeleted ? '' : wktStr,
                geometry: c.isDeleted ? null : (wktStr ? null : c.geometry)
            };
        });
    };

    // Hydrate compact cities payload from storage (generate geometry from WKT if needed)
    const hydrateCitiesFromStorage = (compactList) => {
        const wktFormat = new WKT();
        const jsonFormat = new GeoJSON();

        return compactList.map(c => {
            let geom = c.geometry || null;
            let wktStr = c.wkt || '';

            if (!geom && wktStr && !c.isDeleted) {
                try {
                    const feat = wktFormat.readFeature(wktStr);
                    const geojsonObj = jsonFormat.writeFeatureObject(feat);
                    geom = geojsonObj.geometry;
                } catch (err) {}
            }

            if (geom && !wktStr && !c.isDeleted) {
                try {
                    const feat = jsonFormat.readFeature({ type: 'Feature', geometry: geom });
                    wktStr = wktFormat.writeGeometry(feat.getGeometry());
                } catch (err) {}
            }

            return {
                ...c,
                isDeleted: !!c.isDeleted,
                wkt: c.isDeleted ? '' : wktStr,
                geometry: c.isDeleted ? null : geom
            };
        });
    };

    // Helper: Re-hydrate missing or corrupted geometries for active cities from original turkey-cities.json base data
    const rehydrateMissingGeometriesFromBase = (loadedCities, baseGeoJsonFeatures) => {
        const geojsonFormat = new GeoJSON();
        const wktFormat = new WKT();

        const baseMap = new Map();
        (baseGeoJsonFeatures || []).forEach((f, idx) => {
            const p = f.properties.plate || (idx + 1);
            const n = f.properties.name || `İl ${idx + 1}`;
            baseMap.set(p, f.geometry);
            baseMap.set(n, f.geometry);
        });

        return loadedCities.map(c => {
            if (c.isDeleted) {
                return { ...c, geometry: null, wkt: '' };
            }

            let geom = c.geometry || null;
            let wktStr = c.wkt || '';

            let isValidWgs84 = false;
            if (geom) {
                const firstCoord = getFirstCoordinatePair(geom);
                if (firstCoord && firstCoord[0] >= 20 && firstCoord[0] <= 50 && firstCoord[1] >= 30 && firstCoord[1] <= 45) {
                    isValidWgs84 = true;
                }
            }

            // IF GEOMETRY IS MISSING OR CORRUPTED: Re-hydrate clean geometry from base turkey-cities.json!
            if (!isValidWgs84) {
                const baseGeom = baseMap.get(c.plate) || baseMap.get(c.name);
                if (baseGeom) {
                    geom = baseGeom;
                    try {
                        const feat = geojsonFormat.readFeature({ type: 'Feature', geometry: baseGeom }, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:4326'
                        });
                        wktStr = wktFormat.writeGeometry(feat.getGeometry());
                    } catch (e) {}
                }
            }

            return {
                ...c,
                wkt: wktStr,
                geometry: geom
            };
        });
    };

    // Safe LocalStorage Set with Quota Exceeded Fallback Cleanup
    const safeLocalStorageSet = (key, valueStr) => {
        try {
            localStorage.setItem(key, valueStr);
            return true;
        } catch (e) {
            console.warn('LocalStorage Quota Exceeded. Cleaning backup history and retrying...', e);
            try {
                localStorage.removeItem(BACKUPS_STORAGE_KEY);
                localStorage.setItem(key, valueStr);
                return true;
            } catch (e2) {
                console.error('Safe LocalStorage Set Error:', e2);
                return false;
            }
        }
    };

    // Helper: Save published state immediately to ensure deleted cities never reappear
    const savePublishedStateImmediately = (updatedCitiesList) => {
        try {
            const nowStr = new Date().toLocaleString('tr-TR');
            const compact = compressCitiesForStorage(updatedCitiesList);
            const payloadStr = JSON.stringify({
                cities: compact,
                savedAt: nowStr
            });

            safeLocalStorageSet(PUBLISHED_STORAGE_KEY, payloadStr);
            setLastSavedDate(nowStr);
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error('Kalıcı Kayıt Hatası:', err);
        }
    };

    // Load GeoJSON data: Prioritize PostgreSQL database (tbl_city), fallback to turkey-cities.json
    useEffect(() => {
        purgeAllLegacyStorageKeys();

        try {
            const rawBackups = localStorage.getItem(BACKUPS_STORAGE_KEY);
            if (rawBackups) {
                setBackupsList(JSON.parse(rawBackups));
            }
        } catch (e) {}

        const geojsonFormat = new GeoJSON();
        const wktFormat = new WKT();

        // 1. Try loading directly from PostgreSQL Database tbl_city via API
        adminApi.getCities(true, token)
            .then(dbCities => {
                if (dbCities && Array.isArray(dbCities) && dbCities.length > 0) {
                    const loadedCities = dbCities.map(c => {
                        let geomObj = null;
                        if (c.wkt) {
                            try {
                                const feat = wktFormat.readFeature(c.wkt);
                                geomObj = geojsonFormat.writeFeatureObject(feat).geometry;
                            } catch (e) {}
                        }
                        return {
                            id: c.id || c.plate,
                            plate: c.plate,
                            name: c.name,
                            region: c.region,
                            wkt: c.wkt,
                            geometry: geomObj,
                            isActive: c.isActive !== false,
                            isDeleted: c.isDeleted === true
                        };
                    });

                    loadedCities.sort((a, b) => a.plate - b.plate);
                    applyCitiesToStateAndMap(loadedCities);
                    setFilteredCities(loadedCities);
                    setHasUnsavedChanges(false);
                    console.log(`[GeoManagement] ${loadedCities.length} adet il ve bölge sınırı PostgreSQL veritabanından başarıyla yüklendi.`);
                    return;
                }
                throw new Error('Database empty, fallback to JSON');
            })
            .catch(() => {
                // 2. Fallback to turkey-cities.json if DB is empty or offline
                fetch(`/data/turkey-cities.json?v=${Date.now()}`)
                    .then(res => res.json())
                    .then(data => {
                        const baseFeatures = data.features || [];
                        const baseList = baseFeatures.map((f, idx) => {
                            let wktStr = f.properties.wkt || '';
                            if (!wktStr && f.geometry) {
                                try {
                                    const olFeat = geojsonFormat.readFeature(f);
                                    wktStr = wktFormat.writeGeometry(olFeat.getGeometry());
                                } catch (e) {}
                            }
                            return {
                                id: f.properties.plate || (idx + 1),
                                plate: f.properties.plate || (idx + 1),
                                name: f.properties.name || `İl ${idx + 1}`,
                                region: f.properties.region || 'İç Anadolu Bölgesi',
                                wkt: wktStr,
                                geometry: f.geometry,
                                isDeleted: false
                            };
                        });
                        baseList.sort((a, b) => a.plate - b.plate);

                        let finalCities = baseList;

                        try {
                            const savedPublishedRaw = localStorage.getItem(PUBLISHED_STORAGE_KEY);
                            if (savedPublishedRaw) {
                                const parsed = JSON.parse(savedPublishedRaw);
                                if (parsed && parsed.cities && parsed.cities.length > 0) {
                                    const hydratedSaved = hydrateCitiesFromStorage(parsed.cities);
                                    const savedMap = new Map();
                                    hydratedSaved.forEach(c => {
                                        savedMap.set(c.plate, c);
                                        savedMap.set(c.name, c);
                                    });

                                    finalCities = baseList.map(baseCity => {
                                        const savedCity = savedMap.get(baseCity.plate) || savedMap.get(baseCity.name);
                                        if (savedCity) {
                                            return {
                                                ...baseCity,
                                                ...savedCity,
                                                geometry: savedCity.geometry || baseCity.geometry,
                                                wkt: savedCity.wkt || baseCity.wkt
                                            };
                                        }
                                        return baseCity;
                                    });

                                    hydratedSaved.forEach(c => {
                                        if (!baseList.some(b => b.plate === c.plate)) {
                                            finalCities.push(c);
                                        }
                                    });

                                    setLastSavedDate(parsed.savedAt || 'Önceden Kaydedildi');
                                }
                            }
                        } catch (e) {
                            console.error('Kayıt birleştirme hatası:', e);
                        }

                        const rehydrated = rehydrateMissingGeometriesFromBase(finalCities, baseFeatures);
                        applyCitiesToStateAndMap(rehydrated);
                        setFilteredCities(rehydrated);
                        setHasUnsavedChanges(false);
                    })
                    .catch(err => console.error('GeoJSON Yükleme Hatası:', err));
            });
    }, []);

    // Guarantee map features are ALWAYS rendered on OpenLayers vector source whenever cities state or vector source updates
    useEffect(() => {
        if (vectorSourceRef.current && cities.length > 0) {
            updateMapVectorFeatures(cities);
        }
    }, [cities]);

    // Save Action: Extract live features directly from OpenLayers map canvas, save as permanent DEFAULT and create automatic backup
    const handleSaveChanges = async () => {
        try {
            const now = new Date();
            const dateStr = now.toLocaleString('tr-TR');
            const wktFormat = new WKT();
            const geojsonFormat = new GeoJSON();

            // 1. Extract live geometries directly from OpenLayers canvas features in EPSG:4326 WGS84
            let liveCitiesMap = new Map();
            if (vectorSourceRef.current) {
                const features = vectorSourceRef.current.getFeatures();
                features.forEach(feat => {
                    const plate = feat.get('plate');
                    const name = feat.get('name');
                    if (feat.getGeometry()) {
                        const clonedGeom = feat.getGeometry().clone();
                        clonedGeom.transform('EPSG:3857', 'EPSG:4326');
                        const wktStr = wktFormat.writeGeometry(clonedGeom);
                        const geojsonObj = geojsonFormat.writeFeatureObject(new Feature({ geometry: clonedGeom }), {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:4326'
                        });
                        liveCitiesMap.set(plate || name, { wkt: wktStr, geometry: geojsonObj.geometry });
                    }
                });
            }

            // 2. Sync state array with live canvas geometries
            const syncedCities = cities.map(c => {
                const liveData = liveCitiesMap.get(c.plate) || liveCitiesMap.get(c.name);
                if (liveData && !c.isDeleted) {
                    return {
                        ...c,
                        wkt: liveData.wkt || c.wkt,
                        geometry: liveData.geometry || c.geometry
                    };
                }
                return c;
            });

            setCities(syncedCities);

            const compactCurrentCities = compressCitiesForStorage(syncedCities);

            // Push current saved state to Backup History BEFORE updating to new saved state
            const currentPublishedRaw = localStorage.getItem(PUBLISHED_STORAGE_KEY);
            let updatedBackups = [...backupsList];

            if (currentPublishedRaw) {
                const oldData = JSON.parse(currentPublishedRaw);
                const newBackup = {
                    id: Date.now(),
                    dateStr: oldData.savedAt || dateStr,
                    citiesCount: (oldData.cities || []).filter(c => !c.isDeleted).length,
                    note: `${oldData.savedAt || dateStr} tarihli harita yedeği (Değişiklik Öncesi)`,
                    cities: oldData.cities || []
                };
                updatedBackups = [newBackup, ...updatedBackups].slice(0, 10); // Store up to 10 historical backups
                setBackupsList(updatedBackups);
                safeLocalStorageSet(BACKUPS_STORAGE_KEY, JSON.stringify(updatedBackups));
            }

            const payloadStr = JSON.stringify({
                cities: compactCurrentCities,
                savedAt: dateStr
            });

            const success = safeLocalStorageSet(PUBLISHED_STORAGE_KEY, payloadStr);
            setLastSavedDate(dateStr);
            setHasUnsavedChanges(false);

            // 3. Persist to PostgreSQL Database table tbl_city AND server disk backup
            try {
                await adminApi.saveBulkCities(syncedCities, token);
                console.log('[DB Persist] Tüm il verileri PostgreSQL veritabanına (tbl_city) başarıyla kaydedildi.');
            } catch (dbErr) {
                console.warn('[DB Persist] Veritabanı kaydetme uyarısı:', dbErr);
            }

            // 4. Generate GeoJSON payload for server disk backup (turkey-cities.json & turkey-cities-backup.json)
            try {
                const geoJsonFeatures = syncedCities.filter(c => !c.isDeleted).map(c => {
                    let geomObj = c.geometry;
                    if (!geomObj && c.wkt) {
                        try {
                            const feat = wktFormat.readFeature(c.wkt);
                            geomObj = geojsonFormat.writeFeatureObject(feat).geometry;
                        } catch (e) {}
                    }
                    return {
                        type: 'Feature',
                        properties: {
                            id: c.id || c.plate,
                            plate: c.plate,
                            name: c.name,
                            region: c.region,
                            wkt: c.wkt
                        },
                        geometry: geomObj || null
                    };
                });

                await adminApi.backupCities({ type: 'FeatureCollection', features: geoJsonFeatures });
            } catch (e) {
                console.warn('[Disk Persist] Sunucu disk yedeği oluşturma uyarısı:', e);
            }

            if (success) {
                showToast(`Harita Kaydedildi (PostgreSQL Veritabanı & Sunucu Diski Güncellendi)`);
            } else {
                showToast(`Harita Kaydedildi`, 'warning');
            }

        } catch (err) {
            console.error('Kaydetme Hatası:', err);
            showToast(`Kaydetme uyarısı: ${err.message || err}`, 'error');
        }
    };


    // Restore Backup from Backup Modal
    const handleRestoreBackup = (backupItem) => {
        try {
            if (!window.confirm(`"${backupItem.dateStr}" tarihli harita yedeğini yüklemek istediğinize emin misiniz?`)) {
                return;
            }

            pushStateToUndo(cities);
            const sanitizedBackup = hydrateCitiesFromStorage(backupItem.cities);
            applyCitiesToStateAndMap(sanitizedBackup);
            savePublishedStateImmediately(sanitizedBackup);
            setHasUnsavedChanges(false);
            setIsBackupModalOpen(false);
            showToast(`"${backupItem.dateStr}" tarihli harita yedeği yüklendi ve kaydedildi!`);
        } catch (err) {
            console.error('Yedek Yükleme Hatası:', err);
            showToast('Yedek yüklenirken hata oluştu.', 'error');
        }
    };

    // Delete a specific backup item
    const handleDeleteBackup = (backupId) => {
        const updated = backupsList.filter(b => b.id !== backupId);
        setBackupsList(updated);
        safeLocalStorageSet(BACKUPS_STORAGE_KEY, JSON.stringify(updated));
        showToast('Yedek kaydı listeden silindi.', 'warning');
    };

    // Undo action (Geri Al)

    const handleUndo = () => {
        try {
            if (undoStack.length === 0) {
                showToast('Geri alınacak işlem bulunmuyor.', 'warning');
                return;
            }
            const previousStateRaw = undoStack[undoStack.length - 1];
            const newUndoStack = undoStack.slice(0, -1);
            
            setRedoStack(prev => [...prev, JSON.stringify(cities)]);
            setUndoStack(newUndoStack);

            const restoredCities = JSON.parse(previousStateRaw);
            applyCitiesToStateAndMap(restoredCities);
            savePublishedStateImmediately(restoredCities);
            showToast('Son poligon değişikliği geri alındı (Undo)!');
        } catch (err) {
            console.error('Undo Hatası:', err);
            showToast('İşlem geri alınırken hata oluştu.', 'error');
        }
    };

    // Redo action (İleri Al)
    const handleRedo = () => {
        try {
            if (redoStack.length === 0) {
                showToast('İleri alınacak işlem bulunmuyor.', 'warning');
                return;
            }
            const nextStateRaw = redoStack[redoStack.length - 1];
            const newRedoStack = redoStack.slice(0, -1);

            setUndoStack(prev => [...prev, JSON.stringify(cities)]);
            setRedoStack(newRedoStack);

            const restoredCities = JSON.parse(nextStateRaw);
            applyCitiesToStateAndMap(restoredCities);
            savePublishedStateImmediately(restoredCities);
            showToast('Geri alınan değişiklik tekrar uygulandı (Redo)!');
        } catch (err) {
            console.error('Redo Hatası:', err);
            showToast('İşlem ileri alınırken hata oluştu.', 'error');
        }
    };

    // Smart Turkish-aware normalization function (handles İ/i, I/ı, Ç/c, Ğ/g, Ö/o, Ş/s, Ü/u)
    const normalizeTR = (str) => {
        if (!str) return '';
        return str
            .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i')
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ş/g, 's').replace(/Ş/g, 's')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ç/g, 'c').replace(/Ç/g, 'c')
            .toLowerCase().trim();
    };

    // Filter cities with Turkish character tolerance & padded plate code matching
    useEffect(() => {
        let result = cities;
        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim();
            const qNorm = normalizeTR(q);
            const qLower = q.toLowerCase();

            result = result.filter(c => {
                const nameNorm = normalizeTR(c.name);
                const nameLower = (c.name || '').toLowerCase();
                const plateStr = (c.plate || '').toString();
                const platePadded = plateStr.padStart(2, '0');

                return (
                    nameNorm.includes(qNorm) ||
                    nameLower.includes(qLower) ||
                    plateStr.includes(q) ||
                    platePadded.includes(q)
                );
            });

            // If search matches exactly 1 active city, automatically fly camera to it on map!
            if (result.length === 1 && !result[0].isDeleted) {
                zoomToCityOnMap(result[0]);
            }
        }
        if (selectedRegion !== 'ALL') {
            if (selectedRegion === 'NONE') {
                result = result.filter(c => !c.region || !c.region.trim());
            } else {
                result = result.filter(c => (c.region || '').trim() === selectedRegion);
            }
        }
        if (statusFilter === 'ACTIVE') {
            result = result.filter(c => !c.isDeleted);
        } else if (statusFilter === 'DELETED') {
            result = result.filter(c => c.isDeleted);
        }
        setFilteredCities(result);
    }, [searchQuery, selectedRegion, statusFilter, cities]);


    // Update OpenLayers Map Vector Features with Unique IDs for every shape
    const updateMapVectorFeatures = (updatedCities) => {
        if (!vectorSourceRef.current) return;
        vectorSourceRef.current.clear();
        
        const activeCities = updatedCities.filter(c => !c.isDeleted);
        const features = activeCities.map((c, idx) => {
            if (!c.geometry && !c.wkt) return null;
            const format = new GeoJSON();
            const wktFormat = new WKT();
            try {
                let feat = null;
                const uniqueShapeId = c.id || (c.plate ? `${c.plate}_${idx + 1}` : `shape_${idx + 1}`);

                if (c.geometry) {
                    feat = format.readFeature({
                        type: 'Feature',
                        geometry: c.geometry,
                        properties: {
                            id: uniqueShapeId,
                            plate: c.plate,
                            name: c.name,
                            region: c.region,
                            wkt: c.wkt
                        }
                    }, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                } else if (c.wkt) {
                    feat = wktFormat.readFeature(c.wkt, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    feat.set('id', uniqueShapeId);
                    feat.set('plate', c.plate);
                    feat.set('name', c.name);
                    feat.set('region', c.region);
                    feat.set('wkt', c.wkt);
                }

                if (feat) {
                    feat.setId(uniqueShapeId);
                }
                return feat;
            } catch (err) {
                return null;
            }
        }).filter(Boolean);

        vectorSourceRef.current.addFeatures(features);
    };

    // Smoothly fly/zoom map view to clicked city
    const zoomToCityOnMap = (city) => {
        try {
            if (!city || !mapRef.current || !vectorSourceRef.current) return;
            const features = vectorSourceRef.current.getFeatures();
            const matched = features.find(f => f.get('plate') === city.plate || f.get('name') === city.name);
            if (matched && matched.getGeometry()) {
                const extent = matched.getGeometry().getExtent();
                mapRef.current.getView().fit(extent, {
                    duration: 850,
                    padding: [70, 70, 70, 70],
                    maxZoom: 9.5
                });
            }
        } catch (err) {
            console.error('Kamera Uçuş Hatası:', err);
        }
    };

    // Handle City Click (Normal click replaces selection; Shift key enables multi-selection)
    const handleCityClick = (city, isShiftPressed = false, shouldZoom = true) => {
        if (city.isDeleted) return;

        if (isShiftPressed) {
            setSelectedCities(prev => {
                const exists = prev.some(c => c.plate === city.plate);
                if (exists) {
                    return prev.filter(c => c.plate !== city.plate);
                } else {
                    return [...prev, city];
                }
            });
            setSelectedCity(city);
        } else {
            if (selectedCity && selectedCity.plate === city.plate && selectedCities.length === 1) {
                setSelectedCity(null);
                setSelectedCities([]);
            } else {
                setSelectedCity(city);
                setSelectedCities([city]);
            }
        }

        if (shouldZoom) {
            zoomToCityOnMap(city);
        }
    };

    // Clear all selections
    const handleClearSelection = () => {
        setSelectedCities([]);
        setSelectedCity(null);
    };

    // Reset All Custom Changes back to original GeoJSON
    const handleResetAllData = () => {
        try {
            if (!window.confirm('Tüm kaydedilmiş verileri ve hafızayı tamamen sıfırlayıp Orijinal Temiz Haritaya dönmek istediğinize emin misiniz?')) {
                return;
            }

            localStorage.clear();

            fetch(`/data/turkey-cities.json?v=${Date.now()}`)
                .then(res => res.json())
                .then(data => {
                    const geojsonFormat = new GeoJSON();
                    const wktFormat = new WKT();

                    const list = (data.features || []).map((f, idx) => {
                        let wktStr = f.properties.wkt || '';
                        if (!wktStr && f.geometry) {
                            try {
                                const olFeat = geojsonFormat.readFeature(f);
                                wktStr = wktFormat.writeGeometry(olFeat.getGeometry());
                            } catch (e) {}
                        }
                        return {
                            id: f.properties.plate || (idx + 1),
                            plate: f.properties.plate || (idx + 1),
                            name: f.properties.name || `İl ${idx + 1}`,
                            region: f.properties.region || 'İç Anadolu Bölgesi',
                            wkt: wktStr,
                            geometry: f.geometry,
                            isDeleted: false
                        };
                    });
                    list.sort((a, b) => a.plate - b.plate);
                    applyCitiesToStateAndMap(list);
                    savePublishedStateImmediately(list);
                    showToast('Tüm harita hafızası tamamen temizlendi ve orijinal haline sıfırlandı!');
                });
        } catch (err) {
            console.error('Sıfırlama Hatası:', err);
            showToast('Veriler sıfırlanırken hata oluştu.', 'error');
        }
    };

    // Merge selected 2nd/3rd polygons INTO the 1st selected city geometry & properties cleanly
    const handleMergeSelectedPolygons = () => {
        try {
            if (selectedCities.length < 2) {
                showToast('Lütfen birleştirmek için en az 2 il seçiniz!', 'error');
                return;
            }

            const primaryCity = selectedCities[0];
            const secondaryCities = selectedCities.slice(1);
            const secondaryNames = secondaryCities.map(c => c.name).join(', ');

            if (!window.confirm(`1. İl olarak seçilen "${primaryCity.name}" ili altında [${secondaryNames}] illerini birleştirmek istediğinize emin misiniz?`)) {
                return;
            }

            pushStateToUndo(cities);

            const geojsonFormat = new GeoJSON();
            const wktFormat = new WKT();

            // Build Turf FeatureCollection for all selected active cities
            const turfFeatures = [];
            selectedCities.forEach(city => {
                let turfFeat = null;
                if (city.geometry) {
                    turfFeat = turf.feature({ type: 'Feature', geometry: city.geometry });
                } else if (city.wkt) {
                    try {
                        const olFeat = readWktFeatureSafely(city.wkt, wktFormat);
                        if (olFeat) {
                            turfFeat = geojsonFormat.writeFeatureObject(olFeat, {
                                dataProjection: 'EPSG:4326',
                                featureProjection: 'EPSG:3857'
                            });
                        }
                    } catch (e) {}
                }
                if (turfFeat) turfFeatures.push(turfFeat);
            });

            let mergedGeometry = null;
            let mergedWkt = '';

            if (turfFeatures.length >= 2) {
                try {
                    const fc = turf.featureCollection(turfFeatures);
                    const unionResult = turf.union(fc);
                    if (unionResult && unionResult.geometry) {
                        mergedGeometry = unionResult.geometry;
                        const olMerged = geojsonFormat.readFeature(unionResult, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        });
                        mergedWkt = wktFormat.writeGeometry(olMerged.getGeometry());
                    }
                } catch (unionErr) {
                    console.error('Turf union error, falling back to MultiPolygon concat:', unionErr);
                }
            }

            if (!mergedGeometry) {
                let allPolygonsCoords = [];
                selectedCities.forEach(city => {
                    if (city.geometry) {
                        if (city.geometry.type === 'Polygon') {
                            allPolygonsCoords.push(city.geometry.coordinates);
                        } else if (city.geometry.type === 'MultiPolygon') {
                            city.geometry.coordinates.forEach(polyCoords => {
                                allPolygonsCoords.push(polyCoords);
                            });
                        }
                    }
                });

                if (allPolygonsCoords.length === 0) {
                    showToast('Birleştirilecek geçerli poligon sınırı bulunamadı!', 'error');
                    return;
                }

                mergedGeometry = {
                    type: 'MultiPolygon',
                    coordinates: allPolygonsCoords
                };

                const olFeature = geojsonFormat.readFeature({
                    type: 'Feature',
                    geometry: mergedGeometry
                }, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                mergedWkt = wktFormat.writeGeometry(olFeature.getGeometry());
            }

            const secondaryPlates = secondaryCities.map(c => c.plate);

            const updatedCities = cities.map(c => {
                if (c.plate === primaryCity.plate) {
                    return {
                        ...c,
                        geometry: mergedGeometry,
                        wkt: mergedWkt
                    };
                } else if (secondaryPlates.includes(c.plate)) {
                    return {
                        ...c,
                        isDeleted: true,
                        geometry: null,
                        wkt: ''
                    };
                }
                return c;
            });

            applyCitiesToStateAndMap(updatedCities);
            savePublishedStateImmediately(updatedCities);

            adminApi.saveBulkCities(updatedCities, token).catch(err => console.warn('[DB Persist Error]:', err));

            const updatedPrimaryCity = updatedCities.find(c => c.plate === primaryCity.plate) || primaryCity;
            setSelectedCities([updatedPrimaryCity]);
            setSelectedCity(updatedPrimaryCity);
            showToast(`[${secondaryNames}] illeri "${primaryCity.name}" ili altında birleştirildi ve kaydedildi!`);
        } catch (err) {
            console.error('Birleştirme Hatası:', err);
            showToast(`Birleştirme sırasında hata oluştu: ${err.message || err}`, 'error');
        }
    };

    // Permanent Soft Delete City Action
    const handleSoftDeleteCity = (cityToDelete) => {
        try {
            if (!window.confirm(`"${cityToDelete.name}" ilini pasife alıp (Soft Delete) haritadan silmek istediğinize emin misiniz? (Çıkış yapılsa da bir daha gelmez)`)) {
                return;
            }

            pushStateToUndo(cities);

            const updatedCities = cities.map(c => {
                if (c.plate === cityToDelete.plate || c.name === cityToDelete.name || c.id === cityToDelete.id) {
                    return {
                        ...c,
                        isDeleted: true,
                        geometry: null,
                        wkt: ''
                    };
                }
                return c;
            });

            applyCitiesToStateAndMap(updatedCities);
            savePublishedStateImmediately(updatedCities);

            adminApi.saveBulkCities(updatedCities, token).catch(err => console.warn('[DB Persist Error]:', err));

            if (selectedCity && selectedCity.plate === cityToDelete.plate) {
                setSelectedCity(null);
            }
            setSelectedCities(prev => prev.filter(c => c.plate !== cityToDelete.plate));

            showToast(`"${cityToDelete.name}" ilinin poligonları haritadan kalıcı olarak silindi ve kaydedildi!`, 'warning');
        } catch (err) {
            console.error('Silme Hatası:', err);
            showToast('Silme işlemi sırasında hata oluştu.', 'error');
        }
    };

    // Restore Soft-Deleted City Action
    const handleRestoreCity = (cityToRestore) => {
        try {
            pushStateToUndo(cities);

            const updatedCities = cities.map(c => {
                if (c.plate === cityToRestore.plate) {
                    return {
                        ...c,
                        isDeleted: false
                    };
                }
                return c;
            });

            applyCitiesToStateAndMap(updatedCities);
            savePublishedStateImmediately(updatedCities);

            adminApi.saveBulkCities(updatedCities, token).catch(err => console.warn('[DB Persist Error]:', err));

            showToast(`"${cityToRestore.name}" ili geri yüklendi ve kaydedildi!`);
        } catch (err) {
            console.error('Geri Yükleme Hatası:', err);
            showToast('Geri yükleme sırasında hata oluştu.', 'error');
        }
    };

    // Initialize OpenLayers Map
    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) return;

        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: (feature) => {
                const plate = feature.get('plate');
                const isPrimary = selectedCity && selectedCity.plate === plate;
                const isMultiSelected = selectedCities.some(c => c.plate === plate);

                if (isPrimary) {
                    return new Style({
                        fill: new Fill({ color: 'rgba(239, 68, 68, 0.65)' }),
                        stroke: new Stroke({ color: '#ef4444', width: 4 }),
                        text: new Text({
                            text: feature.get('name') || '',
                            font: 'bold 13px Inter, sans-serif',
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#000000', width: 4 })
                        })
                    });
                } else if (isMultiSelected) {
                    return new Style({
                        fill: new Fill({ color: 'rgba(59, 130, 246, 0.55)' }),
                        stroke: new Stroke({ color: '#3b82f6', width: 3.5 }),
                        text: new Text({
                            text: feature.get('name') || '',
                            font: 'bold 12px Inter, sans-serif',
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#0f172a', width: 3 })
                        })
                    });
                }

                return new Style({
                    fill: new Fill({ color: 'rgba(59, 130, 246, 0.12)' }),
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

        const activeBaseConfig = BASEMAP_LAYERS.find(l => l.id === selectedBaseLayer) || BASEMAP_LAYERS[0];
        const baseTileLayer = new TileLayer({
            source: new XYZ({
                url: activeBaseConfig.url,
                crossOrigin: 'anonymous',
                maxZoom: 20
            })
        });
        baseTileLayerRef.current = baseTileLayer;

        const map = new Map({
            target: mapElementRef.current,
            layers: [
                baseTileLayer,
                vectorLayer
            ],
            view: new View({
                center: fromLonLat([35.2433, 38.9637]),
                zoom: 6
            })
        });

        // Modify Interaction (Created but NOT added to map until user clicks location pin button)
        const modify = new Modify({ source: vectorSource });
        modify.on('modifystart', () => {
            pushStateToUndo(citiesRef.current);
        });
        modify.on('modifyend', (evt) => {
            try {
                const modifiedFeatures = evt.features.getArray();
                const wktFormat = new WKT();
                const geojsonFormat = new GeoJSON();

                modifiedFeatures.forEach(feat => {
                    const plate = feat.get('plate');
                    const name = feat.get('name');

                    // Convert OpenLayers EPSG:3857 geometry to EPSG:4326 WGS84 for accurate WKT saving
                    const clonedGeom = feat.getGeometry().clone();
                    clonedGeom.transform('EPSG:3857', 'EPSG:4326');
                    const newWkt = wktFormat.writeGeometry(clonedGeom);
                    const geojsonObj = geojsonFormat.writeFeatureObject(new Feature({ geometry: clonedGeom }), {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:4326'
                    });

                    setCities(prev => {
                        const updated = prev.map(c => {
                            if (c.plate === plate || c.name === name) {
                                return { ...c, wkt: newWkt, geometry: geojsonObj.geometry };
                            }
                            return c;
                        });
                        savePublishedStateImmediately(updated);
                        return updated;
                    });
                    showToast(`"${name}" ilinin haritadaki köşe noktaları düzenlendi ve kaydedildi!`);
                });
            } catch (err) {
                console.error('Sınır Düzenleme Hatası:', err);
                showToast('Poligon sınırı güncellenirken hata oluştu.', 'error');
            }
        });
        modifyInteractionRef.current = modify;


        // Pointer move handler
        map.on('pointermove', (evt) => {
            const hit = map.hasFeatureAtPixel(evt.pixel);
            if (activeMapToolRef.current === 'erase_selection') {
                map.getTargetElement().style.cursor = hit ? 'crosshair' : 'default';
            } else {
                map.getTargetElement().style.cursor = hit ? 'pointer' : '';
            }
        });

        // Direct Left Click Handler (Supports direct click-to-delete in erase_selection mode)
        map.on('singleclick', (evt) => {
            const geojsonFormat = new GeoJSON();
            const wktFormat = new WKT();

            // 1. CLICK-TO-ERASE MODE: Click directly on ANY polygon or island to delete it instantly!
            if (activeMapToolRef.current === 'erase_selection') {
                const currentLiveCities = citiesRef.current;
                let clickedFeature = null;

                map.forEachFeatureAtPixel(evt.pixel, (feat) => {
                    if (!clickedFeature && feat.get('plate')) {
                        clickedFeature = feat;
                    }
                });

                const clickCoord4326 = toLonLat(evt.coordinate);
                const clickPoint = turf.point(clickCoord4326);

                if (clickedFeature) {
                    const plate = clickedFeature.get('plate');
                    const name = clickedFeature.get('name');
                    const targetCity = currentLiveCities.find(c => (c.plate === plate || c.name === name) && !c.isDeleted);

                    if (targetCity) {
                        pushStateToUndo(currentLiveCities);

                        let islandDeleted = false;

                        const updatedCities = currentLiveCities.map(c => {
                            if (c.plate !== targetCity.plate && c.name !== targetCity.name) return c;

                            let geom = c.geometry;
                            if (!geom && c.wkt) {
                                try {
                                    const olFeat = wktFormat.readFeature(c.wkt);
                                    geom = geojsonFormat.writeGeometryObject(olFeat.getGeometry());
                                } catch (e) {}
                            }

                            if (!geom) return { ...c, isDeleted: true, geometry: null, wkt: '' };

                            // If city is a MultiPolygon with multiple islands/parts, find which sub-polygon was clicked
                            if (geom.type === 'MultiPolygon' && geom.coordinates.length > 1) {
                                let clickedSubIndex = -1;
                                geom.coordinates.forEach((polyCoords, idx) => {
                                    try {
                                        const subPoly = turf.polygon(polyCoords);
                                        if (turf.booleanPointInPolygon(clickPoint, subPoly)) {
                                            clickedSubIndex = idx;
                                        }
                                    } catch (e) {}
                                });

                                if (clickedSubIndex !== -1) {
                                    islandDeleted = true;
                                    const remainingCoords = geom.coordinates.filter((_, idx) => idx !== clickedSubIndex);
                                    if (remainingCoords.length === 0) {
                                        return { ...c, isDeleted: true, geometry: null, wkt: '' };
                                    }
                                    const newGeom = remainingCoords.length === 1 
                                        ? { type: 'Polygon', coordinates: remainingCoords[0] }
                                        : { type: 'MultiPolygon', coordinates: remainingCoords };

                                    let newWkt = '';
                                    try {
                                        const olFeat = geojsonFormat.readFeature({ type: 'Feature', geometry: newGeom }, {
                                            dataProjection: 'EPSG:4326',
                                            featureProjection: 'EPSG:4326'
                                        });
                                        newWkt = wktFormat.writeGeometry(olFeat.getGeometry());
                                    } catch (e) {}

                                    return {
                                        ...c,
                                        geometry: newGeom,
                                        wkt: newWkt,
                                        isDeleted: false
                                    };
                                }
                            }

                            // Standalone single polygon city or main body -> delete city
                            islandDeleted = true;
                            return {
                                ...c,
                                isDeleted: true,
                                geometry: null,
                                wkt: ''
                            };
                        });

                        if (islandDeleted) {
                            applyCitiesToStateAndMap(updatedCities);
                            savePublishedStateImmediately(updatedCities);
                            showToast(`"${targetCity.name}" poligonu / adası haritaya tıklanarak silindi ve kaydedildi!`, 'warning');
                            return;
                        }
                    }
                }
            }

            // 2. NORMAL NAVIGATION MODE: Click city to select
            let clickedCity = null;
            map.forEachFeatureAtPixel(evt.pixel, (feature) => {
                const plate = feature.get('plate');
                const name = feature.get('name');
                const matched = citiesRef.current.find(c => (c.plate === plate || c.name === name) && !c.isDeleted);
                if (matched) {
                    clickedCity = matched;
                }
            });

            if (clickedCity) {
                handleCityClick(clickedCity, evt.originalEvent.shiftKey, false);
            }
        });

        // Context Menu Handler (Shift + Right Click)
        const viewport = map.getViewport();
        viewport.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();
            const pixel = map.getEventPixel(evt);
            map.forEachFeatureAtPixel(pixel, (feature) => {
                const plate = feature.get('plate');
                const name = feature.get('name');
                const matched = cities.find(c => (c.plate === plate || c.name === name) && !c.isDeleted);
                if (matched) {
                    handleCityClick(matched, true, false);
                }
            });
        });

        mapRef.current = map;

        // Populate vector features immediately on map load
        if (cities.length > 0) {
            updateMapVectorFeatures(cities);
        }
    }, [cities]);


    // Switch active map tool (Default is 'pan' mode for free map navigation)
    const toggleMapTool = (toolName) => {

        if (!mapRef.current || !vectorSourceRef.current) return;

        // Toggle tool: If clicking the active tool, revert to 'pan' navigation mode
        const targetTool = (activeMapTool === toolName && toolName !== 'pan') ? 'pan' : toolName;

        // Always clean up existing draw and modify interactions first
        if (drawInteractionRef.current) {
            mapRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (modifyInteractionRef.current) {
            mapRef.current.removeInteraction(modifyInteractionRef.current);
        }

        setActiveMapTool(targetTool);

        if (targetTool === 'modify') {
            if (modifyInteractionRef.current) {
                mapRef.current.addInteraction(modifyInteractionRef.current);
            }
            showToast('Konum İğnesi / Sınır Düzenleme (Modify) Modu Aktif: Köşe noktalarını sürükleyebilirsiniz. Çıkmak için iğneye tekrar basın.');
        } else if (targetTool === 'draw') {
            const draw = new Draw({
                source: vectorSourceRef.current,
                type: 'Polygon'
            });
            draw.on('drawstart', (evt) => {
                draftFeatureRef.current = evt.feature;
            });
            draw.on('drawend', (evt) => {
                try {
                    draftFeatureRef.current = evt.feature;
                    const wktFormat = new WKT();
                    const clonedGeom = evt.feature.getGeometry().clone();
                    clonedGeom.transform('EPSG:3857', 'EPSG:4326');
                    const newWkt = wktFormat.writeGeometry(clonedGeom);

                    const activeCities = (citiesRef.current || []).filter(c => !c.isDeleted);
                    const maxExistingPlate = Math.max(0, ...activeCities.map(c => Number(c.plate) || 0));
                    const nextPlate = maxExistingPlate + 1;

                    setFormData({
                        plate: nextPlate.toString(),
                        name: '',
                        region: 'Marmara Bölgesi',
                        wkt: newWkt
                    });

                    setIsAddModalOpen(true);
                    setActiveMapTool('pan');
                    if (drawInteractionRef.current && mapRef.current) {
                        mapRef.current.removeInteraction(drawInteractionRef.current);
                        drawInteractionRef.current = null;
                    }
                    showToast('Poligon çizimi tamamlandı! Lütfen il adı ve plaka kodunu (ID) girerek kaydediniz.');
                } catch (err) {
                    console.error('Poligon Çizim Hatası:', err);
                    showToast('Yeni poligon çizilirken hata oluştu.', 'error');
                }
            });
            mapRef.current.addInteraction(draw);
            drawInteractionRef.current = draw;
            showToast('Çizim modu aktif: Haritada tıklayarak poligon çizin, tamamlamak için çift tıklayın.');
        } else if (targetTool === 'erase_selection') {
            showToast('Tıklayarak Silme Modu Aktif: Silmek istediğiniz adaya / poligona haritada DOĞRUDAN TIKLAYIN.', 'warning');
        } else {
            showToast('Harita Gezinme (Pan) Modu Aktif: Haritada serbestçe sürüklenebilirsiniz.');
        }
    };



    // Redraw map styles when selection changes
    useEffect(() => {
        if (vectorSourceRef.current) {
            vectorSourceRef.current.changed();
        }
    }, [selectedCity, selectedCities]);

    // Save Edit Form with Strict Unique ID/Name Validation
    const handleSaveEdit = () => {
        try {
            if (!selectedCity) {
                showToast('Lütfen düzenlemek istediğiniz bir şehir seçiniz!', 'error');
                return;
            }

            if (!formData.name || !formData.name.trim()) {
                showToast('Lütfen geçerli bir il adı giriniz!', 'error');
                return;
            }

            const newPlate = parseInt(formData.plate, 10);
            if (isNaN(newPlate) || newPlate <= 0) {
                showToast('Geçersiz plaka kodu! Lütfen pozitif bir sayı giriniz.', 'error');
                return;
            }

            const inputNameClean = formData.name.trim();

            // Rule: Two different city names CANNOT share the same ID / Plate code!
            const duplicatePlateCity = cities.find(c => 
                c.plate === newPlate && 
                c.name.toLowerCase() !== inputNameClean.toLowerCase() && 
                c.plate !== selectedCity.plate &&
                !c.isDeleted
            );
            if (duplicatePlateCity) {
                showToast(`HATA: İki farklı şehir adı aynı ID'ye (Plaka Kodu: ${newPlate}) sahip olamaz! Bu plaka zaten "${duplicatePlateCity.name}" iline ait.`, 'error');
                return;
            }

            const duplicateNameCity = cities.find(c => 
                c.name.toLowerCase() === inputNameClean.toLowerCase() && 
                c.plate !== newPlate && 
                c.plate !== selectedCity.plate &&
                !c.isDeleted
            );
            if (duplicateNameCity) {
                showToast(`HATA: "${inputNameClean}" ismi zaten Plaka Kodu ${duplicateNameCity.plate} ile sisteme kayıtlı! İki farklı plaka aynı isme sahip olamaz.`, 'error');
                return;
            }

            pushStateToUndo(cities);

            const updated = cities.map(c => {
                if (c.plate === selectedCity.plate || c.id === selectedCity.id) {
                    return {
                        ...c,
                        plate: newPlate,
                        id: c.id || newPlate,
                        name: inputNameClean,
                        region: formData.region,
                        wkt: formData.wkt || ''
                    };
                }
                return c;
            }).sort((a, b) => a.plate - b.plate);

            applyCitiesToStateAndMap(updated);
            savePublishedStateImmediately(updated);

            adminApi.saveBulkCities(updated, token).catch(err => console.warn('[DB Persist Error]:', err));

            const updatedSelectedCity = updated.find(c => c.plate === newPlate) || null;
            setSelectedCity(updatedSelectedCity);
            if (updatedSelectedCity) {
                setSelectedCities([updatedSelectedCity]);
            }

            setIsEditModalOpen(false);
            showToast(`"${inputNameClean}" ili (ID: ${newPlate}) düzenlendi ve kaydedildi!`);
        } catch (err) {
            console.error('İl Düzenleme Hatası:', err);
            showToast(`İl güncellenirken bir hata oluştu: ${err.message || err}`, 'error');
        }
    };

    // Cancel Add Modal & Clean Up Map Draft Feature
    const handleCancelAdd = () => {
        if (draftFeatureRef.current && vectorSourceRef.current) {
            try {
                vectorSourceRef.current.removeFeature(draftFeatureRef.current);
            } catch (e) {}
            draftFeatureRef.current = null;
        }
        setIsAddModalOpen(false);
        setFormData({ plate: '', name: '', region: 'Marmara Bölgesi', wkt: '' });
    };

    // Add New City/Region with Strict Unique ID/Name Validation & Automatic Previous Map Backup
    const handleSaveAdd = async () => {
        try {
            if (!formData.name || !formData.name.trim() || !formData.plate) {
                showToast('Lütfen il adı ve plaka kodunu (ID) giriniz!', 'error');
                return;
            }
            const newPlate = parseInt(formData.plate, 10);
            if (isNaN(newPlate) || newPlate <= 0) {
                showToast('Geçersiz plaka kodu / ID! Lütfen pozitif bir sayı giriniz.', 'error');
                return;
            }

            const inputNameClean = formData.name.trim();

            // Rule 1: ID / Plate must be unique across all active cities!
            const duplicatePlateCity = cities.find(c => c.plate === newPlate && !c.isDeleted);
            if (duplicatePlateCity) {
                showToast(`HATA: İki farklı şehir aynı ID'ye (Plaka Kodu: ${newPlate}) sahip olamaz! Bu ID zaten "${duplicatePlateCity.name}" iline ait.`, 'error');
                return;
            }

            // Rule 2: City name must be unique across all active cities!
            const duplicateNameCity = cities.find(c => c.name.toLowerCase() === inputNameClean.toLowerCase() && !c.isDeleted);
            if (duplicateNameCity) {
                showToast(`HATA: "${inputNameClean}" ismi zaten Plaka Kodu ${duplicateNameCity.plate} ile kayıtlı!`, 'error');
                return;
            }

            const wktFormat = new WKT();
            const geojsonFormat = new GeoJSON();
            let parsedGeometry = null;

            if (formData.wkt && formData.wkt.trim()) {
                try {
                    const olFeat = wktFormat.readFeature(formData.wkt.trim());
                    parsedGeometry = geojsonFormat.writeGeometryObject(olFeat.getGeometry());
                } catch (e) {
                    console.warn('WKT ayrıştırma uyarısı:', e);
                }
            }

            // 1. Push current state snapshot to undo stack
            pushStateToUndo(cities);

            // 2. AUTOMATIC MAP BACKUP BEFORE PERSISTING NEW CITY (Take backup of previous map state)
            const currentPublishedRaw = localStorage.getItem(PUBLISHED_STORAGE_KEY);
            const now = new Date();
            const dateStr = now.toLocaleString('tr-TR');
            let updatedBackups = [...backupsList];

            if (currentPublishedRaw) {
                try {
                    const oldData = JSON.parse(currentPublishedRaw);
                    const newBackup = {
                        id: Date.now(),
                        dateStr: oldData.savedAt || dateStr,
                        citiesCount: (oldData.cities || []).filter(c => !c.isDeleted).length,
                        note: `${oldData.savedAt || dateStr} tarihli harita yedeği ("${inputNameClean}" eklenmeden önce)`,
                        cities: oldData.cities || []
                    };
                    updatedBackups = [newBackup, ...updatedBackups].slice(0, 10);
                    setBackupsList(updatedBackups);
                    safeLocalStorageSet(BACKUPS_STORAGE_KEY, JSON.stringify(updatedBackups));
                } catch (bErr) {
                    console.error('Yedek alma hatası:', bErr);
                }
            }

            // 3. Create new city object
            const newCity = {
                id: newPlate,
                plate: newPlate,
                name: inputNameClean,
                region: formData.region,
                wkt: formData.wkt ? formData.wkt.trim() : '',
                geometry: parsedGeometry,
                isActive: true,
                isDeleted: false
            };

            // Clean up draft feature from map if any (applyCitiesToStateAndMap will re-render all features cleanly)
            if (draftFeatureRef.current && vectorSourceRef.current) {
                try {
                    vectorSourceRef.current.removeFeature(draftFeatureRef.current);
                } catch (e) {}
                draftFeatureRef.current = null;
            }

            const updated = [...cities, newCity].sort((a, b) => a.plate - b.plate);
            applyCitiesToStateAndMap(updated);
            savePublishedStateImmediately(updated);

            // 4. Persist to PostgreSQL Database (tbl_city)
            try {
                await adminApi.saveBulkCities(updated, token);
                console.log(`[DB Persist] "${inputNameClean}" ili (ID: ${newPlate}) PostgreSQL tbl_city tablosuna başarıyla kaydedildi.`);
            } catch (dbErr) {
                console.warn('[DB Persist] Veritabanı kaydetme uyarısı:', dbErr);
            }

            // 5. Server disk GeoJSON backup
            try {
                const geoJsonFeatures = updated.filter(c => !c.isDeleted).map(c => {
                    let geomObj = c.geometry;
                    if (!geomObj && c.wkt) {
                        try {
                            const feat = wktFormat.readFeature(c.wkt);
                            geomObj = geojsonFormat.writeFeatureObject(feat).geometry;
                        } catch (e) {}
                    }
                    return {
                        type: 'Feature',
                        properties: {
                            id: c.id || c.plate,
                            plate: c.plate,
                            name: c.name,
                            region: c.region,
                            wkt: c.wkt
                        },
                        geometry: geomObj || null
                    };
                });
                await adminApi.backupCities({ type: 'FeatureCollection', features: geoJsonFeatures });
            } catch (e) {
                console.warn('[Disk Persist] Sunucu disk yedeği oluşturma uyarısı:', e);
            }

            setIsAddModalOpen(false);
            setFormData({ plate: '', name: '', region: 'Marmara Bölgesi', wkt: '' });
            showToast(`"${inputNameClean}" ili (ID / Plaka: ${newPlate}) önceki harita yedeği de alınarak veritabanına başarıyla kaydedildi!`);
        } catch (err) {
            console.error('İl Ekleme Hatası:', err);
            showToast(`İl eklenirken hata oluştu: ${err.message || err}`, 'error');
        }
    };

    // Export GeoJSON
    const handleExportGeoJSON = () => {
        try {
            const format = new GeoJSON();
            const activeCities = cities.filter(c => !c.isDeleted);
            const features = activeCities.map(c => ({
                type: 'Feature',
                geometry: c.geometry || null,
                properties: {
                    plate: c.plate,
                    number: c.plate,
                    name: c.name,
                    region: c.region,
                    wkt: c.wkt
                }
            }));
            const geojsonObj = { type: 'FeatureCollection', features };
            const blob = new Blob([JSON.stringify(geojsonObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `turkey-cities-admin-export-${Date.now()}.geojson`;
            a.click();
            showToast('Tüm aktif şehir ve bölge katmanı GeoJSON olarak indirildi!');
        } catch (err) {
            console.error('Dışa Aktarma Hatası:', err);
            showToast('GeoJSON dosyası indirilirken hata oluştu.', 'error');
        }
    };

    return (
        <div className="geo-mgmt-container compact-mode">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`admin-toast ${toastMessage.type}`}>
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Header / Actions Bar */}
            <div className="geo-header compact-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 className="geo-title compact-title">{isTr ? 'Şehir & Coğrafi Bölge Sınır Yönetimi' : 'City & Region Boundary Management'}</h2>
                        {hasUnsavedChanges ? (
                            <span className="status-badge unsaved-badge">{isTr ? 'Değişiklikler Var' : 'Unsaved Changes'}</span>
                        ) : (
                            <span className="status-badge saved-badge">{isTr ? 'Kaydedildi' : 'Saved'}</span>
                        )}
                    </div>
                    <p className="geo-subtitle compact-sub">
                        {isTr ? 'Son Kayıt:' : 'Last Saved:'} {lastSavedDate || (isTr ? 'İlk Kurulum' : 'Initial Setup')}
                    </p>
                </div>

                <div className="geo-actions compact-actions">
                    {/* COMPACT EXPLICIT SAVE BUTTON */}
                    <button
                        className={`btn btn-sm ${hasUnsavedChanges ? 'btn-save-highlight' : 'btn-secondary'}`}
                        onClick={handleSaveChanges}
                        title={isTr ? "Tüm Yapılan Poligon ve Şehir Değişikliklerini Kalıcı Varsayılan Yap ve Kaydet" : "Save All Polygon and City Changes as Permanent Default"}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        <span>{isTr ? 'Değişiklikleri Kaydet' : 'Save Changes'}</span>
                    </button>

                    {/* COMPACT BACKUP HISTORY BUTTON */}
                    {/* COMPACT BACKUP HISTORY BUTTON */}
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsBackupModalOpen(true)}
                        title={isTr ? "Eski Kaydedilmiş Sürüm Yedeği Geçmişini İncele" : "Review Backup Version History"}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                        <span>{isTr ? 'Yedek Geçmişi' : 'Backup History'} ({backupsList.length})</span>
                    </button>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleResetAllData}
                        title={isTr ? "Tüm Yapılan Değişiklikleri Orijinaline Sıfırla" : "Reset All Changes to Original Defaults"}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        <span>{isTr ? 'Sıfırla' : 'Reset'}</span>
                    </button>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
                        title={isTr ? "Sağ İl Listesi Panelini Aç/Kapat" : "Toggle Province List Panel"}
                    >
                        <span>{isRightDrawerOpen ? (isTr ? 'Panel Gizle' : 'Hide Panel') : (isTr ? 'Panel Aç' : 'Open Panel')}</span>
                    </button>

                    {toggleTheme && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={toggleTheme}
                            title={isDarkMode ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
                        >
                            {isDarkMode ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            )}
                            <span>{isDarkMode ? 'Aydınlık Mod' : 'Koyu Mod'}</span>
                        </button>
                    )}

                    <button className="btn btn-secondary btn-sm" onClick={handleExportGeoJSON} title="GeoJSON Dışa Aktar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Dışa Aktar</span>
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => {
                        const activeCities = (cities || []).filter(c => !c.isDeleted);
                        const maxPlate = Math.max(0, ...activeCities.map(c => Number(c.plate) || 0));
                        setFormData({ plate: (maxPlate + 1).toString(), name: '', region: 'Marmara Bölgesi', wkt: '' });
                        setIsAddModalOpen(true);
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Yeni İl Ekle</span>
                    </button>
                </div>
            </div>

            {/* Main Layout: Full Screen Large Map + Collapsible Right Side Drawer */}
            <div className={`geo-main-grid-large ${isRightDrawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
                {/* Full Screen Interactive Map Container */}
                <div className="geo-map-wrapper-full">
                    
                    {/* TOP FLOATING NOTIFICATION BANNER INSIDE MAP VIEWPORT */}
                    {selectedCities.length > 0 && (
                        <div className="geo-top-alert-banner compact-banner">
                            <div className="alert-banner-content">
                                <div className="banner-text">
                                    <strong>SEÇİLİ İLLER ({selectedCities.length}):</strong>{' '}
                                    {selectedCities.map(c => `[${c.plate.toString().padStart(2, '0')}] ${c.name}`).join(', ')}
                                </div>
                            </div>
                            <div className="banner-actions">
                                {selectedCities.length >= 2 && (
                                    <button className="banner-btn btn-merge btn-sm-action" onClick={handleMergeSelectedPolygons}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                        <span>2. İli 1. İle Bağla</span>
                                    </button>
                                )}
                                <button className="banner-btn btn-clear btn-sm-action" onClick={handleClearSelection} title="Seçimi Temizle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* EXACT FLOATING TOOLBAR STYLED LIKE THE UPLOADED IMAGE */}
                    <div className="map-toolbar-exact-wrapper">
                        {/* TOP CONTAINER: BLUE ZOOM BUTTONS (+) & (-) */}
                        <div className="toolbar-zoom-card">
                            <button className="zoom-btn-exact" onClick={handleZoomIn} title="Yakınlaştır (+)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                            <div className="zoom-divider-exact" />
                            <button className="zoom-btn-exact" onClick={handleZoomOut} title="Uzaklaştır (-)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>

                        {/* BOTTOM CONTAINER: WHITE CARD WITH SLEEK SVG TOOL BUTTONS */}
                        <div className="toolbar-tools-card">
                            {/* GOOGLE MAPS & CUSTOM BASEMAP LAYER SWITCHER */}
                            <MapLayerSwitcher
                                selectedLayerId={selectedBaseLayer}
                                onSelectLayer={handleSelectBaseLayer}
                                direction="left"
                            />

                            <div className="toolbar-inner-divider" style={{ width: '100%', height: '1px', background: '#e2e8f0', margin: '3px 0' }} />

                            {/* POLYGON DRAW/MODIFY ICON */}
                            <button
                                className={`tool-btn-exact dark-style ${activeMapTool === 'draw' ? 'active' : ''}`}
                                onClick={() => toggleMapTool(activeMapTool === 'draw' ? 'modify' : 'draw')}
                                title="Poligon Çiz / Değiştir"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
                                </svg>
                            </button>

                            {/* LOCATION PIN / MODIFY VERTEX ICON */}
                            <button
                                className={`tool-btn-exact dark-style ${activeMapTool === 'modify' ? 'active' : ''}`}
                                onClick={() => toggleMapTool('modify')}
                                title="Sınır Noktalarını Düzenle"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </button>

                            {/* RED ERASE BY SELECTION POLYGON ICON */}
                            <button
                                className={`tool-btn-exact red-style ${activeMapTool === 'erase_selection' ? 'active' : ''}`}
                                onClick={() => toggleMapTool(activeMapTool === 'erase_selection' ? 'modify' : 'erase_selection')}
                                title="Poligon Çizerek Seçili Alanı Sil (Erase Area by Selection)"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>


                            {/* UNDO ICON */}
                            <button
                                className="tool-btn-exact grey-style"
                                onClick={handleUndo}
                                disabled={undoStack.length === 0}
                                title="Geri Al (Undo)"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 14 4 9 9 4" />
                                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                </svg>
                            </button>

                            {/* REDO ICON */}
                            <button
                                className="tool-btn-exact grey-style"
                                onClick={handleRedo}
                                disabled={redoStack.length === 0}
                                title="İleri Al (Redo)"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 14 20 9 15 4" />
                                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div ref={mapElementRef} className="geo-map-element-full" />
                </div>

                {/* SIMPLIFIED COMPACT RIGHT SIDE DRAWER - NO CHECKBOXES */}
                {isRightDrawerOpen && (
                    <div className="geo-right-drawer compact-drawer">
                        <div className="drawer-header compact-drawer-header">
                            <span>İLLER LİSTESİ ({filteredCities.length})</span>
                            <button className="drawer-close-btn" onClick={() => setIsRightDrawerOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }} title="Kapat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="geo-filter-bar compact-filter-bar">
                            <div style={{ position: 'relative', flex: 1.5, display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Şehir veya Plaka..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="geo-search-input compact-search"
                                    style={{ width: '100%', paddingRight: searchQuery ? '24px' : '10px' }}
                                />
                                {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            style={{
                                                position: 'absolute',
                                                right: '6px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Aramayı Temizle"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                )}
                            </div>

                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className="geo-region-select compact-select"
                            >
                                <option value="ALL">Bölgeler (Tümü)</option>
                                <option value="NONE">Bölgesiz / Belirtilmemiş</option>
                                {availableRegions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="geo-region-select compact-select"
                            >
                                <option value="ACTIVE">Aktifler</option>
                                <option value="DELETED">Silinenler</option>
                                <option value="ALL">Tümü</option>
                            </select>
                        </div>

                        <div className="geo-table-container compact-table-container">
                            <table className="geo-table compact-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '38px' }}>Plk</th>
                                        <th>İl Adı</th>
                                        <th>Bölge</th>
                                        <th style={{ width: '50px' }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCities.map(city => {
                                        const isSelected = selectedCities.some(c => c.plate === city.plate);
                                        const isPrimary = selectedCity && selectedCity.plate === city.plate;

                                        return (
                                            <tr
                                                key={city.plate}
                                                className={`${isSelected ? 'row-selected' : ''} ${isPrimary ? 'row-primary' : ''} ${city.isDeleted ? 'row-deleted' : ''}`}
                                                onClick={(e) => !city.isDeleted && handleCityClick(city, e.shiftKey, true)}
                                            >
                                                <td><span className="plate-badge compact-badge">{city.plate.toString().padStart(2, '0')}</span></td>
                                                <td className="city-name compact-city">
                                                    {city.name}
                                                </td>
                                                <td><span className="region-tag compact-tag">{city.region || 'Belirtilmemiş'}</span></td>
                                                <td>
                                                    <div className="row-actions compact-row-actions">
                                                        {city.isDeleted ? (
                                                            <button
                                                                className="icon-btn restore-btn compact-icon"
                                                                title="Geri Yükle"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRestoreCity(city);
                                                                }}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 2v6h6"/><path d="M2.66 15.57a10 10 0 1 0 1.94-10.56L2.5 8"/></svg>
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="icon-btn edit-btn compact-icon"
                                                                    title="Düzenle"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedCity(city);
                                                                        setFormData({
                                                                            plate: city.plate.toString(),
                                                                            name: city.name,
                                                                            region: city.region,
                                                                            wkt: city.wkt || ''
                                                                        });
                                                                        setIsEditModalOpen(true);
                                                                    }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                                </button>
                                                                <button
                                                                    className="icon-btn delete-btn compact-icon"
                                                                    title="Kalıcı Sil (Soft Delete)"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSoftDeleteCity(city);
                                                                    }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Backup History (Yedek Geçmişi) */}
            {isBackupModalOpen && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content" style={{ maxWidth: '650px' }}>
                        <h3>Harita Versiyon Yedeği Geçmişi</h3>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px' }}>
                            Daha önce "Değişiklikleri Kaydet" butonuna her bastığınızda eski harita sürümleri otomatik olarak yedeklenir. İstediğiniz sürümü tek tıkla geri yükleyebilirsiniz.
                        </p>

                        <div className="backup-list-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                            {backupsList.length === 0 ? (
                                <div style={{ padding: '20px', textAlgin: 'center', color: '#64748b' }}>
                                    Henüz geçmiş bir harita yedeği bulunmuyor.
                                </div>
                            ) : (
                                backupsList.map((b, idx) => (
                                    <div
                                        key={b.id || idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            marginBottom: '8px',
                                            backgroundColor: '#1e293b',
                                            borderRadius: '8px',
                                            border: '1px solid #334155'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '14px' }}>
                                                {b.dateStr}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                                {b.note || 'Otomatik Harita Yedeği'} ({b.citiesCount || 81} Aktif İl)
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                                onClick={() => handleRestoreBackup(b)}
                                            >
                                                Bu Yedeği Yükle
                                            </button>
                                            <button
                                                className="icon-btn delete-btn compact-icon"
                                                title="Yedeği Sil"
                                                onClick={() => handleDeleteBackup(b.id)}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="modal-footer" style={{ marginTop: '20px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setIsBackupModalOpen(false)}>Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit City */}
            {isEditModalOpen && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content">
                        <h3>İl / Bölge Düzenle: {formData.name}</h3>
                        <div className="form-group">
                            <label>Plaka Kodu (Değiştirilebilir):</label>
                            <input
                                type="number"
                                value={formData.plate}
                                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                className="form-control"
                                placeholder="Plaka Kodu"
                            />
                        </div>
                        <div className="form-group">
                            <label>İl Adı:</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="form-control"
                            />
                        </div>
                        <div className="form-group">
                            <label>Coğrafi Bölge (İsteğe Bağlı):</label>
                            <input
                                type="text"
                                list="region-options-list-edit"
                                value={formData.region || ''}
                                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                className="form-control"
                                placeholder="Listeden seçin veya yeni bölge adı yazın..."
                            />
                            <datalist id="region-options-list-edit">
                                {availableRegions.map(r => (
                                    <option key={r} value={r} />
                                ))}
                            </datalist>
                            <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                İsteğe bağlıdır. Mevcut bölgelerden seçebilir veya doğrudan yeni bir bölge ismi yazabilirsiniz.
                            </small>
                        </div>
                        <div className="form-group">
                            <label>Sınır WKT Dizgisi (Well-Known Text):</label>
                            <textarea
                                rows="4"
                                value={formData.wkt}
                                onChange={(e) => setFormData({ ...formData, wkt: e.target.value })}
                                className="form-control code-text"
                                placeholder="POLYGON((lon lat, ...))"
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(false)}>İptal</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Değişiklikleri Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add New City */}
            {isAddModalOpen && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content">
                        <h3>{formData.wkt ? 'Yeni İl / Bölge Poligonunu Kaydet' : 'Yeni İl / Bölge Ekle'}</h3>
                        <div className="form-group">
                            <label>Plaka Kodu / ID (Benzersiz Olmalıdır):</label>
                            <input
                                type="number"
                                value={formData.plate}
                                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                className="form-control"
                                placeholder="Örn: 82"
                            />
                            <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                Not: Bu ID diğer kayıtlı illerle aynı olamaz.
                            </small>
                        </div>
                        <div className="form-group">
                            <label>İl Adı:</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="form-control"
                                placeholder="Örn: Yalova"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Coğrafi Bölge (İsteğe Bağlı):</label>
                            <input
                                type="text"
                                list="region-options-list-add"
                                value={formData.region || ''}
                                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                className="form-control"
                                placeholder="Listeden seçin veya yeni bölge adı yazın..."
                            />
                            <datalist id="region-options-list-add">
                                {availableRegions.map(r => (
                                    <option key={r} value={r} />
                                ))}
                            </datalist>
                            <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                İsteğe bağlıdır. Mevcut bölgelerden seçebilir veya doğrudan yeni bir bölge ismi yazabilirsiniz.
                            </small>
                        </div>
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label style={{ margin: 0 }}>Sınır WKT Poligonu:</label>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '11px', padding: '3px 8px' }}
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        toggleMapTool('draw');
                                    }}
                                >
                                    Haritada Çiz
                                </button>
                            </div>
                            <textarea
                                rows="3"
                                value={formData.wkt}
                                onChange={(e) => setFormData({ ...formData, wkt: e.target.value })}
                                className="form-control code-text"
                                placeholder="Haritadan çizebilir veya WKT yapıştırabilirsiniz: POLYGON((32.8 39.9, ...))"
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={handleCancelAdd}>İptal</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveAdd}>İli Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
