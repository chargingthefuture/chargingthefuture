-- post/0070: Drop the SkillsHunt scout leaderboard.
--
-- Owner decision, 3.1.0: the scout leaderboard is deleted with its code and data. Each member still
-- sees their own nomination counts (My Finds), and missions stay. End-of-round awards now read each
-- scout's score from accepted nominations and completed missions directly
-- (lib/skills-hunt/round-awards.ts), so nothing reads this table. The "Leaderboard Champion" badge
-- and the "You're in the top 10" notifications it produced go with it. Past audit rows naming the
-- rebuild stay. The demo schema's copies go too. Safe to re-run: every statement is guarded.
DROP TABLE IF EXISTS skills_hunt_leaderboard;
DELETE FROM skills_hunt_achievements WHERE code = 'leaderboard-champion';
DELETE FROM skills_hunt_notifications WHERE kind = 'leaderboard-top-ten';

DROP TABLE IF EXISTS demo.skills_hunt_leaderboard;
DO $demo_skills_hunt_leaderboard_rows$
BEGIN
  IF to_regclass('demo.skills_hunt_achievements') IS NOT NULL THEN
    DELETE FROM demo.skills_hunt_achievements WHERE code = 'leaderboard-champion';
  END IF;
  IF to_regclass('demo.skills_hunt_notifications') IS NOT NULL THEN
    DELETE FROM demo.skills_hunt_notifications WHERE kind = 'leaderboard-top-ten';
  END IF;
END
$demo_skills_hunt_leaderboard_rows$;
