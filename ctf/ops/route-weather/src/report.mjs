// Turns a route (named waypoints) or a single point into plain text a person
// can read at a glance or have Siri read aloud. No HTML, no styling — just text.
// Phrasing is written to be spoken cleanly: directions are words ("northwest"),
// temperatures say "degrees", and times are 12-hour, so Siri reads it naturally.

import { geocode, sampleAt, fetchUSAlerts, inUS } from './providers.mjs';

// Straight-line miles → rough driving miles. Highway routing is typically
// 1.2–1.3× the great-circle distance once roads bend around terrain.
const ROAD_FACTOR = 1.25;
// Effective rolling average for a loaded truck over a long haul (governed cruise
// minus grades and slower state limits). Only used to bucket each stop to the
// nearest forecast hour, so approximate is fine. Override per request with `mph`.
const DEFAULT_MPH = 58;

const COMPASS_WORDS = {
  N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast',
  E: 'east', ESE: 'east-southeast', SE: 'southeast', SSE: 'south-southeast',
  S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
  W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
};

// Great-circle distance in miles.
function haversineMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Timezone offset like "-06:00" for a given IANA zone at a given moment.
function tzOffset(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const m = name.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : '+00:00';
}

// "YYYY-MM-DD" for a given zone.
function ymdInTz(timeZone, date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => p.find((x) => x.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// 12-hour clock, e.g. "6:00 AM" — reads better aloud than "06:00".
function clockInTz(timeZone, epoch) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(epoch));
}

// Resolve the departure moment (epoch ms). Accepts "HH:MM" (read in the origin's
// zone, rolled to tomorrow if already well past), a full ISO timestamp, or none.
function resolveDepart(depart, originTz) {
  const now = Date.now();
  if (!depart) return now;
  if (/^\d{1,2}:\d{2}$/.test(depart)) {
    const ymd = ymdInTz(originTz, new Date(now));
    const off = tzOffset(originTz, new Date(now));
    let epoch = Date.parse(`${ymd}T${depart.padStart(5, '0')}:00${off}`);
    if (epoch < now - 60 * 60 * 1000) epoch += 24 * 60 * 60 * 1000;
    return epoch;
  }
  const parsed = Date.parse(depart);
  return Number.isNaN(parsed) ? now : parsed;
}

function windPhrase(s) {
  if (!s.windText && !s.windDir) return '';
  const dir = s.windDir ? (COMPASS_WORDS[s.windDir] || s.windDir.toLowerCase()) : '';
  let phrase = 'wind';
  if (dir) phrase += ` ${dir}`;
  if (s.windText) phrase += ` ${s.windText}`;
  if (s.gust) phrase += ` gusting ${s.gust}`;
  return phrase;
}

function fmtSample(s) {
  const parts = [`${s.tempF == null ? 'temperature unavailable' : `${s.tempF} degrees`}`];
  const wind = windPhrase(s);
  if (wind) parts.push(wind);
  if (s.condition) parts.push(s.condition);
  return parts.join(', ');
}

// Build the multi-stop route report from origin, optional waypoints, destination.
export async function buildRouteReport({ from, to, via = [], depart, mph }) {
  if (!from || !to) throw new Error('need both a "from" and a "to" place');
  const speed = Number(mph) > 0 ? Number(mph) : DEFAULT_MPH;
  const names = [from, ...via.filter(Boolean), to];
  const places = [];
  for (const n of names) {
    // Sequential: a few geocodes, keeps it simple and within rate limits.
    places.push(await geocode(n));
  }

  const originTz = places[0].timeZone;
  const departEpoch = resolveDepart(depart, originTz);

  // Cumulative driving time → an estimated arrival epoch per stop.
  let miles = 0;
  const etas = [departEpoch];
  for (let i = 1; i < places.length; i += 1) {
    miles += haversineMiles(places[i - 1], places[i]) * ROAD_FACTOR;
    etas.push(departEpoch + (miles / speed) * 3600 * 1000);
  }

  const rows = await Promise.all(
    places.map(async (p, i) => {
      const sample = await sampleAt(p, etas[i]);
      const alerts = p.countryCode === 'US' || inUS(p.lat, p.lon) ? await fetchUSAlerts(p.lat, p.lon) : [];
      return { place: p, eta: etas[i], sample, alerts };
    }),
  );

  const first = places[0];
  const last = places[places.length - 1];
  const lines = [`ROUTE WX. ${first.name} ${first.region} to ${last.name} ${last.region}.`, ''];
  rows.forEach((r, i) => {
    const when = i === 0 && Math.abs(r.eta - Date.now()) < 30 * 60 * 1000
      ? 'Now'
      : clockInTz(originTz, r.eta);
    const tag = r.alerts.length ? ` ALERT: ${r.alerts[0]}.` : '';
    lines.push(`${when}, ${r.place.name} ${r.place.region}: ${fmtSample(r.sample)}.${tag}`);
  });

  const allAlerts = [...new Set(
    rows.flatMap((r) => r.alerts.map((a) => `${a} at ${r.place.name} ${r.place.region}`)),
  )];
  if (allAlerts.length) lines.push('', `Alerts: ${allAlerts.join('; ')}.`);
  lines.push('', `(Times in ${originTz}. ETAs assume ${speed} mph and are approximate.)`);
  return lines.join('\n');
}

// Build the single-point report (current conditions + the next few hours).
export async function buildPointReport({ lat, lon }) {
  const point = { lat: Number(lat), lon: Number(lon) };
  if (Number.isNaN(point.lat) || Number.isNaN(point.lon)) throw new Error('need numeric lat and lon');
  const now = Date.now();
  const hours = [0, 1, 2, 3];
  const samples = await Promise.all(hours.map((h) => sampleAt(point, now + h * 3600 * 1000)));
  const alerts = inUS(point.lat, point.lon) ? await fetchUSAlerts(point.lat, point.lon) : [];
  const tz = samples[0].timeZone;
  const lines = [`HERE WX. ${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}.`, ''];
  samples.forEach((s, i) => {
    const label = i === 0 ? 'Now' : clockInTz(tz, now + hours[i] * 3600 * 1000);
    lines.push(`${label}: ${fmtSample(s)}.`);
  });
  if (alerts.length) lines.push('', `Alerts: ${[...new Set(alerts)].join('; ')}.`);
  lines.push('', `(Times in ${tz}.)`);
  return lines.join('\n');
}
