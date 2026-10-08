// Maps each screen key to the screen it renders. A plain lookup table (no branching) keeps the
// per-render selection in App.tsx trivial.

import React, { type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChymeRoom } from '../features/chyme';
import { Beacon, BeaconAdmin } from '../features/beacon';
import { PeerProgramming, PeerProgrammingAdmin } from '../features/peer-programming';
import { Foundation } from '../features/foundation';
import { AppsList } from '../features/apps';
import { AccountData } from '../features/account-data';
import { BlockedMembers, BlockedMembersLink } from '../features/blocks';
import type { FeatureKey } from './screens';

export type FeatureRenderers = Record<FeatureKey, () => ReactElement>;

export type FeatureViewContext = {
  open: (_key: FeatureKey) => void;
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
    chyme: () => <ChymeRoom />,
    beacon: () => <Beacon />,
    'beacon-admin': () => <BeaconAdmin key={refreshToken} />,
    'peer-programming': () => (
      <PeerProgramming key={ppCohortId ?? 'own'} initialCohortId={ppCohortId} onOpenAdmin={() => open('peer-programming-admin')} />
    ),
    'peer-programming-admin': () => (
      <PeerProgrammingAdmin key={refreshToken} onOpenMember={() => openPpRoom(null)} onOpenRoom={(cohortId) => openPpRoom(cohortId)} />
    ),
    foundation: () => <Foundation />,
    'account-data': () => (
      <View style={styles.fill}>
        <BlockedMembersLink onPress={() => open('blocked-members')} />
        <AccountData />
      </View>
    ),
    'blocked-members': () => <BlockedMembers />,
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
