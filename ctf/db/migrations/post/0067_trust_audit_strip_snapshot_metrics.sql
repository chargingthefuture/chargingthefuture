-- Strip the copied metric bundle from old Trust snapshot refresh audit rows.
--
-- Why (owner decision, 2026-10-17; issue #2847): until #3165, POST /api/trust/signal/snapshot wrote
-- its audit row with metadata.metrics, a full copy of the snapshot: the exact last sign-in time,
-- sign-in counts and every per-plugin participation count. trust_admin_audit_trail is retained when a
-- member deletes their Trust data or their account, so that copy outlived the snapshot it came from.
-- New rows no longer carry it. This removes it from the rows written before.
--
-- What it does: removes the metrics key from every trust.signal.snapshot.refresh row that has one.
-- The rest of each row stays: who, when, the snapshot id and the evidence count.
--
-- Safe to re-run: a row without the key is not matched, and the demo schema's copy is handled the
-- same way when it exists.
UPDATE trust_admin_audit_trail
   SET metadata = metadata - 'metrics'
 WHERE command = 'trust.signal.snapshot.refresh'
   AND metadata ? 'metrics';

DO $$
BEGIN
  IF to_regclass('demo.trust_admin_audit_trail') IS NOT NULL THEN
    UPDATE demo.trust_admin_audit_trail
       SET metadata = metadata - 'metrics'
     WHERE command = 'trust.signal.snapshot.refresh'
       AND metadata ? 'metrics';
  END IF;
END $$;
