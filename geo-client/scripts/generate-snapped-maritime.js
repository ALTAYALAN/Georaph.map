const fs = require('fs');
const path = require('path');

const citiesPath = path.join(__dirname, '..', 'public', 'data', 'turkey-cities.json');
const outputPath = path.join(__dirname, '..', 'public', 'data', 'turkey-coastal-maritime.json');

const citiesGeo = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));

// Helper to extract all coordinate rings from Polygon or MultiPolygon
function getRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') {
        return [geometry.coordinates[0]];
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.map(poly => poly[0]);
    }
    return [];
}

// Find all vertices of specified provinces that match a coastal boundary filter condition
function getCoastlineVertices(provinceNames, filterFn, sortFn) {
    const coords = [];
    provinceNames.forEach(provName => {
        const feat = citiesGeo.features.find(f => f.properties.name.toLowerCase() === provName.toLowerCase());
        if (!feat) return;
        const rings = getRings(feat.geometry);
        rings.forEach(ring => {
            ring.forEach(pt => {
                if (filterFn(pt[0], pt[1])) {
                    coords.push([Number(pt[0].toFixed(6)), Number(pt[1].toFixed(6))]);
                }
            });
        });
    });

    if (sortFn) {
        coords.sort(sortFn);
    }
    
    // Deduplicate consecutive similar coordinates
    const unique = [];
    coords.forEach(pt => {
        if (unique.length === 0) {
            unique.push(pt);
        } else {
            const last = unique[unique.length - 1];
            const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
            if (dist > 0.005) {
                unique.push(pt);
            }
        }
    });

    return unique;
}

