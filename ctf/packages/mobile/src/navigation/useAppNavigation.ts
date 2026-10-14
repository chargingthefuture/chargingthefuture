// Which screen is open and how back leaves it. The app has no screen stack: one selected key, and
// back goes to `parentOf(key)` (screens.ts), with two exceptions held here. Recurring Activity goes
// back to whichever screen opened it (Your account or Foundation), and a screen inside a plugin (a
// Foundation profile or chat) can claim back for itself through useScreenOverride, so the header
// chevron and Android's back button return to the plugin screen it came from first.

import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import type { ScreenOverride } from '../components/shell/HeaderActions';
import { isAccountKey, isAdminKey, parentOf, pluginOf, type FeatureKey } from './screens';

function useOverrideState() {
  const [override, setOverrideState] = useState<ScreenOverride | null>(null);
  // Kept in a ref too, for Android's back button.
  const overrideRef = useRef<ScreenOverride | null>(null);
  const setOverride = useCallback((next: ScreenOverride | null) => {
    overrideRef.current = next;
    setOverrideState(next);
  }, []);
  return { override, overrideRef, setOverride };
}

// Keeps a member on a screen they may see: the account screens need a signed-in member (the gear
// that reaches them shows only when signed in), and an admin screen needs an admin — anyone else goes
// to the plugin's member page, as the web redirects them.
function useScreenGuards(selected: FeatureKey, open: (_key: FeatureKey) => void, isAuthenticated: boolean, isAdmin: boolean) {
  useEffect(() => {
    if (!isAuthenticated && isAccountKey(selected)) {
      open('apps');
    } else if (!isAdmin && isAdminKey(selected)) {
      open(pluginOf(selected) ?? 'apps');
    }
  }, [isAuthenticated, isAdmin, selected, open]);
}

export function useAppNavigation(isAuthenticated: boolean, isAdmin: boolean) {
  const [selected, setSelected] = useState<FeatureKey>('apps');
  // Set when Foundation opened Recurring Activity; cleared by any other move.
  const [recurringFromFoundation, setRecurringFromFoundation] = useState(false);
  const { override, overrideRef, setOverride } = useOverrideState();

  const open = useCallback((key: FeatureKey) => {
    setRecurringFromFoundation(false);
    setSelected(key);
  }, []);
  const openRecurringFromFoundation = useCallback(() => {
    setRecurringFromFoundation(true);
    setSelected('recurring-activity');
  }, []);
  const back = useCallback(() => {
    open(selected === 'recurring-activity' && recurringFromFoundation ? 'foundation' : parentOf(selected));
  }, [open, selected, recurringFromFoundation]);

  useScreenGuards(selected, open, isAuthenticated, isAdmin);

  // Android hardware back: a screen inside a plugin first, then the screen's parent; from Apps, let
  // Android do its default (leave the app). "Navigating away without closing" — the case that must
  // not drop a member from a live room — is pressing HOME or switching apps (the foreground service
  // keeps the audio and the presence timers alive). Back is an explicit "leave".
  useEffect(() => {
    const onBack = () => {
      const inner = overrideRef.current?.onBack;
      if (inner) {
        inner();
        return true;
      }
      if (selected === 'apps') return false;
      back();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [selected, back, overrideRef]);

  return { selected, open, back, openRecurringFromFoundation, override, setOverride };
}
