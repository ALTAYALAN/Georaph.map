/**
 * Role & Permission Translation & Dynamic Localization Utility
 * Automatically translates system roles, descriptions, permission duties, and custom inputs.
 */

// Canonical translations for roles
export const ROLE_NAMES_MAP = {
    admin: { tr: 'Yönetici', en: 'Administrator' },
    administrator: { tr: 'Yönetici', en: 'Administrator' },
    yönetici: { tr: 'Yönetici', en: 'Administrator' },
    yonetici: { tr: 'Yönetici', en: 'Administrator' },

    editor: { tr: 'Editör', en: 'Editor' },
    editör: { tr: 'Editör', en: 'Editor' },

    viewer: { tr: 'Görüntüleyici', en: 'Viewer' },
    görüntüleyici: { tr: 'Görüntüleyici', en: 'Viewer' },
    goruntuleyici: { tr: 'Görüntüleyici', en: 'Viewer' },
    izleyici: { tr: 'İzleyici', en: 'Viewer' },

    operator: { tr: 'Operatör', en: 'Operator' },
    operatör: { tr: 'Operatör', en: 'Operator' },

    'ulaşım operatörü': { tr: 'Ulaşım Operatörü', en: 'Transit Operator' },
    'ulasim operatoru': { tr: 'Ulaşım Operatörü', en: 'Transit Operator' },
    'transit operator': { tr: 'Ulaşım Operatörü', en: 'Transit Operator' },

    'ulaşım kullanıcısı': { tr: 'Ulaşım Kullanıcısı', en: 'Transit User' },
    'ulasim kullanicisi': { tr: 'Ulaşım Kullanıcısı', en: 'Transit User' },
    'transit user': { tr: 'Ulaşım Kullanıcısı', en: 'Transit User' },

    'saha personeli': { tr: 'Saha Personeli', en: 'Field Staff' },
    'field staff': { tr: 'Saha Personeli', en: 'Field Staff' },

    denetçi: { tr: 'Denetçi', en: 'Auditor' },
    auditor: { tr: 'Denetçi', en: 'Auditor' },

    moderatör: { tr: 'Moderatör', en: 'Moderator' },
    moderator: { tr: 'Moderatör', en: 'Moderator' },
};

// Canonical translations for role descriptions
export const ROLE_DESCRIPTIONS_MAP = {
    'tüm yetkilere sahip sistem yöneticisi': 'System administrator with full privileges',
    'tum yetkilere sahip sistem yoneticisi': 'System administrator with full privileges',
    'system administrator with full privileges': { tr: 'Tüm yetkilere sahip sistem yöneticisi', en: 'System administrator with full privileges' },

    'çizim ve veri ekleme yetkisine sahip editör': 'Editor with drawing and data creation permissions',
    'cizim ve veri ekleme yetkisine sahip editor': 'Editor with drawing and data creation permissions',
    'editor with drawing and data creation permissions': { tr: 'Çizim ve veri ekleme yetkisine sahip editör', en: 'Editor with drawing and data creation permissions' },

    'sadece görüntüleme yetkisine sahip kullanıcı': 'User with read-only view permissions',
    'sadece goruntuleme yetkisine sahip kullanici': 'User with read-only view permissions',
    'user with read-only view permissions': { tr: 'Sadece görüntüleme yetkisine sahip kullanıcı', en: 'User with read-only view permissions' },

    'toplu taşıma ve güzergah yönetim operatörü': 'Public transit and route management operator',
    'toplu tasima ve guzergah yonetim operatoru': 'Public transit and route management operator',
    'public transit and route management operator': { tr: 'Toplu taşıma ve güzergah yönetim operatörü', en: 'Public transit and route management operator' },

    'açıklama girilmemiş.': 'No description provided.',
    'aciklama girilmemis.': 'No description provided.',
    'no description provided.': { tr: 'Açıklama girilmemiş.', en: 'No description provided.' }
};

