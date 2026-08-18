import { NextRequest, NextResponse } from 'next/server';
import {
  createIncident,
  createSchemeSuggestion,
  getIncidentsByUser,
  getIncidentCount,
  getPreferences,
} from 'lib/click-log/repository';
import { MAX_NOTES_LENGTH, MAX_SCHEME_SUGGESTION_LENGTH, MAX_TAGS_PER_KIND } from 'lib/click-log/constants';
import { canViewIncidents } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import type { IncidentMetadata } from 'lib/click-log/types';
import { isValidProblemTag, isValidSchemeTag, NOT_LISTED_SCHEME_SLUG } from 'lib/click-log/tags';
import { getWeaversBadgeHolders } from 'lib/contributor-access/badge';
import { ensureMutationCsrf, requireClickLogAccess } from './_lib';
import { failureReason } from 'lib/errors/failure';

export async function GET() {
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  // The userId is always the caller's own id, so this guard is satisfied today, but
  // calling the policy function keeps the access decision active and auditable (and
  // enforces the contract's mustMatch attribute policy) rather than leaving it as dead
  // code that a future admin-list path could bypass.
  if (!canViewIncidents(gate.auth.userId, userId, gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const incidents = await getIncidentsByUser(userId);
  const count = await getIncidentCount(userId);
  // Whether this member may pick the "Not listed" scheme tag (Weavers of the Commons badge
  // holders only — spam control). The client uses this to hide the option entirely; the POST
  // route independently enforces the same rule.
  const weavers = await getWeaversBadgeHolders([userId]);
  logClickLogAudit({ actorId: userId, command: 'click-log.incident.list', result: 'success' });
  return NextResponse.json({ incidents, count, canSuggestScheme: weavers.has(userId) });
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

// Validate a latitude value that is present in the incident metadata.
function invalidLatitude(latitude: unknown): boolean {
  return typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90;
}

// Validate a longitude value that is present in the incident metadata.
function invalidLongitude(longitude: unknown): boolean {
  return typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180;
}

// Trim notes before validating and storing so trailing/leading whitespace can't push a note past the
// limit (or be stored unnormalized). Drop an empty trimmed note. Returns undefined when absent.
function parseNotes(raw: unknown): { error: NextResponse } | { data: string | undefined } {
  if (raw === undefined) {
    return { data: undefined };
  }
  if (typeof raw !== 'string') {
    return { error: badRequest('Invalid notes') };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { error: badRequest('Notes too long') };
  }
  return { data: trimmed.length > 0 ? trimmed : undefined };
}

// Validate and normalize the optional incident metadata. metadata is optional per the command
// contract; a client that omits it (or sends an empty body) defaults to {} rather than a 400.
// Returns a discriminated result so the caller keeps TypeScript narrowing.
function parseIncidentMetadata(rawBody: unknown): { error: NextResponse } | { data: IncidentMetadata } {
  const rawMetadata = (rawBody as { metadata?: unknown })?.metadata ?? {};
  if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return { error: badRequest('Invalid metadata') };
  }
  const meta = rawMetadata as { latitude?: unknown; longitude?: unknown; notes?: unknown };
  if (meta.latitude !== undefined && invalidLatitude(meta.latitude)) {
    return { error: badRequest('Invalid latitude') };
  }
  if (meta.longitude !== undefined && invalidLongitude(meta.longitude)) {
    return { error: badRequest('Invalid longitude') };
  }
  const notesResult = parseNotes(meta.notes);
  if ('error' in notesResult) {
    return notesResult;
  }
  return { data: buildMetadata(meta, notesResult.data) };
}

// Assemble the incident metadata, including only the fields that were provided so an omitted field is
// stored as absent rather than as null/undefined.
function buildMetadata(
  meta: { latitude?: unknown; longitude?: unknown },
  notes: string | undefined,
): IncidentMetadata {
  return {
    ...(meta.latitude !== undefined ? { latitude: meta.latitude as number } : {}),
    ...(meta.longitude !== undefined ? { longitude: meta.longitude as number } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

// Validate an optional incident tag list against its canonical slug list
// (lib/click-log/tags.ts). Absent/null/[] all mean untagged; an unknown slug is rejected so
// trend reporting only ever aggregates known values; duplicates are collapsed; each kind is
// capped at MAX_TAGS_PER_KIND. Returns a discriminated result so the caller keeps narrowing.
function parseTagList(
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

// Validate the optional per-incident owner-share choice. undefined means the caller left the
// decision to the member's stored global default.
function parseSharedFlag(raw: unknown): { error: NextResponse } | { data: boolean | undefined } {
  if (raw === undefined) {
    return { data: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { error: badRequest('Invalid sharedWithOwner') };
  }
  return { data: raw };
}

// Validate both optional tag lists plus the tags-require-location rule (owner decision,
// 2026-08-02): a tagged incident must carry a location, because without it the trend data a
// tag feeds is not detailed enough. Applies when either list is non-empty. Lists since
// 2026-08-13: a real incident routinely chains several schemes, so each kind takes up to
// MAX_TAGS_PER_KIND slugs.
function parseIncidentTags(
  body: unknown,
  metadata: IncidentMetadata,
): { error: NextResponse } | { data: { problemTags: string[]; schemeTags: string[] } } {
  const problemResult = parseTagList(
    (body as { problemTags?: unknown })?.problemTags,
    isValidProblemTag,
    'problemTags',
  );
  if ('error' in problemResult) {
    return problemResult;
  }
  const schemeResult = parseTagList(
    (body as { schemeTags?: unknown })?.schemeTags,
    isValidSchemeTag,
    'schemeTags',
  );
  if ('error' in schemeResult) {
    return schemeResult;
  }
  const tagged = problemResult.data.length > 0 || schemeResult.data.length > 0;
  if (tagged && (metadata.latitude === undefined || metadata.longitude === undefined)) {
    return { error: badRequest('Location is required when tagging an incident') };
  }
  return { data: { problemTags: problemResult.data, schemeTags: schemeResult.data } };
}

// Resolve the effective owner-share flag. A tagged incident is ALWAYS shared (owner decision,
// 2026-08-18: tags exist to feed the trend data, so tagging requires trend sharing — an incident
// can be private only when untagged). An explicit false alongside tags is a client bug and gets a
// 400 rather than a silent override; tagged with no explicit choice shares regardless of the
// stored default. Untagged incidents keep the opt-in rule: an explicit per-incident choice wins;
// otherwise the member's stored global default (which itself defaults to not shared).
async function resolveSharedWithOwner(
  explicit: boolean | undefined,
  tagged: boolean,
  userId: string,
): Promise<{ error: NextResponse } | { data: boolean }> {
  if (tagged) {
    if (explicit === false) {
      return {
        error: badRequest(
          'Sharing trend data with the owner is required when tagging an incident — remove the tags to keep it private',
        ),
      };
    }
    return { data: true };
  }
  if (explicit !== undefined) {
    return { data: explicit };
  }
  return { data: (await getPreferences(userId)).shareWithOwner };
}

// Validate the optional Quora self-link on a scheme suggestion: an https quora.com link (any
// subdomain). It is the member's own post about a similar incident — a spam signal for the owner.
function parseQuoraUrl(raw: unknown): { error: NextResponse } | { data: string | undefined } {
  if (raw === undefined || raw === null || raw === '') {
    return { data: undefined };
  }
  if (typeof raw !== 'string') {
    return { error: badRequest('Invalid schemeQuoraUrl') };
  }
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || (url.hostname !== 'quora.com' && !url.hostname.endsWith('.quora.com'))) {
      return { error: badRequest('schemeQuoraUrl must be an https quora.com link') };
    }
    return { data: url.toString() };
  } catch {
    return { error: badRequest('Invalid schemeQuoraUrl') };
  }
}

// The required "Not listed" description: non-empty after trimming, capped like a note.
function parseSuggestionText(raw: unknown): { error: NextResponse } | { data: string } {
  const suggestion = typeof raw === 'string' ? raw.trim() : '';
  if (suggestion.length === 0 || suggestion.length > MAX_SCHEME_SUGGESTION_LENGTH) {
    return {
      error: badRequest(
        `Describe the scheme (1–${MAX_SCHEME_SUGGESTION_LENGTH} characters) when picking "Not listed"`,
      ),
    };
  }
  return { data: suggestion };
}

// The "Not listed" scheme-suggestion rules (owner decision, 2026-08-02): picking the catch-all
// scheme REQUIRES a description — the intake that lets the owner name new schemes — and that
// text is explicitly shared with the owner (the form says so; incident notes stay never-shared).
// Limited to Weavers of the Commons badge holders as spam control. Suggestion fields sent with
// any other scheme tag are rejected so nothing shared can ride along unnoticed.
async function parseSchemeSuggestion(
  body: unknown,
  schemeTags: string[],
  userId: string,
): Promise<{ error: NextResponse } | { data: { suggestion: string; quoraUrl: string | undefined } | undefined }> {
  const rawSuggestion = (body as { schemeSuggestion?: unknown })?.schemeSuggestion;
  const urlResult = parseQuoraUrl((body as { schemeQuoraUrl?: unknown })?.schemeQuoraUrl);
  if ('error' in urlResult) {
    return urlResult;
  }
  if (!schemeTags.includes(NOT_LISTED_SCHEME_SLUG)) {
    if (rawSuggestion !== undefined || urlResult.data !== undefined) {
      return { error: badRequest('Scheme suggestions are only accepted with the "Not listed" scheme tag') };
    }
    return { data: undefined };
  }
  const textResult = parseSuggestionText(rawSuggestion);
  if ('error' in textResult) {
    return textResult;
  }
  const weavers = await getWeaversBadgeHolders([userId]);
  if (!weavers.has(userId)) {
    return {
      error: NextResponse.json(
        { error: 'Suggesting a new scheme is limited to Weavers of the Commons badge holders' },
        { status: 403 },
      ),
    };
  }
  return { data: { suggestion: textResult.data, quoraUrl: urlResult.data } };
}

// Validated create payload, ready for storage.
type CreatePayload = {
  metadata: IncidentMetadata;
  sharedWithOwner: boolean;
  problemTags: string[];
  schemeTags: string[];
  suggestion: { suggestion: string; quoraUrl: string | undefined } | undefined;
};

// Runs the whole create-body validation chain — metadata, share flag, tag lists (which require
// a location and force sharing), and the "Not listed" suggestion — so the POST handler stays
// under the rule-116 complexity limit.
async function parseCreatePayload(
  body: unknown,
  userId: string,
): Promise<{ error: NextResponse } | { data: CreatePayload }> {
  const parsed = parseIncidentMetadata(body);
  if ('error' in parsed) {
    return parsed;
  }
  const metadata = parsed.data;
  const sharedResult = parseSharedFlag((body as { sharedWithOwner?: unknown })?.sharedWithOwner);
  if ('error' in sharedResult) {
    return sharedResult;
  }
  // Optional tag lists: which known problems happened and/or which named schemes were used.
  // Either, both, or neither may be non-empty; a tagged incident must carry a location and is
  // always shared with the owner.
  const tagsResult = parseIncidentTags(body, metadata);
  if ('error' in tagsResult) {
    return tagsResult;
  }
  // "Not listed" scheme suggestion: required description + optional Quora link, Weavers-only.
  const suggestionResult = await parseSchemeSuggestion(body, tagsResult.data.schemeTags, userId);
  if ('error' in suggestionResult) {
    return suggestionResult;
  }
  const tagged = tagsResult.data.problemTags.length > 0 || tagsResult.data.schemeTags.length > 0;
  const sharedWithOwnerResult = await resolveSharedWithOwner(sharedResult.data, tagged, userId);
  if ('error' in sharedWithOwnerResult) {
    return sharedWithOwnerResult;
  }
  return {
    data: {
      metadata,
      sharedWithOwner: sharedWithOwnerResult.data,
      ...tagsResult.data,
      suggestion: suggestionResult.data,
    },
  };
}

export async function POST(req: NextRequest) {
  const csrfDenied = ensureMutationCsrf(req);
  if (csrfDenied) {
    return csrfDenied;
  }
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  let body;
  try {
    body = await req.json();
  } catch (caught) {
    return NextResponse.json({ error: 'Invalid JSON body', reason: failureReason(caught) }, { status: 400 });
  }
  const payload = await parseCreatePayload(body, userId);
  if ('error' in payload) {
    return payload.error;
  }
  const { metadata, sharedWithOwner, problemTags, schemeTags, suggestion } = payload.data;
  const incident = await createIncident({ userId, metadata, sharedWithOwner, problemTags, schemeTags });
  if (suggestion) {
    await createSchemeSuggestion({ incidentId: incident.id, userId, ...suggestion });
  }
  logClickLogAudit({ actorId: userId, command: 'click-log.incident.create', result: 'success' });
  // Return the incident flat to match the command contract's outputSchema
  // (ClickLogIncident, not a { incident } wrapper). No current caller reads this body,
  // so unwrapping here aligns the route with the contract without breaking a reader.
  return NextResponse.json(incident);
}
