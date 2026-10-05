-- 0003_skill_up_milestone_validations_dedupe.sql  (pre-schema migration)
--
-- Why: validateMilestone writes skill_up_milestone_validations with
-- ON CONFLICT (enrollment_id, milestone_id), and Postgres refuses that clause unless a unique index
-- covers those two columns. None existed, so every validate failed and no milestone could be
-- released. schema.sql now creates uq_skill_up_milestone_validations_enrollment_milestone. If the
-- table already held two rows for one enrollment and milestone, that CREATE UNIQUE INDEX would fail
-- and stop the schema load, so this runs first and leaves one row per pair.
--
-- What: when the table exists and the index does not, delete every row for an (enrollment,
-- milestone) pair except one. The row kept is, in order: a released row (the record that credits
-- moved), then a validated one, then the most recent by released_at, validated_at, created_at.
-- Rows are matched by ctid (the row's physical address) so this works whatever shape the id column
-- has on an older database. Handles the table under its older names too (levelup_ and level_up_),
-- since schema.sql renames them only after this file runs.
--
-- Safe to re-run: guarded on the unique index being absent. Once schema.sql has created it, duplicates
-- cannot exist and this does nothing. On a fresh database the table does not exist yet, so this is
-- also a no-op.

DO $$
DECLARE
  target TEXT;
BEGIN
  IF to_regclass('uq_skill_up_milestone_validations_enrollment_milestone') IS NOT NULL THEN
    RETURN;
  END IF;

  IF to_regclass('skill_up_milestone_validations') IS NOT NULL THEN
    target := 'skill_up_milestone_validations';
  ELSIF to_regclass('level_up_milestone_validations') IS NOT NULL THEN
    target := 'level_up_milestone_validations';
  ELSIF to_regclass('levelup_milestone_validations') IS NOT NULL THEN
    target := 'levelup_milestone_validations';
  ELSE
    RETURN;
  END IF;

  EXECUTE format(
    'DELETE FROM %1$I v
     USING (
       SELECT ctid AS row_ctid,
              ROW_NUMBER() OVER (
                PARTITION BY enrollment_id, milestone_id
                ORDER BY (status = ''released'') DESC,
                         (status = ''validated'') DESC,
                         COALESCE(released_at, validated_at, created_at) DESC NULLS LAST
              ) AS rn
       FROM %1$I
     ) ranked
     WHERE v.ctid = ranked.row_ctid AND ranked.rn > 1',
    target
  );
END $$;
