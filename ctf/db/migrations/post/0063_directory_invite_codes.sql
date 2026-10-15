-- post/0063: A random code for each Directory invitation.
--
-- Why: a direct link to one invitation used the person's Quora handle
-- (?invite=<handle>), and the public invite route answered that person's card for any handle it was
-- given, so anybody could confirm who has an invitation by guessing handles. Each invitation now
-- carries a random code made by the private invite repository, and a signed-out visitor can open one
-- by its code only. A signed-in reader may still follow an older link by handle.
--
-- What it does: adds invite_code (TEXT, nullable: ten lower-case letters and digits, checked by the
-- route that writes it) to directory_invites, and a unique index over the rows that have one.
--
-- Safe to re-run: IF NOT EXISTS on the column and the index.
BEGIN;
ALTER TABLE IF EXISTS directory_invites ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_invites_invite_code ON directory_invites (invite_code) WHERE invite_code IS NOT NULL;
COMMIT;
