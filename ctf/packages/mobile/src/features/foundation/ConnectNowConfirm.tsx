// The "Connect now" confirmation, copied from the web ConnectNowDialog (foundation-connect-now.tsx):
// the rate box, the send limit picker, the agreement checkbox and Start call, in the same card and the
// same words.
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, PhoneCall, X } from 'lucide-react-native';
import { BLOCK_CAP_OPTIONS, DEFAULT_AUTHORIZED_BLOCKS, blocksLabel, creditsLabel, rateLabel } from './FoundationApi';
import type { ProviderView } from './FoundationDataApi';
import { useFoundationCall } from './FoundationCallController';
import { FDButton, looks } from './FDButton';
import { FDSelect } from './FDSelect';
import { Caption } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';

function useStart(provider: ProviderView, blocks: number, onClose: () => void) {
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

function Agreement({ checked, onToggle, text }: { checked: boolean; onToggle: () => void; text: string }) {
  const { t, r } = useFDTheme();
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.agree}>
      <View style={[styles.box, { borderRadius: r(3), backgroundColor: checked ? t.ACCENT : 'transparent', borderColor: checked ? t.ACCENT : t.SUBTLE }]}>
        {checked ? <Check size={12} color="#1a1205" /> : null}
      </View>
      <Text style={[font(13), styles.agreeText]}>{text}</Text>
    </Pressable>
  );
}

function BlockLimit({ blocks, interval, rate, onChange }: { blocks: number; interval: number; rate: number; onChange: (_n: number) => void }) {
  const { t, r } = useFDTheme();
  return (
    <View style={styles.mb14}>
      <Caption text="Send limit" color={t.MUTED} style={styles.mb6} />
      <FDSelect
        label="Send limit"
        value={blocks}
        options={BLOCK_CAP_OPTIONS.map((n) => ({ value: n, label: `${blocksLabel(n)} · up to ${n * interval} min` }))}
        onChange={onChange}
        boxStyle={[styles.select, { borderRadius: r(10), backgroundColor: t.INPUT_BG }]}
        textStyle={[font(14, '600'), { color: t.TITLE }]}
      />
      <Text style={[font(12.5), styles.lh19, styles.mt6, { color: t.SUBTLE }]}>
        The call will not run past this limit. You&apos;ll send at most{' '}
        <Text style={[font(12.5, '700'), { color: t.TITLE }]}>{creditsLabel(rate * blocks)}</Text> ({blocksLabel(blocks)}, up to {interval * blocks} min).
      </Text>
    </View>
  );
}

export function ConnectNowConfirm({ provider, onClose }: { provider: ProviderView; onClose: () => void }) {
  const { t, r } = useFDTheme();
  const [blocks, setBlocks] = useState(DEFAULT_AUTHORIZED_BLOCKS);
  const [agreed, setAgreed] = useState(false);
  const { start, starting, error, ready } = useStart(provider, blocks, onClose);
  const rate = provider.instantCallRateCredits ?? 0;
  const interval = provider.instantCallIntervalMinutes;
  const rateText = rateLabel(rate, interval);
  const canStart = agreed && !starting && ready;
  const subtle = { color: t.SUBTLE };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable onPress={() => undefined} style={[styles.card, { borderColor: alpha(t.ACCENT, '30'), borderRadius: r(16) }]} accessibilityViewIsModal accessibilityLabel="Connect now confirmation">
          <ScrollView contentContainerStyle={styles.cardBody}>
            <View style={styles.head}>
              <PhoneCall size={18} color={t.ACCENT} />
              <Text style={[font(18, '800'), styles.flex, { color: t.TITLE }]}>Connect now</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
                <X size={18} color={t.SUBTLE} />
              </Pressable>
            </View>
            <Text style={[font(13.5), styles.lh22, styles.mb14, subtle]}>
              Start a live 1:1 call with <Text style={[font(13.5, '700'), { color: t.TITLE }]}>{provider.displayName}</Text> right now, for ServiceCredits.
            </Text>
            <View style={[styles.rateBox, { borderRadius: r(12), backgroundColor: alpha(t.ACCENT, '10'), borderColor: alpha(t.ACCENT, '28') }]}>
              <Caption text="Rate" color={t.MUTED} style={styles.mb6} />
              <Text style={[font(17, '800'), { color: t.ACCENT }]}>{rateText}</Text>
              <Text style={[font(12.5), styles.mt4, subtle]}>
                You send this rate for each {interval}-minute block. The first block is sent when {provider.displayName} answers. You can end the call anytime.
              </Text>
            </View>
            <BlockLimit blocks={blocks} interval={interval} rate={rate} onChange={setBlocks} />
            <Text style={[font(12.5), styles.lh21, styles.mb14, subtle]}>
              This starts a live 1:1 call. You&apos;ll send the provider&apos;s rate per block until you end it or reach your send limit. Only start a call you mean to send credits for.
            </Text>
            {error ? <Text style={[font(13), styles.lh19, styles.mb12, { color: '#F87171' }]} accessibilityRole="alert">{error}</Text> : null}
            <Agreement checked={agreed} onToggle={() => setAgreed((v) => !v)} text={`I understand this call uses ServiceCredits and I agree to send ${rateText}, up to ${creditsLabel(rate * blocks)}.`} />
            <FDButton
              wide
              label={starting ? 'Starting…' : 'Start call'}
              disabled={!canStart}
              look={canStart ? looks(t).primary : { bg: t.BORDER, border: t.BORDER_HI, color: t.MUTED }}
              pad={[12, 18]}
              radius={10}
              size={14}
              onPress={() => void start()}
            />
            <Text style={[font(12), styles.footer, subtle]}>
              The first block is sent when the provider answers. Ringing is free, and you only send credits for blocks you use up to your limit.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,9,13,0.72)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#11131A', borderWidth: 1, maxHeight: '100%', width: '100%', maxWidth: 440, alignSelf: 'center' },
  cardBody: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  flex: { flex: 1 },
  close: { padding: 4 },
  rateBox: { paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, marginBottom: 14 },
  select: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  agree: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  box: { width: 16, height: 16, marginTop: 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  agreeText: { flex: 1, color: '#D1D5DB', lineHeight: 19.5 },
  footer: { marginTop: 10, lineHeight: 19, textAlign: 'center' },
  mb6: { marginBottom: 6 },
  mb12: { marginBottom: 12 },
  mb14: { marginBottom: 14 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  lh19: { lineHeight: 19 },
  lh21: { lineHeight: 21 },
  lh22: { lineHeight: 22 },
});
