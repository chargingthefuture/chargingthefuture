# Member Presence and Trust-on-Profile Feature Inventory (CTF v3)

## Scope and Boundary

A read-only, cross-plugin index that records where each member is active across the app, surfaced on
the Directory provider profile as an "Also active in" section, with the member's trust card shown
beside it. This is not a standalone plugin with its own routes-and-admin surface; it is a shared index
(`member_plugin_presence`) plus one read API and a Directory profile surface. The index is owned and
written by the source plugins (for this first cut, by a one-time backfill); Directory only reads it.

Live per-plugin write hooks now keep the index current in real time for LightHouse property listings,
TrustTransport ride requests, Foundation provider offerings, and SocketRelay posts: the source plugin
writes presence as the listing is created, updated, closed, or removed, so the index no longer waits on
the periodic backfill for those sources. The one source still on the backfill only is the TrustTransport
ride offer (the driver offer), because it has no create or remove path in the web app — see the
deferred follow-up below.

Out of scope for this first cut, recorded as deferred follow-ups in the Build Checklist below:
the TrustTransport ride-offer write hook (no web create/remove path exists yet), and presence/trust
badges on other interaction surfaces (Commons post author, LightHouse host, TrustTransport driver,
Foundation provider).

## Intent and Outcome

When a member looks at another member's Directory provider profile, they should see where else that
member takes part in the community, and how trusted that member is, in one place. The outcome is a
single "Also active in" list of tappable links into the plugins where that member has listings, with
the existing trust card rendered next to it so trust reads as peer social proof in context.

## Owner-Locked Decisions

- Presence uses a shared index that each plugin writes to — not direct per-plugin queries from
  Directory. The index was first populated by a one-time backfill from existing listings; live
  per-plugin write hooks now keep it current as listings are created, closed, and removed (for all
  sources except the TrustTransport ride offer, which has no web create/remove path yet).
- Nothing is public in this app, so any listing a member has counts as presence. There is no
  public/private gate on a presence entry.
