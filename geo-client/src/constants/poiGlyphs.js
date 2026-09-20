// Optical corrections for the most common POIs, on the shared 24px grid.
const refinedGlyphs = {
    'city-landmark': '<path d="M3 21h18M6 21V10h12v11M9 10V6h6v4M12 6V2M10 14h4M10 17h4"/>',
    'military-area': '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m12 7 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 10.5l3.5-.5Z"/>',
    plane: '<path d="M10 9V4a2 2 0 0 1 4 0v5l7 5v2l-7-2v4l2 2v1l-4-1-4 1v-1l2-2v-4l-7 2v-2Z"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M4 13v2a8 6 0 0 0 16 0v-2M4 13l3 2M20 13l-3 2"/>',
    ship: '<path d="M5 12V7h14v5M9 7V3h6v4M12 11l9 3-3 5M12 11l-9 3 3 5M12 11v7M3 21c2 0 3-2 4.5-2s2.5 2 4.5 2 3-2 4.5-2 2.5 2 4.5 2"/>',
    train: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 18l-3 3M15 18l3 3M9 21h6M9 6h6"/><path d="M8 14h.01M16 14h.01"/>',
    metro: '<path d="M3 21V11a9 9 0 0 1 18 0v10"/><rect x="7" y="8" width="10" height="10" rx="2"/><path d="M7 12h10M9 18l-1 3M15 18l1 3M10 15h.01M14 15h.01"/>',
    tram: '<rect x="5" y="6" width="14" height="13" rx="3"/><path d="m9 2 6 2-3 2M5 12h14M12 6v6M8 16h.01M16 16h.01M8 19l-2 3M16 19l2 3"/>',
    bus: '<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M3 7v4M21 7v4M8 19v2M16 19v2M8 15h1M15 15h1M9 6h6"/>',
    car: '<path d="m5 10 2-6h10l2 6M3 10h18v8H3ZM5 18v3M19 18v3M6 14h2M16 14h2"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    'gas-pump': '<rect x="3" y="3" width="11" height="17" rx="2"/><path d="M3 9h11M2 21h13M14 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-4-4M19 5v4h3"/>',
    'ev-charging': '<rect x="3" y="3" width="13" height="18" rx="3"/><path d="m10 7-3 5h5l-3 5M16 12h2a2 2 0 0 0 2-2V6M18 3v3h4V3"/>',
    utensils: '<path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-3 2-4 5-4 9h4"/>',
    coffee: '<path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 10h2a3 3 0 0 1 0 6h-2M7 3v3M11 3v3M3 21h16"/>',
    burger: '<path d="M4 10a8 7 0 0 1 16 0ZM3 14h18M4 18h16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 6h.01M15 6h.01"/>',
    hospital: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 9h6M12 6v6M10 21v-5h4v5"/>',
    pill: '<path d="m9 4-5 5a6 6 0 0 0 8 8l5-5a6 6 0 0 0-8-8ZM7 7l8 8"/>',
    tooth: '<path d="M12 5C7 1 3 4 5 10c1 3 1 10 4 11 2 0 1-7 3-7s1 7 3 7c3-1 3-8 4-11 2-6-2-9-7-5Z"/>',
    tree: '<path d="M12 3a4 4 0 0 0-4 4 5 5 0 0 0 0 10h8a5 5 0 0 0 0-10 4 4 0 0 0-4-4ZM12 13v8M9 21h6"/>',
    sports: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5a9 9 0 0 1 0 13M18.5 5.5a9 9 0 0 0 0 13"/>',
    hotel: '<path d="M3 5v16M21 12v9M3 17h18M3 12h18v5M11 12V7h6a4 4 0 0 1 4 4v1"/><circle cx="7" cy="9" r="2"/>',
    store: '<path d="M4 10v11h16V10M3 7l2-4h14l2 4M3 7v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V7ZM10 21v-6h4v6"/>',
    'shopping-bag': '<rect x="4" y="7" width="16" height="14" rx="3"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>',
    'art-center': '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3c0-4-5-7-9-7Z"/><path d="M7 10h.01M10 7h.01M15 7h.01M6 14h.01"/>',
    'map-pin': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
};

export function refinePoiGlyph(id, original) {
    const glyph = (refinedGlyphs[id] || original)
        .replace(/\s+stroke-width="[^"]*"/g, '')
        .replace(/fill="rgba\([^"]*\)"/g, 'fill="currentColor" fill-opacity="0.12"');
    return `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}
