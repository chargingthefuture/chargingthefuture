-- post/0014: let somebody enroll again in a cohort they left before it started.
--
-- Owner bug report 2026-09-13: leave a cohort, change your mind, and enrolling again is refused.
--
-- The table carried an unconditional UNIQUE (cohort_id, user_id). Leaving does not delete the
-- enrollment - it sets status to 'dropped' and keeps the row as the record of what happened - so
-- that row went on holding the slot forever and the database refused every later attempt.
--
-- The code has always disagreed with the index. assertEnrollmentSeatAvailable counts only
-- status IN ('enrolled','active'), so a dropped row occupies no seat as far as the application is
-- concerned; the seat check passed and the INSERT then failed on the constraint. This is the same
-- fault, in the same shape, as the SkillsHunt duplicate guard fixed on 2026-08-27: a blanket unique
-- index where the code's rule is a partial one.
--
-- The predicate excludes 'dropped' only. A live enrollment still blocks a second one, and a
-- completed cohort is not re-enrollable either - finishing is not a reason to start again.
--
-- The unconditional rule arrived as an inline UNIQUE (cohort_id, user_id) in the CREATE TABLE, which
-- makes it a table constraint, not a bare index. Postgres refuses DROP INDEX on a constraint's
-- backing index and points at the constraint instead, so the first version of this migration failed
-- on every database that had one - which is every database. Retire the constraint first, then the
-- index, then build the partial one.
ALTER TABLE IF EXISTS skill_up_enrollments
  DROP CONSTRAINT IF EXISTS skill_up_enrollments_cohort_id_user_id_key;
DROP INDEX IF EXISTS skill_up_enrollments_cohort_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS skill_up_enrollments_cohort_id_user_id_key
  ON skill_up_enrollments (cohort_id, user_id)
  WHERE status <> 'dropped';
