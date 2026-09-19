-- Chyme moderation: a speak mode per room, a removed-members list, and an admin audit trail.
--
-- Owner decision, 2026-09-19. Until now Chyme was open social audio with no moderator: every
-- joiner could speak and nobody could be muted or removed. An admin can now mute a member's
-- microphone, remove a member from a room (kept out until an admin lets them back in), and
-- switch a room to hand-raise mode, where a joiner listens until an admin lets them speak.
--
-- speak_mode defaults to 'open', which is the room exactly as it shipped; nothing changes for a
-- room nobody has switched. Only 'open' and 'hand_raise' are written by the app.

ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS speak_mode TEXT NOT NULL DEFAULT 'open';

COMMENT ON COLUMN chyme_rooms.speak_mode IS
  'open: every joiner may speak (the default). hand_raise: a joiner listens until an admin lets them speak; roles ride on chyme_room_members.role.';

CREATE TABLE IF NOT EXISTS chyme_room_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NULL,
  removed_by TEXT NOT NULL,
  reason TEXT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ NULL,
  lifted_by TEXT NULL
);
ALTER TABLE IF EXISTS chyme_room_removals ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE IF EXISTS chyme_room_removals ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS chyme_room_removals ADD COLUMN IF NOT EXISTS lifted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS chyme_room_removals ADD COLUMN IF NOT EXISTS lifted_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chyme_room_removals_active
  ON chyme_room_removals(room_id, user_id) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chyme_room_removals_user ON chyme_room_removals(user_id);

COMMENT ON TABLE chyme_room_removals IS
  'A member an admin removed from a Chyme room. Keeps them out (join and heartbeat refuse) while lifted_at is null; lifted rows stay as the record.';

CREATE TABLE IF NOT EXISTS chyme_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS chyme_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS chyme_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_chyme_admin_audit_trail_lookup
  ON chyme_admin_audit_trail (created_at DESC, actor_id, command);

COMMENT ON TABLE chyme_admin_audit_trail IS
  'Every Chyme admin action (mute, remove, let back in, role change, speak mode), in the shape every other plugin''s durable admin trail uses.';
