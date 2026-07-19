import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import type { LighthouseProperty } from './types';
import { acceptedCurrencyLabels, formatRentParts, type CurrencyMap } from './currency';
import { LighthouseRequestToStay } from './LighthouseRequestToStay';

interface Props {
  property: LighthouseProperty;
  currencies: CurrencyMap;
  onBack: () => void;
  // The signed-in member's user id, so the seeker "Request to stay" action is hidden on the
  // member's own listing. Optional so the detail still renders where it is not supplied.
  currentUserId?: string | null;
  // Called when the member has no active seeker profile yet, so the parent can switch to the
  // "Your details" tab.
  onNeedsProfile?: () => void;
}

function formatBeds(bedrooms: number | null): string {
  if (bedrooms === null) return 'Unknown';
  if (bedrooms === 0) return 'Studio';
  return `${bedrooms} bed`;
}

function formatAvailability(iso: string | null): string {
  if (!iso) return 'Available';
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return 'Available Now';
  return `Available ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const AmenityTag: React.FC<{ label: string }> = ({ label }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
};

const HouseRuleRow: React.FC<{ rule: string }> = ({ rule }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return <Text style={styles.ruleText}>• {rule}</Text>;
};

export const LighthousePropertyDetail: React.FC<Props> = ({ property, currencies, onBack, currentUserId, onNeedsProfile }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const isOwn = !!currentUserId && property.hostUserId === currentUserId;
  const location = [property.city, property.state, property.country]
    .filter(Boolean)
    .join(', ');
  const beds = formatBeds(property.bedrooms);
  const baths = property.bathrooms !== null ? `${property.bathrooms} bath` : null;
  const availability = formatAvailability(property.availableFromIso);
  const rent = formatRentParts(property, currencies);
  const accepted = acceptedCurrencyLabels(property, currencies);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={16} color={accent} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Listing</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Ionicons name="home-outline" size={48} color={`${accent}60`} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{property.title}</Text>
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={tokens.textSecondary} />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          ) : null}
          {property.propertyType && property.propertyType.trim().length > 0 ? (
            <View style={styles.typeChip}>
              <Ionicons name="home-outline" size={11} color={accent} />
              <Text style={styles.typeChipText}>{property.propertyType}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{beds}</Text>
            {baths ? <Text style={styles.metaDivider}>·</Text> : null}
            {baths ? <Text style={styles.metaText}>{baths}</Text> : null}
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{availability}</Text>
          </View>
          {property.description ? (
            <Text style={styles.description}>{property.description}</Text>
          ) : null}
          {rent ? (
            <View style={styles.priceBox}>
              <Text style={styles.price}>
                {rent.primary}
                {rent.unit ? <Text style={styles.priceUnit}> {rent.unit}</Text> : null}
                {rent.perMonth ? <Text style={styles.priceSuffix}>/mo</Text> : null}
              </Text>
              {accepted.length > 0 ? (
                <View style={styles.acceptsRow}>
                  <Text style={styles.acceptsLabel}>Accepts</Text>
                  <View style={styles.acceptsChips}>
                    {accepted.map((label) => {
                      const isCredits = label === 'ServiceCredits';
                      return (
                        <View key={label} style={[styles.acceptsChip, isCredits && styles.acceptsChipCredits]}>
                          <Text style={[styles.acceptsChipText, isCredits && styles.acceptsChipTextCredits]}>
                            {isCredits ? '✓ ' : ''}{label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
          {!isOwn ? (
            <LighthouseRequestToStay propertyId={property.id} onNeedsProfile={onNeedsProfile} />
          ) : null}
          {property.amenities.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.tagRow}>
                {property.amenities.map((a, i) => (
                  <AmenityTag key={i} label={a} />
                ))}
              </View>
            </View>
          ) : null}
          {property.houseRules.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>House Rules</Text>
              {property.houseRules.map((r, i) => (
                <HouseRuleRow key={i} rule={r} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    backBtnText: {
      fontSize: 14,
      color: accent,
      fontWeight: '600',
      marginLeft: 2,
    },
    topBarTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
    },
    topBarSpacer: {
      width: 48,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    hero: {
      paddingVertical: 32,
      backgroundColor: `${accent}08`,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 8,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 8,
    },
    locationText: {
      fontSize: 12,
      color: t.textSecondary,
      marginLeft: 2,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: `${accent}12`,
      borderWidth: 1,
      borderColor: `${accent}30`,
      borderRadius: 8,
      paddingVertical: 3,
      paddingHorizontal: 10,
      marginBottom: 12,
    },
    typeChipText: {
      fontSize: 12,
      color: accent,
      fontWeight: '600',
      marginLeft: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    metaText: {
      fontSize: 13,
      color: t.textSecondary,
    },
    metaDivider: {
      fontSize: 13,
      color: t.textMuted,
    },
    description: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 21,
      marginBottom: 16,
    },
    priceBox: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: `${accent}08`,
      borderWidth: 1,
      borderColor: `${accent}20`,
      marginBottom: 16,
    },
    price: {
      fontSize: 32,
      fontWeight: '900',
      color: accent,
    },
    priceUnit: {
      fontSize: 15,
      fontWeight: '700',
      color: accent,
    },
    priceSuffix: {
      fontSize: 13,
      color: t.textSecondary,
      fontWeight: '400',
    },
    acceptsRow: {
      marginTop: 12,
    },
    acceptsLabel: {
      fontSize: 11,
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    acceptsChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    acceptsChip: {
      borderRadius: 8,
      paddingVertical: 3,
      paddingHorizontal: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    acceptsChipCredits: {
      backgroundColor: '#F59E0B15',
      borderColor: '#F59E0B30',
    },
    acceptsChipText: {
      fontSize: 12,
      color: '#D1D5DB',
    },
    acceptsChipTextCredits: {
      color: '#F59E0B',
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textPrimary,
      marginBottom: 8,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    tagText: {
      fontSize: 11,
      color: t.textSecondary,
    },
    ruleText: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 20,
      marginBottom: 4,
    },
    privacyNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      marginTop: 8,
    },
    privacyNoteTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: accent,
      marginLeft: 2,
    },
    privacyBody: {
      fontSize: 12,
      color: t.textSecondary,
      lineHeight: 19,
    },
  });
}
