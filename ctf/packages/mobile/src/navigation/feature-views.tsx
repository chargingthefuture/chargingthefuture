// Maps each screen key to the screen it renders. A plain lookup table (no branching) keeps the
// per-render selection in App.tsx trivial.

import React, { type ReactElement } from 'react';
import { ChymeReadingsAdmin, ChymeRoom, ChymeStreamUsage } from '../features/chyme';
import { Beacon, BeaconAdmin } from '../features/beacon';
import { PeerProgramming, PeerProgrammingAdmin } from '../features/peer-programming';
import { Foundation } from '../features/foundation';
import { AppsList } from '../features/apps';
import { AccountData } from '../features/account-data';
import { BlockedMembers } from '../features/blocks';
import { AccountHub } from '../features/account';
import { RecurringActivity } from '../features/recurring-activity';
import { Unlock } from '../features/unlock';
import type { FeatureKey } from './screens';

export type FeatureRenderers = Record<FeatureKey, () => ReactElement>;

export type FeatureViewContext = {
  open: (_key: FeatureKey) => void;
  /** Goes to the open screen's parent, for a screen that draws its own back control. */
  back: () => void;
  /** Re-runs the Unlock check, after the Unlock screen reads or changes the member's status. */
  onUnlockStatusChanged: () => void;
  /** The Unlock screen's way home: Apps, with a fresh Unlock check. */
  onUnlockGoHome: () => void;
  /** Opens Your account. */
  openAccount: () => void;
  /** Bumped by the admin refresh control; an admin screen keyed on it remounts and reloads. */
  refreshToken: number;
  /** The cohort PeerProgramming opens on (null: the member's own), as the web's ?cohortId=. */
  ppCohortId: string | null;
  /** Opens PeerProgramming on a cohort's room, as the web admin's "Open room" link does. */
  openPpRoom: (_cohortId: string | null) => void;
};

export function buildFeatureViews(ctx: FeatureViewContext): FeatureRenderers {
  const { open, refreshToken, ppCohortId, openPpRoom } = ctx;
  return {
    apps: () => <AppsList onOpen={open} />,
    // onBack serves the signed-out public page, which draws its own header with a back control.
    chyme: () => <ChymeRoom onBack={() => open('apps')} />,
    'chyme-admin': () => <ChymeStreamUsage key={refreshToken} onOpenReadings={() => open('chyme-readings')} />,
    'chyme-readings': () => <ChymeReadingsAdmin key={refreshToken} />,
    beacon: () => <Beacon />,
    'beacon-admin': () => <BeaconAdmin key={refreshToken} />,
    'peer-programming': () => (
      <PeerProgramming key={ppCohortId ?? 'own'} initialCohortId={ppCohortId} onOpenAdmin={() => open('peer-programming-admin')} />
    ),
    'peer-programming-admin': () => (
      <PeerProgrammingAdmin key={refreshToken} onOpenMember={() => openPpRoom(null)} onOpenRoom={(cohortId) => openPpRoom(cohortId)} />
    ),
    foundation: () => <Foundation />,
    ...accountViews(ctx),
  };
}

// Your account and the screens under it (web /account, /account/data, /account/blocks,
// /plugin/unlock and /apps/recurring-activity). The sub-screens draw their own header.
function accountViews(ctx: FeatureViewContext) {
  const { open, back } = ctx;
  return {
    account: () => (
      <AccountHub
        onOpenData={() => open('account-data')}
        onOpenBlocks={() => open('blocked-members')}
        onOpenVerification={() => open('unlock')}
        onOpenRecurring={() => open('recurring-activity')}
      />
    ),
    'account-data': () => <AccountData onBack={back} />,
    'blocked-members': () => <BlockedMembers onBack={back} />,
    // The hub's Verification row opens the Unlock screen, as the web row opens /plugin/unlock.
    unlock: () => <Unlock onStatusChanged={ctx.onUnlockStatusChanged} onGoHome={ctx.onUnlockGoHome} onBack={back} />,
    'recurring-activity': () => (
      <RecurringActivity
        onBack={back}
        onOpenAccount={ctx.openAccount}
        onOpenApps={() => open('apps')}
        onOpenVerification={() => open('unlock')}
      />
    ),
  } satisfies Partial<FeatureRenderers>;
}
