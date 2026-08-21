# ClickLog Plugin Feature Inventory

## 1. Scope & Boundary

ClickLog provides a simple, auditable incident counter and logging system for users, supporting optional location and notes metadata. It is designed for event tracking, user journaling, and lightweight incident reporting.

## 2. Intent & Outcome

- Allow users to log incidents with a single tap/click
- Optionally capture geolocation and notes
- Display a running count and history
- Support deletion and auditability

## 3. User Features

- Three privacy rules cover the whole feature, and member-facing copy leads with them in this
  order (owner directive, 2026-08-18): (1) notes are always private, nobody but the member ever
  sees them; (2) an incident can be private only when it is untagged, and a private, untagged
  incident does not need a location; (3) tagging problems or schemes requires both a location
  and trend sharing — a tagged incident always shares its trend data with the owner, and only
  shared incidents feed the global trends.
- Every share control says the grouped totals may be published (owner directive, 2026-08-19). The
  trend report is posted publicly and given to people outside the project, so sharing and
  publication are one decision for the member and the copy states them together, at the moment the
  choice is made: the global default, the per-incident checkbox in the log form, the history-row
  pill tooltip and its screen-reader label, and the notice shown before an edit turns sharing on.
  The wording lives once in `lib/click-log/share-copy.ts` so the four surfaces cannot drift apart.
  What may be published is the aggregate only — notes, exact locations, and member identity are
  excluded by the report queries themselves, not by the screen.
- Log incident (with optional location/notes)
- Optionally tag an incident with which known problems happened ("Which problems happened?" —
  the 50+ problems list published on the public landing page) and/or which named schemes were
  used ("Which schemes were used?" — schemes named in the owner's now-deprecated "A post for
  each gang stalker game" Discourse thread plus schemes described in the owner's archived
  posts; `lib/click-log/tags.ts` is the living canonical list). Several of each may be picked —
  up to 10 problems and 10 schemes per incident (owner decision, 2026-08-13: a real incident
  routinely chains several schemes, so one tag per kind never fit). Both pickers are
  type-and-search filtered multi-select chip pickers (mimicking the Directory / SkillsHunt
  skill pickers): tapping a chip adds it, tapping it again removes it. A tagged incident
  requires a location — the form disables Submit (with an explanation) until location is added,
  and the server enforces the same rule — because tagged trend data needs location to be
  detailed enough. A tagged incident also always shares its trend data with the owner (owner
  decision, 2026-08-18): while tags are picked, the form's share checkbox locks on and its label
  says sharing is required for tagged incidents; unpicking every tag returns the checkbox to the
  member's own choice. The server enforces the same rule (a tagged create with an explicit
  sharedWithOwner: false is a 400; a tagged create with the flag omitted stores shared
  regardless of the member's global default). Tags show as chips on the history rows and feed
  trend reporting.
- Read the full problems list and the full schemes list while tagging: each picker carries a
  "Full list" link beside its question — the problems picker points at
  `https://www.chargingthefuture.com/look-ma`, the schemes picker at
  `https://www.chargingthefuture.com/schemes`. Both open in the shared share-link popup (the same
  control used everywhere else in the app), which shows the whole address, opens it in a new tab,
  or copies it — so reading the long description of a problem or a scheme never replaces the page
  and never loses the incident the member is part-way through logging. The same links appear in
  the pickers of the after-the-fact edit form.
- Suggest a new scheme via the "Not listed" scheme tag (Weavers of the Commons badge holders
  only — members without the badge do not see the option). Picking it requires a written
  description of the scheme (up to 200 characters) that is explicitly shared with the owner —
  the field says so; incident notes stay never-shared — plus an optional link to the member's
  own Quora post about a similar incident (an https quora.com link, also shared; it helps the
  owner tell real reports from spam). This intake is how new schemes earn a name: suggestions
  flow to the owner's private triage queue, and a real one becomes a pull request adding the
  scheme to the canonical list.
- View incident count and history
- Edit an own incident after logging (pencil icon on each history row): the note can be changed
  or removed, and the problem/scheme tag lists can be added to, changed, or emptied — using the
  same type-and-search multi-select pickers as the log form. The date and location cannot be changed: they anchor
  the trend data, and a location can't be truthfully added after the fact. Because tags require
  a location, an incident logged without one can never gain tags — the editor says so plainly
  and offers only the note. Because tags also require trend sharing (owner decision,
  2026-08-18), saving a private incident with tags turns sharing on: the editor states this in
  plain words before save, and the server sets `shared_with_owner` to true in the same update.
  The "Not listed" scheme can be kept or removed on an incident that
  already carries it, but not newly picked on edit (its required description is written when
  logging).
- Delete own incidents
- Choose whether an untagged incident is shared with the owner for trend tracking: a global
  "share new incidents by default" setting plus a per-incident override (in the log form and on
  each history row). For untagged incidents sharing is opt-in and off until the member turns it
  on, and can be turned off again per incident at any time. A tagged incident always shares
  (owner decision, 2026-08-18): its history-row pill locks at "Shared with owner" with a tooltip
  saying to remove the tags to make it private, and the server rejects a share-off call on a
  tagged incident with the same explanation. Shared incidents contribute only grouped trend data
  (day, approximate area, tags, count) — never the note or exact location. The member-facing
  copy says so in plain words: the global default reads "only trend data — never your notes" and
  the per-incident checkbox reads "only the date, rough area, and tags", and both close with
  "Grouped totals may be published." Neither uses the word "coarse".

## 4. Admin Features

- ClickLog Trends dashboard (`/admin/click-log`): aggregate counts over incidents members opted to
  share. Headline figures — shared incidents, members reporting (distinct members, not incidents),
  members who logged more than one, days with activity, number of countries, number of areas,
  tagged incidents — then per-day counts, the country rollup, the area breakdown, a harm-category
  rollup, "Top problems" / "Top schemes" tag
  breakdowns, problem-and-scheme pairs, and the method statement. No notes, precise coordinates,
  incident ids, or member identity are visible; member identity reaches the queries only inside
  `COUNT(DISTINCT …)`.
- Area breakdown (added 2026-08-19): every ~11 km cell with its coordinates, how many incidents and
  how many different members sit in it, and the span of dates it covers. The screen previously
  counted the clusters and stopped, which said activity had a location without ever saying where.
  Incidents logged without a location are absent from this list by construction and counted in
  every other figure; the summary states how many.
- Country rollup (added 2026-08-19): every country with its incident count, its exact distinct
  member count, how many areas sit in it, and the span of dates. The country is not asked of
  members — it is worked out inside the app from the ~11 km cell already stored, against the
  Natural Earth border table vendored at `lib/geo/country-borders.json` (rebuilt by
  `ctf/scripts/build-country-borders.mjs`), so nothing is sent to an outside service and every
  incident already logged gets a country. The member count per country is a `COUNT(DISTINCT
  user_id)` taken in SQL, never a sum of the per-area counts, which would report a member who
  logged in two cells of one country as two people. Cells the coarse table cannot place are shown
  as "Not matched to a country" rather than dropped, so the country totals still add up to the
  shared total. Limits are stated in the method note on the screen and in the image: coarse
  borders, looked up from the rounded cell, so an area on a border can land on the wrong side.
- Harm categories (added 2026-08-19): the 53 problem tags rolled up into six categories defined in
  `lib/click-log/tag-categories.ts` — watched and followed, body and health, threats and
  intimidation, blocked from work/money/services, set up to be blamed, cut off from people. Counted
  once per incident per category (array overlap in SQL), so an incident carrying three problems from
  one category adds one, not three. A ranked list of 53 individual problems is readable only to
  someone who already knows the subject; the rollup is what an outside reader can follow.
