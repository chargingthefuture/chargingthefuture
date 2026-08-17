# Demo Seed Notes

Operational notes for `ctf/scripts/seedDemo.mjs` (run by the **Demo — Seed Schema**
GitHub Actions workflow, `.github/workflows/seed-demo.yml`), which fills the `demo`
Postgres schema with a coherent scenario for testing.

## Two real owners for two-sided testing (`DEMO_SECOND_OWNER_ID`)

The product is a two-sided marketplace (TrustTransport requester/provider, SocketRelay
requester/fulfiller, Foundation two-party thread, Lighthouse seeker/host). By default the
seed puts a **synthetic** user on the far side of each flow (`demo-peer-*`, `demo-host-*`),
and nobody can sign in as those, so only one side can be exercised.

Set the optional **`DEMO_SECOND_OWNER_ID`** input to a second real Clerk user id and the
seed makes that user the real counterparty to `DEMO_OWNER_ID`:

- both real owners are granted the `approved_full` unlock tier (an
  `unlock_verification_submissions` row), so neither needs the
  `feature-unlock-quora-onboarding` Unleash flag;
- the second user gets a member profile (directory, trust, wallet, workforce, socket-relay
  presence);
- both-sided data is wired so each real account can act as **both** sides: an open
  TrustTransport request and an open SocketRelay request owned by *each* user, a shared
  Foundation thread, a Lighthouse seeker(owner)↔host(second-owner) match with a property,
  a Level-Up co-enrollment, cohort/room membership, and an owner→second credit transfer.

Leave `DEMO_SECOND_OWNER_ID` unset for the original single-owner behavior.

## Plugin coverage

Every member-visible plugin now has seeded demo content, keyed to the first owner and the
synthetic peers:

- Already covered: ServiceCredits, GDP, Weekly Performance, LevelUp, SkillsHunt, Directory,
  Workforce, LightHouse, Feed + Announcements, Trust, Mood, GentlePulse, Chyme,
  TrustTransport, PeerProgramming, Skills Taxonomy, SocketRelay, ClickLog, WhatWorks.
- Foundation Browse: the two synthetic peers are opted-in providers (a
  `foundation_provider_skills` row each, backed by their Directory profiles and the seeded
  taxonomy skills), so Browse is no longer empty. The owner has Directory skills for the
  "skills I could offer" picker, a two-party thread with peer 1, and one open quote request
  in the `requested` state.
- Contributions: one always-current fundraiser drive (its window is refreshed relative to
  the run time on every re-run) plus two owner claims — a confirmed Quora comment with its
  credit grant, and a pending GitHub star.
- Recurring Activity: one active activity (owner ↔ peer 1, free of charge, no amount) and
  one pending activity declared by peer 2 with the owner as counterparty, so the owner can
  test the confirm/decline action.
- Skipped on purpose — Beacon: its member surface shows a live broadcast or a replay
  recording, both of which need a real Stream video call; a seeded row would point the
  player at a call that does not exist.

## Testing empty states (the second owner's personal views)

All of the seeded per-member activity above is attached to the FIRST owner (or to synthetic
peers). The second owner (`DEMO_SECOND_OWNER_ID`) gets a member profile and the two-sided
marketplace records listed earlier, but none of the newer per-member data: their Foundation
quote history, Contributions claims, and Recurring Activity list are empty. To see an empty
state on purpose, sign in as the second owner and open that plugin's personal view.
Cross-member browse surfaces (Foundation Browse, WhatWorks, the feed, and so on) show the
same shared rows to both owners. Re-running `seed:demo` restores the populated state for
the first owner without duplicating rows.

### Still required in Unleash for the second user

The seed grants the *access tier*, but it cannot route a user into the demo world. The
**`demo-mode`** Unleash flag is what points that signed-in user's database pool at the
`demo` schema, and only the running app can evaluate it. So for the second Clerk id:
target the `demo-mode` flag at it in Unleash, then run the workflow with both ids.

## Idempotency

The seed is safe to re-run (every statement upserts on a natural key or a deterministic
id). All second-owner records use per-owner ids (`sha256id(...)`) and conflict on natural
keys, so they never collide with the fixed demo UUIDs used for the first owner.

The two remaining plain inserts were made idempotent: the demo Chyme messages and the
GentlePulse play event now use deterministic ids with `ON CONFLICT (id) DO NOTHING`
(both tables have only a uuid primary key, no natural unique key), so re-running no longer
appends duplicate rows. Verified against a local Postgres: `chyme_messages` stays at 3 and
`gentle_pulse_play_events` stays at 1 across repeated runs.

The second-owner Level-Up enrollment conflicts on the primary key (a deterministic
per-owner id), not on `(cohort_id, user_id)`. That composite unique used to be missing from
the live `demo` schema — the root cause and its fix are described in the next section. The
seed still conflicts on the primary key (it does not depend on any composite unique), so it
keeps working on both old and newly-provisioned demo schemas.

## Demo schema provisioning: schema-scoped existence guards

`ctf/schema.sql` is applied twice against the same database: once normally (the `public`
schema) and once for the demo copy with `search_path=demo,public` (see
`ctf/scripts/migrateToDemo.mjs`). Several idempotency guards checked whether an index or
constraint already existed **by name only** — e.g. `pg_indexes WHERE indexname = '…'`,
`information_schema.check_constraints WHERE constraint_name = '…'`, `pg_constraint WHERE
conname = '…'`. Those catalog views span every schema, and index/constraint names are only
unique *within* a schema, so during demo provisioning the guard found the identically-named
object already sitting in `public` and skipped creating it in `demo`. The demo tables were
left without those indexes/constraints — which is why a demo `INSERT … ON CONFLICT (cohort_id,
user_id)` on `level_up_enrollments` failed with "no unique or exclusion constraint matching
the ON CONFLICT specification".

