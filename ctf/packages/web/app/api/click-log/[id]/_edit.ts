import { NextRequest, NextResponse } from 'next/server';
import { updateIncident } from 'lib/click-log/repository';
import { canEditIncident } from 'lib/click-log/policy';
import { MAX_NOTES_LENGTH, MAX_TAGS_PER_KIND } from 'lib/click-log/constants';
import { isValidProblemTag, isValidSchemeTag, NOT_LISTED_SCHEME_SLUG } from 'lib/click-log/tags';
import type { ClickLogIncident } from 'lib/click-log/types';
import { failureReason } from 'lib/errors/failure';

// Validation and update helpers for PUT /api/click-log/[id] (edit an incident's note and tags).
// Split from route.ts so each function stays under the rule-116 complexity limit.

export type IncidentEditFields = {
  notes: string | null;
  problemTags: string[];
  schemeTags: string[];
};

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

// Normalize one tag-list field of the edit body: absent, null, or [] all mean untagged;
// otherwise every entry must be a known slug from the canonical list, duplicates are
// collapsed, and each kind is capped at MAX_TAGS_PER_KIND (same rules as create).
function parseEditTagList(
  raw: unknown,
  isValid: (slug: string) => boolean,
  fieldName: string,
): { error: NextResponse } | { data: string[] } {
  if (raw === undefined || raw === null) {
    return { data: [] };
  }
  if (!Array.isArray(raw)) {
    return { error: badRequest(`Invalid ${fieldName}: expected a list of tag slugs`) };
  }
  const unique = [...new Set(raw)];
  if (unique.some((slug) => typeof slug !== 'string' || !isValid(slug))) {
    return { error: badRequest(`Invalid ${fieldName}: unknown tag slug`) };
  }
  if (unique.length > MAX_TAGS_PER_KIND) {
    return { error: badRequest(`Invalid ${fieldName}: at most ${MAX_TAGS_PER_KIND} tags`) };
  }
  return { data: unique as string[] };
}

// Normalize the note field of the edit body: absent, null, or whitespace-only all clear the
// note; a non-empty note is trimmed and length-checked like on create.
function parseEditNotes(raw: unknown): { error: NextResponse } | { data: string | null } {
  if (raw === undefined || raw === null) {
    return { data: null };
  }
  if (typeof raw !== 'string') {
    return { error: badRequest('Invalid notes') };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { error: badRequest('Notes too long') };
  }
  return { data: trimmed.length > 0 ? trimmed : null };
}

// Reads and validates the PUT body: { notes, problemTags, schemeTags }. The date and location are
// immutable by design (owner decision, 2026-08-13), so the body carries no metadata beyond the
// note — a client sending coordinates here is simply ignored by the field list.
export async function parseEditBody(
  request: NextRequest,
): Promise<{ error: NextResponse } | { data: IncidentEditFields }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (caught) {
    return { error: NextResponse.json({ error: 'Invalid JSON body', reason: failureReason(caught) }, { status: 400 }) };
  }
  const notesResult = parseEditNotes((body as { notes?: unknown })?.notes);
  if ('error' in notesResult) {
    return notesResult;
  }
  const problemResult = parseEditTagList((body as { problemTags?: unknown })?.problemTags, isValidProblemTag, 'problemTags');
  if ('error' in problemResult) {
    return problemResult;
  }
  const schemeResult = parseEditTagList((body as { schemeTags?: unknown })?.schemeTags, isValidSchemeTag, 'schemeTags');
  if ('error' in schemeResult) {
    return schemeResult;
  }
  return { data: { notes: notesResult.data, problemTags: problemResult.data, schemeTags: schemeResult.data } };
}

// Authorization for the edit: the incident must belong to the caller. No admin override — the
// note is the member's private content (mirrors canToggleIncidentShare). The route has already
// 404ed a missing incident before calling this.
export function authorizeEdit(userId: string, incident: ClickLogIncident): NextResponse | null {
  if (!incident.user_id || !canEditIncident(userId, incident.user_id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  return null;
}

// The edit rules that depend on the stored incident:
// - Tags still require a location (same rule as create), and the location is immutable — so an
//   incident logged without one can never gain tags, only edit its note.
// - "Not listed" is a logging-time flow (its required description is written at create); an
//   edit may keep or remove it on an incident that already carries it, but never newly pick it.
export function validateEditRules(
  incident: ClickLogIncident,
  fields: IncidentEditFields,
): NextResponse | null {
  const tagged = fields.problemTags.length > 0 || fields.schemeTags.length > 0;
  const hasLocation = incident.metadata.latitude !== undefined && incident.metadata.longitude !== undefined;
  if (tagged && !hasLocation) {
    return badRequest('Location is required when tagging an incident, and this incident was logged without one');
  }
  if (fields.schemeTags.includes(NOT_LISTED_SCHEME_SLUG) && !incident.scheme_tags.includes(NOT_LISTED_SCHEME_SLUG)) {
    return badRequest('Pick "Not listed" when logging a new incident — the scheme description is written at logging time');
  }
  return null;
}

// Runs the update and maps the outcomes the route cares about. 'conflict' is the generated
// metadata_hash dedupe: the edited note made this row's metadata identical to another of the
// member's incidents, violating UNIQUE (user_id, metadata_hash).
export async function applyIncidentEdit(
  id: string,
  userId: string,
  fields: IncidentEditFields,
): Promise<'ok' | 'conflict' | 'failed'> {
  try {
    const updated = await updateIncident({ id, userId, ...fields });
    return updated ? 'ok' : 'failed';
  } catch (caught) {
    if ((caught as { code?: string })?.code === '23505') {
      return 'conflict';
    }
    throw caught;
  }
}
