// Raised 200 -> 2000 (owner request, 2026-08-13): a note often has to recap a multi-part
// incident (the owner's cross-country bus trip chained five schemes), and 200 characters
// forced summaries too thin to be useful later. Notes stay private to the member either way.
export const MAX_NOTES_LENGTH = 2000;
// Max length of the "Not listed" scheme description a member writes when suggesting a new
// scheme. Unlike notes, this text IS shared with the owner — the field says so explicitly.
export const MAX_SCHEME_SUGGESTION_LENGTH = 200;
export const DEFAULT_METADATA: Readonly<Record<string, never>> = Object.freeze({});
