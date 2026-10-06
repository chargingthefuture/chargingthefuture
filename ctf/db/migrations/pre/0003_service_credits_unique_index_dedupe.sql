-- 0003_service_credits_unique_index_dedupe.sql  (pre-schema migration)
--
-- Why: schema.sql now creates three unique indexes the ServiceCredits ledger's ON CONFLICT targets
-- need: service_credits_transfers (sender_user_id, idempotency_key), service_credits_wallet_tombstones
-- (account_id, deletion_request_id) and service_credits_treasury_events (event_type, actor_id,
-- idempotency_key). CREATE UNIQUE INDEX fails if any rows already share a key, and that would stop
-- schema.sql part way through. Nothing in this repository created those indexes before, so a
-- database built from schema.sql refused every one of those upserts and can hold no duplicates from
-- the app; a database where somebody added them by hand cannot hold duplicates either. This runs
-- first anyway so the apply cannot fail on rows written some other way (a seed, a hand edit).
--
-- What: for each key, keep the earliest row as it is and give every later row with the same key a
-- distinct key. Nothing is deleted and no balance or amount changes:
--   - transfers and treasury events: append ':duplicate:<row id>' to the later rows' idempotency_key,
--     so a replay of the original key still finds the earliest row;
--   - wallet tombstones: keep the row a reclaim record points at (or else the earliest), and clear
--     deletion_request_id on the others. Their account id and final balances stay on the row.
--
-- Idempotent / safe to re-run: after one run no key is shared, so a second run changes nothing. On a
-- fresh database the tables do not exist yet, so this is a no-op; each step is also skipped when an
-- older database lacks the columns it reads.

DO $sc_unique_dedupe$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_transfers' AND column_name = 'idempotency_key'
  ) THEN
    UPDATE service_credits_transfers t
    SET idempotency_key = t.idempotency_key || ':duplicate:' || t.id::text
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY sender_user_id, idempotency_key ORDER BY created_at, id) AS rn
      FROM service_credits_transfers
    ) ranked
    WHERE ranked.id = t.id AND ranked.rn > 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_treasury_events' AND column_name = 'idempotency_key'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_treasury_events' AND column_name = 'actor_id'
  ) THEN
    UPDATE service_credits_treasury_events e
    SET idempotency_key = e.idempotency_key || ':duplicate:' || e.id::text
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY event_type, actor_id, idempotency_key ORDER BY created_at, id) AS rn
      FROM service_credits_treasury_events
      WHERE actor_id IS NOT NULL AND idempotency_key IS NOT NULL
    ) ranked
    WHERE ranked.id = e.id AND ranked.rn > 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_wallet_tombstones' AND column_name = 'deletion_request_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_wallet_tombstones' AND column_name = 'account_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_credits_account_deletion_reclaims' AND column_name = 'tombstone_id'
  ) THEN
    UPDATE service_credits_wallet_tombstones w
    SET deletion_request_id = NULL
    FROM (
      SELECT tomb.id,
        ROW_NUMBER() OVER (
          PARTITION BY tomb.account_id, tomb.deletion_request_id
          ORDER BY (EXISTS (
            SELECT 1 FROM service_credits_account_deletion_reclaims r WHERE r.tombstone_id = tomb.id
          )) DESC, tomb.created_at, tomb.id
        ) AS rn
      FROM service_credits_wallet_tombstones tomb
      WHERE tomb.account_id IS NOT NULL AND tomb.deletion_request_id IS NOT NULL
    ) ranked
    WHERE ranked.id = w.id AND ranked.rn > 1;
  END IF;
END
$sc_unique_dedupe$;
