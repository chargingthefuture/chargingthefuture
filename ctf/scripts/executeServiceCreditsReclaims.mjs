#!/usr/bin/env node

// Reclaim-execution sweep for ServiceCredits account-deletion reclaims.
//
// When an account is fully deleted, the deletion enqueues a reclaim as a `queued` row in
// service_credits_adapter_outbox (command `account.deletion.reclaim.execute`). The actual move of
// the wallet's balance to treasury (plus the wallet tombstone) is deferred: it only runs after a
// 7-day grace window, via the internal execute route. Nothing drained that queue, so reclaims sat
// queued forever and deleted members' credits stayed in circulation. This sweep is the missing
// drainer.
//
// For every `queued` reclaim row it POSTs the execute route (guarded by SERVICE_CREDITS_INTERNAL_TOKEN).
// The route enforces the 7-day window, moves the balance, and flips the outbox row to `delivered`, so
// this is idempotent and safe to run repeatedly:
//   - 200            -> reclaimed (balance moved to treasury this run).
//   - 409 window/escrow -> not due yet (or escrow held); left queued, retried next run. Not an error.
//   - other non-200  -> a real failure; logged, left queued for the next run.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_APP_URL (or APP_URL), SERVICE_CREDITS_INTERNAL_TOKEN.
// Scheduled (daily) + manual. When unconfigured it skips with a warning rather than failing red.

import { Pool } from 'pg';

function env(name) {
  return (process.env[name] || '').trim();
}

const DATABASE_URL = env('DATABASE_URL');
const APP_URL = env('NEXT_PUBLIC_APP_URL') || env('APP_URL');
const TOKEN = env('SERVICE_CREDITS_INTERNAL_TOKEN');

if (!DATABASE_URL || !APP_URL || !TOKEN) {
  console.warn(
    '[reclaim-sweep] skipped: needs DATABASE_URL, NEXT_PUBLIC_APP_URL, and SERVICE_CREDITS_INTERNAL_TOKEN. Nothing was reclaimed.',
  );
  process.exit(0);
}

const base = APP_URL.replace(/\/+$/, '');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// 409 codes the execute route returns for an expected "not yet" state (not a failure).
const NOT_DUE_CODES = new Set([
  'service_credits_reclaim_window_not_elapsed',
  'service_credits_active_escrow_holds',
]);

async function main() {
  const { rows } = await pool.query(
    `SELECT payload
       FROM service_credits_adapter_outbox
      WHERE command_name = 'account.deletion.reclaim.execute'
        AND status = 'queued'
      ORDER BY updated_at ASC`,
  );

  console.log(`[reclaim-sweep] queued reclaims: ${rows.length}`);
  let reclaimed = 0;
  let notDue = 0;
  let failed = 0;

  for (const row of rows) {
    const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    if (!p || !p.accountId || !p.deletionRequestId) {
      failed += 1;
      console.error('[reclaim-sweep] skipping a queued row with no accountId/deletionRequestId.');
      continue;
    }

    const url =
      `${base}/api/internal/service-credits/accounts/${encodeURIComponent(p.accountId)}` +
      `/deletion-reclaims/${encodeURIComponent(p.deletionRequestId)}/execute`;

    let res;
    let text = '';
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-service-credits-internal-token': TOKEN },
        body: JSON.stringify({
          treasuryUserId: p.treasuryUserId,
          requestedAt: p.requestedAt,
          idempotencyKey: p.idempotencyKey,
          requestId: p.requestId,
          traceId: p.traceId,
        }),
      });
      text = await res.text();
    } catch (error) {
      failed += 1;
      console.error(`[reclaim-sweep] request error for account ${p.accountId}: ${error instanceof Error ? error.message : error}`);
      continue;
    }

    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* no-trace: a non-JSON body leaves `body` null, which the caller already handles */
    }

    if (res.ok) {
      reclaimed += 1;
      const amount = body?.reclaim?.amountTransferred ?? '?';
      console.log(`[reclaim-sweep] reclaimed account ${p.accountId} — moved ${amount} to treasury.`);
    } else if (res.status === 409 && body?.code && NOT_DUE_CODES.has(body.code)) {
      notDue += 1;
      console.log(`[reclaim-sweep] not due yet for account ${p.accountId} (${body.code}); will retry next run.`);
    } else {
      failed += 1;
      console.error(`[reclaim-sweep] execute failed for account ${p.accountId} (HTTP ${res.status}): ${text}`);
    }
  }

  console.log(`[reclaim-sweep] done: ${reclaimed} reclaimed, ${notDue} not due, ${failed} failed.`);
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('[reclaim-sweep] fatal:', error instanceof Error ? error.message : error);
    pool.end();
    process.exit(1);
  });
