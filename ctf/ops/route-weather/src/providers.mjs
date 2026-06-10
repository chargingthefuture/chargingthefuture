// Weather + geocoding data sources for the route-weather service.
//
// Both sources are KEYLESS on purpose — this is a public open-source repo and a
// keyless source is nothing to leak. US points use the National Weather Service
// (api.weather.gov: temperature, wind, and active hazard alerts). Everywhere
// else falls back to Open-Meteo (global, includes wind gusts). Place names are
// turned into coordinates with Open-Meteo's free geocoding endpoint.

const NWS_HEADERS = {
  // NWS requires a User-Agent that identifies the caller.
  'User-Agent': 'ctf-route-weather (https://github.com/chargingthefuture/chargingthefuture)',
  Accept: 'application/geo+json',
};

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

// World Meteorological Organization weather codes → plain words (Open-Meteo).
const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers',
  85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return '';
  return COMPASS[Math.round(deg / 22.5) % 16];
}

const round = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n));

// Rough continental-US bounding box. Good enough to pick NWS vs Open-Meteo when
// we only have raw coordinates (point mode) and no country code.
export function inUS(lat, lon) {
  return lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// "Denver, CO" → { name, lat, lon, region, countryCode, timeZone }
export async function geocode(query) {
  const [namePart, regionPart] = query.split(',').map((s) => s.trim());
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(namePart)}&count=10&language=en&format=json`;
  const data = await getJson(url);
  const results = data.results || [];
  if (results.length === 0) throw new Error(`could not find a place named "${query}"`);
  // If the caller gave a region hint after the comma, prefer a matching result.
  let pick = results[0];
  if (regionPart) {
    const hint = regionPart.toUpperCase();
    const match = results.find(
      (r) =>
        (r.admin1 && r.admin1.toUpperCase().includes(hint)) ||
        (r.admin1_id && String(r.admin1_id) === hint) ||
        (r.country_code && r.country_code.toUpperCase() === hint),
    );
    if (match) pick = match;
  }
  return {
    name: pick.name,
    lat: pick.latitude,
    lon: pick.longitude,
    region: pick.admin1 || pick.country_code || '',
    countryCode: (pick.country_code || '').toUpperCase(),
    timeZone: pick.timezone || 'UTC',
  };
}

// Turn coordinates into a place name (city + state/region). Keyless and
// best-effort: returns null on any failure so the report still works.
export async function reverseGeocode(lat, lon) {
  try {
    const data = await getJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const city = data.city || data.locality || '';
    const region = data.principalSubdivision || '';
    const country = (data.countryCode || '').toUpperCase();
    if (!city && !region) return null;
    return { city, region, country };
  } catch {
    return null;
  }
}

// Pick the forecast entry closest to a target time.
function nearestIndex(epochs, targetEpoch) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < epochs.length; i += 1) {
    const diff = Math.abs(epochs[i] - targetEpoch);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

async function sampleNWS(lat, lon, etaEpoch) {
  const point = await getJson(`https://api.weather.gov/points/${lat},${lon}`, NWS_HEADERS);
  const hourlyUrl = point.properties?.forecastHourly;
  const timeZone = point.properties?.timeZone || 'UTC';
  if (!hourlyUrl) throw new Error('NWS returned no hourly forecast for this point');
  const hourly = await getJson(hourlyUrl, NWS_HEADERS);
  const periods = hourly.properties?.periods || [];
  const epochs = periods.map((p) => Date.parse(p.startTime));
  const p = periods[nearestIndex(epochs, etaEpoch)];
  return {
    provider: 'NWS',
    timeZone,
    tempF: round(p.temperatureUnit === 'F' ? p.temperature : p.temperature * 1.8 + 32),
    // NWS gives windSpeed as text ("12 mph" or "10 to 15 mph") and a compass
    // abbreviation; NWS hourly does not include a separate gust value.
    windText: (p.windSpeed || '').replace(/ mph$/i, '').trim(),
    windDir: p.windDirection || '',
    gust: '',
    condition: (p.shortForecast || '').toLowerCase(),
  };
}

export async function fetchUSAlerts(lat, lon) {
  try {
    const data = await getJson(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, NWS_HEADERS);
    return (data.features || [])
      .map((f) => f.properties?.event)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function sampleOpenMeteo(lat, lon, etaEpoch) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=3';
  const data = await getJson(url);
  const h = data.hourly || {};
  const offset = (data.utc_offset_seconds || 0) * 1000;
  // hourly.time are local wall-clock strings; convert to true UTC epoch.
  const epochs = (h.time || []).map((t) => Date.parse(`${t}:00Z`) - offset);
  const i = nearestIndex(epochs, etaEpoch);
  return {
    provider: 'Open-Meteo',
    timeZone: data.timezone || 'UTC',
    tempF: round(h.temperature_2m?.[i]),
    windText: h.wind_speed_10m?.[i] != null ? String(round(h.wind_speed_10m[i])) : '',
    windDir: degToCompass(h.wind_direction_10m?.[i]),
    gust: h.wind_gusts_10m?.[i] != null ? String(round(h.wind_gusts_10m[i])) : '',
    condition: WMO[h.weather_code?.[i]] || '',
  };
}

// Choose the right source for a point and return a normalized sample.
export async function sampleAt({ lat, lon, countryCode }, etaEpoch) {
  const useNWS = countryCode ? countryCode === 'US' : inUS(lat, lon);
  if (useNWS) {
    try {
      return await sampleNWS(lat, lon, etaEpoch);
    } catch {
      // Fall back to the global source if NWS is unavailable for this point.
      return sampleOpenMeteo(lat, lon, etaEpoch);
    }
  }
  return sampleOpenMeteo(lat, lon, etaEpoch);
}
