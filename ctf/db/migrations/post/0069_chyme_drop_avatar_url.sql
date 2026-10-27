-- Drop avatar_url from Chyme's room members and room messages.
--
-- Why (owner decision, 3.1.0): members show only as a picture generated from their account id, and
-- no uploaded photo is shown or kept. Every write already stored NULL here and nothing read it. The
-- demo schema's copies go too. Safe to re-run: every statement is guarded by IF EXISTS.
ALTER TABLE IF EXISTS chyme_room_members DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE IF EXISTS chyme_messages DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE IF EXISTS demo.chyme_room_members DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE IF EXISTS demo.chyme_messages DROP COLUMN IF EXISTS avatar_url;
