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
