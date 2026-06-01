import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// First-use AI-processing consent bottom sheet (the llm_consent_granted gate). Matches the locked
// MobileAIConsent mockup: self-hosted, no third parties, a teammate reviews answers, safety first.
const BRAND = '#7C3AED';
const BRAND_LIGHT = '#A78BFA';
const TEXT = '#E8EAF0';
const SUBTLE = '#6B7280';

type ConsentPoint = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
};

const POINTS: ConsentPoint[] = [
  {
    icon: 'server-outline',
    title: 'Runs on our own servers',
    desc: 'Self-hosted in Survivor Hub. Your questions never leave our infrastructure.',
  },
  {
    icon: 'eye-off-outline',
    title: 'No third parties',
    desc: 'We never send your messages to outside AI companies or data brokers.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'A teammate reviews answers',
    desc: 'Sensitive answers are checked by a trained human first.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Your safety comes first',
    desc: 'It will never reveal your location or identity, or ask you to.',
  },
];

type ComicConsentSheetProps = {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function ComicConsentSheet({ open, onConfirm, onDismiss }: ComicConsentSheetProps) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}>
                <Ionicons name="sparkles" size={19} color="#fff" />
              </View>
              <View style={styles.titleTextWrap}>
                <Text style={styles.title}>Meet the AI Assistant</Text>
                <Text style={styles.trigger}>
                  Summon it by typing <Text style={styles.triggerToken}>@comic</Text>
                </Text>
              </View>
            </View>

            <Text style={styles.lede}>
              Before your first use, here&apos;s how it works and how we keep you safe.
            </Text>

            <View style={styles.points}>
              {POINTS.map((point) => (
                <View key={point.title} style={styles.point}>
                  <View style={styles.pointIcon}>
                    <Ionicons name={point.icon} size={15} color={BRAND_LIGHT} />
                  </View>
                  <View style={styles.pointTextWrap}>
                    <Text style={styles.pointTitle}>{point.title}</Text>
                    <Text style={styles.pointDesc}>{point.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.confirmText}>I understand — turn it on</Text>
            </Pressable>
            <Pressable style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,9,13,0.55)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#0D0F14',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(124,58,237,0.3)',
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  trigger: {
    fontSize: 12,
    color: BRAND_LIGHT,
    marginTop: 1,
  },
  triggerToken: {
    color: '#C4B5FD',
    fontWeight: '600',
  },
  lede: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 14,
  },
  points: {
    gap: 12,
    marginBottom: 16,
  },
  point: {
    flexDirection: 'row',
    gap: 11,
  },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTextWrap: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  pointDesc: {
    fontSize: 12,
    color: SUBTLE,
    lineHeight: 18,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: BRAND,
    marginBottom: 9,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
