import React, { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../../services/adminApi';
import { POI_ICON_LIST, getGlyphByIconId } from '../../constants/poiIcons';

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

export const PoiManagement = ({ token }) => {
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
    const [poiFormData, setPoiFormData] = useState({
        name: '',
        description: '',
        categoryId: '',
        workingHours: 'Hafta İçi 08:30 - 18:00',
        wkt: '',
        isActive: true
    });

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
                adminApi.getPois(null, true, token),
                adminApi.getPoiCategories(true, token),
                adminApi.getPoiCategoryTree(token)
            ]);
            setPois(poisData || []);
            setCategories(catsData || []);
            setCategoryTree(treeData || []);
        } catch (err) {
            setError(err.message || 'Veriler yüklenirken bir hata oluştu.');
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

    // POI CRUD
    const handleOpenPoiModal = async (poi = null) => {
        let currentCats = categories;
        if (!currentCats || currentCats.length === 0) {
            try {
                const catsData = await adminApi.getPoiCategories(true, token);
                if (catsData && catsData.length > 0) {
                    setCategories(catsData);
                    currentCats = catsData;
                }
            } catch (err) {
                console.error('Kategoriler yüklenemedi:', err);
            }
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

        try {
            if (editingPoi) {
                await adminApi.updatePoi(editingPoi.id, {
                    name: poiFormData.name.trim(),
                    description: poiFormData.description?.trim(),
                    categoryId: parseInt(poiFormData.categoryId, 10),
                    workingHours: poiFormData.workingHours?.trim(),
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
            loadData();
        } catch (err) {
            setError(err.message || 'Kategori silinemedi.');
        }
    };

    // Filtrelenmiş POI'ler
    const filteredPois = pois.filter(p => {
        const matchesSearch = !searchTerm ||
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = !selectedCategoryFilter ||
            p.categoryId.toString() === selectedCategoryFilter;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="admin-content-card">
            {/* Üst Başlık ve Ana Eylem Butonu */}
            <div className="admin-header">
                <div>
                    <h2>POI & Hiyerarşik Kategori Yönetimi</h2>
                    <p>Önemli konum noktalarını (POI) ve Parent-Child hiyerarşik kategorilerini yönetin.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {subTab === 'pois' && (
                        <button className="admin-primary-btn" onClick={() => handleOpenPoiModal()}>
                            <PlusIcon size={16} strokeWidth={3} /> Yeni POI Ekle
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
                    <span>POI Listesi</span>
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
                    <span>Hiyerarşik Kategori Ağacı</span>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', backgroundColor: subTab === 'categories' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.08)', color: subTab === 'categories' ? '#3b82f6' : '#94a3b8', fontWeight: 700 }}>
                        {categories.length}
                    </span>
                </button>
            </div>

            {/* SEKME 1: POI LİSTESİ */}
            {subTab === 'pois' && (
                <div>
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
                                placeholder="POI adı, kullanıcı veya kategori ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-control"
                            style={{ width: '220px', height: '38px' }}
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        >
                            <option value="">Tüm Kategoriler ({categories.length})</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.parentName ? `${c.parentName} → ${c.name}` : `[Ana Kategori] ${c.name}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tablo */}
                    {loading ? (
                        <div className="admin-loading">POI verileri yükleniyor...</div>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>POI Adı</th>
                                        <th>Kategori / Üst Kategori</th>
                                        <th>Mesai Saatleri</th>
                                        <th>Ekleyen Kullanıcı</th>
                                        <th>Kayıt Tarihi</th>
                                        <th>Durum</th>
                                        <th style={{ textAlign: 'right' }}>İşlemler</th>
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
                                                            <strong className="user-name">{poi.name}</strong>
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
                                                    <span
                                                        className="badge role-badge"
                                                        style={{
                                                            backgroundColor: 'transparent',
                                                            color: poi.categoryColor || '#3b82f6',
                                                            border: `1.5px solid ${poi.categoryColor || '#3b82f6'}`,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontWeight: 700,
                                                            fontSize: '11.5px',
                                                            letterSpacing: '0.2px'
                                                        }}
                                                    >
                                                        {poi.parentCategoryName ? `${poi.parentCategoryName} → ` : ''}{poi.categoryName}
                                                    </span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Hiyerarşik Kategori Ağacı</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                                Ana ve alt kategorileri (Parent-Child) yönetebilir, yeni alt kategoriler ekleyebilirsiniz.
                            </p>
                        </div>
                        <button className="admin-secondary-btn" onClick={() => handleOpenCategoryModal()}>
                            <PlusIcon size={14} /> Yeni Ana Kategori
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading">Kategoriler yükleniyor...</div>
                    ) : categoryTree.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Tanımlı kategori bulunamadı.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {categoryTree.map(parentCat => (
                                <div
                                    key={parentCat.id}
                                    style={{
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: 'rgba(30, 41, 59, 0.4)'
                                    }}
                                >
                                    {/* Ana Kategori Başlığı */}
                                    <div
                                        style={{
                                            padding: '12px 16px',
                                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: parentCat.children?.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div
                                                style={{
                                                    width: '26px',
                                                    height: '26px',
                                                    borderRadius: '50%',
                                                    backgroundColor: parentCat.color || '#3b82f6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <PoiCategoryGlyph iconId={parentCat.icon || parentCat.name} size={14} color="#ffffff" />
                                            </div>
                                            <strong style={{ fontSize: '14px' }}>{parentCat.name}</strong>
                                            {parentCat.description && (
                                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>— {parentCat.description}</span>
                                            )}
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: parentCat.displayOrder === 1 ? 'rgba(239, 68, 68, 0.15)' : parentCat.displayOrder === 2 ? 'rgba(249, 115, 22, 0.15)' : parentCat.displayOrder === 3 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                color: parentCat.displayOrder === 1 ? '#ef4444' : parentCat.displayOrder === 2 ? '#f97316' : parentCat.displayOrder === 3 ? '#3b82f6' : '#94a3b8',
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                                Öncelik: {parentCat.displayOrder || 1}
                                            </span>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '11px', fontWeight: 700 }}>
                                                {parentCat.poiCount} POI
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                className="admin-secondary-btn"
                                                style={{ fontSize: '11.5px', padding: '4px 10px', height: '28px' }}
                                                onClick={() => handleOpenCategoryModal(null, parentCat.id)}
                                            >
                                                <PlusIcon size={12} /> Alt Kategori Ekle
                                            </button>
                                            <div className="action-buttons" style={{ marginLeft: '4px' }}>
                                                <button
                                                    className="admin-action-btn edit-icon-btn"
                                                    title="Kategoriyi Düzenle"
                                                    onClick={() => handleOpenCategoryModal(parentCat)}
                                                >
                                                    <EditIcon size={14} />
                                                </button>
                                                <button
                                                    className="admin-action-btn delete-icon-btn"
                                                    title="Kategoriyi Sil"
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
                                                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                        borderLeft: `3px solid ${childCat.color || parentCat.color || '#3b82f6'}`
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <ChevronRightIcon size={12} />
                                                        <div
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
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
                                                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{childCat.name}</span>
                                                        {childCat.description && (
                                                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>({childCat.description})</span>
                                                        )}
                                                        <span style={{
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: childCat.displayOrder === 1 ? 'rgba(239, 68, 68, 0.15)' : childCat.displayOrder === 2 ? 'rgba(249, 115, 22, 0.15)' : childCat.displayOrder === 3 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                            color: childCat.displayOrder === 1 ? '#ef4444' : childCat.displayOrder === 2 ? '#f97316' : childCat.displayOrder === 3 ? '#3b82f6' : '#94a3b8',
                                                            fontSize: '10px',
                                                            fontWeight: 700
                                                        }}>
                                                            Öncelik: {childCat.displayOrder || 1}
                                                        </span>
                                                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '10.5px', fontWeight: 700 }}>
                                                            {childCat.poiCount} POI
                                                        </span>
                                                    </div>

                                                    <div className="action-buttons">
                                                        <button
                                                            className="admin-action-btn edit-icon-btn"
                                                            title="Alt Kategoriyi Düzenle"
                                                            onClick={() => handleOpenCategoryModal(childCat)}
                                                        >
                                                            <EditIcon size={13} />
                                                        </button>
                                                        <button
                                                            className="admin-action-btn delete-icon-btn"
                                                            title="Alt Kategoriyi Sil"
                                                            onClick={() => handleDeleteCategory(childCat.id, childCat.name)}
                                                        >
                                                            <TrashIcon size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '10px 16px 10px 32px', color: '#94a3b8', fontSize: '12px' }}>
                                            Henüz bu ana kategoriye bağlı bir alt kategori bulunmuyor.
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                {editingPoi ? 'POI Noktasını Düzenle' : 'Yeni POI Ekle'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowPoiModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSavePoi}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>POI / Mekan İsmi *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Örn: Merkez İlçe Kütüphanesi, Şehir Hastanesi, Atatürk Parkı, Semt Polikliniği..."
                                        value={poiFormData.name}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: currentSubCategories.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                            <span>1. Ana Kategori *</span>
                                        </label>
                                        <select
                                            className="form-control"
                                            value={poiParentCategoryId}
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
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                                <span>2. Alt Kategori (Dallanma) *</span>
                                            </label>
                                            <select
                                                className="form-control"
                                                value={poiFormData.categoryId}
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
                                        background: 'rgba(59, 130, 246, 0.08)',
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
                                            boxShadow: `0 0 6px ${activeCategoryObject.color || '#3b82f6'}80`
                                        }} />
                                        <span style={{ color: '#64748b' }}>Seçili Harita Rozeti:</span>
                                        <strong style={{ color: activeCategoryObject.color || '#3b82f6', fontWeight: 600 }}>
                                            {activeCategoryObject.parentName ? `${activeCategoryObject.parentName} → ${activeCategoryObject.name}` : activeCategoryObject.name}
                                        </strong>
                                    </div>
                                )}

                                {/* MESAI / ÇALIŞMA SAATLERİ SEÇİCİ */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Mesai / Çalışma Saatleri</label>

                                    <div style={{ display: 'grid', gridTemplateColumns: poiIs24Hours ? '1fr' : '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                                        <div>
                                            <select
                                                className="form-control"
                                                value={poiTimeDays}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPoiTimeDays(val);
                                                    if (poiIs24Hours) {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: `${val} 24 Saat Açık` }));
                                                    } else {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: `${val} ${poiTimeStart} - ${poiTimeEnd}` }));
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
                                                        className="form-control"
                                                        value={poiTimeStart}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPoiTimeStart(val);
                                                            setPoiFormData(prev => ({ ...prev, workingHours: `${poiTimeDays} ${val} - ${poiTimeEnd}` }));
                                                        }}
                                                        title="Açılış Saati"
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
                                                        title="Kapanış Saati"
                                                        required
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                            Seçilen Mesai: <strong style={{ color: '#38bdf8' }}>{poiFormData.workingHours || 'Belirtilmedi'}</strong>
                                        </span>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={poiIs24Hours}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setPoiIs24Hours(checked);
                                                    if (checked) {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: '24 Saat Açık' }));
                                                    } else {
                                                        setPoiFormData(prev => ({ ...prev, workingHours: `${poiTimeDays} ${poiTimeStart} - ${poiTimeEnd}` }));
                                                    }
                                                }}
                                            />
                                            <span>24 Saat Kesintisiz Açık</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Açıklama</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder="Konum veya mekan hakkında kısa açıklama..."
                                        value={poiFormData.description}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, description: e.target.value })}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <label style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>Konum & Geometri (WKT) *</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button
                                                type="button"
                                                className="admin-btn-template"
                                                onClick={() => setPoiFormData(prev => ({ ...prev, wkt: 'POINT(32.8597 39.9334)' }))}
                                                style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.4)', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer' }}
                                            >
                                                Nokta Şablonu
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-btn-template"
                                                onClick={() => setPoiFormData(prev => ({ ...prev, wkt: 'POLYGON((32.854 39.920, 32.860 39.920, 32.860 39.925, 32.854 39.925, 32.854 39.920))' }))}
                                                style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer' }}
                                            >
                                                Poligon Şablonu
                                            </button>
                                        </div>
                                    </div>

                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder="POINT(32.8597 39.9334) veya POLYGON((32.85 39.92, 32.86 39.92, 32.86 39.93, 32.85 39.93, 32.85 39.92))"
                                        value={poiFormData.wkt}
                                        onChange={(e) => setPoiFormData({ ...poiFormData, wkt: e.target.value })}
                                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                        required
                                    />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            Nokta (POINT) ve Alan (POLYGON) geometrileri tam desteklenir.
                                        </span>
                                        {poiFormData.wkt && poiFormData.wkt.toUpperCase().startsWith('POLYGON') && (
                                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                                                Poligon Geometrisi
                                            </span>
                                        )}
                                        {poiFormData.wkt && poiFormData.wkt.toUpperCase().startsWith('POINT') && (
                                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
                                                Nokta Geometrisi
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
                                        <label htmlFor="poiIsActive" style={{ cursor: 'pointer', fontSize: '13px' }}>POI Aktif Olsun</label>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowPoiModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingPoi ? 'Güncelle' : 'Kaydet'}
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                {editingCategory ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCategoryModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Kategori Adı *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Örn: Yeme-İçme, Restoran, Kafe, Sağlık, Eczane, Kütüphane..."
                                        value={categoryFormData.name}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Üst Kategori (Parent)</label>
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
                                        <option value="">Yok (Ana Kategori Olarak Tanımla)</option>
                                        {parentCategories
                                            .filter(p => !editingCategory || p.id !== editingCategory.id)
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))
                                        }
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        Eğer bir ana kategori seçerseniz, bu kategori onun bir alt kategorisi olur.
                                    </span>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                                        Görünürlük & Öncelik Sıralaması (Harita Katmanı) *
                                    </label>
                                    <select
                                        className="form-control"
                                        value={categoryFormData.displayOrder}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, displayOrder: parseInt(e.target.value, 10) })}
                                        style={{ fontWeight: 600 }}
                                    >
                                        <option value={1}>1 - Çok Yüksek (Her Zoomda En Üstte Görünür - Havalimanı, Hastane, Terminal)</option>
                                        <option value={2}>2 - Yüksek (Şehir Genelinde Görünür - Valilik, Üniversite, Metro)</option>
                                        <option value={3}>3 - Orta (İlçe ve Ana Noktalarda Görünür - Okul, Cami, Banka, Benzinlik)</option>
                                        <option value={4}>4 - Standart (Cadde / Mahalle Seviyesinde Görünür - Restoran, Market, Eczane)</option>
                                        <option value={5}>5 - Detay (Sadece İyice Yaklaşınca Görünür - Kafe, ATM, Park)</option>
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        Harita uzaklaştırıldığında (zoom out) üst üste binen simgelerde yüksek öncelikli (1 ve 2) kategoriler çakışmayı kazanıp en üstte görünür.
                                    </span>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Kategori Rengi</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={categoryFormData.color}
                                            onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                                            style={{ width: '40px', height: '38px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: 0, background: 'none' }}
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
                                        <label style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>Kategori İkonu (Haritada Görünür) *</label>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            Seçili: <strong style={{ color: categoryFormData.color || '#3b82f6' }}>{categoryFormData.icon}</strong>
                                        </span>
                                    </div>

                                    {/* Seçili İkon Canlı Önizleme */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px' }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: categoryFormData.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', flexShrink: 0 }}>
                                            <PoiCategoryGlyph iconId={categoryFormData.icon} size={18} color="#ffffff" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {categoryFormData.name || 'Örnek Kategori'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                Harita ve arama listesinde bu rozet simgesi ile render edilecektir.
                                            </div>
                                        </div>
                                    </div>

                                    {/* İkon Arama Filtresi */}
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="İkon ara (Örn: restoran, hastane, okul, park, otobüs, cami, market...)"
                                        value={iconSearchQuery}
                                        onChange={(e) => setIconSearchQuery(e.target.value)}
                                        style={{ fontSize: '11.5px', padding: '6px 10px', marginBottom: '8px' }}
                                    />

                                    {/* Zengin İkon Seçim Izgarası */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '6px', maxHeight: '160px', overflowY: 'auto', padding: '6px', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                                                            border: isSelected ? `2px solid ${categoryFormData.color || '#3b82f6'}` : '1px solid rgba(255,255,255,0.08)',
                                                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                                            color: isSelected ? '#ffffff' : '#cbd5e1',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title={`${item.label} (${item.group})`}
                                                    >
                                                        <div style={{ color: isSelected ? (categoryFormData.color || '#3b82f6') : '#94a3b8' }}>
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
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600 }}>Açıklama</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder="Kategori hakkında kısa açıklama..."
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
                                        <label htmlFor="catIsActive" style={{ cursor: 'pointer', fontSize: '13px' }}>Kategori Aktif Olsun</label>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="admin-secondary-btn" onClick={() => setShowCategoryModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="admin-primary-btn">
                                    {editingCategory ? 'Güncelle' : 'Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
