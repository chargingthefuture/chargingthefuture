import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Provider } from './api';

const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';
const COLOR = '#F59E0B';
const BORDER_COLOR = `${COLOR}15`;

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface FoundationProviderCardProps {
  provider: Provider;
  onPress: (_provider: Provider) => void;
}

/**
 * A single provider card for the browse list.
 * Renders only real backend fields: displayName, headline.
 * Fields with no backend backing (rating, availability, price, job count) are omitted.
 */
export function FoundationProviderCard({ provider, onPress }: FoundationProviderCardProps) {
  const initText = initials(provider.displayName);
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(provider)} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initText}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {provider.displayName}
          </Text>
          {/* CheckCircle — verified by backend inclusion in results */}
          <Text style={styles.checkIcon}>&#10003;</Text>
        </View>
        {provider.headline ? (
          <Text style={styles.headline} numberOfLines={1}>
            {provider.headline}
          </Text>
        ) : null}
        {/* score is internal — not rendered; rating/availability/price have no backing field — omitted */}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>&#8250;</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLOR}20`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: COLOR,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    flexShrink: 1,
  },
  checkIcon: {
    color: COLOR,
    fontSize: 12,
    flexShrink: 0,
  },
  headline: {
    fontSize: 12,
    color: SUBTLE,
  },
  chevron: {
    color: '#4B5563',
    fontSize: 24,
    flexShrink: 0,
  },
});
