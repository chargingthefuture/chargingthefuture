// Optional road-condition events for the verdict. Two sources, both opt-in and
// both entirely best-effort — the report NEVER depends on either, and any
// failure (missing config, downtime, rate limit, unexpected shape) just returns
// nothing for that source.
//
// 1) Open state DOT ("511") GeoJSON feeds. There is no single nationwide keyless
//    511 API — feeds are per-state and differ — so nothing is hardcoded. Set one
//    env var per state whose value is an OPEN GeoJSON road-event feed URL:
//      ROAD_FEED_CO=https://…        ROAD_FEED_WY=https://…
//
// 2) 511.org (San Francisco Bay Area) Open Data traffic events — a regional,
//    token-based fallback covering Bay Area roads only. Set SF_BAY_511_TOKEN to
//    your 511.org token (https://511.org/open-data/token). Leave it unset to skip.
//
// Only events within ROAD_EVENT_RADIUS_MILES of a stop are kept, so a stop in one
// area only matches the source that covers it.

const RADIUS_MILES = Number(process.env.ROAD_EVENT_RADIUS_MILES) || 25;

// Cached per process; the Render container is short-lived and feeds change
// slowly, so a simple memo avoids refetching for each waypoint (and keeps the
// 511.org call well under its hourly rate limit).
const feedCache = new Map();
let sfBay511Cache;

function feedUrls() {
  return Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('ROAD_FEED_') && value)
    .map(([, value]) => value);
}

function milesBetween(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Flatten any GeoJSON coordinate nesting down to [lon, lat] pairs.
function flatten(coords) {
  if (!Array.isArray(coords)) return [];
  if (typeof coords[0] === 'number') return [coords];
  return coords.flatMap(flatten);
}

function centroid(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates || [];
    return typeof lat === 'number' ? { lat, lon } : null;
  }
  const pairs = flatten(geometry.coordinates);
  if (!pairs.length) return null;
  let sLat = 0;
  let sLon = 0;
  for (const [lon, lat] of pairs) {
    sLat += lat;
    sLon += lon;
  }
  return { lat: sLat / pairs.length, lon: sLon / pairs.length };
}

// Best-effort short label from whatever the feed calls its fields.
function headlineOf(props = {}) {
  const keys = ['headline', 'Headline', 'description', 'Description', 'message', 'Message', 'name', 'Name', 'eventType', 'EventType'];
  for (const k of keys) {
    if (props[k]) return String(props[k]);
  }
  const road = props.RoadwayName || props.roadwayName || props.roadName;
  if (road) return `${props.EventType || props.eventType || 'event'} on ${road}`;
  return 'road event';
}

function clean(label) {
  return label.replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Events from the configured open GeoJSON state feeds.
async function fetchFeedEvents(lat, lon) {
  const urls = feedUrls();
  if (!urls.length) return [];
  const out = [];
  for (const url of urls) {
    try {
      let features = feedCache.get(url);
      if (!features) {
        const res = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
        if (!res.ok) continue;
        const data = await res.json();
        features = Array.isArray(data?.features) ? data.features : [];
        feedCache.set(url, features);
      }
      for (const f of features) {
        const c = centroid(f.geometry);
        if (c && milesBetween(lat, lon, c.lat, c.lon) <= RADIUS_MILES) {
          out.push(clean(headlineOf(f.properties)));
        }
      }
    } catch {
      // A single bad/unreachable feed must not break the whole report.
    }
  }
  return out;
}

// Events from 511.org (SF Bay Area). Optional, token-based, best-effort: returns
// nothing if the token is unset or anything goes wrong. Each event carries a
// GeoJSON `geography` geometry and a `headline`.
async function fetchSfBay511(lat, lon) {
  const token = process.env.SF_BAY_511_TOKEN;
  if (!token) return [];
  try {
    if (!sfBay511Cache) {
      const res = await fetch(
        `https://api.511.org/traffic/events?api_key=${encodeURIComponent(token)}&format=json`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return [];
      const data = await res.json();
      sfBay511Cache = Array.isArray(data?.events) ? data.events : (Array.isArray(data) ? data : []);
    }
    const out = [];
    for (const e of sfBay511Cache) {
      const c = centroid(e.geography || e.geometry);
      if (c && milesBetween(lat, lon, c.lat, c.lon) <= RADIUS_MILES) {
        out.push(clean(headlineOf(e)));
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Return short road-event labels within range of the point, across every
// configured source. Sources are queried in parallel and merged.
export async function fetchRoadEvents(lat, lon) {
  const [feeds, sfBay] = await Promise.all([
    fetchFeedEvents(lat, lon),
    fetchSfBay511(lat, lon),
  ]);
  return [...new Set([...feeds, ...sfBay])];
}
