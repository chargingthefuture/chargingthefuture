// The app's screen header is drawn by App.tsx (src/navigation/AppHeader.tsx) above every screen. This
// file holds the one way a screen shapes that header while it is open, and the controls the header's
// actions slot carries, copied from the web plugin headers:
//
//   - useScreenOverride   a screen asks for a refresh button, or, for a screen inside a plugin (a
//                         provider's profile, a chat), a back that returns to the screen it came from.
//                         Android's back button follows the same back.
//   - HeaderPill          web PluginAdminButton ("Admin") and PluginUserShellButton ("Member view"):
//                         34px tall, accent-tinted, 13px bold.
//   - HeaderRefreshButton web RefreshButton (38px, surface fill, border, text-colored icon) or, with
//                         `admin`, web AdminRefreshControl (the same size tinted with the accent,
//                         dimmed while it works). The icon spins while the reload runs, at least 600ms.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../ui';

export type ScreenOverride = {
  onBack?: () => void;
  /** The reload behind the header's refresh button. */
  refresh?: () => Promise<void> | void;
};

type SetOverride = (_override: ScreenOverride | null) => void;

export const ScreenOverrideContext = createContext<SetOverride | null>(null);

/** Pass a memoized value; null leaves the header as the app draws it. Cleared when the screen closes. */
export function useScreenOverride(override: ScreenOverride | null): void {
  const set = useContext(ScreenOverrideContext);
  useEffect(() => {
    set?.(override);
  }, [set, override]);
  useEffect(() => () => set?.(null), [set]);
}

export function HeaderPill({ label, accent, accessibilityLabel, onPress }: {
  label: string;
  accent: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.pill, { borderRadius: tokens.isComic ? 0 : 10, backgroundColor: `${accent}1A`, borderColor: `${accent}40` }]}
    >
      <Text style={[styles.pillText, { color: accent }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function useSpin(spinning: boolean) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return undefined;
    turn.setValue(0);
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning, turn]);
  return turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

export function HeaderRefreshButton({ onRefresh, admin, accent }: {
  onRefresh: () => Promise<void> | void;
  admin?: boolean;
  accent?: string;
}) {
  const { tokens } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const rotate = useSpin(refreshing);

  const press = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await onRefresh();
      // The web admin control announces the refresh through a polite live region.
      if (admin) AccessibilityInfo.announceForAccessibility('Screen refreshed.');
    } catch {
      // no-trace: the screen shows its own load errors; the button only drives the reload
    } finally {
      await minSpin;
      setRefreshing(false);
    }
  };

  const tinted = admin && accent;
  return (
    <TouchableOpacity
      onPress={() => void press()}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel={admin ? 'Refresh this screen' : 'Refresh'}
      style={[
        styles.square,
        {
          borderRadius: tokens.isComic ? 0 : 10,
          borderColor: tinted ? `${accent}4D` : tokens.border,
          backgroundColor: tinted ? `${accent}1A` : tokens.surface,
          opacity: admin && refreshing ? 0.6 : 1,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={18} color={tinted ? accent : tokens.textPrimary} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { height: 34, paddingHorizontal: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillText: { fontSize: 13, fontFamily: interFamily('700') },
  square: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
