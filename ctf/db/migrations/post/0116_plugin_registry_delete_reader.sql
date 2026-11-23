-- Reader is no longer an app (owner decision, 2026-11-23). The hosted feed reader its page sent
-- members to is shut down, so its row leaves the registry the apps list reads. Reader had no tables
-- of its own, so nothing else is removed.
--
-- schema.sql no longer seeds the row. Deleting a row that is already gone changes nothing, so a
-- second run is safe.
DELETE FROM ctf_plugin_registry
WHERE plugin_slug = 'reader';
