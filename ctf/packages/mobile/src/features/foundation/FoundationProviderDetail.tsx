import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import type { Provider } from './api';
import { createConnectionThread, requestQuote } from './api';

const BG = '#0F1117';
const SURFACE_DARK = '#090B0F';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const SUBTLE = '#6B7280';
const COLOR = '#F59E0B';

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface FoundationProviderDetailProps {
  provider: Provider;
  onBack: () => void;
}

/**
 * Provider detail screen — mirrors the selected-provider view in MobileFoundation.tsx mockup.
 * Renders only real backend fields: displayName, headline, bio.
 * Fields with no backend backing (rate, response time, job count, rating, availability, credits)
 * are omitted per real-data-only policy.
 */
export function FoundationProviderDetail({ provider, onBack }: FoundationProviderDetailProps) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleRequestQuote() {
    setSubmitting(true);
    setStatus(null);
    try {
      const thread = await createConnectionThread(provider.profileId);
      await requestQuote(thread.threadId);
      setStatus('Quote requested. Check back for a response.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Failed to request quote.');
    } finally {
      setSubmitting(false);
    }
  }

  const initText = initials(provider.displayName);

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusSignal}>100%</Text>
      </View>

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>&#8592;</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Provider</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initText}</Text>
          </View>
          <Text style={styles.displayName}>{provider.displayName}</Text>
          {provider.headline ? (
            <Text style={styles.headline}>{provider.headline}</Text>
          ) : null}
          {/* rating/job-count/availability/credits have no backing field — omitted */}
        </View>

        {/* Bio */}
        {provider.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.bioText}>{provider.bio}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => { void handleRequestQuote(); }}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Request Quote</Text>
            )}
          </TouchableOpacity>
          {/* price/rate stat grid has no backing field — omitted */}
        </View>

        {/* Status message */}
        {status ? (
          <Text style={styles.statusMsg}>{status}</Text>
        ) : null}

        {/* Safety guarantee */}
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>&#x1F6E1;&#xFE0F; Good to know</Text>
          <Text style={styles.safetyBody}>
            Providers are fellow community members, not a formally vetted service — use your judgment.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  statusBar: {
    height: 44,
    backgroundColor: SURFACE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusTime: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  statusSignal: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SURFACE_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backIcon: {
    color: COLOR,
    fontSize: 16,
  },
  backLabel: {
    color: COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
  },
  navRight: {
    width: 40,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLOR}25`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: COLOR,
    fontSize: 28,
    fontWeight: '800',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
    textAlign: 'center',
  },
  headline: {
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SUBTLE,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bioText: {
    fontSize: 14,
    color: TEXT_DIM,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLOR,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusMsg: {
    fontSize: 13,
    color: TEXT_DIM,
    textAlign: 'center',
    marginBottom: 16,
  },
  safetyBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}18`,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR,
    marginBottom: 6,
  },
  safetyBody: {
    fontSize: 12,
    color: SUBTLE,
    lineHeight: 19,
  },
});
