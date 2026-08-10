# Trust Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Trust`
- Plugin slug: `trust`
- Owned surfaces: `/api/trust/*` routes, `trust_*` tables, `packages/mobile/src/features/trust` (Android), trust badge/evidence panels embedded in profile/directory surfaces (web).
- Not owned: canonical user profile (Directory), identity (Clerk), moderation backend (handled out-of-plugin via Retool tooling), and all upstream engagement/participation data (owned by the plugins Trust reads from, e.g. SocketRelay, login/auth, and other activity sources).
- Derived, read-mostly model: Trust owns no primary participation data. It derives a **qualitative** trust signal — never a numeric score — by aggregating engagement/contribution signals from across the platform's seeded plugins (not just Directory), and persists only the per-user extension (status/evidence) and the admin audit trail.
- Humane-by-design: Trust deliberately avoids reducing a person to a number. It communicates a likelihood/standing badge (e.g. how established and safe a member appears), not a ranked numeric score.

## Intent and Outcome

Trust gives the community a privacy-respecting, **non-numeric** way to gauge how established and safe a member is — i.e. the likelihood that they are a genuine, contributing participant rather than a bad actor — based on the material value and engagement they have contributed across the platform (for example: how often they log in, the number of SocketRelay trades/fulfillments they have completed, and their overall platform engagement). The signal is surfaced as a trust badge plus a supporting evidence panel and verification status on the user's profile. Admins can review/audit. Members do not control who sees their trust: the disclosure level is fixed in code, the same for everyone (owner spec, 2026-08-10).

## User Features

1. View their trust badge (qualitative standing, not a number), evidence panel, and verification status on profile/directory surfaces.
2. See, on their own Trust card (account hub, community right rail, own Directory profile), both
   what they have and what everyone else gets. The card body is two labeled sections: **"Your
   trust"** — every signal the member has — then **"What members see"**, which renders the exact rows
   any other member receives, using the same components that member's screen uses. Members cannot
   change this and there is no control on the card: what a member sees of someone else is decided in
   code, the same way for everyone, so trust cannot be hidden by the person it describes. The second
   section is there so a member is never guessing what is on show about them.
3. Inspect their own trust signal snapshot via `GET /api/trust/user/self`.

## Admin Features

1. Record a verification decision via `POST /api/trust/admin/verification` from the dedicated admin page at `/admin/trust` (`components/trust/trust-admin-shell.tsx`): enter a target user id, pick `verified` or `flagged`, optionally add a note; the decision appends an admin evidence item to the member's trust panel.
2. Update trust status (verified/flagged) for a target user.
3. All admin trust actions are captured in `trust_admin_audit_trail`.

## API Surface and Route Map

- `GET /api/trust/user/self` — Implemented. Recomputes the caller's trust signals before returning, so the panel reflects their current participation instead of a frozen snapshot that nothing refreshed. Calls `refreshTrustSignalSnapshot(userId)` (the same logic as `POST /api/trust/signal/snapshot`), persists a snapshot row, refreshes derived evidence, and returns the fresh `trust_user_extension`. Resilient: if the recompute throws, it falls back to the last stored extension so the member's own read never errors. Gated by server-side plugin authz (`evaluatePluginAccess`). The cross-user route stays a plain read (no recompute).
- `GET /api/trust/user/[userId]` — Implemented. Returns another member's trust panel at one of two disclosure levels, reported on the response as `trustDisclosure`, and the level is decided here in code rather than by any member setting: the owner (self) and admins receive `full`; **every other member receives `summary`** — headline counts only, with every timestamp and supporting detail dropped and the per-plugin participation items collapsed to a single "Took part in N plugins" breadth line (`lib/trust/peer-summary.ts`). No read is refused; there is no `403` visibility path, because hiding a member's participation from other members would defeat the point of the panel.
- `POST /api/trust/signal/snapshot` — Implemented. Recomputes the caller's trust signal (model `cross_plugin_engagement_v4`) from real cross-plugin engagement — login frequency from `login_events`; SocketRelay trades/requests; ServiceCredits received (distinct payers + undisputed completed transfers); per-plugin participation COUNTs across LightHouse, TrustTransport, SkillsHunt, LevelUp, Chyme, Directory, WhatWorks, PeerProgramming, Contributions, and Foundation (provider side); and the count of DISTINCT members with a confirmed recurring activity (`recurring_activities`, either side). Coarse COUNTs only; privacy-sensitive plugins (ClickLog, Mood, GentlePulse, Unlock, and the Foundation seeker side) are excluded — see the Trust Signal Model section. Persists a `trust_signal_snapshot` row and refreshes the caller's derived evidence. Never changes `trust_status`. CSRF-guarded; writes an audit row.
- `POST /api/trust/admin/verification` — Implemented. Admin-only (`evaluatePluginAccess({ requiredRoles: ['admin'] })`). Sets a target user's `trust_status` to `verified` or `flagged`, appends an admin evidence item, and writes an audit row. Validates `targetUserId` and `trustStatus` (`400` on bad input). CSRF-guarded.

## Data Model and Storage Contracts

