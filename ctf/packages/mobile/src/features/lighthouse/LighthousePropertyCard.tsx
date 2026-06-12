import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LighthouseProperty } from './types';

const COLOR = '#60A5FA';

interface Props {
  property: LighthouseProperty;
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

export const LighthousePropertyCard: React.FC<Props> = ({ property, onPress }) => {
  const beds = formatBeds(property.bedrooms);
  const baths = property.bathrooms !== null ? `${property.bathrooms}ba` : null;
  const availability = formatAvailability(property.availableFromIso);
  const location = [property.city, property.state].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(property.id)}
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons name="home-outline" size={32} color={`${COLOR}60`} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {property.title}
          </Text>
        </View>
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color="#6B7280" />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <View>
            {property.monthlyRent !== null ? (
              <Text style={styles.price}>
                ${property.monthlyRent.toLocaleString()}
                <Text style={styles.priceSuffix}>/mo</Text>
              </Text>
            ) : (
              <Text style={styles.priceUnknown}>Contact host</Text>
            )}
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

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    height: 80,
    backgroundColor: `${COLOR}08`,
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
    color: '#F9FAFB',
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
    color: '#6B7280',
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: COLOR,
  },
  priceSuffix: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
  },
  priceUnknown: {
    fontSize: 14,
    color: '#6B7280',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
  },
  viewBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR,
  },
});
