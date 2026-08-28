-- post/0008: Rebuild the sign-in days that nothing recorded between v2 stopping and v3 starting.
--
-- `login_events` is the whole definition of an active member (owner decision, 2026-08-27): a member
-- is active on a day the sign-in record holds a row for them, whatever they opened next. The record
-- carries real history from v2 — its first row is 2025-12-15 — but it has a hole. v2 wrote its last
-- row on 2026-05-26 and v3's writer did not exist until 2026-06-19, so for 23 days nothing wrote
-- anything down. The platform launched on 2026-06-12, inside that hole, which is why the oldest week
-- the Weekly Performance picker offers reported nobody at all while people were plainly using it.
--
-- This does not change what "active" means and does not widen it. It repairs the record for those
-- days only, from first-party evidence that an authenticated session existed: a row in a plugin's
-- command trail naming the member as the actor, or a row the member wrote themselves, is proof that
-- member was signed in on that day. Every source is member-attributed and dated by the member's own
-- action; rows whose timestamp belongs to a counterparty or an admin acting ON a member are not
-- evidence that the member turned up and are not used.
--
-- Properties:
--   * scoped     — only days in [2026-05-27, 2026-06-19). Outside the hole the record was being
--                  written, so an absent day there is a real absence and is left alone.
--   * guarded    — every source is checked for existence before it is read, so a database missing
--                  any of these tables simply contributes nothing instead of failing.
--   * idempotent — WHERE NOT EXISTS on the (member, UTC day) pair plus ON CONFLICT DO NOTHING. Safe
--                  to re-run, and safe to run after the same repair was applied by hand.
--   * honest     — where the table has v2's `source` column, backfilled rows are marked
--                  'backfill_launch_gap' so a reconstructed day is never mistaken for one that was
--                  recorded live. The timestamp is the member's earliest proven action that day.
--   * people only — actor ids the platform writes for itself (scheduled runs, the platform-authored
--                  Commons notice, the `anonymous`/`system` fallbacks) are excluded by name, and so
--                  is any member the `users` identity mirror no longer holds. Production's
--                  login_events has a v2 foreign key to users(id) (see
--                  ctf/schema-prod4.6.2026.sql), and the command trails outlive that mirror: a
--                  deleted account leaves audit rows behind. One such orphan is what made the first
--                  production run of this migration abort without writing anything.
--
-- Applied by the "Neon — Update DB" GitHub Action, which runs every post/ migration on a push to
-- main that touches this folder — so merging is what runs it, with no command to type. It reports as
-- it goes in the workflow log: the evidence it found, a line per day naming how many members that day
-- has evidence for, and how many rows it wrote. Being idempotent, it is re-applied on every later run
-- of that workflow and on every fresh database clone, writing nothing the second time.

DO $$
DECLARE
  gap_start CONSTANT timestamptz := TIMESTAMPTZ '2026-05-27 00:00:00+00';
  gap_end   CONSTANT timestamptz := TIMESTAMPTZ '2026-06-19 00:00:00+00';
  -- Actor ids the platform writes for itself. None of these is a person turning up.
  non_member_actors CONSTANT text[] := ARRAY[
    'anonymous',
    'system',
    'system:commons-guidance',
    'skills-hunt-auto-mission-scheduler',
    'level-up-auto-cohort-scheduler',
    'unlock-incentive-system',
    'internal_service_credits_reclaimer'
  ];
  src record;
  has_source boolean;
  evidence_days bigint;
  evidence_members bigint;
  skipped bigint;
  written bigint;
