// Türkiye Deniz Limanları ve Deniz Taşımacılığı Düğüm Noktaları Kaydı (Turkish Seaports Registry)

export const TURKISH_SEAPORTS = [
    // MARMARA DENİZİ & BOĞAZLAR
    {
        id: 'port_haydarpasa',
        name: 'Haydarpaşa Limanı (İstanbul)',
        shortName: 'Haydarpaşa',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Konteyner & Genel Kargo',
        coordinates: [29.0142, 40.9995],
        description: 'TCDD Haydarpaşa Konteyner ve Genel Kargo Limanı'
    },
    {
        id: 'port_ambarli',
        name: 'Ambarlı Limanı (İstanbul)',
        shortName: 'Ambarlı',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Ana Konteyner Limanı (Marport/Kumport/Mardaş)',
        coordinates: [28.6914, 40.9678],
        description: 'Marmara Bölgesi Ana Konteyner Hub Limanı'
    },
    {
        id: 'port_galataport',
        name: 'Galataport İstanbul Limanı',
        shortName: 'Galataport',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Uluslararası Kruvaziyer',
        coordinates: [28.9836, 41.0264],
        description: 'İstanbul Uluslararası Kruvaziyer Yolcu Limanı'
    },
    {
        id: 'port_yenikapi',
        name: 'Yenikapı Feribot Limanı',
        shortName: 'Yenikapı',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Hızlı Feribot & Deniz Otobüsü',
        coordinates: [28.9536, 41.0028],
        description: 'İDO Yenikapı Hızlı Feribot ve Deniz Otobüsü Terminali'
    },
    {
        id: 'port_pendik',
        name: 'Pendik Ro-Ro Limanı',
        shortName: 'Pendik',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Uluslararası Ro-Ro & Lojistik',
        coordinates: [29.2312, 40.8756],
        description: 'DFDS Pendik Uluslararası Ro-Ro ve Lojistik Terminali'
    },
    {
        id: 'port_tuzla',
        name: 'Tuzla Limanı & Tersaneler',
        shortName: 'Tuzla',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Tersane & Gemi Sanayi',
        coordinates: [29.2786, 40.8492],
        description: 'Tuzla Gemi İnşa, Bakım-Onarım ve Sanayi Limanı'
    },
    {
        id: 'port_zeytinburnu',
        name: 'Zeytinburnu Port Limanı',
        shortName: 'Zeytinburnu',
        city: 'İstanbul',
        region: 'Marmara',
        type: 'Yolcu & Ro-Ro',
        coordinates: [28.9056, 40.9856],
        description: 'Zeyport Ro-Ro ve Yolcu Giriş-Çıkış Limanı'
    },
    {
        id: 'port_derince',
        name: 'Safiport Derince Limanı (Kocaeli)',
        shortName: 'Safiport Derince',
        city: 'Kocaeli',
        region: 'Marmara',
        type: 'Çok Amaçlı Konteyner & Ro-Ro',
        coordinates: [29.8247, 40.7511],
        description: 'Kocaeli Derince Çok Amaçlı Konteyner ve Ro-Ro Limanı'
    },
    {
        id: 'port_dilovasi',
        name: 'Yılport Dilovası Limanı (Kocaeli)',
        shortName: 'Yılport Dilovası',
        city: 'Kocaeli',
        region: 'Marmara',
        type: 'Konteyner & Sıvı Kimyasal',
        coordinates: [29.5412, 40.7719],
        description: 'İzmit Körfezi Yılport Konteyner ve Sıvı Yük Terminali'
    },
    {
        id: 'port_autoport',
        name: 'Autoport Limanı (Kocaeli - Gölcük)',
        shortName: 'Autoport Gölcük',
        city: 'Kocaeli',
        region: 'Marmara',
        type: 'Otomotiv İhtisas',
        coordinates: [29.7892, 40.7186],
        description: 'Türkiye\'nin İlk Otomotiv İhtisas Limanı'
    },
    {
        id: 'port_evyapport',
        name: 'Evyapport Limanı (Kocaeli - Körfez)',
        shortName: 'Evyapport',
        city: 'Kocaeli',
        region: 'Marmara',
        type: 'Konteyner & Sıvı Yük',
        coordinates: [29.6914, 40.7622],
        description: 'Kocaeli Körfez Konteyner ve Sıvı Yük Limanı'
    },
    {
        id: 'port_bandirma',
        name: 'Bandırma Limanı (Balıkesir)',
        shortName: 'Bandırma',
        city: 'Balıkesir',
        region: 'Marmara',
        type: 'Dökme Yük & Konteyner',
        coordinates: [27.9739, 40.3567],
        description: 'Çelebi Bandırma Dökme Yük ve Konteyner Limanı'
    },
    {
        id: 'port_gemport',
        name: 'Gemport & Borusan Limanı (Bursa)',
        shortName: 'Gemport Gemlik',
        city: 'Bursa',
        region: 'Marmara',
        type: 'Konteyner, Araç & Genel Kargo',
        coordinates: [29.1367, 40.4289],
        description: 'Gemlik Körfezi Konteyner, Araç ve Genel Kargo Limanı'
    },
    {
        id: 'port_mudanya',
        name: 'Mudanya İDO/BUDO İskelesi (Bursa)',
        shortName: 'Mudanya',
        city: 'Bursa',
        region: 'Marmara',
        type: 'Feribot & Deniz Otobüsü',
        coordinates: [28.8789, 40.3756],
        description: 'Bursa Mudanya Hızlı Feribot ve Deniz Otobüsü İskelesi'
    },
    {
        id: 'port_asyaport',
        name: 'Asyaport Limanı (Tekirdağ)',
        shortName: 'Asyaport',
        city: 'Tekirdağ',
        region: 'Marmara',
        type: 'Transit Konteyner Hub',
        coordinates: [27.4642, 40.9089],
        description: 'Türkiye\'nin En Büyük Transit Konteyner Hub Limanı'
    },
    {
        id: 'port_ceyport',
        name: 'Ceyport Tekirdağ Limanı',
        shortName: 'Ceyport Tekirdağ',
        city: 'Tekirdağ',
        region: 'Marmara',
        type: 'Genel Kargo & Ro-Ro',
        coordinates: [27.5186, 40.9656],
        description: 'Tekirdağ Çok Amaçlı Genel Kargo ve Ro-Ro Limanı'
    },
    {
        id: 'port_kepez',
        name: 'Çanakkale Kepez Limanı',
        shortName: 'Kepez',
        city: 'Çanakkale',
        region: 'Marmara',
        type: 'Boğaz Ticaret & Kargo',
        coordinates: [26.3814, 40.1042],
        description: 'Çanakkale Boğazı Kepez Çok Amaçlı Ticaret Limanı'
    },
    {
        id: 'port_gelibolu',
        name: 'Gelibolu Feribot Limanı (Çanakkale)',
        shortName: 'Gelibolu',
        city: 'Çanakkale',
        region: 'Marmara',
        type: 'Boğaz Feribot Geçişi',
        coordinates: [26.6714, 40.4112],
        description: 'Çanakkale Boğaz Geçişi Gelibolu Feribot İskelesi'
    },
    {
        id: 'port_gokceada',
        name: 'Gökçeada Kuzu Limanı (Çanakkale)',
        shortName: 'Gökçeada Kuzu',
        city: 'Çanakkale',
        region: 'Marmara',
        type: 'Ada Feribot Ulaşımı',
        coordinates: [25.9756, 40.2289],
        description: 'Gökçeada Ana Feribot ve Deniz Ulaşım Limanı'
    },
    {
        id: 'port_bozcaada',
        name: 'Bozcaada Feribot Limanı (Çanakkale)',
        shortName: 'Bozcaada',
        city: 'Çanakkale',
        region: 'Marmara',
        type: 'Ada Feribot Ulaşımı',
        coordinates: [26.0694, 39.8336],
        description: 'Bozcaada Ana Yolcu ve Araç Feribot İskelesi'
    },

    // EGE DENİZİ LİMANLARI
    {
        id: 'port_alsancak',
        name: 'İzmir Alsancak Limanı',
        shortName: 'Alsancak',
        city: 'İzmir',
        region: 'Ege',
        type: 'Konteyner & Kruvaziyer',
        coordinates: [27.1478, 38.4417],
        description: 'TCDD İzmir Çok Amaçlı Konteyner ve Yolcu Limanı'
    },
    {
        id: 'port_nemport',
        name: 'Nemport Limanı (İzmir - Aliağa)',
        shortName: 'Nemport Aliağa',
        city: 'İzmir',
        region: 'Ege',
        type: 'Konteyner & Genel Kargo',
        coordinates: [26.9422, 38.7756],
        description: 'Ege Bölgesi Nemrut Körfezi Özel Konteyner Limanı'
    },
    {
        id: 'port_petlim',
        name: 'SOCAR Terminal / Petlim (İzmir)',
        shortName: 'SOCAR Petlim',
        city: 'İzmir',
        region: 'Ege',
        type: 'Derin Su Konteyner',
        coordinates: [26.9244, 38.7889],
        description: 'Aliağa Ege Bölgesi Derin Su Konteyner Limanı'
    },
    {
        id: 'port_tupras_aliaga',
        name: 'TÜPRAŞ Aliağa Petrol Terminali',
        shortName: 'TÜPRAŞ Aliağa',
        city: 'İzmir',
        region: 'Ege',
        type: 'Ham Petrol & Akaryakıt',
        coordinates: [26.9533, 38.8056],
        description: 'Aliağa Rafineri Ham Petrol ve Akaryakıt İskelesi'
    },
    {
        id: 'port_dikili',
        name: 'Dikili Limanı (İzmir)',
        shortName: 'Dikili',
        city: 'İzmir',
        region: 'Ege',
        type: 'Kruvaziyer & Genel Kargo',
        coordinates: [26.8833, 39.0711],
        description: 'Kuzey Ege Kruvaziyer ve Genel Kargo Limanı'
    },
    {
        id: 'port_cesme',
        name: 'Çeşme Ulusoy Limanı (İzmir)',
        shortName: 'Çeşme Ulusoy',
        city: 'İzmir',
        region: 'Ege',
        type: 'Uluslararası Ro-Ro & Yolcu',
        coordinates: [26.3014, 38.3267],
        description: 'Çeşme - İtalya/Yunanistan Ro-Ro ve Yolcu Limanı'
    },
    {
        id: 'port_kusadasi',
        name: 'Kuşadası Ege Port Limanı (Aydın)',
        shortName: 'Kuşadası',
        city: 'Aydın',
        region: 'Ege',
        type: 'Ana Kruvaziyer Port',
        coordinates: [27.2556, 37.8639],
        description: 'Türkiye\'nin En Yoğun Kruvaziyer Yolcu Limanı'
    },
    {
        id: 'port_gulluk',
        name: 'Güllük Limanı (Muğla - Milas)',
        shortName: 'Güllük Milas',
        city: 'Muğla',
        region: 'Ege',
        type: 'Maden & Dökme Yük İhracat',
        coordinates: [27.6042, 37.2489],
        description: 'Feldspat, Maden ve Genel Kargo İhracat Limanı'
    },
    {
        id: 'port_bodrum',
        name: 'Bodrum Kruvaziyer Limanı (Muğla)',
        shortName: 'Bodrum',
        city: 'Muğla',
        region: 'Ege',
        type: 'Kruvaziyer & Yolcu',
        coordinates: [27.4367, 37.0306],
        description: 'Bodrum Uluslararası Yolcu Gemisi ve Feribot Limanı'
    },
    {
        id: 'port_marmaris',
        name: 'Marmaris Cruise Port Limanı (Muğla)',
        shortName: 'Marmaris',
        city: 'Muğla',
        region: 'Ege',
        type: 'Kruvaziyer & Feribot',
        coordinates: [28.2778, 36.8489],
        description: 'Marmaris Uluslararası Kruvaziyer ve Feribot Limanı'
    },
    {
        id: 'port_fethiye',
        name: 'Fethiye Limanı (Muğla)',
        shortName: 'Fethiye',
        city: 'Muğla',
        region: 'Ege',
        type: 'Yolcu, Yat & Kargo',
        coordinates: [29.1083, 36.6267],
        description: 'Fethiye Körfezi Yolcu, Yat ve Kıyı Emniyeti Limanı'
    },
    {
        id: 'port_ayvalik',
        name: 'Ayvalık Limanı (Balıkesir)',
        shortName: 'Ayvalık',
        city: 'Balıkesir',
        region: 'Ege',
        type: 'Uluslararası Feribot',
        coordinates: [26.6889, 39.3167],
        description: 'Ayvalık - Midilli Uluslararası Yolcu ve Feribot İskelesi'
    },

    // AKDENİZ LİMANLARI
    {
        id: 'port_mersin',
        name: 'Mersin Uluslararası Limanı (MIP)',
        shortName: 'Mersin MIP',
        city: 'Mersin',
        region: 'Akdeniz',
        type: 'Ana Konteyner & Ticaret Hub',
        coordinates: [34.6467, 36.7967],
        description: 'Doğu Akdeniz\'in En Büyük Ana Konteyner ve Ticaret Limanı'
    },
    {
        id: 'port_iskenderun',
        name: 'İskenderun LimakPort (Hatay)',
        shortName: 'İskenderun Limak',
        city: 'Hatay',
        region: 'Akdeniz',
        type: 'Konteyner & Dökme Yük',
        coordinates: [36.1844, 36.5956],
        description: 'Doğu Akdeniz Çok Amaçlı Konteyner ve Dökme Yük Limanı'
    },
    {
        id: 'port_isdemir',
        name: 'İsdemir Limanı (Hatay - İskenderun)',
        shortName: 'İsdemir',
        city: 'Hatay',
        region: 'Akdeniz',
        type: 'Ağır Sanayi & Dökme Yük',
        coordinates: [36.1956, 36.7214],
        description: 'İskenderun Demir Çelik Fabrikaları Ağır Sanayi Limanı'
    },
    {
        id: 'port_ceyhan_botas',
        name: 'BOTAŞ Ceyhan Petrol Terminali (Adana)',
        shortName: 'BOTAŞ Ceyhan',
        city: 'Adana',
        region: 'Akdeniz',
        type: 'Uluslararası Ham Petrol Terminali',
        coordinates: [35.9189, 36.8844],
        description: 'Bakü-Tiflis-Ceyhan ve Kerkük-Yumurtalık Ham Petrol Terminali'
    },
    {
        id: 'port_ceyhan_toros',
        name: 'Toros Ceyhan Kimya & Gübre Limanı (Adana)',
        shortName: 'Toros Ceyhan',
        city: 'Adana',
        region: 'Akdeniz',
        type: 'Kimyasal & Gübre Terminali',
        coordinates: [35.8956, 36.8522],
        description: 'Ceyhan Sıvı Kimyasal, Gübre ve Dökme Yük Limanı'
    },
    {
        id: 'port_antalya',
        name: 'Port Akdeniz Antalya Limanı (QTerminals)',
        shortName: 'Port Akdeniz Antalya',
        city: 'Antalya',
        region: 'Akdeniz',
        type: 'Konteyner, Genel Kargo & Kruvaziyer',
        coordinates: [30.6083, 36.8361],
        description: 'Batı Akdeniz Konteyner, Genel Kargo ve Kruvaziyer Limanı'
    },
    {
        id: 'port_alanya',
        name: 'Alanya Kruvaziyer Limanı (Antalya)',
        shortName: 'Alanya',
        city: 'Antalya',
        region: 'Akdeniz',
        type: 'Kruvaziyer & Yolcu',
        coordinates: [31.9986, 36.5367],
        description: 'Alanya Uluslararası Yolcu ve Gezi Gemisi Limanı'
    },
    {
        id: 'port_kas',
        name: 'Kaş Yat ve Feribot Limanı (Antalya)',
        shortName: 'Kaş',
        city: 'Antalya',
        region: 'Akdeniz',
        type: 'Uluslararası Yolcu & Feribot',
        coordinates: [29.6389, 36.1989],
        description: 'Kaş - Meis Uluslararası Geçiş ve Yolcu Limanı'
    },
    {
        id: 'port_tasucu',
        name: 'Taşucu Limanı (Mersin - Silifke)',
        shortName: 'Taşucu',
        city: 'Mersin',
        region: 'Akdeniz',
        type: 'Ro-Ro & Hızlı Feribot',
        coordinates: [33.8814, 36.3156],
        description: 'Taşucu - KKTC Girne Ro-Ro ve Hızlı Feribot Limanı'
    },
    {
        id: 'port_anamur',
        name: 'Anamur Feribot İskelesi (Mersin)',
        shortName: 'Anamur',
        city: 'Mersin',
        region: 'Akdeniz',
        type: 'Feribot & Deniz Ulaşımı',
        coordinates: [32.8417, 36.0711],
        description: 'Anamur - KKTC Deniz Ulaşım İskelesi'
    },
    {
        id: 'port_girne',
        name: 'Girne Limanı (KKTC)',
        shortName: 'Girne',
        city: 'Girne',
        region: 'Akdeniz',
        type: 'Ro-Ro, Feribot & Yolcu Limanı',
        coordinates: [33.3236, 35.3425],
        description: 'KKTC Girne - Türkiye (Taşucu/Mersin/Alanya) Feribot ve Ro-Ro Limanı'
    },
    {
        id: 'port_magusa',
        name: 'Gazimağusa Limanı (KKTC)',
        shortName: 'Gazimağusa',
        city: 'Gazimağusa',
        region: 'Akdeniz',
        type: 'Derin Su Konteyner & Ticaret Limanı',
        coordinates: [33.9489, 35.1286],
        description: 'KKTC Gazimağusa - Türkiye (Mersin/İskenderun) Ana Ticaret ve Konteyner Limanı'
    },

    // KARADENİZ LİMANLARI
    {
        id: 'port_trabzon',
        name: 'Trabzon Limanı',
        shortName: 'Trabzon',
        city: 'Trabzon',
        region: 'Karadeniz',
        type: 'Uluslararası Transit & Kargo',
        coordinates: [39.7389, 41.0044],
        description: 'Doğu Karadeniz Uluslararası Transit Ticaret Limanı (Albayrak)'
    },
    {
        id: 'port_samsun',
        name: 'Samsunport Sanayi Limanı',
        shortName: 'Samsunport',
        city: 'Samsun',
        region: 'Karadeniz',
        type: 'Demiryolu Bağlantılı Konteyner & Sanayi',
        coordinates: [36.3533, 41.2956],
        description: 'Karadeniz\'in En Büyük Demiryolu Bağlantılı Konteyner Limanı'
    },
    {
        id: 'port_filyos',
        name: 'Filyos Limanı (Zonguldak)',
        shortName: 'Filyos',
        city: 'Zonguldak',
        region: 'Karadeniz',
        type: 'Mega Lojistik & Enerji Üssü',
        coordinates: [32.0233, 41.5714],
        description: 'Karadeniz Doğalgaz ve Lojistik Ana Üssü Mega Limanı'
    },
    {
        id: 'port_zonguldak_ttk',
        name: 'Zonguldak TTK Limanı',
        shortName: 'Zonguldak TTK',
        city: 'Zonguldak',
        region: 'Karadeniz',
        type: 'Kömür, Kargo & Sanayi',
        coordinates: [31.7867, 41.4556],
        description: 'Türkiye Taşkömürü Kurumu Kargo ve Sanayi Limanı'
    },
    {
        id: 'port_eregli',
        name: 'Ereğli Erdemir Limanı (Zonguldak)',
        shortName: 'Erdemir Ereğli',
        city: 'Zonguldak',
        region: 'Karadeniz',
        type: 'Ağır Sanayi & Demir-Çelik',
        coordinates: [31.4117, 41.2756],
        description: 'Ereğli Demir Çelik Ağır Sanayi ve Kargo Limanı'
    },
    {
        id: 'port_bartin',
        name: 'Bartın Limanı',
        shortName: 'Bartın',
        city: 'Bartın',
        region: 'Karadeniz',
        type: 'Genel Kargo & İhracat',
        coordinates: [32.2289, 41.6889],
        description: 'Batı Karadeniz Genel Kargo ve İhracat Limanı'
    },
    {
        id: 'port_sinop',
        name: 'Sinop Limanı',
        shortName: 'Sinop',
        city: 'Sinop',
        region: 'Karadeniz',
        type: 'Doğal Liman & Balıkçılık & Yolcu',
        coordinates: [35.1589, 42.0256],
        description: 'Orta Karadeniz Doğal Koyu, Balıkçılık ve Yolcu Limanı'
    },
    {
        id: 'port_giresun',
        name: 'Giresun Limanı',
        shortName: 'Giresun',
        city: 'Giresun',
        region: 'Karadeniz',
        type: 'Tarım & Maden İhracat',
        coordinates: [38.3917, 40.9194],
        description: 'Fındık, Tarım ve Maden İhracat Limanı'
    },
    {
        id: 'port_unye',
        name: 'Ünye Limanı (Ordu)',
        shortName: 'Ünye',
        city: 'Ordu',
        region: 'Karadeniz',
        type: 'Kruvaziyer & Konteyner',
        coordinates: [37.2889, 41.1311],
        description: 'Ordu Ünye Kruvaziyer ve Konteyner Ticaret Limanı'
    },
    {
        id: 'port_rize',
        name: 'Rize Riport Limanı',
        shortName: 'Rize Riport',
        city: 'Rize',
        region: 'Karadeniz',
        type: 'Konteyner & Genel Kargo',
        coordinates: [40.5289, 41.0367],
        description: 'Doğu Karadeniz Konteyner ve Genel Kargo Limanı'
    },
    {
        id: 'port_hopa',
        name: 'Hopa Limanı (Artvin)',
        shortName: 'Hopa',
        city: 'Artvin',
        region: 'Karadeniz',
        type: 'Transit Sınır Ticaret Limanı',
        coordinates: [41.4289, 41.4089],
        description: 'Kafkasya ve Orta Asya Transit Ticaret Sınır Limanı'
    },
    {
        id: 'port_inebolu',
        name: 'İnebolu Limanı (Kastamonu)',
        shortName: 'İnebolu',
        city: 'Kastamonu',
        region: 'Karadeniz',
        type: 'Maden & Kargo',
        coordinates: [33.7714, 41.9789],
        description: 'Kastamonu İnebolu Maden ve Kargo Limanı'
    },
    {
        id: 'port_karasu',
        name: 'Karasu Limanı (Sakarya)',
        shortName: 'Karasu',
        city: 'Sakarya',
        region: 'Karadeniz',
        type: 'Uluslararası Ro-Ro & Kargo',
        coordinates: [30.6978, 41.1189],
        description: 'Sakarya Karasu - Rusya/Romanya Ro-Ro ve Kargo Limanı'
    }
];

