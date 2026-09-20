// Identity comes from an explicit airport code, never a city-name match.
export function getAirportCode(record = {}) {
    for (const value of [record.airportCode, record.iata, record.stopCode]) {
        const code = String(value || '').trim().toUpperCase();
        if (/^[A-Z]{3}$/.test(code)) return code;
    }
    return String(record.name || '').match(/\[([A-Z]{3})\]/i)?.[1].toUpperCase() || null;
}
