// External-store cleanup for account/service deletion.
//
// The account deletion registry + orchestrator delete a user's *Postgres* rows in one transaction.
// But some plugins also write user content to an EXTERNAL store — chiefly GetStream (chat messages
// fanned out under a `<prefix>-<userId>` Stream user). A Postgres-only delete leaves that copy behind
// (Stream retains messages with no expiry by default), which is a privacy gap.
//
// This module is the single seam for that: a map from plugin slug (the SAME slug used in
// `deletion-registry.ts`) to a cleanup function. The orchestrator runs the relevant cleanup(s) AFTER
// the DB transaction commits — never inside it, so an external network call can't hold the DB
// transaction open or couple its failure to a rollback. Every entry point that deletes a user
// (`full-account` route, generic `services/[slug]` route, the internal delete route, and the Clerk
// webhook) goes through the orchestrator, so wiring it here covers them all at once.
//
// Contract for a cleanup function: best-effort. It should either resolve on success or throw on
// failure; the orchestrator wraps each call in try/catch + reportError, so a throw is logged and the
// user's deletion still completes. It must never assume it can block the deletion.

import { deleteChymeStreamData } from 'lib/chyme/stream';
import { deleteFoundationStreamData } from 'lib/foundation/stream';
import { deleteLighthouseStreamData } from 'lib/lighthouse/stream';
import { deleteSocketRelayStreamData } from 'lib/socket-relay/stream';
import { deleteTrustTransportStreamData } from 'lib/trust-transport/stream';

export type ExternalCleanup = (userId: string) => Promise<void>;

// Each plugin's Stream cleanup returns a boolean (true = deleted; false = Stream unconfigured or the
// call failed) and never throws. Wrap it so a `false` surfaces as a throw — the orchestrator logs that
// via reportError, and the user's deletion still completes.
function fromBoolean(label: string, cleanup: (userId: string) => Promise<boolean>): ExternalCleanup {
  return async (userId) => {
    const ok = await cleanup(userId);
    if (!ok) {
      throw new Error(`${label} Stream cleanup did not complete (Stream unconfigured or delete failed)`);
    }
  };
}

export const externalCleanupRegistry: Readonly<Record<string, ExternalCleanup>> = {
  // Keys are the same plugin slugs used in deletion-registry.ts.
  chyme: fromBoolean('Chyme', deleteChymeStreamData),
  foundation: fromBoolean('Foundation', deleteFoundationStreamData),
  lighthouse: fromBoolean('Lighthouse', deleteLighthouseStreamData),
  'socket-relay': fromBoolean('SocketRelay', deleteSocketRelayStreamData),
  'trust-transport': fromBoolean('TrustTransport', deleteTrustTransportStreamData),
  // Beacon still to come — it needs a deletion-registry entry added first (it has none today).
};

export function getExternalCleanup(slug: string): ExternalCleanup | undefined {
  return externalCleanupRegistry[slug];
}
