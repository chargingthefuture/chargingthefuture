-- Where one Quora link was stored under more than one spelling, in Directory and SkillsHunt.
--
-- Written for the owner to paste into the Neon dashboard. Read-only: it changes nothing. Safe before
-- or after 0027_canonical_quora_urls_directory_skills_hunt.sql, because it canonicalizes inside the
-- query — which is how it finds pairs the stored columns still spell differently.
--
-- Background: until 2026-09-18 both plugins stored a "normalized" Quora URL that still carried
-- whatever scheme, host, path casing and trailing slash the person typed, so one link had several
-- stored forms. See the migration for the full account.
--
-- Run each query on its own.

-- The rules, session-local.
CREATE OR REPLACE FUNCTION pg_temp.canonical_quora_url(value text) RETURNS text AS $$
DECLARE
  host text;
  path text;
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN NULL; END IF;
  host := lower(substring(btrim(value) from '^https?://([^/]+)'));
  path := substring(btrim(value) from '^https?://[^/]+(/[^?#]*)');
  IF host IS NULL OR path IS NULL THEN RETURN NULL; END IF;
  IF host <> 'quora.com' AND host NOT LIKE '%.quora.com' THEN RETURN NULL; END IF;
  path := lower(regexp_replace(path, '/+$', ''));
  IF length(path) < 2 THEN RETURN NULL; END IF;
  RETURN 'https://www.quora.com' || path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1) SkillsHunt: people nominated more than once inside one round. `spellings` above 1 means those
--    nominations were not recognized as the same person at the time, so the per-round duplicate
--    guard did not fire and more than one scout could have taken the first-match bonus.
SELECT
  s.round_id,
  pg_temp.canonical_quora_url(s.quora_profile_url_normalized) AS person,
  COUNT(*) AS nominations,
  COUNT(DISTINCT s.quora_profile_url_normalized) AS spellings,
  COUNT(*) FILTER (WHERE s.status = 'accepted') AS accepted,
  array_agg(DISTINCT s.submitter_user_id) AS scouts
FROM skills_hunt_submissions s
WHERE s.deleted_at IS NULL
  AND s.status <> 'rejected'
  AND pg_temp.canonical_quora_url(s.quora_profile_url_normalized) IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1
ORDER BY spellings DESC, nominations DESC;

-- 2) Directory: takedown entries recorded more than once for one link. After the migration one of
--    them does the blocking and the others are kept only as the record of the request, so more than
--    one row here is expected and is not a problem — it is here so the count is explainable.
SELECT
  pg_temp.canonical_quora_url(normalized_url) AS link,
  COUNT(*) AS rows_recorded,
  COUNT(*) FILTER (WHERE is_overridden = false) AS still_blocking,
  array_agg(normalized_url ORDER BY created_at) AS stored_as
FROM directory_suppressed_quora_urls
WHERE pg_temp.canonical_quora_url(normalized_url) IS NOT NULL
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY rows_recorded DESC;
