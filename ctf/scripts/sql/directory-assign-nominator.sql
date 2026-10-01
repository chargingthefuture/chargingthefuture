-- Assign every Directory profile to one nominator (owner decision, 2026-09-30).
--
-- The owner brought in every person listed so far, through Skills Hunt or by adding them as an
-- admin, but only nominations made through Skills Hunt were recorded against them. Run after
-- post/0044 has added `directory_profiles.nominated_by_user_id`. Paste into the Neon SQL editor with
-- the owner's Skills Hunt username in place of YOUR_USERNAME, in both statements.
--
-- The user id is read from the owner's own Skills Hunt nominations, because there is no other v3
-- table that maps a username to an id. If the first statement returns no user id, stop: the
-- username did not match and the second statement would set nothing.

-- 1. Preview: the id that will be written, and how many profiles change.
SELECT
  (SELECT submitter_user_id FROM skills_hunt_submissions
   WHERE LOWER(submitter_username) = LOWER('YOUR_USERNAME') LIMIT 1) AS owner_user_id,
  COUNT(*) AS profiles_total,
  COUNT(*) FILTER (WHERE nominated_by_user_id IS DISTINCT FROM (
    SELECT submitter_user_id FROM skills_hunt_submissions
    WHERE LOWER(submitter_username) = LOWER('YOUR_USERNAME') LIMIT 1)) AS profiles_to_change
FROM directory_profiles;

-- 2. Assign. The claim state, source and "Nominated by" handle are left as they are.
UPDATE directory_profiles
SET nominated_by_user_id = owner.id
FROM (
  SELECT submitter_user_id AS id FROM skills_hunt_submissions
  WHERE LOWER(submitter_username) = LOWER('YOUR_USERNAME') LIMIT 1
) owner
WHERE owner.id IS NOT NULL
  AND directory_profiles.nominated_by_user_id IS DISTINCT FROM owner.id;
