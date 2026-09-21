-- post/0034: Drop the v2 foreign key that has been refusing most members' sign-in rows, and rebuild
-- the days it refused.
--
-- `login_events` is the entire definition of an active member (owner decision, 2026-08-27): a member
-- is active on a day the sign-in record holds a row for them. v3 writes that row from the shared
-- identity gate (`recordLoginEvent`), once per member per UTC day, for every signed-in request.
--
-- On production that write has been failing for most members since the day it was added. The table
-- carries a v2 constraint, `login_events_user_id_fkey`, from `user_id` to `users(id)` (see
-- ctf/schema-prod4.6.2026.sql line 2384). `users` is the identity mirror v2 maintained; v3 never
-- writes it — nothing in this repository inserts into `users` — so it holds exactly the accounts
-- that existed while v2 was running and not one account created since. For every other member the
-- insert raises a foreign-key violation, the fire-and-forget writer logs it to the server log where
-- nobody reads it, and the member's day is never recorded. That is why the Weekly Performance
-- dashboard's Active Members and Daily Active Members rows read zero, or near zero, for every week
-- since launch while the Directory kept growing: the record could only ever hold the members v2
-- already knew. The same rows feed PeerProgramming's cohort selection, the Trust "seen" signal, and
-- the Recurring Activity counterparty check, so all of those were undercounting the same people.
--
-- The 2026-08-28 note on post/0008 read the one member it could not write as "an account deleted
-- since". The Update Neon DB log for every run since says otherwise: the evidence it skips is for a
-- live member the mirror never held. The mirror is not "an account the platform still holds"; it is
-- a list frozen on the day v2 stopped.
--
-- Two things, in one statement so they cannot half-apply:
--
--   1. Drop the constraint. Nothing in v3 depends on it — the reads of `login_events` never join
--      `users` — and the table's own guard against duplicate days (the (user_id, UTC day) unique
--      index in schema.sql) is untouched. Account deletion removes a member's rows by user_id and
--      never went through the key.
--
--   2. Rebuild the days the key refused, for exactly the members it refused: those with no `users`
--      row. Same method and same sources as post/0008 — first-party evidence that an authenticated
--      session existed on a day: a command-trail row naming the member as the actor, or a row the
--      member wrote themselves. Rows whose timestamp belongs to a counterparty or an admin acting
--      ON a member are not evidence the member turned up and are not used. The window runs from
--      2026-05-27 (where post/0008's window starts — v2's last live row is 2026-05-26) to the
--      moment this runs, because for these members the record was never being written at any
--      point in between. Members the mirror does hold are not touched: their writes succeeded, so
--      an absent day of theirs is a real absence.
--
-- Properties:
--   * one-shot   — everything is gated on the constraint being present. On a database that never
--                  had it (one built from schema.sql alone) it reports and does nothing; on a
--                  re-run after it has been dropped it does nothing, so it can never rebuild a day
--                  from evidence once live recording is in place. A future writer failure will
--                  show as a real absence, not be papered over on the next push.
--   * guarded    — every source table and column is checked for existence before it is read.
--   * idempotent — WHERE NOT EXISTS on the (member, UTC day) pair plus ON CONFLICT DO NOTHING.
--   * honest     — rebuilt rows are marked `source = 'backfill_users_fkey'` where the column exists,
--                  so a reconstructed day is never mistaken for one recorded live. The timestamp is
--                  the member's earliest proven action that day.
--   * people only — a member id is a Clerk id (`user_…`); the ids the platform writes for itself
--                  (scheduled runs, the webhook, the `anonymous`/`system` fallbacks) never carry
--                  that prefix and are also excluded by name.
--
-- Applied by the "Neon — Update DB" GitHub Action on the push to main. It reports as it goes: that
-- the key was dropped, the evidence found, a line per member-count per day, and rows written.

