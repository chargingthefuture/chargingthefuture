-- Directory and SkillsHunt: re-key every stored Quora URL to one canonical form per link.
--
-- The same defect fixed in Unlock on 2026-09-18, in the two other places that key on a Quora URL.
-- Both had their own copy of the "normalize" rules (lib/directory/quora-url.ts and a private
-- function in lib/skills-hunt/repository.ts), kept in step by a comment; both stripped the query and
-- hash, then returned the URL otherwise as typed. So one page had as many stored forms as there are
-- ways to write it:
--
--   https://www.quora.com/profile/Mary-T-I-1     https://quora.com/profile/Mary-T-I-1
--   http://www.quora.com/profile/Mary-T-I-1      https://www.quora.com/profile/Mary-T-I-1/
--   https://es.quora.com/profile/Mary-T-I-1      https://www.quora.com/profile/mary-t-i-1
--
-- What that cost:
--   * Directory's takedown list is matched by exact string, so a profile somebody asked to have
--     removed could be re-listed by a nomination that dropped `www.` or changed the casing.
--   * SkillsHunt's per-round identity is the normalized URL, so the same person could be nominated
--     more than once in a round, and the "first match" bonus could be paid to more than one scout
--     for the same person.
--
-- Both now call lib/shared/quora-url.ts, which returns https://www.quora.com + the lowercased path
-- with trailing slashes removed. This migration rewrites the rows already stored, because a fixed
-- function reading unfixed rows keeps the same blindness for everything recorded before today.
--
-- It re-keys and nothing else: no takedown is lifted or applied, no nomination is accepted, rejected
-- or rescored, and no points move. Duplicates it brings to light are for a human to look at.
--
-- Re-runnable: canonicalizing an already-canonical value returns it unchanged, so a second run
-- updates nothing.
--
-- One transaction, added 2026-09-21 after this file failed on re-run. The workflow reaches Neon
-- through its connection pooler, which may hand each statement outside a transaction to a
-- different server session. The function below is session-local (`pg_temp`), so on a run where the
-- CREATE landed on one session and the first UPDATE on another, the UPDATE failed with
-- `schema "pg_temp" does not exist` and every later migration in the run was skipped. Inside one
-- transaction every statement runs on the session that holds the function. This is the only edit
-- to an applied migration: it changes where the statements run, not what they do.
BEGIN;

-- The rules above, in SQL, session-local so nothing is left behind in the database. Kept beside the
-- statements that use it rather than duplicated into each one.
CREATE OR REPLACE FUNCTION pg_temp.canonical_quora_url(value text) RETURNS text AS $$
DECLARE
  host text;
  path text;
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;

  host := lower(substring(btrim(value) from '^https?://([^/]+)'));
  path := substring(btrim(value) from '^https?://[^/]+(/[^?#]*)');

  IF host IS NULL OR path IS NULL THEN
    RETURN NULL;
  END IF;

  -- quora.com itself or a subdomain of it, and nothing else: "ends with quora.com" would also
  -- accept evil-quora.com, which is a different site.
  IF host <> 'quora.com' AND host NOT LIKE '%.quora.com' THEN
    RETURN NULL;
  END IF;

  path := lower(regexp_replace(path, '/+$', ''));
  IF length(path) < 2 THEN
    RETURN NULL;
  END IF;

  RETURN 'https://www.quora.com' || path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1) SkillsHunt nominations. The per-round uniqueness is on (round_id, signature_hash), not on this
--    column, so rows collapsing onto one canonical URL is exactly what should happen and cannot
--    collide. The column is what the "first match" bonus and the per-URL reads compare.
UPDATE skills_hunt_submissions
   SET quora_profile_url_normalized = pg_temp.canonical_quora_url(quora_profile_url_normalized)
 WHERE pg_temp.canonical_quora_url(quora_profile_url_normalized) IS NOT NULL
   AND quora_profile_url_normalized <> pg_temp.canonical_quora_url(quora_profile_url_normalized);

-- 2) The Quora URL change history. No uniqueness here either; these columns are the trail an admin
--    reads, so they should read in the same form as everything else.
UPDATE directory_quora_url_history
   SET new_url_normalized = pg_temp.canonical_quora_url(new_url_normalized)
 WHERE pg_temp.canonical_quora_url(new_url_normalized) IS NOT NULL
   AND new_url_normalized <> pg_temp.canonical_quora_url(new_url_normalized);

UPDATE directory_quora_url_history
   SET previous_url_normalized = pg_temp.canonical_quora_url(previous_url_normalized)
 WHERE previous_url_normalized IS NOT NULL
   AND pg_temp.canonical_quora_url(previous_url_normalized) IS NOT NULL
   AND previous_url_normalized <> pg_temp.canonical_quora_url(previous_url_normalized);

-- 3) The takedown list. Lifted rows (is_overridden = true) are outside the unique index, so they
--    re-key freely.
UPDATE directory_suppressed_quora_urls
   SET normalized_url = pg_temp.canonical_quora_url(normalized_url)
 WHERE is_overridden = true
   AND pg_temp.canonical_quora_url(normalized_url) IS NOT NULL
   AND normalized_url <> pg_temp.canonical_quora_url(normalized_url);

--    Active rows are covered by a partial unique index on normalized_url, so two spellings of one
--    link cannot both be re-keyed. One row per canonical link is re-keyed and becomes the row that
--    blocks; the others keep their old spelling and stop matching anything, which is safe — the
--    lookup canonicalizes the incoming URL, so the re-keyed row is what it hits. They are left in
--    place rather than deleted because a takedown row is a record of somebody's request.
--
--    A row already in canonical form is preferred as the one to keep, so an existing canonical row
--    is never displaced by an older differently-spelled one.
WITH ranked AS (
  SELECT
    id,
    pg_temp.canonical_quora_url(normalized_url) AS canonical,
    row_number() OVER (
      PARTITION BY pg_temp.canonical_quora_url(normalized_url)
      ORDER BY (normalized_url = pg_temp.canonical_quora_url(normalized_url)) DESC, created_at, id
    ) AS rank_in_group
  FROM directory_suppressed_quora_urls
  WHERE is_overridden = false
    AND pg_temp.canonical_quora_url(normalized_url) IS NOT NULL
)
UPDATE directory_suppressed_quora_urls AS target
   SET normalized_url = ranked.canonical
  FROM ranked
 WHERE target.id = ranked.id
   AND ranked.rank_in_group = 1
   AND target.normalized_url <> ranked.canonical;

COMMIT;