// Define the 12 realistic maritime zones with exact snapped shared vertices and offshore boundary caps
const zonesConfig = [
    {
        id: "MAR-BLK-01",
        plate: 901,
        name: "Batı Karadeniz Deniz Yetki Alanı",
        sea: "Karadeniz",
        region: "Karadeniz",
        coastalProvinces: ["Kırklareli", "İstanbul", "Kocaeli", "Sakarya", "Düzce", "Zonguldak", "Bartın", "Kastamonu"],
        areaKm2: 38450,
        coastlineKm: 620,
        majorPorts: ["Filyos Limanı", "Zonguldak Limanı", "Bartın Limanı", "İnebolu Limanı", "Karasu Limanı"],
        description: "İğneada sınırından Kastamonu Cide açıklarına kadar uzanan, Filyos ve Zonguldak sanayi limanlarını kapsayan batı karasuları yetki alanı.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 27.8 && lng <= 34.0 && lat >= 41.1,
        coastSort: (a, b) => a[0] - b[0], // West to East
        offshoreCoords: [
            [34.0, 42.8],
            [31.0, 43.0],
            [27.9, 42.5]
        ]
    },
    {
        id: "MAR-BLK-02",
        plate: 902,
        name: "Orta Karadeniz Deniz Yetki Alanı",
        sea: "Karadeniz",
        region: "Karadeniz",
        coastalProvinces: ["Sinop", "Samsun", "Ordu"],
        areaKm2: 42100,
        coastlineKm: 480,
        majorPorts: ["Samsun Limanı", "Sinop İskelesi", "Ünye Port", "Fatsa İskelesi"],
        description: "İnceburun Sinop kuzey çıkıntısı ile Samsun ve Ordu kıyı havzasını içeren stratejik deniz yetki alanı.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 34.0 && lng <= 38.0 && lat >= 40.8,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [38.0, 43.2],
            [35.0, 43.4],
            [34.0, 42.8]
        ]
    },
    {
        id: "MAR-BLK-03",
        plate: 903,
        name: "Doğu Karadeniz Deniz Yetki Alanı",
        sea: "Karadeniz",
        region: "Karadeniz",
        coastalProvinces: ["Giresun", "Trabzon", "Rize", "Artvin"],
        areaKm2: 31800,
        coastlineKm: 390,
        majorPorts: ["Trabzon Uluslararası Limanı", "Rize Port", "Giresun Limanı", "Hopa Limanı"],
        description: "Giresun'dan Sarp Sınır Kapısına kadar uzanan Kafkasya deniz transit koridoru.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 38.0 && lng <= 41.7 && lat >= 40.8,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [41.6, 42.6],
            [39.5, 43.0],
            [38.0, 43.2]
        ]
    },
    {
        id: "MAR-BOS-01",
        plate: 904,
        name: "İstanbul Boğazı & Karadeniz Koridoru",
        sea: "Boğazlar",
        region: "Marmara",
        coastalProvinces: ["İstanbul"],
        areaKm2: 1450,
        coastlineKm: 140,
        majorPorts: ["Harem İskelesi", "Salıpazarı Port", "Karaköy Yolcu Limanı", "Haydarpaşa"],
        description: "Montrö Boğazlar Sözleşmesi rejimine tabi uluslararası deniz trafiği geçiş koridoru.",
        color: "#0369a1",
        fillColor: "rgba(3, 105, 161, 0.22)",
        strokeColor: "#0369a1",
        coastFilter: (lng, lat) => lng >= 28.95 && lng <= 29.20 && lat >= 41.00 && lat <= 41.30,
        coastSort: (a, b) => a[1] - b[1],
        offshoreCoords: [
            [29.25, 41.35],
            [28.90, 41.35]
        ]
    },
    {
        id: "MAR-MRM-01",
        plate: 905,
        name: "Marmara Denizi İç Suları & Adalar",
        sea: "Marmara",
        region: "Marmara",
        coastalProvinces: ["İstanbul", "Tekirdağ", "Balıkesir", "Çanakkale", "Bursa", "Yalova", "Kocaeli"],
        areaKm2: 11350,
        coastlineKm: 780,
        majorPorts: ["Ambarlı Konteyner Limanı", "Bandırma Limanı", "Derince Limanı", "Gemlik Port", "Tekirdağ Ceyport"],
        description: "Türkiye'nin ulusal iç suları statüsündeki havzası ve adalar yetki alanı.",
        color: "#0ea5e9",
        fillColor: "rgba(14, 165, 233, 0.18)",
        strokeColor: "#0ea5e9",
        coastFilter: (lng, lat) => lng >= 27.2 && lng <= 29.9 && lat >= 40.35 && lat <= 41.05,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [29.9, 40.75],
            [29.0, 40.90],
            [27.4, 40.95],
            [27.0, 40.5]
        ]
    },
    {
        id: "MAR-DAR-01",
        plate: 906,
        name: "Çanakkale Boğazı & Saros Körfezi",
        sea: "Boğazlar",
        region: "Marmara",
        coastalProvinces: ["Çanakkale", "Edirne"],
        areaKm2: 3900,
        coastlineKm: 260,
        majorPorts: ["Kepez Limanı", "Gelibolu İskelesi", "Eceabat İskelesi", "Gökçeada Kuzu Limanı"],
        description: "Saros Körfezi kendi kendini temizleyen akıntı sistemi ve Çanakkale deniz geçiş hattı.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.18)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 26.0 && lng <= 27.1 && lat >= 40.0 && lat <= 40.7,
        coastSort: (a, b) => a[1] - b[1],
        offshoreCoords: [
            [26.0, 40.8],
            [25.8, 40.1]
        ]
    },
    {
        id: "MAR-EGE-01",
        plate: 907,
        name: "Kuzey Ege & Edremit Körfezi",
        sea: "Ege Denizi",
        region: "Ege",
        coastalProvinces: ["Çanakkale", "Balıkesir", "İzmir"],
        areaKm2: 18200,
        coastlineKm: 420,
        majorPorts: ["Ayvalık Limanı", "Dikili Port", "Aliağa Rafineri Limanı", "Bozcaada İskelesi"],
        description: "Edremit ve Çandarlı Körfezlerini kapsayan Kuzey Ege karasuları yetki sahası.",
        color: "#06b6d4",
        fillColor: "rgba(6, 182, 212, 0.16)",
        strokeColor: "#06b6d4",
        coastFilter: (lng, lat) => lng >= 26.0 && lng <= 27.2 && lat >= 38.8 && lat <= 39.9,
        coastSort: (a, b) => b[1] - a[1], // North to South
        offshoreCoords: [
            [25.3, 38.8],
            [25.3, 39.9]
        ]
    },
    {
        id: "MAR-EGE-02",
        plate: 908,
        name: "Orta Ege & İzmir Körfezi Yetki Alanı",
        sea: "Ege Denizi",
        region: "Ege",
        coastalProvinces: ["İzmir", "Aydın"],
        areaKm2: 19600,
        coastlineKm: 510,
        majorPorts: ["İzmir Alsancak Limanı", "Çeşme Uluslararası Limanı", "Kuşadası Yolcu Port", "Didim Marina"],
        description: "İzmir Körfezi ve Kuşadası sahasını kapsayan yoğun turizm ve ticaret deniz alanı.",
        color: "#06b6d4",
        fillColor: "rgba(6, 182, 212, 0.16)",
        strokeColor: "#06b6d4",
        coastFilter: (lng, lat) => lng >= 26.3 && lng <= 27.4 && lat >= 37.3 && lat <= 38.8,
        coastSort: (a, b) => b[1] - a[1],
        offshoreCoords: [
            [25.6, 37.3],
            [25.5, 38.8]
        ]
    },
    {
        id: "MAR-EGE-03",
        plate: 909,
        name: "Güney Ege & Gökova - Datça Kıyı Şeridi",
        sea: "Ege Denizi",
        region: "Ege",
        coastalProvinces: ["Muğla"],
        areaKm2: 22400,
        coastlineKm: 850,
        majorPorts: ["Bodrum Cruise Port", "Marmaris Port", "Fethiye İskelesi", "Güllük Limanı"],
        description: "Gökova ve Datça yarımadası kıyı şeridini içeren zengin koy ve deniz koruma sahası.",
        color: "#06b6d4",
        fillColor: "rgba(6, 182, 212, 0.16)",
        strokeColor: "#06b6d4",
        coastFilter: (lng, lat) => lng >= 27.1 && lng <= 29.2 && lat >= 36.5 && lat <= 37.4,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [29.2, 35.8],
            [26.8, 35.8],
            [26.8, 37.0]
        ]
    },
    {
        id: "MAR-MED-01",
        plate: 910,
        name: "Batı Akdeniz & Antalya Körfezi",
        sea: "Akdeniz",
        region: "Akdeniz",
        coastalProvinces: ["Antalya"],
        areaKm2: 45300,
        coastlineKm: 640,
        majorPorts: ["Port Akdeniz (Antalya)", "Alanya Port", "Finike Marina", "Kaş İskelesi"],
        description: "Kaş Kalkan hattından Antalya Körfezi ve Alanya'ya uzanan kıta sahanlığı alanı.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 29.3 && lng <= 32.4 && lat >= 36.0 && lat <= 37.0,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [32.4, 34.8],
            [29.3, 34.8]
        ]
    },
    {
        id: "MAR-MED-02",
        plate: 911,
        name: "Orta Akdeniz & Mersin Deniz Sahası",
        sea: "Akdeniz",
        region: "Akdeniz",
        coastalProvinces: ["Mersin", "Adana"],
        areaKm2: 39500,
        coastlineKm: 460,
        majorPorts: ["Mersin Uluslararası Limanı (MIP)", "Taşucu Port", "BOTAŞ Ceyhan Petrol Terminali", "Yumurtalık"],
        description: "Mersin MIP ve Adana Ceyhan enerji koridorunu içeren stratejik deniz sahası.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 32.4 && lng <= 35.8 && lat >= 35.9 && lat <= 36.9,
        coastSort: (a, b) => a[0] - b[0],
        offshoreCoords: [
            [35.8, 34.6],
            [32.4, 34.6]
        ]
    },
    {
        id: "MAR-MED-03",
        plate: 912,
        name: "Doğu Akdeniz & İskenderun Körfezi MEB",
        sea: "Akdeniz",
        region: "Akdeniz",
        coastalProvinces: ["Hatay"],
        areaKm2: 28700,
        coastlineKm: 290,
        majorPorts: ["İskenderun Limanı (LimakPort)", "İsdemir Limanı", "Arsuz İskelesi", "Samandağ"],
        description: "İskenderun Körfezi ağır sanayi limanları ve Doğu Akdeniz Münhasır Ekonomik Bölge sahası.",
        color: "#0284c7",
        fillColor: "rgba(2, 132, 199, 0.16)",
        strokeColor: "#0284c7",
        coastFilter: (lng, lat) => lng >= 35.7 && lng <= 36.2 && lat >= 35.8 && lat <= 36.9,
        coastSort: (a, b) => b[1] - a[1],
        offshoreCoords: [
            [35.0, 34.5],
            [35.0, 36.5]
        ]
    }
];

