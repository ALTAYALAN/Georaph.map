import React, { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../../services/adminApi';
import { POI_ICON_LIST, getGlyphByIconId, getLocalizedPoiCategoryLabel, getCategoryBullet } from '../../constants/poiIcons';
import { TURKISH_AIRPORTS } from '../../constants/airports';

export function getCategoryTag(categoryName = '') {
    return `[${categoryName || 'Kategori'}]`;
}

export function parsePoiImages(raw) {
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

export function serializePoiImages(images = []) {
    if (!Array.isArray(images) || images.length === 0) return null;
    const clean = images.filter(x => typeof x === 'string' && x.trim());
    if (clean.length === 0) return null;
    if (clean.length === 1) return clean[0];
    return JSON.stringify(clean);
}

const PoiCategoryGlyph = ({ iconId = '', size = 18, color = 'currentColor', style = {} }) => {
    const glyph = getGlyphByIconId(iconId);
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            style={{ display: 'inline-block', verticalAlign: 'middle', color: color, ...style }}
            dangerouslySetInnerHTML={{ __html: glyph }}
        />
    );
};

// SVG Icons
const MapPinIcon = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const FolderIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const ClockIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const PlusIcon = ({ size = 16, strokeWidth = 3, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const EditIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const UserIcon = ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const SearchIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const ChevronRightIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export const PoiManagement = ({ token, isDarkMode, lang: propLang }) => {
    const lang = propLang || localStorage.getItem('lang') || 'tr';
    const isTr = lang === 'tr';
    const [subTab, setSubTab] = useState('pois'); // 'pois' | 'categories'
    const [pois, setPois] = useState([]);
    const [categories, setCategories] = useState([]);
    const [categoryTree, setCategoryTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Filtreler & Arama
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

    // POI Modal State
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [editingPoi, setEditingPoi] = useState(null);
    const [poiParentCategoryId, setPoiParentCategoryId] = useState('');
    const [poiTimeDays, setPoiTimeDays] = useState('Hafta İçi');
    const [poiTimeStart, setPoiTimeStart] = useState('08:30');
    const [poiTimeEnd, setPoiTimeEnd] = useState('18:00');
    const [poiIs24Hours, setPoiIs24Hours] = useState(false);
    // POI Form State
    const [poiFormData, setPoiFormData] = useState({
        name: '',
        description: '',
        categoryId: '',
        workingHours: 'Hafta İçi 08:30 - 18:00',
        images: [],
        customImageUrl: '',
        wkt: 'POINT(32.8597 39.9334)',
        isActive: true
    });
    const [uploadingPoiImage, setUploadingPoiImage] = useState(false);

    // Kategori Ağaç / Cascading Seçim Yardımcıları
    const parentCategories = useMemo(() => {
        return categories.filter(c => !c.parentId);
    }, [categories]);

    const currentSubCategories = useMemo(() => {
        if (!poiParentCategoryId) return [];
        return categories.filter(c => c.parentId === parseInt(poiParentCategoryId, 10));
    }, [categories, poiParentCategoryId]);

    const activeCategoryObject = useMemo(() => {
        if (!poiFormData.categoryId) return null;
        return categories.find(c => c.id === parseInt(poiFormData.categoryId, 10)) || null;
    }, [categories, poiFormData.categoryId]);

    // Kategori Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [categoryFormData, setCategoryFormData] = useState({
        name: '',
        description: '',
        parentId: '',
        color: '#3b82f6',
        icon: 'utensils',
        displayOrder: 1,
        isActive: true
    });

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            const [poisData, catsData, treeData] = await Promise.all([
                adminApi.getPois(null, true, token).catch(err => {
                    console.warn('POI listesi yüklenemedi:', err);
                    return [];
                }),
                adminApi.getPoiCategories(true, token).catch(err => {
                    console.warn('Kategoriler yüklenemedi:', err);
                    return [];
                }),
                adminApi.getPoiCategoryTree(token).catch(err => {
                    console.warn('Kategori ağacı yüklenemedi:', err);
                    return [];
                })
            ]);
            
            // Türkiye Havalimanlarını POI listesiyle birleştir (Havalimanı & Uçuş kategorisi)
            const airportPois = (TURKISH_AIRPORTS || []).map((apt, idx) => ({
                id: `airport_${apt.id || idx}`,
                name: apt.name,
                description: `${apt.type} • ${apt.runways} • ${apt.region} Bölgesi • ${apt.description || ''}`,
                categoryId: 999901,
                categoryName: 'Havalimanı & Uçuş',
                parentCategoryName: 'Ulaşım',
                categoryColor: '#0284c7',
                categoryIcon: 'plane',
                workingHours: '7/24 Açık (24 Saat Kesintisiz Uçuş)',
                imageUrl: apt.imageUrl,
                wkt: `POINT(${apt.coordinates[0]} ${apt.coordinates[1]})`,
                longitude: apt.coordinates[0],
                latitude: apt.coordinates[1],
                username: 'Devlet Hava Meydanları (DHMİ)',
                userId: 1,
                isActive: true,
                isDeleted: false,
                isSystemAirport: true
            }));

            // Sistem havalimanları kategorisini kategori listesine ekle
            const airportCategory = {
                id: 999901,
                name: 'Havalimanı & Uçuş',
                description: 'Türkiye sivil ve uluslararası havalimanları, terminaller ve pistler',
                color: '#0284c7',
                icon: 'plane',
                displayOrder: 0,
                poiCount: airportPois.length,
                isActive: true
            };

            const finalCats = Array.isArray(catsData) ? [...catsData] : [];
            if (!finalCats.some(c => c.name === 'Havalimanı & Uçuş' || c.id === 999901)) {
                finalCats.unshift(airportCategory);
            }

            const combinedPois = [...airportPois, ...(Array.isArray(poisData) ? poisData : [])];
            setPois(combinedPois);
            setCategories(finalCats);
            setCategoryTree(Array.isArray(treeData) ? treeData : []);
        } catch (err) {
            console.error('Veriler yüklenirken hata oluştu:', err);
            setError(err.message || 'Veriler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    const showNotification = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    // ==========================================
    // POI MODAL & CRUD İŞLEMLERİ
    // ==========================================
    const handleOpenPoiModal = (poi = null) => {
        setError('');
        let currentCats = categories;
        if ((!currentCats || currentCats.length === 0) && poi) {
            currentCats = [{ id: poi.categoryId, name: poi.categoryName || 'Kategori' }];
        }

        if (poi) {
            setEditingPoi(poi);
            const foundCat = (currentCats || []).find(c => c.id === poi.categoryId);
            if (foundCat && foundCat.parentId) {
                setPoiParentCategoryId(foundCat.parentId.toString());
            } else if (foundCat) {
                setPoiParentCategoryId(foundCat.id.toString());
            } else {
                setPoiParentCategoryId('');
            }

            const wh = poi.workingHours || '';
            const is24h = wh.toLowerCase().includes('24 saat');
            setPoiIs24Hours(is24h);
            setPoiTimeDays(wh.includes('Her Gün') ? 'Her Gün' : wh.includes('Pzt - Cmt') ? 'Pzt - Cmt' : wh.includes('Hafta Sonu') ? 'Hafta Sonu' : 'Hafta İçi');

            const timeMatch = wh.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
            if (timeMatch) {
                setPoiTimeStart(timeMatch[1]);
                setPoiTimeEnd(timeMatch[2]);
            } else {
                setPoiTimeStart('08:30');
                setPoiTimeEnd('18:00');
            }

            setPoiFormData({
                name: poi.name || '',
                description: poi.description || '',
                categoryId: poi.categoryId || (currentCats.length > 0 ? currentCats[0].id : ''),
                workingHours: poi.workingHours || 'Hafta İçi 08:30 - 18:00',
                images: parsePoiImages(poi.imageUrl),
                customImageUrl: '',
                wkt: poi.wkt || '',
                isActive: poi.isActive !== false
            });
        } else {
            setEditingPoi(null);
            const defaultParent = (currentCats || []).find(c => !c.parentId) || (currentCats || [])[0];
            const defaultChild = defaultParent ? (currentCats || []).find(c => c.parentId === defaultParent.id) : null;
            const chosenCat = defaultChild || defaultParent;

            if (defaultParent) {
                setPoiParentCategoryId(defaultParent.id.toString());
            } else {
                setPoiParentCategoryId('');
            }

            setPoiTimeDays('Hafta İçi');
            setPoiTimeStart('08:30');
            setPoiTimeEnd('18:00');
            setPoiIs24Hours(false);

            setPoiFormData({
                name: '',
                description: '',
                categoryId: chosenCat ? chosenCat.id : '',
                workingHours: 'Hafta İçi 08:30 - 18:00',
                images: [],
                customImageUrl: '',
                wkt: 'POINT(32.8597 39.9334)',
                isActive: true
            });
        }
        setShowPoiModal(true);
    };

    const handlePoiParentCatChange = (newParentId) => {
        const pId = parseInt(newParentId, 10);
        setPoiParentCategoryId(newParentId);
        const subs = categories.filter(c => c.parentId === pId);
        if (subs.length > 0) {
            setPoiFormData(prev => ({ ...prev, categoryId: subs[0].id }));
        } else {
            setPoiFormData(prev => ({ ...prev, categoryId: pId }));
        }
    };

    const handlePoiSubCatChange = (newSubCatId) => {
        setPoiFormData(prev => ({ ...prev, categoryId: parseInt(newSubCatId, 10) }));
    };

    const handleSavePoi = async (e) => {
        e.preventDefault();
        if (!poiFormData.name.trim()) {
            setError('Lütfen POI adını giriniz.');
            return;
        }
        if (!poiFormData.categoryId) {
            setError('Lütfen bir kategori seçiniz.');
            return;
        }

        const serializedImage = serializePoiImages(poiFormData.images);

        try {
            if (editingPoi) {
                await adminApi.updatePoi(editingPoi.id, {
                    name: poiFormData.name.trim(),
                    description: poiFormData.description?.trim(),
                    categoryId: parseInt(poiFormData.categoryId, 10),
                    workingHours: poiFormData.workingHours?.trim(),
                    imageUrl: serializedImage,
                    wkt: poiFormData.wkt,
                    isActive: poiFormData.isActive
                }, token);
                showNotification('POI başarıyla güncellendi.');
            } else {
                await adminApi.createPoi({
                    name: poiFormData.name.trim(),
                    description: poiFormData.description?.trim(),
                    categoryId: parseInt(poiFormData.categoryId, 10),
                    workingHours: poiFormData.workingHours?.trim(),
                    imageUrl: serializedImage,
                    wkt: poiFormData.wkt
                }, token);
                showNotification('Yeni POI başarıyla eklendi.');
            }
            setShowPoiModal(false);
            loadData();
        } catch (err) {
            setError(err.message || 'POI kaydedilemedi.');
        }
    };

    const handleDeletePoi = async (id, name) => {
        if (!window.confirm(`"${name}" adlı POI kaydını silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deletePoi(id, token);
            showNotification('POI başarıyla silindi.');
            loadData();
        } catch (err) {
            setError(err.message || 'POI silinemedi.');
        }
    };

    // Kategori CRUD
    const handleOpenCategoryModal = (cat = null, defaultParentId = '') => {
        setIconSearchQuery('');
        if (cat) {
            setEditingCategory(cat);
            setCategoryFormData({
                name: cat.name || '',
                description: cat.description || '',
                parentId: cat.parentId || '',
                color: cat.color || '#3b82f6',
                icon: (cat.icon || 'utensils').replace('fa-', ''),
                displayOrder: cat.displayOrder || 1,
                isActive: cat.isActive !== false
            });
        } else {
            const parentObj = defaultParentId ? categories.find(c => c.id === parseInt(defaultParentId, 10)) : null;
            setEditingCategory(null);
            setCategoryFormData({
                name: '',
                description: '',
                parentId: defaultParentId || '',
                color: parentObj?.color || '#3b82f6',
                icon: (parentObj?.icon || 'utensils').replace('fa-', ''),
                displayOrder: parentObj?.displayOrder || 1,
                isActive: true
            });
        }
        setShowCategoryModal(true);
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!categoryFormData.name.trim()) {
            setError('Lütfen kategori adını giriniz.');
            return;
        }

        try {
            const payload = {
                name: categoryFormData.name.trim(),
                description: categoryFormData.description?.trim(),
                parentId: categoryFormData.parentId ? parseInt(categoryFormData.parentId, 10) : null,
                color: categoryFormData.color,
                icon: categoryFormData.icon,
                displayOrder: parseInt(categoryFormData.displayOrder, 10) || 1,
                isActive: categoryFormData.isActive
            };

            if (editingCategory) {
                await adminApi.updatePoiCategory(editingCategory.id, payload, token);
                showNotification('Kategori başarıyla güncellendi.');
            } else {
                await adminApi.createPoiCategory(payload, token);
                showNotification('Yeni kategori başarıyla oluşturuldu.');
            }
            setShowCategoryModal(false);
            window.dispatchEvent(new CustomEvent('poiCategoriesUpdated'));
            loadData();
        } catch (err) {
            setError(err.message || 'Kategori kaydedilemedi.');
        }
    };

    const handleDeleteCategory = async (id, name) => {
        if (!window.confirm(`"${name}" kategorisini ve alt kategorilerini silmek istediğinize emin misiniz?`)) return;
        try {
            await adminApi.deletePoiCategory(id, token);
            showNotification('Kategori başarıyla silindi.');
            window.dispatchEvent(new CustomEvent('poiCategoriesUpdated'));
            loadData();
        } catch (err) {
            setError(err.message || 'Kategori silinemedi.');
        }
    };

    // Hiyerarşik Sıralı Kategoriler (Ana Kategori ve Altında Kendi Çocukları)
    const hierarchicalCategoryGroups = useMemo(() => {
        const roots = (categories || []).filter(c => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name, 'tr'));
        return roots.map(root => {
            const children = (categories || []).filter(c => c.parentId === root.id).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name, 'tr'));
            return {
                root,
                children
            };
        });
    }, [categories]);

    // Ana Kategori Filtre Butonları (Sayaçlar & Renkler)
    const rootCategoryPills = useMemo(() => {
        const roots = (categories || []).filter(c => !c.parentId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name, 'tr'));
        return roots.map(root => {
            const childIds = (categories || []).filter(c => c.parentId === root.id).map(c => c.id);
            const allIds = new Set([root.id, ...childIds]);
            const count = (pois || []).filter(p => allIds.has(p.categoryId)).length;
            return {
                id: root.id,
                name: root.name,
                color: root.color || '#3b82f6',
                icon: root.icon,
                count
            };
        });
    }, [categories, pois]);

    // Filtrelenmiş POI'ler (Ana kategori seçildiğinde tüm alt kategorilerini de kapsar)
    const filteredPois = useMemo(() => {
        return (pois || []).filter(p => {
            const matchesSearch = !searchTerm ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.parentCategoryName?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesCategory = true;
            if (selectedCategoryFilter) {
                const targetId = parseInt(selectedCategoryFilter, 10);
                const childIds = (categories || []).filter(c => c.parentId === targetId).map(c => c.id);
                const allTargetIds = new Set([targetId, ...childIds]);
                matchesCategory = allTargetIds.has(p.categoryId);
            }

            return matchesSearch && matchesCategory;
        });
    }, [pois, searchTerm, selectedCategoryFilter, categories]);

    return (
        <div className="admin-content-card">
            {/* Üst Başlık ve Ana Eylem Butonu */}
            <div className="admin-header">
                <div>
                    <h2>{isTr ? 'POI & Hiyerarşik Kategori Yönetimi' : 'POI & Hierarchical Category Management'}</h2>
                    <p>{isTr ? 'Önemli konum noktalarını (POI) ve Parent-Child hiyerarşik kategorilerini yönetin.' : 'Manage Points of Interest (POI) and parent-child hierarchical categories.'}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {subTab === 'pois' && (
                        <button className="admin-primary-btn" onClick={() => handleOpenPoiModal()}>
                            <PlusIcon size={16} strokeWidth={3} /> {isTr ? 'Yeni POI Ekle' : 'Add New POI'}
                        </button>
                    )}
                </div>
            </div>

            {/* Bildirim ve Hata Mesajları */}
            {error && <div className="admin-alert error">{error}</div>}
            {successMessage && <div className="admin-alert success">{successMessage}</div>}

            {/* Sekme Değiştirici */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px', gap: '8px' }}>
                <button
                    onClick={() => setSubTab('pois')}
                    style={{
                        padding: '10px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: subTab === 'pois' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                        color: subTab === 'pois' ? '#3b82f6' : '#94a3b8',
                        fontWeight: subTab === 'pois' ? '700' : '500',
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <MapPinIcon size={16} color={subTab === 'pois' ? '#3b82f6' : 'currentColor'} />
                    <span>{isTr ? 'POI Listesi' : 'POI List'}</span>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', backgroundColor: subTab === 'pois' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.08)', color: subTab === 'pois' ? '#3b82f6' : '#94a3b8', fontWeight: 700 }}>
                        {pois.length}
                    </span>
                </button>
                <button
                    onClick={() => setSubTab('categories')}
                    style={{
                        padding: '10px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: subTab === 'categories' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                        color: subTab === 'categories' ? '#3b82f6' : '#94a3b8',
                        fontWeight: subTab === 'categories' ? '700' : '500',
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <FolderIcon size={16} />
                    <span>{isTr ? 'Hiyerarşik Kategori Ağacı' : 'Category Tree'}</span>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', backgroundColor: subTab === 'categories' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.08)', color: subTab === 'categories' ? '#3b82f6' : '#94a3b8', fontWeight: 700 }}>
                        {categories.length}
                    </span>
                </button>
            </div>

            {/* SEKME 1: POI LİSTESİ */}
            {subTab === 'pois' && (
                <div>
                    {/* Kategori Hızlı Filtre Butonları (Vektör İkonlar & Renkler) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter('')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: !selectedCategoryFilter ? 700 : 600,
                                border: `1.5px solid ${!selectedCategoryFilter ? '#3b82f6' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                                backgroundColor: !selectedCategoryFilter ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff') : 'transparent',
                                color: !selectedCategoryFilter ? (isDarkMode ? '#60a5fa' : '#2563eb') : (isDarkMode ? '#94a3b8' : '#64748b'),
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                            </svg>
                            <span>{isTr ? 'Tüm Kategoriler' : 'All Categories'}</span>
                            <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '10px', backgroundColor: !selectedCategoryFilter ? '#3b82f6' : (isDarkMode ? '#334155' : '#e2e8f0'), color: !selectedCategoryFilter ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 700 }}>
                                {pois.length}
                            </span>
                        </button>
                        {rootCategoryPills.map(rp => {
                            const isSelected = selectedCategoryFilter === rp.id.toString();
                            return (
                                <button
                                    key={rp.id}
                                    type="button"
                                    onClick={() => setSelectedCategoryFilter(isSelected ? '' : rp.id.toString())}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: isSelected ? 700 : 600,
                                        border: `1.5px solid ${isSelected ? rp.color : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                                        backgroundColor: isSelected ? (isDarkMode ? `${rp.color}25` : '#eff6ff') : 'transparent',
                                        color: isSelected ? (isDarkMode ? '#ffffff' : rp.color) : (isDarkMode ? '#94a3b8' : '#64748b'),
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: rp.color, display: 'inline-block' }} />
                                    <PoiCategoryGlyph iconId={rp.icon} size={14} color={isSelected ? (isDarkMode ? '#ffffff' : rp.color) : rp.color} />
                                    <span>{getLocalizedPoiCategoryLabel(rp.name, lang)}</span>
                                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '10px', backgroundColor: isSelected ? rp.color : (isDarkMode ? '#334155' : '#e2e8f0'), color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#64748b'), fontWeight: 700 }}>
                                        {rp.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Arama ve Filtre Çubuğu */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <SearchIcon />
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                style={{ paddingLeft: '36px', height: '38px' }}
                                placeholder={isTr ? "POI adı, kullanıcı veya kategori ara..." : "Search POI name, user or category..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-control"
                            style={{ width: '280px', height: '38px', fontWeight: 600, fontSize: '12.5px' }}
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        >
                            <option value="">⚪ {isTr ? 'Tüm Kategoriler' : 'All Categories'} ({categories.length})</option>
                            {hierarchicalCategoryGroups.map(({ root, children }) => {
                                const bullet = getCategoryBullet(root.name, root.color);
                                return (
                                    <optgroup key={root.id} label={`${bullet} [${getLocalizedPoiCategoryLabel(root.name, lang)}]`}>
                                        <option value={root.id} style={{ fontWeight: 700 }}>
                                            {bullet} [{isTr ? 'Tümü' : 'All'}] {getLocalizedPoiCategoryLabel(root.name, lang)}
                                        </option>
                                        {children.map(child => {
                                            return (
                                                <option key={child.id} value={child.id}>
                                                    &nbsp;&nbsp;{bullet} {getLocalizedPoiCategoryLabel(child.name, lang)}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                );
                            })}
                        </select>
                    </div>

                    {/* Tablo */}
                    {loading ? (
                        <div className="admin-loading">{isTr ? 'POI verileri yükleniyor...' : 'Loading POI data...'}</div>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>{isTr ? 'POI Adı' : 'POI Name'}</th>
                                        <th>{isTr ? 'Kategori / Üst Kategori' : 'Category / Parent'}</th>
                                        <th>{isTr ? 'Mesai Saatleri' : 'Working Hours'}</th>
                                        <th>{isTr ? 'Ekleyen Kullanıcı' : 'Created By'}</th>
                                        <th>{isTr ? 'Kayıt Tarihi' : 'Date'}</th>
                                        <th>{isTr ? 'Durum' : 'Status'}</th>
                                        <th style={{ textAlign: 'right' }}>{isTr ? 'İşlemler' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPois.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center" style={{ padding: '36px', color: '#94a3b8' }}>
                                                Kayıtlı POI noktası bulunamadı.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPois.map(poi => (
                                            <tr key={poi.id}>
                                                <td>#{poi.id}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div
                                                            style={{
                                                                width: '30px',
                                                                height: '30px',
                                                                borderRadius: '50%',
                                                                backgroundColor: poi.categoryColor || '#3b82f6',
                                                                color: '#ffffff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <PoiCategoryGlyph iconId={poi.categoryIcon || poi.categoryName} size={15} color="#ffffff" />
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <strong className="user-name">{poi.name}</strong>
                                                                {(() => {
                                                                    const imgs = parsePoiImages(poi.imageUrl);
                                                                    if (imgs.length === 0) return null;
                                                                    return (
                                                                        <span
                                                                            title={`${imgs.length} Fotoğraf`}
                                                                            style={{
                                                                                fontSize: '10px',
                                                                                fontWeight: 700,
                                                                                padding: '1px 5px',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe',
                                                                                color: '#0284c7',
                                                                                border: '1px solid rgba(2, 132, 199, 0.3)',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '3px'
                                                                            }}
                                                                        >
                                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                                            {imgs.length}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                            {poi.description && (
                                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{poi.description}</div>
                                                            )}
                                                            <div style={{ marginTop: '3px' }}>
                                                                {poi.wkt && poi.wkt.toUpperCase().startsWith('POLYGON') ? (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                                        Poligon POI
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                                        Nokta POI
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                padding: '3px 8px',
                                                                borderRadius: '6px',
                                                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#eff6ff',
                                                                border: `1px solid ${poi.categoryColor || '#3b82f6'}50`,
                                                                color: poi.categoryColor || '#3b82f6',
                                                                fontSize: '11.5px',
                                                                fontWeight: 700,
                                                                width: 'fit-content'
                                                            }}
                                                        >
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: poi.categoryColor || '#3b82f6', display: 'inline-block' }} />
                                                            <PoiCategoryGlyph iconId={poi.categoryIcon || 'map-pin'} size={13} color={poi.categoryColor || '#3b82f6'} />
                                                            <span>{getLocalizedPoiCategoryLabel(poi.categoryName, lang)}</span>
                                                        </span>
                                                        {poi.parentCategoryName && (
                                                            <span style={{ fontSize: '10.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <span>Üst:</span>
                                                                <strong style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>{getLocalizedPoiCategoryLabel(poi.parentCategoryName, lang)}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {poi.workingHours ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                                                            <ClockIcon size={13} />
                                                            <span>{poi.workingHours}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Belirtilmedi</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <UserIcon />
                                                        <strong>{poi.username}</strong>
                                                        <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>(#{poi.userId})</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                        {new Date(poi.createdDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${poi.isActive ? 'active' : 'inactive'}`}>
                                                        {poi.isActive ? 'Aktif' : 'Pasif'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            className="admin-action-btn edit-icon-btn"
                                                            title="Düzenle"
                                                            onClick={() => handleOpenPoiModal(poi)}
                                                        >
                                                            <EditIcon size={16} />
                                                        </button>
                                                        <button
                                                            className="admin-action-btn delete-icon-btn"
                                                            title="Sil"
                                                            onClick={() => handleDeletePoi(poi.id, poi.name)}
                                                        >
                                                            <TrashIcon size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* SEKME 2: HİYERARŞİK KATEGORİ YÖNETİMİ */}
            {subTab === 'categories' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                {isTr ? 'Hiyerarşik Kategori Ağacı' : 'Hierarchical Category Tree'}
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                {isTr ? 'Ana ve alt kategorileri (Parent-Child) yönetebilir, yeni alt kategoriler ekleyebilirsiniz.' : 'Manage root and subcategories (Parent-Child), add new subcategories and customize visibility.'}
                            </p>
                        </div>
                        <button className="admin-secondary-btn" onClick={() => handleOpenCategoryModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PlusIcon size={14} /> {isTr ? 'Yeni Ana Kategori' : 'Add Main Category'}
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading">{isTr ? 'Kategoriler yükleniyor...' : 'Loading categories...'}</div>
                    ) : categoryTree.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            {isTr ? 'Tanımlı kategori bulunamadı.' : 'No categories defined yet.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {categoryTree.map(parentCat => (
                                <div
                                    key={parentCat.id}
                                    style={{
                                        border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                                        boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.04)'
                                    }}
                                >
                                    {/* Ana Kategori Başlığı */}
                                    <div
                                        style={{
                                            padding: '12px 16px',
                                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: parentCat.children?.length > 0 ? (isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0') : 'none',
                                            flexWrap: 'wrap',
                                            gap: '10px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <div
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    backgroundColor: parentCat.color || '#3b82f6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <PoiCategoryGlyph iconId={parentCat.icon || parentCat.name} size={14} color="#ffffff" />
                                            </div>
                                            <strong style={{ fontSize: '14px', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                                {getLocalizedPoiCategoryLabel(parentCat.name, lang)}
                                            </strong>
                                            {parentCat.description && (
                                                <span style={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>— {parentCat.description}</span>
                                            )}
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: parentCat.displayOrder === 1 ? 'rgba(239, 68, 68, 0.15)' : parentCat.displayOrder === 2 ? 'rgba(249, 115, 22, 0.15)' : parentCat.displayOrder === 3 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                color: parentCat.displayOrder === 1 ? '#ef4444' : parentCat.displayOrder === 2 ? '#f97316' : parentCat.displayOrder === 3 ? '#3b82f6' : '#94a3b8',
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                                {isTr ? 'Öncelik:' : 'Priority:'} {parentCat.displayOrder || 1}
                                            </span>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>
                                                {parentCat.poiCount} POI
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                className="admin-secondary-btn"
                                                style={{ fontSize: '11.5px', padding: '4px 10px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                onClick={() => handleOpenCategoryModal(null, parentCat.id)}
                                            >
                                                <PlusIcon size={12} /> {isTr ? 'Alt Kategori Ekle' : 'Add Subcategory'}
                                            </button>
                                            <div className="action-buttons" style={{ marginLeft: '4px' }}>
                                                <button
                                                    className="admin-action-btn edit-icon-btn"
                                                    title={isTr ? "Kategoriyi Düzenle" : "Edit Category"}
                                                    onClick={() => handleOpenCategoryModal(parentCat)}
                                                >
                                                    <EditIcon size={14} />
                                                </button>
                                                <button
                                                    className="admin-action-btn delete-icon-btn"
                                                    title={isTr ? "Kategoriyi Sil" : "Delete Category"}
                                                    onClick={() => handleDeleteCategory(parentCat.id, parentCat.name)}
                                                >
                                                    <TrashIcon size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Alt Kategoriler Listesi */}
                                    {parentCat.children && parentCat.children.length > 0 ? (
                                        <div style={{ padding: '8px 16px 12px 32px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {parentCat.children.map(childCat => (
                                                <div
                                                    key={childCat.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                                                        border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
                                                        borderLeft: `3px solid ${childCat.color || parentCat.color || '#3b82f6'}`
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <ChevronRightIcon size={12} />
                                                        <div
                                                            style={{
                                                                width: '22px',
                                                                height: '22px',
                                                                borderRadius: '50%',
                                                                backgroundColor: childCat.color || parentCat.color || '#3b82f6',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#ffffff',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <PoiCategoryGlyph iconId={childCat.icon || childCat.name} size={11} color="#ffffff" />
                                                        </div>
                                                        <span style={{ fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                                            {getLocalizedPoiCategoryLabel(childCat.name, lang)}
                                                        </span>
                                                        {childCat.description && (
                                                            <span style={{ fontSize: '11.5px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>({childCat.description})</span>
                                                        )}
                                                        <span style={{
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: childCat.displayOrder === 1 ? 'rgba(239, 68, 68, 0.15)' : childCat.displayOrder === 2 ? 'rgba(249, 115, 22, 0.15)' : childCat.displayOrder === 3 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                            color: childCat.displayOrder === 1 ? '#ef4444' : childCat.displayOrder === 2 ? '#f97316' : childCat.displayOrder === 3 ? '#3b82f6' : '#94a3b8',
                                                            fontSize: '10px',
                                                            fontWeight: 700
                                                        }}>
                                                            {isTr ? 'Öncelik:' : 'Priority:'} {childCat.displayOrder || 1}
                                                        </span>
                                                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', color: '#059669', fontSize: '10.5px', fontWeight: 700 }}>
                                                            {childCat.poiCount} POI
                                                        </span>
                                                    </div>

                                                    <div className="action-buttons">
                                                        <button
                                                            className="admin-action-btn edit-icon-btn"
                                                            title={isTr ? "Alt Kategoriyi Düzenle" : "Edit Subcategory"}
                                                            onClick={() => handleOpenCategoryModal(childCat)}
                                                        >
                                                            <EditIcon size={13} />
                                                        </button>
                                                        <button
                                                            className="admin-action-btn delete-icon-btn"
                                                            title={isTr ? "Alt Kategoriyi Sil" : "Delete Subcategory"}
                                                            onClick={() => handleDeleteCategory(childCat.id, childCat.name)}
                                                        >
                                                            <TrashIcon size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '10px 16px 10px 32px', color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '12px' }}>
                                            {isTr ? 'Henüz bu ana kategoriye bağlı bir alt kategori bulunmuyor.' : 'No subcategories attached to this main category yet.'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* POI MODAL (Ekle / Düzenle) */}
            {showPoiModal && (
                <div className="modal-overlay" onClick={() => setShowPoiModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                {editingPoi ? (isTr ? 'POI Noktasını Düzenle' : 'Edit POI Location') : (isTr ? 'Yeni POI Ekle' : 'Add New POI')}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowPoiModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title={isTr ? "Kapat" : "Close"}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSavePoi}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'POI / Mekan İsmi *' : 'POI / Place Name *'}</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={isTr ? "Örn: Merkez İlçe Kütüphanesi, Şehir Hastanesi, Atatürk Parkı..." : "e.g. Central City Library, State Hospital, City Park..."}
                                        value={poiFormData.name}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: currentSubCategories.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                            <span>{isTr ? '1. Ana Kategori *' : '1. Main Category *'}</span>
                                        </label>
                                        <select
                                            className="form-control"
                                            value={poiParentCategoryId}
                                            onChange={(e) => handlePoiParentCatChange(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>{isTr ? '-- Ana Kategori Seçiniz --' : '-- Select Main Category --'}</option>
                                            {parentCategories.map(p => {
                                                const bullet = getCategoryBullet(p.name, p.color);
                                                return (
                                                    <option key={p.id} value={p.id}>
                                                        {bullet} {getLocalizedPoiCategoryLabel(p.name, lang)}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {currentSubCategories.length > 0 && (
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                                <span>{isTr ? '2. Alt Kategori (Dallanma) *' : '2. Subcategory *'}</span>
                                            </label>
                                            <select
                                                className="form-control"
                                                value={poiFormData.categoryId}
                                                onChange={(e) => handlePoiSubCatChange(e.target.value)}
                                                required
                                            >
                                                {currentSubCategories.map(sub => {
                                                    const parentCat = parentCategories.find(p => p.id === poiParentCategoryId);
                                                    const bullet = getCategoryBullet(sub.name || (parentCat && parentCat.name), sub.color || (parentCat && parentCat.color));
                                                    return (
                                                        <option key={sub.id} value={sub.id}>
                                                            {bullet} {getLocalizedPoiCategoryLabel(sub.name, lang)}
                                                        </option>
                                                    );
                                                })}
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
                                        background: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff',
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
                                        <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>{isTr ? 'Seçili Harita Rozeti:' : 'Selected Map Badge:'}</span>
                                        <strong style={{ color: activeCategoryObject.color || '#3b82f6', fontWeight: 600 }}>
                                            {activeCategoryObject.parentName 
                                                ? `${getLocalizedPoiCategoryLabel(activeCategoryObject.parentName, lang)} → ${getLocalizedPoiCategoryLabel(activeCategoryObject.name, lang)}` 
                                                : getLocalizedPoiCategoryLabel(activeCategoryObject.name, lang)}
                                        </strong>
                                    </div>
                                )}

                                {/* MESAI / ÇALIŞMA SAATLERİ SEÇİCİ */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Mesai / Çalışma Saatleri' : 'Working / Operating Hours'}</label>

                                    <div style={{ display: 'grid', gridTemplateColumns: poiIs24Hours ? '1fr' : '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                                        <div>
                                            <select
                                                className="form-control"
                                                value={poiTimeDays}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPoiTimeDays(val);
                                                    if (poiIs24Hours) {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: isTr ? `${val} 24 Saat Açık` : `${val} Open 24 Hours` }));
                                                    } else {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: `${val} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                    }
                                                }}
                                            >
                                                <option value="Hafta İçi">{isTr ? 'Hafta İçi (Pzt - Cuma)' : 'Weekdays (Mon - Fri)'}</option>
                                                <option value="Her Gün">{isTr ? 'Her Gün (7 Gün Açık)' : 'Every Day (24/7)'}</option>
                                                <option value="Pzt - Cmt">{isTr ? 'Pazartesi - Cumartesi' : 'Monday - Saturday'}</option>
                                                <option value="Hafta Sonu">{isTr ? 'Hafta Sonu (Cmt - Paz)' : 'Weekends (Sat - Sun)'}</option>
                                            </select>
                                        </div>

                                        {!poiIs24Hours && (
                                            <>
                                                <div>
                                                    <input
                                                        type="time"
                                                        className="form-control"
                                                        value={poiTimeStart}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPoiTimeStart(val);
                                                            setPoiFormData(prev => ({ ...prev, workingHours: `${poiTimeDays} ${val} - ${poiTimeEnd}` }));
                                                        }}
                                                        title={isTr ? "Açılış Saati" : "Opening Time"}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <input
                                                        type="time"
                                                        className="form-control"
                                                        value={poiTimeEnd}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPoiTimeEnd(val);
                                                            setPoiFormData(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${val}` }));
                                                        }}
                                                        title={isTr ? "Kapanış Saati" : "Closing Time"}
                                                        required
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                        <span style={{ fontSize: '11.5px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            {isTr ? 'Seçilen Mesai:' : 'Selected Hours:'} <strong style={{ color: '#2563eb' }}>{poiFormData.workingHours || (isTr ? 'Belirtilmedi' : 'Not specified')}</strong>
                                        </span>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: isDarkMode ? '#cbd5e1' : '#475569', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={poiIs24Hours}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setPoiIs24Hours(checked);
                                                    if (checked) {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: isTr ? '24 Saat Açık' : 'Open 24 Hours' }));
                                                    } else {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                    }
                                                }}
                                            />
                                            <span>{isTr ? '24 Saat Kesintisiz Açık' : 'Open 24/7'}</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Açıklama' : 'Description'}</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder={isTr ? "Konum veya mekan hakkında kısa açıklama..." : "Brief description about the place or landmark..."}
                                        value={poiFormData.description}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, description: e.target.value })}
                                    />
                                </div>

                                {/* POI ÇOKLU FOTOĞRAF / GÖRSEL YÖNETİMİ */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                            {isTr ? 'POI Fotoğrafları (Birden Fazla Eklenebilir)' : 'POI Photos (Multiple Photos Supported)'}
                                            {poiFormData.images.length > 0 && (
                                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                                    {poiFormData.images.length} {isTr ? 'Fotoğraf' : 'Photos'}
                                                </span>
                                            )}
                                        </label>
                                        {poiFormData.images.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setPoiFormData(prev => ({ ...prev, images: [] }))}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                {isTr ? 'Tüm Fotoğrafları Temizle' : 'Clear All'}
                                            </button>
                                        )}
                                    </div>

                                    {/* URL Ekle & Dosya Seç Butonları */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={isTr ? "Fotoğraf URL girip 'Ekle'ye basın (https://...)" : "Enter image URL and click Add"}
                                            value={poiFormData.customImageUrl}
                                            onChange={(e) => setPoiFormData({ ...poiFormData, customImageUrl: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (poiFormData.customImageUrl?.trim()) {
                                                        const url = poiFormData.customImageUrl.trim();
                                                        setPoiFormData(prev => ({
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
                                                if (poiFormData.customImageUrl?.trim()) {
                                                    const url = poiFormData.customImageUrl.trim();
                                                    setPoiFormData(prev => ({
                                                        ...prev,
                                                        images: [...prev.images, url],
                                                        customImageUrl: ''
                                                    }));
                                                }
                                            }}
                                            disabled={!poiFormData.customImageUrl?.trim()}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                                                border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
                                                color: isDarkMode ? '#ffffff' : '#0f172a',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: poiFormData.customImageUrl?.trim() ? 'pointer' : 'not-allowed',
                                                opacity: poiFormData.customImageUrl?.trim() ? 1 : 0.6
                                            }}
                                        >
                                            {isTr ? 'URL Ekle' : 'Add URL'}
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
                                            {uploadingPoiImage ? (isTr ? 'Yükleniyor...' : 'Uploading...') : (isTr ? 'Çoklu Dosya Seç' : 'Browse Files')}
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
                                                        
                                                        // 1. Önce anında yerel önizleme (FileReader)
                                                        for (const file of files) {
                                                            const reader = new FileReader();
                                                            reader.onload = () => {
                                                                if (reader.result) {
                                                                    setPoiFormData(prev => ({
                                                                        ...prev,
                                                                        images: [...prev.images, reader.result]
                                                                    }));
                                                                }
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }

                                                        // 2. Sunucuya yükleme
                                                        const uploadPromises = files.map(file => adminApi.uploadImage(file, token).catch(() => null));
                                                        const results = await Promise.all(uploadPromises);
                                                        const successfulUrls = results.filter(r => r && (r.url || r.absoluteUrl)).map(r => r.url || r.absoluteUrl);
                                                        
                                                        if (successfulUrls.length > 0) {
                                                            setPoiFormData(prev => {
                                                                // Base64 versiyonları sunucu URL'leriyle zenginleştir
                                                                const nonData = prev.images.filter(x => !x.startsWith('data:'));
                                                                return {
                                                                    ...prev,
                                                                    images: [...nonData, ...successfulUrls]
                                                                };
                                                            });
                                                        }
                                                        showNotification(isTr ? `${files.length} fotoğraf eklendi.` : `${files.length} images added.`);
                                                    } catch (err) {
                                                        console.warn('Görsel yükleme uyarısı:', err);
                                                        showNotification(isTr ? 'Görseller yerel olarak eklendi.' : 'Images added locally.');
                                                    } finally {
                                                        setUploadingPoiImage(false);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>

                                    {/* Çoklu Görsel Galerisi / Thumbnail Listesi */}
                                    {poiFormData.images.length > 0 && (
                                        <div style={{
                                            marginTop: '10px',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
                                            gap: '8px',
                                            maxHeight: '180px',
                                            overflowY: 'auto',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                        }}>
                                            {poiFormData.images.map((imgUrl, imgIdx) => {
                                                const resolved = (imgUrl.startsWith('data:') || imgUrl.startsWith('http') || imgUrl.startsWith('blob:'))
                                                    ? imgUrl
                                                    : `http://localhost:5041${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
                                                return (
                                                    <div
                                                        key={imgIdx}
                                                        style={{
                                                            position: 'relative',
                                                            height: '75px',
                                                            borderRadius: '6px',
                                                            overflow: 'hidden',
                                                            border: imgIdx === 0 ? '2px solid #3b82f6' : `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                                                            background: '#000000'
                                                        }}
                                                    >
                                                        <img
                                                            src={resolved}
                                                            alt={`POI Photo ${imgIdx + 1}`}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                        {imgIdx === 0 && (
                                                            <span style={{
                                                                position: 'absolute',
                                                                bottom: '2px',
                                                                left: '2px',
                                                                fontSize: '9px',
                                                                fontWeight: 700,
                                                                padding: '1px 4px',
                                                                borderRadius: '3px',
                                                                backgroundColor: '#3b82f6',
                                                                color: '#ffffff'
                                                            }}>
                                                                Kapak
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPoiFormData(prev => ({
                                                                    ...prev,
                                                                    images: prev.images.filter((_, idx) => idx !== imgIdx)
                                                                }));
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '2px',
                                                                right: '2px',
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '50%',
                                                                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '10px',
                                                                fontWeight: 'bold',
                                                                padding: 0
                                                            }}
                                                            title="Fotoğrafı Kaldır"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <label style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Konum & Geometri (WKT) *' : 'Location & Geometry (WKT) *'}</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button
                                                type="button"
                                                className="admin-btn-template"
                                                onClick={() => setPoiFormData(prev => ({ ...prev, wkt: 'POINT(32.8597 39.9334)' }))}
                                                style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.4)', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer' }}
                                            >
                                                {isTr ? 'Nokta Şablonu' : 'Point Template'}
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-btn-template"
                                                onClick={() => setPoiFormData(prev => ({ ...prev, wkt: 'POLYGON((32.854 39.920, 32.860 39.920, 32.860 39.925, 32.854 39.925, 32.854 39.920))' }))}
                                                style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer' }}
                                            >
                                                {isTr ? 'Poligon Şablonu' : 'Polygon Template'}
                                            </button>
                                        </div>
                                    </div>

                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder="POINT(32.8597 39.9334) or POLYGON((32.85 39.92, 32.86 39.92, 32.86 39.93, 32.85 39.93, 32.85 39.92))"
                                        value={poiFormData.wkt}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, wkt: e.target.value })}
                                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                        required
                                    />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                        <span style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            {isTr ? 'Nokta (POINT) ve Alan (POLYGON) geometrileri tam desteklenir.' : 'Point (POINT) and Area (POLYGON) geometries are fully supported.'}
                                        </span>
                                        {poiFormData.wkt && poiFormData.wkt.toUpperCase().startsWith('POLYGON') && (
                                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                                                {isTr ? 'Poligon Geometrisi' : 'Polygon Geometry'}
                                            </span>
                                        )}
                                        {poiFormData.wkt && poiFormData.wkt.toUpperCase().startsWith('POINT') && (
                                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
                                                {isTr ? 'Nokta Geometrisi' : 'Point Geometry'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {editingPoi && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="poiIsActive"
                                            checked={poiFormData.isActive}
                                            onChange={(e) => setPoiFormData({ ...poiFormData, isActive: e.target.checked })}
                                        />
                                        <label htmlFor="poiIsActive" style={{ cursor: 'pointer', fontSize: '13px' }}>{isTr ? 'POI Aktif Olsun' : 'POI Active Status'}</label>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowPoiModal(false)}>
                                    {isTr ? 'İptal' : 'Cancel'}
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingPoi ? (isTr ? 'Güncelle' : 'Update') : (isTr ? 'Kaydet' : 'Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* KATEGORİ MODAL (Ekle / Düzenle) */}
            {showCategoryModal && (
                <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                {editingCategory ? (isTr ? 'Kategoriyi Düzenle' : 'Edit Category') : (isTr ? 'Yeni Kategori Ekle' : 'Add New Category')}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCategoryModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title={isTr ? "Kapat" : "Close"}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Kategori Adı *' : 'Category Name *'}</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={isTr ? "Örn: Restoran, Kafe, Sağlık, Eczane, Kütüphane..." : "e.g. Restaurant, Cafe, Health, Pharmacy, Library..."}
                                        value={categoryFormData.name}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Üst Kategori (Parent)' : 'Parent Category'}</label>
                                    <select
                                        className="form-control"
                                        value={categoryFormData.parentId}
                                        onChange={(e) => {
                                            const pId = e.target.value;
                                            const parentObj = pId ? parentCategories.find(p => p.id === parseInt(pId, 10)) : null;
                                            setCategoryFormData(prev => ({
                                                ...prev,
                                                parentId: pId,
                                                displayOrder: (!editingCategory && parentObj) ? (parentObj.displayOrder || prev.displayOrder) : prev.displayOrder
                                            }));
                                        }}
                                    >
                                        <option value="">{isTr ? 'Yok (Ana Kategori Olarak Tanımla)' : 'None (Define as Root Category)'}</option>
                                        {parentCategories
                                            .filter(p => !editingCategory || p.id !== editingCategory.id)
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{getLocalizedPoiCategoryLabel(p.name, lang)}</option>
                                            ))
                                        }
                                    </select>
                                    <span style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                        {isTr ? 'Eğer bir ana kategori seçerseniz, bu kategori onun bir alt kategorisi olur.' : 'If you select a parent category, this will become its subcategory.'}
                                    </span>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                        {isTr ? 'Görünürlük & Öncelik Sıralaması (Harita Katmanı) *' : 'Visibility & Priority Level (Map Layer) *'}
                                    </label>
                                    <select
                                        className="form-control"
                                        value={categoryFormData.displayOrder}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, displayOrder: parseInt(e.target.value, 10) })}
                                        style={{ fontWeight: 600 }}
                                    >
                                        <option value={1}>{isTr ? '1 - Çok Yüksek (Her Zoomda En Üstte - Havalimanı, Hastane)' : '1 - Very High (Always Top Zoom - Airport, Hospital)'}</option>
                                        <option value={2}>{isTr ? '2 - Yüksek (Şehir Genelinde - Valilik, Üniversite, Metro)' : '2 - High (City Level - Governorate, University, Metro)'}</option>
                                        <option value={3}>{isTr ? '3 - Orta (İlçe ve Ana Noktalarda - Okul, Cami, Banka)' : '3 - Medium (District Level - School, Mosque, Bank)'}</option>
                                        <option value={4}>{isTr ? '4 - Standart (Cadde / Mahalle - Restoran, Market, Eczane)' : '4 - Standard (Street Level - Restaurant, Market, Pharmacy)'}</option>
                                        <option value={5}>{isTr ? '5 - Detay (Yakın Zoomda - Kafe, ATM, Park)' : '5 - Detail (Close Zoom - Cafe, ATM, Park)'}</option>
                                    </select>
                                    <span style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                        {isTr ? 'Harita uzaklaştırıldığında üst üste binen simgelerde yüksek öncelikli (1 ve 2) kategoriler çakışmayı kazanıp en üstte görünür.' : 'When zoomed out, high priority (1 and 2) categories stay visible during map clustering.'}
                                    </span>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Kategori Rengi' : 'Category Color'}</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={categoryFormData.color}
                                            onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                                            style={{ width: '40px', height: '38px', borderRadius: '6px', border: isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1', cursor: 'pointer', padding: 0, background: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={categoryFormData.color}
                                            onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <label style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Kategori İkonu (Haritada Görünür) *' : 'Category Icon (Visible on Map) *'}</label>
                                        <span style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            {isTr ? 'Seçili:' : 'Selected:'} <strong style={{ color: categoryFormData.color || '#3b82f6' }}>{categoryFormData.icon}</strong>
                                        </span>
                                    </div>

                                    {/* Seçili İkon Canlı Önizleme */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', marginBottom: '8px' }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: categoryFormData.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', flexShrink: 0 }}>
                                            <PoiCategoryGlyph iconId={categoryFormData.icon} size={18} color="#ffffff" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: isDarkMode ? '#f8fafc' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {categoryFormData.name || (isTr ? 'Örnek Kategori' : 'Sample Category')}
                                            </div>
                                            <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                                {isTr ? 'Harita ve arama listesinde bu rozet simgesi ile render edilecektir.' : 'Will render with this badge icon on map and search lists.'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* İkon Arama Filtresi */}
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={isTr ? "İkon ara (Örn: restoran, hastane, okul, park, otobüs...)" : "Search icon (e.g. restaurant, hospital, school, park, bus...)"}
                                        value={iconSearchQuery}
                                        onChange={(e) => setIconSearchQuery(e.target.value)}
                                        style={{ fontSize: '11.5px', padding: '6px 10px', marginBottom: '8px' }}
                                    />

                                    {/* Zengin İkon Seçim Izgarası */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '6px', maxHeight: '160px', overflowY: 'auto', padding: '6px', backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1' }}>
                                        {POI_ICON_LIST
                                            .filter(item => !iconSearchQuery || item.label.toLowerCase().includes(iconSearchQuery.toLowerCase()) || item.id.toLowerCase().includes(iconSearchQuery.toLowerCase()) || item.group.toLowerCase().includes(iconSearchQuery.toLowerCase()))
                                            .map(item => {
                                                const isSelected = (categoryFormData.icon || '').toLowerCase().replace('fa-', '') === item.id;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setCategoryFormData({ ...categoryFormData, icon: item.id })}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            padding: '8px 4px',
                                                            borderRadius: '6px',
                                                            border: isSelected ? `2px solid ${categoryFormData.color || '#3b82f6'}` : (isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0'),
                                                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)') : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                                                            color: isSelected ? (isDarkMode ? '#ffffff' : '#0f172a') : (isDarkMode ? '#cbd5e1' : '#475569'),
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title={`${item.label} (${item.group})`}
                                                    >
                                                        <div style={{ color: isSelected ? (categoryFormData.color || '#3b82f6') : (isDarkMode ? '#94a3b8' : '#64748b') }}>
                                                            <PoiCategoryGlyph iconId={item.id} size={18} color="currentColor" />
                                                        </div>
                                                        <span style={{ fontSize: '9.5px', fontWeight: isSelected ? 700 : 500, textAlign: 'center', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', whiteSpace: 'nowrap' }}>
                                                            {item.label.split('/')[0].trim()}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        }
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>{isTr ? 'Açıklama' : 'Description'}</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder={isTr ? "Kategori hakkında kısa açıklama..." : "Brief description for category..."}
                                        value={categoryFormData.description}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                                    />
                                </div>

                                {editingCategory && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="catIsActive"
                                            checked={categoryFormData.isActive}
                                            onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                                        />
                                        <label htmlFor="catIsActive" style={{ cursor: 'pointer', fontSize: '13px' }}>{isTr ? 'Kategori Aktif Olsun' : 'Category Active Status'}</label>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowCategoryModal(false)}>
                                    {isTr ? 'İptal' : 'Cancel'}
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingCategory ? (isTr ? 'Güncelle' : 'Update') : (isTr ? 'Oluştur' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
