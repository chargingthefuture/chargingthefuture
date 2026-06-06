import Link from 'next/link';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { AccountDataShell } from '@/components/account-data/account-data-shell';

// Account & Data surface: the signed-in user can see the personal data the platform holds per
// service, delete that data one service at a time, or delete their whole account. Auth posture
// matches the account deletion API (`requireAccountAccess`): any signed-in identity, including
// unlock-pending users, may exercise their right to be forgotten — so deletion is never gated by
// approval state. The mutations themselves run through the live DELETE routes under /api/account/**.
export default async function AccountDataPage() {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    requireApprovedUserOrAdmin: false,
    allowUnlockSupportOnly: true,
  });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to manage your data</h1>
        <p className="text-sm text-muted-foreground">
          You need to be signed in to see and delete the data the platform holds for you.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/">Return to home</Link>
        </p>
      </main>
    );
  }

  return <AccountDataShell />;
}