// Permissions dictionary by code and normalized name
export const PERMISSIONS_MAP = {
    'point.create': {
        name: { tr: 'Nokta Ekleme', en: 'Add Point' },
        description: { tr: 'Haritada yeni nokta objesi ekleme yetkisi', en: 'Permission to create new point objects on map' }
    },
    'line.create': {
        name: { tr: 'Çizgi Ekleme', en: 'Add Line' },
        description: { tr: 'Haritada yeni çizgi objesi ekleme yetkisi', en: 'Permission to create new line objects on map' }
    },
    'polygon.create': {
        name: { tr: 'Poligon Ekleme', en: 'Add Polygon' },
        description: { tr: 'Haritada yeni poligon objesi ekleme yetkisi', en: 'Permission to create new polygon objects on map' }
    },
    'user.manage': {
        name: { tr: 'Kullanıcı Yönetimi', en: 'User Management' },
        description: { tr: 'Kullanıcı ekleme, güncelleme, silme ve yetkilendirme', en: 'Add, update, delete users and manage authorizations' }
    },
    'role.manage': {
        name: { tr: 'Rol Yönetimi', en: 'Role Management' },
        description: { tr: 'Rol ekleme, güncelleme ve rol yetkisi yönetimi', en: 'Add, update roles and manage role permissions' }
    },
    'drawings.view_all': {
        name: { tr: 'Tüm Çizimleri Görüntüleme', en: 'View All Drawings' },
        description: { tr: 'Sistemdeki tüm çizimleri ve konumları görüntüleme yetkisi', en: 'Permission to view all drawings and locations across the system' }
    },
    'poi.create': {
        name: { tr: 'POI Ekleme', en: 'Add POI' },
        description: { tr: 'Haritada yeni POI (İlgi Noktası) ekleme ve yönetme yetkisi', en: 'Permission to add and manage POIs (Points of Interest) on map' }
    },
    'route.manage': {
        name: { tr: 'Güzergah Yönetimi', en: 'Route Management' },
        description: { tr: 'Hat ve güzergah oluşturma, düzenleme ve yönetme', en: 'Create, edit and manage transit lines and routes' }
    },
    'stop.create': {
        name: { tr: 'Durak Ekleme', en: 'Add Stop' },
        description: { tr: 'Haritada yeni durak ekleme ve düzenleme yetkisi', en: 'Permission to add and edit transit stops on map' }
    }
};

// Turkish to English phrase / keyword mapping for dynamically edited descriptions
const PHRASE_DICTIONARY = [
    // Complex phrases
    [/\btüm yetkilere sahip\b/gi, 'with all privileges'],
    [/\byetkisine sahip\b/gi, 'with permission to'],
    [/\byetkisi\b/gi, 'permission'],
    [/\byetkileri\b/gi, 'permissions'],
    [/\bveri ekleme\b/gi, 'data addition'],
    [/\bçizim ve veri\b/gi, 'drawing and data'],
    [/\bsadece görüntüleme\b/gi, 'read-only viewing'],
    [/\btoplu taşıma\b/gi, 'public transit'],
    [/\bgüzergah simülasyon\b/gi, 'route simulation'],
    [/\bilgi noktası\b/gi, 'point of interest (POI)'],
    [/\byeni nokta objesi\b/gi, 'new point object'],
    [/\byeni çizgi objesi\b/gi, 'new line object'],
    [/\byeni poligon objesi\b/gi, 'new polygon object'],
    [/\bsistemdeki tüm çizimleri\b/gi, 'all drawings in the system'],
    [/\bkonumları görüntüleme\b/gi, 'view locations'],
    [/\bkullanıcı ekleme, güncelleme, silme\b/gi, 'add, update, delete users'],
    [/\brol ekleme, güncelleme\b/gi, 'add, update roles'],
    [/\bve yetkilendirme\b/gi, 'and authorization'],
    [/\bve rol yetkisi yönetimi\b/gi, 'and role permission management'],

    // Single words / terms
    [/\bharitada\b/gi, 'on the map'],
    [/\bharita\b/gi, 'map'],
    [/\bçizim\b/gi, 'drawing'],
    [/\bçizimleri\b/gi, 'drawings'],
    [/\bnokta\b/gi, 'point'],
    [/\bçizgi\b/gi, 'line'],
    [/\bpoligon\b/gi, 'polygon'],
    [/\bekleme\b/gi, 'creation / addition'],
    [/\bsilme\b/gi, 'deletion'],
    [/\bgüncelleme\b/gi, 'update'],
    [/\bdüzenleme\b/gi, 'editing'],
    [/\bgörüntüleme\b/gi, 'viewing'],
    [/\byönetimi\b/gi, 'management'],
    [/\byönetme\b/gi, 'managing'],
    [/\bkullanıcı\b/gi, 'user'],
    [/\bkullanıcılar\b/gi, 'users'],
    [/\byönetici\b/gi, 'administrator'],
    [/\beditör\b/gi, 'editor'],
    [/\bgörüntüleyici\b/gi, 'viewer'],
    [/\boperatör\b/gi, 'operator'],
    [/\bgüzergah\b/gi, 'route'],
    [/\bdurak\b/gi, 'stop'],
    [/\bhatlar\b/gi, 'lines'],
    [/\bsistem\b/gi, 'system'],
    [/\batanmış yetki yok\b/gi, 'No assigned permissions'],
    [/\baçıklama girilmemiş\b/gi, 'No description provided']
];