- Presence and the trust panel apply only to claimed profiles (a profile whose
  `directory_profiles.claimed_by_user_id` is the member's user id). Unclaimed profiles show neither.
- Presence sources for this first cut: LightHouse property postings, TrustTransport offers and
  requests, Foundation provider offerings, and SocketRelay posts the member created.

## Architecture

- One shared table, `member_plugin_presence`, holds one row per member-owned listing.
- A repository (`lib/presence/repository.ts`) exposes a read (`getMemberPresence`) and an idempotent
  write pair (`upsertMemberPresence` / `deactivateMemberPresence`). The write pair is used by the
  backfill and by the live per-plugin write hooks.
- A best-effort wrapper (`lib/presence/live.ts`) exposes `recordMemberPresence` and
  `clearMemberPresence`, which each source plugin's repository calls after a listing row is durably
  committed. The wrapper swallows and reports any presence-write failure (a missing presence table on a
  fresh deploy, a transient database error) so a presence write can never break, roll back, or delay
  the listing operation that triggered it. Each source mirrors the exact label and deep link the
  backfill uses, so live writes and the backfill produce identical rows.
- Live write hooks by source (in each plugin's `repository.ts`):
  - LightHouse: `createProperty` / `updateProperty` record presence when the property is active and
    clear it when inactive; `deleteProperty` clears it. Keyed on `host_user_id`.
  - TrustTransport requests: `createRequest` records presence; `updateTripStatus` and `cancelOrder`
    clear it when the request reaches a terminal status (and re-record otherwise). Keyed on
    `requester_user_id`. The accepted/assigned states still count as active, matching the backfill.
  - Foundation: `setOwnOfferedSkills` records one presence row per currently offered skill and clears
    any skill dropped from the set. Keyed on `user_id`, ref id = skill id.
  - SocketRelay: `createRequest` and `repostRequest` record presence (status open); `claimRequest`,
    `resolveFulfillment` (on close), and `adminDeleteRequest` clear it; `updateRequest` re-syncs to the
    post's current status. Keyed on `owner_user_id`.
- A read API (`GET /api/presence/user/[userId]`) returns the active presence list for a member,
  gated to any signed-in member.
- A self re-derivation (`lib/presence/derive.ts` → `refreshOwnPresence`) rebuilds one member's index
  straight from the same source tables the live hooks and the original backfill used, then returns the
  active list. It is best-effort and self-contained: a source whose table is missing or unavailable is
  skipped (its existing index rows are left untouched, never deactivated), so the recompute can only
  add back missing rows and retire rows whose source listing is genuinely gone — it can never wipe the
  index because of a transient read failure. Exposed at `GET /api/presence/user/self`.
- The Directory profile detail (a client component) fetches presence and trust for the profile's
  `claimed_by_user_id` and renders the "Also active in" section and the trust card beside it. For the
  viewer's own profile it reads the refreshing `self` routes so both panels reflect the member's real
  current activity instead of a frozen index/snapshot; for another member's profile it reads the
  read-only by-id routes.

## Trust-beside-presence Decision

The trust card sits inside the same "Also active in" section, directly beneath the presence list, so
a viewer reads "where this member is active" and "how trusted this member is" together. The Directory
detail reuses the existing dark, inline-styled `TrustWidgetCard` (it matches the Directory surface),
fed by the existing `GET /api/trust/user/[userId]` route. The route's gating is honored as-is:

- Public trust (the default) renders the card.
- A 403 (the member set their trust to private or restricted, and the viewer is not the owner or an
  admin) renders a calm "This member limits who can view their trust" note, not an error.
- Any other failure hides the trust panel.
- Unclaimed profiles fetch neither presence nor trust.

## Presence Sources

A one-time backfill read each source below and upserted one presence row per listing to seed
`member_plugin_presence` from data that existed before the live write hooks shipped. It was idempotent
(INSERT ... ON CONFLICT DO UPDATE on the unique ref index). It has been run and its script
(`scripts/backfillMemberPresence.mjs`) and the `Backfill Member Presence` GitHub Action have since been
removed — going forward the live per-plugin write hooks keep the index current. The table records the
source mapping the backfill used, which the live hooks mirror exactly.

| Source | Table | Member user-id column | Active filter | Slug / deep link | ref_type | Label |
|---|---|---|---|---|---|---|
| LightHouse property postings | `lighthouse_properties` | `host_user_id` | `is_active = TRUE` | `lighthouse` / `/apps/lighthouse` | `property` | Housing listing |
| TrustTransport ride requests | `trust_transport_requests` | `requester_user_id` | status not terminal | `trust-transport` / `/apps/trust-transport` | `request` | Ride request |
| TrustTransport ride offers | `trust_transport_offers` | `provider_user_id` | status not terminal | `trust-transport` / `/apps/trust-transport` | `offer` | Offering rides |
| Foundation provider offerings | `foundation_provider_skills` | `user_id` | none (a row means offering) | `foundation` / `/apps/foundation` | `provider-skill` | Provider offering |
| SocketRelay help posts | `socket_relay_requests` | `owner_user_id` | `status = 'open'` | `socket-relay` / `/apps/socket-relay` | `post` | Help post |

Notes on sources:

- No source was skipped. Every source named in the task mapped cleanly to a member user-id column.
- Foundation rows have a composite primary key `(user_id, skill_id)` and no per-row UUID, so the
  backfill uses `skill_id` as `ref_id`. The deep link is the plugin home; the label is a fixed
  "Provider offering".
- TrustTransport `status` is a free-text column with no schema-level enum, so active filtering is done
  defensively by excluding terminal states (canceled / completed / closed / withdrawn /
  declined / expired / rejected) rather than guessing the exact active set.
- A missing source table in a given environment was logged and skipped by the backfill; the other
  sources still ran.

## API Surface and Route Map

- `GET /api/presence/user/[userId]` — returns `{ presence: Array<{ pluginSlug, refType, refId, label,
  deepLink }> }` for the member, active rows only, ordered by plugin then label. Gated to any
  authenticated member (`requireTrustMemberAccess`). Read-only; reads the shared index as written by
  the live hooks. Used when a member views **another** member's profile.
- `GET /api/presence/user/self` — re-derives the **caller's** presence from the live source tables
  (`lib/presence/derive.refreshOwnPresence`), self-healing any index row a best-effort write dropped
  or that predates the live hooks, then returns the active list in the same shape. Gated to any
  authenticated member. This is the presence counterpart of `GET /api/trust/user/self`, which
  recomputes the caller's trust signal on read. Used when a member views **their own** profile.

The Directory profile read is unchanged at the API level: the detail component already receives the
profile's `claimedByUserId` from the list payload, so presence and trust are fetched client-side from
that id rather than embedded in a directory route. When the viewer owns the profile, the detail reads
the refreshing `self` routes for both presence and trust; for another member's profile it reads the
read-only by-id routes.

## Data Model and Storage Contracts

Table `member_plugin_presence` (owned by the source plugins; read by Directory):

- `id` UUID primary key, default `gen_random_uuid()`
- `user_id` TEXT not null — the member who owns the listing (matches `claimed_by_user_id`)
- `plugin_slug` TEXT not null — the source plugin (e.g. `lighthouse`)
- `ref_type` TEXT not null — the kind of listing within that plugin (e.g. `property`, `offer`)
- `ref_id` TEXT not null — the source row id (UUID-as-text, or `skill_id` for Foundation)
- `label` TEXT not null — short human label shown in the list (e.g. "Housing listing")
- `deep_link` TEXT not null — the in-app link into that plugin (e.g. `/apps/lighthouse`)
- `is_active` BOOLEAN not null default TRUE
- `created_at`, `updated_at` TIMESTAMPTZ not null default NOW()

Indexes:

- unique `(user_id, plugin_slug, ref_type, ref_id)` — supports idempotent upsert and prevents
  duplicate presence rows
- `(user_id)` — supports the per-member read

Created with the `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`
(with a default on every ALTER) pattern; `schema.demo.sql` regenerated.

## Security, Privacy, and Compliance Controls

- The read API is auth-gated to any signed-in member. Nothing in this app is public, so any listing a
  member already chose to post counts as presence; there is no separate per-entry visibility gate.
- Trust beside presence honors the existing `GET /api/trust/user/[userId]` gating: private/restricted
  trust returns 403 and the surface shows a calm note rather than leaking the trust details.
- No new contracts are required for a read-only cross-plugin index that mirrors rows the source
  plugins already own. No command, access-policy, deletion, or audit contract is added here. When live
  per-plugin write hooks are built, they should be covered by the source plugin's own contracts (a
  write hook is part of that plugin's listing lifecycle), and presence rows should be removed in that
  plugin's deletion scope.

## Web and Android Delivery Status

- web: shipped — "Also active in" section and trust card on the Directory provider profile detail.
- mobile-responsive: shipped — the same Directory detail renders at phone width (the detail is a
  single-column layout).
- android: deferred — no React Native Directory profile presence surface in this first cut.

## Seed Coverage Status

No dedicated deterministic seed. A one-time backfill (since run and removed) populated the index from
whatever real listings existed in the target database; from here the live per-plugin write hooks keep
it current, so presence coverage follows the real data of the source plugins.

## Gaps and Known Technical Debt

- Presence for LightHouse, TrustTransport requests, Foundation, and SocketRelay is now written live as
  listings change, so it no longer waits on the backfill. The TrustTransport ride offer (driver offer)
  is the one source still backfill-only: there is no web create or remove path for an offer (offers
  appear only via seed scripts in the current code), so there is nothing to hook. If an offer
  create/remove path is added later, wire `recordMemberPresence` / `clearMemberPresence` on
  `provider_user_id` with the same `offer` ref type and "Offering rides" label the backfill uses.
- Presence writes are best-effort and not part of the listing's database transaction: a presence write
  that fails after the listing commits is logged and dropped, leaving the index momentarily out of date
  until the next write. This is intentional — the listing operation must never fail because of a
  presence write. The backfill that used to recover such gaps was removed, so recovery now comes from
  `refreshOwnPresence`: a member viewing their own profile re-derives their presence from the source
  tables, restoring any dropped or pre-hook row. A member who never views their own profile can still
  have a gap until their next live write; a future pass could re-derive on a broader trigger (e.g. on
  login) if needed.
- Foundation presence is one row per offered skill, labeled generically; if a member offers many
  skills this could read as several identical "Provider offering" entries. A future pass could collapse
  Foundation to a single per-member entry.
- TrustTransport active filtering uses a deny-list of terminal statuses because the status column has
  no schema-level enum; if a new terminal status is introduced it must be added to the backfill list.

## Build Checklist (flat, ordered; dependency-named — no phases)

1. Add `member_plugin_presence` to `schema.sql` (CREATE + ALTER-with-defaults), unique and user-id
   indexes; regenerate `schema.demo.sql`. Done.
2. Presence repository: read + idempotent upsert/deactivate helpers. Blocked by task 1. Done.
3. Backfill script reading the five sources and upserting presence rows. Blocked by task 2. Done.
4. Read API `GET /api/presence/user/[userId]`, member-gated. Blocked by task 2. Done.
5. Directory profile detail: "Also active in" section + trust card beside it, claimed-only, with the
   private-trust calm state. Blocked by task 4. Done.
6. This inventory doc. Done.

7. Live per-plugin write hooks: each source plugin calls the best-effort `recordMemberPresence` when a
   listing is created/updated and `clearMemberPresence` when it is closed or removed, keeping the index
   current without waiting on the periodic backfill. Done for LightHouse property listings,
   TrustTransport ride requests, Foundation provider offerings, and SocketRelay posts.

Deferred follow-ups (not yet done):

8. TrustTransport ride-offer write hook: the driver offer is the one presence source with no live hook,
   because the web app has no create or remove path for an offer (offers exist only via seed scripts).
   The one-time backfill seeded any existing offers; new offers will not be indexed until such a path is
   added, at which point wire the same record/clear hooks on `provider_user_id`.
9. Presence/trust badges on other interaction surfaces: the Commons (SocketRelay) post author, the
   LightHouse host, the TrustTransport driver, and the Foundation provider — so presence and trust are
   visible where members actually meet, not only on the Directory profile.

10. Self re-derivation on own-profile view. Added `lib/presence/derive.ts` (`refreshOwnPresence`) and
    `GET /api/presence/user/self`; the Directory detail reads the `self` route for the viewer's own
    profile so a dropped or pre-hook index row is restored from the source tables on read. Done.

## Change Log

- 2026-06-21: First cut. Added `member_plugin_presence`, the presence repository, the backfill script,
  the read API, and the "Also active in" + trust surface on the Directory provider profile. Live write
  hooks and other-surface badges deferred.
- 2026-06-21: Live per-plugin write hooks. Added `lib/presence/live.ts` (best-effort
  `recordMemberPresence` / `clearMemberPresence` that swallow and report failures so a presence write
  can never break a listing operation). Wired the source plugin repositories to write presence as
  listings change: LightHouse (`createProperty` / `updateProperty` / `deleteProperty`), TrustTransport
  ride requests (`createRequest` / `updateTripStatus` / `cancelOrder`), Foundation
  (`setOwnOfferedSkills`), and SocketRelay (`createRequest` / `updateRequest` / `repostRequest` /
  `claimRequest` / `resolveFulfillment` / `adminDeleteRequest`). Each write mirrors the backfill's exact
  label and deep link. The TrustTransport ride offer remains backfill-only: there is no web create or
  remove path for an offer to hook. No schema change.
- 2026-06-21: Removed the one-time backfill. The owner ran the `Backfill Member Presence` GitHub Action
  to seed `member_plugin_presence` from existing listings, so the script (`scripts/backfillMemberPresence.mjs`)
  and the `.github/workflows/backfill-member-presence.yml` action have been deleted — the live write
  hooks keep the index current from here. The four source repositories' comments that pointed at the
  deleted script were reworded to describe the active-state rules inline. No code behavior or schema
  change.
- 2026-06-25: Own-profile activity now reflects real participation on read. Two surfaces showed empty
  even for an active member: the "Also active in" list (the index had no row — a best-effort write was
  dropped or the listing predated the live hooks, with the backfill gone) and the Trust card (the
  Directory detail read the non-refreshing by-id trust route, so it showed a frozen/empty snapshot).
  Fix: added `lib/presence/derive.refreshOwnPresence` and `GET /api/presence/user/self` (re-derive the
  caller's presence from the source tables, self-healing the index without ever wiping it on a
  transient read failure), and switched the Directory detail to read the refreshing `self` routes for
  both presence and trust when the viewer owns the profile. Another member's profile still reads the
  read-only by-id routes. No schema change.
- 2026-07-15: Code-review fixes (findings #1510–#1512), behavior-preserving hardening. In
  `lib/presence/derive.refreshOwnPresence`, the per-row `upsertMemberPresence` and
  `deactivateMemberPresence` calls now run concurrently via `Promise.allSettled` with per-row error
  isolation: one failed row no longer aborts the rest, and each failure is reported through
  `reportError` (area `presence`, ops `derive_upsert` / `derive_deactivate`) instead of being thrown
  or dropped. In `GET /api/presence/user/[userId]`, the route context is now typed the repo-standard
  way (`{ params: Promise<{ userId: string }> }`, awaited) instead of a double cast, and a
  missing/empty `userId` returns 400. No schema, contract, or surface change.
