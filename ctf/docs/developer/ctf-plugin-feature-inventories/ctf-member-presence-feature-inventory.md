# Member Presence and Trust-on-Profile Feature Inventory (CTF v3)

## Scope and Boundary

A read-only, cross-plugin index that records where each member is active across the app, surfaced on
the Directory provider profile as an "Also active in" section, with the member's trust card shown
beside it. This is not a standalone plugin with its own routes-and-admin surface; it is a shared index
(`member_plugin_presence`) plus one read API and a Directory profile surface. The index is owned and
written by the source plugins (for this first cut, by a one-time backfill); Directory only reads it.

Out of scope for this first cut, recorded as deferred follow-ups in the Build Checklist below:
live per-plugin write hooks, and presence/trust badges on other interaction surfaces (Commons post
author, LightHouse host, TrustTransport driver, Foundation provider).

## Intent and Outcome

When a member looks at another member's Directory provider profile, they should see where else that
member takes part in the community, and how trusted that member is, in one place. The outcome is a
single "Also active in" list of tappable links into the plugins where that member has listings, with
the existing trust card rendered next to it so trust reads as peer social proof in context.

## Owner-Locked Decisions

- Presence uses a shared index that each plugin writes to — not direct per-plugin queries from
  Directory. For this first cut, the index is populated by a one-time backfill from existing listings;
  live per-plugin write hooks are a deferred follow-up.
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
  backfill now and is the contract future per-plugin write hooks will call.
- A read API (`GET /api/presence/user/[userId]`) returns the active presence list for a member,
  gated to any signed-in member.
- The Directory profile detail (a client component) fetches presence and trust for the profile's
  `claimed_by_user_id` and renders the "Also active in" section and the trust card beside it.

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

## Presence Sources (backfill coverage)

`scripts/backfillMemberPresence.mjs` reads each source and upserts one presence row per listing. It is
idempotent (INSERT ... ON CONFLICT DO UPDATE on the unique ref index), so it is safe to re-run.

| Source | Table | Member user-id column | Active filter | Slug / deep link | ref_type | Label |
|---|---|---|---|---|---|---|
| LightHouse property postings | `lighthouse_properties` | `host_user_id` | `is_active = TRUE` | `lighthouse` / `/apps/lighthouse` | `property` | Housing listing |
| TrustTransport ride requests | `trusttransport_requests` | `requester_user_id` | status not terminal | `trusttransport` / `/apps/trusttransport` | `request` | Ride request |
| TrustTransport ride offers | `trusttransport_offers` | `provider_user_id` | status not terminal | `trusttransport` / `/apps/trusttransport` | `offer` | Offering rides |
| Foundation provider offerings | `foundation_provider_skills` | `user_id` | none (a row means offering) | `foundation` / `/apps/foundation` | `provider-skill` | Provider offering |
| SocketRelay help posts | `socketrelay_requests` | `owner_user_id` | `status = 'open'` | `socketrelay` / `/apps/socketrelay` | `post` | Help post |

Notes on sources:

- No source was skipped. Every source named in the task mapped cleanly to a member user-id column.
- Foundation rows have a composite primary key `(user_id, skill_id)` and no per-row UUID, so the
  backfill uses `skill_id` as `ref_id`. The deep link is the plugin home; the label is a fixed
  "Provider offering".
- TrustTransport `status` is a free-text column with no schema-level enum, so active filtering is done
  defensively by excluding terminal states (cancelled / canceled / completed / closed / withdrawn /
  declined / expired / rejected) rather than guessing the exact active set.
- A missing source table in a given environment is logged and skipped by the backfill; the other
  sources still run.

## API Surface and Route Map

- `GET /api/presence/user/[userId]` — returns `{ presence: Array<{ pluginSlug, refType, refId, label,
  deepLink }> }` for the member, active rows only, ordered by plugin then label. Gated to any
  authenticated member (`requireTrustMemberAccess`). Read-only; no mutation route in this first cut.

The Directory profile read is unchanged at the API level: the detail component already receives the
profile's `claimedByUserId` from the list payload, so presence and trust are fetched client-side from
that id rather than embedded in a directory route.

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

No dedicated deterministic seed. The backfill (`scripts/backfillMemberPresence.mjs`) populates the
index from whatever real listings exist in the target database, so presence coverage follows the
seeded/real data of the source plugins. Re-running the backfill is safe and idempotent.

## Gaps and Known Technical Debt

- Presence freshness depends on re-running the backfill until live write hooks land; a listing removed
  after a backfill stays present until the next run (the deactivate helper exists but is not yet wired
  to plugin lifecycle events).
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

Deferred follow-ups (not in this first cut):

7. Live per-plugin write hooks: each source plugin calls `upsertMemberPresence` when a listing is
   created/updated and `deactivateMemberPresence` when it is removed, replacing the periodic backfill.
   Cover these in each source plugin's own contracts and deletion scope.
8. Presence/trust badges on other interaction surfaces: the Commons (SocketRelay) post author, the
   LightHouse host, the TrustTransport driver, and the Foundation provider — so presence and trust are
   visible where members actually meet, not only on the Directory profile.

## Change Log

- 2026-06-21: First cut. Added `member_plugin_presence`, the presence repository, the backfill script,
  the read API, and the "Also active in" + trust surface on the Directory provider profile. Live write
  hooks and other-surface badges deferred.
