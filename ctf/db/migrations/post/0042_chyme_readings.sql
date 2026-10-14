-- schema.sql carries the same CREATE TABLEs. This migration makes the tables appear in production on
-- the same run, alongside the other post migrations.
-- Chyme readings loop: recorded readings of the blog posts, played on the Chyme page while nobody is
-- live. A temporary module (owner decision, 2026-09-28): switched off once people start showing up,
-- then deleted. To remove it, drop both tables in a later migration.
--
-- chyme_readings_config: one row, the on/off switch. No row means off.
CREATE TABLE IF NOT EXISTS chyme_readings_config (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS chyme_readings_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS chyme_readings_config ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;
ALTER TABLE IF EXISTS chyme_readings_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- chyme_readings_tracks: the playlist, played in the order added. audio_url points at a file hosted
-- elsewhere (for example the blog's own site); duration_seconds is read from the file by the admin's
-- browser when the track is added, so every listener can be placed at the same point in the loop.
CREATE TABLE IF NOT EXISTS chyme_readings_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  post_url TEXT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  added_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL;
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS post_url TEXT NULL;
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL;
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL;
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS added_by TEXT NULL;
ALTER TABLE IF EXISTS chyme_readings_tracks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_chyme_readings_tracks_order ON chyme_readings_tracks (created_at, id);
