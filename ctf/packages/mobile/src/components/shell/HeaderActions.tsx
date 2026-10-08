// Screen controls in the app header, the way the web plugin headers carry them in their title row
// (web components/shared/refresh-button.tsx, plugin-admin-button.tsx, plugin-user-shell-button.tsx).
// The header is drawn by App.tsx above every screen, so a screen hands its controls up through
// HeaderActionsContext; ScreenHeader puts them between the title and the report / settings icons,
// as the web MobileScreenHeader's `actions` slot does.

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../ui';

type SetActions = (_actions: ReactNode) => void;

export const HeaderActionsContext = createContext<SetActions>(() => undefined);

/**
 * Put `actions` in the header while this screen is open. `deps` say when to redraw them; the header
 * is cleared when the screen closes.
 */
export function useHeaderActions(actions: ReactNode, deps: ReadonlyArray<unknown>): void {
  const setActions = useContext(HeaderActionsContext);
  useEffect(() => {
    setActions(actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what the controls depend on
  }, deps);
  useEffect(() => () => setActions(null), [setActions]);
}

// The web RefreshButton: a 38px square in the same surface and border as the report and settings
// icons, its arrows spinning while the reload runs (for at least 600ms, so a quick reload still
// shows it happened).
export function HeaderRefreshButton({ onRefresh, title = 'Refresh' }: { onRefresh: () => Promise<void>; title?: string }) {
  const { tokens } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [refreshing, spin]);

  const press = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await onRefresh();
    } catch {
      // no-trace: the screen shows its own load errors; the button only drives the reload
    } finally {
      await minSpin;
      setRefreshing(false);
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <TouchableOpacity
      onPress={() => void press()}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.square, { borderRadius: tokens.isComic ? 0 : 10, backgroundColor: tokens.surface, borderColor: tokens.border }]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={18} color={tokens.textPrimary} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// The web PluginAdminButton and PluginUserShellButton: a small pill tinted with the plugin accent.
export function HeaderPillButton({ label, accent, accessibilityLabel, onPress }: {
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

const styles = StyleSheet.create({
  square: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 34, paddingHorizontal: 12, borderWidth: 1, justifyContent: 'center' },
  pillText: { fontSize: 13, fontFamily: interFamily('700') },
});
