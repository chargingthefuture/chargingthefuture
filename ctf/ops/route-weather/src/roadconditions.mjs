// Optional, keyless road-condition events from open state DOT ("511") feeds.
//
// There is no single nationwide keyless 511 API — feeds are per-state, in
// different shapes, and many require a key — so nothing is hardcoded here. You
// opt in by setting one environment variable per state whose value is an OPEN
// GeoJSON road-event feed URL:
//
//   ROAD_FEED_CO=https://…        ROAD_FEED_WY=https://…
//
// Every configured feed is queried and only events within ROAD_EVENT_RADIUS_MILES
// of the point are kept, so a point in one state naturally only matches that
// state's feed. With no ROAD_FEED_* set, this returns nothing and changes nothing.

const RADIUS_MILES = Number(process.env.ROAD_EVENT_RADIUS_MILES) || 25;

// Cached per process; the Render container is short-lived and the feeds change
// slowly, so a simple memo avoids refetching the same feed for each waypoint.
const feedCache = new Map();

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

// Return short road-event labels within range of the point, across all feeds.
export async function fetchRoadEvents(lat, lon) {
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
          out.push(headlineOf(f.properties).replace(/\s+/g, ' ').trim().slice(0, 120));
        }
      }
    } catch {
      // A single bad/unreachable feed must not break the whole report.
    }
  }
  return [...new Set(out)];
}
