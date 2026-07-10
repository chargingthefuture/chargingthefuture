import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import type { Provider } from './api';
import { createConnectionThread, requestQuote } from './api';
import { ConnectNowButton, InstantCallAvailabilityBadge, canOfferConnectNow, acceptsInstantCalls, instantCallRateLabel, isOwnProfile } from './FoundationConnectNow';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// No mobile token maps to this mid-grey (mobile textSecondary is #6B7280) — kept raw.
const TEXT_DIM = '#9CA3AF';

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
  // The signed-in viewer's own user id (from the provider search), so "Connect now"
  // is hidden on the viewer's own card. Null when unknown.
  viewerUserId?: string | null;
  onBack: () => void;
  // Open the Direct Line for a connection thread. Called after a successful Request Quote so the
  // member lands straight in the 1:1 conversation (mirrors the web, which opens the Direct Line right
  // after a quote request). `subtitle` is who the conversation is with.
  onOpenDirectLine?: (_threadId: string, _subtitle: string | null) => void;
}

/**
 * Provider detail screen — mirrors the selected-provider view in MobileFoundation.tsx mockup.
 * Renders only real backend fields: displayName, headline, bio.
 * Fields with no backend backing (rate, response time, job count, rating, availability, credits)
 * are omitted per real-data-only policy. The exception is the instant 1:1 call
 * ("Connect now") rate, which is a real backend field (issue #808) and is shown when
 * the provider has the call enabled.
 */
export function FoundationProviderDetail({ provider, viewerUserId = null, onBack, onOpenDirectLine }: FoundationProviderDetailProps) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // You can't request a quote from your own profile — the server rejects a self-connection, so disable
  // the button here rather than let it fail with a generic error.
  const ownProfile = isOwnProfile(provider, viewerUserId);

  // Only offer "Connect now" when the provider opted in with a valid rate and the
  // viewer is not the provider themselves. Audio-only call. When the provider accepts
  // calls but this viewer can't be offered one (e.g. they're viewing their own profile),
  // show a passive availability badge instead so they can see the setting is live.
  const showConnectNow = canOfferConnectNow(provider, viewerUserId);
  const showAvailabilityBadge = !showConnectNow && acceptsInstantCalls(provider);
  const connectRateLabel = showConnectNow
    ? instantCallRateLabel(provider.instantCallRateCredits ?? 0, provider.instantCallIntervalMinutes ?? 0)
    : null;

  async function handleRequestQuote() {
    setSubmitting(true);
    setStatus(null);
    try {
      const thread = await createConnectionThread(provider.profileId);
      await requestQuote(thread.threadId);
      // Take the member straight into the Direct Line for the new thread (mirrors the web, which opens
      // the Direct Line right after a quote request). If the parent did not supply the navigation, fall
      // back to the confirmation message so the request is never lost.
      if (onOpenDirectLine) {
        onOpenDirectLine(thread.threadId, provider.displayName);
      } else {
        setStatus('Quote requested. Check back for a response.');
      }
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

        {/* Offered skills */}
        {provider.offeredSkills && provider.offeredSkills.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Willing to be contacted about</Text>
            <View style={styles.skillRow}>
              {provider.offeredSkills.map((skill) => (
                <View key={skill.id} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Connect now — live, paid 1:1 audio call (issue #808). Only shown when the
            provider has it enabled with a valid rate and the viewer is not them. */}
        {showConnectNow ? (
          <View style={styles.connectSection}>
            <ConnectNowButton provider={provider} />
            {connectRateLabel ? (
              <Text style={styles.connectHint}>
                Live audio call · {connectRateLabel}. The first block is charged when they answer.
              </Text>
            ) : null}
          </View>
        ) : showAvailabilityBadge ? (
          <View style={styles.connectSection}>
            <InstantCallAvailabilityBadge provider={provider} />
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn, (submitting || ownProfile) && styles.primaryBtnDisabled]}
            onPress={() => { void handleRequestQuote(); }}
            disabled={submitting || ownProfile}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Request Quote</Text>
            )}
          </TouchableOpacity>
          {ownProfile ? (
            <Text style={styles.ownProfileHint}>
              This is your own profile — you can&apos;t request a quote from yourself.
            </Text>
          ) : null}
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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    statusBar: {
      height: 44,
      backgroundColor: t.surfaceAlt,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    statusTime: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textPrimary,
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
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      gap: 12,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    backIcon: {
      color: accent,
      fontSize: 16,
    },
    backLabel: {
      color: accent,
      fontSize: 14,
      fontWeight: '600',
    },
    navTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
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
      backgroundColor: `${accent}25`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    avatarText: {
      color: accent,
      fontSize: 28,
      fontWeight: '800',
    },
    displayName: {
      fontSize: 20,
      fontWeight: '800',
      color: t.textPrimary,
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
      color: t.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    bioText: {
      fontSize: 14,
      color: TEXT_DIM,
      lineHeight: 22,
    },
    skillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skillChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: `${accent}12`,
      borderWidth: 1,
      borderColor: `${accent}30`,
    },
    skillChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: accent,
    },
    connectSection: {
      gap: 8,
      marginBottom: 16,
    },
    connectHint: {
      fontSize: 12,
      color: t.textSecondary,
      lineHeight: 18,
      textAlign: 'center',
    },
    actions: {
      gap: 10,
      marginBottom: 16,
    },
    actionBtn: {
      padding: 12,
      borderRadius: t.radius,
      alignItems: 'center',
    },
    primaryBtn: {
      backgroundColor: accent,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    ownProfileHint: {
      fontSize: 12,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 17,
    },
    statusMsg: {
      fontSize: 13,
      color: TEXT_DIM,
      textAlign: 'center',
      marginBottom: 16,
    },
    safetyBox: {
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: `${accent}08`,
      borderWidth: 1,
      borderColor: `${accent}18`,
    },
    safetyTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: accent,
      marginBottom: 6,
    },
    safetyBody: {
      fontSize: 12,
      color: t.textSecondary,
      lineHeight: 19,
    },
  });
}
