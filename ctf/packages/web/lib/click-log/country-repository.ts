import { queryDb } from 'lib/db/postgres';
import { countryForCoordinates } from 'lib/geo/country-from-coordinates';
import type { SharedIncidentCountry } from './types';

// The country rollup over shared incidents.
//
// The report could show an area cell but never what country it was in, so a reader could not tell
// one town reporting from four continents reporting. The coordinates needed to answer that are
// already stored on every incident, so this needs nothing new from members and works on everything
// already logged.
//
// How it runs, and why in two steps rather than one:
//
//   1. Ask the database for the distinct ~11 km cells in the window. Cells only — no counts, no
//      identity, nothing per incident.
//   2. Name each cell's country here, offline, from the border table.
//   3. Hand that cell-to-country mapping back into a single grouped query, which does the counting.
//
// The counting has to happen in SQL because the member count per country must be a distinct count.
// Adding up the per-area member counts would report one member who logged in two cells of the same
// country as two people, and that is exactly the number an outside reader would lean on hardest.
// Doing it this way keeps the privacy boundary where the rest of the report keeps it: member
// identity enters only inside `COUNT(DISTINCT …)`, and what comes back out is a count of people,
// never a list of them.
//
// The cell lookup is deliberately not capped the way the displayed area list is. A cell is two
// numbers, the set of them is small, and a country total built from a truncated cell list would be
// quietly wrong rather than visibly short.

type CellRow = { latitude_cell: string; longitude_cell: string };

type CountryRow = {
  country_code: string | null;
  country_name: string | null;
  incidents: string;
  reporters: string;
  areas: string;
  first_day: string;
  last_day: string;
};

async function getDistinctCells(days: number): Promise<CellRow[]> {
  const result = await queryDb<CellRow>(
    `SELECT DISTINCT
       round((metadata->>'latitude')::numeric, 1) AS latitude_cell,
       round((metadata->>'longitude')::numeric, 1) AS longitude_cell
     FROM click_log_incidents
     WHERE shared_with_owner
       AND created_at >= NOW() - make_interval(days => $1)
       AND metadata->>'latitude' IS NOT NULL
       AND metadata->>'longitude' IS NOT NULL`,
    [days]
  );
  return result.rows;
}

export async function getSharedIncidentCountries(days = 90): Promise<SharedIncidentCountry[]> {
  const cells = await getDistinctCells(days);
  if (cells.length === 0) {
    return [];
  }

  const latitudes: number[] = [];
  const longitudes: number[] = [];
  const codes: (string | null)[] = [];
  const names: (string | null)[] = [];
  for (const cell of cells) {
    const latitude = Number(cell.latitude_cell);
    const longitude = Number(cell.longitude_cell);
    const match = countryForCoordinates(latitude, longitude);
    latitudes.push(latitude);
    longitudes.push(longitude);
    codes.push(match?.code ?? null);
    names.push(match?.name ?? null);
  }

  // The join is on the rounded cell, matching how the mapping above was built. Cells the border
  // table could not place come back grouped under a null code rather than being dropped — a
  // country total that silently omitted them would not add up to the shared total, and a reader
  // checking the arithmetic would be right to distrust everything else.
  const result = await queryDb<CountryRow>(
    `WITH cell_country AS (
       SELECT * FROM unnest($2::numeric[], $3::numeric[], $4::text[], $5::text[])
         AS t(latitude_cell, longitude_cell, country_code, country_name)
     )
     SELECT
       cc.country_code,
       cc.country_name,
       COUNT(*) AS incidents,
       COUNT(DISTINCT i.user_id) AS reporters,
       COUNT(DISTINCT (cc.latitude_cell, cc.longitude_cell)) AS areas,
       to_char(MIN(i.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_day,
       to_char(MAX(i.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_day
     FROM click_log_incidents i
     JOIN cell_country cc
       ON round((i.metadata->>'latitude')::numeric, 1) = cc.latitude_cell
      AND round((i.metadata->>'longitude')::numeric, 1) = cc.longitude_cell
     WHERE i.shared_with_owner
       AND i.created_at >= NOW() - make_interval(days => $1)
     GROUP BY cc.country_code, cc.country_name
     ORDER BY 3 DESC, cc.country_name ASC NULLS LAST`,
    [days, latitudes, longitudes, codes, names]
  );

  return result.rows.map((row) => ({
    code: row.country_code,
    name: row.country_name,
    incidents: parseInt(row.incidents, 10),
    reporters: parseInt(row.reporters, 10),
    areas: parseInt(row.areas, 10),
    firstDay: row.first_day,
    lastDay: row.last_day,
  }));
}
