// Raised 200 -> 2000 (owner request, 2026-08-13): a note often has to recap a multi-part
// incident (the owner's cross-country bus trip chained five schemes), and 200 characters
// forced summaries too thin to be useful later. Notes stay private to the member either way.
export const MAX_NOTES_LENGTH = 2000;
// Max length of the "Not listed" scheme description a member writes when suggesting a new
// scheme. Unlike notes, this text IS shared with the owner — the field says so explicitly.
export const MAX_SCHEME_SUGGESTION_LENGTH = 200;
// Max tags of each kind (problems / schemes) on one incident. Arrays since 2026-08-13 (owner
// decision: a real incident routinely chains several schemes, so one tag per kind never fit).
// The cap bounds the trend aggregates and the picker UI, not the member's honesty.
export const MAX_TAGS_PER_KIND = 10;
export const DEFAULT_METADATA: Readonly<Record<string, never>> = Object.freeze({});