- Scheme kind labels (added 2026-08-19): each scheme row says whether it is an operation with a
  start and an end, something that runs continuously in the background, a shape over weeks or
  months, or not yet classified. This closes the taxonomy gap recorded in `tags.ts`, on the trigger
  that file names — the first time a tag ranking on real data would mislead a reader. No slug is
  renamed, removed, or reordered; the kinds live in `tag-categories.ts` beside the harm categories.
- Problem-and-scheme pairs (added 2026-08-19): how often a named scheme was tagged on the same
  incident as a given problem. Two separate rankings say what happened and what was used; the pair
  list says which method was attached to which harm.
- Shareable report image (added 2026-08-19): `GET /api/click-log/admin/trends/image` draws the whole
  report — every section plus the method statement — as one tall PNG, so it can be posted somewhere
  that takes an image without stitching phone screenshots together and losing rows at the seams.
  The trends screen offers it two ways: "Show the report as one image" opens it in the browser, which
  is the phone path (hold the picture to save it to photos or send it into another app), and "Save it
  as a file instead" (`?download=1`) downloads it, which is the computer path. A file download on a
  phone lands in the files app, one step away from anywhere the image is actually going.
  Built from the same aggregate as the screen, so there is no second data path. Area coordinates are
  left out unless `?areas=1` is passed and the download control's checkbox is ticked: at small
  counts an ~11 km cell plus a date can point at one person, and members opted into sharing trend
  data with the project rather than into being placed on a public map. Which variant was produced is
  recorded in the audit log.
- Method statement (added 2026-08-19): the words under the numbers on the screen and drawn into the
  image — where the figures come from, what is never counted, how to read a count, what the data
  cannot show, why scheme totals are not comparable, and location coverage. It is built from the
  report in `lib/click-log/trend-report-view.ts` so the screen and the image can never say different
  things. The long version, written for a reader outside the project, is
  `ctf/docs/CLICKLOG_TREND_REPORT_METHOD.md`.
- Scheme-naming pipeline (scheduled, outside the app): `.github/workflows/clicklog-scheme-suggestions.yml`
  runs `ctf/scripts/proposeSchemeSuggestions.mjs` twice a day. It (a) drains new "Not listed"
  suggestions into one issue per distinct text in the private triage repo
  (`chargingthefuture/bug-reports`) — carrying the suggestion text, the optional Quora self-link,
  a same-text count, and dates, never member identity or incident ids — and (b) files a single
  threshold alert (counts only) when shared "Not listed" incidents reach 5 in 90 days, at most one
  alert per 30 days (`click_log_unnamed_scheme_alerts` is the dedupe marker). The pipeline never
  edits the canonical scheme list; naming a scheme stays a PR to `lib/click-log/tags.ts` plus the
  landing-page `/schemes` mirror.
- View all incidents (future)
- Delete any incident (future)

## 5. API Surface and Route Map