/**
 * Dynamically translates Turkish sentences / descriptions into English using phrase matching.
 * This guarantees that when an admin or user modifies the description in the database,
 * the English mode immediately translates it appropriately.
 */
export const autoTranslateTurkishText = (text) => {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (!trimmed) return '';

    // Check direct description map first
    const norm = trimmed.toLowerCase();
    if (ROLE_DESCRIPTIONS_MAP[norm]) {
        const entry = ROLE_DESCRIPTIONS_MAP[norm];
        return typeof entry === 'string' ? entry : (entry.en || trimmed);
    }

    // Replace known Turkish phrases with English equivalents
    let translated = trimmed;
    for (const [pattern, replacement] of PHRASE_DICTIONARY) {
        translated = translated.replace(pattern, replacement);
    }

    // Capitalize first letter if needed
    return translated.charAt(0).toUpperCase() + translated.slice(1);
};

/**
 * Translates a role name based on current language.
 * E.g. 'Admin' -> 'Administrator', 'Yönetici' -> 'Administrator' (when en)
 * E.g. 'Administrator' -> 'Yönetici' (when tr)
 */
export const translateRoleName = (roleName, lang = 'tr') => {
    if (!roleName) return lang === 'tr' ? 'Rolsüz' : 'No Role';
    const norm = roleName.trim().toLowerCase();

    if (ROLE_NAMES_MAP[norm]) {
        return lang === 'tr' ? ROLE_NAMES_MAP[norm].tr : ROLE_NAMES_MAP[norm].en;
    }

    // Partial word matching fallback
    if (norm.includes('admin') || norm.includes('yönetici') || norm.includes('yonetici')) {
        return lang === 'tr' ? 'Yönetici' : 'Administrator';
    }
    if (norm.includes('edit')) {
        return lang === 'tr' ? 'Editör' : 'Editor';
    }
    if (norm.includes('view') || norm.includes('görüntü') || norm.includes('izle')) {
        return lang === 'tr' ? 'Görüntüleyici' : 'Viewer';
    }
    if (norm.includes('operat')) {
        return lang === 'tr' ? 'Operatör' : 'Operator';
    }

    // If already in English or custom role name, return appropriately
    if (lang === 'en') {
        return autoTranslateTurkishText(roleName);
    }
    return roleName;
};

/**
 * Translates a role description based on current language.
 * Handles exact matches, fallback to role-based default, and dynamic auto-translation if text was modified.
 */
