// GeoraphMap POI Kapsamlı Vektörel İkon Kütüphanesi
// Tüm harita ve kategori tiplerine uygun zengin SVG simgeleri (Modern & Minimalist)

import { refinePoiGlyph } from './poiGlyphs';

export const POI_ICON_LIST = [
    // 1. Alışveriş & Ticaret (Shopping & Retail)
    { id: 'shopping-bag', label: 'Alışveriş / AVM / Mağaza', group: 'Alışveriş', glyph: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 6h18" stroke="currentColor" stroke-width="1.8"/><path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'store', label: 'Dükkan / Butik / Mağaza', group: 'Alışveriş', glyph: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" stroke-width="1.8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" stroke="currentColor" stroke-width="1.8"/><path d="M2 7h20v5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V7z" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'cart', label: 'Market / Süpermarket', group: 'Alışveriş', glyph: '<circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'tag', label: 'Pazar / Çarşı / İndirim', group: 'Alışveriş', glyph: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/>' },
    { id: 'shirt', label: 'Giyim / Moda / Tekstil', group: 'Alışveriş', glyph: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.5a2 2 0 0 0 1.96 1.67L6 11v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-9l1.18-.14a2 2 0 0 0 1.96-1.67l.58-3.5a2 2 0 0 0-1.34-2.23z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'gem', label: 'Kuyumcu / Mücevherat', group: 'Alışveriş', glyph: '<polygon points="6 3 18 3 22 9 12 22 2 9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="2" y1="9" x2="22" y2="9" stroke="currentColor" stroke-width="1.6"/><polyline points="12 22 7 9 10 3" stroke="currentColor" stroke-width="1.5"/><polyline points="12 22 17 9 14 3" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'gift', label: 'Hediyelik / Çiçekçi', group: 'Alışveriş', glyph: '<rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v13" stroke="currentColor" stroke-width="1.8"/><path d="M19 12H5" stroke="currentColor" stroke-width="1.8"/><path d="M12 8H7.5a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8z" stroke="currentColor" stroke-width="1.8"/><path d="M12 8h4.5a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8z" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'book-open', label: 'Kitapçı / Kırtasiye', group: 'Alışveriş', glyph: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'electronics', label: 'Elektronik / Teknoloji', group: 'Alışveriş', glyph: '<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'shoe', label: 'Ayakkabı & Deri', group: 'Alışveriş', glyph: '<path d="M3 18h18v-3c0-2-2-4-5-4l-3-3H7c-2 0-4 2-4 4v6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' },

    // 2. Yeme & İçme & Eğlence
    { id: 'utensils', label: 'Restoran / Yemek', group: 'Yeme & İçme', glyph: '<path d="M18 4v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 4v16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M22 13V4a4 4 0 0 0-4 4v5a2 2 0 0 0 2 2h2v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'coffee', label: 'Kafe / Kahve', group: 'Yeme & İçme', glyph: '<path d="M17 9h1a3 3 0 0 1 0 6h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 9h12v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9z" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="8" y1="4" x2="8" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="11" y1="4" x2="11" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="14" y1="4" x2="14" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'burger', label: 'Fast Food / Burger', group: 'Yeme & İçme', glyph: '<path d="M6 10h12a1 1 0 0 0 1-1 5 5 0 0 0-10 0 1 1 0 0 0 1 1z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.2)"/><line x1="5" y1="13" x2="19" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 16h12a1.5 1.5 0 0 1 1.5 1.5V18a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-.5A1.5 1.5 0 0 1 6 16z" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'pizza', label: 'Pizza / Fırın', group: 'Yeme & İçme', glyph: '<path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="17" r="1.5" fill="currentColor"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/>' },
    { id: 'cake', label: 'Pastane / Tatlı', group: 'Yeme & İçme', glyph: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" stroke="currentColor" stroke-width="1.8"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.8"/><path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="3" r="1" fill="currentColor"/>' },
    { id: 'glass', label: 'Bar / Gece Kulübü', group: 'Yeme & İçme', glyph: '<path d="M8 22h8M12 15v7M5 3l7 9 7-9H5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'ice-cream', label: 'Dondurmacı / Tatlı', group: 'Yeme & İçme', glyph: '<path d="m7 11 5 11 5-11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 2a5 5 0 0 0-5 5c0 1.5.7 3 2 4h6a5 5 0 0 0-3-9Z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.2)"/>' },
    { id: 'flame-grill', label: 'Kebap / Izgara / Ocakbaşı', group: 'Yeme & İçme', glyph: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke="currentColor" stroke-width="1.8"/>' },

    // 3. Sağlık & Medikal
    { id: 'hospital', label: 'Hastane / Sağlık', group: 'Sağlık', glyph: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>' },
    { id: 'pill', label: 'Eczane / İlaç', group: 'Sağlık', glyph: '<path d="m9.5 17.5 7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5Z" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="8" y1="8" x2="13" y2="13" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'heartbeat', label: 'Klinik / Sağlık Ocağı', group: 'Sağlık', glyph: '<path d="M21 12h-3.5l-2.5 6L11 4l-2.5 8H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'stethoscope', label: 'Doktor / Muayenehane', group: 'Sağlık', glyph: '<path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3M9 12.5V17a3 3 0 0 0 6 0v-2M15 15a2 2 0 1 0 4 0 2 2 0 1 0-4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'tooth', label: 'Diş Hekimi / Klinik', group: 'Sağlık', glyph: '<path d="M12 2C8 2 6 5 6 8c0 4 2 11 3 13s3 1 3-2c0-3 0-3 0-3s0 0 0 3c0 3 2 4 3 2s3-9 3-13c0-3-2-6-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'paw', label: 'Veteriner', group: 'Sağlık', glyph: '<circle cx="12" cy="15" r="3.5" fill="currentColor"/><circle cx="6.5" cy="10.5" r="2" fill="currentColor"/><circle cx="17.5" cy="10.5" r="2" fill="currentColor"/><circle cx="9" cy="5.5" r="1.8" fill="currentColor"/><circle cx="15" cy="5.5" r="1.8" fill="currentColor"/>' },
    { id: 'eye', label: 'Göz Merkezi / Optik', group: 'Sağlık', glyph: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>' },
    { id: 'spa', label: 'Spa / Termal / Masaj', group: 'Sağlık', glyph: '<path d="M12 3a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9a9 9 0 0 0-9-9z" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 3"/><path d="M12 7c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7z" fill="currentColor"/>' },

    // 4. Eğitim, Kültür & Tarih
    { id: 'museum', label: 'Müze / Tarihi Eser', group: 'Eğitim & Kültür', glyph: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 2L2 7h20L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'library', label: 'Kütüphane / Kitabevi', group: 'Eğitim & Kültür', glyph: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12A2.5 2.5 0 0 1 6.5 3z" stroke="currentColor" stroke-width="1.8"/><path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
    { id: 'art-center', label: 'Sanat Merkezi / Kültür', group: 'Eğitim & Kültür', glyph: '<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="10" r="1.4" fill="currentColor"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/><circle cx="16" cy="10" r="1.4" fill="currentColor"/><path d="M8.5 15.5c2 2 5 2 7 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id: 'monument', label: 'Anıt / Heykel / Abide', group: 'Eğitim & Kültür', glyph: '<path d="M10 21h4M8 21l2-14 2-4 2 4 2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="21" x2="18" y2="21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
    { id: 'graduation-cap', label: 'Üniversite / Kampüs', group: 'Eğitim & Kültür', glyph: '<path d="M21 9v5M3 9l9-4 9 4-9 4-9-4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11.5v4c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'school', label: 'Okul / Lise', group: 'Eğitim & Kültür', glyph: '<path d="M4 21V10l8-5 8 5v11H4z" stroke="currentColor" stroke-width="1.8"/><path d="M10 21v-5h4v5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'film', label: 'Sinema / Tiyatro', group: 'Eğitim & Kültür', glyph: '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 4v16M17 4v16M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'music', label: 'Konser / Müzik / Opera', group: 'Eğitim & Kültür', glyph: '<path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="18" cy="16" r="3" fill="currentColor"/>' },

    // 5. Spor, Doğa & Rekreasyon
    { id: 'sports', label: 'Spor Sahası / Tesis', group: 'Spor & Doğa', glyph: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 0 1 9 9M12 3a9 9 0 0 0-9 9M12 21a9 9 0 0 1-9-9M12 21a9 9 0 0 0 9-9" stroke="currentColor" stroke-width="1.4"/><path d="M3 12h18" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'beach', label: 'Plaj / Kumsal / Sahil', group: 'Spor & Doğa', glyph: '<path d="M12 3a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.2)"/><path d="M12 11v10M10 21h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 19c2-1 4-1 6 0s4 1 6 0 4-1 4-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
    { id: 'tree', label: 'Park / Doğa / Botanik', group: 'Spor & Doğa', glyph: '<path d="M12 2C8.8 2 6.5 4.6 6.5 7.8c0 2 1 3.7 2.6 4.8-.3.6-.4 1.2-.4 1.9 0 2.2 1.8 4 4 4s4-1.8 4-4c0-.7-.1-1.3-.4-1.9 1.6-1.1 2.6-2.8 2.6-4.8C18.5 4.6 16.2 2 12 2z" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.3)" stroke-linejoin="round"/><line x1="12" y1="15.5" x2="12" y2="22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' },
    { id: 'mountain', label: 'Dağcılık / Zirve / Parkur', group: 'Spor & Doğa', glyph: '<path d="m8 3 4 8 5-5 5 15H2L8 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 14l4-4 3 3" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'tent', label: 'Kamp Alanı / Glamping', group: 'Spor & Doğa', glyph: '<path d="M19 21 12 4 5 21" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m12 4 7 17M12 4v17" stroke="currentColor" stroke-width="1.8"/><path d="M2 21h20" stroke="currentColor" stroke-width="2"/>' },
    { id: 'snowflake', label: 'Kayak Merkezi / Kış Sporları', group: 'Spor & Doğa', glyph: '<line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.8"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.8"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" stroke-width="1.8"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'dumbbell', label: 'Fitness / Spor Salonu', group: 'Spor & Doğa', glyph: '<path d="M6 5v14M18 5v14M2 8v8M22 8v8M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'hotel', label: 'Otel / Konaklama', group: 'Spor & Doğa', glyph: '<path d="M3 7h18v14H3z" stroke="currentColor" stroke-width="1.8"/><path d="M7 11h2M15 11h2M7 15h2M15 15h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 21v-4h2v4" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'camera', label: 'Seyir Terası / Manzara', group: 'Spor & Doğa', glyph: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'fish', label: 'Akvaryum / Su Parkı', group: 'Spor & Doğa', glyph: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" stroke="currentColor" stroke-width="1.8"/><path d="M18 12c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3Z" fill="currentColor"/><path d="M2 16l4.5-4L2 8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },

    // 6. Otomotiv & Ulaşım
    { id: 'gas-pump', label: 'Benzinlik / Akaryakıt', group: 'Ulaşım & Otomotiv', glyph: '<path d="M4 4h10v16H4z" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h10" stroke="currentColor" stroke-width="1.8"/><path d="M14 6h2a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'ev-charging', label: 'Elektrikli Şarj İstasyonu', group: 'Ulaşım & Otomotiv', glyph: '<path d="M5 4h10v16H5z" stroke="currentColor" stroke-width="1.8"/><path d="M15 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" stroke="currentColor" stroke-width="1.8"/><path d="m10 8-2 4h4l-2 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: 'car', label: 'Oto Galeri / Araç Kiralama', group: 'Ulaşım & Otomotiv', glyph: '<path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17l-1 2M19 17l1 2" stroke="currentColor" stroke-width="1.8"/><circle cx="7.5" cy="13.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="13.5" r="1.5" fill="currentColor"/>' },
    { id: 'wrench', label: 'Oto Sanayi / Tamir / Servis', group: 'Ulaşım & Otomotiv', glyph: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'parking', label: 'Otopark / Katlı Park', group: 'Ulaşım & Otomotiv', glyph: '<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M9 16V8h4a2 2 0 0 1 0 4H9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
    { id: 'plane', label: 'Havalimanı / Havaalanı', group: 'Ulaşım & Otomotiv', glyph: '<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'anchor', label: 'Marina / Liman / İskele', group: 'Ulaşım & Otomotiv', glyph: '<circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="8" x2="12" y2="21" stroke="currentColor" stroke-width="1.8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'bus', label: 'Otobüs / Terminal', group: 'Ulaşım & Otomotiv', glyph: '<rect x="4" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16" stroke="currentColor" stroke-width="1.8"/><circle cx="7.5" cy="14" r="1.3" fill="currentColor"/><circle cx="16.5" cy="14" r="1.3" fill="currentColor"/><path d="M6 17v2.5M18 17v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'train', label: 'Metro / Tren / Gar', group: 'Ulaşım & Otomotiv', glyph: '<rect x="5" y="4" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 11h14" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="4" x2="12" y2="11" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="15" r="1.2" fill="currentColor"/><circle cx="16" cy="15" r="1.2" fill="currentColor"/><path d="m8 18-3 2.5M16 18l3 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },

    // 7. Kamu, Finans, Din & Hizmetler
    { id: 'atm', label: 'ATM / Bankamatik', group: 'Kamu & Finans', glyph: '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.8"/><rect x="6" y="13" width="4" height="3" fill="currentColor"/><line x1="14" y1="14" x2="18" y2="14" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'bank', label: 'Banka Şubesi / Finans', group: 'Kamu & Finans', glyph: '<path d="M3 21h18M3 10h18M5 10v7M9 10v7M15 10v7M19 10v7M12 2 2 7h20L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
    { id: 'landmark', label: 'Belediye / Valilik / Kamu', group: 'Kamu & Finans', glyph: '<line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="16" x2="6" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="10" y1="16" x2="10" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="14" y1="16" x2="14" y2="10" stroke="currentColor" stroke-width="1.8"/><line x1="18" y1="16" x2="18" y2="10" stroke="currentColor" stroke-width="1.8"/><polygon points="12 4 20 8 4 8" stroke="currentColor" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>' },
    { id: 'court', label: 'Adliye / Mahkeme / Noter', group: 'Kamu & Finans', glyph: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18M3 7h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'mail', label: 'PTT / Postane / Kargo', group: 'Kamu & Finans', glyph: '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><polyline points="3 7 12 13 21 7" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'briefcase', label: 'İş Merkezi / Plaza / Ofis', group: 'Kamu & Finans', glyph: '<rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' },
    { id: 'scissors', label: 'Berber / Kuaför / Güzellik', group: 'Hizmetler', glyph: '<circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><line x1="20" y1="4" x2="8.12" y2="15.88" stroke="currentColor" stroke-width="1.8"/><line x1="14.47" y1="14.48" x2="20" y2="20" stroke="currentColor" stroke-width="1.8"/><line x1="8.12" y1="8.12" x2="12" y2="12" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'shield', label: 'Polis / Karakol / Güvenlik', group: 'Kamu & Finans', glyph: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v8M8 11h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: 'flame', label: 'İtfaiye', group: 'Kamu & Finans', glyph: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke="currentColor" stroke-width="1.8" fill="none"/>' },
    { id: 'crescent', label: 'Cami / Mescit / İbadethane', group: 'Dini Tesisler', glyph: '<path d="M18 12a6 6 0 1 1-6-6 4.5 4.5 0 0 0 6 6z" stroke="currentColor" stroke-width="1.8" fill="currentColor"/><circle cx="16.5" cy="7.5" r="1.2" fill="currentColor"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'church', label: 'Kilise / Şapel', group: 'Dini Tesisler', glyph: '<path d="M12 2v6M9 5h6M4 21V11l8-4 8 4v10H4z" stroke="currentColor" stroke-width="1.8"/><path d="M10 21v-4h4v4" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'wifi', label: 'Wi-Fi / İnternet Noktası', group: 'Hizmetler', glyph: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'map-pin', label: 'Genel İlgi Noktası', group: 'Diğer', glyph: '<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="rgba(255,255,255,0.3)"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' },
    { id: 'metro', label: 'Metro / Yeraltı İstasyonu', group: 'Ulaşım', glyph: '' },
    { id: 'city-landmark', label: 'Şehir Simgesi / Kent Simgesi', group: 'Eğitim & Kültür', glyph: '' },
    { id: 'military-area', label: 'Askeri Alan / Askeri Tesis', group: 'Hizmetler', glyph: '' },
    { id: 'tram', label: 'Tramvay / Hafif Raylı Sistem', group: 'Ulaşım', glyph: '' },
    { id: 'ship', label: 'Vapur / Feribot İskelesi', group: 'Ulaşım', glyph: '' },
].map(item => ({ ...item, glyph: refinePoiGlyph(item.id, item.glyph) }));

// Standart POI Filtreleme Kategorileri Listesi (SaaS & GIS Tasarımlı)
export const POI_FILTER_CATEGORIES = [
    { key: 'sehir_simgesi', label: 'Şehir Simgesi', labelEn: 'City Landmark', iconId: 'city-landmark', color: '#7c3aed', matchKeywords: ['şehir simgesi', 'kent simgesi'] },
    { key: 'askeri', label: 'Askeri Alan', labelEn: 'Military Area', iconId: 'military-area', color: '#4d7c0f', matchKeywords: ['askeri', 'askerî', 'kışla'] },
    { key: 'standart', label: 'Standart POI', labelEn: 'General POI', iconId: 'map-pin', color: '#2563eb', matchKeywords: ['standart poi', 'genel poi', 'genel ilgi noktası'] },
    { key: 'alisveris', label: 'Alışveriş & Mağaza', labelEn: 'Shopping & Stores', iconId: 'shopping-bag', color: '#0284c7', matchKeywords: ['alışveriş', 'alisveris', 'avm', 'mağaza', 'magaza', 'butik', 'çarşı', 'carsi', 'pazar', 'giyim', 'ayakkabı', 'kuyumcu', 'avm\'si'] },
    { key: 'market', label: 'Market & Gıda', labelEn: 'Supermarket & Food', iconId: 'cart', color: '#0ea5e9', matchKeywords: ['market', 'bakkal', 'süpermarket', 'supermarket', 'hipermarket', 'şarküteri', 'manav', 'kasap', 'fırın'] },
    { key: 'hastane', label: 'Sağlık & Hastane', labelEn: 'Healthcare & Hospital', iconId: 'hospital', color: '#ef4444', matchKeywords: ['sağlık', 'saglik', 'hastane', 'klinik', 'doktor', 'tıp', 'poliklinik', 'sağlık ocağı'] },
    { key: 'eczane', label: 'Eczane', labelEn: 'Pharmacy', iconId: 'pill', color: '#10b981', matchKeywords: ['eczane', 'ilaç', 'ilac', 'medikal'] },
    { key: 'okul', label: 'Eğitim & Okul', labelEn: 'Education & Schools', iconId: 'school', color: '#3b82f6', matchKeywords: ['eğitim', 'egitim', 'okul', 'üniversite', 'universite', 'fakülte', 'kolej', 'lise', 'ilkokul', 'öğrenci'] },
    { key: 'muze', label: 'Müze & Tarih', labelEn: 'Museums & History', iconId: 'museum', color: '#8b5cf6', matchKeywords: ['müze', 'muze', 'museum', 'örenyeri', 'ören', 'tarih', 'antik', 'kale'] },
    { key: 'kutuphane', label: 'Kütüphane & Kitap', labelEn: 'Library & Books', iconId: 'library', color: '#6366f1', matchKeywords: ['kütüphane', 'kutuphane', 'library', 'kitap', 'kitabevi', 'kırtasiye', 'arşiv'] },
    { key: 'sanat', label: 'Sanat & Kültür', labelEn: 'Art & Culture', iconId: 'art-center', color: '#ec4899', matchKeywords: ['sanat', 'kültür', 'kultur', 'galeri', 'tiyatro', 'sergi', 'konser', 'sinema', 'sahne'] },
    { key: 'anit', label: 'Anıt & Heykel', labelEn: 'Monuments & Memorials', iconId: 'monument', color: '#f59e0b', matchKeywords: ['anıt', 'anit', 'heykel', 'abide', 'türbe', 'anıtı', 'şehitlik'] },
    { key: 'spor', label: 'Spor & Tesis', labelEn: 'Sports & Recreation', iconId: 'sports', color: '#10b981', matchKeywords: ['spor', 'saha', 'stadyum', 'stadium', 'fitness', 'kort', 'gym', 'havuz', 'antrenman'] },
    { key: 'akaryakit', label: 'Benzin & Şarj', labelEn: 'Fuel & EV Charging', iconId: 'gas-pump', color: '#f97316', matchKeywords: ['akaryakıt', 'akaryakit', 'benzin', 'petrol', 'gaz', 'istasyon', 'şarj', 'sarj', 'elektrikli şarj'] },
    { key: 'oto_servis', label: 'Oto Servis & Bakım', labelEn: 'Auto Repair & Service', iconId: 'wrench', color: '#eab308', matchKeywords: ['oto tamir', 'oto sanayi', 'oto servis', 'oto yıkama', 'lastikçi', 'oto galeri', 'rent a car', 'araç kiralama'] },
    { key: 'otopark', label: 'Otopark', labelEn: 'Parking', iconId: 'parking', color: '#64748b', matchKeywords: ['otopark', 'katlı otopark', 'park yeri', 'kapalı otopark'] },
    { key: 'atm', label: 'Banka & ATM', labelEn: 'Banks & ATMs', iconId: 'atm', color: '#06b6d4', matchKeywords: ['atm', 'banka', 'finans', 'döviz', 'kredi', 'bankamatik'] },
    { key: 'plaj', label: 'Plaj & Sahil', labelEn: 'Beaches & Waterfronts', iconId: 'beach', color: '#06b6d4', matchKeywords: ['plaj', 'kumsal', 'sahil', 'koy', 'beach', 'marina', 'deniz', 'iskele'] },
    { key: 'kafe', label: 'Kafe & Kahve', labelEn: 'Cafes & Bakeries', iconId: 'coffee', color: '#d97706', matchKeywords: ['kafe', 'cafe', 'kahve', 'çay', 'pastane', 'tatlıcı', 'dondurmacı'] },
    { key: 'restoran', label: 'Yeme-İçme & Restoran', labelEn: 'Dining & Restaurants', iconId: 'utensils', color: '#f43f5e', matchKeywords: ['yeme', 'restoran', 'yemek', 'lokanta', 'kebap', 'burger', 'pizza', 'döner', 'ocakbaşı', 'köfte'] },
    { key: 'otel', label: 'Otel & Konaklama', labelEn: 'Hotels & Lodging', iconId: 'hotel', color: '#a855f7', matchKeywords: ['otel', 'hotel', 'konaklama', 'pansiyon', 'tatil', 'motel', 'resort', 'apart'] },
    { key: 'park', label: 'Park & Doğa', labelEn: 'Parks & Nature', iconId: 'tree', color: '#22c55e', matchKeywords: ['park', 'doğa', 'doga', 'bahçe', 'bahce', 'koru', 'orman', 'yeşil', 'botanik', 'mesire', 'milli park', 'kamp', 'dağ'] },
    { key: 'dini', label: 'Cami & Dini Tesis', labelEn: 'Places of Worship', iconId: 'crescent', color: '#14b8a6', matchKeywords: ['cami', 'mescit', 'kilise', 'şapel', 'havra', 'sinagog', 'türbe', 'külliye'] },
    { key: 'havalimani', label: 'Havalimanı & Uçuş', labelEn: 'Airports & Aviation', iconId: 'plane', color: '#0ea5e9', matchKeywords: ['havalimanı', 'havalimani', 'havaalanı', 'havaalani', 'airport', 'terminal', 'pist', 'ist', 'saw', 'esb', 'adb', 'ayt'] },
    { key: 'liman', label: 'Deniz Limanı & Marina', labelEn: 'Seaports & Marinas', iconId: 'anchor', color: '#0284c7', matchKeywords: ['liman', 'limani', 'port', 'marina', 'iskele', 'feribot', 'ro-ro', 'kruvaziyer'] },
    { key: 'kamu', label: 'Kamu & Resmi Kurum', labelEn: 'Public & Government', iconId: 'landmark', color: '#6366f1', matchKeywords: ['belediye', 'valilik', 'kaymakamlık', 'adliye', 'mahkeme', 'noter', 'ptt', 'postane', 'karakol', 'polis', 'itfaiye', 'nüfus'] }
];

const KNOWN_CATEGORY_TRANSLATIONS = {
    'kültür & turizm': 'Culture & Tourism',
    'kultur & turizm': 'Culture & Tourism',
    'kültür ve turizm': 'Culture & Tourism',
    'kultur ve turizm': 'Culture & Tourism',
    'kamu & hizmet': 'Public & Services',
    'kamu ve hizmetler': 'Public & Services',
    'sağlık': 'Healthcare',
    'saglik': 'Healthcare',
    'sağlık & hastane': 'Healthcare & Hospital',
    'saglik & hastane': 'Healthcare & Hospital',
    'eğitim': 'Education',
    'egitim': 'Education',
    'eğitim & okul': 'Education & Schools',
    'egitim & okul': 'Education & Schools',
    'ulaşım': 'Transportation',
    'ulasim': 'Transportation',
    'yeme & içme': 'Dining & Food',
    'yeme & icme': 'Dining & Food',
    'yeme-içme': 'Dining & Food',
    'yeme-icme': 'Dining & Food',
    'alışveriş': 'Shopping',
    'alisveris': 'Shopping',
    'alışveriş & mağaza': 'Shopping & Stores',
    'alisveris & magaza': 'Shopping & Stores',
    'spor & doğa': 'Sports & Nature',
    'konaklama': 'Accommodation',
    'finans & banka': 'Finance & Banking',
    'dini tesisler': 'Religious Sites',
    'parklar': 'Parks',
    'park & doğa': 'Parks & Nature',
    'eğlence': 'Entertainment',
    'eglence': 'Entertainment',
    'üniversite & kampüs': 'University & Campus',
    'universite & kampus': 'University & Campus',
    'bakanlıklar ve başkanlıklar': 'Ministries & Directorates',
    'bakanliklar ve baskanliklar': 'Ministries & Directorates',
    'belediye & kaymakamlık': 'Municipality & District Governorate',
    'belediye & kaymakamlik': 'Municipality & District Governorate'
};

export function getLocalizedPoiCategoryLabel(catOrName, lang = 'tr') {
    if (!catOrName) return '';
    const rawName = typeof catOrName === 'object' ? (catOrName.name || catOrName.label || '') : String(catOrName);
    if (lang === 'tr') return rawName;
    
    // Check if it's an object with labelEn
    if (typeof catOrName === 'object' && catOrName.labelEn) {
        return catOrName.labelEn;
    }
    
    // Check presets
    const lower = rawName.trim().toLowerCase();
    const preset = POI_FILTER_CATEGORIES.find(p => p.label.toLowerCase() === lower || (p.matchKeywords && p.matchKeywords.includes(lower)));
    if (preset && preset.labelEn) {
        return preset.labelEn;
    }

    if (KNOWN_CATEGORY_TRANSLATIONS[lower]) {
        return KNOWN_CATEGORY_TRANSLATIONS[lower];
    }

    for (const [key, val] of Object.entries(KNOWN_CATEGORY_TRANSLATIONS)) {
        if (lower.includes(key)) return val;
    }

    return rawName;
}

// İsim veya İkon ID'sine göre glyph bulan yardımcı
export function getGlyphByIconId(iconIdOrName = '') {
    const cleanId = (iconIdOrName || '').toLowerCase().replace('fa-', '').trim();
    // Explicit saved icon choices take precedence over category-name heuristics.
    const exactIcon = POI_ICON_LIST.find(item => item.id === cleanId);
    if (exactIcon) return exactIcon.glyph;
    const transitName = cleanId.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
    const transitMatch = /tramvay|tram/.test(transitName) ? 'tram'
        : /metrobus|otobus|bus/.test(transitName) ? 'bus'
        : /metro|subway/.test(transitName) ? 'metro'
        : /tren|railway|train/.test(transitName) ? 'train'
        : /feribot|vapur|iskele|ferry|ship/.test(transitName) ? 'ship' : null;
    if (transitMatch) return POI_ICON_LIST.find(item => item.id === transitMatch).glyph;

    // Özel kategori eşleşmeleri
    if (cleanId.includes('alışveriş') || cleanId.includes('alisveris') || cleanId.includes('shopping') || cleanId.includes('avm') || cleanId.includes('mağaza') || cleanId.includes('magaza') || cleanId.includes('butik') || cleanId.includes('bag')) {
        const item = POI_ICON_LIST.find(i => i.id === 'shopping-bag');
        if (item) return item.glyph;
    }
    if (cleanId.includes('market') || cleanId.includes('cart') || cleanId.includes('süpermarket') || cleanId.includes('bakkal')) {
        const item = POI_ICON_LIST.find(i => i.id === 'cart');
        if (item) return item.glyph;
    }
    if (cleanId.includes('giyim') || cleanId.includes('moda') || cleanId.includes('tekstil') || cleanId.includes('shirt') || cleanId.includes('clothing')) {
        const item = POI_ICON_LIST.find(i => i.id === 'shirt');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kuyumcu') || cleanId.includes('mücevher') || cleanId.includes('mucevher') || cleanId.includes('altın') || cleanId.includes('gem') || cleanId.includes('jewelry')) {
        const item = POI_ICON_LIST.find(i => i.id === 'gem');
        if (item) return item.glyph;
    }
    if (cleanId.includes('hediye') || cleanId.includes('çiçek') || cleanId.includes('cicek') || cleanId.includes('gift')) {
        const item = POI_ICON_LIST.find(i => i.id === 'gift');
        if (item) return item.glyph;
    }
    if (cleanId.includes('elektronik') || cleanId.includes('teknoloji') || cleanId.includes('telefon') || cleanId.includes('electronics') || cleanId.includes('bilgisayar')) {
        const item = POI_ICON_LIST.find(i => i.id === 'electronics');
        if (item) return item.glyph;
    }
    if (cleanId.includes('müze') || cleanId.includes('muze') || cleanId.includes('museum')) {
        const item = POI_ICON_LIST.find(i => i.id === 'museum');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kütüphane') || cleanId.includes('kutuphane') || cleanId.includes('library') || cleanId.includes('kitap')) {
        const item = POI_ICON_LIST.find(i => i.id === 'library');
        if (item) return item.glyph;
    }
    if (cleanId.includes('sanat') || cleanId.includes('kültür') || cleanId.includes('galeri') || cleanId.includes('art')) {
        const item = POI_ICON_LIST.find(i => i.id === 'art-center');
        if (item) return item.glyph;
    }
    if (cleanId.includes('anıt') || cleanId.includes('anit') || cleanId.includes('heykel') || cleanId.includes('monument')) {
        const item = POI_ICON_LIST.find(i => i.id === 'monument');
        if (item) return item.glyph;
    }
    if (cleanId.includes('spor') || cleanId.includes('saha') || cleanId.includes('stadyum') || cleanId.includes('stadium') || cleanId.includes('fitness')) {
        const item = POI_ICON_LIST.find(i => i.id === 'sports');
        if (item) return item.glyph;
    }
    if (cleanId.includes('plaj') || cleanId.includes('kumsal') || cleanId.includes('sahil') || cleanId.includes('beach')) {
        const item = POI_ICON_LIST.find(i => i.id === 'beach');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kafe') || cleanId.includes('cafe') || cleanId.includes('kahve') || cleanId.includes('coffee')) {
        const item = POI_ICON_LIST.find(i => i.id === 'coffee');
        if (item) return item.glyph;
    }
    if (cleanId.includes('benzin') || cleanId.includes('akaryakıt') || cleanId.includes('akaryakit') || cleanId.includes('petrol') || cleanId.includes('gas')) {
        const item = POI_ICON_LIST.find(i => i.id === 'gas-pump');
        if (item) return item.glyph;
    }
    if (cleanId.includes('şarj') || cleanId.includes('sarj') || cleanId.includes('ev-charging') || cleanId.includes('charging')) {
        const item = POI_ICON_LIST.find(i => i.id === 'ev-charging');
        if (item) return item.glyph;
    }
    if (cleanId.includes('otopark') || cleanId.includes('parking')) {
        const item = POI_ICON_LIST.find(i => i.id === 'parking');
        if (item) return item.glyph;
    }
    if (cleanId.includes('tamir') || cleanId.includes('servis') || cleanId.includes('sanayi') || cleanId.includes('wrench')) {
        const item = POI_ICON_LIST.find(i => i.id === 'wrench');
        if (item) return item.glyph;
    }
    if (cleanId.includes('atm') || cleanId.includes('bankamatik')) {
        const item = POI_ICON_LIST.find(i => i.id === 'atm');
        if (item) return item.glyph;
    }
    if (cleanId.includes('banka') || cleanId.includes('bank') || cleanId.includes('finans')) {
        const item = POI_ICON_LIST.find(i => i.id === 'bank');
        if (item) return item.glyph;
    }
    if (cleanId.includes('cami') || cleanId.includes('mescit') || cleanId.includes('crescent') || cleanId.includes('dini')) {
        const item = POI_ICON_LIST.find(i => i.id === 'crescent');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kilise') || cleanId.includes('church')) {
        const item = POI_ICON_LIST.find(i => i.id === 'church');
        if (item) return item.glyph;
    }
    if (cleanId.includes('adliye') || cleanId.includes('mahkeme') || cleanId.includes('noter') || cleanId.includes('court')) {
        const item = POI_ICON_LIST.find(i => i.id === 'court');
        if (item) return item.glyph;
    }
    if (cleanId.includes('belediye') || cleanId.includes('valilik') || cleanId.includes('kaymakam') || cleanId.includes('landmark')) {
        const item = POI_ICON_LIST.find(i => i.id === 'landmark');
        if (item) return item.glyph;
    }
    if (cleanId.includes('postane') || cleanId.includes('ptt') || cleanId.includes('kargo') || cleanId.includes('mail')) {
        const item = POI_ICON_LIST.find(i => i.id === 'mail');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kuaför') || cleanId.includes('kuafor') || cleanId.includes('berber') || cleanId.includes('güzellik') || cleanId.includes('scissors')) {
        const item = POI_ICON_LIST.find(i => i.id === 'scissors');
        if (item) return item.glyph;
    }
    if (cleanId.includes('dağ') || cleanId.includes('dag') || cleanId.includes('zirve') || cleanId.includes('mountain') || cleanId.includes('hiking')) {
        const item = POI_ICON_LIST.find(i => i.id === 'mountain');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kamp') || cleanId.includes('tent') || cleanId.includes('glamping') || cleanId.includes('karavan')) {
        const item = POI_ICON_LIST.find(i => i.id === 'tent');
        if (item) return item.glyph;
    }
    if (cleanId.includes('kayak') || cleanId.includes('kış') || cleanId.includes('snow') || cleanId.includes('snowflake')) {
        const item = POI_ICON_LIST.find(i => i.id === 'snowflake');
        if (item) return item.glyph;
    }
    if (cleanId.includes('havaliman') || cleanId.includes('hava liman') || cleanId.includes('havaalan') || cleanId.includes('uçak') || cleanId.includes('plane') || cleanId.includes('airport')) {
        const item = POI_ICON_LIST.find(i => i.id === 'plane');
        if (item) return item.glyph;
    }
    if (/(^|[\s_-])(marina|liman[ıi]?|iskele[si]*|anchor|port)([\s_-]|$)/u.test(cleanId)) {
        const item = POI_ICON_LIST.find(i => i.id === 'anchor');
        if (item) return item.glyph;
    }
    if (
        cleanId === 'tree' || cleanId === 'park' || cleanId.includes('park') ||
        cleanId.includes('ağaç') || cleanId.includes('agac') ||
        cleanId.includes('bahçe') || cleanId.includes('bahce') ||
        cleanId.includes('botanik') || cleanId.includes('yeşil') || cleanId.includes('yesil')
    ) {
        const treeItem = POI_ICON_LIST.find(i => i.id === 'tree');
        if (treeItem) return treeItem.glyph;
    }

    const found = POI_ICON_LIST.find(i => i.id === cleanId);
    if (found) return found.glyph;

    // Kategori adı fallback eşleme
    for (const item of POI_ICON_LIST) {
        const itemLabels = item.label.toLowerCase().split(/[\s/]+/);
        if (cleanId.includes(item.id) || itemLabels.some(l => l.length > 2 && cleanId.includes(l))) {
            return item.glyph;
        }
    }
    
    // Default fallback
    return POI_ICON_LIST.find(item => item.id === 'map-pin').glyph;
}

// Harita OpenLayers için tam SVG rozet üreten fonksiyon (Modern & Zarif)
export function getPoiCategoryBadgeSvg(catName = '', catIcon = '', color = '#3b82f6') {
    const glyph = getGlyphByIconId(catIcon || catName);
    const safeColor = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color || '') ? color : '#2563eb';
    const hex = safeColor.slice(1);
    const expanded = hex.length === 3 ? [...hex].map(channel => channel + channel).join('') : hex;
    // Solid category colors; choose contrasting ink for bright yellow or pale colors.
    const channels = expanded.match(/../g).map(channel => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const inkColor = luminance > 0.3 ? '#10213a' : '#ffffff';

    return `<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="30" height="30" rx="10" fill="#0d1626" fill-opacity="0.18"/>
      <rect x="2" y="2" width="30" height="30" rx="10" fill="#ffffff" stroke="#ffffff" stroke-width="2"/>
      <rect x="3" y="3" width="28" height="28" rx="9" fill="${safeColor}"/>
      <rect x="4" y="4" width="26" height="26" rx="8" stroke="#ffffff" stroke-opacity="0.25"/>
      <g transform="translate(7, 7) scale(0.833333)" color="${inkColor}">
        ${glyph}
      </g>
    </svg>`;
}

// Akıllı Ulaşım Durakları için Vektörel Rozet SVG Üretici
export function getTransitStopBadgeSvg(stopClass = 'otobus', color = '#0284c7') {
    const key = String(stopClass || '').toLocaleLowerCase('tr-TR').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').trim();
    const icons = {
        havayolu: 'plane', havalimani: 'plane', havaalani: 'plane', airport: 'plane', ucak: 'plane', plane: 'plane',
        liman: 'anchor', marina: 'anchor', port: 'anchor', seaport: 'anchor', anchor: 'anchor',
        gemi: 'ship', deniz: 'ship', vapur: 'ship', feribot: 'ship', ferry: 'ship', ship: 'ship', iskele: 'ship',
        metro: 'metro', subway: 'metro', tramvay: 'tram', tram: 'tram',
        tren: 'train', train: 'train', railway: 'train',
        otobus: 'bus', bus: 'bus', metrobus: 'bus'
    };
    return getPoiCategoryBadgeSvg('', icons[key] || 'bus', color);
}
// Veritabanındaki Dinamik Kategoriler ile Standart Kategorileri Birleştiren Fonksiyon
export function getMergedPoiCategories(dynamicDbCategories = []) {
    const list = [...POI_FILTER_CATEGORIES];
    const existingKeys = new Set(list.map(c => c.key));
    const existingLabels = new Set(list.map(c => (c.label || '').toLowerCase()));

    (dynamicDbCategories || []).forEach(dbCat => {
        if (!dbCat || !dbCat.name) return;
        const normName = dbCat.name.trim().toLowerCase();
        
        // Mevcut bir kategoriyle eşleşip eşleşmediğini kontrol et
        const matchedPreset = list.find(p => p.matchKeywords.some(k => normName.includes(k)) || normName === p.label.toLowerCase());
        if (matchedPreset) {
            if (dbCat.id && !matchedPreset.dbId) {
                matchedPreset.dbId = dbCat.id;
            }
            return;
        }

        // Yeni eklenmiş özel bir kategori
        const key = `cat_${dbCat.id || dbCat.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        if (!existingKeys.has(key) && !existingLabels.has(normName)) {
            existingKeys.add(key);
            existingLabels.add(normName);
            list.push({
                key,
                label: dbCat.name,
                iconId: dbCat.icon || 'map-pin',
                color: dbCat.color || '#8b5cf6',
                matchKeywords: [normName],
                dbId: dbCat.id,
                description: dbCat.description || ''
            });
        }
    });

    return list;
}

// Native select options use a monochrome marker; category colors remain on map badges.
export function getCategoryBullet() {
    return '●';
}