BEGIN
  IF to_regclass('public.login_events') IS NULL THEN
    RAISE NOTICE 'login_events does not exist in this database; nothing to repair.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _login_gap_evidence (
    user_id text NOT NULL,
    activity_day date NOT NULL,
    first_seen timestamptz NOT NULL
  );

  -- Every source is (table, member column). The date column is `created_at` throughout except where
  -- named otherwise below, and each is read only for the gap window.
  FOR src IN
    SELECT * FROM (VALUES
      -- Rows the member wrote themselves.
      ('click_log_incidents', 'user_id', 'created_at'),
      ('mood_submissions', 'user_id', 'submitted_at'),
      ('feed_community_posts', 'author_user_id', 'created_at'),
      ('feed_community_replies', 'author_user_id', 'created_at'),
      ('feed_community_post_reactions', 'user_id', 'created_at'),
      ('peer_programming_messages', 'author_user_id', 'created_at'),
      ('level_up_dispute_comments', 'actor_user_id', 'created_at'),
      -- Command trails: one row per command the member ran, actor and time from their own request.
      ('account_restrictions_audit', 'actor_id', 'created_at'),
      ('announcement_membership_events', 'actor_id', 'created_at'),
      ('beacon_events_admin_audit_trail', 'actor_id', 'created_at'),
      ('contributions_audit_log', 'actor_user_id', 'created_at'),
      ('contributor_access_audit_trail', 'actor_id', 'created_at'),
      ('directory_profile_change_events', 'actor_id', 'created_at'),
      ('feed_membership_events', 'actor_id', 'created_at'),
      ('foundation_admin_audit_trail', 'actor_id', 'created_at'),
      ('foundation_quote_status_events', 'actor_user_id', 'created_at'),
      ('gdp_admin_audit_trail', 'actor_id', 'created_at'),
      ('level_up_audit_events', 'actor_id', 'created_at'),
      ('lighthouse_admin_audit_trail', 'actor_id', 'created_at'),
      ('llm_inference_log', 'actor_user_id', 'created_at'),
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
      ('trust_admin_audit_trail', 'actor_user_id', 'created_at'),
      ('trust_transport_admin_audit_trail', 'actor_id', 'created_at'),
      ('trust_transport_status_events', 'actor_user_id', 'created_at'),
      ('unlock_audit_log', 'actor_user_id', 'created_at'),
      ('weekly_performance_audit_trail', 'actor_id', 'created_at'),
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
      'INSERT INTO _login_gap_evidence (user_id, activity_day, first_seen)
       SELECT btrim(%1$I),
              (%2$I AT TIME ZONE ''UTC'')::date,
              MIN(%2$I)
       FROM public.%3$I
       WHERE %2$I >= $1 AND %2$I < $2
         AND %1$I IS NOT NULL
         AND btrim(%1$I) <> ''''
         AND btrim(%1$I) <> ALL ($3)
       GROUP BY 1, 2',
      src.user_column, src.date_column, src.table_name
    ) USING gap_start, gap_end, non_member_actors;
  END LOOP;

  -- Production's login_events carries a v2 foreign key to users(id), so a sign-in row can only exist
  -- for an account the identity mirror still holds. The command trails outlive that mirror: an
  -- account deleted since the gap leaves its audit rows behind, and those rows are evidence of a
  -- session that did happen but whose member is gone. Inserting for them is both impossible and
  -- wrong, so they are dropped here rather than at the insert — where one orphan aborted the whole
  -- statement and wrote nothing at all. Reported, not silent: a skipped day is a real day that
  -- cannot be recovered, and the operator should see the count.
  IF to_regclass('public.users') IS NOT NULL THEN
    DELETE FROM _login_gap_evidence e
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id);
    GET DIAGNOSTICS skipped = ROW_COUNT;
    IF skipped > 0 THEN
      RAISE NOTICE
        'Skipped % row(s) of evidence whose member is no longer in the users table; their days cannot be rebuilt.',
        skipped;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO evidence_days, evidence_members
  FROM (SELECT DISTINCT user_id, activity_day FROM _login_gap_evidence) d;

  RAISE NOTICE 'Evidence in the gap: % member-day(s) across % member(s).', evidence_days, evidence_members;

  -- A line per day, so the repair is legible rather than a single number to take on trust. The gap
  -- is 23 days, so this is bounded and short.
  FOR src IN
    SELECT activity_day, COUNT(DISTINCT user_id) AS members
    FROM _login_gap_evidence
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
    INSERT INTO login_events (user_id, created_at, source)
    SELECT e.user_id, MIN(e.first_seen), 'backfill_launch_gap'
    FROM _login_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO login_events (user_id, created_at)
    SELECT e.user_id, MIN(e.first_seen)
    FROM _login_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS written = ROW_COUNT;
  RAISE NOTICE 'Sign-in days written: %. Re-running this migration writes 0.', written;

  DROP TABLE _login_gap_evidence;
END
$$;
