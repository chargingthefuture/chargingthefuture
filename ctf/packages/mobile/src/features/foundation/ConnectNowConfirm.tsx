// The "Connect now" confirmation: the rate per block, a limit on how many blocks the call may use, and
// an agreement switch before the ring is placed. Mirrors the web ConnectNowDialog
// (foundation-connect-now.tsx): same block choices, same default, same order of steps. The wording
// describes credits as sent, never as money (CLAUDE.md, "Credits Are Not Money").
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  BLOCK_CAP_OPTIONS,
  DEFAULT_AUTHORIZED_BLOCKS,
  blocksLabel,
  creditsLabel,
  rateLabel,
  type ProviderCallSettings,
} from './FoundationApi';
import { useFoundationCall } from './FoundationCallController';
import { FDButton } from './FDButton';
import { useFDTheme } from './useFDTheme';

function BlockChoices({ value, interval, onChange }: { value: number; interval: number; onChange: (_n: number) => void }) {
  const { tokens, accent } = useFDTheme();
  return (
    <View style={styles.chips}>
      {BLOCK_CAP_OPTIONS.map((n) => {
        const selected = n === value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${blocksLabel(n)}, up to ${n * interval} minutes`}
            style={[styles.chip, { borderRadius: tokens.radiusControl, borderColor: selected ? accent : tokens.border, backgroundColor: selected ? `${accent}22` : 'transparent' }]}
          >
            <Text style={[styles.chipText, { color: selected ? tokens.textPrimary : tokens.textSecondary }]}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function useStart(provider: ProviderCallSettings, blocks: number, onClose: () => void) {
  const controller = useFoundationCall();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (!controller || starting) return;
    setStarting(true);
    setError(null);
    const result = await controller.startCall({
      providerProfileId: provider.profileId,
      providerName: provider.displayName,
      rateCredits: provider.instantCallRateCredits ?? 0,
      intervalMinutes: provider.instantCallIntervalMinutes,
      authorizedBlocks: blocks,
    });
    setStarting(false);
    if ('error' in result) setError(result.error);
    else onClose();
  };
  return { start, starting, error, ready: controller !== null };
}

export function ConnectNowConfirm({ provider, onClose }: { provider: ProviderCallSettings; onClose: () => void }) {
  const { tokens, accent } = useFDTheme();
  const [blocks, setBlocks] = useState(DEFAULT_AUTHORIZED_BLOCKS);
  const [agreed, setAgreed] = useState(false);
  const { start, starting, error, ready } = useStart(provider, blocks, onClose);
  const rate = provider.instantCallRateCredits ?? 0;
  const interval = provider.instantCallIntervalMinutes;
  const rateText = rateLabel(rate, interval);
  const most = creditsLabel(rate * blocks);
  const text = { color: tokens.textSecondary };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={[styles.card, { backgroundColor: tokens.surface, borderColor: accent, borderRadius: tokens.radius }]} contentContainerStyle={styles.cardBody}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Connect now</Text>
          <Text style={[styles.body, text]}>Start a live 1:1 audio call with {provider.displayName} right now.</Text>
          <Text style={[styles.caption, { color: tokens.textMuted }]}>RATE</Text>
          <Text style={[styles.rate, { color: accent }]}>{rateText}</Text>
          <Text style={[styles.body, text]}>
            You send this for each {interval}-minute block. The first block is sent when {provider.displayName} answers. You can end the call anytime.
          </Text>
          <Text style={[styles.caption, { color: tokens.textMuted }]}>BLOCK LIMIT</Text>
          <BlockChoices value={blocks} interval={interval} onChange={setBlocks} />
          <Text style={[styles.body, text]}>
            The call will not run past {blocksLabel(blocks)} (up to {blocks * interval} min). At most {most} is sent.
          </Text>
          <View style={styles.agreeRow}>
            <Switch value={agreed} onValueChange={setAgreed} trackColor={{ true: accent, false: tokens.border }} accessibilityLabel="Agree to send credits for this call" />
            <Text style={[styles.body, styles.agreeText, { color: tokens.textPrimary }]}>
              I agree to send {rateText} for this call, up to {most}.
            </Text>
          </View>
          {error ? <Text style={[styles.body, { color: tokens.danger }]} accessibilityRole="alert">{error}</Text> : null}
          <FDButton wide variant="primary" label={starting ? 'Starting…' : 'Start call'} disabled={!agreed || starting || !ready} onPress={() => void start()} />
          <FDButton wide label="Cancel" onPress={onClose} disabled={starting} />
          <Text style={[styles.small, text]}>Ringing sends nothing. Only the blocks you use, up to your limit, are sent.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,9,13,0.72)', justifyContent: 'center', padding: 16 },
  card: { borderWidth: 1, maxHeight: '92%' },
  cardBody: { padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  rate: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 13.5, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 14, fontWeight: '700' },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agreeText: { flex: 1 },
});