- `GET /api/click-log` — List incidents for authenticated user. Returns `{ incidents, count, canSuggestScheme }` (`canSuggestScheme` = whether this member holds the Weavers of the Commons badge and so may pick "Not listed"). The user is always derived from the authenticated token (no caller-supplied `userId`); the access policy (`canViewIncidents`) is applied before the query.
- `POST /api/click-log` — Create incident. Accepts optional `sharedWithOwner` boolean (falls back to the member's stored global default) and optional `problemTags` / `schemeTags` string arrays (each slug validated against the canonical lists in `lib/click-log/tags.ts` — an unknown slug is a 400; duplicates collapsed; at most 10 per kind, `MAX_TAGS_PER_KIND`). When either list is non-empty, `metadata.latitude`/`metadata.longitude` are required (400 otherwise), and the incident is always stored shared: an explicit `sharedWithOwner: false` alongside tags is a 400, and an omitted flag stores shared regardless of the member's global default (owner decision, 2026-08-18). When `schemeTags` contains `other-scheme` ("Not listed"): `schemeSuggestion` is required (1–200 chars after trim), `schemeQuoraUrl` is optional (must be an https quora.com link), the caller must hold the Weavers badge (403 otherwise), and the suggestion is stored in `click_log_scheme_suggestions`; suggestion fields without `other-scheme` are a 400. Returns the created incident flat (a `ClickLogIncident`, not wrapped under `{ incident }`), matching the command contract's `outputSchema`.
- `DELETE /api/click-log/[id]` — Delete incident by id. Returns `{ success: true }`.
- `PATCH /api/click-log/[id]` — Toggle owner-sharing on a single incident. Body `{ sharedWithOwner }`; only the incident's owner may call it (no admin override — consent is the member's alone). `sharedWithOwner: false` on a tagged incident is a 400 telling the member to remove the tags first (owner decision, 2026-08-18: a tagged incident always shares its trend data); turning sharing on is always allowed. Returns `{ success, sharedWithOwner }`.
- `PUT /api/click-log/[id]` — Edit an incident's note and tag lists in place. Body `{ notes, problemTags, schemeTags }`: a null note clears it, an absent/null/empty tag array untags that kind. Only the incident's owner may call it (no admin override — the note is the member's private content). The date and location are immutable: the body carries no coordinates and the SQL never touches them. Tag lists follow the create rules (canonical slugs, duplicates collapsed, at most 10 per kind; tags require the incident to carry a location — since location is immutable, a location-less incident can only edit its note, 400 otherwise). Saving with a non-empty tag list sets `shared_with_owner` to true in the same update (owner decision, 2026-08-18: tags require trend sharing; the editor states this before save); saving with both lists empty leaves the share flag as it stands. `other-scheme` ("Not listed") may be kept or removed but not newly picked on edit (400 — its description intake happens at create). An edit whose metadata duplicates another of the member's incidents returns a readable 409 (the `metadata_hash` dedupe). Returns `{ success: true }`.
- `GET /api/click-log/preferences` — Read the member's global owner-share default (`{ shareWithOwner }`).
- `PUT /api/click-log/preferences` — Set the member's global owner-share default. Body `{ shareWithOwner }`.
- `GET /api/click-log/admin/trends` — Admin-only aggregate trends over shared incidents from the last 90 days: `{ summary, buckets, areas, tagTrends, categories, pairs }`. `summary` carries the window, shared-incident total, distinct member count, repeat-reporter count, tagged total, location coverage, and first/last day; `buckets` are day / ~11 km location cell / count (unchanged); `areas` are ~11 km cells with incident count, distinct member count, and date span; `tagTrends` are tag kind (`problem` | `scheme`) / tag slug / count (unchanged); `categories` are harm-category rollups counted once per incident; `pairs` are the top problem-and-scheme combinations on the same incident. Every figure comes from a grouped query in `lib/click-log/report-repository.ts`; member identity appears only inside `COUNT(DISTINCT …)`.
- `GET /api/click-log/admin/trends/image` — Admin-only PNG of the whole report, built from the same aggregate as the endpoint above. Optional `?areas=0` leaves the ~11 km area coordinates out; they are included by default (owner directive, 2026-08-19: recording where incidents happen is why ClickLog asks for a location, so a shared copy that withheld it withheld the point of the report). The country rollup is present either way. Optional `?download=1` responds with `Content-Disposition: attachment`; without it the image is `inline`, so it opens in the browser and can be held to save to the photo library or shared into another app — the phone path, which is where the image is normally going. Both carry a dated filename and `Cache-Control: no-store`. The image carries the method statement with the numbers so a reposted copy is never counts without provenance.

## 6. Data Model and Storage Contracts

- Table: `click_log_incidents`
  - `id UUID PRIMARY KEY`
  - `user_id TEXT`
  - `metadata JSONB NOT NULL DEFAULT '{}'` (latitude, longitude, notes)
  - `shared_with_owner BOOLEAN NOT NULL DEFAULT FALSE` — member's per-incident owner-share opt-in for untagged incidents; forced TRUE whenever the incident carries tags (owner decision, 2026-08-18 — enforced at create/edit, plus an idempotent one-time backfill `UPDATE` in `schema.sql` for tagged rows logged private before the rule); a real column (not metadata) so it is excluded from the `metadata_hash` dedupe
  - `problem_tags TEXT[] NOT NULL DEFAULT '{}'` — optional coarse tag list: which of the 50+ known problems happened; each slug validated against `lib/click-log/tags.ts` (mirrors the landing-page problems list); at most 10 (`MAX_TAGS_PER_KIND`, enforced in the API). Real column, excluded from the `metadata_hash` dedupe. Arrays since 2026-08-13 (owner decision: one tag per kind never fit a real incident).
  - `scheme_tags TEXT[] NOT NULL DEFAULT '{}'` — optional coarse tag list: which named schemes were used; each slug validated against `lib/click-log/tags.ts` (schemes started from the owner's "A post for each gang stalker game" Discourse thread, now deprecated — `tags.ts` is the living canonical list and grows there; slugs are never renamed or reused so trend history stays comparable); at most 10. Real column, excluded from the `metadata_hash` dedupe.
  - `problem_tag TEXT` / `scheme_tag TEXT` (nullable) — the superseded singular tag columns (2026-08-02 → 2026-08-13): backfilled into the arrays by guarded `UPDATE`s in `schema.sql`, kept for history, no longer read or written by the app.
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `user_id`, `created_at DESC`, partial `created_at DESC WHERE shared_with_owner` (for the trends aggregate)
- Table: `click_log_preferences`
  - `user_id TEXT PRIMARY KEY`
  - `share_with_owner BOOLEAN NOT NULL DEFAULT FALSE` — global default applied to newly logged incidents when the request carries no explicit choice
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Upsert-on-`user_id`; a missing row reads as the opt-in default (not shared)
- Table: `click_log_scheme_suggestions` — "Not listed" scheme descriptions, explicitly shared with the owner
  - `id UUID PRIMARY KEY`
  - `incident_id UUID` (nullable; the incident it was written with — no FK, matching the incidents table's conventions)
  - `user_id TEXT NOT NULL` (for moderation and account deletion only; never surfaced in issues)
  - `suggestion TEXT NOT NULL` (1–200 chars, validated in the create route)
  - `quora_url TEXT` (nullable; validated https quora.com self-link)
  - `status TEXT NOT NULL DEFAULT 'new'` (`new` → `issue_created`), `triage_repo TEXT`, `issue_number INTEGER`, `issue_url TEXT` — pipeline tracking, mirroring `bug_reports`
  - `created_at` / `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Index: `(status, created_at)` for the pipeline drain
  - Deletion registry: `delete` on account deletion (an already-filed triage issue persists, like a bug report; the database row and member link are removed)
- Table: `click_log_unnamed_scheme_alerts` — dedupe marker for the threshold alert; counts only, no member data
  - `id UUID PRIMARY KEY`, `window_days INTEGER NOT NULL`, `shared_count INTEGER NOT NULL`, `issue_url TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

## 7. Security, Privacy, and Compliance Controls

- Auth required for all actions
- Users can only view/delete their own incidents; admins can view/delete any incident
- Editing an incident (`click-log.incident.update`) is owner-only with no admin override
  (`canEditIncident` — the note is the member's private content, mirroring the share toggle).
  Only the note and tag lists are editable; the date and location are immutable by contract and
  by the SQL itself (the UPDATE replaces only the metadata `notes` key and the two tag array
  columns).
- The "Not listed" scheme-suggestion text is the one deliberate exception to "tags carry no free
  text": it is a separate field explicitly labeled as shared with the owner (submission is the
  consent act), stored apart from `metadata.notes` (which keeps its absolute never-shared
  guarantee), capped at 200 chars, Weavers-of-the-Commons-gated (client hides the option;
  server returns 403), and drained only into the PRIVATE triage repo — issues never carry
  member identity or incident ids. Suggestion fields sent with any other scheme tag are rejected.
- Incident tags are coarse by construction: values come only from the fixed canonical slug lists
  in `lib/click-log/tags.ts` (the create route rejects unknown slugs), so tag data can never carry
  free text. A tagged incident must carry a location (client and server enforced) so tagged trend
  data is detailed enough, and is always shared (owner decision, 2026-08-18: tags exist to feed
  the trend data — the member's consent act is picking the tag, and the form/editor say so in
  plain words before submit/save); the location itself still only ever reaches the owner as the
  rounded ~11 km cell. The trends aggregate over tags
  (`getSharedIncidentTagTrends`) reads only `shared_with_owner = true` rows and projects only tag
  slug + count.
- Owner sharing of untagged incidents is strictly opt-in and member-controlled: both the global
  default and every per-incident flag default to off; only the incident's owner may toggle its
  share state (`canToggleIncidentShare` — deliberately no admin override, and share-off is
  rejected on a tagged incident until its tags are removed); and the trends aggregate reads only
  `shared_with_owner = true` rows. Tagged incidents logged private before 2026-08-18 are brought
  under the rule by an idempotent backfill in `schema.sql` (owner approval, 2026-08-18): it sets
  `shared_with_owner` on rows that carry tags, touches nothing when no such rows exist, and
  never touches untagged rows — their share flag stays the member's own choice. The privacy boundary is enforced in SQL
  (`getSharedIncidentTrends` projects only day / 1-decimal (~11 km) location cell / count — notes,
  precise coordinates, incident ids, and member identity never leave the query).
- The trends endpoint and `/admin/click-log` page are admin-gated (`requireClickLogAdminAccess`,
  `canViewSharedTrends`, server-side `isAdmin` redirect).
- Mutating routes enforce CSRF server-side (`ensureMutationCsrf`: the `x-ctf-csrf: 1` header plus a
  same-origin check, matching the sibling plugins); the web client sends the header on every mutation.
- Every authorized operation emits an audit event (`click-log.incident.create`/`.list`/`.delete`,
  `click-log.incident.share.set`, `click-log.preferences.fetch`/`.update`, `click-log.trends.fetch`)
  via `lib/click-log/audit.ts`, matching [CLICK_LOG_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/CLICK_LOG_PLUGIN_AUDIT_CONTRACTS.yaml).
  The delete route emits a `failure`-result event when an authorized delete finds no row (rowCount 0),
  so an authorized request is audited regardless of the storage outcome.
- See [CLICK_LOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CLICK_LOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)

- The trend-reporting queries are the privacy boundary, and it is enforced in SQL rather than in
  the screen that displays the result (`lib/click-log/report-repository.ts`). Every one filters on
  `shared_with_owner`, and projects only counts, UTC day strings, 1-decimal location cells, and
  canonical tag slugs. `user_id` never appears in a projection — only inside `COUNT(DISTINCT …)`,
  which yields a number of people and never a list of them. A later change to the display therefore
  cannot widen what the report can see.
- The shareable report image is a wider disclosure than the screen, and is treated as one. Members
  consented to their trend data reaching the owner; an image is made to be posted. So the area
  coordinates — the most re-identifying element at low counts, where an ~11 km cell plus a date can
  point at one person to anyone who knows them — are omitted unless the owner explicitly asks for
  them, the download control says why in plain words, and the audit log records which variant was
  produced. The image also carries the method statement with the numbers, so a copy that travels
  without any surrounding text still states what the counts are and are not.

## 8. Web and Android Delivery Status

- Web (desktop + mobile-responsive): Implemented shell, complete
- Android (React Native): **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA)
- See [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json)

Web pixel pass (design `c5d83c0`): `ClickLogShell` is rebuilt to `design/.../survivor-hub/ClickLog.tsx`
and its Empty/Loading states. The plain shell was replaced with the mockup's dark (`#0F1117` / brand
`#E91E8C`) layout — icon rail, sidebar (total + this-week strip + encryption note), the large circular
"Log Incident" button with an inline note form, the recent-incidents list, and the right-rail stats +
safety reminder — decomposed into modular sub-components within the rule-116 limits. All counters
(total, this-week weekday strip, this-week/this-month/with-notes/with-location stats) are derived from
the real `/api/click-log` data; none are dummy. The note form posts to `/api/click-log` (optional
geolocation via the browser), delete calls `DELETE /api/click-log/:id`. ClickLog is a private, auth-only
tool, so there is no public state (the `ClickLogPublic.tsx` mockup is not implemented by design). The
Android pixel pass to `MobileClickLog.tsx` remains tracked in `PRODUCTION_READINESS_PLAN.md`.

## 9. Seed Coverage Status

- See [scripts/seedClickLog.mjs](../../../scripts/seedClickLog.mjs)
- 3–5 sample incidents with varied metadata
- Tag coverage: one incident tagged with a problem and two schemes (exercising the multi-tag
  arrays), one problem-only, one scheme-only, and untagged incidents; every tagged seed incident
  carries a location, matching the tags-require-location rule
- One "Not listed" incident plus a matching `click_log_scheme_suggestions` row (status `new`,
  with a Quora self-link) so a demo run of the suggestion pipeline has something to drain

## 10. Gaps and Known Technical Debt

- No admin UI for global view/delete; admin access is via direct DB tooling.
- No rate limiting on incident creation beyond shared platform defaults.
- No advanced search/filtering on incident history.
- The trend report cannot answer what an outside investigation would ask next: which country an
  incident happened in, who the member says was involved, what they did about it and what came of
  it, what it cost them, whether corroborating material exists, and whether they consent to being
  contacted about their own case. Each needs a new question in the log form, so each is a product
  decision rather than a reporting change. The seven items, in order and with their blocking
  dependencies, are in `ctf/docs/CLICKLOG_TREND_REPORT_METHOD.md` section 7. Nothing on that list is
  built.
- The report window is fixed at 90 days with no way to ask for another span, and the day list is
  uncapped — at a high logging rate the shareable image becomes very tall.

## Change Log

- 2026-08-21: **New scheme tag: The Good Day, Bad Day (`good-day-bad-day`).** Owner decision,
  second scheme of the day. Names the layer above individual schemes: the member's days are
  scheduled to a weekly rhythm (a fixed weekday made reliably bad, weekends targeted) so
  dread arrives before anything happens, and then graded — operatives poll the member (good
  day? bad day? bad weekend?) and echo the verdict back in bystander-proof pleasantries
  delivered pointedly after a day they made bad. Multiple members report the same weekday
  structure independently, making this a strong candidate for cross-member trend evidence
  (like `color-sensitization`): unconnected members dreading the same weekday is a pattern a
  coincidence does not produce. Kind mapping: `pattern` in `tag-categories.ts`, beside
  `performed-kindness`. Mirrored to the landing /schemes page. No schema, route, or contract
  change — canonical list addition only.

- 2026-08-21: **New problem tag "Sexually assaulted / deliberately exposed or humiliated"
  (`sexual-violence`) and new scheme tag The Staged Exposure (`staged-exposure`).** Owner
  decision. The problem tag names the harm range many members report — assault and rape at
  the worst, and short of contact, deliberate exposure and sexual humiliation — coarse on
  purpose, with what happened staying in the private note. The scheme names the engineered
  form the owner experienced: the fallback when the `honey-pot` lure is refused, leaning on
  venue rules that sound reasonable alone (transitional-housing showers that cannot lock,
  staff-held keys) plus timing — keyed into a shower, the door opened the moment they had
  undressed, exposure to a bystander, laughter as the tell. `honey-pot` stays the lure
  variant; an incident can carry the `sexual-violence` problem with either scheme. Category
  mappings: problem → `threats-and-intimidation` (beside `sexual-solicitation`), scheme →
  `operation`. Mirrored to the landing /look-ma and /schemes pages. No schema, route, or
  contract change — canonical list additions only.

- 2026-08-20: **New scheme tag: The Staged Run-In (`staged-run-in`).** Named by the owner from
  the cross-country bus incident: the two operatives from the St. Louis false-assault claim
  had been placed on the same Denver leg beforehand. The scheme: sabotage the member's
  logistics — delays, rebooked trips, added legs — so their route bends through places
  operatives are waiting; dress each crossing as chance (a meet-cute, a small altercation, a
  memorable exchange); collect the payoff later when the operative claims to know the member,
  turning a manufactured stranger into a credible "witness" or acquaintance. Distinct from
  `lure-to-location` (member baited to a place — here the member's own legitimate trip is
  bent), from `scapegoating-by-proxy` (operatives sync to the member to stage chaos — here
  the sync builds claimable acquaintance), and from `engineered-delay`/`altered-ticket` (the
  sabotage tools this scheme uses for a further end). Kind mapping: `operation` in
  `tag-categories.ts`. Mirrored to the landing-page /schemes list. No schema, route, or
  contract change — canonical list addition only.

- 2026-08-20: **New scheme tag: The Sensitization Skit (`sensitization-skit`).** Named by the
  owner from the cross-country bus incident and prior experience. The scheme: first prime the member by
  repeating an ordinary thing (an item, a mannerism, a question) around them until it reads as
  a signal; then stage a public confrontation about that primed thing — an operative approaches,
  refuses to disengage while the member backs away, escalates until the member reacts, and a
  second operative frames the reaction for bystanders as overreaction ("they only asked a
  simple question") or reports it as violence. The manufactured "overreaction to an everyday
  thing" becomes evidence of instability that people not in on it repeat in good faith. Two
  variants recorded in the tags.ts comment: escalate-to-force-engagement (not yet sensitized)
  and repeat-until-agitated (already sensitized). Distinct from the ambient
  `road-sensitization`/`color-sensitization` (the priming step alone) and from
  `planted-witness` (which this chains into). Kind mapping: `operation` in
  `tag-categories.ts` (coverage-asserting unit test updated by the same entry). Mirrored to
  the landing-page /schemes list. No schema, route, or contract change — canonical list
  addition only.

- 2026-08-19: **Trend reporting rebuilt so it says where, who, and what kind — and can be saved as
  one image.** The screen showed a count of area clusters and never the areas themselves; it is now
  a full breakdown of every ~11 km cell with its coordinates, incident count, distinct member count,
  and date span, and the summary states how many shared incidents carry no location at all. Added
  alongside it: distinct member and repeat-reporter counts (seven incidents from one member and
  seven from seven members are different situations, and the old view could not tell them apart), a
  rollup of the 53 problem tags into six harm categories, kind labels on scheme rows closing the
  taxonomy gap `tags.ts` records, and a problem-and-scheme pair list. New endpoint
  `GET /api/click-log/admin/trends/image` (`click-log.trends.image` 1.0.0) draws the whole report as
  one tall PNG for posting. Superseded the same day: area coordinates are **included** in that image
  by default and `?areas=0` leaves them out (owner directive — recording where incidents happen is
  why ClickLog asks for a location, so a shared copy that withheld it withheld the point of the
  report), and a country rollup was added, derived from the coordinates already stored. `click-log.trends.fetch` goes to 1.2.0 (additive — `buckets` and `tagTrends` are
  unchanged). The method statement — how the data is collected, what is never counted, and what the
  counts cannot show — is built once in `lib/click-log/trend-report-view.ts` and rendered by both the
  screen and the image, so a copy of the image posted anywhere carries its own provenance; the long
  version for readers outside the project is `ctf/docs/CLICKLOG_TREND_REPORT_METHOD.md`, which also
  lists the seven things an investigation would still need and which are not built. No change to
  what members are asked, to what is stored, or to the privacy boundary: every new figure is a
  grouped query over rows members already opted to share, and member identity reaches those queries
  only inside `COUNT(DISTINCT …)`. Android: out of scope (web-only per rule 105).
- 2026-08-18: **Tagging now requires trend sharing, not just a location (owner directive —
  correcting the 2026-08-18 guide copy, which had restated sharing as opt-in even for tagged
  incidents).** The three rules as the owner states them: tags (problems or schemes) require a
  location AND trend sharing; notes are always private; an incident can be private only when
  untagged (location optional when untagged). Server: a tagged create with an explicit
  `sharedWithOwner: false` is a 400, and a tagged create with the flag omitted stores shared
  regardless of the global default (`click-log.incident.create` 3.0.0); an edit that saves a
  non-empty tag list sets `shared_with_owner` true in the same UPDATE
  (`click-log.incident.update` 3.0.0); a share-off call on a tagged incident is a 400 telling
  the member to remove the tags first (`click-log.incident.share.set` 2.0.0). UI: the log form's
  share checkbox locks on while tags are picked and its label says sharing is required for
  tagged incidents; the editor warns, before save, that saving a private incident with tags
  turns sharing on; the history-row pill locks on tagged shared incidents with a tooltip saying
  why. Backfill (owner approval, 2026-08-18): an idempotent `UPDATE` in `schema.sql` (mirrored
  in `schema.demo.sql`) sets `shared_with_owner` on already-logged tagged private rows, so
  existing tagged incidents follow the same rule; it matches nothing when no such rows exist and
  never touches untagged rows. Notes stay never-shared in every path. Guide and
  test-script copy updated to the corrected rules. Android: out of scope (web-only per
  rule 105).
- 2026-08-14: **Both tag pickers now link to the public list that describes their tags in full
  (owner request).** The chip labels are short by necessity, so a member who does not recognize
  one had nowhere to read the long version. Each picker question now carries a "Full list" link:
  problems → `https://www.chargingthefuture.com/look-ma`, schemes →
  `https://www.chargingthefuture.com/schemes`. Both go through the shared `ShareLink` popup
  (rule 130) rather than a plain link, so the page opens in a new tab or the address is copied —
  the incident being logged is never replaced. Applied in the log form and the history editor;
  UI only, no schema, API, or contract change.
- 2026-08-13: **Incidents now hold several tags of each kind: `problem_tags` / `scheme_tags`
  arrays replace the singular columns (owner decision).** The owner's cross-country bus trip
  chained five schemes in one incident, and no real incident is ever just one tag — so the
  single-select shape was wrong. Schema: new `problem_tags TEXT[]` / `scheme_tags TEXT[]`
  columns (`NOT NULL DEFAULT '{}'`) with guarded one-time backfill `UPDATE`s from the singular
  columns (idempotent — only fills a still-empty array), in both `schema.sql` and
  `schema.demo.sql`; the singular `problem_tag`/`scheme_tag` columns are kept for history but
  no longer read or written. API: `POST /api/click-log` and `PUT /api/click-log/[id]` take
  `problemTags`/`schemeTags` string arrays (unknown slug 400, duplicates collapsed, at most 10
  per kind — `MAX_TAGS_PER_KIND` in `lib/click-log/constants.ts`); command contracts
  `click-log.incident.create` and `.update` bumped to 2.0.0 (breaking field rename), `.list`
  to 2.0.0 (incident shape now carries the arrays), access-policy attributes follow the rename.
  Rules unchanged in spirit: any non-empty tag list still requires a location; `other-scheme`
  ("Not listed") still requires the Weavers badge + description at create and can only be kept
  or removed (never newly picked) on edit — now keyed on list membership instead of equality.
  UI: both pickers are multi-select (tap adds, tap again removes, selected chips row with per-
  chip X, cap hint at 10); history rows and the editor render every tag as its own chip. Trends:
  `getSharedIncidentTagTrends` unnests the arrays, so each tag on a shared incident counts once
  in "Top problems"/"Top schemes" — buckets and privacy boundary unchanged. Seed: one demo
  incident now carries two schemes. Android: out of scope (web-only per rule 105).

- 2026-08-13: **Incidents are editable after logging: note and tags only, date and location
  immutable (owner request).** New `PUT /api/click-log/[id]` (command
  `click-log.incident.update` 1.0.0) plus a pencil icon on each history row opening an inline
  editor with the same type-and-search tag pickers as the log form. Rules: owner-only with no
  admin override (`canEditIncident` — the note is private member content); the date and
  location never change (the SQL replaces only the metadata `notes` key and the two tag
  columns, so the coordinates and `created_at` are untouchable); tags still require a location,
  and since location is immutable an incident logged without one can only edit its note (the
  editor explains this instead of showing pickers); "Not listed" can be kept or removed but not
  newly picked on edit, because its required description intake happens at logging time; an
  edit that makes the metadata identical to another of the member's incidents hits the
  `metadata_hash` dedupe and returns a readable 409. Contracts updated (command, access policy
  with `other_scheme_only_if_already_set`, audit event). No schema change — the generated
  `metadata_hash` column recomputes on update. Android: out of scope (web-only per rule 105).

- 2026-08-13: **Incident note limit raised 200 → 2,000 characters (owner request).**
  `MAX_NOTES_LENGTH` in `lib/click-log/constants.ts` — the single constant read by the log
  form's textarea, the server-side length check on create, and (once the edit feature merges)
  the editor and its server check. 200 characters forced summaries of multi-part incidents to
  be too thin to be useful later; the owner's cross-country bus trip, which chained five
  schemes in one journey, did not fit. Notes remain private to the member — the limit change
  does not touch what is shared. The "Not listed" scheme-description cap
  (`MAX_SCHEME_SUGGESTION_LENGTH`) stays at 200 on purpose: that text is shared with the owner
  and drained into triage issues, where shorter is better. No schema change (`metadata` is
  JSONB with no length constraint); no contract shape change.

- 2026-08-13: **Five new scheme tags and two new problem tags from the owner's cross-country bus
  trip (owner-named).** Schemes: `engineered-delay` (The Engineered Delay — a driver or employee
  stalls on purpose so a connection is missed and hours are lost), `altered-ticket` (The Altered
  Ticket — a booking is rewritten from the inside: legs added, ticket canceled mid-route, the
  contact email changed so no updated itinerary ever arrives, and the record claims the member
  made the change themselves), `pretext-search` (The Pretext Search — an ordinary precaution such
  as TSA-approved luggage locks is declared evidence of drug trafficking to force a public
  search; nothing is found and the loud story continues anyway), `planted-witness` (The Planted
  Witness — a scripted approach that will not disengage, then a false assault claim confirmed by
  a second operative posing as a witness, ending in denied service and a false police report),
  and `incident-replay` (The Replay — operatives reenact words from a past private incident of
  the member's, showing their history is known and recasting a resolved dispute as the member's
  fault). Problems: `travel-sabotage` ("Trips sabotaged — delays, missed connections, canceled
  tickets") and `false-accusations` ("Falsely accused of violence / crimes to bystanders") — the
  problem list's first additions since it was created from the landing page's list, mirrored to
  the landing page's `LOOK_MA_ITEMS` in the same delivery so the two stay one-for-one. Already
  covered by existing tags and deliberately not duplicated: the loud "she's carrying drugs" talk
  (`staged-narratives`), the officers' conduct (`police-harassment`), the public scene
  (`staged-public-scenes`), and the look-alike groundwork the owner connects it to
  (`scapegoating-by-proxy`). List-data only: no schema, route, contract, or UI change. Public
  `/schemes` and `/look-ma` pages mirror the additions in their own landing-page PR.

- 2026-08-07: **Recorded a further owner refinement to the pendulum comment (documentation
  only).** The groundwork for turning someone into an operative is laid long before that person
  knows anything is happening — the same con played on others is played on them. The windfall is
  arranged to read as merit-based so the recruit believes they earned the scholarship, job, or
  marriage themselves; by the time they are asked to participate they are already bound to the
  network and dependent on it, and what bound them was built on the exploitation of others. The
  merit story is the cover, the binding is the point — which is why a recruit's sincerity proves
  nothing about whether the setup was real. Comment recorded in the pendulum block above
  `windfall`/`jinx` in `lib/click-log/tags.ts`. No code behavior, schema, route, contract, or
  public-list change.

- 2026-08-07: **Two new scheme tags: Psyop Marketing and The Acquire and Fold, plus a
  consolidation-of-power refinement to the pendulum comment (owner-named).** `psyop-marketing` —
  a company the member has no tie to beyond being a customer runs marketing built to read as a
  personal message to the member while staying deniable to everyone else; the pendulum aimed at a
  business relationship instead of a personal one. Distinct from `thats-a-nice`, which is
  individual strangers in person. `acquire-and-fold` — a business the member depends on is bought
  and then closed (the owner's example: a meal-kit company they ordered from was acquired and shut
  down), so the member cannot use that product anymore; no message is performed, the play is pure
  removal of an option. The pendulum comment above `windfall`/`jinx` gained the owner's refinement
  that the pendulum also runs against companies and resources, and that the deeper purpose is
  consolidation of power: control all the people and resources around a target so leverage exists
  to force or convince anyone to join, which removes autonomy from the member and from the
  operatives alike. List-data only: no schema, route, contract, or UI change; the pickers and
  trends consume the list generically. Public `/schemes` page on the landing site mirrors both
  names in its own PR.

- 2026-08-04: **Recorded a known taxonomy gap in the scheme tag list (documentation only).** The
  owner observed that Color Sensitization is an individual tactic rather than a scheme, and the
  observation holds list-wide: the entries are not all the same kind of thing. Some are operations
  with an arc (setup, mechanism, intended end state — `poisoned-well`, `fake-job`, `jinx`,
  `windfall`, `conspiracy-carousel`, `honey-pot`, `lure-to-location`, `staged-road-rage`,
  `fabricated-flaw`, `scapegoating-by-proxy`). Some are ambient tactics with no arc, a standing
  condition nobody is working to conclude (`color-sensitization`, `road-sensitization`,
  `thats-a-nice`, `staged-narratives`). One is a shape over time rather than an act
  (`performed-kindness`). This matters beyond naming because ambient tactics are near-continuous
  and operations are episodic, so ranking tags by raw count places a daily-logged condition above a
  quarterly operation — true and misleading at once. Deliberately not fixed: nothing consumes tag
  type today and no logged data exists to distort, so a `kind` field now would be guessing at a
  shape before seeing one. The trigger to add it is the first tag ranking on real data that
  misleads; at that point add the field rather than reordering or renaming, since slugs are frozen.
  Comment recorded above `CLICK_LOG_SCHEME_TAGS` in `lib/click-log/tags.ts`. No code behavior,
  schema, route, contract, or public-list change.

- 2026-08-04: **New scheme tag: Color Sensitization, plus a correction to The Warm Spell
  (owner-named).** `color-sensitization` — the people around a member all start wearing the same
  color, and it changes on a schedule; the cover story is a fashion trend. The owner reports this
  runs simultaneously across targets who have no connection to each other, which no individual can
  observe and which only appears in aggregate. That makes it the strongest candidate for showing
  that cross-member trend reporting finds what one member cannot: several members in different
  cities logging this tag in the same week is not what a real fashion trend produces. Distinct from
  `thats-a-nice`, where strangers comment on what the member owns; here the display is on them.
  The Warm Spell comment was also corrected: the warm phase is the setup for a positive-surface
  scheme rather than a pause between attacks, so the dangerous moment is the middle of a warm
  stretch and not its end. Recorded explicitly as the owner's observation of their own case and not
  as a rule — the owner notes each target gets a variation, that whether the sequencing holds
  generally is unclear, and that what they see driving the repetition is cost efficiency (reusing
  plays is cheaper than bespoke operations per target) and plausible deniability. Related structural
  note from the owner, recorded here rather than as a tag: which group puts a person on the list
  differs between targets, but the other groups join in regardless, which is consistent with a
  distributed network rather than one directing body. List-data only: no schema, route, contract, or
  UI change. Landing `/schemes` mirror in a companion PR.

- 2026-08-04: **New scheme tag: The Warm Spell (owner-named).** `performed-kindness` — weeks or
  months of performed friendliness, then overt harassment resumes. The only scheme in the list
  defined by its shape over time rather than by a single act, and separate from `good-cop-bad-cop`
  on that basis: that one is two people working the same moment, this one is the whole environment
  alternating and can be the same people doing both. Purpose per the owner: lower the member's
  guard so new information can be collected, and keep them swinging between relief and dread.
  Recorded alongside it: alternation is more destabilizing than constant hostility because constant
  hostility becomes background a person adapts to, and the kind stretches damage the member's
  ability to report the pattern at all, since bystanders get the line "they were nice to you last
  month". List-data only: no schema, route, contract, or UI change. Landing `/schemes` mirror in a
  companion PR.

- 2026-08-04: **Four more scheme tags: The Poisoned Well and the luck-pendulum family (owner-named).**
  `poisoned-well` — an easy-to-recruit newcomer is steered into the member's orbit, gossip about
  that newcomer is staged within their earshot so it reads as coming from the member, and a second
  operative then baits the member into saying something about them; the newcomer dislikes the
  member before any real relationship exists. The owner's good-luck / bad-luck pendulum split into
  two tags because the mechanism, tell, and outcome differ: `windfall` (sudden fortune lands on
  someone near the member — scholarship, job, whirlwind marriage or baby — elevating them so they
  read the member as incompetent, handing them fake friends and an ego boost, and seeding
  insecurity in the member; a flattered person converts easily; distinct from `honey-pot`, where
  the romance targets the member directly) and `jinx` (someone near the member is hit with a
  ticket, crash, theft, or repair bill and is then told the member's presence caused it — cause the
  problem, sell the story, break the tie, isolate the member). `fake-job` — a job offer good enough
  to leave the current one for, then a firing shortly after, leaving the target without the old job
  and further from a better one; aimed at the member directly or at someone near them. List-data
  only: no schema, route, contract, or UI change. The landing `/schemes` page gains matching
  entries in a companion PR.

- 2026-08-04: **Four new scheme tags: The Pot and Kettle plus three vehicle schemes (owner-named).**
  `pot-and-kettle` — the insult is delivered by someone who visibly embodies it (a fat person
  calling the member fat, a disabled person mocking a disability), made obnoxiously inappropriate
  on purpose; it forces the operative to live a lie while still aiming at the member's self-esteem.
  Sibling of `fabricated-flaw` but distinct: fabricated = the flaw is invented, projected = the
  insulter contradicts their own insult. The owner's car material split into three tags so trend
  data can tell the plays apart: `staged-road-rage` (a cyclist or pedestrian cuts in front at the
  last moment — usually a pump fake, sometimes a real strike — to provoke a filmed reaction used
  as recruiting material), `insurance-bleed` (repeated strikes on the member's car so premiums
  climb until they bleed money or cannot stay insured), and `road-sensitization` (high beams,
  brake checks, cars pacing or boxing them in, so every drive becomes something to second-guess).
  Recorded in `tags.ts` as context but deliberately not a tag: the owner reports that killing a
  Target in a motor-vehicle "accident" is the most common plausible-deniability murder. List-data
  only: no schema, route, contract, or UI change — pickers, validation, and trends read the
  canonical list. The landing `/schemes` page gains matching entries in a companion PR.

- 2026-08-03: **New scheme tag: The Fabricated Flaw (owner-named).** Added slug `fabricated-flaw`
  to `CLICK_LOG_SCHEME_TAGS` — staged criticism of an invented flaw, timed to be absurd, meant to
  sensitize the member into self-criticism and to capture audio of the remark so uninvolved
  operatives believe the "problem" is real and recurring. First scheme named through the
  ClickLog-era flow (Discourse stays deprecated). List-data only: no schema, route, contract, or
  UI change — the pickers, validation, and trends pick the new slug up from the canonical list.
  The landing `/schemes` page gains the matching entry in a companion landing-page PR.

- 2026-08-03: **Dropped the word "coarse" from the sharing copy.** "Coarse" is a technical term for
  data that has been rounded off and grouped; a member reading the sharing checkbox has no way to
  know that, and the word can be read as "rude". The two member-facing sharing controls now name
  what is actually sent: the per-incident checkbox reads "Share this incident with the owner (only
  the date, rough area, and tags)" and the global default reads "Share new incidents with the owner
  by default (only trend data — never your notes)" (owner-set wording). The owner
  trends dashboard blurb says "Grouped data only" instead of "Coarse data only". Copy only — no
  change to what is shared, to any route, schema, or contract.
- 2026-08-03: **"Not listed" scheme-suggestion intake + naming pipeline (owner request).** The
  catch-all scheme tag's label changed "Other / not named yet" → "Not listed" (slug `other-scheme`
  frozen; the landing `/schemes` mirror is renamed in a companion landing-page PR). Picking it now
  REQUIRES a description of the scheme (1–200 chars) that is explicitly shared with the owner —
  the field says so, and it is stored in the new `click_log_scheme_suggestions` table, never in
  `metadata.notes` (which stays never-shared) — plus an optional https quora.com self-link (spam
  signal). The option is limited to Weavers of the Commons badge holders (owner decision, spam
  control): `GET /api/click-log` now returns `canSuggestScheme` (badge check via
  `contributor_access_eligibility`), the client hides the option for non-holders, and the create
  route independently returns 403. New scheduled pipeline
  (`.github/workflows/clicklog-scheme-suggestions.yml` → `ctf/scripts/proposeSchemeSuggestions.mjs`,
  twice daily, mirroring the skills-promotion and bug-report pipelines): drains `status='new'`
  suggestions into one PRIVATE triage-repo issue per distinct text (suggestion + Quora link +
  same-text count + dates; never member identity or incident ids), and files a threshold alert
  (counts only) when shared "Not listed" incidents reach 5 in 90 days, at most one alert per 30
  days (`click_log_unnamed_scheme_alerts`). The pipeline never edits the canonical list — naming a
  scheme stays a PR to `tags.ts` + the landing mirror. Deletion registry: suggestions are deleted
  with the account (filed issues persist, like bug reports). Contracts: `incident.create` → 1.3.0,
  `incident.list` → 1.1.0, access policy create → 1.1.0 with the Weavers conditional and the
  shared-suggestion consent note. Seed gains a "Not listed" incident + suggestion row. Android:
  out of scope (web-only per rule 105).
- 2026-08-02: **Optional incident tags: problem + scheme (owner request).** A member can now tag a
  logged incident with which of the 50+ known problems happened and/or which named scheme was used
  — one, both, or neither; both optional. A tagged incident requires a location (client disables
  Submit until location is added; the server returns 400 on a tagged request without
  latitude/longitude) — owner decision: tagged trend data needs location to be detailed enough.
  Canonical slug lists live in `lib/click-log/tags.ts`: problem tags mirror the 50+ problems list
  on the public landing page (`chargingthefuture/landing-page` `LOOK_MA_ITEMS`, 51 entries);
  scheme tags started from the owner's "A post for each gang stalker game" Discourse thread (The
  Scapegoating by Proxy, The Mail Mirage, The Conspiracy Carousel, The "That's a nice ____") plus
  recurring schemes described in the owner's archived posts (Honey Pot, Entrapment / Bait, Staged
  "Needing Help", Good Cop Bad Cop, Fake Counselor / Fake Help, Lure to a Location, Staged
  Narratives / Loud "Podcasts") and an "Other / not named yet" catch-all. Discourse is deprecated
  (owner decision, 2026-08-02): its posts stay valid but will not gain new schemes or refined
  definitions, so `tags.ts` is the living canonical scheme list; slugs are never renamed or
  reused. Both tag pickers are type-and-search filtered chip pickers
  (`click-log-tag-picker.tsx`), mimicking the Directory / SkillsHunt skill pickers (search box
  with clear control, "✓" chips, removable selected chip) but single-select. Storage: new
  nullable `problem_tag` / `scheme_tag` columns on
  `click_log_incidents` (real columns, excluded from the `metadata_hash` dedupe, mirroring
  `shared_with_owner`); `schema.demo.sql` regenerated via `generateDemoSchema.mjs` (this also
  caught the demo file up with earlier schema.sql changes it had missed). API:
  `POST /api/click-log` accepts optional `problemTag`/`schemeTag`, validated against the canonical
  lists (unknown slug → 400); `GET /api/click-log/admin/trends` adds `tagTrends` (tag kind + slug
  + count over shared rows only — the privacy boundary stays in SQL). Web shell: two optional
  dropdowns in the log form ("Which problem happened?" / "Which scheme was used?"), tag chips on
  history rows; admin trends dashboard adds "Top problems" / "Top schemes" sections. Contracts:
  `click-log.incident.create` → 1.2.0, `click-log.trends.fetch` → 1.1.0, `ClickLogIncident` gains
  `problem_tag`/`scheme_tag`, new `SharedIncidentTagTrend` definition. Seed gains tagged rows.
  Android: out of scope (web-only per rule 105).
