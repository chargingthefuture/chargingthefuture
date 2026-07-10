import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { fetchMatches } from './api';
import type { LighthouseMatch } from './types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#22C55E',
  rejected: '#EF4444',
  cancelled: '#6B7280',
  completed: '#3B82F6',
};

function statusLabel(status: LighthouseMatch['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const MatchCard: React.FC<{ match: LighthouseMatch }> = ({ match }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const cardStyles = useMemo(() => makeCardStyles(tokens, accent), [tokens, accent]);
  const color = STATUS_COLORS[match.status] ?? '#6B7280';
  const moveIn = match.proposedMoveInDateIso
    ? new Date(match.proposedMoveInDateIso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Match Request</Text>
        <View style={[cardStyles.badge, { borderColor: `${color}50`, backgroundColor: `${color}15` }]}>
          <Text style={[cardStyles.badgeText, { color }]}>{statusLabel(match.status)}</Text>
        </View>
      </View>
      {moveIn ? (
        <View style={cardStyles.row}>
          <Ionicons name="calendar-outline" size={13} color={tokens.textSecondary} />
          <Text style={cardStyles.meta}>Requested move-in: {moveIn}</Text>
        </View>
      ) : null}
      {match.message ? (
        <Text style={cardStyles.message} numberOfLines={2}>{match.message}</Text>
      ) : null}
      {match.hostResponse ? (
        <View style={cardStyles.responseBox}>
          <Text style={cardStyles.responseLabel}>Host response:</Text>
          <Text style={cardStyles.responseText} numberOfLines={2}>{match.hostResponse}</Text>
        </View>
      ) : null}
    </View>
  );
};

function makeCardStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    card: {
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${accent}20`,
      padding: 16,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textPrimary,
    },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6,
    },
    meta: {
      fontSize: 12,
      color: '#9CA3AF',
      marginLeft: 3,
    },
    message: {
      fontSize: 13,
      color: '#9CA3AF',
      marginTop: 4,
      lineHeight: 18,
    },
    responseBox: {
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 1,
      borderColor: t.borderFaint,
    },
    responseLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: accent,
      marginBottom: 2,
    },
    responseText: {
      fontSize: 12,
      color: '#9CA3AF',
      lineHeight: 17,
    },
  });
}

export const LighthouseMatches: React.FC = () => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<LighthouseMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchMatches()
      .then((res) => {
        if (mounted) setMatches(res.items);
      })
      .catch(() => {
        if (mounted) setError('Failed to load matches.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-open-outline" size={40} color={`${accent}40`} />
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyBody}>
          Browse listings and request a match to get started.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MatchCard match={item} />}
      contentContainerStyle={styles.list}
      style={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: t.bg,
    },
    errorText: {
      fontSize: 14,
      color: t.danger,
      textAlign: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.textPrimary,
      marginTop: 14,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    list: {
      padding: 16,
      paddingBottom: 32,
    },
  });
}
