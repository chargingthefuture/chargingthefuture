// Turns a route (named waypoints) or a point into plain text a person can read
// at a glance or have Siri read aloud, with a driving verdict (DRIVE / CAUTION /
// HOLD). No HTML, no styling. Phrasing is written to be spoken cleanly: directions
// are words ("northwest"), temperatures say "degrees", times are 12-hour.
// Each builder returns { text, verdict } so callers can act on the verdict
// (set a response header, or only push an alert when it is not DRIVE).

import { geocode, sampleAt, fetchUSAlerts, inUS, reverseGeocode } from './providers.mjs';
import { assessHazard, worst, classifyAlert } from './hazard.mjs';
import { fetchRoadEvents } from './roadconditions.mjs';

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

// Point reached by traveling `distMiles` along `bearingDeg` from a start point.
function destinationPoint(lat, lon, bearingDeg, distMiles) {
  const R = 3958.8;
  const br = (bearingDeg * Math.PI) / 180;
  const dr = distMiles / R;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(
    Math.sin(br) * Math.sin(dr) * Math.cos(la1),
    Math.cos(dr) - Math.sin(la1) * Math.sin(la2),
  );
  return { lat: (la2 * 180) / Math.PI, lon: (((lo2 * 180) / Math.PI + 540) % 360) - 180 };
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

// "DRIVE." or "CAUTION (gusting 41, snow)." — the spoken verdict for one line.
function verdictTag(hz) {
  if (hz.level === 'DRIVE') return 'DRIVE.';
  return hz.reasons.length ? `${hz.level} (${hz.reasons.join(', ')}).` : `${hz.level}.`;
}

// Just the wind, no leading "wind" word, for the wind-only report. Reads "calm"
// when the wind is effectively zero rather than "north 0".
function windOnly(s) {
  const nums = String(s.windText || '').match(/\d+/g);
  const speed = nums ? Math.max(...nums.map(Number)) : null;
  const gust = s.gust ? parseInt(s.gust, 10) : null;
  if (speed == null || speed === 0) return gust ? `calm, gusting ${gust}` : 'calm';
  const dir = s.windDir ? (COMPASS_WORDS[s.windDir] || s.windDir.toLowerCase()) : '';
  const parts = [];
  if (dir) parts.push(dir);
  parts.push(s.windText);
  let out = parts.join(' ');
  if (gust) out += ` gusting ${gust}`;
  return out;
}

// " near Aurora, Colorado" / " in Colorado" / "" — a spoken place suffix.
function locationSuffix(place) {
  if (place?.city && place?.region) return ` near ${place.city}, ${place.region}`;
  if (place?.region) return ` in ${place.region}`;
  if (place?.city) return ` near ${place.city}`;
  return '';
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
      const isUS = p.countryCode === 'US' || inUS(p.lat, p.lon);
      const [alerts, roadEvents] = await Promise.all([
        isUS ? fetchUSAlerts(p.lat, p.lon) : Promise.resolve([]),
        isUS ? fetchRoadEvents(p.lat, p.lon) : Promise.resolve([]),
      ]);
      return { place: p, eta: etas[i], sample, alerts, roadEvents, hz: assessHazard(sample, alerts, roadEvents) };
    }),
  );

  const overall = worst(rows.map((r) => r.hz.level));
  const first = places[0];
  const last = places[places.length - 1];
  const lines = [`Route weather. ${first.name} ${first.region} to ${last.name} ${last.region}.`];

  if (overall === 'DRIVE') {
    lines.push('VERDICT: DRIVE. Clear along the route.', '');
  } else {
    const w = rows.find((r) => r.hz.level === overall);
    lines.push(`VERDICT: ${overall} at ${w.place.name} ${w.place.region} — ${w.hz.reasons.join(', ')}.`, '');
  }

  rows.forEach((r, i) => {
    const when = i === 0 && Math.abs(r.eta - Date.now()) < 30 * 60 * 1000
      ? 'Now'
      : clockInTz(originTz, r.eta);
    // Only call out a stop's verdict when it is not DRIVE — the overall verdict
    // is already stated up top, so repeating "DRIVE" on every line reads badly.
    const tag = r.hz.level === 'DRIVE' ? '' : ` ${verdictTag(r.hz)}`;
    lines.push(`${when}, ${r.place.name} ${r.place.region}: ${fmtSample(r.sample)}.${tag}`);
  });

  const label = (r, a) => `${a} at ${r.place.name} ${r.place.region}`;
  const drivingAlerts = [...new Set(
    rows.flatMap((r) => r.alerts.filter((a) => classifyAlert(a) !== 'none').map((a) => label(r, a))),
  )];
  if (drivingAlerts.length) lines.push('', `Alerts: ${drivingAlerts.join('; ')}.`);
  const otherAlerts = [...new Set(
    rows.flatMap((r) => r.alerts.filter((a) => classifyAlert(a) === 'none').map((a) => label(r, a))),
  )];
  if (otherAlerts.length) lines.push('', `Also active (not driving): ${otherAlerts.join('; ')}.`);

  const allRoad = [...new Set(
    rows.flatMap((r) => r.roadEvents.map((e) => `${e} (near ${r.place.name} ${r.place.region})`)),
  )];
  if (allRoad.length) lines.push('', `Road conditions: ${allRoad.join('; ')}.`);

  if (rows.some((r) => r.place.countryCode && r.place.countryCode !== 'US')) {
    lines.push('', 'Note: government hazard alerts are US-only; outside the US the verdict uses wind, temperature, and conditions.');
  }
  lines.push('', `(Times in ${originTz}. ETAs assume ${speed} mph and are approximate.)`);
  return { text: lines.join('\n'), verdict: overall };
}

