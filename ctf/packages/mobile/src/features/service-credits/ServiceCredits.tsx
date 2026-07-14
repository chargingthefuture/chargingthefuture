import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useTheme, getAppAccent } from '../../theme';
import { fetchWallet, type Wallet } from './api';
import { WalletTab } from './sc-wallet-tab';
import { EarnTab } from './sc-earn-tab';
import { SendTab } from './sc-send-tab';
import { EconomyTab } from './sc-economy-tab';
import { makeStyles } from './sc-styles';

// Design canonical: design/artifacts/mockup-sandbox/src/components/mockups/
//   survivor-hub/MobileServiceCredits.tsx (primary state)
//   MobileServiceCreditsEmpty.tsx    (zero-balance state)
//   MobileServiceCreditsLoading.tsx  (loading state)
//   MobileServiceCreditsPublic.tsx   (unauthenticated)
//
// Real-data-only bindings:
//   availableBalance, escrowBalance  ← GET /api/service-credits/wallet
//   transfer creation                ← POST /api/service-credits/transfers
//   recent transactions list         ← GET /api/service-credits/transactions (member's own ledger)
//
// Omitted (no API backing, not fabricated):
//   earned total, spent total, this-month delta, network rank — no aggregate read endpoint

type NavKey = 'wallet' | 'earn' | 'send' | 'economy';

const NAV: { label: string; key: NavKey }[] = [
  { label: 'Wallet', key: 'wallet' },
  { label: 'Earn', key: 'earn' },
  { label: 'Send', key: 'send' },
  { label: 'Economy', key: 'economy' },
];

function LoadingScreen() {
  // Loading screen — the comic theme has no effect here (token-pass §F5), so the background and the
  // faint label stay raw; only the spinner adopts the plugin accent.
  const { theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  return (
    <View style={{ flex: 1, backgroundColor: '#0F1117', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={accent} size="large" />
      <Text style={{ marginTop: 16, fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>
        EXIT THEIR ECONOMY
      </Text>
    </View>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { tokens: t, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 14, color: t.textSecondary, textAlign: 'center', marginBottom: 16 }}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{ paddingVertical: 12, paddingHorizontal: 24, backgroundColor: accent, borderRadius: 10 }}
      >
        <Text style={{ color: '#0F1117', fontWeight: '700', fontSize: 14 }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function UnauthenticatedScreen() {
  const { tokens: t } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: t.textPrimary, marginBottom: 12 }}>
        ServiceCredits
      </Text>
      <Text style={{ fontSize: 14, color: t.textSecondary, lineHeight: 22 }}>
        Sign in to view your ServiceCredits balance, earn credits through learning and
        community activities, and spend them on real services across housing, transport,
        trades, and more.
      </Text>
    </View>
  );
}

export function ServiceCredits() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [activeNav, setActiveNav] = useState<NavKey>('wallet');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = useCallback(async (background = false) => {
    // A background reload (pull-to-refresh) keeps the current screen on display
    // instead of flashing the full loading state.
    if (!background) setLoading(true);
    setError(null);
    try {
      const w = await fetchWallet();
      setWallet(w);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.includes('401') || msg.includes('403')) {
        setAuthed(false);
      } else {
        setError('Could not load wallet. Check your connection and try again.');
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  // Pull-to-refresh: re-pull the wallet without flashing the full loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWallet(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadWallet]);

  if (loading) return <LoadingScreen />;
  if (!authed) return <UnauthenticatedScreen />;
  if (error) return <ErrorScreen message={error} onRetry={loadWallet} />;

  const balanceStr = wallet ? wallet.availableBalance.toLocaleString() : '0';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>ServiceCredits</Text>
            <Text style={styles.headerSubtitle}>Utility token ecosystem</Text>
          </View>
        </View>
        <View style={styles.balancePill}>
          <Text style={styles.balancePillValue}>{balanceStr}</Text>
          <Text style={styles.balancePillLabel}>credits</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accent} />}
      >
        {activeNav === 'wallet' && wallet !== null && (
          <WalletTab wallet={wallet} onSend={() => setActiveNav('send')} />
        )}
        {activeNav === 'earn' && <EarnTab />}
        {activeNav === 'send' && (
          <SendTab onSent={() => { void loadWallet(); setActiveNav('wallet'); }} />
        )}
        {activeNav === 'economy' && <EconomyTab />}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {NAV.map(({ label, key }) => {
          const active = activeNav === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.navBtn}
              onPress={() => setActiveNav(key)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.navBtnIcon, active && styles.navBtnIconActive]}>
                <Text style={{ fontSize: 16, color: active ? accent : tokens.textSecondary }}>
                  {key === 'wallet' ? '💰' : key === 'earn' ? '⚡' : key === 'send' ? '↑' : '📊'}
                </Text>
              </View>
              <Text style={[styles.navBtnLabel, active && styles.navBtnLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
