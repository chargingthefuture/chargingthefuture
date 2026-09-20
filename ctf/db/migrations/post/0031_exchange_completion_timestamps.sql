-- When a SocketRelay fulfillment was closed, and when a LightHouse stay was completed.
--
-- Both tables recorded the outcome and not the moment. SocketRelay's close button already asks
-- whether it went well and writes `close_reason`; LightHouse moves a match to 'completed'. Neither
-- wrote a time, so anything counting these by day had to fall back to `updated_at`, which any later
-- edit to the row moves — a stay from March could land on today because somebody touched the row.
--
-- The daily exchange reading counts members per day, so a moving date moves a member between days.
-- Hence a column that is written once and left alone.
--
-- Safe to replay: both columns are added only if missing, and the backfill only fills rows that are
-- still empty.

ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS lighthouse_matches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill from `updated_at` for rows that are already finished. It is the best evidence the
-- database holds for these rows and it is what the reading used before this migration, so the
-- figures do not jump; every row closed from here on carries a real time instead.
UPDATE socket_relay_fulfillments
   SET closed_at = updated_at
 WHERE closed_at IS NULL
   AND close_reason IS NOT NULL;

UPDATE lighthouse_matches
   SET completed_at = updated_at
 WHERE completed_at IS NULL
   AND status = 'completed';
