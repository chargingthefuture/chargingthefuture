#!/usr/bin/env node
/**
 * Builds the offline country-border table the ClickLog trend report uses to name the country an
 * area cell falls in.
 *
 * Why a vendored table rather than a geocoding service: the input is a member's approximate
 * location. Sending it to an outside company to ask "which country is this" would hand a third
 * party the one thing the whole report is built to keep in-house, for an answer that does not
 * change and can be computed here. It also keeps the report working with no network, no API key,
 * and no per-call cost.
 *
 * Source: Natural Earth 1:110m admin-0 countries (public domain). That is the coarse edition —
 * borders are simplified and small islands are dropped. Accurate enough to say which country a
 * cell is in, not accurate enough to arbitrate a border dispute, and the report says so.
 *
 * Output shape (ctf/packages/web/lib/geo/country-borders.json):
 *   { source, generatedFrom, countries: [{ code, name, polygons: [{ bbox, rings }] }] }
 * where each ring is a flat [lon, lat, lon, lat, …] array rounded to 2 decimal places (~1 km) and
 * bbox is [minLon, minLat, maxLon, maxLat] for the cheap rejection test.
 *
 * Run: node ctf/scripts/build-country-borders.mjs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const COORDINATE_DECIMALS = 2;

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/web/lib/geo/country-borders.json'
);

const round = (n) => Number(n.toFixed(COORDINATE_DECIMALS));

// Flattens one GeoJSON ring to [lon, lat, …] at reduced precision, dropping points that collapse
// onto their predecessor once rounded. A ring left with fewer than 4 points is not a polygon any
// more and is discarded by the caller.
function flattenRing(ring) {
  const out = [];
  let lastLon = NaN;
  let lastLat = NaN;
  for (const [lon, lat] of ring) {
    const rLon = round(lon);
    const rLat = round(lat);
    if (rLon === lastLon && rLat === lastLat) continue;
    out.push(rLon, rLat);
    lastLon = rLon;
    lastLat = rLat;
  }
  return out;
}

function buildPolygon(rings) {
  const flat = rings.map(flattenRing).filter((r) => r.length >= 8);
  if (flat.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < flat[0].length; i += 2) {
    minLon = Math.min(minLon, flat[0][i]);
    maxLon = Math.max(maxLon, flat[0][i]);
    minLat = Math.min(minLat, flat[0][i + 1]);
    maxLat = Math.max(maxLat, flat[0][i + 1]);
  }
  return { bbox: [minLon, minLat, maxLon, maxLat], rings: flat };
}

// Natural Earth leaves ISO_A2 as '-99' for a handful of entries (France and Norway carry theirs in
// ISO_A2_EH; N. Cyprus and Somaliland have no assigned code at all). Fall back through the EH
// column, then to a slug of the name, so every feature gets a stable key.
function countryCode(properties) {
  for (const key of ['ISO_A2', 'ISO_A2_EH']) {
    const value = properties[key];
    if (typeof value === 'string' && value.length === 2 && value !== '-9') return value;
  }
  return String(properties.NAME || 'unknown')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    console.error(
      `Could not download the country borders from ${SOURCE_URL}: the server answered ${response.status} ${response.statusText}. ` +
        `Nothing was written. Retry when the network is available, or download that file by hand and adapt this script to read it from disk.`
    );
    process.exit(1);
  }
  const source = await response.json();

  const countries = [];
  for (const feature of source.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const groups =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    const polygons = groups.map(buildPolygon).filter(Boolean);
    if (polygons.length === 0) continue;
    countries.push({
      code: countryCode(feature.properties),
      name: String(feature.properties.NAME_LONG || feature.properties.NAME),
      polygons,
    });
  }

  countries.sort((a, b) => a.code.localeCompare(b.code));

  const payload = {
    source: 'Natural Earth 1:110m admin-0 countries (public domain)',
    generatedFrom: SOURCE_URL,
    note: 'Coarse borders, ~1 km coordinate precision. Names a country; does not settle a border.',
    countries,
  };
  writeFileSync(outputPath, `${JSON.stringify(payload)}\n`);
  const points = countries.reduce(
    (sum, c) => sum + c.polygons.reduce((s, p) => s + p.rings.reduce((r, ring) => r + ring.length / 2, 0), 0),
    0
  );
  console.log(`Wrote ${countries.length} countries (${points} border points) to ${outputPath}`);
}

main().catch((error) => {
  console.error(`Building the country border table failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
