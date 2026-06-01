import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LighthouseProperty } from './types';

const COLOR = '#EAB308';
const BG = '#0F1117';
const DARK = '#090B0F';

interface Props {
  property: LighthouseProperty;
  onBack: () => void;
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

const AmenityTag: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.tag}>
    <Text style={styles.tagText}>{label}</Text>
  </View>
);

const HouseRuleRow: React.FC<{ rule: string }> = ({ rule }) => (
  <Text style={styles.ruleText}>• {rule}</Text>
);

export const LighthousePropertyDetail: React.FC<Props> = ({ property, onBack }) => {
  const location = [property.city, property.state, property.country]
    .filter(Boolean)
    .join(', ');
  const beds = formatBeds(property.bedrooms);
  const baths = property.bathrooms !== null ? `${property.bathrooms} bath` : null;
  const availability = formatAvailability(property.availableFromIso);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={16} color={COLOR} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Listing</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Ionicons name="home-outline" size={48} color={`${COLOR}60`} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{property.title}</Text>
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.locationText}>{location}</Text>
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
          {property.monthlyRent !== null ? (
            <View style={styles.priceBox}>
              <Text style={styles.price}>
                ${property.monthlyRent.toLocaleString()}
                <Text style={styles.priceSuffix}>/mo</Text>
              </Text>
            </View>
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
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={12} color={COLOR} />
            <Text style={styles.privacyNoteTitle}>Privacy Protected</Text>
          </View>
          <Text style={styles.privacyBody}>
            Your location is never shown until you confirm. All communications are
            end-to-end encrypted.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 14,
    color: COLOR,
    fontWeight: '600',
    marginLeft: 2,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F9FAFB',
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
    backgroundColor: `${COLOR}08`,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
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
    color: '#9CA3AF',
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
    color: '#9CA3AF',
  },
  metaDivider: {
    fontSize: 13,
    color: '#4B5563',
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 21,
    marginBottom: 16,
  },
  priceBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    marginBottom: 16,
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
    color: COLOR,
  },
  priceSuffix: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F9FAFB',
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
    color: '#9CA3AF',
  },
  ruleText: {
    fontSize: 13,
    color: '#9CA3AF',
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
    color: COLOR,
    marginLeft: 2,
  },
  privacyBody: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 19,
  },
});
