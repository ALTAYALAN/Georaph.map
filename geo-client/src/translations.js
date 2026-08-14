export const translations = {
    tr: {
        // Oturum ve Giriş
        loginTitle: "Sisteme Giriş Yapın",
        loginSubtitle: "Coğrafi Harita Yönetim Paneli",
        usernameLabel: "Kullanıcı Adı",
        passwordLabel: "Şifre",
        usernamePlaceholder: "Kullanıcı adınızı girin",
        passwordPlaceholder: "Şifrenizi girin",
        loginButton: "Sisteme Giriş Yap",
        loggingIn: "Giriş Yapılıyor...",
        loginSuccess: "Giriş başarılı! Oturum başlatıldı.",
        loginFailed: "Giriş başarısız: ",

        // Üst Bar ve Sidebar
        appTitle: "GeoMap Harita Paneli",
        sessionTime: "Oturum Süresi:",
        logout: "Çıkış Yap",
        lightMode: "Aydınlık Mod",
        darkMode: "Karanlık Mod",
        openSidebar: "Yan Menüyü Aç",
        closeSidebar: "Menüyü Kapat",
        languageSelect: "Dil Seçimi",

        // Nokta Mekan Kaydı Formu
        addPlaceTitle: "Nokta Mekan Kaydı",
        addPlaceSubtitle: "Haritada bir noktaya tıklayarak enlem/boylam seçebilirsiniz.",
        placeNameLabel: "Mekan Adı",
        placeNamePlaceholder: "Örn: Anıtkabir, Kızılay",
        longitudeLabel: "Boylam (Longitude)",
        longitudePlaceholder: "Örn: 33.2433",
        latitudeLabel: "Enlem (Latitude)",
        latitudePlaceholder: "Örn: 38.9637",
        colorPaletteLabel: "Nokta Renk Paleti",
        saveLocationBtn: "Konumu Kaydet",
        locationSavedMsg: "Nokta veritabanına (tbl_point) başarıyla kaydedildi!",
        saveFailedMsg: "Kayıt başarısız oldu.",

        // Kayıtlı Konumlar ve Çizimler Listesi
        savedPlacesTitle: "Kayıtlı Konumlar & Çizimler",
        recordsBadge: "Kayıt",
        noRecordsMsg: "Henüz kayıtlı konum veya çizim bulunmuyor.",
        pointTypeLabel: "Nokta Çizimi",
        lineTypeLabel: "Çizgi Çizimi",
        polygonTypeLabel: "Poligon Çizimi",
        deleteConfirmTitle: "Silme Onayı",
        deleteConfirmMsg: "isimli çizimi/konumu silmek istediğinize emin misiniz?",
        btnDelete: "Sil",
        btnCancel: "İptal",
        itemDeletedMsg: "başarıyla silindi.",

        // Harita Çizim Araçları (Toolbar)
        toolPointTitle: "Nokta Çizimi (tbl_point)",
        toolLineTitle: "Çizgi Çizimi (tbl_line)",
        toolPolygonTitle: "Poligon Çizimi (tbl_polygon)",
        toolAnalysisTitle: "Geçici Envanter Analizi Aracı (Kesişim Hesabı)",

        // Yüzer Çizim Menüsü (Floating Draw Bottom Bar)
        drawingPointMode: "Nokta Çizimi",
        drawingLineMode: "Çizgi Çizimi",
        drawingPolygonMode: "Poligon Çizimi",
        drawingCompleted: "✓ Çizim Tamamlandı",
        drawingInProgress: "Haritada çizin",
        drawingNamePlaceholder: "Çizim Adı...",
        btnSaveToDb: "Kaydet",
        btnCancelDraw: "İptal",
        drawingSavedSuccess: "veritabanına başarıyla kaydedildi!",

        // Kesişme Kontrolü Barı ve Sonuç Raporu
        intersectionCheckBadge: "Kesişme Kontrolü",
        intersectionCheckAnalyzing: "Hesaplanıyor...",
        intersectionCheckHint: "Haritada kesişme kontrolü için poligon çizin.",
        analysisReportTitle: "Envanter Kesişim Analiz Raporu",
        totalIntersectedLabel: "Kesişen Toplam Envanter",
        pointLayerLabel: "Nokta Katmanı",
        lineLayerLabel: "Çizgi Katmanı",
        polygonLayerLabel: "Poligon Katmanı",
        intersectedDetailsHeader: "Kesişen Nesne Detayları:",
        clearAnalysisBtn: "Analizi Temizle"
    },
    en: {
        // Auth & Login
        loginTitle: "System Login",
        loginSubtitle: "Geographic Map Management Panel",
        usernameLabel: "Username",
        passwordLabel: "Password",
        usernamePlaceholder: "Enter your username",
        passwordPlaceholder: "Enter your password",
        loginButton: "Sign In",
        loggingIn: "Signing In...",
        loginSuccess: "Login successful! Session started.",
        loginFailed: "Login failed: ",

        // Header & Sidebar
        appTitle: "GeoMap GIS Panel",
        sessionTime: "Session Time:",
        logout: "Log Out",
        lightMode: "Light Mode",
        darkMode: "Dark Mode",
        openSidebar: "Open Sidebar",
        closeSidebar: "Close Sidebar",
        languageSelect: "Language",

        // Point Form
        addPlaceTitle: "Point Location Record",
        addPlaceSubtitle: "Click on the map or enter lat/lon coordinates.",
        placeNameLabel: "Location Name",
        placeNamePlaceholder: "e.g. Central Park, Downtown",
        longitudeLabel: "Longitude",
        longitudePlaceholder: "e.g. 33.2433",
        latitudeLabel: "Latitude",
        latitudePlaceholder: "e.g. 38.9637",
        colorPaletteLabel: "Point Color Palette",
        saveLocationBtn: "Save Location",
        locationSavedMsg: "Point successfully saved to database (tbl_point)!",
        saveFailedMsg: "Save failed.",

        // Saved List
        savedPlacesTitle: "Saved Places & Drawings",
        recordsBadge: "Records",
        noRecordsMsg: "No saved places or drawings found.",
        pointTypeLabel: "Point Feature",
        lineTypeLabel: "Line Feature",
        polygonTypeLabel: "Polygon Feature",
        deleteConfirmTitle: "Delete Confirmation",
        deleteConfirmMsg: "Are you sure you want to delete",
        btnDelete: "Delete",
        btnCancel: "Cancel",
        itemDeletedMsg: "successfully deleted.",

        // Map Drawing Toolbar
        toolPointTitle: "Point Draw Tool (tbl_point)",
        toolLineTitle: "Line Draw Tool (tbl_line)",
        toolPolygonTitle: "Polygon Draw Tool (tbl_polygon)",
        toolAnalysisTitle: "Temporary Inventory Analysis Tool (Intersection)",

        // Floating Draw Bottom Bar
        drawingPointMode: "Point Drawing Mode",
        drawingLineMode: "Line Drawing Mode",
        drawingPolygonMode: "Polygon Drawing Mode",
        drawingCompleted: "✓ Drawing Completed",
        drawingInProgress: "Draw on the map",
        drawingNamePlaceholder: "Feature Name...",
        btnSaveToDb: "Save",
        btnCancelDraw: "Cancel",
        drawingSavedSuccess: "successfully saved to database!",

        // Intersection Check & Report
        intersectionCheckBadge: "Intersection Check",
        intersectionCheckAnalyzing: "Calculating...",
        intersectionCheckHint: "Draw a polygon on the map for intersection analysis.",
        analysisReportTitle: "Inventory Intersection Analysis Report",
        totalIntersectedLabel: "Total Intersected Features",
        pointLayerLabel: "Point Layer",
        lineLayerLabel: "Line Layer",
        polygonLayerLabel: "Polygon Layer",
        intersectedDetailsHeader: "Intersected Feature Details:",
        clearAnalysisBtn: "Clear Analysis"
    }
};
