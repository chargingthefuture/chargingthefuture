-- Empties every table in the demo schema, so Seed Demo starts from nothing. Used by
-- .github/workflows/seed-demo.yml when "start fresh" is on, before the demo schema is rebuilt
-- from schema.demo.sql and seeded. Touches the demo schema only: it refuses to run if any table
-- outside demo has a foreign key into a demo table, and it never uses CASCADE, so nothing outside
-- demo can be emptied by it.
DO $$
DECLARE
  outside text;
  tables text;
BEGIN
  SELECT string_agg(DISTINCT con.conrelid::regclass::text, ', ')
    INTO outside
    FROM pg_constraint con
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace refns ON refns.oid = ref.relnamespace
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_namespace srcns ON srcns.oid = src.relnamespace
   WHERE con.contype = 'f' AND refns.nspname = 'demo' AND srcns.nspname <> 'demo';
  IF outside IS NOT NULL THEN
    RAISE EXCEPTION 'Not emptying the demo schema: tables outside it reference demo tables (%)', outside;
  END IF;

  SELECT string_agg(format('demo.%I', tablename), ', ')
    INTO tables
    FROM pg_tables
   WHERE schemaname = 'demo';
  IF tables IS NULL THEN
    RAISE NOTICE 'The demo schema has no tables yet; nothing to empty.';
    RETURN;
  END IF;
  EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY';
  RAISE NOTICE 'Emptied every table in the demo schema.';
END $$;
