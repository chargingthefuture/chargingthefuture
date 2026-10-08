// How a screen shapes the app's screen header while it is open, the way each web page draws its own:
// a refresh button (web RefreshButton, or the admin AdminRefreshControl when `admin` is set), and, for a
// screen inside a plugin (a provider's profile, a chat), a back that returns to the screen it came from
// and the title and icon the web page shows. Android's back button follows the same back.
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';

export type ScreenOverride = {
  onBack?: () => void;
  title?: string;
  icon?: ReactNode;
  accent?: string;
  refresh?: { onRefresh: () => Promise<void> | void; admin?: boolean };
};

const SetOverrideContext = createContext<((_o: ScreenOverride | null) => void) | null>(null);

export function ScreenOverrideProvider({ onChange, children }: { onChange: (_o: ScreenOverride | null) => void; children: ReactNode }) {
  return <SetOverrideContext.Provider value={onChange}>{children}</SetOverrideContext.Provider>;
}

// Pass a memoized value; null leaves the header as the app draws it.
export function useScreenOverride(override: ScreenOverride | null) {
  const set = useContext(SetOverrideContext);
  useEffect(() => {
    set?.(override);
  }, [set, override]);
  useEffect(() => () => set?.(null), [set]);
}

function useSpin(spinning: boolean) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return;
    turn.setValue(0);
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning, turn]);
  return turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

// The web RefreshButton (38px, surface fill, border, text-colored icon) or, for an admin screen, the
// web AdminRefreshControl (the same size tinted with the accent, dimmed while it works). The icon
// spins while the reload runs, at least 600 ms, as on the web.
export function RefreshButton({ onRefresh, admin, accent }: { onRefresh: () => Promise<void> | void; admin?: boolean; accent?: string }) {
  const { tokens } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const rotate = useSpin(refreshing);
  const press = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await onRefresh();
    } catch {
      // no-trace: the screen shows its own failure; the button only stops spinning
    } finally {
      await minSpin;
      setRefreshing(false);
    }
  };
  const tinted = admin && accent;
  const color = tinted ? accent : tokens.textPrimary;
  return (
    <TouchableOpacity
      onPress={() => void press()}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel={admin ? 'Refresh this screen' : 'Refresh'}
      style={{
        width: 38,
        height: 38,
        borderRadius: tokens.isComic ? 0 : 10,
        borderWidth: 1,
        borderColor: tinted ? `${accent}4D` : tokens.border,
        backgroundColor: tinted ? `${accent}1A` : tokens.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: admin && refreshing ? 0.6 : 1,
      }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={18} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
}
