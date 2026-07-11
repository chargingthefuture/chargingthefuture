import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { fetchCirculation, type CirculationMetrics } from './api';

// Member-facing view of the public ServiceCredits circulation metrics.
// Every value is a bare credit quantity — no fiat equivalence is ever shown.
// Renders only the fields the public circulation endpoint returns.

type Tile = { key: string; label: string; value: string };

function buildTiles(m: CirculationMetrics): Tile[] {
  return [
    { key: 'inCirculation', label: 'In circulation', value: m.inCirculation.toLocaleString() },
    { key: 'totalIssued', label: 'Total issued', value: m.totalIssued.toLocaleString() },
    { key: 'totalBurned', label: 'Total burned', value: m.totalBurned.toLocaleString() },
    {
      key: 'treasuryBalance',
      label: 'Held in treasury',
      value: m.treasuryBalance === null ? '—' : m.treasuryBalance.toLocaleString(),
    },
    {
      key: 'outstandingMutualCreditDebt',
      label: 'On community credit',
      value: m.outstandingMutualCreditDebt.toLocaleString(),
    },
    { key: 'velocity', label: 'Moving (30-day velocity)', value: m.velocity.toFixed(2) },
    { key: 'transferVolume30d', label: 'Sent in last 30 days', value: m.transferVolume30d.toLocaleString() },
  ];
}

export function EconomyTab() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [metrics, setMetrics] = useState<CirculationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchCirculation();
      setMetrics(m);
    } catch {
      setError('Could not load the economy view. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  if (error || metrics === null) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error ?? 'No data available.'}</Text>
        <TouchableOpacity
          onPress={load}
          style={s.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tiles = buildTiles(metrics);

  return (
    <View>
      <Text style={s.heading}>The Economy</Text>
      <Text style={s.subheading}>How ServiceCredits are moving across the community.</Text>

      <View style={s.grid}>
        {tiles.map((tile) => (
          <View key={tile.key} style={s.tile}>
            <Text style={s.tileValue}>{tile.value}</Text>
            <Text style={s.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.caption}>
        ServiceCredits are usable across the plugins. They are not money and cannot be cashed out.
      </Text>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 16 },
    errorText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
    retryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: accent,
      borderRadius: 10,
    },
    retryText: { color: '#0F1117', fontWeight: '700', fontSize: 14 },
    heading: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 4,
    },
    subheading: {
      fontSize: 12,
      color: t.textSecondary,
      marginBottom: 14,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: t.borderFaint,
    },
    tileValue: {
      fontSize: 22,
      fontWeight: '900',
      color: t.textPrimary,
      marginBottom: 4,
    },
    tileLabel: {
      fontSize: 11,
      color: t.textSecondary,
    },
    caption: {
      fontSize: 11,
      color: t.textSecondary,
      lineHeight: 16,
      marginTop: 14,
    },
  });
}