DO $$
DECLARE
  repair_start CONSTANT timestamptz := TIMESTAMPTZ '2026-05-27 00:00:00+00';
  repair_end timestamptz;
  -- Actor ids the platform writes for itself. None of these is a person turning up. The `user_`
  -- prefix filter below already excludes all of them; the list is kept so the exclusion reads.
  non_member_actors CONSTANT text[] := ARRAY[
    'anonymous',
    'system',
    'system:commons-guidance',
    'system:unlock-spam-denylist',
    'account-deletion-operator',
    'ci-product-update',
    'clerk-user-deleted-webhook',
    'peer-programming-scheduler',
    'skills-hunt-auto-mission-scheduler',
    'skills-hunt-incentive-system',
    'skill-up-auto-cohort-scheduler',
    'level-up-auto-cohort-scheduler',
    'unlock-incentive-system',
    'internal_service_credits_reclaimer'
  ];
  src record;
  has_source boolean;
  evidence_days bigint;
  evidence_members bigint;
  written bigint;
BEGIN
  IF to_regclass('public.login_events') IS NULL THEN
    RAISE NOTICE 'login_events does not exist in this database; nothing to do.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'login_events_user_id_fkey'
      AND conrelid = to_regclass('public.login_events')
  ) THEN
    RAISE NOTICE 'login_events carries no foreign key to users(id); nothing to drop and nothing to rebuild.';
    RETURN;
  END IF;

  -- The moment recording starts working for everyone. Evidence after this point is not needed: the
  -- live writer records those days itself.
  repair_end := NOW();

  ALTER TABLE public.login_events DROP CONSTRAINT login_events_user_id_fkey;
  RAISE NOTICE 'Dropped login_events_user_id_fkey. Sign-ins are recorded for every member from now on.';

  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'No users table, so no member was ever refused by the key; nothing to rebuild.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _login_fkey_evidence (
    user_id text NOT NULL,
    activity_day date NOT NULL,
    first_seen timestamptz NOT NULL
  );

  -- Every source is (table, member column, date column), read only for the window and only for
  -- members the mirror does not hold.
  FOR src IN
    SELECT * FROM (VALUES
      -- Rows the member wrote themselves.
      ('click_log_incidents', 'user_id', 'created_at'),
      ('mood_submissions', 'user_id', 'submitted_at'),
      ('feed_community_posts', 'author_user_id', 'created_at'),
      ('feed_community_replies', 'author_user_id', 'created_at'),
      ('feed_community_post_reactions', 'user_id', 'created_at'),
      ('feed_answers', 'author_user_id', 'created_at'),
      ('announcement_replies', 'author_user_id', 'created_at'),
      ('fireside_comments', 'author_user_id', 'created_at'),
      ('contributor_access_channel_posts', 'author_user_id', 'created_at'),
      ('peer_programming_messages', 'author_user_id', 'created_at'),
      ('skill_up_dispute_comments', 'actor_user_id', 'created_at'),
      -- Command trails: one row per command the member ran, actor and time from their own request.
      ('account_restrictions_audit', 'actor_id', 'created_at'),
      ('announcement_membership_events', 'actor_id', 'created_at'),
      ('beacon_events_admin_audit_trail', 'actor_id', 'created_at'),
      ('bug_report_admin_audit_trail', 'actor_id', 'created_at'),
      ('chyme_admin_audit_trail', 'actor_id', 'created_at'),
      ('comic_admin_audit_trail', 'actor_id', 'created_at'),
      ('contributions_audit_log', 'actor_user_id', 'created_at'),
      ('contributor_access_audit_trail', 'actor_id', 'created_at'),
      ('directory_admin_audit_trail', 'actor_id', 'created_at'),
      ('directory_profile_change_events', 'actor_id', 'created_at'),
      ('feed_admin_audit_trail', 'actor_id', 'created_at'),
      ('feed_membership_events', 'actor_id', 'created_at'),
      ('fireside_audit_events', 'actor_id', 'created_at'),
      ('foundation_admin_audit_trail', 'actor_id', 'created_at'),
      ('foundation_quote_status_events', 'actor_user_id', 'created_at'),
      ('gdp_admin_audit_trail', 'actor_id', 'created_at'),
      ('skill_up_audit_events', 'actor_id', 'created_at'),
      ('lighthouse_admin_audit_trail', 'actor_id', 'created_at'),
      ('llm_inference_log', 'actor_user_id', 'created_at'),
      ('mutual_time_admin_audit_trail', 'actor_id', 'created_at'),
      ('peer_programming_admin_audit_trail', 'actor_id', 'created_at'),
      ('quora_deletion_survey_audit_log', 'actor_user_id', 'created_at'),
      ('quora_live_census_audit_log', 'actor_user_id', 'created_at'),
      ('recurring_activity_audit_trail', 'actor_user_id', 'created_at'),
      ('safety_admin_audit_trail', 'actor_id', 'created_at'),
      ('service_credits_admin_audit_trail', 'actor_id', 'created_at'),
      ('skills_hunt_audit_log', 'actor_id', 'created_at'),
      ('skills_taxonomy_change_events', 'actor_id', 'created_at'),
      ('socket_relay_admin_audit_trail', 'actor_id', 'created_at'),
      ('socket_relay_request_events', 'actor_user_id', 'created_at'),
      ('ti_radio_admin_audit_trail', 'actor_id', 'created_at'),
      ('trust_admin_audit_trail', 'actor_user_id', 'created_at'),
      ('trust_transport_admin_audit_trail', 'actor_id', 'created_at'),
      ('trust_transport_status_events', 'actor_user_id', 'created_at'),
      ('unlock_audit_log', 'actor_user_id', 'created_at'),
      ('weekly_performance_audit_trail', 'actor_id', 'created_at'),
      ('what_works_admin_audit_trail', 'actor_id', 'created_at'),
      ('workforce_admin_audit_trail', 'actor_id', 'created_at')
    ) AS t(table_name, user_column, date_column)
  LOOP
    CONTINUE WHEN to_regclass('public.' || src.table_name) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = src.table_name AND column_name = src.user_column
    );
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = src.table_name AND column_name = src.date_column
    );

    EXECUTE format(
      'INSERT INTO _login_fkey_evidence (user_id, activity_day, first_seen)
       SELECT btrim(%1$I),
              (%2$I AT TIME ZONE ''UTC'')::date,
              MIN(%2$I)
       FROM public.%3$I
       WHERE %2$I >= $1 AND %2$I < $2
         AND %1$I IS NOT NULL
         AND btrim(%1$I) LIKE ''user\_%%''
         AND btrim(%1$I) <> ALL ($3)
         AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = btrim(%1$I))
       GROUP BY 1, 2',
      src.user_column, src.date_column, src.table_name
    ) USING repair_start, repair_end, non_member_actors;
  END LOOP;

  SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO evidence_days, evidence_members
  FROM (SELECT DISTINCT user_id, activity_day FROM _login_fkey_evidence) d;

  RAISE NOTICE 'Evidence for members the key refused: % member-day(s) across % member(s).',
    evidence_days, evidence_members;

  -- A line per day with evidence, so the repair is legible rather than a single number to take on
  -- trust. Days with no evidence are not listed.
  FOR src IN
    SELECT activity_day, COUNT(DISTINCT user_id) AS members
    FROM _login_fkey_evidence
    GROUP BY activity_day
    ORDER BY activity_day
  LOOP
    RAISE NOTICE '  % — % member(s) with evidence', src.activity_day, src.members;
  END LOOP;

  has_source := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'login_events' AND column_name = 'source'
  );

  -- The WHERE NOT EXISTS guard is the one that always applies; it holds even on a database where the
  -- (user_id, UTC-day) unique index was never built. The bare ON CONFLICT DO NOTHING closes the race
  -- wherever that index does exist.
  IF has_source THEN
    INSERT INTO public.login_events (user_id, created_at, source)
    SELECT e.user_id, MIN(e.first_seen), 'backfill_users_fkey'
    FROM _login_fkey_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.login_events (user_id, created_at)
    SELECT e.user_id, MIN(e.first_seen)
    FROM _login_fkey_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS written = ROW_COUNT;
  RAISE NOTICE 'Sign-in days written: %. The key is gone, so a re-run of this migration does nothing.', written;

  DROP TABLE _login_fkey_evidence;
END
$$;
