-- Fireside: an author can rewrite their own comment, and the thread says when they did.
--
-- Until now the only way to fix a typo was to take the comment down and write it again, which
-- costs the replies under it, every reaction on it, and its place in the conversation (owner
-- report, 2026-09-17). The Commons has had the answer since it shipped: an author rewrites their
-- own reply in place, the row keeps its id, and an "edited" mark appears beside it so nobody reads
-- changed words as the originals. This column is that mark.
--
-- Null until the author changes something, so an untouched comment carries nothing at all and the
-- mark means what it says.

ALTER TABLE IF EXISTS fireside_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN fireside_comments.edited_at IS
  'When the author last rewrote this comment, or NULL if they never did. Shown beside the comment as an "edited" mark, so changed words never read as the originals.';