// Build the wind-only report: just the current wind at the point, named, in one
// short line — for feeling out how different winds drive.
export async function buildWindReport({ lat, lon }) {
  const point = { lat: Number(lat), lon: Number(lon) };
  if (Number.isNaN(point.lat) || Number.isNaN(point.lon)) throw new Error('need numeric lat and lon');
  const [sample, place] = await Promise.all([
    sampleAt(point, Date.now()),
    reverseGeocode(point.lat, point.lon),
  ]);
  return { text: `Wind${locationSuffix(place)}: ${windOnly(sample)}.` };
}

// Build the single-point report: current conditions + the next few hours, and an
// optional look-ahead one hour down the road when heading (and speed) are given.
export async function buildPointReport({ lat, lon, heading, speed }) {
  const point = { lat: Number(lat), lon: Number(lon) };
  if (Number.isNaN(point.lat) || Number.isNaN(point.lon)) throw new Error('need numeric lat and lon');
  const now = Date.now();
  const hours = [0, 1, 2, 3];

  const stops = hours.map((h) => ({ label: h === 0 ? 'Now' : null, at: now + h * 3600 * 1000, point }));
  const headingNum = Number(heading);
  if (Number.isFinite(headingNum)) {
    const mph = Number(speed) > 0 ? Number(speed) : DEFAULT_MPH;
    stops.push({ label: 'Ahead (~1h)', at: now + 3600 * 1000, point: destinationPoint(point.lat, point.lon, headingNum, mph) });
  }

  const isUS = inUS(point.lat, point.lon);
  const [samples, alerts, roadEvents, place] = await Promise.all([
    Promise.all(stops.map((s) => sampleAt(s.point, s.at))),
    isUS ? fetchUSAlerts(point.lat, point.lon) : Promise.resolve([]),
    isUS ? fetchRoadEvents(point.lat, point.lon) : Promise.resolve([]),
    reverseGeocode(point.lat, point.lon),
  ]);
  const assessments = samples.map((s) => assessHazard(s, alerts, roadEvents));
  const overall = worst(assessments.map((a) => a.level));
  const tz = samples[0].timeZone;

  // Name where this is, so it's clear aloud (e.g. "near Aurora, Colorado").
  const lines = [`Road weather${locationSuffix(place)}.`];
  if (overall === 'DRIVE') lines.push('VERDICT: DRIVE. Clear nearby.', '');
  else {
    const idx = assessments.findIndex((a) => a.level === overall);
    lines.push(`VERDICT: ${overall} — ${assessments[idx].reasons.join(', ')}.`, '');
  }

  stops.forEach((s, i) => {
    const label = s.label || clockInTz(tz, s.at);
    const tag = assessments[i].level === 'DRIVE' ? '' : ` ${verdictTag(assessments[i])}`;
    lines.push(`${label}: ${fmtSample(samples[i])}.${tag}`);
  });
  const drivingAlerts = [...new Set(alerts.filter((a) => classifyAlert(a) !== 'none'))];
  const otherAlerts = [...new Set(alerts.filter((a) => classifyAlert(a) === 'none'))];
  if (drivingAlerts.length) lines.push('', `Alerts: ${drivingAlerts.join('; ')}.`);
  if (otherAlerts.length) lines.push('', `Also active (not driving): ${otherAlerts.join('; ')}.`);
  if (roadEvents.length) lines.push('', `Road conditions: ${[...new Set(roadEvents)].join('; ')}.`);
  if (!isUS) lines.push('', 'Note: government hazard alerts are US-only; outside the US the verdict uses wind, temperature, and conditions.');
  lines.push('', `(Times in ${tz}.)`);
  return { text: lines.join('\n'), verdict: overall };
}
