-- Drop the two legacy columns of service_credits_dispute_adjustments that nothing reads or writes.
--
-- Why: the table came over from the v2 database with dispute_id UUID NOT NULL and
-- adjustment_amount NUMERIC NOT NULL. The v3 code records an adjustment's case in dispute_case_id
-- and its amount in amount, and never touches the two old columns. schema.sql relaxed them to
-- nullable so inserts stopped failing; this removes them so nothing is left to drift. A copy of the
-- table in the demo schema still had them as NOT NULL, which refuses every demo dispute adjustment,
-- so that copy is dropped here too.
--
-- Safe to re-run: DROP COLUMN IF EXISTS on a table guarded by IF EXISTS is a no-op once the
-- columns are gone, and on a database without a demo schema. No index, constraint or view is
-- defined on either column.
ALTER TABLE IF EXISTS service_credits_dispute_adjustments
  DROP COLUMN IF EXISTS dispute_id,
  DROP COLUMN IF EXISTS adjustment_amount;

ALTER TABLE IF EXISTS demo.service_credits_dispute_adjustments
  DROP COLUMN IF EXISTS dispute_id,
  DROP COLUMN IF EXISTS adjustment_amount;
