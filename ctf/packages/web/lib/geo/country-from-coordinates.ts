import borders from './country-borders.json';

// Names the country a coordinate falls in, offline, from the border table built by
// `ctf/scripts/build-country-borders.mjs`.
//
// Why this exists: the ClickLog trend report could show an area cell but not what country it was
// in, so a reader could not tell one town reporting from four continents reporting — which is the
// first question anyone asks of a map. The coordinates needed to answer it are already stored, so
// the answer needs no new question in the log form and works on every incident already logged.
//
// Why not a geocoding service: the input is a member's approximate location. Handing it to an
// outside company to ask which country it is in would give a third party the one thing this report
// exists to keep in-house, for an answer that never changes.
//
// Precision, stated plainly because the report repeats it to the reader: the borders are the
// coarse 1:110m edition and the report looks up the ~11 km cell rather than the exact position, so
// a cell straddling a border can land on the wrong side, and small island states the coarse
// edition omits come back unmatched. Neither affects telling a local cluster from a global one,
// which is what the country column is for.

export type CountryMatch = {
  // Two-letter code where one is assigned; otherwise a short slug of the name (Natural Earth
  // leaves a handful of entries without an ISO code).
  code: string;
  name: string;
};

type BorderPolygon = { bbox: number[]; rings: number[][] };
type BorderCountry = { code: string; name: string; polygons: BorderPolygon[] };

const COUNTRIES = borders.countries as BorderCountry[];

// Ray casting over one flat [lon, lat, …] ring. A point exactly on an edge may fall either way;
// at ~11 km cells that is not a distinction worth code.
function pointInRing(lon: number, lat: number, ring: number[]): boolean {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const lonI = ring[i * 2];
    const latI = ring[i * 2 + 1];
    const lonJ = ring[j * 2];
    const latJ = ring[j * 2 + 1];
    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      inside = !inside;
    }
  }
  return inside;
}

// Inside the outer ring and outside every hole.
function pointInPolygon(lon: number, lat: number, polygon: BorderPolygon): boolean {
  const [minLon, minLat, maxLon, maxLat] = polygon.bbox;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return false;
  if (!pointInRing(lon, lat, polygon.rings[0])) return false;
  for (let i = 1; i < polygon.rings.length; i += 1) {
    if (pointInRing(lon, lat, polygon.rings[i])) return false;
  }
  return true;
}

// Repeated cells are the norm — a report asks about the same handful of areas every time it is
// built — so the answers are kept for the life of the process.
const cache = new Map<string, CountryMatch | null>();

export function countryForCoordinates(latitude: number, longitude: number): CountryMatch | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const key = `${latitude},${longitude}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let match: CountryMatch | null = null;
  for (const country of COUNTRIES) {
    if (country.polygons.some((polygon) => pointInPolygon(longitude, latitude, polygon))) {
      match = { code: country.code, name: country.name };
      break;
    }
  }
  cache.set(key, match);
  return match;
}

// How many countries the table knows about, for the report's own description of its limits.
export const COUNTRY_TABLE_SIZE = COUNTRIES.length;
