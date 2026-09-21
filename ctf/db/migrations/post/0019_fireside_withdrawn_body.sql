-- Fireside: an author keeps their own copy of a comment they took down.
--
-- Withdrawing emptied `body`, so the words were gone for everybody including the person who wrote
-- them. On their own screen the comment became the single word "Withdrawn." with no way to see what
-- it had said (owner report, 2026-09-14). That is worse than it sounds: taking a comment down
-- cannot be undone, so the moment a member most needs to see what they wrote is the moment after
-- they have destroyed it, when they are checking whether they meant to.
--
-- `body` still empties, and nothing about who can read what changes. This column is the author's
-- own copy: it is read only on /api/fireside/mine, which returns the caller's own rows and nothing
-- else, and it is never selected by the public thread read or by the blog export feed. Deleting the
-- account still takes it, because that deletes the entire row.

ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS withdrawn_body TEXT;

COMMENT ON COLUMN fireside_comments.withdrawn_body IS
  'What the author wrote, kept for the author alone after they take a comment down. Never returned by the public thread read or the blog export feed.';