Every such guard now also filters on the current schema so the check looks only at the schema
being provisioned:

- `pg_indexes` → `AND schemaname = current_schema()`
- `information_schema.check_constraints` / `table_constraints` → `AND constraint_schema = current_schema()`
- `pg_constraint` → `AND connamespace = current_schema()::regnamespace`

`current_schema()` resolves to `demo` during demo provisioning (demo is the first existing
schema in the search path) and `public` in a normal run, so the same file behaves correctly
either way. This is backward-compatible: on a normal `public` run the filter matches the
existing public object exactly as before (no re-creation, still idempotent); it only changes
the demo run, where the demo object is now created instead of being masked by the public one.

Verified against a local Postgres: provisioning `public` then `demo` from the same file leaves
the demo schema with every previously-missing index/constraint
(`level_up_enrollments_cohort_id_user_id_key`, `level_up_user_achievements_user_id_achievement_id_key`,
`directory_profiles_unclaimed_handle_key`, the CHECK/FK constraints), and both a repeated demo
run and a repeated public run are idempotent (constraint counts unchanged, no errors). The four
`information_schema.columns` guards that already carried `table_schema = 'public'` are left
alone — `migrateToDemo` rewrites that literal to the target schema for them.

### Follow-on: mood_submissions FK self-heal on the demo schema

Adding the missing constraints to the existing demo schema surfaced a latent data problem the
skipped guard had been hiding. The `mood_submissions_pseudonym_fkey` foreign key
(`mood_submissions.pseudonym → mood_client_identities.pseudonym`) had never been enforced on
the demo schema, and the demo `mood_submissions` table had accumulated a check-in row whose
`pseudonym` had no matching mapping row. With the guard now schema-scoped, the `ALTER TABLE …
ADD CONSTRAINT` finally ran on demo and failed validation against that orphan
(`insert or update on table "mood_submissions" violates foreign key constraint …`).

The mood backfill deliberately severs the direct `user_id` link and repoints each check-in onto
a mapping pseudonym, so a row can be stranded if its mapping row is ever missing. The FK-add
guard now self-heals first: when the constraint is absent it inserts a server-controlled mapping
for every orphan pseudonym (`user_id` set to the pseudonym text — always unique, never a real
Clerk id) before adding the FK, so no check-in is lost and `ON DELETE CASCADE` still deletes it
through the mapping. The heal sits inside the `IF NOT EXISTS (… pg_constraint …)` guard, so on a
schema that already enforces the FK (steady-state production) the whole block is skipped and no
mapping rows are invented. Verified locally: reproducing the orphan state (FK dropped, orphan
row inserted) and re-provisioning heals it — FK added, orphan preserved, cascade-delete works,
idempotent on re-run.

The what-works seed was corrected to upsert problems on their `slug` (the table's unique
key) and endorsements on `(product_id, user_id)`, rather than on `id`. Previously a
pre-existing row with the same slug but a different id was not caught and aborted the whole
seed with `duplicate key value violates unique constraint "idx_what_works_problems_slug"`.

## Schema impact

The schema-scoped guard fix above edits `ctf/schema.sql` (existence-check `WHERE` clauses
only). It adds/removes no table, column, constraint, or index in the `public` schema and is
backward-compatible; it only makes the demo schema receive the objects it was already supposed
to have. Recorded here per `.claude/rules/122-schema-drift-predeployment-rules.mdc`.

The seed changes only insert into tables and columns that already exist in
`ctf/schema.sql` (`unlock_verification_submissions`, `service_credits_wallets` /
`service_credits_transfers`, `trust_transport_requests`, `socket_relay_requests` /
`socket_relay_user_extension`, `foundation_connection_threads`, `lighthouse_profiles` /
`lighthouse_properties` / `lighthouse_matches`, `level_up_enrollments`,
`peer_programming_cohort_members`, `chyme_room_members`, `directory_profiles` /
`directory_user_extension`, `workforce_profiles`, `trust_user_extension`,
`what_works_problems` / `what_works_products` / `what_works_endorsements`,
`directory_profile_skills`, `foundation_user_extension` / `foundation_provider_skills` /
`foundation_quote_requests`, `contributions_cycles` / `contributions_submissions`,
`recurring_activities`). No table, column, constraint, index, or contract is added or
changed, so no `schema.sql` migration is required (recorded here per
`.claude/rules/122-schema-drift-predeployment-rules.mdc`).

## Tester accounts (issue #2037) — 2026-08-02

The seed workflow gained two optional inputs, `demo_tester_admin_id` and
`demo_tester_member_id`, for the hired tester's two demo accounts (one used as an
admin, one as a plain member). For each id given, `seedDemo.mjs` inserts the same
baseline the second owner gets: an `unlock_verification_submissions` tier row, a
`service_credits_wallets` row, and a `directory_profiles` /
`directory_user_extension` pair. Two things stay outside the seed because only
Clerk and Unleash hold them: the admin role (set role=admin on the tester-admin
account in the Clerk dashboard) and demo routing (target the `demo-mode` Unleash
flag at both ids).

All inserts target tables and columns that already exist in `ctf/schema.sql`; no
table, column, constraint, index, or contract is added or changed, so no
`schema.sql` migration is required (recorded here per
`.claude/rules/122-schema-drift-predeployment-rules.mdc`).