const features = zonesConfig.map(zone => {
    const coastalPts = getCoastlineVertices(zone.coastalProvinces, zone.coastFilter, zone.coastSort);
    
    // Combine exact coastal province coordinates with offshore boundary coordinates to form a closed polygon
    const fullPolygon = [...coastalPts, ...zone.offshoreCoords, coastalPts[0]];

    return {
        type: "Feature",
        properties: {
            id: zone.id,
            plate: zone.plate,
            name: zone.name,
            sea: zone.sea,
            region: zone.region,
            coastalProvinces: zone.coastalProvinces,
            areaKm2: zone.areaKm2,
            coastlineKm: zone.coastlineKm,
            majorPorts: zone.majorPorts,
            description: zone.description,
            color: zone.color,
            fillColor: zone.fillColor,
            strokeColor: zone.strokeColor,
            isMaritime: true
        },
        geometry: {
            type: "Polygon",
            coordinates: [fullPolygon]
        }
    };
});

const outputGeo = {
    type: "FeatureCollection",
    name: "turkey_coastal_maritime_jurisdiction_zones",
    crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
    },
    features: features
};

fs.writeFileSync(outputPath, JSON.stringify(outputGeo, null, 2), 'utf8');
console.log('Successfully generated snapped turkey-coastal-maritime.json with', features.length, 'zones.');
