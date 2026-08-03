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
  // Optional coarse tags: which known problem happened / which named scheme was used.
  // Values are slugs from lib/click-log/tags.ts (validated on create); null when untagged.
  problem_tag: string | null;
  scheme_tag: string | null;
  created_at: string;
};

export type CreateIncidentInput = {
  userId: string;
  metadata: IncidentMetadata;
  sharedWithOwner: boolean;
  problemTag?: string;
  schemeTag?: string;
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

// One row of the owner tag-trend aggregate over shared incidents: a tag kind + slug + count.
// Tags are coarse categorical values from the canonical lists in lib/click-log/tags.ts, so this
// carries no free text, location, incident ids, or member identity.
export type SharedIncidentTagTrend = {
  tagType: 'problem' | 'scheme';
  tag: string;
  count: number;
};
