-- LightHouse: let a member publish what they are looking for, not only what they have to offer.
--
-- Until now LightHouse only showed supply. A member who is thinking about offering a room sees an
-- empty-looking board and no sign that anyone needs one, which is the wrong signal on this product:
-- the side with the most people on it is the side asking. These two columns let the housing need a
-- member already fills in be shown on its own tab.
--
-- `is_wanted_public` defaults FALSE, so no seeker who already saved their details has anything
-- become visible by running this migration — publishing is a separate, explicit choice on the
-- "Your details" screen. `desired_city` gives the need a place name, matching the city a listing
-- carries.

ALTER TABLE IF EXISTS lighthouse_profiles
  ADD COLUMN IF NOT EXISTS desired_city TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_wanted_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lighthouse_profiles_wanted_public
  ON lighthouse_profiles(updated_at DESC)
  WHERE is_wanted_public = TRUE AND is_active = TRUE AND service_deleted_at IS NULL;