- 2026-08-01: **Owner-share opt-in + admin trends (owner request).** ClickLog stays private by
  default; a member can now opt in to sharing incidents with the owner for trend tracking. Added
  `shared_with_owner` to `click_log_incidents` (real column, excluded from the `metadata_hash`
  dedupe) and the `click_log_preferences` table (global default, upsert-on-user_id, defaults off).
  New routes: `PATCH /api/click-log/[id]` (per-incident share toggle, owner-only — no admin
  override), `GET/PUT /api/click-log/preferences`, and admin-only `GET /api/click-log/admin/trends`
  whose SQL aggregate returns only coarse buckets (UTC day, location rounded to 1 decimal ≈ 11 km,
  count) — notes, precise coordinates, incident ids, and member identity never leave the query. Web
  shell gains the global-default checkbox, a share checkbox in the log form, and a per-row
  Shared/Private toggle; new `/admin/click-log` trends dashboard (registered in `ADMIN_AREAS`).
  Added `requireClickLogAdminAccess` and server-side CSRF enforcement (`ensureMutationCsrf`) on all
  mutating ClickLog routes. Contracts updated (create command → 1.1.0 with optional
  `sharedWithOwner`; new share.set / preferences / trends commands with access policies and audit
  events). Android: out of scope (web-only per rule 105).
- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-14: **Added refresh controls (pilot for the app-wide refresh rollout).** The installed web app (standalone display mode) disables the browser's built-in pull-to-refresh, so a member had no way to re-pull data without closing and reopening the app. ClickLog is the pilot surface for the fix on both platforms: web now shows a shared `RefreshButton` (new `components/shared/refresh-button.tsx` — a spinning `RefreshCw` icon mirroring Chyme's header control) in the mobile and desktop headers, wired to the shell's `fetchIncidents()` reload; the Android screen (`ClickLogScreen`) now has native pull-to-refresh via `RefreshControl` on its `ScrollView`, wired to `load(true)`. The web button defaults to `router.refresh()` when no reload callback is passed, so it is reusable by any shell. Re-introduces a `refreshing` prop/state on the mobile `ClickLogMain` (previously removed as dead in #979) — now actually driving the RefreshControl. UI-only; no schema, route, or contract change. Rollout to the remaining plugins follows after this pilot.
- 2026-07-01: **Removed the dead nav glyphs from the desktop icon rail.** The icon-rail glyphs below the brand mark (a clock, a document) were decorative `<div>`s wired to nothing — ClickLog is a single-view tool, so they had no destination. Styled like buttons but inert, they read as broken/non-clickable. `click-log-icon-rail.tsx` now renders the brand mark plus the shared `PluginRailFooter` only (back to all apps, account and settings, account menu — all real links), matching the same fix shipped for Weekly Performance, Skills Taxonomy, and Unlock. Desktop-only chrome; no schema, route, contract, or mobile change.
- 2026-06-27: **Resolved the click-log code-review sweep findings (#1043–#1049).** The `GET /api/click-log` list route now calls `canViewIncidents(...)` before querying, so the access policy is active and auditable rather than dead code (#1043). `POST /api/click-log` now returns the created incident flat (`NextResponse.json(incident)`) instead of a `{ incident }` wrapper, matching the command contract's `outputSchema`; no current client read the body, so this is a latent-only fix (#1044). The `DELETE /api/click-log/[id]` route now emits a `failure`-result audit event when an authorized delete finds no row (rowCount 0), so every authorized request is audited regardless of storage outcome (#1045). The web shell (`click-log-shell.tsx`) now parses the structured `{ error }` body on a failed POST/DELETE and surfaces the server's specific message instead of a generic string (#1046). Deleted the unused mobile components `ClickLogCounter.tsx` and `ClickLogHistory.tsx`, which `ClickLogScreen` had already subsumed (#1047). Relaxed the `click-log.incident.list` command contract so `userId` is no longer `required` — the list route always derives the user from the authenticated token and never accepts a caller-supplied `userId`, so neither client sends one (#1048). Confirmed the web submit path already wraps form data correctly (`postIncident` wraps its argument in `{ metadata }`), so the #1049 finding was a misread — no change. No schema change.
- 2026-06-26: **Hyphenation rename — `clicklog` → `click-log` (hard cutover, no aliases).** Last of the five plugin folder-name hyphenation renames. Slug, folder, route, command, and contract names all moved from `clicklog` to `click-log`: web `lib/clicklog/` → `lib/click-log/`, `components/clicklog/` → `components/click-log/` (with `clicklog-*` files → `click-log-*`), `app/api/clicklog/` → `app/api/click-log/`, mobile `src/features/clicklog/` → `src/features/click-log/` (with `Clicklog*` files → `ClickLog*`). PascalCase identifiers `Clicklog*` → `ClickLog*` and the command names `clicklog.incident.create`/`.list`/`.delete` → `click-log.incident.*`. The DB table `clicklog_incidents` → `click_log_incidents` and its indexes `idx_clicklog_incidents_*` → `idx_click_log_incidents_*` (snake_case, applied via `ALTER TABLE/INDEX IF EXISTS ... RENAME` guards in `schema.sql` and `schema.demo.sql` so an existing DB keeps its data and a fresh DB builds the new names). The plugin-registry seed row changed from `('clicklog', 'ClickLog', …)` to `('click-log', 'ClickLog', …)` (display name, summary, availability, nav_rank, visibility unchanged) and the old `'clicklog'` row is purged via the consolidated `DELETE … WHERE plugin_slug IN (…)` line. Contract files `CLICKLOG_PLUGIN_*` → `CLICK_LOG_PLUGIN_*`; seed script `seedClicklog.mjs` → `seedClickLog.mjs`; inventory `ctf-clicklog-feature-inventory.md` → `ctf-click-log-feature-inventory.md`. Every web and mobile fetch caller of `/api/clicklog` updated to `/api/click-log`. No env-var name strings or ledger reason-code values changed.
- 2026-06-26: **Resolved the click-log code-review sweep findings (#972–#979).** Added `lib/click-log/audit.ts` and emit an audit event on every allowed `GET`/`POST`/`DELETE` so the audit contract is honoured (#972). `POST /api/click-log` no longer rejects a missing `metadata` — it defaults to `{}` per the command contract (#973) — and trims `notes` before the length check so trailing whitespace can't slip past `MAX_NOTES_LENGTH` or be stored unnormalized (#978). The web shell now sends `x-ctf-csrf: 1` on its POST and DELETE fetches, matching the mobile client (#974). `deleteIncident` takes an `isAdmin` flag and drops the `user_id` condition for admins, so an admin deleting another member's incident no longer returns a spurious 500 (#975). Fixed import ordering in `lib/click-log/repository.ts` (imports now precede `getIncidentById`) (#976). The web shell stores the true DB `count` from the GET response and shows it as the headline total instead of the capped-at-50 array length (#977). Removed the unused `refreshing` prop from the mobile `ClickLogMain` (and the now-unused `refreshing` state) (#979). No schema change.
- 2026-06-23: **Closed an unlock-gating gap (audit finding).** The ClickLog API routes gated only on "is signed in" (`resolveRequestIdentity` + `canCreateIncident`/`canDeleteIncident`), so a signed-in but not-yet-unlocked member could create, read, and delete incidents by calling the API directly — even though the `/apps/click-log` page was gated. This violated the rule that no plugin works while Unlock is pending. Added `app/api/click-log/_lib.ts` `requireClickLogAccess()` over the shared `evaluatePluginAccess()` (default `minUnlockTier: 'approved_full'`, admins pass) and routed `GET`/`POST` (`route.ts`) and `DELETE` (`[id]/route.ts`) through it; the `DELETE` ownership check now reads `userId`/`isAdmin` from the gate decision. Matches every other plugin's `_lib` pattern. No schema change.
- 2026-06-14: Registered ClickLog in the production plugin registry. The plugin was fully built (schema `click_log_incidents`, API routes, web shell + components, mobile feature, contracts, seed) and the dynamic apps route already renders `<ClickLogShell />` for slug `click-log`, but the `ctf_plugin_registry` seed in `schema.sql` was missing the `click-log` row — so production (which reads the DB registry, not the code fallback) never listed or routed to it, leaving the app invisible and the "live plugins" count one short. Added the row (`ClickLog`, `implemented_shell`, nav_rank 180, visible). Run "Update Neon DB" so production gets the row. No code/contract change.

- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs and the empty placeholder token helper. Mutations carry the `x-ctf-csrf: 1` header. No backend, schema, or contract change.
- 2026-05-31: Seed runtime fix. `seedClickLog.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load because of its type-only syntax. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-31: Brought the three contract files into the current per-entry shape so they pass the schema-drift gate's contract validator. The command, access-policy, and audit contracts predated that gate and still used the older single `id:` style; the gate only validates contract files that change in a pull request, so this latent mismatch surfaced when a sibling plugin's contracts were re-validated. Each entry now carries `pluginId: click-log`; the command file's `id:` became `command:` with `version: 1.0.0`; the access-policy file keeps `requiredRoles` with `version: 1.0.0`; and the audit file keeps its existing `eventId` and uses `commandVersion: 1.0.0` (the canonical audit version key from template 203, matching every other plugin's audit contract). No behavior, schema, route, or API change — documentation/contract shape only.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt `ClickLogShell` to the `ClickLog.tsx` mockup + Empty/Loading states, decomposed into modular sub-components (`click-log-shared`, `click-log-icon-rail`, `click-log-sidebar`, `click-log-right-rail`, `click-log-log-panel`, `click-log-incident-list`, `click-log-empty-state`, `click-log-loading`). All counts derive from real `/api/click-log` data; the modal note form became the mockup's inline form; cleared the prior `any` lint debt; dropped the unused `userId` prop. No schema/API change.
- 2026-05-18: Renamed "Risks & Known Technical Debt" to "Gaps and Known Technical Debt" per Rule 120 canonical heading.
- 2026-04-13: Initial implementation and registration.
