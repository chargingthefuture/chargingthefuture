-- 0002_socket_relay_v2_to_v3_rebuild.sql  (pre-schema migration)
--
-- Why: same v2 -> v3 drift as lighthouse (0001). In the v2 database socket_relay_requests (and the
-- tables schema.sql rebuilds around it) use varchar ids, but v3 adds
-- socket_relay_request_accepted_currencies with a uuid foreign key to socket_relay_requests(id). A
-- uuid foreign key cannot reference a varchar key, so applying schema.sql against a v2 database
-- aborts there and leaves every table defined later in the file uncreated. The owner is treating the
-- v2 SocketRelay data as disposable (handled/recreated before launch).
--
-- What: when (and only when) the drift is present, drop the schema.sql-managed drifted socket-relay
-- tables so the canonical CREATE TABLE statements recreate them with uuid ids. CASCADE clears the
-- old inter-table foreign keys. The v2-only socket_relay_profiles and socket_relay_announcements are
-- not defined in schema.sql and do not block the apply, so they are left untouched.
--
-- Idempotent / safe to re-run: guarded on socket_relay_requests.id still being a non-uuid type. After
-- this runs once the ids are uuid, so a second run is a no-op and never touches data. On a fresh
-- database the tables do not exist yet, so this is also a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'socket_relay_requests'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    DROP TABLE IF EXISTS
      socket_relay_messages,
      socket_relay_fulfillments,
      socket_relay_requests
    CASCADE;
  END IF;
END $$;
