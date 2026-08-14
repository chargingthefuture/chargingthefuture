import Link from 'next/link';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readTrustSelfExtensionOrStored } from 'lib/trust/repository';
import type { TrustUserExtension } from 'lib/trust/types';
import { AccountHubShell } from '@/components/account/account-hub-shell';

// Unified account hub. Rule 114 means there is no single profile table — each plugin extends the one
// identity — so this page is not a single edit form: it is the one place that gathers everything that
// makes up "you" and points to where each part is actually managed (Clerk identity, Quora
// verification, Trust, the skills profile, housing listings, and data/deletion). Auth posture matches
// /account/data: any signed-in identity, including unlock-pending users, can reach it.
function buildFallbackTrust(userId: string): TrustUserExtension {
  return {
    userId,
    trustEvidence: [],
    updatedAt: new Date().toISOString(),
  };
}

export default async function AccountPage() {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: 'any_authenticated',
  });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to manage your account</h1>
        <p className="text-sm text-muted-foreground">
          You need to be signed in to see and update your account.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/">Return to home</Link>
        </p>
      </main>
    );
  }

  // Recompute before rendering (throttled, with a fallback to the last stored evidence) so the card
  // shows the member's participation as it is now. A plain read froze this page's card at whatever
  // the last self-API call had written, which could be weeks earlier.
  const trust = await readTrustSelfExtensionOrStored(decision.userId).catch(() => buildFallbackTrust(decision.userId));
  const username = decision.username && decision.username !== 'guest' ? decision.username : null;

  return <AccountHubShell username={username} trust={trust} />;
}
