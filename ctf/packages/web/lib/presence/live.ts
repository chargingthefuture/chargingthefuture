import { reportError } from 'lib/observability/report';
import {
  deactivateMemberPresence,
  upsertMemberPresence,
  type DeactivateMemberPresenceInput,
  type UpsertMemberPresenceInput,
} from './repository';

// Live per-plugin presence write hooks.
//
// The cross-plugin "Also active in" index (member_plugin_presence) is kept current as members create
// and remove their listings. These wrappers are the single entry point each plugin's repository calls
// after a listing row is durably persisted.
//
// Best-effort by contract: a presence write must never break, roll back, or delay the listing
// operation that triggered it. Every wrapper swallows its own failure (a missing presence table on a
// fresh deploy, a transient database error) and reports it; it never rethrows. Callers must place the
// call after the listing row is committed and must not await it inside the listing's own transaction.

// Upsert one presence row for a member-owned listing. Idempotent; safe to call on both create and
// update. Failures are swallowed and reported.
export async function recordMemberPresence(input: UpsertMemberPresenceInput): Promise<void> {
  try {
    await upsertMemberPresence(input);
  } catch (error) {
    reportError(error, {
      area: 'presence',
      op: 'upsert',
      extra: {
        pluginSlug: input.pluginSlug,
        refType: input.refType,
        refId: input.refId,
      },
    });
  }
}

// Mark one presence row inactive when a member removes or closes a listing. Idempotent (a no-op if the
// row is absent or already inactive). Failures are swallowed and reported.
export async function clearMemberPresence(input: DeactivateMemberPresenceInput): Promise<void> {
  try {
    await deactivateMemberPresence(input);
  } catch (error) {
    reportError(error, {
      area: 'presence',
      op: 'deactivate',
      extra: {
        pluginSlug: input.pluginSlug,
        refType: input.refType,
        refId: input.refId,
      },
    });
  }
}
