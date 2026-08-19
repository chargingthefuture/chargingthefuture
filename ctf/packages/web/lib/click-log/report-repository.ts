import { queryDb } from 'lib/db/postgres';
import { problemCategorySlugMap } from './tag-categories';
import { countryForCoordinates } from 'lib/geo/country-from-coordinates';
import type {
  SharedIncidentArea,
  SharedIncidentCategoryTrend,
  SharedIncidentReportSummary,
  SharedIncidentTagPair,
} from './types';

// Reporting aggregates over shared ClickLog incidents. Kept separate from `repository.ts`, which
// owns incident create/read/edit/delete: this module only ever reads, only ever in aggregate, and
// grows as the report grows.
//
// The privacy boundary is the same one `repository.ts` states and is enforced here in SQL, not left
// to the caller: every query below filters on `shared_with_owner` and projects counts, UTC day
// strings, 1-decimal location cells (~11 km), and canonical tag slugs. Notes, precise coordinates,
// incident ids, and member identity never leave these queries. `user_id` appears only inside
// `COUNT(DISTINCT …)`, never in a projection.

type SummaryRow = {
  shared_incidents: string;
  reporters: string;
  areas: string;
  repeat_reporters: string;
  tagged_incidents: string;
  with_location: string;
  without_location: string;
  first_day: string | null;
  last_day: string | null;
};

// An all-zero row, used when the window holds nothing at all. Reading the counts through this
// rather than through a chain of null checks on every field keeps the query function simple.
const EMPTY_SUMMARY_ROW: SummaryRow = {
  shared_incidents: '0',
  reporters: '0',
  areas: '0',
  repeat_reporters: '0',
  tagged_incidents: '0',
  with_location: '0',
  without_location: '0',
  first_day: null,
  last_day: null,
};

// Headline figures. One pass over the window so every number is consistent with the others.
export async function getSharedIncidentReportSummary(days = 90): Promise<SharedIncidentReportSummary> {
  const result = await queryDb<SummaryRow>(
    `WITH shared AS (
       SELECT user_id,
              created_at,
              (cardinality(problem_tags) > 0 OR cardinality(scheme_tags) > 0) AS tagged,
              CASE
                WHEN metadata->>'latitude' IS NOT NULL AND metadata->>'longitude' IS NOT NULL
                THEN round((metadata->>'latitude')::numeric, 1)::text || ',' ||
                     round((metadata->>'longitude')::numeric, 1)::text
              END AS cell
       FROM click_log_incidents
       WHERE shared_with_owner
         AND created_at >= NOW() - make_interval(days => $1)
     )
     SELECT
       COUNT(*) AS shared_incidents,
       COUNT(DISTINCT user_id) AS reporters,
       COUNT(DISTINCT cell) AS areas,
       (SELECT COUNT(*) FROM (SELECT user_id FROM shared GROUP BY user_id HAVING COUNT(*) > 1) r)
         AS repeat_reporters,
       COUNT(*) FILTER (WHERE tagged) AS tagged_incidents,
       COUNT(*) FILTER (WHERE cell IS NOT NULL) AS with_location,
       COUNT(*) FILTER (WHERE cell IS NULL) AS without_location,
       to_char(MIN(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_day,
       to_char(MAX(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_day
     FROM shared`,
    [days]
  );
  const row = result.rows[0] ?? EMPTY_SUMMARY_ROW;
  return {
    days,
    sharedIncidents: parseInt(row.shared_incidents, 10),
    reporters: parseInt(row.reporters, 10),
    areas: parseInt(row.areas, 10),
    repeatReporters: parseInt(row.repeat_reporters, 10),
    taggedIncidents: parseInt(row.tagged_incidents, 10),
    withLocation: parseInt(row.with_location, 10),
    withoutLocation: parseInt(row.without_location, 10),
    firstDay: row.first_day,
    lastDay: row.last_day,
  };
}

