-- Remove the ntfy line from /admin/expenses (added 2026-10-01).
--
-- Why: ntfy was only used by the Route Weather Briefing workflow, which was removed because it never
-- ran (no route was configured, so every scheduled run was skipped). Nothing else in the app sends
-- ntfy messages, so the line names a service the app does not use. post/0041 is left as it is
-- because it has already run; this step takes the line out instead.
--
-- What it does: deletes the line with post/0041's fixed id for ntfy, and records the removal in
-- admin_expenses_audit_trail the same way a removal on the screen is recorded (command
-- admin.expenses.delete, the row before, nothing after), so the list still shows what was cut.
--
-- Safe to re-run: it acts only while that row exists. After the first run there is nothing to delete
-- and nothing is recorded. The audit row also keeps post/0041 from writing its starting list again,
-- since post/0041 writes only while the audit trail is empty.
WITH removed AS (
  DELETE FROM admin_expenses
  WHERE id = '5e0a1c00-0000-4000-8000-000000000010'::uuid
  RETURNING id, provider, purpose, kind, billing, amount_cents, amount_max_cents, paid_on,
            last_checked_on, stopped_on, notes
)
INSERT INTO admin_expenses_audit_trail
  (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
SELECT
  'migration:post/0047',
  'admin.expenses.delete',
  'allow',
  'migration',
  'expense',
  removed.id::text,
  'success',
  NULL,
  jsonb_build_object(
    'before', jsonb_build_object(
      'provider', removed.provider, 'purpose', removed.purpose, 'kind', removed.kind,
      'billing', removed.billing, 'amountCents', removed.amount_cents,
      'amountMaxCents', removed.amount_max_cents, 'paidOn', removed.paid_on,
      'lastCheckedOn', removed.last_checked_on, 'stoppedOn', removed.stopped_on,
      'notes', removed.notes
    ),
    'after', NULL
  )
FROM removed;
