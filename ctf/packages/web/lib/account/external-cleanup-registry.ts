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

export type ExternalCleanup = (userId: string) => Promise<void>;

export const externalCleanupRegistry: Readonly<Record<string, ExternalCleanup>> = {
  chyme: async (userId) => {
    const ok = await deleteChymeStreamData(userId);
    // deleteChymeStreamData already swallows its own errors and returns false; surface that as a throw
    // so the orchestrator logs it (and the deletion still succeeds).
    if (!ok) {
      throw new Error('Chyme Stream cleanup did not complete (Stream unconfigured or delete failed)');
    }
  },
  // Follow-ups wire the other chat plugins here: foundation, lighthouse, socket-relay, trust-transport
  // (each hard-deletes its own `<prefix>-<userId>` Stream user), and Beacon once it has a registry entry.
};

export function getExternalCleanup(slug: string): ExternalCleanup | undefined {
  return externalCleanupRegistry[slug];
}
