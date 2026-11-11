-- post/0090: Announcement replies move into the shared conversation store.
--
-- Owner decision, 2026-11-10: 3.0 and 3.1 share one backend, so an announcement's replies and the
-- conversation under its Today card are one thread. Commons holds that store
-- (commons_item_messages); an announcement's thread is plugin 'commons', item
-- 'announcement:<announcement id>'. The store gains the Commons moderation columns, so every card
-- conversation can be hidden and restored by an admin. Every reply is copied with its id, author,
-- words, times and moderation state; the copy is checked, and announcement_replies is dropped only
-- when every reply is there. Production and the demo schema. Safe to re-run.

ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS commons_item_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_commons_item_messages_hidden ON commons_item_messages(created_at) WHERE moderation_status = 'hidden';

DO $$
DECLARE
  missing INTEGER;
BEGIN
  IF to_regclass('announcement_replies') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO commons_item_messages
    (id, plugin, item_id, author_id, body, created_at, edited_at, updated_at,
     moderation_status, moderation_reason, moderated_by_user_id, moderated_at)
  SELECT r.id, 'commons', 'announcement:' || r.announcement_id::text, r.author_user_id, btrim(r.body),
         r.created_at, r.edited_at, r.updated_at,
         COALESCE(r.moderation_status, 'accepted'), r.moderation_reason, r.moderated_by_user_id, r.moderated_at
  FROM announcement_replies r
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO missing
  FROM announcement_replies r
  WHERE NOT EXISTS (SELECT 1 FROM commons_item_messages m WHERE m.id = r.id);
  IF missing > 0 THEN
    RAISE EXCEPTION 'post/0090: % announcement replies were not copied; announcement_replies is kept', missing;
  END IF;

  DROP TABLE announcement_replies;
END $$;
