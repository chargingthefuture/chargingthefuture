import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import type { Provider } from './api';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';


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
  onFilterSkill?: (_skillId: string, _name: string) => void;
}

/**
 * A single provider card for the browse list.
 * Renders only real backend fields: displayName, headline.
 * Fields with no backend backing (rating, availability, price, job count) are omitted.
 */
export function FoundationProviderCard({ provider, onPress, onFilterSkill }: FoundationProviderCardProps) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const initText = initials(provider.displayName);
  const offeredSkills = provider.offeredSkills ?? [];
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
        {offeredSkills.length > 0 ? (
          <View style={styles.skillRow}>
            {offeredSkills.map((skill) => (
              <Pressable
                key={skill.id}
                style={styles.skillChip}
                onPress={() => onFilterSkill?.(skill.id, skill.name)}
                accessibilityRole="button"
                accessibilityLabel={`Filter providers by ${skill.name}`}
              >
                <Text style={styles.skillChipText}>{skill.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {/* score is internal — not rendered; rating/availability/price have no backing field — omitted */}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>&#8250;</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: `${accent}15`,
      marginBottom: 10,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${accent}20`,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      color: accent,
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
      color: t.textPrimary,
      flexShrink: 1,
    },
    checkIcon: {
      color: accent,
      fontSize: 12,
      flexShrink: 0,
    },
    headline: {
      fontSize: 12,
      color: t.textSecondary,
    },
    skillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
    },
    skillChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radiusChip,
      backgroundColor: `${accent}12`,
      borderWidth: 1,
      borderColor: `${accent}30`,
    },
    skillChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: accent,
    },
    chevron: {
      color: t.textMuted,
      fontSize: 24,
      flexShrink: 0,
    },
  });
}
