-- TI Radio: the slot table, its audit trail, and the plugin registry row. Safe to re-run;
-- every object is IF NOT EXISTS and the registry row is an upsert.

-- ============================================================================
-- TI Radio — a published schedule of live discussions members host in Chyme
-- ----------------------------------------------------------------------------
-- The shape is a broadcast guide. A fixed grid of 90-minute slots runs a week ahead; a member
-- claims an empty one, says what it is about, and whoever wants it turns up in Chyme at that time.
-- First come, first served, settled by the unique index below rather than by a read-then-write.
--
-- The grid itself is never stored. Only bookings are rows, so an empty slot costs nothing and the
-- guide can be lengthened by changing one constant in lib/ti-radio/constants.ts.
--
-- Reading the guide needs no account at all: it is written for readers who have not joined yet, the
-- page's job is to get somebody into Chyme at the time it names, and a broadcast guide nobody can
-- read is not a guide. Claiming a slot needs Unlock approval, like everything else in this app.
--
-- Distinct from Mutual Time, which stays admin-only. There the owner asks a group when they can
-- meet and the app picks the hour with the most overlap. Here nobody is asked anything.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ti_radio_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The start of the 90 minutes, always on a 90-minute boundary counted from midnight UTC. The end
  -- is not stored: every slot is the same length, and a second column could disagree with the first.
  slot_start_utc TIMESTAMPTZ NOT NULL,
  host_user_id TEXT NOT NULL,
  -- The name printed on the guide, written at booking the way other tables here denormalize a
  -- handle. Stored rather than joined: the public read must not touch an identity table at all.
  host_username TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT,
  -- 'booked' is a live slot on the guide. 'released' is the host handing it back, and 'removed' is
  -- an admin taking it down; both keep the row so the record of who held a time survives, and both
  -- free the slot for somebody else because only 'booked' rows occupy the grid.
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','released','removed')),
  released_at TIMESTAMPTZ,
  removed_by TEXT,
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS slot_start_utc TIMESTAMPTZ;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS host_user_id TEXT;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS host_username TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'booked';
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS removed_by TEXT;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS ti_radio_slots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- First come, first served, decided here. Two members pressing Host on the same empty slot at the
-- same moment both reach the insert; the index lets one through and the other is told plainly that
-- somebody just took it. A check-then-insert in application code would let both through.
CREATE UNIQUE INDEX IF NOT EXISTS ti_radio_slots_booked_start_key
  ON ti_radio_slots (slot_start_utc) WHERE status = 'booked';
-- The guide reads one week of booked slots in start order, and the booking ceiling reads one
-- member's slots inside a 24-hour window either side of the time they are claiming.
CREATE INDEX IF NOT EXISTS ti_radio_slots_start_idx ON ti_radio_slots (slot_start_utc);
CREATE INDEX IF NOT EXISTS ti_radio_slots_host_idx ON ti_radio_slots (host_user_id, slot_start_utc);

-- Every command that changes the guide writes a row here. A log line on the server is not a record:
-- nothing can query it and it ages out of the host's retention window. This app has one admin, so
-- the person who can take a member's slot off a public schedule is the only person who could hide
-- having done it, and the answer to that is a record rather than fewer powers.
CREATE TABLE IF NOT EXISTS ti_radio_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS ti_radio_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS ti_radio_admin_audit_trail_created_idx
  ON ti_radio_admin_audit_trail (created_at DESC, actor_id, command);

-- The apps list reads this table; the array in packages/web/lib/plugins/repository.ts is only a
-- fallback for an empty one, which never happens in production. An existing database is not
-- re-seeded by schema.sql, so without this row the plugin ships with working routes and no tile.
INSERT INTO ctf_plugin_registry (plugin_slug, display_name, summary, availability_state, nav_rank, is_visible) VALUES
  ('ti-radio', 'TI Radio', 'A schedule of live discussions members host in Chyme. Anyone can read the guide; take an empty 90 minutes and it is yours to host.', 'implemented_shell', 270, TRUE)
ON CONFLICT (plugin_slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  summary            = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank           = EXCLUDED.nav_rank,
  is_visible         = EXCLUDED.is_visible,
  updated_at         = NOW();
