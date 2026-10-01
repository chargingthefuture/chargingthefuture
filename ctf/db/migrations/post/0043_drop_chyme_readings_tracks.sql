-- post/0043: Drop chyme_readings_tracks.
--
-- The Chyme readings loop no longer keeps its own playlist. It plays the list the blog publishes at
-- build time (readings.json: every post with a recording in the blog's content/audio), so uploading
-- the audio file to the blog is the only step and there is nothing to type into the app (owner
-- decision, 2026-09-29). The table held admin-entered links only, no member data. Guarded with
-- IF EXISTS so it no-ops on a database that never had it, and idempotent.
DROP TABLE IF EXISTS chyme_readings_tracks;
