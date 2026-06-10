// Turns a route (named waypoints) or a single point into plain text a person
// can read at a glance or have Siri read aloud. No HTML, no styling — just text.

import { geocode, sampleAt, fetchUSAlerts, inUS } from './providers.mjs';

const ROAD_FACTOR = 1.2; // straight-line miles → rough driving miles
const DEFAULT_MPH = 55;

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

function clockInTz(timeZone, epoch) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
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

function fmtSample(s) {
  const bits = [`${s.tempF == null ? '?' : s.tempF}F`];
  if (s.wind) bits.push(`wind ${s.wind}`);
  if (s.gust) bits.push(`gust ${s.gust}`);
  if (s.condition) bits.push(s.condition);
  return bits.join('  ');
}

// Build the multi-stop route report from origin, optional waypoints, destination.
export async function buildRouteReport({ from, to, via = [], depart, mph }) {
  if (!from || !to) throw new Error('need both a "from" and a "to" place');
  const speed = Number(mph) > 0 ? Number(mph) : DEFAULT_MPH;
  const names = [from, ...via.filter(Boolean), to];
  const places = [];
  for (const n of names) {
    // Sequential: a few geocodes, keeps it simple and within rate limits.
    // eslint-disable-next-line no-await-in-loop
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

  const head = `ROUTE WX  ${places[0].name} ${places[0].region} -> ${places[places.length - 1].name} ${places[places.length - 1].region}`;
  const lines = [head, ''];
  rows.forEach((r, i) => {
    const when = i === 0 && Math.abs(r.eta - Date.now()) < 30 * 60 * 1000
      ? 'NOW  '
      : clockInTz(originTz, r.eta);
    const tag = r.alerts.length ? `  [ALERT: ${r.alerts[0]}]` : '';
    lines.push(`${when} ${r.place.name} ${r.place.region}  ${fmtSample(r.sample)}${tag}`);
  });

  const allAlerts = rows.flatMap((r) => r.alerts.map((a) => `- ${r.place.name} ${r.place.region}: ${a}`));
  if (allAlerts.length) {
    lines.push('', 'ALERTS:', ...[...new Set(allAlerts)]);
  }
  lines.push('', `(times in ${originTz}; ETAs assume ${speed} mph)`);
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
  const lines = [`HERE WX  ${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`, ''];
  samples.forEach((s, i) => {
    const label = i === 0 ? 'NOW  ' : clockInTz(tz, now + hours[i] * 3600 * 1000);
    lines.push(`${label} ${fmtSample(s)}`);
  });
  if (alerts.length) lines.push('', 'ALERTS:', ...[...new Set(alerts)].map((a) => `- ${a}`));
  lines.push('', `(times in ${tz})`);
  return lines.join('\n');
}
