-- Assign every Directory profile to one nominator (owner decision, 2026-09-30).
--
-- The owner brought in every person listed so far, through Skills Hunt or by adding them as an
-- admin, but only some of those were recorded against them. Run after post/0044, which fills
-- `directory_profiles.nominated_by_user_id` wherever the database already knows the nominator.
-- Paste into the Neon SQL editor as it is; nothing needs filling in.
--
-- The id is taken from the profiles post/0044 already filled, which are all the owner's. A lookup
-- by username was dropped: it returned no id when the username did not match a Skills Hunt row.
-- Both statements refuse to act unless exactly one nominator is recorded so far, so a second
-- person's nomination can never be overwritten by this file.

-- 1. Preview: the one recorded nominator, how many distinct nominators exist (must be 1), and how
--    many profiles change.
SELECT
  MIN(nominated_by_user_id) AS owner_user_id,
  COUNT(DISTINCT nominated_by_user_id) AS distinct_nominators,
  COUNT(*) AS profiles_total,
  COUNT(*) FILTER (WHERE nominated_by_user_id IS NULL) AS profiles_to_change
FROM directory_profiles;

-- 2. Assign. Claim state, source and the "Nominated by" handle are left as they are.
UPDATE directory_profiles
SET nominated_by_user_id = owner.id
FROM (
  SELECT MIN(nominated_by_user_id) AS id
  FROM directory_profiles
  WHERE nominated_by_user_id IS NOT NULL
  HAVING COUNT(DISTINCT nominated_by_user_id) = 1
) owner
WHERE directory_profiles.nominated_by_user_id IS NULL;
