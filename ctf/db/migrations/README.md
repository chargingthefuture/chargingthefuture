# Database migrations

These are one-off SQL steps that the canonical schema file (`ctf/schema.sql`) **cannot** express on
its own. `schema.sql` is purely additive — it uses `CREATE TABLE IF NOT EXISTS` and
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so it can create new tables and add new columns, but it
**cannot** fix a table that already exists with the wrong shape (a column whose type drifted, a table
that needs to be dropped and rebuilt, a rename, or a data backfill). Those go here.

## How it runs

The "Update Neon DB" GitHub Action (`.github/workflows/update-neon-db.yml`) applies the database in
this exact order against the `DATABASE_URL` it is given:

1. every file in `pre/` (sorted by name) — structural fixes that must happen **before** the canonical
   schema (e.g. drop a drifted table so `schema.sql` can recreate it correctly);
2. `ctf/schema.sql` — the canonical v3 desired state;
3. every file in `post/` (sorted by name) — anything that must happen **after** the tables exist
   (data backfills, cleanups).

That workflow runs automatically on a push to `main` that changes `schema.sql` or this folder, and it
can also be run manually (its "Run workflow" button). To bring a fresh clone of the live v2 database
up to the v3 spec: point the `DATABASE_URL` secret at the clone and run the workflow once.

## Writing a migration

- **Name files `NNNN_short_description.sql`** with a zero-padded number so they sort in run order
  (`0001_…`, `0002_…`). Put it in `pre/` or `post/` depending on whether it must run before or after
  `schema.sql`.
- **Make it idempotent and guarded.** It will be run more than once (every qualifying push, and again
  on each fresh clone). Detect the condition you are fixing and only act when it is present, so a
  second run is a no-op. Prefer `IF EXISTS` / `IF NOT EXISTS` and `DO $$ … $$` guards.
- **Never edit a migration once it has been run against a database you care about.** Add a new
  numbered file instead.
- **One edge case per file**, with a comment block at the top explaining why it exists, what it does,
  and why it is safe to re-run.

## Current migrations

