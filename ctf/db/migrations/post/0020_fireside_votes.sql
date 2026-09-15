-- Fireside: voting, which does not change what order anything is read in.
--
-- The point of this plugin is to be an alternative to a platform where what gets read is decided by
-- what was voted on. So a vote here is a count beside a comment and nothing else: comments stay in
-- the order they were written, oldest first, and nothing reads a vote total to decide position.
--
-- A downvote is recorded and never counted in public. What it should eventually do — cancel an
-- upvote, or be read only as feedback — is not decided yet (owner, 2026-09-14), and showing a
-- number now would settle that by accident. The application keeps it out of every count it builds;
-- this file only makes the row storable.

ALTER TABLE IF EXISTS fireside_reactions DROP CONSTRAINT IF EXISTS fireside_reactions_kind_check;

ALTER TABLE IF EXISTS fireside_reactions
  ADD CONSTRAINT fireside_reactions_kind_check
  CHECK (kind IN ('recognize','helpful','same_here','upvote','downvote'));

COMMENT ON COLUMN fireside_reactions.kind IS
  'One of the three reactions, or a vote. A downvote is stored and never returned as a count to anybody.';