// Where the shared incidents sit, as ~11 km cells. The existing day/cell/count aggregate answers
// "how much happened on each day"; this answers "how much happened in each place, over what span,
// and from how many different members" — which is the location detail the trends screen was
// missing. Incidents with no location are absent by construction and are counted in the summary
// instead, so a reader can see how much of the window has no place attached to it.
//
// The list is capped so one very widely spread window cannot produce an unreadable screen or an
// enormous image. The summary counts every distinct cell, capped or not, and the report says how
// many were left off — a truncated list that looked complete would be worse than no list.
export async function getSharedIncidentAreas(days = 90, limit = 200): Promise<SharedIncidentArea[]> {
  const result = await queryDb<{
    latitude_cell: string;
    longitude_cell: string;
    incidents: string;
    reporters: string;
    first_day: string;
    last_day: string;
  }>(
    `SELECT
       round((metadata->>'latitude')::numeric, 1) AS latitude_cell,
       round((metadata->>'longitude')::numeric, 1) AS longitude_cell,
       COUNT(*) AS incidents,
       COUNT(DISTINCT user_id) AS reporters,
       to_char(MIN(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_day,
       to_char(MAX(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_day
     FROM click_log_incidents
     WHERE shared_with_owner
       AND created_at >= NOW() - make_interval(days => $1)
       AND metadata->>'latitude' IS NOT NULL
       AND metadata->>'longitude' IS NOT NULL
     GROUP BY 1, 2
     ORDER BY 3 DESC, 1, 2
     LIMIT $2`,
    [days, limit]
  );
  // The country is named here rather than in SQL: it comes from the border table in
  // `lib/geo`, and the cell the query already returns is all it needs. Looking it up from the
  // rounded cell rather than the exact position keeps the query's output unchanged — a cell
  // sitting on a border can land on the wrong side, which the report states and which does not
  // affect telling a local cluster from a global one.
  return result.rows.map((row) => {
    const latitudeCell = Number(row.latitude_cell);
    const longitudeCell = Number(row.longitude_cell);
    const country = countryForCoordinates(latitudeCell, longitudeCell);
    return {
      latitudeCell,
      longitudeCell,
      incidents: parseInt(row.incidents, 10),
      reporters: parseInt(row.reporters, 10),
      firstDay: row.first_day,
      lastDay: row.last_day,
      countryCode: country?.code ?? null,
      countryName: country?.name ?? null,
    };
  });
}

// Problems rolled up into the harm categories in `tag-categories.ts`. Counted per incident with the
// array-overlap operator, so an incident carrying three problems from one category counts once —
// summing the per-tag counts instead would double-count and inflate every category.
export async function getSharedIncidentCategoryTrends(days = 90): Promise<SharedIncidentCategoryTrend[]> {
  const result = await queryDb<{ category: string; incidents: string; reporters: string }>(
    `WITH categories AS (
       SELECT key AS category, ARRAY(SELECT jsonb_array_elements_text(value)) AS slugs
       FROM jsonb_each($2::jsonb)
     ),
     shared AS (
       SELECT user_id, problem_tags
       FROM click_log_incidents
       WHERE shared_with_owner
         AND created_at >= NOW() - make_interval(days => $1)
         AND cardinality(problem_tags) > 0
     )
     SELECT c.category,
            COUNT(s.problem_tags) AS incidents,
            COUNT(DISTINCT s.user_id) AS reporters
     FROM categories c
     LEFT JOIN shared s ON s.problem_tags && c.slugs
     GROUP BY c.category
     ORDER BY 2 DESC, 1 ASC`,
    [days, JSON.stringify(problemCategorySlugMap())]
  );
  return result.rows.map((row) => ({
    category: row.category,
    incidents: parseInt(row.incidents, 10),
    reporters: parseInt(row.reporters, 10),
  }));
}

// Which named scheme was tagged alongside which problem on the same incident. Two separate ranked
// lists say what happened and what was used; this says which method was attached to which harm,
// which is the part that reads as a pattern rather than a pile of complaints.
export async function getSharedIncidentTagPairs(days = 90, limit = 12): Promise<SharedIncidentTagPair[]> {
  const result = await queryDb<{
    problem_tag: string;
    scheme_tag: string;
    incidents: string;
    reporters: string;
  }>(
    `SELECT p.tag AS problem_tag,
            s.tag AS scheme_tag,
            COUNT(*) AS incidents,
            COUNT(DISTINCT i.user_id) AS reporters
     FROM click_log_incidents i,
          unnest(i.problem_tags) AS p(tag),
          unnest(i.scheme_tags) AS s(tag)
     WHERE i.shared_with_owner
       AND i.created_at >= NOW() - make_interval(days => $1)
     GROUP BY 1, 2
     ORDER BY 3 DESC, 1 ASC, 2 ASC
     LIMIT $2`,
    [days, limit]
  );
  return result.rows.map((row) => ({
    problemTag: row.problem_tag,
    schemeTag: row.scheme_tag,
    incidents: parseInt(row.incidents, 10),
    reporters: parseInt(row.reporters, 10),
  }));
}
