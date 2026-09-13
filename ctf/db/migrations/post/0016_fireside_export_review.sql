-- Fireside: an admin has to approve a comment before it is copied into the blog's published build.
--
-- The author opting in was the only condition before this, and one condition is not enough here.
-- The build is a public, permanently archived page that sits beside the project's own writing, so
-- an account made to post spam or bait could put that text next to real content and nobody could
-- pull it back afterwards. Two keys instead: the author asks, and an admin agrees. Neither alone
-- does anything.
--
-- A refusal is also a record. Repeated refusals against one account answer a different question
-- than any single comment does — whether the account belongs here at all — which is cheaper to act
-- on once than to chase item by item.

ALTER TABLE IF EXISTS fireside_comments
  ADD COLUMN IF NOT EXISTS export_review TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS export_reviewed_by TEXT;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS export_reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS export_refusal_reason TEXT;

-- Added separately from the column so a database that already carries the column still gains the
-- check, and so re-running this file is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fireside_comments_export_review_check'
  ) THEN
    ALTER TABLE fireside_comments
      ADD CONSTRAINT fireside_comments_export_review_check
      CHECK (export_review IN ('not_requested','pending','approved','refused'));
  END IF;
END $$;

-- The admin queue reads pending requests oldest first, so the wait is fair and the index matches.
CREATE INDEX IF NOT EXISTS fireside_comments_export_review_idx
  ON fireside_comments (export_review, created_at);

-- The apps list reads ctf_plugin_registry, not the array in packages/web/lib/plugins/repository.ts.
-- That array is only the fallback for an empty or unreadable table, which never happens in
-- production, so a plugin with no row here has no tile and members cannot reach it. Fireside was
-- added to the array and not to this table, so it shipped invisible. Upsert, so re-running is safe
-- and so a fresh database seeded from schema.sql lands on the same values.
INSERT INTO ctf_plugin_registry (plugin_slug, display_name, summary, availability_state, nav_rank, is_visible)
VALUES (
  'fireside',
  'Fireside',
  'Threaded conversation under the posts on the blog. Anyone can read it; writing needs an account, and what you write goes public once you are approved.',
  'implemented_shell',
  260,
  TRUE
)
ON CONFLICT (plugin_slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  summary            = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank           = EXCLUDED.nav_rank,
  is_visible         = EXCLUDED.is_visible,
  updated_at         = NOW();
