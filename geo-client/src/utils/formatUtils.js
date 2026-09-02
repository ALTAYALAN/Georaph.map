/**
 * Süre değerini (dakika) okunabilir formatta biçimlendirir.
 * 60 dakikadan küçükse: "45 dk"
 * 60 dakika ve üzeri ise: "2 sa 25 dk" veya "8 sa"
 * 
 * @param {number} durationMinutes - Dakika cinsinden süre
 * @param {string} lang - Dil kodu ('tr' veya 'en')
 * @returns {string} - Biçimlendirilmiş süre metni
 */
export function formatDuration(durationMinutes, lang = 'tr') {
    if (durationMinutes == null || isNaN(durationMinutes) || durationMinutes <= 0) return '-';
    const totalMinutes = Math.round(durationMinutes);
    const hrLabel = lang === 'tr' ? 'sa' : 'hr';
    const minLabel = lang === 'tr' ? 'dk' : 'min';

    if (totalMinutes < 60) {
        return `${totalMinutes} ${minLabel}`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;

    if (remainingMins === 0) {
        return `${hours} ${hrLabel}`;
    }
    return `${hours} ${hrLabel} ${remainingMins} ${minLabel}`;
}
