-- Weekly Performance is no longer an app (owner decision, 2026-10-16). Its dashboard is a section of
-- the admin Adoption screen (/admin/adoption) and nowhere else, so its row leaves the registry the
-- apps list reads. Its data, routes and audit trail are untouched; the Adoption screen reads them.
--
-- schema.sql no longer seeds the row. Deleting a row that is already gone changes nothing, so a
-- second run is safe.
DELETE FROM ctf_plugin_registry
WHERE plugin_slug = 'weekly-performance';