- `trust_user_extension` — Per-user extension: `user_id`, `trust_status` (default `unverified`), `trust_evidence` (JSONB array, default `[]`), `trust_visibility` (default `public`, **dormant since 2026-08-10** — nothing writes it and no route reads it; kept to avoid a migration, to be dropped in a later schema pass), `updated_at`. No numeric trust-score column exists; the qualitative signal is derived from cross-plugin engagement, not stored as a number. `trust_evidence` is rewritten by the snapshot route (derived items) and appended-to by the admin verification route (one admin item).
- `trust_admin_audit_trail` — Audit log: `id` (UUID), `actor_user_id`, `command`, `policy_status`, `reason`, `target_user_id`, `request_id`, `metadata` (JSONB), `created_at`. Written by the snapshot and admin-verification routes, and by the trust panel reads (`trust.summary.read` on `GET /api/trust/user/self` and `GET /api/trust/user/[userId]`).
- `trust_signal_snapshot` — Append-only derived-metrics record: `id` (UUID), `user_id`, `snapshot` (JSONB metric bundle — login*, socketRelay*, serviceCredits*, and the v4 per-plugin participation counts including `recurringActivityCounterparties`), `snapshot_type` (model version, default `cross_plugin_engagement_v4`), `created_at`. Indexed on `user_id` and `created_at`. Stores raw counts only — never a numeric trust score. User-scoped; deleted on service/account deletion.

## Trust Signal Model (`cross_plugin_engagement_v4`)

Trust derives a **qualitative, non-numeric** signal by counting **real rows** in already-seeded
upstream plugins — it fabricates nothing. The snapshot route (`POST /api/trust/signal/snapshot`)
computes these counts for the caller, persists them to `trust_signal_snapshot`, and turns them into
human-readable evidence items on `trust_user_extension`. Real signals that feed the model:

- **Login frequency/recency** — from `login_events`: distinct login days (`loginDays`), total events
  (`loginEvents`), and the most recent sign-in (`lastLoginAt`). Evidence: "Active on N days".
- **Completed SocketRelay trades** — from `socket_relay_fulfillments`: closed fulfillments where the
  member was the requester or fulfiller (`socketRelayCompletedTrades`). Closing a fulfillment is how
  a SocketRelay exchange is finished, so a `closed` row is a genuinely completed trade. Evidence:
  "Completed N SocketRelay trades".
- **SocketRelay requests opened** — from `socket_relay_requests`: count of requests the member owns
  (`socketRelayRequestsOpened`). Evidence: "Opened N SocketRelay requests".
