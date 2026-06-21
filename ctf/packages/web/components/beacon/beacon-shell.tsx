'use client';

// Beacon viewer for a signed-in member. Watching is public; a member additionally gets the live
// chat. Members are already authenticated, so the sign-in CTA is never shown to them.
import { BeaconViewer } from './beacon-viewer';

export function BeaconShell() {
  return <BeaconViewer signInUrl="/sign-in" isMember />;
}