// İki Liman Arası Deniz Koridoru WKT LineString Üretici
export function generateMaritimeRouteWkt(portA, portB) {
    if (!portA || !portB || !portA.coordinates || !portB.coordinates) return null;
    const [lon1, lat1] = portA.coordinates;
    const [lon2, lat2] = portB.coordinates;

    // Doğrudan iki liman arası deniz koordinat çizgisi
    return `LINESTRING(${lon1} ${lat1}, ${lon2} ${lat2})`;
}

// Liman Adından 'Limanı', 'Port', 'İskelesi' vb. kelimeleri temizleyip sade adı döndürür
export function cleanPortName(name) {
    if (!name) return '';
    let cleaned = name
        .replace(/\(.*?\)/g, '')  // Parantez içi şehir/bölge eklerini temizle
        .replace(/Deniz Hattı/gi, '')
        .replace(/Hızlı Feribot/gi, '')
        .replace(/Feribot/gi, '')
        .replace(/Uluslararası/gi, '')
        .replace(/Terminali/gi, '')
        .replace(/Terminal/gi, '')
        .replace(/İskelesi/gi, '')
        .replace(/İskele/gi, '')
        .replace(/Limanı/gi, '')
        .replace(/Limani/gi, '')
        .replace(/Liman/gi, '')
        .replace(/Hattı/gi, '')
        .replace(/Port/gi, '')
        .replace(/\s*-\s*/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned || name.trim();
}

// Liman için İlişkili Deniz Yetki Alanı (Zone ID, Deniz ve Bölge) Çözümleyici
export function resolveMaritimeZoneForPort(port) {
    if (!port) return { id: 'MAR-GEN-01', name: 'Türkiye Karasuları', sea: 'Genel', region: 'Türkiye' };
    const region = (port.region || '').toLowerCase();
    const city = (port.city || '').toLowerCase();
    const name = (port.name || '').toLowerCase();

    if (city.includes('kıbrıs') || name.includes('girne') || name.includes('mağusa') || name.includes('gazimağusa')) {
        return { id: 'MAR-CYP-01', name: 'KKTC Karasuları & Liman Bölgesi', sea: 'Akdeniz', region: 'Kuzey Kıbrıs' };
    }
    if (region.includes('marmara') || ['istanbul', 'kocaeli', 'bursa', 'balıkesir', 'yalova', 'tekirdağ', 'çanakkale'].includes(city)) {
        return { id: 'MAR-MAR-01', name: 'Marmara Denizi & Boğazlar Yetki Alanı', sea: 'Marmara Denizi', region: 'Marmara Bölgesi' };
    }
    if (region.includes('ege') || ['izmir', 'aydın', 'muğla', 'manisa'].includes(city)) {
        return { id: 'MAR-AEG-01', name: 'Ege Denizi Kıyı Yetki Alanı', sea: 'Ege Denizi', region: 'Ege Bölgesi' };
    }
    if (region.includes('karadeniz') || ['trabzon', 'samsun', 'zonguldak', 'rize', 'ordu', 'giresun', 'sinop', 'artvin', 'bartın', 'kastamonu', 'düzce', 'kırklareli'].includes(city)) {
        return { id: 'MAR-BLK-01', name: 'Karadeniz Kıyı Yetki Alanı', sea: 'Karadeniz', region: 'Karadeniz Bölgesi' };
    }
    return { id: 'MAR-MED-01', name: 'Akdeniz Kıyı Yetki Alanı', sea: 'Akdeniz', region: 'Akdeniz Bölgesi' };
}

// Liman Kimliği veya Adına Göre Tam Liman Bilgisi Döndürücü
export function getSeaportInfo(portIdOrName) {
    if (!portIdOrName) return null;
    const query = String(portIdOrName).toLowerCase().trim();
    const port = TURKISH_SEAPORTS.find(p => 
        p.id.toLowerCase() === query || 
        p.name.toLowerCase() === query || 
        p.shortName.toLowerCase() === query ||
        p.name.toLowerCase().includes(query)
    );
    if (!port) return null;

    const zone = resolveMaritimeZoneForPort(port);
    return {
        ...port,
        maritimeZoneId: zone.id,
        maritimeZoneName: zone.name,
        sea: zone.sea,
        fullRegion: zone.region,
        address: port.address || `${port.name}, ${port.city} Liman Sahası`
    };
}


