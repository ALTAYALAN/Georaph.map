// GeoraphMap POI Kapsamlı Vektörel İkon Kütüphanesi
// Tüm harita ve kategori tiplerine uygun zengin SVG simgeleri

export const POI_ICON_LIST = [
    // 1. Yeme & İçme
    { id: 'utensils', label: 'Restoran / Yemek', group: 'Yeme & İçme', glyph: '<path d="M18 4v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 4v16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M22 13V4a4 4 0 0 0-4 4v5a2 2 0 0 0 2 2h2v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'coffee', label: 'Kafe / Kahve', group: 'Yeme & İçme', glyph: '<path d="M17 9h1a3 3 0 0 1 0 6h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 9h12v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9z" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="8" y1="4" x2="8" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="11" y1="4" x2="11" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="14" y1="4" x2="14" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'burger', label: 'Fast Food / Burger', group: 'Yeme & İçme', glyph: '<path d="M6 10h12a1 1 0 0 0 1-1 5 5 0 0 0-10 0 1 1 0 0 0 1 1z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.2)"/><line x1="5" y1="13" x2="19" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 16h12a1.5 1.5 0 0 1 1.5 1.5V18a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-.5A1.5 1.5 0 0 1 6 16z" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'pizza', label: 'Pizza / Fırın', group: 'Yeme & İçme', glyph: '<path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="17" r="1.5" fill="currentColor"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/>' },
    { id: 'cake', label: 'Pastane / Tatlı', group: 'Yeme & İçme', glyph: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" stroke="currentColor" stroke-width="1.8"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.8"/><path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="3" r="1" fill="currentColor"/>' },
    { id: 'glass', label: 'Bar / Gece Kulübü', group: 'Yeme & İçme', glyph: '<path d="M8 22h8M12 15v7M5 3l7 9 7-9H5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'cart', label: 'Market / Süpermarket', group: 'Yeme & İçme', glyph: '<circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },

    // 2. Sağlık & Medikal
    { id: 'hospital', label: 'Hastane', group: 'Sağlık', glyph: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>' },
    { id: 'pill', label: 'Eczane / İlaç', group: 'Sağlık', glyph: '<path d="m9.5 17.5 7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5Z" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="8" y1="8" x2="13" y2="13" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'heartbeat', label: 'Klinik / Sağlık Ocağı', group: 'Sağlık', glyph: '<path d="M21 12h-3.5l-2.5 6L11 4l-2.5 8H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'stethoscope', label: 'Doktor / Muayenehane', group: 'Sağlık', glyph: '<path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3M9 12.5V17a3 3 0 0 0 6 0v-2M15 15a2 2 0 1 0 4 0 2 2 0 1 0-4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'tooth', label: 'Diş Hekimi / Klinik', group: 'Sağlık', glyph: '<path d="M12 2C8 2 6 5 6 8c0 4 2 11 3 13s3 1 3-2c0-3 0-3 0-3s0 0 0 3c0 3 2 4 3 2s3-9 3-13c0-3-2-6-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'paw', label: 'Veteriner', group: 'Sağlık', glyph: '<circle cx="12" cy="15" r="3.5" fill="currentColor"/><circle cx="6.5" cy="10.5" r="2" fill="currentColor"/><circle cx="17.5" cy="10.5" r="2" fill="currentColor"/><circle cx="9" cy="5.5" r="1.8" fill="currentColor"/><circle cx="15" cy="5.5" r="1.8" fill="currentColor"/>' },

    // 3. Eğitim & Kültür
    { id: 'graduation-cap', label: 'Üniversite / Kampüs', group: 'Eğitim', glyph: '<path d="M21 9v5M3 9l9-4 9 4-9 4-9-4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11.5v4c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'school', label: 'Okul / Lise', group: 'Eğitim', glyph: '<path d="M4 21V10l8-5 8 5v11H4z" stroke="currentColor" stroke-width="1.8"/><path d="M10 21v-5h4v5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'book', label: 'Kütüphane / Kitabevi', group: 'Eğitim', glyph: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12A2.5 2.5 0 0 1 6.5 3z" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'palette', label: 'Sanat / Müze / Sergi', group: 'Eğitim', glyph: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/><circle cx="16" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/>' },
    { id: 'film', label: 'Sinema / Tiyatro', group: 'Eğitim', glyph: '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 4v16M17 4v16M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.8"/>' },

    // 4. Kamu, Hizmet & Güvenlik
    { id: 'landmark', label: 'Belediye / Valilik / Kamu', group: 'Kamu & Hizmet', glyph: '<line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="16" x2="6" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="10" y1="16" x2="10" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="14" y1="16" x2="14" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="18" y1="16" x2="18" y2="10" stroke="currentColor" stroke-width="1.8"/><polygon points="12 4 20 8 4 8" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>' },
    { id: 'building', label: 'Resmi Daire / Muhtarlık', group: 'Kamu & Hizmet', glyph: '<rect x="5" y="4" width="14" height="16" rx="1.5" stroke="currentColor" stroke-width="1.8"/><line x1="9" y1="8" x2="9" y2="8.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="15" y1="8" x2="15" y2="8.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="9" y1="12" x2="9" y2="12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="15" y1="12" x2="15" y2="12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="10" y="16" width="4" height="4" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'shield', label: 'Polis / Emniyet / Güvenlik', group: 'Kamu & Hizmet', glyph: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v8M8 11h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'flame', label: 'İtfaiye', group: 'Kamu & Hizmet', glyph: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke="currentColor" stroke-width="1.8" fill="none"/>' },
    { id: 'mail', label: 'Postane / Kargo', group: 'Kamu & Hizmet', glyph: '<rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><polyline points="20,7 12,13 4,7" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'mosque', label: 'Cami / İbadethane', group: 'Kamu & Hizmet', glyph: '<path d="M12 3c-3 3-4 6-4 9h8c0-3-1-6-4-9z" stroke="currentColor" stroke-width="1.6" fill="rgba(255,255,255,0.25)"/><rect x="6" y="12" width="12" height="9" stroke="currentColor" stroke-width="1.8"/><path d="M10 21v-4a2 2 0 0 1 4 0v4" stroke="currentColor" stroke-width="1.6"/><line x1="12" y1="2" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>' },
    { id: 'bank', label: 'Banka / ATM / Finans', group: 'Kamu & Hizmet', glyph: '<rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="15" r="1.5" fill="currentColor"/><circle cx="17" cy="15" r="1.5" fill="currentColor"/>' },

    // 5. Ulaşım & Altyapı
    { id: 'bus', label: 'Otogar / Otobüs Durağı', group: 'Ulaşım', glyph: '<rect x="4" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16" stroke="currentColor" stroke-width="1.8"/><circle cx="7.5" cy="14" r="1.3" fill="currentColor"/><circle cx="16.5" cy="14" r="1.3" fill="currentColor"/><path d="M6 17v2.5M18 17v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'train', label: 'Metro / Tren İstasyonu', group: 'Ulaşım', glyph: '<rect x="5" y="4" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 11h14" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="4" x2="12" y2="11" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="15" r="1.2" fill="currentColor"/><circle cx="16" cy="15" r="1.2" fill="currentColor"/><path d="m8 18-3 2.5M16 18l3 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'plane', label: 'Havalimanı', group: 'Ulaşım', glyph: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.3-1.8 1.1-.2.8.3 1.6 1.1 1.8l6.4 3.9-3.5 3.5-2.8-.7c-.5-.1-1 .1-1.3.5l-.4.5 3.2 2.2 2.2 3.2.5-.4c.4-.3.6-.8.5-1.3l-.7-2.8 3.5-3.5 3.9 6.4c.4.7 1.2 1 1.9.8.7-.3 1.1-1.1.9-1.8z" stroke="currentColor" stroke-width="1.5" fill="none"/>' },
    { id: 'gas-pump', label: 'Akaryakıt / Benzinlik', group: 'Ulaşım', glyph: '<path d="M4 4h10v16H4z" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h10" stroke="currentColor" stroke-width="1.8"/><path d="M14 6h2a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'bolt', label: 'Elektrikli Şarj İstasyonu', group: 'Ulaşım', glyph: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.3)" stroke-linejoin="round"/>' },
    { id: 'parking', label: 'Otopark', group: 'Ulaşım', glyph: '<path d="M8 18V6h5a3.5 3.5 0 0 1 0 7H8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' },

    // 6. Doğa, Spor & Konaklama
    { id: 'tree', label: 'Park / Doğa / Botanik', group: 'Doğa & Spor', glyph: '<path d="M12 3 5 12h3.5L5 17h14l-3.5-5H19z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.25)" stroke-linejoin="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
    { id: 'dumbbell', label: 'Spor Salonu / Fitness', group: 'Doğa & Spor', glyph: '<path d="M6 5v14M18 5v14M2 8v8M22 8v8M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'trophy', label: 'Stadyum / Spor Tesisi', group: 'Doğa & Spor', glyph: '<path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M6 3h12v7a6 6 0 0 1-12 0V3zM9 21h6M12 16v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'hotel', label: 'Otel / Konaklama', group: 'Doğa & Spor', glyph: '<path d="M3 7h18v14H3z" stroke="currentColor" stroke-width="1.8"/><path d="M7 11h2M15 11h2M7 15h2M15 15h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 21v-4h2v4" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'shopping-bag', label: 'AVM / Alışveriş', group: 'Doğa & Spor', glyph: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'map-pin', label: 'Genel İlgi Noktası', group: 'Diğer', glyph: '<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="rgba(255,255,255,0.3)"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' }
];

// İsim veya İkon ID'sine göre glyph bulan yardımcı
export function getGlyphByIconId(iconIdOrName = '') {
    const cleanId = (iconIdOrName || '').toLowerCase().replace('fa-', '').trim();
    const found = POI_ICON_LIST.find(i => i.id === cleanId);
    if (found) return found.glyph;

    // Kategori adı fallback eşleme
    for (const item of POI_ICON_LIST) {
        if (cleanId.includes(item.id) || cleanId.includes(item.label.toLowerCase())) {
            return item.glyph;
        }
    }
    
    // Default fallback
    return POI_ICON_LIST[POI_ICON_LIST.length - 1].glyph;
}

// Harita OpenLayers için tam SVG rozet üreten fonksiyon
export function getPoiCategoryBadgeSvg(catName = '', catIcon = '', color = '#3b82f6') {
    const glyph = getGlyphByIconId(catIcon || catName);
    const safeColor = color || '#3b82f6';

    return `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="${safeColor}" stroke="#ffffff" stroke-width="2.2"/>
      <circle cx="18" cy="18" r="14.5" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <g transform="translate(6, 6)" color="#ffffff">
        ${glyph}
      </g>
    </svg>`;
}