| File | When | Purpose |
| --- | --- | --- |
| `pre/0001_lighthouse_v2_to_v3_rebuild.sql` | pre | Drop the drifted v2 LightHouse tables (varchar ids) so `schema.sql` recreates them with uuid ids; drop the v2-only `lighthouse_announcements`. Guarded on the drift being present. |
| `pre/0002_socket_relay_v2_to_v3_rebuild.sql` | pre | Drop the drifted v2 SocketRelay tables that `schema.sql` rebuilds (`socket_relay_requests`/`fulfillments`/`messages`, varchar ids) so they are recreated with uuid ids; the v2-only `socket_relay_profiles`/`socket_relay_announcements` are left untouched. Guarded on the drift being present. |
| `post/0001_directory_display_name_to_first_last.sql` | post | Drop the v2 `display_name` column on `directory_profiles` after schema.sql has added `first_name`/`last_name`; carry any name that only lived in `display_name` into `first_name`. Guarded on `display_name` still existing, so re-runs are no-ops. |
| `post/0002_chyme_drop_display_name.sql` | post | Drop the redundant `display_name` column from `chyme_room_members` and `chyme_messages`; the author is now identified by the raw `username` already stored on each row and rendered as `@username`. Guarded on `display_name` still existing, so re-runs are no-ops. |
| `post/0003_socket_relay_drop_display_name.sql` | post | Drop the unused `display_name` column from `socket_relay_user_extension`; nothing rendered it (SocketRelay identifies people by their Clerk `@username`). Guarded on `display_name` still existing, so re-runs are no-ops. |
| `post/0004_skills_hunt_submissions_display_name_to_full_name.sql` | post | Rename `display_name` to `full_name` on `skills_hunt_submissions` after the owner relabeled the nominee's name field to "Full name". Guarded on `display_name` still existing and `full_name` not yet existing, so re-runs are no-ops. |
| `post/0008_login_events_backfill_launch_gap.sql` | post | Rebuild the sign-in days nothing recorded between 2026-05-27 and 2026-06-18, when v2 had stopped writing `login_events` and v3's writer did not yet exist — the window the 2026-06-12 launch falls in. Reconstructs a member's day from first-party evidence that an authenticated session existed (a command-trail row naming them as actor, or a row they wrote themselves), marks the rebuilt rows `source = 'backfill_launch_gap'`, and skips any (member, UTC day) the record already holds, so re-runs are no-ops. Evidence for a member the `users` identity mirror does not hold is skipped and reported; `post/0034` rebuilds those members' days once the key that refused them is gone. |
| `post/0009_skill_up_cohort_title_drop_plugin_prefix.sql` | post | Strip the `LevelUp: ` / `SkillUp: ` prefix from `skill_up_cohorts.title`. The cohort cards sit inside the SkillUp plugin, so the prefix repeated the plugin's own name on every row; the title template now writes the occupation alone. Guarded on the prefix still being present, so re-runs are no-ops. |
| `post/0010_skill_up_cohort_job_title_backfill.sql` | post | Fill `skill_up_cohorts.job_title_id` — the occupation a cohort trains, which the trainer claim gate matches Directory skills against. Copies `source_job_title_id` where the auto-cohort run set it, then matches a hand-built cohort's free-text `track` against an active job title name only where that name is unambiguous. Leaves NULL rather than guessing. Guarded on the column still being NULL, so re-runs are no-ops. |
| `post/0011_skill_up_deposit_and_trainer_rate.sql` | post | Move cohorts still on a zero deposit to the flat 50 and clear `allow_no_deposit`, so every member pays the same commitment deposit and no enrollment can skip it. The trainer's rate is now stamped on the cohort (`trainer_credits_per_milestone`, default 10) instead of being derived from the deposit. Guarded on the pre-change values, so re-runs are no-ops. |
| `post/0012_skill_up_drop_stipend_columns.sql` | post | Drop `stipend_mode`, `stipend_amount_per_payout`, `stipend_interval_days` and `stipend_currency` from `skill_up_cohorts`. `createCohort` wrote them and nothing ever read them; there was no payout flow, no schedule table, and no spec, while the catalog advertised stipends to members. They only ever held their defaults. Guarded with `IF EXISTS`, so re-runs are no-ops. |
| `post/0013_skill_up_drop_microgrant_columns.sql` | post | Drop `microgrant_mode`, `microgrant_amount` and `microgrant_currency` from `skill_up_cohorts` — the same dead-payout removal `post/0012` did for stipends. `createCohort` wrote them and nothing read them; there was no flow, no route and no spec. They only ever held their defaults. Guarded with `IF EXISTS`, so re-runs are no-ops. |
| `post/0034_login_events_drop_v2_users_fkey.sql` | post | Drop `login_events_user_id_fkey`, the v2 foreign key from `login_events.user_id` to `users(id)`. `users` is the identity mirror v2 maintained and v3 never writes, so the key refused a sign-in row for every member who joined after v2 stopped — the reason Weekly Performance's Active Members and Daily Active Members read zero after launch. In the same statement, rebuilds the days it refused for exactly those members (no `users` row) from the same first-party evidence `post/0008` uses, from 2026-05-27 to the moment it runs, marked `source = 'backfill_users_fkey'`. Gated on the key being present, so a re-run after the drop does nothing and can never paper over a later writer failure. |
| `post/0035_drop_weekly_performance_metrics.sql` | post | Drop `weekly_performance_metrics`. Every weekly number has been computed live from the plugins' own tables since 2026-06-29; the table was written by two seed scripts and read by nothing. Guarded with `IF EXISTS`, so re-runs are no-ops. |
| `post/0038_login_events_backfill_type_error_gap.sql` | post | Rebuild the sign-in days lost from 2026-09-20 to 2026-09-24, when the sign-in write was refused with "inconsistent types deduced for parameter $1" (production's `user_id` is VARCHAR; fixed in PR #2519). Same first-party evidence as `post/0034`, for every member, in a fixed window ending 2026-09-25 00:00 UTC, marked `source = 'backfill_type_error_gap'`. The fixed window means a re-run writes nothing new and can never cover a later writer failure. |
| `post/0039_login_events_backfill_type_error_gap_visits.sql` | post | Same window and marking as `post/0038`, read from the app's "last seen" markers instead of from writes: `feed_commons_last_seen`, `feed_commons_notice_seen`, `chyme_room_members` (`last_seen_at` and `joined_at`) and `admin_area_seen`. A sign-in, not a write, makes a member active, so a member who only looked around belongs in the record. Each marker keeps only the latest visit, so it adds at most that day. |
| `post/0040_unlock_spam_denylist_restore.sql` | post | Restore `unlock_spam_quora_urls` entries from spam decisions on `unlock_verification_submissions` (canonical URL, not on the denylist, not removed by an admin after the decision). On 2026-09-24 `post/0028` deleted a denylist row and failed before re-inserting it, because its TEMP stash was on another pooled session; `post/0028` now runs in one transaction. Idempotent; reports the count restored. |