export const translateRoleDescription = (desc, lang = 'tr', roleName = '') => {
    if (!desc || !desc.trim()) {
        return lang === 'tr' ? 'Açıklama girilmemiş.' : 'No description provided.';
    }

    const trimmed = desc.trim();
    if (lang === 'tr') {
        // If it's in English and we want Turkish, check reverse
        const norm = trimmed.toLowerCase();
        for (const [key, val] of Object.entries(ROLE_DESCRIPTIONS_MAP)) {
            if (typeof val === 'object' && val.en?.toLowerCase() === norm) {
                return val.tr;
            }
            if (typeof val === 'string' && val.toLowerCase() === norm) {
                return key;
            }
        }
        return trimmed;
    }

    // lang === 'en':
    const norm = trimmed.toLowerCase();
    if (ROLE_DESCRIPTIONS_MAP[norm]) {
        const val = ROLE_DESCRIPTIONS_MAP[norm];
        return typeof val === 'string' ? val : (val.en || trimmed);
    }

    // If description changed dynamically or has custom phrasing, auto-translate it
    return autoTranslateTurkishText(trimmed);
};

/**
 * Translates permission name based on permission object or code/name.
 */
export const translatePermissionName = (perm, lang = 'tr') => {
    if (!perm) return '';
    const code = typeof perm === 'object' ? (perm.code || '') : '';
    const name = typeof perm === 'object' ? (perm.name || '') : perm;

    // Check by code first
    if (code && PERMISSIONS_MAP[code]) {
        return lang === 'tr' ? PERMISSIONS_MAP[code].name.tr : PERMISSIONS_MAP[code].name.en;
    }

    // Check by normalized name
    const normName = name.trim().toLowerCase();
    for (const p of Object.values(PERMISSIONS_MAP)) {
        if (p.name.tr.toLowerCase() === normName || p.name.en.toLowerCase() === normName) {
            return lang === 'tr' ? p.name.tr : p.name.en;
        }
    }

    // Specific custom checks
    if (normName.includes('point') || normName.includes('nokta')) {
        return lang === 'tr' ? 'Nokta Ekleme' : 'Add Point';
    }
    if (normName.includes('line') || normName.includes('çizgi')) {
        return lang === 'tr' ? 'Çizgi Ekleme' : 'Add Line';
    }
    if (normName.includes('polygon') || normName.includes('poligon')) {
        return lang === 'tr' ? 'Poligon Ekleme' : 'Add Polygon';
    }
    if (normName.includes('user') || normName.includes('kullanıcı')) {
        return lang === 'tr' ? 'Kullanıcı Yönetimi' : 'User Management';
    }
    if (normName.includes('role') || normName.includes('rol')) {
        return lang === 'tr' ? 'Rol Yönetimi' : 'Role Management';
    }
    if (normName.includes('çizim') || normName.includes('drawing')) {
        return lang === 'tr' ? 'Tüm Çizimleri Görüntüleme' : 'View All Drawings';
    }
    if (normName.includes('poi')) {
        return lang === 'tr' ? 'POI Ekleme' : 'Add POI';
    }

    if (lang === 'en') {
        return autoTranslateTurkishText(name);
    }
    return name;
};

/**
 * Translates permission description / duty based on permission object or description string.
 */
export const translatePermissionDescription = (perm, lang = 'tr') => {
    if (!perm) return '';
    const code = typeof perm === 'object' ? (perm.code || '') : '';
    const desc = typeof perm === 'object' ? (perm.description || '') : perm;

    // Check by code
    if (code && PERMISSIONS_MAP[code]) {
        return lang === 'tr' ? PERMISSIONS_MAP[code].description.tr : PERMISSIONS_MAP[code].description.en;
    }

    // Check by exact description match
    const normDesc = desc.trim().toLowerCase();
    for (const p of Object.values(PERMISSIONS_MAP)) {
        if (p.description.tr.toLowerCase() === normDesc || p.description.en.toLowerCase() === normDesc) {
            return lang === 'tr' ? p.description.tr : p.description.en;
        }
    }

    if (lang === 'en') {
        return autoTranslateTurkishText(desc);
    }
    return desc;
};
