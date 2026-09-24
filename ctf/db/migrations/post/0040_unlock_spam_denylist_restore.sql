-- post/0040: Put back the Unlock spam denylist entries a failed run of post/0028 deleted.
--
-- On 2026-09-24 the "Neon — Update DB" run deleted one row from `unlock_spam_quora_urls` and failed
-- before re-inserting it (post/0028 stashed the rows in a TEMP table, and the connection pooler ran
-- the re-insert on a session that could not see it; post/0028 now runs as one transaction). A profile
-- missing from the denylist can return to the review queue on a fresh account without being blocked.
--
-- Every spam decision is also kept on the member's submission (`review_status = 'spam'`), and the
-- review code writes the denylist from exactly that row. So the missing entries are rebuilt from
-- spam submissions whose canonical URL is not on the denylist, with one exception: a URL an admin
-- removed by hand (`unlock.admin.spam_denylist.remove` in `unlock_audit_log`) after the spam
-- decision stays removed, because that removal was a decision.
--
-- It also catches an entry whose best-effort denylist write failed at review time, which is the same
-- gap for the same reason.
--
-- Limit: the denylist outlives a member's data deletion, their submission does not. If the deleted
-- row belonged to an account deleted since, nothing in the database still holds it; the run then
-- reports 0 restored and the entry can only come back from Neon's history.
--
-- Single statement (a DO block), so it cannot be split across pooled sessions. Idempotent: an entry
-- already present is skipped (WHERE NOT EXISTS plus ON CONFLICT DO NOTHING), so a re-run restores
-- nothing new. It reports the count restored.

DO $$
DECLARE
  restored bigint;
BEGIN
  IF to_regclass('public.unlock_spam_quora_urls') IS NULL
     OR to_regclass('public.unlock_verification_submissions') IS NULL THEN
    RAISE NOTICE 'Unlock tables are not present in this database; nothing to restore.';
    RETURN;
  END IF;

  WITH spam AS (
    SELECT DISTINCT ON (canonical)
           canonical,
           s.quora_profile_url,
           s.reviewed_by_user_id,
           COALESCE(s.reviewed_at, s.updated_at, NOW()) AS decided_at
    FROM (
      SELECT sub.*,
             'https://www.quora.com/profile/'
               || lower(substring(sub.quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)')) AS canonical
      FROM public.unlock_verification_submissions sub
      WHERE sub.review_status = 'spam'
        AND substring(sub.quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)') IS NOT NULL
    ) s
    ORDER BY canonical, COALESCE(s.reviewed_at, s.updated_at) DESC NULLS LAST
  )
  INSERT INTO public.unlock_spam_quora_urls (
    quora_profile_url_normalized,
    quora_profile_url,
    flagged_by_user_id,
    flag_count,
    first_flagged_at,
    last_flagged_at,
    updated_at
  )
  SELECT spam.canonical, spam.quora_profile_url, spam.reviewed_by_user_id, 1, spam.decided_at, spam.decided_at, NOW()
  FROM spam
  WHERE NOT EXISTS (
      SELECT 1 FROM public.unlock_spam_quora_urls d
      WHERE d.quora_profile_url_normalized = spam.canonical
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.unlock_audit_log a
      WHERE a.command = 'unlock.admin.spam_denylist.remove'
        AND a.created_at >= spam.decided_at
        AND 'https://www.quora.com/profile/'
              || lower(substring(a.metadata->>'quoraProfileUrlNormalized' from 'quora\.com/profile/([^/?#]+)'))
            = spam.canonical
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS restored = ROW_COUNT;
  RAISE NOTICE 'Spam denylist entries restored from spam decisions: %.', restored;
END
$$;
