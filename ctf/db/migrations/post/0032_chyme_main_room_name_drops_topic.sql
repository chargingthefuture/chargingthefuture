-- Chyme: the main room's name drops its fixed topic.
--
-- The room shipped as "Chyme Main Room: Exit the Gauntlet". That name dates from before the TI
-- Radio guide: one standing subject was the only way to say what the room was for. Hosts now book
-- their own slots and name their own topic, so a name announcing one subject contradicts whatever
-- is actually on air, and a visitor reading it has no way to tell which of the two to believe.
-- What is being discussed comes from the booked slot instead, shown in "Coming up on TI Radio"
-- with the slot on air marked.
--
-- The app rewrites this name from its own constant whenever a member opens the room
-- (`ensureRoom`, ON CONFLICT DO UPDATE SET room_name), so this statement is what changes it for a
-- signed-out visitor reading the public room before any member has opened it since the deploy.
-- Matched on the row's value rather than blindly, so a name the owner has since set by hand is
-- left alone.

UPDATE chyme_rooms
SET room_name = 'Chyme Main Room'
WHERE room_key = 'chyme-main-room'
  AND room_name = 'Chyme Main Room: Exit the Gauntlet';
