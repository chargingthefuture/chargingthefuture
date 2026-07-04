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
  a Level-Up co-enrolment, cohort/room membership, and an owner→second credit transfer.

Leave `DEMO_SECOND_OWNER_ID` unset for the original single-owner behaviour.

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
per-owner id), not on `(cohort_id, user_id)`. That composite unique is missing from the
live `demo` schema: its backfill in `schema.sql` runs inside a `DO` block that checks
`pg_indexes` without a `schemaname` filter, so in the demo schema (search_path
`demo,public`) it sees the `public` schema's index and skips creating the demo one. Using
the primary key avoids depending on a constraint the demo schema lacks. (Separate follow-up:
fix that `DO` block to qualify the `pg_indexes` check by `schemaname` so the demo schema
gets its own composite unique index.)

The what-works seed was corrected to upsert problems on their `slug` (the table's unique
key) and endorsements on `(product_id, user_id)`, rather than on `id`. Previously a
pre-existing row with the same slug but a different id was not caught and aborted the whole
seed with `duplicate key value violates unique constraint "idx_what_works_problems_slug"`.

## Schema impact

None. These seed changes only insert into tables and columns that already exist in
`ctf/schema.sql` (`unlock_verification_submissions`, `service_credits_wallets` /
`service_credits_transfers`, `trust_transport_requests`, `socket_relay_requests` /
`socket_relay_user_extension`, `foundation_connection_threads`, `lighthouse_profiles` /
`lighthouse_properties` / `lighthouse_matches`, `level_up_enrollments`,
`peer_programming_cohort_members`, `chyme_room_members`, `directory_profiles` /
`directory_user_extension`, `workforce_profiles`, `trust_user_extension`,
`what_works_problems` / `what_works_products` / `what_works_endorsements`). No table,
column, constraint, index, or contract is added or changed, so no `schema.sql` migration is
required (recorded here per `.claude/rules/122-schema-drift-predeployment-rules.mdc`).
