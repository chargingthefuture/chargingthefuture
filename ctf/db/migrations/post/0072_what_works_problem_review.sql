-- Members propose What Works problems, and each waits for review (3.1.0, owner-approved plan).
--
-- review_status: 'approved' for every problem already on the list and every one an admin adds,
-- 'pending' for one a member proposed until an admin approves it, merges it into an existing
-- problem, or deletes it as spam. proposed_by is the member who proposed it, used only to cap how
-- many a member can have waiting; it is never returned by a reader or admin read, and account
-- deletion overwrites it. The demo schema gets the same columns. Safe to re-run.
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS proposed_by TEXT;
DO $what_works_review_status_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'what_works_problems_review_status_check') THEN
    ALTER TABLE what_works_problems
      ADD CONSTRAINT what_works_problems_review_status_check CHECK (review_status IN ('pending', 'approved'));
  END IF;
END
$what_works_review_status_check$;
CREATE INDEX IF NOT EXISTS idx_what_works_problems_pending ON what_works_problems(proposed_by) WHERE review_status = 'pending';

ALTER TABLE IF EXISTS demo.what_works_problems ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE IF EXISTS demo.what_works_problems ADD COLUMN IF NOT EXISTS proposed_by TEXT;
