-- post/0039: Rebuild the type-error days from visits, not only from writes.
--
-- post/0038 rebuilt the member-days lost from 2026-09-20 to 2026-09-24, when the sign-in write was
-- refused with "inconsistent types deduced for parameter $1". It read only rows a member wrote or a
-- command they ran, so a member who signed in and looked around without writing anything stayed
-- missing — and a sign-in, not a write, is what makes a member active (owner decision, 2026-08-27).
--
-- This reads the app's "last seen" markers, which are written only for a signed-in member opening
-- a screen:
--   * feed_commons_last_seen.last_seen_at — the member opened the Commons feed;
--   * feed_commons_notice_seen.seen_at     — the member was shown a Commons notice on arrival;
--   * chyme_room_members.last_seen_at      — the member was present in a Chyme room;
--   * chyme_room_members.joined_at         — the member joined a Chyme room;
--   * admin_area_seen.seen_at              — an admin opened an admin area.
-- Apart from joined_at, each keeps only the latest time per member (per notice, room, or area), so a later visit has
-- overwritten earlier ones. A marker adds a day only when its latest time falls inside the window;
-- days it has overwritten cannot be recovered from anywhere in the database.
--
-- Same window, guards and marking as post/0038: fixed window 2026-09-20 00:00 UTC to 2026-09-25
-- 00:00 UTC, every source checked for existence, WHERE NOT EXISTS plus ON CONFLICT DO NOTHING, rows
-- marked `source = 'backfill_type_error_gap'`, Clerk ids (`user_…`) only. A re-run writes nothing
-- new, and the fixed window means it can never cover a later writer failure.
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

  CREATE TEMP TABLE _login_visit_gap_evidence (
    user_id text NOT NULL,
    activity_day date NOT NULL,
    first_seen timestamptz NOT NULL
  );

  -- Every source is (table, member column, date column), read only for the window.
  FOR src IN
    SELECT * FROM (VALUES
      ('feed_commons_last_seen', 'user_id', 'last_seen_at'),
      ('feed_commons_notice_seen', 'user_id', 'seen_at'),
      ('chyme_room_members', 'user_id', 'last_seen_at'),
      ('chyme_room_members', 'user_id', 'joined_at'),
      ('admin_area_seen', 'user_id', 'seen_at')
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
      'INSERT INTO _login_visit_gap_evidence (user_id, activity_day, first_seen)
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
  FROM (SELECT DISTINCT user_id, activity_day FROM _login_visit_gap_evidence) d;

  RAISE NOTICE 'Visit evidence in the type-error window: % member-day(s) across % member(s).',
    evidence_days, evidence_members;

  FOR src IN
    SELECT activity_day, COUNT(DISTINCT user_id) AS members
    FROM _login_visit_gap_evidence
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
    FROM _login_visit_gap_evidence e
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
    FROM _login_visit_gap_evidence e
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

  DROP TABLE _login_visit_gap_evidence;
END
$$;
