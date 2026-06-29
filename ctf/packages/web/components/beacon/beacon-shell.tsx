'use client';

// Beacon viewer for a signed-in member. Watching is public; a member additionally gets the live
// chat. Members are already authenticated, so the sign-in CTA is never shown to them.
import { Radio } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { BEACON_COLOR } from 'lib/beacon/constants';
import { BeaconViewer } from './beacon-viewer';

export function BeaconShell() {
  return (
    <>
      <MobileScreenHeader title="Beacon" accent={BEACON_COLOR} icon={<Radio size={18} color={BEACON_COLOR} />} />
      <BeaconViewer signInUrl="/sign-in" isMember />
    </>
  );
}
