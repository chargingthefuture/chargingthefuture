-- Fold the "Find Doctors" round into "2026 SkillsHunt" (owner decision, 2026-10-01).
--
-- Only one round is open at a time now, and "Find Doctors" is a mission, not a round. This moves the
-- nominations filed under Find Doctors into 2026 SkillsHunt and closes Find Doctors. Paste into the
-- Neon SQL editor as it is. Run the preview first; run the move only if both round ids come back.
--
-- What it does not touch: ServiceCredits already sent stay sent, and every nomination keeps its
-- status, points and Directory profile. Find Doctors' own missions stay with the closed round.
-- The round is closed here rather than from the Rounds tab, because closing there awards the
-- round's "Leaderboard Champion" badge to its top three, and this round is being folded away rather
-- than finished.
--
-- After it runs, on the admin Rounds tab press "Rebuild leaderboard" on both rounds, then on the
-- Missions tab for 2026 SkillsHunt press "Recompute progress", and add the Find Doctors mission there.

-- 1. Preview: both rounds, how many nominations move, and how many cannot (the same person is
--    already nominated in 2026 SkillsHunt; those stay where they are).
WITH fd AS (SELECT id FROM skills_hunt_rounds WHERE name = 'Find Doctors' LIMIT 1),
     main AS (SELECT id FROM skills_hunt_rounds WHERE name = '2026 SkillsHunt' LIMIT 1)
SELECT
  (SELECT id FROM fd) AS find_doctors_round_id,
  (SELECT id FROM main) AS skillshunt_2026_round_id,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM skills_hunt_submissions t
    WHERE t.round_id = (SELECT id FROM main) AND t.signature_hash = s.signature_hash
      AND t.deleted_at IS NULL AND t.status <> 'rejected')) AS nominations_to_move,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM skills_hunt_submissions t
    WHERE t.round_id = (SELECT id FROM main) AND t.signature_hash = s.signature_hash
      AND t.deleted_at IS NULL AND t.status <> 'rejected')) AS already_in_2026
FROM skills_hunt_submissions s
WHERE s.round_id = (SELECT id FROM fd);

-- 2. Move the nominations and close Find Doctors, together.
BEGIN;
WITH fd AS (SELECT id FROM skills_hunt_rounds WHERE name = 'Find Doctors' LIMIT 1),
     main AS (SELECT id FROM skills_hunt_rounds WHERE name = '2026 SkillsHunt' LIMIT 1)
UPDATE skills_hunt_submissions s
SET round_id = (SELECT id FROM main), updated_at = NOW()
WHERE s.round_id = (SELECT id FROM fd)
  AND (SELECT id FROM main) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM skills_hunt_submissions t
    WHERE t.round_id = (SELECT id FROM main) AND t.signature_hash = s.signature_hash
      AND t.deleted_at IS NULL AND t.status <> 'rejected');
UPDATE skills_hunt_rounds
SET status = 'closed', updated_at = NOW()
WHERE name = 'Find Doctors' AND status = 'active'
  AND EXISTS (SELECT 1 FROM skills_hunt_rounds WHERE name = '2026 SkillsHunt');
COMMIT;
