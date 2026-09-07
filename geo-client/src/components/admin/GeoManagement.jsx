import React, { useState, useEffect, useRef, useMemo } from 'react';
import OLMap from 'ol/Map';
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
import Snap from 'ol/interaction/Snap';
import Collection from 'ol/Collection';
import { Style, Stroke, Fill, Text } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';

import * as turf from '@turf/turf';
import { adminApi } from '../../services/adminApi';
import { BASEMAP_LAYERS, getBasemapConfig } from '../../constants/mapLayers';
import { MapLayerSwitcher } from '../common/MapLayerSwitcher';
import { HistoricalTimelineSlider } from '../common/HistoricalTimelineSlider';
import { calculateGeometryMetrics } from '../../utils/geometryUtils';

// Safe helper to parse WKT into OpenLayers feature
const EditIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

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

const PUBLISHED_STORAGE_KEY = 'admin_turkey_cities_published_v38';
const MARITIME_STORAGE_KEY = 'admin_turkey_maritime_published_v38';
const BACKUPS_STORAGE_KEY = 'admin_turkey_cities_backups_v38';
const DELETED_PLATES_KEY = 'admin_deleted_plates_v38';

// Purge all old legacy storage keys to eliminate any incomplete/corrupt saved payloads
const purgeAllLegacyStorageKeys = () => {
    const KEYS_TO_PURGE = [
        'admin_turkey_cities_published_v37',
        'admin_turkey_maritime_published_v37',
        'admin_turkey_cities_backups_v37',
        'admin_deleted_plates_v37',
        'admin_turkey_cities_published_v36',
        'admin_deleted_plates_v36',
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
    const [maritimeZones, setMaritimeZones] = useState([]);
    const [filteredCities, setFilteredCities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'DELETED'
    const [geoEntityFilter, setGeoEntityFilter] = useState('ALL'); // 'ALL' | 'LAND' | 'MARITIME'
    
    // Save & Backup state management
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastSavedDate, setLastSavedDate] = useState(null);
    const [backupsList, setBackupsList] = useState([]);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

    // Side Panel Collapsible Drawer State
    const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);

    // Single & Multi Selection State
    const [selectedCity, setSelectedCity] = useState(null);
    const selectedCityRef = useRef(selectedCity);
    useEffect(() => {
        selectedCityRef.current = selectedCity;
    }, [selectedCity]);

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
        const layerConfig = getBasemapConfig(layerId);
        if (baseTileLayerRef.current) {
            baseTileLayerRef.current.setSource(
                new XYZ({
                    url: layerConfig.url,
                    crossOrigin: 'anonymous',
                    maxZoom: layerConfig.maxZoom || 19
                })
            );
        }
    };

    const mapRef = useRef(null);
    const mapElementRef = useRef(null);
    const vectorSourceRef = useRef(null);
    const modifyInteractionRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const snapInteractionRef = useRef(null);
    const draftFeatureRef = useRef(null);
    const citiesRef = useRef(cities);

    // Deniz Sınırları & Kıyı Şeritleri (Maritime Coastal Boundaries) Katmanı
    const [showMaritimeLayer, setShowMaritimeLayer] = useState(true);
    const maritimeVectorSourceRef = useRef(null);
    const maritimeVectorLayerRef = useRef(null);

    // Sınır Düzenleme Modu (Sağdaki il paneli listesindeki "Sınır Düzenle" butonuna tıklandığında açılır)
    const [editingBoundaryCity, setEditingBoundaryCity] = useState(null);
    const editingVectorSourceRef = useRef(null);
    const editingVectorLayerRef = useRef(null);

    // Shift tuşu basılı olma durumu (Komşu il sınırlarına hassas yapışma / Snapping için)
    const [isShiftDown, setIsShiftDown] = useState(false);
    // Sınır Düzenleme Hedef Katmanı ('LAND': Sadece İller, 'MARITIME': Sadece Denizler)
    const [modifyTargetType, setModifyTargetType] = useState('LAND');
    const modifyTargetTypeRef = useRef(modifyTargetType);
    const geoEntityFilterRef = useRef(geoEntityFilter);
    const maritimeZonesRef = useRef(maritimeZones);

    useEffect(() => {
        modifyTargetTypeRef.current = modifyTargetType;
    }, [modifyTargetType]);

    useEffect(() => {
        geoEntityFilterRef.current = geoEntityFilter;
    }, [geoEntityFilter]);

    useEffect(() => {
        maritimeZonesRef.current = maritimeZones;
    }, [maritimeZones]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') {
                setIsShiftDown(true);
            }
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
                setIsShiftDown(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Shift tuşuna basıldığında hem il hem deniz poligon köşe noktalarına yapışmayı (Snap) dinamik olarak etkinleştir/kaldır
    useEffect(() => {
        if (!mapRef.current || !vectorSourceRef.current) return;

        if (snapInteractionRef.current) {
            mapRef.current.removeInteraction(snapInteractionRef.current);
            snapInteractionRef.current = null;
        }

        if (isShiftDown) {
            const snapFeatures = new Collection();
            if (vectorSourceRef.current) {
                snapFeatures.extend(vectorSourceRef.current.getFeatures());
            }
            if (maritimeVectorSourceRef.current) {
                snapFeatures.extend(maritimeVectorSourceRef.current.getFeatures());
            }

            const snap = new Snap({
                features: snapFeatures,
                pixelTolerance: 18,
                edge: false,
                vertex: true
            });
            mapRef.current.addInteraction(snap);
            snapInteractionRef.current = snap;
        }
    }, [isShiftDown]);

    // Sınır Noktalarını Düzenle (Modify) Aracı:
    // Deniz ve il poligonları birbirinden bağımsızdır; seçilen türe göre SADECE ilgili katman düzenlenir.
    useEffect(() => {
        if (!mapRef.current || !vectorSourceRef.current) return;

        if (modifyInteractionRef.current) {
            mapRef.current.removeInteraction(modifyInteractionRef.current);
            modifyInteractionRef.current = null;
        }

        if (activeMapTool === 'modify') {
            const modifyFeatures = new Collection();

            // 1. Öncelik: Eğer tekil bir il veya deniz seçilmişse, SADECE o varlığın poligonunu düzenle
            if (selectedCity) {
                if (selectedCity.isMaritime && maritimeVectorSourceRef.current) {
                    const feat = maritimeVectorSourceRef.current.getFeatures().find(f => 
                        f.get('plate') === selectedCity.plate || f.get('id') === selectedCity.id || f.get('name') === selectedCity.name
                    );
                    if (feat) modifyFeatures.push(feat);
                } else if (vectorSourceRef.current) {
                    const feat = vectorSourceRef.current.getFeatures().find(f => 
                        f.get('plate') === selectedCity.plate || f.get('name') === selectedCity.name
                    );
                    if (feat) modifyFeatures.push(feat);
                }
            } else {
                // 2. Mod Seçimi (İl vs Deniz): Çakışan kıyı noktalarında birini sürüklerken diğerinin bozulmasını engeller
                const isMaritimeActive = modifyTargetType === 'MARITIME' || (modifyTargetType === 'AUTO' && geoEntityFilter === 'MARITIME');

                if (isMaritimeActive && maritimeVectorSourceRef.current) {
                    // YALNIZCA DENİZ ALANLARI DÜZENLENİR (Kara illeri asla etkilenmez)
                    modifyFeatures.extend(maritimeVectorSourceRef.current.getFeatures());
                } else if (vectorSourceRef.current) {
                    // YALNIZCA KARA İLLERİ DÜZENLENİR (Deniz alanları asla etkilenmez)
                    modifyFeatures.extend(vectorSourceRef.current.getFeatures());
                }
            }

            const modify = new Modify({
                features: modifyFeatures,
                pixelTolerance: 14,
                insertVertexCondition: () => true,
                deleteCondition: (e) => e.originalEvent.altKey
            });

            modify.on('modifystart', () => {
                pushStateToUndo(citiesRef.current, maritimeZonesRef.current);
            });

            modify.on('modifyend', (evt) => {
                try {
                    const modifiedFeatures = evt.features.getArray();
                    const wktFormat = new WKT();
                    const geojsonFormat = new GeoJSON();

                    modifiedFeatures.forEach(feat => {
                        const isMaritime = feat.get('isMaritime') || (feat.get('plate') >= 900);
                        const plate = feat.get('plate');
                        const name = feat.get('name');
                        const id = feat.get('id');

                        const clonedGeom = feat.getGeometry().clone();
                        clonedGeom.transform('EPSG:3857', 'EPSG:4326');
                        const newWkt = wktFormat.writeGeometry(clonedGeom);
                        const geojsonObj = geojsonFormat.writeFeatureObject(new Feature({ geometry: clonedGeom }), {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:4326'
                        });

                        if (isMaritime) {
                            setMaritimeZones(prev => {
                                const updated = prev.map(m => {
                                    if (m.plate === plate || m.id === id || m.name === name) {
                                        return { ...m, wkt: newWkt, geometry: geojsonObj.geometry };
                                    }
                                    return m;
                                });
                                savePublishedMaritimeImmediately(updated);
                                return updated;
                            });
                            showToast(`"${name}" deniz alanının sınır köşe noktaları güncellendi ve kaydedildi!`);
                        } else {
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
                            showToast(`"${name}" ilinin sınır köşe noktaları güncellendi ve kaydedildi!`);
                        }
                    });
                } catch (err) {
                    console.error('Sınır Düzenleme Hatası:', err);
                    showToast('Poligon sınırı güncellenirken hata oluştu.', 'error');
                }
            });

            mapRef.current.addInteraction(modify);
            modifyInteractionRef.current = modify;
        }
    }, [activeMapTool, selectedCity, geoEntityFilter, modifyTargetType]);

    // Keep citiesRef continuously synchronized with latest cities state
    useEffect(() => {
        citiesRef.current = cities;
    }, [cities]);

    // Push state snapshot to undo stack (captures BOTH land cities and maritime zones)
    const pushStateToUndo = (currentCities, currentMaritime) => {
        const snapshot = {
            cities: currentCities || citiesRef.current || [],
            maritime: currentMaritime || maritimeZonesRef.current || []
        };
        setUndoStack(prev => [...prev.slice(-20), JSON.stringify(snapshot)]);
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
            window.dispatchEvent(new CustomEvent('geomap_boundaries_updated'));
        } catch (err) {
            console.error('Kalıcı Kayıt Hatası:', err);
        }
    };

    // Helper: Save published maritime state immediately
    const savePublishedMaritimeImmediately = (updatedMaritimeList) => {
        try {
            const nowStr = new Date().toLocaleString('tr-TR');
            const geojsonFormat = new GeoJSON();
            const wktFormat = new WKT();
            const compact = (updatedMaritimeList || []).map(m => {
                let wktStr = m.wkt || '';
                if (!wktStr && m.geometry) {
                    try {
                        const feat = geojsonFormat.readFeature({ type: 'Feature', geometry: m.geometry });
                        wktStr = wktFormat.writeGeometry(feat.getGeometry());
                    } catch (e) {}
                }
                return {
                    ...m,
                    isDeleted: !!m.isDeleted,
                    wkt: m.isDeleted ? '' : wktStr,
                    geometry: m.isDeleted ? null : m.geometry
                };
            });
            const payloadStr = JSON.stringify({
                maritimeZones: compact,
                savedAt: nowStr
            });
            safeLocalStorageSet(MARITIME_STORAGE_KEY, payloadStr);
            setHasUnsavedChanges(false);
            window.dispatchEvent(new CustomEvent('geomap_boundaries_updated'));
        } catch (err) {
            console.error('Deniz Alanları Kalıcı Kayıt Hatası:', err);
        }
    };

    // Helper: Deniz Yetki Alanlarını Yükleme ve Senkronize Etme
    const loadMaritimeData = async (dbMaritime = []) => {
        const geojsonFormat = new GeoJSON();
        const wktFmt = new WKT();
        let hydratedZones = [];

        // 1. Önce LocalStorage (MARITIME_STORAGE_KEY) kontrol et
        const savedMaritimeRaw = localStorage.getItem(MARITIME_STORAGE_KEY);
        if (savedMaritimeRaw) {
            try {
                const parsed = JSON.parse(savedMaritimeRaw);
                const list = parsed?.maritimeZones || parsed?.zones || (Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(list) && list.length > 0) {
                    hydratedZones = list.map(m => {
                        let geom = m.geometry || null;
                        let wktStr = m.wkt || '';
                        if (!geom && wktStr && !m.isDeleted) {
                            try {
                                const feat = wktFmt.readFeature(wktStr);
                                geom = geojsonFormat.writeFeatureObject(feat).geometry;
                            } catch (e) {}
                        }
                        if (geom && !wktStr && !m.isDeleted) {
                            try {
                                const feat = geojsonFormat.readFeature({ type: 'Feature', geometry: geom });
                                wktStr = wktFmt.writeGeometry(feat.getGeometry());
                            } catch (e) {}
                        }
                        return {
                            ...m,
                            id: m.id || `MAR-${m.plate || Math.floor(Math.random() * 1000)}`,
                            plate: m.plate || 900,
                            name: m.name || m.zoneName || 'Deniz Yetki Alanı',
                            sea: m.sea || m.region || 'Karasuları',
                            region: m.region || m.sea || 'Deniz Yetki Alanı',
                            isDeleted: !!m.isDeleted,
                            wkt: m.isDeleted ? '' : wktStr,
                            geometry: m.isDeleted ? null : geom,
                            isMaritime: true
                        };
                    });
                }
            } catch (e) {
                console.warn('Maritime storage okuma hatası:', e);
            }
        }

        // 2. DB'den gelen maritime varsa birleştir (Plaka, ID ve isme göre çiftlemeyi engelle)
        if (Array.isArray(dbMaritime) && dbMaritime.length > 0) {
            const existingKeys = new Set();
            hydratedZones.forEach(z => {
                if (z.id) existingKeys.add(String(z.id));
                if (z.plate) existingKeys.add(String(z.plate));
                if (z.name) existingKeys.add(z.name.toLowerCase().trim());
            });

            dbMaritime.forEach(dm => {
                const isDup = existingKeys.has(String(dm.id)) ||
                              existingKeys.has(String(dm.plate)) ||
                              (dm.name && existingKeys.has(dm.name.toLowerCase().trim()));
                if (!isDup) {
                    hydratedZones.push(dm);
                    if (dm.id) existingKeys.add(String(dm.id));
                    if (dm.plate) existingKeys.add(String(dm.plate));
                    if (dm.name) existingKeys.add(dm.name.toLowerCase().trim());
                }
            });
        }

        // 3. Eğer hala boşsa, turkey-coastal-maritime.json'dan yükle
        if (hydratedZones.length === 0) {
            try {
                const res = await fetch(`/data/turkey-coastal-maritime.json?v=${Date.now()}`);
                const data = await res.json();
                if (data && data.features) {
                    hydratedZones = data.features.map((f, idx) => {
                        const props = f.properties || {};
                        let wktStr = props.wkt || '';
                        if (!wktStr && f.geometry) {
                            try {
                                const olFeat = geojsonFormat.readFeature(f);
                                wktStr = wktFmt.writeGeometry(olFeat.getGeometry());
                            } catch (e) {}
                        }
                        return {
                            id: props.id || `MAR-${901 + idx}`,
                            plate: props.plate || (901 + idx),
                            name: props.name || props.zoneName || `Deniz Alanı ${idx + 1}`,
                            sea: props.sea || props.region || 'Akdeniz',
                            region: props.region || props.sea || 'Akdeniz',
                            areaKm2: props.areaKm2 || 25000,
                            coastlineKm: props.coastlineKm || 200,
                            coastalProvinces: props.coastalProvinces || [],
                            majorPorts: props.majorPorts || [],
                            description: props.description || '',
                            color: props.color || '#0284c7',
                            fillColor: props.fillColor || 'rgba(2, 132, 199, 0.18)',
                            strokeColor: props.strokeColor || '#0284c7',
                            wkt: wktStr,
                            geometry: f.geometry,
                            isActive: true,
                            isDeleted: false,
                            isMaritime: true
                        };
                    });
                }
            } catch (e) {
                console.warn('Maritime JSON okuma hatası:', e);
            }
        }

        if (hydratedZones.length > 0) {
            setMaritimeZones(hydratedZones);
            updateMaritimeVectorFeatures(hydratedZones);
        }
        return hydratedZones;
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
            .then(async dbCities => {
                if (dbCities && Array.isArray(dbCities) && dbCities.length > 0) {
                    const loadedCities = [];
                    const loadedMaritime = [];

                    dbCities.forEach(c => {
                        let geomObj = null;
                        if (c.wkt) {
                            try {
                                const feat = wktFormat.readFeature(c.wkt);
                                geomObj = geojsonFormat.writeFeatureObject(feat).geometry;
                            } catch (e) {}
                        }

                        // Plaka 1..81 olan iller ASLA deniz değildir; illerdir.
                        const isMaritimeItem = (c.isMaritime === true || (typeof c.plate === 'number' && c.plate >= 900) || (typeof c.id === 'string' && c.id.startsWith('MAR-')) || c.region === 'Deniz Yetki Alanı') && (c.plate > 81);

                        if (isMaritimeItem) {
                            loadedMaritime.push({
                                id: c.id || `MAR-${c.plate}`,
                                plate: c.plate,
                                name: c.name,
                                region: c.region || 'Deniz Yetki Alanı',
                                sea: c.region || 'Karasuları',
                                wkt: c.wkt,
                                geometry: geomObj,
                                isActive: c.isActive !== false,
                                isDeleted: c.isDeleted === true,
                                isMaritime: true
                            });
                        } else {
                            loadedCities.push({
                                id: c.id || c.plate,
                                plate: c.plate,
                                name: c.name,
                                region: c.region,
                                wkt: c.wkt,
                                geometry: geomObj,
                                isActive: c.isActive !== false,
                                isDeleted: c.isDeleted === true,
                                isMaritime: false
                            });
                        }
                    });

                    loadedCities.sort((a, b) => a.plate - b.plate);
                    applyCitiesToStateAndMap(loadedCities);
                    setFilteredCities(loadedCities);

                    await loadMaritimeData(loadedMaritime);

                    setHasUnsavedChanges(false);
                    console.log(`[GeoManagement] ${loadedCities.length} adet il ve deniz yetki alanları başarıyla yüklendi.`);
                    return;
                }
                throw new Error('Database empty, fallback to JSON');
            })
            .catch(async () => {
                // 2. Fallback to turkey-cities.json if DB is empty or offline
                await loadMaritimeData();
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

    // Update OpenLayers Map Maritime Features with Unique IDs for every sea zone
    const updateMaritimeVectorFeatures = (updatedMaritime) => {
        if (!maritimeVectorSourceRef.current) return;
        maritimeVectorSourceRef.current.clear();

        const activeMaritime = (updatedMaritime || []).filter(m => !m.isDeleted);
        const format = new GeoJSON();
        const wktFormat = new WKT();

        const features = activeMaritime.map((m, idx) => {
            if (!m.geometry && !m.wkt) return null;
            try {
                let feat = null;
                const uniqueId = m.id || (m.plate ? `MAR-${m.plate}` : `mar_${idx + 1}`);

                if (m.geometry) {
                    feat = format.readFeature({
                        type: 'Feature',
                        geometry: m.geometry,
                        properties: {
                            id: uniqueId,
                            plate: m.plate,
                            name: m.name,
                            sea: m.sea || m.region,
                            region: m.region,
                            wkt: m.wkt,
                            isMaritime: true
                        }
                    }, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                } else if (m.wkt) {
                    feat = wktFormat.readFeature(m.wkt, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    feat.set('id', uniqueId);
                    feat.set('plate', m.plate);
                    feat.set('name', m.name);
                    feat.set('sea', m.sea || m.region);
                    feat.set('region', m.region);
                    feat.set('wkt', m.wkt);
                    feat.set('isMaritime', true);
                }

                if (feat) {
                    feat.setId(uniqueId);
                }
                return feat;
            } catch (e) {
                console.warn('Maritime feature render hatası:', e);
                return null;
            }
        }).filter(Boolean);

        maritimeVectorSourceRef.current.addFeatures(features);
    };

    // Guarantee map features are ALWAYS rendered on OpenLayers maritime vector source whenever maritimeZones state updates
    useEffect(() => {
        if (maritimeVectorSourceRef.current && maritimeZones.length > 0) {
            updateMaritimeVectorFeatures(maritimeZones);
        }
    }, [maritimeZones]);

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

            // 1.b Extract live maritime geometries directly from canvas
            let liveMaritimeMap = new Map();
            if (maritimeVectorSourceRef.current) {
                const mFeatures = maritimeVectorSourceRef.current.getFeatures();
                mFeatures.forEach(feat => {
                    const plate = feat.get('plate');
                    const name = feat.get('name');
                    const id = feat.get('id');
                    if (feat.getGeometry()) {
                        const clonedGeom = feat.getGeometry().clone();
                        clonedGeom.transform('EPSG:3857', 'EPSG:4326');
                        const wktStr = wktFormat.writeGeometry(clonedGeom);
                        const geojsonObj = geojsonFormat.writeFeatureObject(new Feature({ geometry: clonedGeom }), {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:4326'
                        });
                        liveMaritimeMap.set(plate || id || name, { wkt: wktStr, geometry: geojsonObj.geometry });
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

            const syncedMaritime = maritimeZones.map(m => {
                const liveData = liveMaritimeMap.get(m.plate) || liveMaritimeMap.get(m.id) || liveMaritimeMap.get(m.name);
                if (liveData && !m.isDeleted) {
                    return {
                        ...m,
                        wkt: liveData.wkt || m.wkt,
                        geometry: liveData.geometry || m.geometry
                    };
                }
                return m;
            });

            setCities(syncedCities);
            setMaritimeZones(syncedMaritime);
            savePublishedMaritimeImmediately(syncedMaritime);

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
                const allEntitiesToSave = [
                    ...syncedCities,
                    ...syncedMaritime.map(m => ({
                        id: m.id || m.plate,
                        plate: m.plate,
                        name: m.name,
                        region: m.sea || m.region || 'Deniz Yetki Alanı',
                        wkt: m.wkt || '',
                        geometry: m.geometry || null,
                        isActive: !m.isDeleted,
                        isDeleted: !!m.isDeleted
                    }))
                ];
                await adminApi.saveBulkCities(allEntitiesToSave, token);
                console.log('[DB Persist] Tüm il ve deniz yetki alanı verileri PostgreSQL veritabanına (tbl_city) başarıyla kaydedildi.');
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
            
            setRedoStack(prev => [...prev, JSON.stringify({
                cities: citiesRef.current || [],
                maritime: maritimeZonesRef.current || []
            })]);
            setUndoStack(newUndoStack);

            const parsed = JSON.parse(previousStateRaw);
            if (Array.isArray(parsed)) {
                applyCitiesToStateAndMap(parsed);
                savePublishedStateImmediately(parsed);
            } else {
                if (parsed.cities) {
                    applyCitiesToStateAndMap(parsed.cities);
                    savePublishedStateImmediately(parsed.cities);
                }
                if (parsed.maritime) {
                    setMaritimeZones(parsed.maritime);
                    savePublishedMaritimeImmediately(parsed.maritime);
                    updateMaritimeVectorFeatures(parsed.maritime);
                }
            }
            showToast('Son sınır / poligon değişikliği geri alındı (Undo)!');
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

            setUndoStack(prev => [...prev, JSON.stringify({
                cities: citiesRef.current || [],
                maritime: maritimeZonesRef.current || []
            })]);
            setRedoStack(newRedoStack);

            const parsed = JSON.parse(nextStateRaw);
            if (Array.isArray(parsed)) {
                applyCitiesToStateAndMap(parsed);
                savePublishedStateImmediately(parsed);
            } else {
                if (parsed.cities) {
                    applyCitiesToStateAndMap(parsed.cities);
                    savePublishedStateImmediately(parsed.cities);
                }
                if (parsed.maritime) {
                    setMaritimeZones(parsed.maritime);
                    savePublishedMaritimeImmediately(parsed.maritime);
                    updateMaritimeVectorFeatures(parsed.maritime);
                }
            }
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

    // Filter cities & maritime zones with Turkish character tolerance & category view
    useEffect(() => {
        let combined = [];

        if (geoEntityFilter === 'LAND') {
            combined = cities;
        } else if (geoEntityFilter === 'MARITIME') {
            combined = maritimeZones;
        } else {
            // 'ALL'
            combined = [...cities, ...maritimeZones];
        }

        // Kesin tekillik (Deduplication) - Aynı plaka veya ID'ye sahip satırların tabloda çift çıkmasını engeller
        const seenEntityKeys = new Set();
        const dedupedList = [];
        (combined || []).forEach(item => {
            if (!item) return;
            const key = item.isMaritime 
                ? `MAR-${item.plate || item.id}` 
                : `LAND-${item.plate || item.id}`;
            if (!seenEntityKeys.has(key)) {
                seenEntityKeys.add(key);
                dedupedList.push(item);
            }
        });

        let result = dedupedList;

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim();
            const qNorm = normalizeTR(q);
            const qLower = q.toLowerCase();

            result = result.filter(c => {
                const nameNorm = normalizeTR(c.name);
                const nameLower = (c.name || '').toLowerCase();
                const plateStr = (c.plate || '').toString();
                const platePadded = plateStr.padStart(2, '0');
                const seaStr = (c.sea || '').toLowerCase();
                const regStr = (c.region || '').toLowerCase();

                return (
                    nameNorm.includes(qNorm) ||
                    nameLower.includes(qLower) ||
                    plateStr.includes(q) ||
                    platePadded.includes(q) ||
                    seaStr.includes(qLower) ||
                    regStr.includes(qLower)
                );
            });

            // If search matches exactly 1 active item, automatically fly camera to it!
            if (result.length === 1 && !result[0].isDeleted) {
                zoomToCityOnMap(result[0]);
            }
        }

        if (selectedRegion !== 'ALL') {
            if (selectedRegion === 'NONE') {
                result = result.filter(c => !c.region || !c.region.trim());
            } else {
                result = result.filter(c => (c.region || '').trim() === selectedRegion || (c.sea || '').trim() === selectedRegion);
            }
        }

        if (statusFilter === 'ACTIVE') {
            result = result.filter(c => !c.isDeleted);
        } else if (statusFilter === 'DELETED') {
            result = result.filter(c => c.isDeleted);
        }

        setFilteredCities(result);
    }, [searchQuery, selectedRegion, statusFilter, geoEntityFilter, cities, maritimeZones]);

    // Filtrelenmiş / Seçili Bölgedeki Varlıkların Toplam Yüzölçümü ve Çevre Hesaplaması
    const regionMetrics = useMemo(() => {
        let totalArea = 0;
        let totalPerimeter = 0;
        (filteredCities || []).forEach(c => {
            if (!c.isDeleted) {
                const m = calculateGeometryMetrics(c);
                totalArea += m.areaKm2;
                totalPerimeter += m.perimeterKm;
            }
        });
        return {
            totalAreaKm2: Math.round(totalArea * 100) / 100,
            totalPerimeterKm: Math.round(totalPerimeter * 100) / 100,
            formattedTotalArea: `${(Math.round(totalArea * 100) / 100).toLocaleString('tr-TR')} km²`,
            formattedTotalPerimeter: `${(Math.round(totalPerimeter * 100) / 100).toLocaleString('tr-TR')} km`
        };
    }, [filteredCities]);


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

    // Smoothly fly/zoom map view to clicked city or maritime zone
    const zoomToCityOnMap = (city) => {
        try {
            if (!city || !mapRef.current) return;
            let matched = null;
            if (vectorSourceRef.current) {
                const features = vectorSourceRef.current.getFeatures();
                matched = features.find(f => f.get('plate') === city.plate || f.get('name') === city.name);
            }
            if (!matched && maritimeVectorSourceRef.current) {
                const maritimeFeatures = maritimeVectorSourceRef.current.getFeatures();
                matched = maritimeFeatures.find(f => f.get('plate') === city.plate || f.get('id') === city.id || f.get('name') === city.name);
            }
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

    // Handle City / Maritime Click (Normal click replaces selection and enables boundary editing; Shift key enables multi-selection)
    const handleCityClick = (city, isShiftPressed = false, shouldZoom = true) => {
        if (city.isDeleted) return;

        if (isShiftPressed) {
            setSelectedCities(prev => {
                const prevClean = prev.filter(c => !!c.isMaritime === !!city.isMaritime);
                const exists = prevClean.some(c => (c.plate === city.plate && c.id === city.id) || c.plate === city.plate || c.id === city.id);
                if (exists) {
                    return prevClean.filter(c => c.plate !== city.plate && c.id !== city.id);
                } else {
                    return [...prevClean, city];
                }
            });
            setSelectedCity(city);
        } else {
            if (selectedCity && (selectedCity.plate === city.plate || selectedCity.id === city.id) && selectedCities.length === 1) {
                setSelectedCity(null);
                setSelectedCities([]);
            } else {
                setSelectedCity(city);
                setSelectedCities([city]);
            }
        }

        if (maritimeVectorSourceRef.current) {
            maritimeVectorSourceRef.current.changed();
        }

        if (shouldZoom) {
            zoomToCityOnMap(city);
        }

        // Eğer sol menüdeki Sınır Düzenleme (Modify) butonu aktifse, tıklanan ilin sınırlarını düzenlemeye aç
        if (activeMapToolRef.current === 'modify') {
            handleStartBoundaryEditing(city);
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

            if (primaryCity.isMaritime) {
                const secondaryPlates = secondaryCities.map(c => c.plate || c.id);
                const updatedMaritime = maritimeZones.map(m => {
                    if (m.plate === primaryCity.plate || m.id === primaryCity.id) {
                        return {
                            ...m,
                            geometry: mergedGeometry,
                            wkt: mergedWkt
                        };
                    } else if (secondaryPlates.includes(m.plate) || secondaryPlates.includes(m.id)) {
                        return {
                            ...m,
                            isDeleted: true,
                            geometry: null,
                            wkt: ''
                        };
                    }
                    return m;
                });

                setMaritimeZones(updatedMaritime);
                savePublishedMaritimeImmediately(updatedMaritime);
                updateMaritimeVectorFeatures(updatedMaritime);

                const updatedPrimary = updatedMaritime.find(m => m.plate === primaryCity.plate || m.id === primaryCity.id) || primaryCity;
                setSelectedCities([updatedPrimary]);
                setSelectedCity(updatedPrimary);
                showToast(`[${secondaryNames}] deniz alanları "${primaryCity.name}" altında başarıyla birleştirildi ve kaydedildi!`);
                return;
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

    // Permanent Soft Delete City / Maritime Action
    const handleSoftDeleteCity = (cityToDelete) => {
        try {
            const entityLabel = cityToDelete.isMaritime ? 'deniz alanını' : 'ilini';
            if (!window.confirm(`"${cityToDelete.name}" ${entityLabel} pasife alıp (Soft Delete) silmek istediğinize emin misiniz?`)) {
                return;
            }

            if (cityToDelete.isMaritime) {
                const updatedMaritime = maritimeZones.map(m => {
                    if (m.plate === cityToDelete.plate || m.id === cityToDelete.id || m.name === cityToDelete.name) {
                        return {
                            ...m,
                            isDeleted: true,
                            geometry: null,
                            wkt: ''
                        };
                    }
                    return m;
                });
                setMaritimeZones(updatedMaritime);
                savePublishedMaritimeImmediately(updatedMaritime);
                updateMaritimeVectorFeatures(updatedMaritime);
                if (selectedCity && (selectedCity.plate === cityToDelete.plate || selectedCity.id === cityToDelete.id)) {
                    setSelectedCity(null);
                }
                setSelectedCities(prev => prev.filter(c => c.plate !== cityToDelete.plate && c.id !== cityToDelete.id));
                showToast(`"${cityToDelete.name}" deniz alanı silindi ve kaydedildi.`, 'warning');
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

    // Restore Deleted City / Maritime Action
    const handleRestoreCity = (cityToRestore) => {
        try {
            if (cityToRestore.isMaritime) {
                const updatedMaritime = maritimeZones.map(m => {
                    if (m.plate === cityToRestore.plate || m.id === cityToRestore.id) {
                        return { ...m, isDeleted: false };
                    }
                    return m;
                });
                setMaritimeZones(updatedMaritime);
                savePublishedMaritimeImmediately(updatedMaritime);
                updateMaritimeVectorFeatures(updatedMaritime);
                showToast(`"${cityToRestore.name}" deniz alanı geri yüklendi ve kaydedildi!`);
                return;
            }

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

        // Deniz Sınırları & Kıyı Şeritleri (Maritime Boundaries) Vektör Katmanı
        const maritimeVectorSource = new VectorSource();
        maritimeVectorSourceRef.current = maritimeVectorSource;

        const maritimeVectorLayer = new VectorLayer({
            source: maritimeVectorSource,
            visible: showMaritimeLayer,
            zIndex: 8,
            style: (feature) => {
                const props = feature.getProperties() || {};
                const isSelected = selectedCity && (selectedCity.plate === props.plate || selectedCity.id === props.id);

                if (isSelected) {
                    return new Style({
                        fill: new Fill({
                            color: 'rgba(14, 165, 233, 0.45)'
                        }),
                        stroke: new Stroke({
                            color: '#38bdf8',
                            width: 3.5,
                            lineDash: [10, 4]
                        }),
                        text: new Text({
                            text: props.name || props.zoneName || '',
                            font: 'bold 12.5px Inter, sans-serif',
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#0369a1', width: 4 }),
                            offsetY: -8
                        })
                    });
                }

                return new Style({
                    fill: new Fill({
                        color: props.fillColor || 'rgba(2, 132, 199, 0.14)'
                    }),
                    stroke: new Stroke({
                        color: props.strokeColor || '#0284c7',
                        width: 2.2,
                        lineDash: [6, 4]
                    }),
                    text: new Text({
                        text: props.name || props.zoneName || '',
                        font: 'bold 11px Inter, sans-serif',
                        fill: new Fill({ color: props.strokeColor || '#0284c7' }),
                        stroke: new Stroke({ color: '#ffffff', width: 3 }),
                        offsetY: -6
                    })
                });
            }
        });
        maritimeVectorLayerRef.current = maritimeVectorLayer;

        // Deniz Yetki Alanları Verisini Yükle
        loadMaritimeData();

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            zIndex: 10,
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

        const activeBaseConfig = getBasemapConfig(selectedBaseLayer);
        const baseTileLayer = new TileLayer({
            source: new XYZ({
                url: activeBaseConfig.url,
                crossOrigin: 'anonymous',
                maxZoom: activeBaseConfig.maxZoom || 19
            })
        });
        baseTileLayerRef.current = baseTileLayer;

        const map = new OLMap({
            target: mapElementRef.current,
            layers: [
                baseTileLayer,
                maritimeVectorLayer,
                vectorLayer
            ],
            view: new View({
                center: fromLonLat([35.2433, 38.9637]),
                zoom: 6
            })
        });

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

            // 2. NORMAL NAVIGATION & SELECTION MODE: Click city or maritime zone to select
            const currentFilter = geoEntityFilterRef.current;
            const currentTargetType = modifyTargetTypeRef.current;
            const currentTool = activeMapToolRef.current;
            const currentSelected = selectedCityRef.current;

            // Sıkı Mod Belirleme:
            const isMaritimeStrict = (currentTool === 'modify' && currentTargetType === 'MARITIME') || 
                                     (currentFilter === 'MARITIME') || 
                                     (currentSelected && currentSelected.isMaritime && currentTool === 'modify');

            const isLandStrict = (currentTool === 'modify' && currentTargetType === 'LAND') || 
                                 (currentFilter === 'LAND') || 
                                 (currentSelected && !currentSelected.isMaritime && currentTool === 'modify');

            let clickedCity = null;
            let clickedMaritime = null;

            map.forEachFeatureAtPixel(evt.pixel, (feature) => {
                const isMaritime = feature.get('isMaritime');
                const plate = feature.get('plate');
                const name = feature.get('name');
                const id = feature.get('id');

                if (isMaritime || plate >= 900) {
                    if (!clickedMaritime && !isLandStrict) {
                        const matched = (maritimeZonesRef.current || []).find(m => m.plate === plate || m.id === id || m.name === name);
                        if (matched) clickedMaritime = matched;
                    }
                } else {
                    if (!clickedCity && !isMaritimeStrict) {
                        const matched = (citiesRef.current || []).find(c => (c.plate === plate || c.name === name) && !c.isDeleted);
                        if (matched) clickedCity = matched;
                    }
                }
            }, {
                layerFilter: (layer) => {
                    if (isMaritimeStrict) {
                        return layer === maritimeVectorLayerRef.current;
                    }
                    if (isLandStrict) {
                        return layer !== maritimeVectorLayerRef.current;
                    }
                    return true;
                }
            });

            if (isMaritimeStrict) {
                // DENİZ MODUNDA / DENİZ SINIRLARI DÜZENLERKEN:
                // SADECE VE SADECE DENİZ ALANLARI SEÇİLEBİLİR. İLLERE ASLA GEÇİLMEZ!
                if (clickedMaritime) {
                    handleCityClick(clickedMaritime, false, false);
                }
                return;
            }

            if (isLandStrict) {
                // İL MODUNDA / İL SINIRLARI DÜZENLERKEN:
                // SADECE VE SADECE İLLER SEÇİLEBİLİR. DENİZLERE ASLA GEÇİLMEZ!
                if (clickedCity) {
                    handleCityClick(clickedCity, evt.originalEvent.shiftKey, false);
                }
                return;
            }

            // TÜMÜ / SERBEST MOD: Tıklanan varlığa geçilir
            if (clickedMaritime) {
                handleCityClick(clickedMaritime, false, false);
            } else if (clickedCity) {
                handleCityClick(clickedCity, evt.originalEvent.shiftKey, false);
            }
        });

        // Context Menu Handler (Shift + Right Click)
        const viewport = map.getViewport();
        viewport.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();
            const pixel = map.getEventPixel(evt);
            const currentFilter = geoEntityFilterRef.current;
            const currentTargetType = modifyTargetTypeRef.current;
            const currentTool = activeMapToolRef.current;
            const currentSelected = selectedCityRef.current;

            const isMaritimeStrict = (currentTool === 'modify' && currentTargetType === 'MARITIME') || 
                                     (currentFilter === 'MARITIME') || 
                                     (currentSelected && currentSelected.isMaritime && currentTool === 'modify');

            const isLandStrict = (currentTool === 'modify' && currentTargetType === 'LAND') || 
                                 (currentFilter === 'LAND') || 
                                 (currentSelected && !currentSelected.isMaritime && currentTool === 'modify');

            map.forEachFeatureAtPixel(pixel, (feature) => {
                const plate = feature.get('plate');
                const name = feature.get('name');
                const id = feature.get('id');
                const isMaritime = feature.get('isMaritime');

                if (isMaritime || plate >= 900) {
                    if (!isLandStrict) {
                        const matched = (maritimeZonesRef.current || []).find(m => m.plate === plate || m.id === id || m.name === name);
                        if (matched) {
                            handleCityClick(matched, false, false);
                        }
                    }
                } else {
                    if (!isMaritimeStrict) {
                        const matched = (citiesRef.current || []).find(c => (c.plate === plate || c.name === name) && !c.isDeleted);
                        if (matched) {
                            handleCityClick(matched, true, false);
                        }
                    }
                }
            }, {
                layerFilter: (layer) => {
                    if (isMaritimeStrict) return layer === maritimeVectorLayerRef.current;
                    if (isLandStrict) return layer !== maritimeVectorLayerRef.current;
                    return true;
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

        // Always clean up existing draw, modify, and snap interactions first
        if (drawInteractionRef.current) {
            mapRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (modifyInteractionRef.current) {
            mapRef.current.removeInteraction(modifyInteractionRef.current);
        }
        if (snapInteractionRef.current) {
            mapRef.current.removeInteraction(snapInteractionRef.current);
            snapInteractionRef.current = null;
        }

        setActiveMapTool(targetTool);

        if (targetTool === 'modify') {
            showToast('Sınır Noktalarını Düzenle (Modify) Modu Aktif: Haritada herhangi bir ilin köşe noktasını sürükleyebilirsiniz. Shift ile komşu il sınırlarına yapışabilirsiniz.');
        } else if (targetTool === 'draw') {
            const draw = new Draw({
                source: vectorSourceRef.current,
                type: 'Polygon',
                freehand: false,
                freehandCondition: () => false, // Kalem/serbest el çizimini tamamen kapat
                condition: (event) => event.originalEvent.button === 0 // Shift basılıyken de sol tık ile köşe noktası oluşturulmasını sağla
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
                    if (snapInteractionRef.current && mapRef.current) {
                        mapRef.current.removeInteraction(snapInteractionRef.current);
                        snapInteractionRef.current = null;
                    }
                    showToast('Poligon çizimi tamamlandı! Lütfen il adı ve plaka kodunu (ID) girerek kaydediniz.');
                } catch (err) {
                    console.error('Poligon Çizim Hatası:', err);
                    showToast('Yeni poligon çizilirken hata oluştu.', 'error');
                }
            });

            // Draw interaction ekleniyor (Shift basıldığında dinamik Snap devreye girer)
            mapRef.current.addInteraction(draw);
            drawInteractionRef.current = draw;

            // Snap etkileşiminin Draw'dan önce koordinat yakalaması için Draw'dan sonra eklenmesini garantiye alıyoruz
            if (isShiftDown) {
                if (snapInteractionRef.current) {
                    mapRef.current.removeInteraction(snapInteractionRef.current);
                }
                const snap = new Snap({
                    source: vectorSourceRef.current,
                    pixelTolerance: 20,
                    edge: false,
                    vertex: true
                });
                mapRef.current.addInteraction(snap);
                snapInteractionRef.current = snap;
            }

            showToast('Çizim modu aktif: Haritada tıklayarak poligon çizin. Shift tuşuna basılı tutarak komşu il köşe noktalarına yapışabilirsiniz (Snap).');
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

    // Synchronize maritime vector layer visibility
    useEffect(() => {
        if (maritimeVectorLayerRef.current) {
            maritimeVectorLayerRef.current.setVisible(showMaritimeLayer);
        }
    }, [showMaritimeLayer]);

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

            if (selectedCity.isMaritime) {
                const updatedMaritime = maritimeZones.map(m => {
                    if (m.plate === selectedCity.plate || m.id === selectedCity.id) {
                        return {
                            ...m,
                            plate: newPlate,
                            id: m.id || `MAR-${newPlate}`,
                            name: inputNameClean,
                            sea: formData.region,
                            region: formData.region,
                            wkt: formData.wkt || m.wkt
                        };
                    }
                    return m;
                });
                setMaritimeZones(updatedMaritime);
                savePublishedMaritimeImmediately(updatedMaritime);
                updateMaritimeVectorFeatures(updatedMaritime);
                const updatedSelected = updatedMaritime.find(m => m.plate === newPlate) || null;
                setSelectedCity(updatedSelected);
                setIsEditModalOpen(false);
                showToast(`"${inputNameClean}" deniz alanı güncellendi ve kaydedildi!`);
                return;
            }

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

    // Add New City / Maritime Zone with Strict Unique ID/Name Validation
    const handleSaveAdd = async () => {
        try {
            if (!formData.name || !formData.name.trim() || !formData.plate) {
                showToast('Lütfen alan adını ve plaka/kod numarasını giriniz!', 'error');
                return;
            }
            const newPlate = parseInt(formData.plate, 10);
            if (isNaN(newPlate) || newPlate <= 0) {
                showToast('Geçersiz plaka kodu / ID! Lütfen pozitif bir sayı giriniz.', 'error');
                return;
            }

            const inputNameClean = formData.name.trim();
            const isMaritimeEntity = formData.entityType === 'MARITIME' || formData.isMaritime;

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

            // Clean up draft feature from map if any
            if (draftFeatureRef.current) {
                if (vectorSourceRef.current) {
                    try { vectorSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                }
                if (maritimeVectorSourceRef.current) {
                    try { maritimeVectorSourceRef.current.removeFeature(draftFeatureRef.current); } catch (e) {}
                }
                draftFeatureRef.current = null;
            }

            // MARITIME ENTITY PERSISTENCE
            if (isMaritimeEntity) {
                const duplicateMaritime = maritimeZones.find(m => m.plate === newPlate && !m.isDeleted);
                if (duplicateMaritime) {
                    showToast(`HATA: ${newPlate} kodu zaten "${duplicateMaritime.name}" deniz alanına ait!`, 'error');
                    return;
                }

                const newMaritime = {
                    id: `MAR-${newPlate}`,
                    plate: newPlate,
                    name: inputNameClean,
                    sea: formData.region || 'Akdeniz',
                    region: formData.region || 'Akdeniz',
                    areaKm2: Number(formData.areaKm2) || 25000,
                    coastlineKm: Number(formData.coastlineKm) || 200,
                    coastalProvinces: formData.coastalProvinces ? formData.coastalProvinces.split(',').map(s => s.trim()) : [],
                    majorPorts: formData.majorPorts ? formData.majorPorts.split(',').map(s => s.trim()) : [],
                    description: formData.description || `${inputNameClean} deniz yetki alanı.`,
                    color: '#0284c7',
                    fillColor: 'rgba(2, 132, 199, 0.18)',
                    strokeColor: '#0284c7',
                    wkt: formData.wkt ? formData.wkt.trim() : '',
                    geometry: parsedGeometry,
                    isActive: true,
                    isDeleted: false,
                    isMaritime: true
                };

                const updated = [...maritimeZones, newMaritime];
                setMaritimeZones(updated);
                savePublishedMaritimeImmediately(updated);
                updateMaritimeVectorFeatures(updated);

                setIsAddModalOpen(false);
                setFormData({ plate: '', name: '', region: 'Marmara Bölgesi', wkt: '', entityType: 'LAND' });
                showToast(`"${inputNameClean}" deniz alanı (Kod: ${newPlate}) başarıyla eklendi ve kaydedildi!`);
                return;
            }

            // LAND CITY PERSISTENCE
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

            // 1. Push current state snapshot to undo stack
            pushStateToUndo(cities);

            // 2. Create new city object
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

                    {/* DENİZ SINIRLARI & KIYI ŞERİTLERİ TOGGLE BUTONU */}
                    <button
                        className={`btn btn-sm ${showMaritimeLayer ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShowMaritimeLayer(prev => !prev)}
                        title={isTr ? "Kıyı Şeritleri & Deniz Karasuları Yetki Sınırlarını Göster / Gizle" : "Toggle Maritime Coastal & Territorial Boundaries"}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M2 12c.6.5 1.2.8 2.5.8 2.5 0 2.5-1.6 5-1.6 2.5 0 2.5 1.6 5 1.6 2.5 0 2.5-1.6 5-1.6 1.3 0 1.9.3 2.5.8"/>
                            <path d="M2 18c.6.5 1.2.8 2.5.8 2.5 0 2.5-1.6 5-1.6 2.5 0 2.5 1.6 5 1.6 2.5 0 2.5-1.6 5-1.6 1.3 0 1.9.3 2.5.8"/>
                            <path d="M2 6c.6.5 1.2.8 2.5.8 2.5 0 2.5-1.6 5-1.6 2.5 0 2.5 1.6 5 1.6 2.5 0 2.5-1.6 5-1.6 1.3 0 1.9.3 2.5.8"/>
                        </svg>
                        <span>{showMaritimeLayer ? (isTr ? 'Deniz Sınırları (Açık)' : 'Maritime (On)') : (isTr ? 'Deniz Sınırları (Kapalı)' : 'Maritime (Off)')}</span>
                    </button>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
                        title={isTr ? "Sağ İl Listesi Panelini Aç/Kapat" : "Toggle Province List Panel"}
                    >
                        <span>{isRightDrawerOpen ? (isTr ? 'Panel Gizle' : 'Hide Panel') : (isTr ? 'Panel Aç' : 'Open Panel')}</span>
                    </button>

                    <button className="btn btn-secondary btn-sm" onClick={handleExportGeoJSON} title={isTr ? "GeoJSON Dışa Aktar" : "Export GeoJSON"}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>{isTr ? 'Dışa Aktar' : 'Export'}</span>
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => {
                        const activeCities = (cities || []).filter(c => !c.isDeleted);
                        const maxPlate = Math.max(0, ...activeCities.map(c => Number(c.plate) || 0));
                        setFormData({ plate: (maxPlate + 1).toString(), name: '', region: 'Marmara Bölgesi', wkt: '', entityType: 'LAND' });
                        setIsAddModalOpen(true);
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>{isTr ? 'Yeni İl Ekle' : 'Add Province'}</span>
                    </button>
                </div>
            </div>

            {/* Main Layout: Full Screen Large Map + Collapsible Right Side Drawer */}
            <div className={`geo-main-grid-large ${isRightDrawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
                {/* Full Screen Interactive Map Container */}
                <div className="geo-map-wrapper-full">
                    {/* GOOGLE EARTH TARZI TARİHSEL ZAMAN ÇİZELGESİ (ESRI WAYBACK) */}
                    <HistoricalTimelineSlider
                        selectedLayerId={selectedBaseLayer}
                        onSelectLayer={handleSelectBaseLayer}
                        onClose={() => handleSelectBaseLayer('google_hybrid')}
                        isSidebarOpen={false}
                    />
                    
                    {/* TOP FLOATING NOTIFICATION BANNER INSIDE MAP VIEWPORT */}
                    {selectedCities.length > 0 && (
                        <div className="geo-top-alert-banner compact-banner">
                            <div className="alert-banner-content">
                                <div className="banner-text">
                                    <strong>{selectedCities.some(c => c.isMaritime) ? (isTr ? 'SEÇİLİ DENİZ ALANLARI' : 'SELECTED MARITIME ZONES') : (isTr ? 'SEÇİLİ İLLER' : 'SELECTED PROVINCES')} ({selectedCities.length}):</strong>{' '}
                                    {selectedCities.map(c => `[${c.plate.toString().padStart(2, '0')}] ${c.name}`).join(', ')}
                                </div>
                            </div>
                            <div className="banner-actions">
                                {selectedCities.length >= 2 && (
                                    <button className="banner-btn btn-merge btn-sm-action" onClick={handleMergeSelectedPolygons}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                        <span>{selectedCities.some(c => c.isMaritime) ? (isTr ? 'Seçili Deniz Alanlarını Birleştir' : 'Merge Selected Maritime Zones') : (isTr ? 'Seçili İlleri Birleştir' : 'Merge Selected Provinces')}</span>
                                    </button>
                                )}
                                <button className="banner-btn btn-clear btn-sm-action" onClick={handleClearSelection} title={isTr ? "Seçimi Temizle" : "Clear Selection"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
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
                            <button className="zoom-btn-exact" onClick={handleZoomIn} title={isTr ? "Yakınlaştır (+)" : "Zoom In (+)"}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                            <div className="zoom-divider-exact" />
                            <button className="zoom-btn-exact" onClick={handleZoomOut} title={isTr ? "Uzaklaştır (-)" : "Zoom Out (-)"}>
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
                                title={isTr ? "Poligon Çiz / Değiştir" : "Draw / Modify Polygon"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
                                </svg>
                            </button>

                            {/* LOCATION PIN / MODIFY VERTEX ICON */}
                            <button
                                className={`tool-btn-exact dark-style ${activeMapTool === 'modify' ? 'active' : ''}`}
                                onClick={() => toggleMapTool('modify')}
                                title={isTr ? "Sınır Noktalarını Düzenle" : "Edit Boundary Vertices"}
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
                                title={isTr ? "Poligon Çizerek Seçili Alanı Sil (Erase Area)" : "Erase Selected Area by Polygon"}
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
                                title={isTr ? "Geri Al (Undo)" : "Undo"}
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
                                title={isTr ? "İleri Al (Redo)" : "Redo"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 14 20 9 15 4" />
                                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* SINIR NOKTALARINI DÜZENLEME MODU BİLGİ & MOD SEÇİM BARI */}
                    {activeMapTool === 'modify' && (
                        <div
                            className="city-boundary-edit-banner"
                            style={{
                                position: 'absolute',
                                top: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1000,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backgroundColor: '#0f172a',
                                border: '1.5px solid #0284c7',
                                borderRadius: '12px',
                                padding: '6px 16px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                                color: '#ffffff',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc' }}>
                                    {selectedCity ? `Seçili Alan: ${selectedCity.name}` : 'Sınır Düzenleme:'}
                                </span>
                            </div>

                            {/* DÜZENLEME HEDEF KATMAN SEÇİCİ (İL / DENİZ) */}
                            {!selectedCity && (
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setModifyTargetType('LAND'); setGeoEntityFilter('LAND'); }}
                                        style={{
                                            padding: '3px 9px',
                                            fontSize: '11px',
                                            fontWeight: (modifyTargetType === 'LAND' || (modifyTargetType === 'AUTO' && geoEntityFilter !== 'MARITIME')) ? '700' : '500',
                                            borderRadius: '5px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: (modifyTargetType === 'LAND' || (modifyTargetType === 'AUTO' && geoEntityFilter !== 'MARITIME')) ? '#2563eb' : 'transparent',
                                            color: '#ffffff'
                                        }}
                                    >
                                        İl Sınırları
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setModifyTargetType('MARITIME'); setGeoEntityFilter('MARITIME'); }}
                                        style={{
                                            padding: '3px 9px',
                                            fontSize: '11px',
                                            fontWeight: (modifyTargetType === 'MARITIME' || (modifyTargetType === 'AUTO' && geoEntityFilter === 'MARITIME')) ? '700' : '500',
                                            borderRadius: '5px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: (modifyTargetType === 'MARITIME' || (modifyTargetType === 'AUTO' && geoEntityFilter === 'MARITIME')) ? '#0284c7' : 'transparent',
                                            color: '#ffffff'
                                        }}
                                    >
                                        Deniz Sınırları
                                    </button>
                                </div>
                            )}

                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {isShiftDown ? 'Shift: Yapışma Aktif' : 'Noktayı sürükleyin (Alt+Tık ile nokta silin)'}
                            </span>

                            <button
                                type="button"
                                onClick={() => toggleMapTool('pan')}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '11.5px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    cursor: 'pointer'
                                }}
                            >
                                Tamamla
                            </button>
                        </div>
                    )}

                    {/* YENİ İL ÇİZİM BARI (SHIFT SNAPPING BİLGİLENDİRME) */}
                    {activeMapTool === 'draw' && (
                        <div
                            className="city-boundary-edit-banner"
                            style={{
                                position: 'absolute',
                                top: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1000,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                backgroundColor: '#131b2e',
                                border: '1.5px solid #2563eb',
                                borderRadius: '12px',
                                padding: '8px 18px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                                color: '#ffffff',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                                    Yeni İl Çizimi
                                </span>
                            </div>

                            <span style={{ fontSize: '11.5px', color: isShiftDown ? '#38bdf8' : '#cbd5e1' }}>
                                {isShiftDown
                                    ? 'Shift Aktif: Komşu il poligon köşe noktasına otomatik yapışma (Snap) devrede'
                                    : 'Haritada tıklayarak poligon çizin. Shift + Sol Tık ile komşu il sınırlarına yapışabilirsiniz.'}
                            </span>

                            <button
                                type="button"
                                onClick={() => toggleMapTool('pan')}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    cursor: 'pointer'
                                }}
                            >
                                Vazgeç
                            </button>
                        </div>
                    )}

                    <div ref={mapElementRef} className="geo-map-element-full" />
                </div>

                {/* SIMPLIFIED COMPACT RIGHT SIDE DRAWER - NO CHECKBOXES */}
                {isRightDrawerOpen && (
                    <div className="geo-right-drawer compact-drawer">
                        <div className="drawer-header compact-drawer-header">
                            <span>{isTr ? 'COĞRAFİ YETKİ ALANLARI' : 'GEOGRAPHIC JURISDICTIONS'} ({filteredCities.length})</span>
                            <button className="drawer-close-btn" onClick={() => setIsRightDrawerOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }} title={isTr ? "Kapat" : "Close"}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* MODERN SEGMENTED PILL BAR: TÜMÜ / İLLER / DENİZLER */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: isDarkMode ? '#090d1a' : '#f1f5f9',
                            padding: '4px',
                            borderRadius: '10px',
                            margin: '8px 8px 4px 8px',
                            border: `1px solid ${isDarkMode ? 'rgba(56, 189, 248, 0.2)' : '#e2e8f0'}`,
                            boxShadow: isDarkMode ? 'inset 0 2px 4px rgba(0, 0, 0, 0.5)' : 'none',
                            gap: '4px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setGeoEntityFilter('ALL')}
                                style={{
                                    flex: 1,
                                    padding: '7px 6px',
                                    fontSize: '11.5px',
                                    fontWeight: geoEntityFilter === 'ALL' ? '700' : '500',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: geoEntityFilter === 'ALL' ? '#2563eb' : 'transparent',
                                    color: geoEntityFilter === 'ALL' ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                    boxShadow: geoEntityFilter === 'ALL' ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                <span>{isTr ? 'Tümü' : 'All'}</span>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '8px',
                                    background: geoEntityFilter === 'ALL' ? 'rgba(255, 255, 255, 0.25)' : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
                                    color: geoEntityFilter === 'ALL' ? '#ffffff' : (isDarkMode ? '#ffffff' : '#334155')
                                }}>
                                    {cities.filter(c => !c.isDeleted).length + maritimeZones.filter(m => !m.isDeleted).length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGeoEntityFilter('LAND')}
                                style={{
                                    flex: 1,
                                    padding: '7px 6px',
                                    fontSize: '11.5px',
                                    fontWeight: geoEntityFilter === 'LAND' ? '700' : '500',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: geoEntityFilter === 'LAND' ? '#2563eb' : 'transparent',
                                    color: geoEntityFilter === 'LAND' ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                    boxShadow: geoEntityFilter === 'LAND' ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                <span>{isTr ? 'İller' : 'Provinces'}</span>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '8px',
                                    background: geoEntityFilter === 'LAND' ? 'rgba(255, 255, 255, 0.25)' : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
                                    color: geoEntityFilter === 'LAND' ? '#ffffff' : (isDarkMode ? '#ffffff' : '#334155')
                                }}>
                                    {cities.filter(c => !c.isDeleted).length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGeoEntityFilter('MARITIME')}
                                style={{
                                    flex: 1,
                                    padding: '7px 6px',
                                    fontSize: '11.5px',
                                    fontWeight: geoEntityFilter === 'MARITIME' ? '700' : '500',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: geoEntityFilter === 'MARITIME' ? '#0284c7' : 'transparent',
                                    color: geoEntityFilter === 'MARITIME' ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                    boxShadow: geoEntityFilter === 'MARITIME' ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                <span>{isTr ? 'Denizler' : 'Maritime'}</span>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '8px',
                                    background: geoEntityFilter === 'MARITIME' ? 'rgba(255, 255, 255, 0.25)' : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
                                    color: geoEntityFilter === 'MARITIME' ? '#ffffff' : (isDarkMode ? '#ffffff' : '#334155')
                                }}>
                                    {maritimeZones.filter(m => !m.isDeleted).length}
                                </span>
                            </button>
                        </div>

                        {/* SEÇİLİ İL / DENİZ ALANI BİLGİ VE METRİK KARTI (DÜZ FLAT MODERN KART) */}
                        {selectedCity && (
                            <div style={{
                                margin: '8px 8px 6px 8px',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: '#1e293b',
                                border: selectedCity.isMaritime ? '1px solid #0284c7' : '1px solid #3b82f6',
                                boxShadow: 'none'
                            }}>
                                {(() => {
                                    const metrics = calculateGeometryMetrics(selectedCity);
                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: selectedCity.isMaritime ? '#38bdf8' : '#60a5fa', letterSpacing: '-0.2px' }}>
                                                        {selectedCity.name}
                                                    </h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            {selectedCity.sea || selectedCity.region || (isTr ? 'Bölge Belirtilmemiş' : 'Unspecified Region')}
                                                        </span>
                                                        <span style={{ color: '#475569' }}>•</span>
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: selectedCity.isMaritime ? '#38bdf8' : '#93c5fd' }}>
                                                            {selectedCity.isMaritime ? (isTr ? 'Deniz Kodu:' : 'Code:') : (isTr ? 'Plaka:' : 'Plate:')} {selectedCity.plate}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCity(null)}
                                                    style={{
                                                        background: '#334155',
                                                        border: 'none',
                                                        color: '#94a3b8',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    title={isTr ? "Kapat" : "Close"}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px', fontSize: '11px' }}>
                                                <div style={{
                                                    padding: '6px 8px',
                                                    borderRadius: '6px',
                                                    background: '#0f172a',
                                                    border: '1px solid #334155'
                                                }}>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px', fontWeight: '800', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{isTr ? 'YÜZÖLÇÜMÜ' : 'AREA'}</span>
                                                    <strong style={{ color: '#38bdf8', fontSize: '12.5px', fontWeight: 800, display: 'block', marginTop: '1px' }}>{metrics.formattedArea}</strong>
                                                    {metrics.areaHa > 0 && (
                                                        <span style={{ color: '#64748b', fontSize: '9px', display: 'block' }}>({metrics.formattedAreaHa})</span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    padding: '6px 8px',
                                                    borderRadius: '6px',
                                                    background: '#0f172a',
                                                    border: '1px solid #334155'
                                                }}>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px', fontWeight: '800', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{isTr ? 'ÇEVRE / KIYI' : 'PERIMETER / COAST'}</span>
                                                    <strong style={{ color: '#c084fc', fontSize: '12.5px', fontWeight: 800, display: 'block', marginTop: '1px' }}>{metrics.formattedPerimeter}</strong>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    style={{
                                                        height: '34px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 700,
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        cursor: 'pointer',
                                                        background: '#2563eb',
                                                        border: '1px solid #1d4ed8',
                                                        color: '#ffffff',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onClick={() => {
                                                        setFormData({
                                                            plate: selectedCity.plate.toString(),
                                                            name: selectedCity.name,
                                                            region: selectedCity.region || selectedCity.sea || '',
                                                            wkt: selectedCity.wkt || '',
                                                            entityType: selectedCity.isMaritime ? 'MARITIME' : 'LAND',
                                                            isMaritime: selectedCity.isMaritime
                                                        });
                                                        setIsEditModalOpen(true);
                                                    }}
                                                >
                                                    <EditIcon size={13} />
                                                    <span>{isTr ? 'Düzenle' : 'Edit'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    style={{
                                                        height: '34px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 700,
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        cursor: 'pointer',
                                                        background: '#dc2626',
                                                        border: '1px solid #b91c1c',
                                                        color: '#ffffff',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onClick={() => handleSoftDeleteCity(selectedCity)}
                                                >
                                                    <TrashIcon size={13} />
                                                    <span>{isTr ? 'Sil' : 'Delete'}</span>
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="geo-filter-bar compact-filter-bar">
                            <div style={{ position: 'relative', flex: 1.5, display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder={isTr ? "İl, Deniz Alanı, Plaka..." : "Province, Maritime Zone, Code..."}
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
                                            title={isTr ? "Aramayı Temizle" : "Clear Search"}
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
                                <option value="ALL">{isTr ? 'Bölgeler & Denizler (Tümü)' : 'Regions & Maritime (All)'}</option>
                                <option value="NONE">{isTr ? 'Bölgesiz / Belirtilmemiş' : 'Unspecified Region'}</option>
                                {availableRegions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="geo-region-select compact-select"
                            >
                                <option value="ACTIVE">{isTr ? 'Aktifler' : 'Active'}</option>
                                <option value="DELETED">{isTr ? 'Silinenler' : 'Deleted'}</option>
                                <option value="ALL">{isTr ? 'Tümü' : 'All'}</option>
                            </select>
                        </div>

                        {/* BÖLGE / FİLTRE METRİK ÖZET ÇUBUĞU */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            margin: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '10.5px'
                        }}>
                            <span style={{ color: '#94a3b8' }}>
                                {isTr ? 'Toplam Alan:' : 'Total Area:'} <strong style={{ color: '#38bdf8', fontWeight: '700' }}>{regionMetrics.formattedTotalArea}</strong>
                            </span>
                            <span style={{ color: '#94a3b8' }}>
                                {isTr ? 'Toplam Çevre:' : 'Total Perimeter:'} <strong style={{ color: '#a78bfa', fontWeight: '700' }}>{regionMetrics.formattedTotalPerimeter}</strong>
                            </span>
                        </div>

                        <div className="geo-table-container compact-table-container">
                            <table className="geo-table compact-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '48px' }}>{isTr ? 'Kod' : 'Code'}</th>
                                        <th>{isTr ? 'Alan / İl Adı & Yüzölçümü' : 'Area / Province Name & Size'}</th>
                                        <th style={{ width: '125px' }}>{isTr ? 'Bölge / Deniz' : 'Region / Sea'}</th>
                                        <th style={{ width: '68px', textAlign: 'center' }}>{isTr ? 'İşlem' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCities.map(city => {
                                        const isSelected = selectedCities.some(c => c.plate === city.plate);
                                        const isPrimary = selectedCity && (selectedCity.plate === city.plate || selectedCity.id === city.id);
                                        const isMaritime = city.isMaritime;
                                        const metrics = calculateGeometryMetrics(city);

                                        return (
                                            <tr
                                                key={city.id || city.plate}
                                                className={`${isSelected ? 'row-selected' : ''} ${isPrimary ? 'row-primary' : ''} ${city.isDeleted ? 'row-deleted' : ''}`}
                                                style={isMaritime ? { background: isPrimary ? 'rgba(2, 132, 199, 0.35)' : 'rgba(2, 132, 199, 0.08)' } : undefined}
                                                onClick={(e) => !city.isDeleted && handleCityClick(city, e.shiftKey, true)}
                                            >
                                                <td>
                                                    {isMaritime ? (
                                                        <span className="plate-badge compact-badge" style={{ background: '#0284c7', color: '#ffffff', fontWeight: '700', fontSize: '10px' }}>
                                                            {city.plate}
                                                        </span>
                                                    ) : (
                                                        <span className="plate-badge compact-badge">{city.plate.toString().padStart(2, '0')}</span>
                                                    )}
                                                </td>
                                                <td className="city-name compact-city">
                                                    <div style={{ color: isMaritime ? (isDarkMode ? '#38bdf8' : '#0284c7') : (isPrimary ? '#2563eb' : (isDarkMode ? '#f8fafc' : '#0f172a')), fontWeight: '600', fontSize: '12px' }}>
                                                        {city.name}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', gap: '6px', marginTop: '1px' }}>
                                                        <span>{metrics.formattedArea}</span>
                                                        <span>•</span>
                                                        <span>{metrics.formattedPerimeter}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="region-tag compact-tag" style={{ background: 'transparent', color: isMaritime ? (isDarkMode ? '#38bdf8' : '#0284c7') : (isDarkMode ? '#94a3b8' : '#475569'), fontSize: '11px', fontWeight: '500' }}>
                                                        {city.sea || city.region || 'Belirtilmemiş'}
                                                    </span>
                                                </td>
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
                                                                    className="admin-action-btn edit-icon-btn"
                                                                    title={isTr ? "Bilgileri Düzenle" : "Edit Details"}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedCity(city);
                                                                        setFormData({
                                                                            plate: city.plate.toString(),
                                                                            name: city.name,
                                                                            region: city.region || city.sea || '',
                                                                            wkt: city.wkt || '',
                                                                            entityType: city.isMaritime ? 'MARITIME' : 'LAND',
                                                                            isMaritime: city.isMaritime
                                                                        });
                                                                        setIsEditModalOpen(true);
                                                                    }}
                                                                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                                >
                                                                    <EditIcon size={14} />
                                                                </button>
                                                                <button
                                                                    className="admin-action-btn delete-icon-btn"
                                                                    title={isTr ? "Kalıcı Sil (Soft Delete)" : "Delete"}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSoftDeleteCity(city);
                                                                    }}
                                                                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                                >
                                                                    <TrashIcon size={14} />
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
                        <h3>{isTr ? 'Harita Versiyon Yedeği Geçmişi' : 'Map Version Backup History'}</h3>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px' }}>
                            {isTr 
                                ? 'Daha önce "Değişiklikleri Kaydet" butonuna her bastığınızda eski harita sürümleri otomatik olarak yedeklenir. İstediğiniz sürümü tek tıkla geri yükleyebilirsiniz.' 
                                : 'Previous map versions are automatically backed up whenever you click "Save Changes". You can restore any previous version with a single click.'}
                        </p>

                        <div className="backup-list-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                            {backupsList.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                    {isTr ? 'Henüz geçmiş bir harita yedeği bulunmuyor.' : 'No backup versions found yet.'}
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
                                            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                            borderRadius: '8px',
                                            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: '14px' }}>
                                                {b.dateStr}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                                {b.note || (isTr ? 'Otomatik Harita Yedeği' : 'Automatic Map Backup')} ({b.citiesCount || 81} {isTr ? 'Aktif İl' : 'Active Provinces'})
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                                onClick={() => handleRestoreBackup(b)}
                                            >
                                                {isTr ? 'Bu Yedeği Yükle' : 'Restore This Backup'}
                                            </button>
                                            <button
                                                className="admin-action-btn delete-icon-btn"
                                                title={isTr ? "Yedeği Sil" : "Delete Backup"}
                                                onClick={() => handleDeleteBackup(b.id)}
                                                style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                            >
                                                <TrashIcon size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="modal-footer" style={{ marginTop: '20px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setIsBackupModalOpen(false)}>{isTr ? 'Kapat' : 'Close'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit City / Maritime Zone */}
            {isEditModalOpen && (
                <div className="admin-modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
                    <div className="admin-modal-content" style={{
                        maxWidth: '520px',
                        width: '90%',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        boxShadow: 'none',
                        padding: '24px 28px',
                        background: '#1e293b'
                    }}>
                        {(() => {
                            const isMaritime = formData.isMaritime || formData.entityType === 'MARITIME' || (selectedCity && selectedCity.isMaritime);
                            return (
                                <>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                                        {isMaritime ? (isTr ? `Deniz Yetki Alanı Düzenle: ${formData.name}` : `Edit Maritime Zone: ${formData.name}`) : (isTr ? `İl / Bölge Düzenle: ${formData.name}` : `Edit Province / Region: ${formData.name}`)}
                                    </h3>
                                    <div className="form-group" style={{ marginBottom: '14px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                            {isMaritime ? (isTr ? 'Deniz Alan Kodu / No (901-999):' : 'Maritime Code / ID (901-999):') : (isTr ? 'Plaka Kodu (Değiştirilebilir):' : 'Plate Code / ID:')}
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.plate}
                                            onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                            className="form-control"
                                            style={{
                                                height: '38px',
                                                borderRadius: '6px',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #334155',
                                                color: '#ffffff',
                                                padding: '8px 12px',
                                                fontSize: '13px'
                                            }}
                                            placeholder={isMaritime ? (isTr ? 'Deniz Alan Kodu (901-999)' : 'Maritime Code (901-999)') : (isTr ? 'Plaka Kodu' : 'Plate Code')}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '14px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                            {isMaritime ? (isTr ? 'Deniz Alanı / Havza Adı:' : 'Maritime Area / Basin Name:') : (isTr ? 'İl Adı:' : 'Province Name:')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="form-control"
                                            style={{
                                                height: '38px',
                                                borderRadius: '6px',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #334155',
                                                color: '#ffffff',
                                                padding: '8px 12px',
                                                fontSize: '13px'
                                            }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '14px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                            {isMaritime ? (isTr ? 'Deniz Havzası:' : 'Sea Basin:') : (isTr ? 'Coğrafi Bölge (İsteğe Bağlı):' : 'Geographical Region (Optional):')}
                                        </label>
                                        {isMaritime ? (
                                            <select
                                                value={formData.region || 'Karadeniz'}
                                                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                                className="form-control"
                                                style={{
                                                    height: '38px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#0f172a',
                                                    border: '1px solid #334155',
                                                    color: '#ffffff',
                                                    padding: '8px 12px',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <option value="Karadeniz">Karadeniz</option>
                                                <option value="Marmara Denizi">Marmara Denizi</option>
                                                <option value="Boğazlar">Boğazlar</option>
                                                <option value="Ege Denizi">Ege Denizi</option>
                                                <option value="Akdeniz">Akdeniz</option>
                                                <option value="Körfezler">Körfezler</option>
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    list="region-options-list-edit"
                                                    value={formData.region || ''}
                                                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                                    className="form-control"
                                                    style={{
                                                        height: '38px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#0f172a',
                                                        border: '1px solid #334155',
                                                        color: '#ffffff',
                                                        padding: '8px 12px',
                                                        fontSize: '13px'
                                                    }}
                                                    placeholder={isTr ? "Listeden seçin veya yeni bölge adı yazın..." : "Select from list or type custom region name..."}
                                                />
                                                <datalist id="region-options-list-edit">
                                                    {availableRegions.map(r => (
                                                        <option key={r} value={r} />
                                                    ))}
                                                </datalist>
                                                <small style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                                    {isTr 
                                                        ? 'İsteğe bağlıdır. Mevcut bölgelerden seçebilir veya doğrudan yeni bir bölge ismi yazabilirsiniz.' 
                                                        : 'Optional. Choose an existing region or enter a new region name.'}
                                                </small>
                                            </>
                                        )}
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                            {isTr ? 'Sınır WKT Dizgisi (Well-Known Text):' : 'Boundary WKT (Well-Known Text):'}
                                        </label>
                                        <textarea
                                            rows="4"
                                            value={formData.wkt}
                                            onChange={(e) => setFormData({ ...formData, wkt: e.target.value })}
                                            className="form-control code-text"
                                            style={{
                                                borderRadius: '6px',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #334155',
                                                color: '#38bdf8',
                                                padding: '8px 12px',
                                                fontSize: '12px',
                                                fontFamily: 'monospace'
                                            }}
                                            placeholder="POLYGON((lon lat, ...))"
                                        />
                                    </div>
                                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                        <button
                                            type="button"
                                            style={{
                                                height: '36px',
                                                padding: '0 16px',
                                                borderRadius: '6px',
                                                backgroundColor: '#334155',
                                                border: '1px solid #475569',
                                                color: '#cbd5e1',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setIsEditModalOpen(false)}
                                        >
                                            {isTr ? 'İptal' : 'Cancel'}
                                        </button>
                                        <button
                                            type="button"
                                            style={{
                                                height: '36px',
                                                padding: '0 20px',
                                                borderRadius: '6px',
                                                background: '#2563eb',
                                                border: '1px solid #1d4ed8',
                                                color: '#ffffff',
                                                fontSize: '12.5px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                boxShadow: 'none'
                                            }}
                                            onClick={handleSaveEdit}
                                        >
                                            {isMaritime ? (isTr ? 'Deniz Alanını Güncelle' : 'Update Maritime Zone') : (isTr ? 'Değişiklikleri Kaydet' : 'Save Changes')}
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Modal: Add New City / Maritime Zone (DÜZ FLAT MODAL) */}
            {isAddModalOpen && (
                <div className="admin-modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
                    <div className="admin-modal-content" style={{
                        maxWidth: '520px',
                        width: '90%',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        boxShadow: 'none',
                        padding: '24px 28px',
                        background: '#1e293b'
                    }}>
                        <h3 style={{
                            margin: '0 0 16px 0',
                            fontSize: '17px',
                            fontWeight: 800,
                            color: '#ffffff',
                            letterSpacing: '-0.3px'
                        }}>
                            {formData.entityType === 'MARITIME' ? (formData.wkt ? (isTr ? 'Yeni Deniz Alanı Poligonunu Kaydet' : 'Save New Maritime Polygon') : (isTr ? 'Yeni Deniz Yetki Alanı Ekle' : 'Add New Maritime Zone')) : (formData.wkt ? (isTr ? 'Yeni İl / Bölge Poligonunu Kaydet' : 'Save New Province Polygon') : (isTr ? 'Yeni İl / Bölge Ekle' : 'Add New Province / Region'))}
                        </h3>
                        
                        {/* POLİGON TÜRÜ SEÇİCİ (İL / DENİZ) */}
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                            marginBottom: '16px',
                            background: '#0f172a',
                            padding: '4px',
                            borderRadius: '8px',
                            border: '1px solid #334155'
                        }}>
                            <button
                                type="button"
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontWeight: formData.entityType !== 'MARITIME' ? 700 : 500,
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: formData.entityType !== 'MARITIME' ? '#2563eb' : 'transparent',
                                    color: formData.entityType !== 'MARITIME' ? '#ffffff' : '#94a3b8',
                                    boxShadow: 'none',
                                    transition: 'all 0.15s ease'
                                }}
                                onClick={() => {
                                    const nextPlate = Math.max(0, ...cities.filter(c => !c.isDeleted).map(c => Number(c.plate) || 0)) + 1;
                                    setFormData({ ...formData, entityType: 'LAND', plate: nextPlate.toString(), region: 'Marmara Bölgesi' });
                                }}
                            >
                                {isTr ? 'İl / Kara Bölgesi' : 'Province / Land'}
                            </button>
                            <button
                                type="button"
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontWeight: formData.entityType === 'MARITIME' ? 700 : 500,
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: formData.entityType === 'MARITIME' ? '#0284c7' : 'transparent',
                                    color: formData.entityType === 'MARITIME' ? '#ffffff' : '#94a3b8',
                                    boxShadow: 'none',
                                    transition: 'all 0.15s ease'
                                }}
                                onClick={() => {
                                    const nextPlate = Math.max(900, ...maritimeZones.filter(m => !m.isDeleted).map(m => Number(m.plate) || 0)) + 1;
                                    setFormData({ ...formData, entityType: 'MARITIME', plate: nextPlate.toString(), region: 'Karadeniz' });
                                }}
                            >
                                {isTr ? 'Deniz Yetki Alanı' : 'Maritime Zone'}
                            </button>
                        </div>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                {formData.entityType === 'MARITIME' ? (isTr ? 'Deniz Alan Kodu / No (901-999):' : 'Maritime Code / ID (901-999):') : (isTr ? 'Plaka Kodu / ID (Benzersiz Olmalıdır):' : 'Plate Code / Unique ID:')}
                            </label>
                            <input
                                type="number"
                                value={formData.plate}
                                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                className="form-control"
                                style={{
                                    height: '38px',
                                    borderRadius: '6px',
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    color: '#ffffff',
                                    padding: '8px 12px',
                                    fontSize: '13px'
                                }}
                                placeholder={formData.entityType === 'MARITIME' ? (isTr ? 'Örn: 913' : 'e.g. 913') : (isTr ? 'Örn: 82' : 'e.g. 82')}
                            />
                            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                                {formData.entityType === 'MARITIME' ? (isTr ? 'Deniz alanları için 901-999 arası benzersiz kod kullanılır.' : 'Unique code between 901-999 is used for maritime zones.') : (isTr ? 'Not: Bu ID diğer kayıtlı illerle aynı olamaz.' : 'Note: This ID must be unique among registered provinces.')}
                            </small>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                {formData.entityType === 'MARITIME' ? (isTr ? 'Deniz Alanı / Havza Adı:' : 'Maritime Area / Basin Name:') : (isTr ? 'İl Adı:' : 'Province Name:')}
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="form-control"
                                style={{
                                    height: '38px',
                                    borderRadius: '6px',
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    color: '#ffffff',
                                    padding: '8px 12px',
                                    fontSize: '13px'
                                }}
                                placeholder={formData.entityType === 'MARITIME' ? (isTr ? 'Örn: Çandarlı Körfezi Yetki Alanı' : 'e.g. Candarli Gulf Zone') : (isTr ? 'Örn: Yalova' : 'e.g. Yalova')}
                                autoFocus
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                                {formData.entityType === 'MARITIME' ? (isTr ? 'Deniz Havzası:' : 'Sea Basin:') : (isTr ? 'Coğrafi Bölge (İsteğe Bağlı):' : 'Geographical Region (Optional):')}
                            </label>
                            {formData.entityType === 'MARITIME' ? (
                                <select
                                    value={formData.region || 'Karadeniz'}
                                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                    className="form-control"
                                    style={{
                                        height: '38px',
                                        borderRadius: '6px',
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        color: '#ffffff',
                                        padding: '8px 12px',
                                        fontSize: '13px'
                                    }}
                                >
                                    <option value="Karadeniz">Karadeniz</option>
                                    <option value="Marmara">Marmara Denizi</option>
                                    <option value="Boğazlar">Boğazlar</option>
                                    <option value="Ege Denizi">Ege Denizi</option>
                                    <option value="Akdeniz">Akdeniz</option>
                                    <option value="Körfezler">Körfezler</option>
                                </select>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        list="region-options-list-add"
                                        value={formData.region || ''}
                                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                        className="form-control"
                                        style={{
                                            height: '38px',
                                            borderRadius: '6px',
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #334155',
                                            color: '#ffffff',
                                            padding: '8px 12px',
                                            fontSize: '13px'
                                        }}
                                        placeholder={isTr ? "Listeden seçin veya yeni bölge adı yazın..." : "Select from list or type region name..."}
                                    />
                                    <datalist id="region-options-list-add">
                                        {availableRegions.map(r => (
                                            <option key={r} value={r} />
                                        ))}
                                    </datalist>
                                </>
                            )}
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>{isTr ? 'Sınır WKT Poligonu:' : 'Boundary WKT Polygon:'}</label>
                                <button
                                    type="button"
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        background: '#334155',
                                        border: '1px solid #475569',
                                        color: '#38bdf8',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        toggleMapTool('draw');
                                    }}
                                >
                                    {isTr ? 'Haritada Çiz' : 'Draw on Map'}
                                </button>
                            </div>
                            <textarea
                                rows="3"
                                value={formData.wkt}
                                onChange={(e) => setFormData({ ...formData, wkt: e.target.value })}
                                className="form-control code-text"
                                style={{
                                    borderRadius: '6px',
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    color: '#38bdf8',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontFamily: 'monospace'
                                }}
                                placeholder={isTr ? "Haritadan çizebilir veya WKT yapıştırabilirsiniz: POLYGON((32.8 39.9, ...))" : "Draw on map or paste WKT: POLYGON((32.8 39.9, ...))"}
                            />
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button
                                type="button"
                                style={{
                                    height: '36px',
                                    padding: '0 16px',
                                    borderRadius: '6px',
                                    backgroundColor: '#334155',
                                    border: '1px solid #475569',
                                    color: '#cbd5e1',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={handleCancelAdd}
                            >
                                {isTr ? 'İptal' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                style={{
                                    height: '36px',
                                    padding: '0 20px',
                                    borderRadius: '6px',
                                    background: '#2563eb',
                                    border: '1px solid #1d4ed8',
                                    color: '#ffffff',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                                }}
                                onClick={handleSaveAdd}
                            >
                                {formData.entityType === 'MARITIME' ? (isTr ? 'Deniz Alanını Kaydet' : 'Save Maritime Zone') : (isTr ? 'İli Kaydet' : 'Save Province')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
