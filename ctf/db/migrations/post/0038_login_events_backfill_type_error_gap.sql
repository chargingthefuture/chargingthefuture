-- post/0038: Rebuild the sign-in days lost while the sign-in write was refused for a type error.
--
-- `login_events` is the entire definition of an active member (owner decision, 2026-08-27). From
-- 2026-09-20 until the fix in PR #2519 (2026-09-24) the once-a-day write in
-- ctf/packages/web/lib/engagement/login-activity.ts used an uncast `$1` both as the inserted value
-- and in its duplicate check. Production's `user_id` is the v2 VARCHAR, not the TEXT schema.sql
-- declares, so Postgres refused the statement with "inconsistent types deduced for parameter $1"
-- and nobody's day was recorded. The Sign-in record screen showed 0 members on 2026-09-21 through
-- 2026-09-24 and one on 2026-09-20 (before the change deployed).
--
-- This rebuilds those days from the same first-party evidence post/0008 and post/0034 use: a
-- command-trail row naming the member as the actor, or a row the member wrote themselves. Unlike
-- post/0034 it applies to every member, because the failure did.
--
-- Properties:
--   * bounded    — the window is fixed, 2026-09-20 00:00 UTC to 2026-09-25 00:00 UTC. It never
--                  reads past it, so a later writer failure shows as a real absence and is not
--                  papered over by a re-run.
--   * guarded    — every source table and column is checked for existence before it is read.
--   * idempotent — WHERE NOT EXISTS on the (member, UTC day) pair plus ON CONFLICT DO NOTHING. A day
--                  the live writer did record (2026-09-20 before the break, 2026-09-24 after the
--                  fix) is left alone, and a re-run writes nothing new.
--   * honest     — rebuilt rows are marked `source = 'backfill_type_error_gap'` where the column
--                  exists. The timestamp is the member's earliest proven action that day.
--   * people only — a member id is a Clerk id (`user_…`); the platform's own actor ids are excluded.
--
-- Applied by the "Neon — Update DB" GitHub Action on the push to main. It reports the evidence
-- found, a line per day, and rows written.

DO $$
DECLARE
  repair_start CONSTANT timestamptz := TIMESTAMPTZ '2026-09-20 00:00:00+00';
  repair_end CONSTANT timestamptz := TIMESTAMPTZ '2026-09-25 00:00:00+00';
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

  CREATE TEMP TABLE _login_type_gap_evidence (
    user_id text NOT NULL,
    activity_day date NOT NULL,
    first_seen timestamptz NOT NULL
  );

  -- Every source is (table, member column, date column), read only for the window. Same list as
  -- post/0034.
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
      'INSERT INTO _login_type_gap_evidence (user_id, activity_day, first_seen)
       SELECT btrim(%1$I::text),
              (%2$I AT TIME ZONE ''UTC'')::date,
              MIN(%2$I)
       FROM public.%3$I
       WHERE %2$I >= $1 AND %2$I < $2
         AND %1$I IS NOT NULL
         AND btrim(%1$I::text) LIKE ''user\_%%''
         AND btrim(%1$I::text) <> ALL ($3)
       GROUP BY 1, 2',
      src.user_column, src.date_column, src.table_name
    ) USING repair_start, repair_end, non_member_actors;
  END LOOP;

  SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO evidence_days, evidence_members
  FROM (SELECT DISTINCT user_id, activity_day FROM _login_type_gap_evidence) d;

  RAISE NOTICE 'Evidence in the type-error window: % member-day(s) across % member(s).',
    evidence_days, evidence_members;

  FOR src IN
    SELECT activity_day, COUNT(DISTINCT user_id) AS members
    FROM _login_type_gap_evidence
    GROUP BY activity_day
    ORDER BY activity_day
  LOOP
    RAISE NOTICE '  % — % member(s) with evidence', src.activity_day, src.members;
  END LOOP;

  has_source := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'login_events' AND column_name = 'source'
  );

  -- `le.user_id::text` so the comparison is text on either column type (production's is VARCHAR).
  IF has_source THEN
    INSERT INTO public.login_events (user_id, created_at, source)
    SELECT e.user_id, MIN(e.first_seen), 'backfill_type_error_gap'
    FROM _login_type_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.login_events le
      WHERE le.user_id::text = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.login_events (user_id, created_at)
    SELECT e.user_id, MIN(e.first_seen)
    FROM _login_type_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.login_events le
      WHERE le.user_id::text = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS written = ROW_COUNT;
  RAISE NOTICE 'Sign-in days written: %. The window is fixed, so a re-run writes nothing new.', written;

  DROP TABLE _login_type_gap_evidence;
END
$$;
