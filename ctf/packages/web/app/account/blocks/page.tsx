import Link from 'next/link';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { BlockedMembersShell } from '@/components/blocks/blocked-members-shell';

// Blocked members surface: the signed-in member sees who they have blocked and can unblock anyone
// (issue #809, task 2). Auth posture matches the rest of the account area (`any_authenticated`):
// blocking is a baseline safety control available to any signed-in member, including unlock-pending
// users — never gated by approval state. The list and unblock action run through /api/account/blocks.
export default async function AccountBlocksPage() {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: 'any_authenticated',
  });

  if (!decision.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to manage blocked members</h1>
        <p className="text-sm text-muted-foreground">
          You need to be signed in to see and change who you have blocked.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/">Return to home</Link>
        </p>
      </main>
    );
  }

  return <BlockedMembersShell />;
}
