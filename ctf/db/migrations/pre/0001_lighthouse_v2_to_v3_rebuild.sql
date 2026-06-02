-- 0001_lighthouse_v2_to_v3_rebuild.sql  (pre-schema migration)
--
-- Why: the live v2 database (and any clone of it) has an old LightHouse schema that predates the
-- v3 UUID switch. lighthouse_profiles / lighthouse_properties / lighthouse_matches use varchar ids
-- and varchar foreign keys between them, and lighthouse_announcements is a v2-only table. The v3
-- canonical schema (schema.sql) declares these tables with uuid ids; a uuid foreign key cannot
-- reference a varchar key, so applying schema.sql against a v2 database aborts at the first such
-- foreign key and leaves every table defined later in schema.sql (including the comic_* tables)
-- uncreated. The owner reviewed the small amount of v2 data and chose to discard it (the single
-- property is being recreated by hand and affected users contacted before launch).
--
-- What: when (and only when) the v2 drift is present, drop the drifted LightHouse tables so the
-- canonical CREATE TABLE statements in schema.sql recreate profiles/properties/matches fresh with
-- uuid ids and jsonb columns. lighthouse_announcements is v2-only and not defined in schema.sql, so
-- it is simply dropped and not recreated. CASCADE clears the old inter-table foreign keys.
--
-- Idempotent / safe to re-run: the guard keys off lighthouse_properties.id still being a non-uuid
-- type. After this runs once the ids are uuid, so a second run is a no-op and never touches data.
-- On a fresh database the tables do not exist yet, so this is also a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'lighthouse_properties'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    DROP TABLE IF EXISTS
      lighthouse_matches,
      lighthouse_properties,
      lighthouse_profiles,
      lighthouse_announcements
    CASCADE;
  END IF;
END $$;
