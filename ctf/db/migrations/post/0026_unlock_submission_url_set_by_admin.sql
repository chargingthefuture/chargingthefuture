-- Unlock: say who put the Quora URL that is stored on a submission.
--
-- An admin can now enter a Quora URL for a member who never gave one — the member asked for help,
-- left a name or a link in the help box, and the admin looked them up by hand — and can correct one
-- that is wrong. Both write the same column the member's own submission writes, so without this the
-- row reads exactly as if the member had typed it. The approval decision turns on that difference:
-- "this person proved they are real" and "an admin found this profile for them" are not the same
-- claim, and an admin reviewing the queue next month has to be able to tell them apart.
--
-- url_set_by_admin_user_id is null for every row a member submitted themselves, which is every row
-- that exists today — hence no backfill. It is cleared again the moment a member submits their own
-- URL over the top, because it describes where the currently stored URL came from, not what has ever
-- happened to the row. The durable trail of every change lives in directory_quora_url_history, which
-- these paths also write, with the admin as changed_by_user_id and 'unlock_admin' as the source.
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS url_set_by_admin_user_id TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS url_set_by_admin_at TIMESTAMPTZ;
