import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import type { LighthouseProperty } from './types';
import { acceptedCurrencyLabels, formatRentParts, type CurrencyMap } from './currency';

interface Props {
  property: LighthouseProperty;
  currencies: CurrencyMap;
  onPress: (_id: string) => void;
}

function formatAvailability(iso: string | null): string {
  if (!iso) return 'Available';
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return 'Now';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatBeds(bedrooms: number | null): string {
  if (bedrooms === null) return '';
  if (bedrooms === 0) return 'Studio';
  return `${bedrooms}bd`;
}

export const LighthousePropertyCard: React.FC<Props> = ({ property, currencies, onPress }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const beds = formatBeds(property.bedrooms);
  const baths = property.bathrooms !== null ? `${property.bathrooms}ba` : null;
  const availability = formatAvailability(property.availableFromIso);
  const location = [property.city, property.state].filter(Boolean).join(', ');
  const rent = formatRentParts(property, currencies);
  const acceptsCredits = acceptedCurrencyLabels(property, currencies).includes('ServiceCredits');

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(property.id)}
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons name="home-outline" size={32} color={`${accent}60`} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {property.title}
          </Text>
        </View>
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={tokens.textSecondary} />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {rent ? (
              <Text style={styles.price}>
                {rent.primary}
                {rent.unit ? <Text style={styles.priceUnit}> {rent.unit}</Text> : null}
                {rent.perMonth ? <Text style={styles.priceSuffix}>/mo</Text> : null}
              </Text>
            ) : (
              <Text style={styles.priceUnknown}>Contact host</Text>
            )}
            {acceptsCredits ? <Text style={styles.creditsBadge}>Credits ✓</Text> : null}
            <View style={styles.metaRow}>
              {beds ? (
                <Text style={styles.metaText}>{beds}</Text>
              ) : null}
              {baths ? (
                <Text style={styles.metaText}>{baths}</Text>
              ) : null}
              <Text style={styles.metaText}>{availability}</Text>
            </View>
          </View>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    card: {
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: `${accent}20`,
      overflow: 'hidden',
    },
    imagePlaceholder: {
      height: 80,
      backgroundColor: `${accent}08`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      padding: 14,
    },
    titleRow: {
      marginBottom: 6,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textPrimary,
      lineHeight: 20,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 3,
    },
    locationText: {
      fontSize: 12,
      color: t.textSecondary,
      marginLeft: 2,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 8,
    },
    footerLeft: {
      flexShrink: 1,
    },
    price: {
      fontSize: 18,
      fontWeight: '800',
      color: accent,
    },
    priceUnit: {
      fontSize: 11,
      fontWeight: '600',
      color: accent,
    },
    priceSuffix: {
      fontSize: 11,
      color: t.textSecondary,
      fontWeight: '400',
    },
    creditsBadge: {
      fontSize: 10,
      color: '#F59E0B',
      marginTop: 2,
    },
    priceUnknown: {
      fontSize: 14,
      color: t.textSecondary,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    metaText: {
      fontSize: 11,
      color: t.textSecondary,
    },
    viewBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}30`,
    },
    viewBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: accent,
    },
  });
}
