import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLOR = '#60A5FA';
const BG = '#0F1117';

interface Props {
  onSignIn?: () => void;
  onJoin?: () => void;
}

export const LighthousePublicState: React.FC<Props> = ({ onSignIn, onJoin }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Ionicons name="home" size={20} color={COLOR} />
      <Text style={styles.title}>LightHouse</Text>
    </View>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Privacy-first housing</Text>
    </View>
    <Text style={styles.description}>
      Safe, verified housing. Your location is never shared without consent.
      Trauma-informed hosts. ServiceCredits accepted.
    </Text>
    <TouchableOpacity style={styles.joinBtn} activeOpacity={0.8} onPress={onJoin}>
      <Text style={styles.joinBtnText}>Join the Hub — Free</Text>
    </TouchableOpacity>
    <View style={styles.previewSection}>
      <View style={styles.previewBlur}>
        {PREVIEW_LISTINGS.map((l, i) => (
          <ListingPreviewRow key={i} title={l.title} price={l.price} />
        ))}
      </View>
      <View style={styles.lockOverlay}>
        <View style={styles.lockCircle}>
          <Ionicons name="lock-closed" size={20} color={COLOR} />
        </View>
        <Text style={styles.lockText}>Sign in to view listings</Text>
        <TouchableOpacity
          style={styles.signInBtn}
          activeOpacity={0.8}
          onPress={onSignIn}
        >
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const PREVIEW_LISTINGS = [
  { title: 'Private Studio — Safe & Verified', price: '$850/mo' },
  { title: 'Furnished 1BR — Female-only Floor', price: '$1,100/mo' },
  { title: 'Micro-unit — Month-to-month', price: '$650/mo' },
];

interface RowProps {
  title: string;
  price: string;
}

const ListingPreviewRow: React.FC<RowProps> = ({ title, price }) => (
  <View style={rowStyles.card}>
    <View style={rowStyles.image} />
    <View style={rowStyles.info}>
      <Text style={rowStyles.title} numberOfLines={1}>{title}</Text>
      <Text style={rowStyles.price}>{price}</Text>
    </View>
  </View>
);

const rowStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  image: {
    height: 90,
    backgroundColor: `${COLOR}15`,
  },
  info: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F9FAFB',
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F9FAFB',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F9FAFB',
    marginLeft: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    color: COLOR,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 21,
    marginBottom: 16,
  },
  joinBtn: {
    backgroundColor: COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  previewSection: {
    flex: 1,
    position: 'relative',
  },
  previewBlur: {
    opacity: 0.5,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: `${COLOR}50`,
    backgroundColor: `${COLOR}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  signInBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 9,
    backgroundColor: COLOR,
  },
  signInBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
});