- **Paid by the community (ServiceCredits)** — from `service_credits_transfers`: distinct members who
  paid this member via a completed transfer (`serviceCreditsDistinctPayers`, counting distinct senders
  so one repeat payer can't inflate it) and the total completed transfers received
  (`serviceCreditsCompletedReceived`). Evidence: "Received ServiceCredits from N community members".
- **Clean ServiceCredits record** — from `service_credits_disputes`: disputes opened against the
  member's received transfers (`serviceCreditsDisputesAgainst`). The clean-record evidence
  ("N completed ServiceCredits transfers, none disputed") is shown only when there are completed
  received transfers and **zero** disputes. A dispute **withholds** this positive signal rather than
  producing a negative badge or a deduction — signal over noise, with dignity. The dispute count is
  kept in the snapshot metrics for the member's own and admin transparency, never surfaced publicly.

- **Per-plugin participation (v3)** — one coarse COUNT each, completed/accepted/claimed states only, so a
  member active in only one plugin is still seen (with less social proof than an all-plugins member, not the
  same). Each emits one categorical "verb N noun" evidence item:
  - LightHouse — `lighthouse_matches` accepted/completed → "Accepted N LightHouse matches"
  - TrustTransport — `trust_transport_trips` completed → "Completed N TrustTransport trips"
  - SkillsHunt — `skills_hunt_submissions` accepted → "Accepted N SkillsHunt submissions"
  - LevelUp — `level_up_enrollments` completed → "Completed N LevelUp cohorts"
  - Chyme — `chyme_room_members` → "Joined N Chyme rooms"
  - Directory — `directory_profiles` (`claimed_by_user_id`) → "Claimed N Directory profiles"
  - WhatWorks — `what_works_endorsements` → "Endorsed N WhatWorks products"
  - PeerProgramming — `peer_programming_cohort_members` → "Joined N PeerProgramming cohorts"
  - Contributions — `contributions_submissions` confirmed → "Confirmed N contributions"
  - Foundation (provider side only) — `foundation_connection_threads` where `provider_user_id` = the member → "Connected with N members as a Foundation provider". The **seeker** side (requesting services) is never counted — help-seeking is sensitive.
  - Recurring Activity — `recurring_activities` where the member is either party and `status='active'` (counterparty-confirmed) → "Ongoing activities with N community members". Counts **distinct counterparties** (a UNION de-duplicates the two directions), not raw activity count, so one repeated partner — or a ring confirming each other to inflate trust — cannot pump the signal. No amount and no counterparty identity ever crosses into Trust; only the coarse breadth count.

**Privacy exclusions (by design):** sensitive personal-wellbeing/verification plugins are **not** surfaced
as public trust evidence — **ClickLog** (safety incidents), **Mood** (mental-health check-ins),
**GentlePulse** (wellness), and **Unlock** (survivor-verification approval). Surfacing those would expose
what a member is going through; their activity is still reflected by the universal login signal. Plugins
with no per-member participation (Workforce, Weekly Performance, Feed/Announcements, Skills Taxonomy, GDP)
and Comic (fuzzy completion) are not applicable. **Foundation** surfaces the provider side only (seeker-side help-seeking is excluded for privacy).
**Member blocking and safety reports** (cross-cutting safety control, issue #809; `member_blocks`,
`member_safety_reports`) are **not applicable** and are **never** surfaced as Trust evidence — a block is a
private boundary the blocked person is never told about, and a safety report (suspected predator / human
trafficker) is sensitive safety/verification participation that must never become public evidence (rule
132). No numeric score, no count, no categorical signal is derived from either table.

Only coarse COUNTs are read (never amounts, balances, or sensitive per-row detail), so no money figure or
private detail crosses into Trust. Real-data-only rule: any signal whose backing rows are absent (count of
0 / no login) produces **no** evidence item, so the panel never claims activity that did not happen. No
numeric score is ever computed or stored. The snapshot route never changes `trust_status` (admin-controlled).

## Security, Privacy, and Compliance Controls

- Authentication on every route via `evaluatePluginAccess` (web Clerk headers or verified bearer token).
- Cross-user read (`GET /api/trust/user/[userId]`) sets the disclosure level in code, not from a
  member setting: the owner and admins read the full panel; every other member reads the summary
  projection (headline counts, no timestamps, no supporting detail, per-plugin items collapsed to one
  breadth line). No read is refused. The projection is the privacy control — it is what keeps a
  member's timeline and per-plugin record off other members' screens while still answering whether
  they take part. It lives in `lib/trust/peer-summary.ts`, is covered by
  `lib/trust/peer-summary.test.ts`, and fails closed — an evidence type it does not recognize is
  dropped rather than passed through.
- Admin-only gate on `POST /api/trust/admin/verification` via `evaluatePluginAccess({ requiredRoles: ['admin'] })`.
- Both mutation routes require the same-origin CSRF confirmation header and reject cross-origin
  mutations.
- Humane, privacy-respecting signal: Trust never exposes or persists a numeric score; evidence is
  built from aggregate counts without exposing the underlying per-plugin records to viewers.
- `logTrustAuditEvent` writes every snapshot and admin-verification mutation, plus every
  trust panel read (`trust.summary.read` on `GET /api/trust/user/self` and
  `GET /api/trust/user/[userId]`), to `trust_admin_audit_trail`
  with a request id. A failed audit write is reported but never changes the caller's response.
- No raw moderation evidence is exposed to non-admin callers.

## Web and Android Delivery Status

**Web: delivered (signal-only).** The live member-facing surface is the right-rail card `components/shared/trust/TrustRightRailCard.tsx`, which renders `components/trust/TrustWidgetCard.tsx` — an inline-styled widget aligned to `design/.../survivor-hub/Trust.tsx` (blue brand palette, ShieldCheck header, real `trustEvidence` list when present, an empty state with onboarding prompts, and, on the member's own card only, the read-only "What members see" section `components/trust/trust-member-view.tsx`, which renders the exact rows another member receives). Nothing on the card is editable: the disclosure level is fixed in the cross-user route. The evidence row, the summary note, and the section label live in `components/trust/trust-evidence-row.tsx` so the member's own list and the member-view section render the same components. It is consumed by `account-hub-shell.tsx`, `community-shell/shell-right-rail.tsx`, `directory-profile-detail.tsx` (own profile passes `isOwnCard`), and `lighthouse-host.tsx`. The admin surface is `/admin/trust` (`app/admin/trust/page.tsx` + `components/trust/trust-admin-shell.tsx`), a verification-review form over `POST /api/trust/admin/verification`, linked from the `/admin` landing. The signed-out marketing view is `components/trust/trust-public-shell.tsx`. The header has no Verified/Unverified status chip: the platform does not verify members, so Trust is signal-only and shows derived evidence, not a status badge. Per the real-data-only rule the design's verified-state signal buckets are omitted. Removed in the signal-only cleanup (2026-06-21): `TrustDirectoryProfilePanel.tsx`, `TrustEvidencePanel.tsx`, `TrustStatusBadge.tsx`, `TrustVisibilityBadge.tsx`, and the unused re-export `components/trust/TrustRightRailCard.tsx` — all dead after verification was dropped from the UI (no importers).

**Android: surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). Historical detail: `Trust.tsx` under `packages/mobile/src/features/trust` had been rewritten to align with `design/.../survivor-hub/MobileTrust.tsx`, `MobileTrustEmpty.tsx`, `MobileTrustLoading.tsx`, and `MobileTrustPublic.tsx`. A new `api.ts` binds to `GET /api/trust/user/self` for real data. The screen covers all four states: loading (branded taglines), public/unauthenticated (visitor marketing view), empty (no evidence yet), and populated (evidence list). `MockTrust.tsx` is retired. Real bindings: `trustStatus`, `trustVisibility`, `trustEvidence` array (type/summary/createdAt per item). Omissions per real-data-only rule: Last Active / Activity / Transactions / Active Plugins stats from the design's Trust Score card have no backing API field and are omitted; signal-progress percentage and hardcoded checklist items are omitted (snapshot route is a stub); visibility update dropdown rendered as display-only at the time of the pixel pass. The backend for signal derivation, visibility update, and admin verification is now implemented (2026-06-08); the web client is wired to the live visibility mutation as of 2026-08-04 (Android stays retired per rule 105).

## Directory Integration

Trust's primary user-facing surface is inside the Directory profile: a member's profile shows their trust badge (the qualitative "score"/standing indicator) alongside the Directory-owned profile fields. Trust reads Directory only for identity/profile context; the badge itself is computed from engagement across multiple plugins, not from Directory data.

## Seed Coverage Status

Trust has no dedicated seed script, and none is required. Trust is a derived plugin: the snapshot route computes its evidence by reading coarse engagement COUNTs from the other already-seeded plugins — `login_events`, `socket_relay_*`, `service_credits_*`, and the per-plugin participation tables listed in the Trust Signal Model section (LightHouse, TrustTransport, SkillsHunt, LevelUp, Chyme, Directory, WhatWorks, PeerProgramming, Contributions, and Foundation provider side). Seeding the upstream plugins is therefore sufficient to exercise Trust in dev: run `POST /api/trust/signal/snapshot` for a seeded member and the real counts populate `trust_signal_snapshot` and the member's derived evidence. Trust adds only the per-user `trust_user_extension` overlay (status/evidence/visibility), for which defaults are applied on first read, and the `trust_signal_snapshot` history (created on demand by the snapshot route). The demo seed (`seedDemo.mjs`, run via `seed:demo`) writes a placeholder `trust_user_extension` row for each demo participant so the panel shows something before the first recompute; those rows must use the canonical `TrustEvidenceItem` shape (`{ type, summary, createdAt, createdBy? }`) and a real `trust_status` (`unverified` | `verified` | `flagged`) — the snapshot/self-read path overwrites the evidence with derived items on first read.

## Gaps and Known Technical Debt

1. ~~Signal derivation is the intended model but not yet wired: `POST /api/trust/signal/snapshot` is a stub.~~ Resolved (2026-06-08) — the snapshot route computes real cross-plugin engagement, persists a `trust_signal_snapshot` row, and refreshes derived evidence.
2. ~~`POST /api/trust/visibility` and `POST /api/trust/admin/verification` are stubs.~~ Resolved (2026-06-08) — both implemented. `POST /api/trust/visibility` was then deleted on 2026-08-10 when the per-member visibility choice was removed; admin verification remains, admin-only, CSRF-guarded and audited.
3. ~~`GET /api/trust/user/[userId]` does not yet enforce the visibility setting.~~ Superseded (2026-08-10) — there is no visibility setting to enforce. The route requires authentication and serves the summary projection to every member other than the owner and admins.
4. ~~Mobile `Trust.tsx` renders mock data pending real API wiring.~~ Resolved — Android pixel pass complete (2026-05-31).
5. Trust evidence content is rendered from a structured JSONB field on `trust_user_extension`; no rich-text schema or attachment storage contract has been published.
6. No automated/scheduled refresh job exists for recomputing the derived signal — refresh is on-demand via the snapshot route (a future scheduled job could call the same logic).
7. The model counts engagement but does not yet expose a `member_since` or active-plugin-count signal; those design fields remain omitted per real-data-only until a backing source is wired.
8. ~~`restricted` and `private` are two names for one behavior.~~ Resolved (2026-08-07) — `restricted`
   now serves the summary projection to other members instead of refusing them, so the three choices
   produce three outcomes. See the change log entry for the disclosure rules.
9. The summary projection classifies evidence by `type` and fails closed, so a NEW signal added to
   `buildTrustEvidence` is dropped from the `restricted` view until it is deliberately listed in
   `PLUGIN_BY_EVIDENCE_TYPE` or `PASSTHROUGH_EVIDENCE_TYPES` in `lib/trust/peer-summary.ts`. That is
   the safe default for a disclosure boundary, but it does mean a new signal silently under-reports
   there — adding a signal means classifying it in the same change.
10. `trustStatus` is returned to peers at both disclosure levels, so a `flagged` status is in the
   payload of a public or restricted read even though no surface renders it (the widget has no status
   chip by design). Pre-existing on `public`; the summary projection did not widen it, but it is worth
   closing if the status is ever meant to stay admin-side.

## Change Log

- 2026-08-10: **The member no longer chooses; the code decides.** Owner correction against the
  approved spec: a member never sets what other members see of their trust. Trust exists so someone
  can tell whether the person in front of them is a real, participating member — a switch that let a
  member hide that removes the one signal the reader needs, and the account page's job was only ever
  to show a member their own view next to the member view. So: `GET /api/trust/user/[userId]` now
  serves the summary projection to every member other than the owner and admins, with no `403` path
  and no read of `trust_visibility`; `POST /api/trust/visibility` is deleted, along with
  `setTrustVisibility` / `updateTrustVisibility` and the route's entry in the orphan-route allowlist;
  the card's control is replaced by a read-only "What members see" section
  (`components/trust/trust-member-view.tsx`, renamed from `trust-visibility-control.tsx`) that
  renders the exact rows another member receives; `TrustWidgetCard`'s `editable` prop becomes
  `isOwnCard`, since nothing on the card is editable and the flag now only decides whether the
  comparison is drawn. The read-only "this member shares…" row on another member's card is gone —
  everyone shares the same thing, so there was nothing to state. Contracts updated:
  `trust.visibility.update` removed from the command, access-policy, and audit contracts;
  `disclosureLevels` restated as owner_or_admin/any_other_member; the deletion contract records
  `trust_visibility` as dormant. The column is left in place so this change needs no migration —
  nothing writes it and no route reads it; drop it in a later schema pass.

- 2026-08-09: **The card is two labeled sections and the dropdown is gone.** Owner direction: the
  block read as three different ideas stacked with nothing separating them — a heading, a dropdown
  whose closed line stood alone, an effect sentence, and a boxed preview with its own label. It is
  now **"Your trust"** (the signals, always all of them) above **"What members see"** (the choice and
  its result). The dropdown is replaced by three buttons that complete the heading — **Everything /
  A summary / Nothing** — so the three read as amounts of one thing rather than three concepts. The
  separate effect sentence is dropped: the two section labels carry what it said. The preview no
  longer carries its own "WHAT MEMBERS SEE" label (that text never appears on a member's screen) and
  no longer describes the result in prose — it renders the real evidence rows, and the summary note
  for "A summary", using the same components another member's screen uses, so it is exactly the copy
  they receive. The admin sentence is removed everywhere on this card per owner direction: nothing in
  the app is end-to-end encrypted, so admin access is a given and does not belong in this choice. The
  row shown on another member's card is unchanged. `TrustEvidenceRow`, the summary note, and the
  section label moved to `components/trust/trust-evidence-row.tsx` so the card and the preview draw
  the same components (rule 116). Presentation only: the stored values, routes, contracts, and schema
  are unchanged.

- 2026-08-09: **Each choice now names what is being shared.** Owner report: with the dropdown closed
  the selected line read "Only you see this" on its own, with the "Who sees your trust signals"
  heading above it easily scrolled past, so the member had no way to tell what "this" was. The three
  labels now name the subject — **"Members see all your trust signals"** / **"Members see a summary
  of your trust signals"** / **"Only you see your trust signals"** — and the same pointing words are
  removed from the private effect line ("No other member can see your trust signals"), the preview
  lines ("Every trust signal listed above, exactly as you see it." / "Nothing — your trust signals do
  not appear on your profile for them."), and the read-only row on another member's card ("This
  member shares all their trust signals" / "…a summary of their trust signals" / "…keeps their trust
  signals private"). Wording only: the stored enum values, routes, contracts, and schema are
  unchanged.

- 2026-08-08: **Plain-language names for the three choices.** Owner direction: the labels named a
  category and left the member to work out the category's rules, which is how the three were read as
  kinds of transaction in the first place. "Public" / "Restricted" / "Private" are now
  **"Members see everything"** / **"Members see a summary"** / **"Only you see this"** — each states
  who sees what, so the three read as one scale and nothing has to be inferred. Admins stay named in
  the effect line under the dropdown rather than in the label, so "Only you see this" is not a claim
  the app fails to keep. The read-only row on another member's card is relabeled from
  "Visible to: Public" to the same outcome stated from the viewer's side ("This member shares
  everything" / "This member shares a summary"), and is dropped from a peer's summary card where the
  note above the list already says it. The stored enum values are unchanged
  (`public` / `restricted` / `private`) — this is presentation only, no route, contract, or schema
  change. Also corrected an error in the previous entry's framing: this setting governs the trust
  panel and nothing else, so `private` was never a claim of platform-wide invisibility and the
  ungated presence list is not in tension with it.

- 2026-08-07: **`Restricted` became a real middle tier.** Owner direction: a member checking whether
  someone is an engaged participant should be able to see *something*, otherwise only admins can.
  Until now `restricted` was enforced identically to `private` — both `403` — so picking it hid
  everything from peers, the opposite of its purpose. `GET /api/trust/user/[userId]` now resolves
  visibility to a disclosure level instead of a single allow/deny: `public` serves the full panel,
  `restricted` serves a summary projection, `private` still refuses. The owner and admins always
  receive the full panel. The response carries `trustDisclosure` (`full` | `summary`) so the widget
  can label a summary as one rather than passing it off as the member's whole record.
  The projection (`lib/trust/peer-summary.ts`) follows two rules: no timestamps and no supporting
  detail survive (the login item's `details` carries the exact last sign-in, which is a record), and
  per-plugin participation collapses into a single "Took part in N plugins" line counting DISTINCT
  plugins — so a peer learns the member is active without learning what they did or where.
  Aggregate counts that are already coarse (sign-in days, the two ServiceCredits lines) pass through
  with their shipped wording unchanged; the projection never rewrites a summary string, so approved
  copy cannot drift there. It fails closed: an unrecognized evidence type is dropped.
  On the member's own card the visibility control now renders a "What other members see" preview
  built by calling the same projection function, so the preview cannot disagree with what peers
  actually receive — and changing the setting finally changes something on the owner's own screen,
  which was the root of the original "appears to change nothing" report. Option order runs
  Public → Restricted → Private so the dropdown reads as a scale. New tests:
  `lib/trust/peer-summary.test.ts` (8 cases) lock the disclosure boundary. Contracts updated:
  `trust.summary.read` gains the `trustDisclosure` output field and the access policy records
  `disclosureLevels`, replacing the `trust_visibility_restricted` deny condition with
  `trust_visibility_private`. No schema change — the stored enum is unchanged.

- 2026-08-07: **Visibility control says what it does.** Member report: the control was not noticed at
  all, and changing it appeared to do nothing — the member guessed their account simply had no
  "private and restricted transactions" yet, reading the three choices as kinds of transaction rather
  than as audiences. Both readings came from the control itself, not from the backend, which has
  enforced the setting since 2026-06-08. Extracted it from `TrustWidgetCard.tsx` into
  `components/trust/trust-visibility-control.tsx` (rule 116: the card is rendering, the control owns
  the one write call) and reworked the self-surface presentation: a heading, "Who can see your trust
  signals", above a full-width dropdown instead of a faint inline row that read as a status line; each
  choice names its audience ("Public — any signed-in member", "Private — only you and admins",
  "Restricted — only you and admins"); a sentence under it restates the effect of the current choice
  and says the member's own card always shows everything, which is why nothing moves on screen when
  the setting changes; and a "Saving…" → "Saved" confirmation replaces the silent write. `Restricted`
  now states plainly that it behaves the same as `Private` today — both resolve to owner-or-admin at
  `GET /api/trust/user/[userId]`, the only place visibility is enforced — rather than implying a
  members-only audience that is not built. Other-member cards keep the shipped read-only row
  unchanged. Copy and presentation only: no route, contract, schema, or enforcement change.

- 2026-08-04: **Inventory audit — two promised surfaces built.** (1) The visibility control is now
  live: `TrustWidgetCard`'s visibility row is a selector on self surfaces (right-rail card, account
  hub, own Directory profile) that POSTs `/api/trust/visibility` with rollback and a plain error
  message on failure; other-member cards keep the read-only row. (2) `POST /api/trust/admin/verification`
  now actually exists as a route: this inventory (and the contracts) had recorded it as implemented
  since 2026-06-08, but only the repository function `applyTrustAdminVerification` existed — no route
  file, no caller. Added the route (admin-gated, CSRF-guarded, validated, audited per
  `trust.admin.verification.review`) plus the missing admin surface `/admin/trust`
  (`trust-admin-shell.tsx`, linked from the `/admin` landing) so the route has a real caller.
  No schema change; contracts already declared both commands.

- 2026-07-19: **"Admin-reviewed verification" removed from the public landing's signal list
  (owner report: can be misinterpreted).** The bullet read as the platform vetting people, a claim
  this plugin deliberately never makes. Both the desktop and phone signal lists in
  `trust-public-shell.tsx` now list four signals (Quora social proof, ServiceCredits activity,
  Community connections, Cohort completion record). The underlying admin-set status itself is
  unchanged — only the marketing bullet is gone. Copy only.

- 2026-07-14: **Android pull-to-refresh on the Trust screen (`Trust.tsx`).** Dragging the empty or populated view down re-pulls `GET /api/trust/self` in the background without flashing the branded loading screen (the load function gained a background flag; the retry button reuses it). Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-14: Fixed odd trust evidence on the demo account. The demo seed (`seedDemo.mjs` `seedTrust`) wrote `trust_evidence` in a non-canonical shape (`{ type, date, source }` — no `summary`, no `createdAt`) and an invalid `trust_status` of `peer_verified`, so the account-hub `TrustWidgetCard` rendered a raw type slug (e.g. "Demo_second_owner") and "Invalid Date". Corrected the seed to write canonical `TrustEvidenceItem` rows (`type`/`summary`/`createdAt`/`createdBy`) with `trust_status: 'verified'` for both demo participants; re-running `seed:demo` overwrites the malformed rows. Hardened the renderers so a malformed or legacy item degrades gracefully: `TrustWidgetCard` now leads with the human `summary` (falling back to a humanized type instead of a raw slug) and only shows the date when `createdAt` parses (never "Invalid Date"); the mobile `Trust.tsx` and `TrustEvidencePanel.tsx` rows apply the same date guard, and `TrustEvidencePanel` drops the raw type-slug line in favor of the summary. No schema, route, or contract change.

- 2026-07-01: Throttle the recompute-on-read for `GET /api/trust/user/self` (#1271). The self read still recomputes the caller's signals so the panel is fresh on load, but the recompute now runs at most once per five-minute window per user: `readTrustSelfExtension` checks the newest `trust_signal_snapshot.created_at` (new `getLatestTrustSnapshotAt`), recomputes only when it is older than the window or none exists yet, and otherwise returns the stored extension without a write. This bounds the endpoint's DB writes so a cross-site forced GET can no longer drive unbounded snapshot inserts, without converting the endpoint to POST or breaking the three GET consumers (mobile `Trust.tsx`, web `directory-profile-detail.tsx`, `lighthouse-host.tsx`). The cross-user route and the explicit `POST /api/trust/signal/snapshot` refresh are unchanged. No schema or route-shape change.
- 2026-07-01: Code-review sweep fixes (trust plugin). `POST /api/trust/visibility` no longer accepts the undocumented legacy `visibility` body key — only the declared `trustVisibility` key is read, matching the command contract. `lib/trust/db.ts` now coerces the `trust_evidence` JSONB column defensively (parses a raw-text fallback, keeps an array, drops anything else to `[]`) everywhere it is read, so a driver that returns JSONB as a string can no longer leak a string to the client. Reconciled `TRUST_PROFILE_AND_DELETION_CONTRACT.md` with the shipped schema: the extension fields are `trust_status` (`unverified`|`verified`|`flagged`, default `unverified`), `trust_evidence` (jsonb, default `[]`), and `trust_visibility` (`public`|`private`|`restricted`, default `public`) — replacing the out-of-date `verification_status`/`trust_visibility_level` names and `standard`|`limited`|`hidden` enum. Mobile `TrustEvidencePanel.tsx` now imports `TrustEvidenceItem`/`TrustUserExtension` from `./api` instead of re-declaring divergent local interfaces, and adds a stable `key={\`${item.type}-${index}\`}` to each mapped evidence row. No schema or route-shape change.
- 2026-07-01: Audit the trust panel reads. Both read routes now write the contract-required `trust.summary.read` audit event to `trust_admin_audit_trail`: `GET /api/trust/user/self` logs an `allow` on the member's own read, and `GET /api/trust/user/[userId]` logs an `allow` on a permitted read (reason `self_summary_read`/`admin_summary_read`/`public_summary_read`) and a `deny` (`forbidden_visibility`) when the visibility gate rejects a cross-user read. Metadata carries `viewerUserId`/`subjectUserId`/`surface`. The audit write is wrapped so a failure is reported but never changes the caller's response. No schema, contract, or route-shape change — the audit event was already defined in `TRUST_PLUGIN_AUDIT_CONTRACTS.yaml`; this wires the reads to it.
- 2026-06-21: Refresh-on-read and dead-UI cleanup. `GET /api/trust/user/self` now recomputes the caller's signals before returning (calls `refreshTrustSignalSnapshot`, persists a snapshot, refreshes derived evidence) so a member's own panel reflects what they have actually done instead of a frozen snapshot that nothing refreshed; it falls back to the last stored extension if the recompute throws so the read never errors. The cross-user route `GET /api/trust/user/[userId]` stays a plain read (no recompute). Verified the three onboarding signals are backed by real reads already in `computeTrustSignalMetrics`/`buildTrustEvidence`: complete-your-profile by `directory_profiles.claimed_by_user_id`, use-a-plugin by the per-plugin participation COUNTs (LightHouse/TrustTransport/SocketRelay/Foundation and the rest), and first-transaction by the `service_credits_transfers` ledger reads. No new tables, no schema change, no model bump (the signal set is unchanged; `cross_plugin_engagement_v3` stands). Deleted dead trust UI left over after verification was dropped from the widget — no importers: `TrustDirectoryProfilePanel.tsx`, `TrustEvidencePanel.tsx`, `TrustStatusBadge.tsx`, `TrustVisibilityBadge.tsx`, and the unused re-export `components/trust/TrustRightRailCard.tsx`. `TrustWidgetCard.tsx`, the shared `TrustRightRailCard`, and `trust-public-shell.tsx` are still live and kept. Web typecheck clean.
- 2026-06-15: Platform-wide coverage — every applicable plugin now contributes a categorical Trust signal (#538), model `cross_plugin_engagement_v3`. Added 9 per-plugin participation signals (LightHouse, TrustTransport, SkillsHunt, LevelUp, Chyme, Directory, WhatWorks, PeerProgramming, Contributions), each a coarse COUNT of completed/accepted/claimed rows emitting one categorical evidence item; the evidence builder is data-driven so the set can grow without complexity. A member active in only one plugin is now represented (with less social proof than an all-plugins member, never the same). Privacy exclusions by design: ClickLog/Mood/GentlePulse/Unlock are not surfaced (sensitive personal-wellbeing/verification — covered by login instead). Foundation deferred (status enum). No numeric score. Bumped `TRUST_SNAPSHOT_MODEL` to v3; extended `TrustSignalMetrics`; updated the command contract (`trust.signal.snapshot.refresh` v1.2.0 + 9 tables added to dataAccess), the deletion contract, and the signal-model section. Added rule `132-trust-signal-coverage-rules.mdc` and a New Plugin Lifecycle Checklist item. No schema change. Web typecheck clean.
- 2026-06-15: Added ServiceCredits contribution signals to the model (`cross_plugin_engagement_v2`). The snapshot now also reads coarse COUNTs from `service_credits_transfers` (completed transfers received + distinct paying members) and `service_credits_disputes` (disputes against received transfers). Two new categorical evidence items: "Received ServiceCredits from N community members" (breadth) and "N completed ServiceCredits transfers, none disputed" (clean record). The clean-record signal is **withheld** when a dispute exists rather than producing a negative badge — signal over noise, with dignity. No amounts/balances are read and no numeric score is produced (reconciles the platform's no-credit/social-score commitment). Bumped `TRUST_SNAPSHOT_MODEL` to `cross_plugin_engagement_v2`; extended `TrustSignalMetrics`; updated command contract (`trust.signal.snapshot.refresh` v1.1.0, added `service_credits_transfers`/`service_credits_disputes` to dataAccess), the deletion contract metric bundle, and the signal-model section. No schema change (the snapshot JSONB absorbs the new fields). Web typecheck clean.

- 2026-06-12: The Android Trust API client (`packages/mobile/src/features/trust/api.ts`) now uses the shared authenticated fetch helper — the call to `GET /api/trust/user/self` carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against a hardcoded development URL.
- 2026-06-08: Implemented the trust backend (no stubs). `POST /api/trust/signal/snapshot` now computes the caller's signal from real cross-plugin engagement (login frequency/recency from `login_events`, completed SocketRelay trades from `socket_relay_fulfillments`, requests opened from `socket_relay_requests`), persists a `trust_signal_snapshot` row, and rewrites the caller's derived evidence — without changing `trust_status`. `POST /api/trust/visibility` validates against the visibility enum and persists the caller's setting. `POST /api/trust/admin/verification` is admin-only and sets a target's status to `verified`/`flagged` with an appended admin evidence note. `GET /api/trust/user/[userId]` now requires authentication and enforces `trust_visibility` (public open to members; private/restricted owner-or-admin). All mutations are CSRF-guarded and write `trust_admin_audit_trail` rows. Added `trust_signal_snapshot` table (real schema, IF NOT EXISTS pattern) and registered it as a user-scoped delete in the account deletion registry. Reconciled the command/access/audit/deletion contracts to the shipped surface (renamed `trust_signal_snapshots` → `trust_signal_snapshot`; replaced draft bucket fields/roles). Real-data-only: any signal with no backing rows yields no evidence; no numeric score is ever produced.
- 2026-05-31: Android pixel pass. Rewrote `Trust.tsx` to align to `design/.../survivor-hub/MobileTrust.tsx` (and Empty/Loading/Public variants). Added `api.ts` binding to `GET /api/trust/user/self` (real `trustStatus`, `trustVisibility`, `trustEvidence` fields). Retired `MockTrust.tsx`. Omitted per real-data-only: Trust Score stats (Last Active / Activity / Transactions / Active Plugins), signal-progress %, and hardcoded checklist items have no backing API field; visibility update rendered display-only (POST stub). All four states covered: loading, public, empty, populated. EOF, parity, and typecheck gates pass; tsc errors are pre-existing `expo/tsconfig.base not found` constraint only.
- 2026-05-30: Web pixel pass for the right-rail Trust widget. Added `TrustWidgetCard.tsx` (inline-styled, aligned to `design/.../survivor-hub/Trust.tsx`) and wired the shared `TrustRightRailCard` to it; removed the now-unreachable `compact` branch from `TrustEvidencePanel`. Per real-data-only: omitted the design's unbacked verified-state signal buckets (rendering the real `trustEvidence` list instead) and rendered the non-functional Request-Verification CTA / visibility dropdown as truthful static affordances (both backing routes remain stubs). No schema/route/contract changes.
- 2026-05-20: Corrected the trust model — Trust derives a **qualitative, non-numeric** trust signal/badge (deliberately not a numeric score, on humane grounds) indicating the likelihood a member is a genuine, safe participant, based on engagement/contribution aggregated across the platform's seeded plugins (e.g. login frequency, SocketRelay trades, overall engagement), not just Directory. This is why Trust needs no seed script of its own (it reads from already-seeded plugins). Documented the Directory integration (badge surfaced on the profile). Fixed the API surface (`POST /api/trust/visibility`, not `PUT`) and marked the snapshot/visibility/admin-verification routes as stubs; corrected delivery status from "web+android complete" to "shells delivered, backend logic pending"; noted the unguarded cross-user read and mobile mock data.
- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "future phase" framing and "No mobile implementation yet" entry (Android features exist under `packages/mobile/src/features/trust`). Replaced placeholder command list with actual routes. Removed `trust_signal_snapshots` table (not present in `ctf/schema.sql`).
- 2026-03-25: Initial inventory created for Trust plugin rewrite MVP.


## Build Checklist


### MVP Completion Checklist

- [x] Profile/deletion contract drafted and registered
- [x] Command, policy, and audit contracts drafted
- [x] Migration SQL for trust tables delivered
- [x] Feature inventory created in required folder
- [x] Shared Trust React components implemented
- [x] Right-rail and Directory profile UI surfaces wired up
- [x] API routes and backend logic for trust commands
- [x] Policy enforcement and audit logging
- [ ] Seed script for plugin validation (not required — Trust reads from already-seeded plugins)
- [x] Mobile parity (Android pixel pass complete)

### Notes
- All compliance and modularity rules followed per product instructions.
- Update this checklist as features are completed or deferred.
