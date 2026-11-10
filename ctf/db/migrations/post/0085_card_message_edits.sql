-- Safe to re-run.
-- card_messages.edited_at: when the author last changed a message in a Today card, empty when it was
-- never changed. The sheet shows "Edited" beside a changed message. A message the author deletes is
-- removed outright, so nothing else is needed for that.
ALTER TABLE IF EXISTS card_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
