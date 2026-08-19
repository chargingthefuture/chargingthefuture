// What sharing an incident actually means, written once so every surface says the same thing.
//
// Owner directive, 2026-08-19: the member-facing copy must say the grouped totals may be
// published. It always described where the data goes ("with the owner") and what is withheld
// ("never your notes"), but not what happens next — and what happens next is that the aggregate
// is posted publicly and handed to people outside the project. Sharing and publishing are one
// decision for the member, so they are described together, in the same sentence, at the moment
// the choice is made.
//
// The promise inside these strings is enforced in SQL, not here: the report queries in
// `report-repository.ts` project only day, rounded location, tags, and counts, and reach member
// identity only inside COUNT(DISTINCT …). Notes and exact coordinates never leave the member's
// own rows. Keep these strings and that boundary in step — if either changes, change both.

// The sentence appended to every share control. Kept short enough to sit at the end of a
// checkbox label without pushing it to a third line on a phone.
export const SHARE_PUBLISH_NOTE = 'Grouped totals may be published.';

// Global default, on the ClickLog shell.
export const SHARE_DEFAULT_LABEL =
  `Share new incidents with the owner by default (only trend data — never your notes). ${SHARE_PUBLISH_NOTE}`;

// Per-incident choice in the log form, when the member is free to choose.
export const SHARE_INCIDENT_LABEL =
  `Share this incident with the owner (only the date, rough area, and tags). ${SHARE_PUBLISH_NOTE}`;

// Per-incident state in the log form when tags force sharing on.
export const SHARE_INCIDENT_LOCKED_LABEL =
  `Shared with the owner — required for tagged incidents (only the date, rough area, and tags; never your note). ${SHARE_PUBLISH_NOTE}`;

// History-row pill: what the tooltip says when tags hold sharing on.
export const SHARE_PILL_LOCKED_HINT =
  `Tagged incidents always share trend data with the owner — remove the tags (edit) to make this private. ${SHARE_PUBLISH_NOTE}`;

// History-row pill: what a screen reader announces in the same locked state.
export const SHARE_PILL_LOCKED_ARIA =
  `Shared with the owner — required for tagged incidents; remove the tags to make it private. ${SHARE_PUBLISH_NOTE}`;

// Shown in the edit form when saving with tags is about to turn sharing on.
export const SHARE_EDIT_TURNS_ON_NOTICE =
  `Tags share trend data with the owner: saving with these tags turns on sharing for this incident (only the date, rough area, and tags — never your note). ${SHARE_PUBLISH_NOTE} Remove the tags to keep it private.`;
