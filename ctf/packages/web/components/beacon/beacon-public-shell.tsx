'use client';

// Beacon viewer for an anonymous (signed-out) visitor. Watching is public over HLS — this is the
// no-account path. The viewer shows the player and a "sign in to chat" prompt; an anonymous visitor
// cannot obtain a chat token, so the chat stays read/sign-in-gated on the server side too.
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { BeaconViewer } from './beacon-viewer';

export function BeaconPublicShell({ signInUrl }: PublicVisitorShellProps) {
  return <BeaconViewer signInUrl={signInUrl} isMember={false} />;
}
