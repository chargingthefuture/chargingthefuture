export type IncidentMetadata = {
  latitude?: number;
  longitude?: number;
  notes?: string;
};

export type ClickLogIncident = {
  id: string;
  user_id: string | null;
  metadata: IncidentMetadata;
  // Whether the member opted to share this incident with the owner for aggregate trends.
  shared_with_owner: boolean;
  // Optional coarse tags: which known problems happened / which named schemes were used.
  // Arrays (owner decision, 2026-08-13): a real incident routinely chains several schemes, so
  // one tag per kind never fit. Values are slugs from lib/click-log/tags.ts (each validated on
  // create/edit, capped at MAX_TAGS_PER_KIND per kind); empty arrays when untagged.
  problem_tags: string[];
  scheme_tags: string[];
  created_at: string;
};

export type CreateIncidentInput = {
  userId: string;
  metadata: IncidentMetadata;
  sharedWithOwner: boolean;
  problemTags?: string[];
  schemeTags?: string[];
};

// Edit of an existing incident (owner decision, 2026-08-13): the note and the tag lists may be
// changed after logging; the date and location are immutable, so they are absent here. A null
// note removes it; an empty tag array means untagged.
export type UpdateIncidentInput = {
  id: string;
  userId: string;
  notes: string | null;
  problemTags: string[];
  schemeTags: string[];
};

// Per-member ClickLog preferences (click_log_preferences). shareWithOwner is the global default
// applied when a new incident is logged without an explicit per-incident choice.
export type ClickLogPreferences = {
  shareWithOwner: boolean;
};

// One coarse bucket of the owner trends aggregate: a UTC day plus an optional ~11 km location cell
// (latitude/longitude rounded to 1 decimal place). Never carries notes, precise coordinates, or
// member identity.
export type SharedIncidentTrendBucket = {
  day: string;
  latitudeCell: number | null;
  longitudeCell: number | null;
  count: number;
};

// A member's "Not listed" scheme suggestion, written when logging an incident with the
// catch-all scheme tag. Explicitly shared with the owner (the form says so); a scheduled
// pipeline turns new suggestions into private triage issues so the owner can name new schemes.
export type CreateSchemeSuggestionInput = {
  incidentId: string;
  userId: string;
  suggestion: string;
  // Optional link to the member's own Quora post about a similar incident (spam signal for
  // the owner). Validated to be a quora.com link before storage.
  quoraUrl?: string;
};

// One row of the owner tag-trend aggregate over shared incidents: a tag kind + slug + count.
// Tags are coarse categorical values from the canonical lists in lib/click-log/tags.ts, so this
// carries no free text, location, incident ids, or member identity.
export type SharedIncidentTagTrend = {
  tagType: 'problem' | 'scheme';
  tag: string;
  count: number;
};

// ---------------------------------------------------------------------------
// Trend report aggregates
//
// Everything below is owner/admin reporting over incidents members opted to share. Same privacy
// boundary as the two aggregates above: counts and canonical tag slugs only, computed in SQL, and
// no notes, precise coordinates, incident ids, or member identity ever leaves the query.
// ---------------------------------------------------------------------------

// Headline figures for the report. `reporters` is the number of distinct members behind the shared
// incidents — the figure that separates one person logging seven times from seven people logging
// once, which is the first thing an outside reader needs and the one the old view never showed.
export type SharedIncidentReportSummary = {
  days: number;
  sharedIncidents: number;
  reporters: number;
  // Members with more than one shared incident in the window: repetition, not isolated events.
  repeatReporters: number;
  // Distinct ~11 km cells across the window. Counted here rather than taken from the length of
  // the area list, which is capped.
  areas: number;
  taggedIncidents: number;
  withLocation: number;
  withoutLocation: number;
  firstDay: string | null;
  lastDay: string | null;
};

// One ~11 km area cell (latitude/longitude rounded to 1 decimal place) with how much activity sits
// in it. Coordinates are the cell corner, never a member's actual position.
export type SharedIncidentArea = {
  latitudeCell: number;
  longitudeCell: number;
  incidents: number;
  reporters: number;
  firstDay: string;
  lastDay: string;
  // The country the cell falls in, worked out offline from the coordinates already stored
  // (`lib/geo/country-from-coordinates.ts`). Null when the coarse border table has no match —
  // open ocean, or a small island state the coarse edition leaves out.
  countryCode: string | null;
  countryName: string | null;
};

// One country across the whole window: how much activity sits in it and how widely spread. This is
// what separates one town reporting from four continents reporting, and it is the first thing a
// reader outside the project asks of the numbers.
//
// `reporters` is an exact distinct count, not a sum of the per-area counts — one member moving
// between two cells in the same country is one person, and adding the cells would report them
// twice.
export type SharedIncidentCountry = {
  // Two-letter code where one is assigned, else a short slug of the name. Null for cells the
  // border table could not place.
  code: string | null;
  name: string | null;
  incidents: number;
  reporters: number;
  areas: number;
  firstDay: string;
  lastDay: string;
};

// Incidents rolled up into the harm categories in `tag-categories.ts`. Counted per incident (an
// incident with three problems from one category counts once), so the numbers add up the way a
// reader assumes they do.
export type SharedIncidentCategoryTrend = {
  category: string;
  incidents: number;
  reporters: number;
};

// How often a named scheme was tagged on the same incident as a given problem. This is the pattern
// evidence: it shows the method attached to the harm rather than two unrelated rankings.
export type SharedIncidentTagPair = {
  problemTag: string;
  schemeTag: string;
  incidents: number;
  reporters: number;
};

// The whole report payload, as served by the admin trends endpoint and rendered into the
// shareable image.
export type SharedIncidentReport = {
  summary: SharedIncidentReportSummary;
  buckets: SharedIncidentTrendBucket[];
  areas: SharedIncidentArea[];
  countries: SharedIncidentCountry[];
  tagTrends: SharedIncidentTagTrend[];
  categories: SharedIncidentCategoryTrend[];
  pairs: SharedIncidentTagPair[];
};
