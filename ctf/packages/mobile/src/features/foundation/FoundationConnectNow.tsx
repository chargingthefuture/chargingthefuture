/**
 * FoundationConnectNow — the Android (React Native) "Connect now" entry point for a
 * Foundation provider (issue #808 tasks 3 and 4). It mirrors the web entry
 * (ctf/packages/web/components/foundation/foundation-connect-now.tsx): a button that
 * shows the rate and block length, and on tap opens a confirm sheet previewing the
 * worst-case cost, a spend-limit (block cap) selector, and a plain-language consent
 * line. On confirm it places a live audio ring through the instant-call controller.
 *
 * Display + REST only: this component starts a ring and shows the cost; the actual
 * charge and call lifecycle run server-side and are driven by the controller. The
 * button only renders when canOfferConnectNow is true.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Provider } from './api';
import { useInstantCall, type ConnectNowProvider } from './FoundationInstantCallController';

const COLOR = '#F59E0B';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const SUBTLE = '#6B7280';

// Whole ServiceCredits per block of N minutes, e.g. "5 ServiceCredits / 10 min".
// ServiceCredits is one joined word per the brand lexicon. Mirrors instantCallRateLabel
// on web.
export function instantCallRateLabel(rateCredits: number, intervalMinutes: number): string {
  const credits = rateCredits === 1 ? '1 ServiceCredit' : `${rateCredits} ServiceCredits`;
  return `${credits} / ${intervalMinutes} min`;
}

// True when this provider is reachable for an instant call at all: they opted in and set
// a valid whole-credit rate (>= 1). Viewer-independent — used to surface a passive
// "accepts 1:1 calls" badge to everyone, including the provider themselves. Mirrors
// acceptsInstantCalls on web.
export function acceptsInstantCalls(provider: Provider): boolean {
  if (!provider.instantCallEnabled) return false;
  const rate = provider.instantCallRateCredits;
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate < 1) return false;
  return true;
}

// True only when this provider is reachable for an instant call AND it should be
// offered to this viewer: they accept calls and the viewer is not the provider
// themselves (you cannot ring yourself). Mirrors canOfferConnectNow on web.
export function canOfferConnectNow(provider: Provider, viewerUserId: string | null): boolean {
  if (!acceptsInstantCalls(provider)) return false;
  if (viewerUserId && provider.providerUserId === viewerUserId) return false;
  return true;
}

// A passive, non-interactive pill stating the provider accepts live 1:1 calls and at what
// rate. Shown wherever "Connect now" can't be offered to this viewer but the provider still
// accepts calls — most importantly on their own profile. Caller gates on acceptsInstantCalls.
// Mirrors InstantCallAvailabilityBadge on web.
export const InstantCallAvailabilityBadge: React.FC<{ provider: Provider }> = ({ provider }) => {
  const rate = provider.instantCallRateCredits ?? 0;
  const interval = provider.instantCallIntervalMinutes ?? 0;
  const rateLabel = instantCallRateLabel(rate, interval);
  return (
    <View style={styles.availabilityBadge} accessibilityRole="text">
      <Text style={styles.availabilityIcon}>📞</Text>
      <Text style={styles.availabilityText}>Accepts live 1:1 calls</Text>
      <Text style={styles.availabilityRate}>· {rateLabel}</Text>
    </View>
  );
};

// The buyer pre-authorizes a maximum number of blocks at confirm time. The call can
// never run past this cap in v1. These selectable caps match the web entry; the
// default is 6 (the server default) and the max matches the server hard cap.
const BLOCK_CAP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];
const DEFAULT_BLOCK_CAP = 6;

export const ConnectNowButton: React.FC<{ provider: Provider }> = ({ provider }) => {
  const [open, setOpen] = useState(false);

  // canOfferConnectNow guarantees a numeric rate >= 1 before this renders, but narrow
  // defensively so the label never shows a null.
  const rate = provider.instantCallRateCredits ?? 0;
  const interval = provider.instantCallIntervalMinutes ?? 0;
  const rateLabel = instantCallRateLabel(rate, interval);

  return (
    <>
      <TouchableOpacity
        style={styles.connectBtn}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Connect now — ${rateLabel}`}
      >
        <Text style={styles.connectIcon}>📞</Text>
        <Text style={styles.connectText}>Connect now</Text>
        <Text style={styles.connectRate}>· {rateLabel}</Text>
      </TouchableOpacity>

      {open ? (
        <ConnectNowDialog
          provider={provider}
          rate={rate}
          interval={interval}
          rateLabel={rateLabel}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
};

const ConnectNowDialog: React.FC<{
  provider: Provider;
  rate: number;
  interval: number;
  rateLabel: string;
  onClose: () => void;
}> = ({ provider, rate, interval, rateLabel, onClose }) => {
  const providerName = provider.displayName;
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorizedBlocks, setAuthorizedBlocks] = useState(DEFAULT_BLOCK_CAP);
  const instantCall = useInstantCall();

  // The most the caller can be charged: rate per block times the authorized cap.
  const maxSpend = rate * authorizedBlocks;
  const maxSpendLabel = maxSpend === 1 ? '1 ServiceCredit' : `${maxSpend} ServiceCredits`;
  const maxMinutes = interval * authorizedBlocks;
  const canStart = consented && !starting && Boolean(instantCall);

  const onStart = async () => {
    if (!canStart || !instantCall) return;
    setStarting(true);
    setError(null);
    try {
      const connectProvider: ConnectNowProvider = {
        profileId: provider.profileId,
        displayName: providerName,
        instantCallRateCredits: rate,
        instantCallIntervalMinutes: interval,
      };
      const result = await instantCall.startCall(connectProvider, authorizedBlocks);
      if (result.ok === true) {
        onClose();
      } else {
        setError(result.error);
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.cardScroll}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Connect now</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.intro}>
              Start a live, paid 1:1 call with <Text style={styles.introStrong}>{providerName}</Text> right now.
            </Text>

            <View style={styles.rateBox}>
              <Text style={styles.rateBoxLabel}>Rate</Text>
              <Text style={styles.rateBoxValue}>{rateLabel}</Text>
              <Text style={styles.rateBoxNote}>
                You&apos;re charged this rate for each {interval}-minute block. The first block is charged when{' '}
                {providerName} answers. You can end the call anytime.
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Spend limit</Text>
            <View style={styles.capRow}>
              {BLOCK_CAP_OPTIONS.map((n) => {
                const on = n === authorizedBlocks;
                return (
                  <Pressable
                    key={n}
                    style={[styles.capChip, on ? styles.capChipOn : null]}
                    onPress={() => setAuthorizedBlocks(n)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${n === 1 ? '1 block' : `${n} blocks`}, up to ${n * interval} minutes`}
                  >
                    <Text style={[styles.capChipText, on ? styles.capChipTextOn : null]}>
                      {n === 1 ? '1 block' : `${n} blocks`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helpText}>
              The call will not run past this limit. You&apos;ll be charged for at most{' '}
              <Text style={styles.helpStrong}>{maxSpendLabel}</Text> ({authorizedBlocks === 1 ? '1 block' : `${authorizedBlocks} blocks`}, up to{' '}
              {maxMinutes} min).
            </Text>

            <Text style={styles.disclaimer}>
              This starts a live 1:1 call. You&apos;ll be charged the provider&apos;s rate per block until you end
              it or reach your spend limit. Only start a call you mean to pay for.
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={styles.consentRow}
              onPress={() => setConsented((c) => !c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consented }}
            >
              <View style={[styles.checkbox, consented ? styles.checkboxOn : null]}>
                {consented ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.consentText}>
                I understand this is a paid call and I agree to be charged {rateLabel}, up to {maxSpendLabel}.
              </Text>
            </Pressable>

            <TouchableOpacity
              style={[styles.startBtn, canStart ? styles.startBtnOn : styles.startBtnOff]}
              onPress={() => void onStart()}
              disabled={!canStart}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canStart }}
              accessibilityLabel="Start call"
            >
              <Text style={[styles.startText, canStart ? styles.startTextOn : styles.startTextOff]}>
                {starting ? 'Starting…' : 'Start call'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>
              The first block is charged when the provider answers. Ringing is free, and you only pay for blocks
              you use up to your limit.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLOR,
  },
  connectIcon: { fontSize: 15 },
  connectText: { color: '#1a1205', fontSize: 14, fontWeight: '700' },
  connectRate: { color: '#1a1205', fontSize: 13, fontWeight: '600', opacity: 0.85 },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: `${COLOR}12`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
  },
  availabilityIcon: { fontSize: 14 },
  availabilityText: { color: COLOR, fontSize: 13.5, fontWeight: '600' },
  availabilityRate: { color: COLOR, fontSize: 13, fontWeight: '600', opacity: 0.85 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,13,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: '#11131A',
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    borderRadius: 16,
  },
  cardScroll: { padding: 22 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  closeIcon: { fontSize: 24, color: TEXT_DIM, paddingHorizontal: 4 },
  intro: { fontSize: 13.5, color: TEXT_DIM, lineHeight: 21, marginBottom: 14 },
  introStrong: { color: TEXT, fontWeight: '700' },
  rateBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: `${COLOR}10`,
    borderWidth: 1,
    borderColor: `${COLOR}28`,
    marginBottom: 14,
  },
  rateBoxLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: SUBTLE, textTransform: 'uppercase', marginBottom: 6 },
  rateBoxValue: { fontSize: 17, fontWeight: '800', color: COLOR },
  rateBoxNote: { fontSize: 12.5, color: TEXT_DIM, marginTop: 4, lineHeight: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: SUBTLE, textTransform: 'uppercase', marginBottom: 8 },
  capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  capChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  capChipOn: { backgroundColor: `${COLOR}20`, borderColor: `${COLOR}55` },
  capChipText: { fontSize: 13, fontWeight: '600', color: TEXT_DIM },
  capChipTextOn: { color: COLOR },
  helpText: { fontSize: 12.5, color: TEXT_DIM, lineHeight: 18, marginBottom: 14 },
  helpStrong: { color: TEXT, fontWeight: '700' },
  disclaimer: { fontSize: 12.5, color: TEXT_DIM, lineHeight: 20, marginBottom: 14 },
  errorText: { fontSize: 13, color: '#F87171', lineHeight: 18, marginBottom: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: COLOR, borderColor: COLOR },
  checkboxMark: { color: '#1a1205', fontSize: 13, fontWeight: '800' },
  consentText: { flex: 1, fontSize: 13, color: '#D1D5DB', lineHeight: 19 },
  startBtn: { width: '100%', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  startBtnOn: { backgroundColor: COLOR },
  startBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  startText: { fontSize: 14, fontWeight: '700' },
  startTextOn: { color: '#1a1205' },
  startTextOff: { color: SUBTLE },
  footerNote: { marginTop: 10, fontSize: 12, color: TEXT_DIM, lineHeight: 18, textAlign: 'center' },
});
