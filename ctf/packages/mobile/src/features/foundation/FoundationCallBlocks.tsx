// The caller's block strip during a live call, copied from the web CallerBillingStrip and ExtendButton
// (foundation-instant-call.tsx): time left in this block, blocks used of the number authorized, and
// Extend. The callee sends nothing, so does not see it, as on the web.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { InstantCall } from './FoundationApi';
import { FDButton, looks } from './FDButton';
import { Caption } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';

// Inside this many seconds of the block running out, Extend is highlighted (the web EXTEND_PROMPT_SECONDS).
const EXTEND_PROMPT_SECONDS = 60;

function useSecondsUntil(iso: string | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) {
      setLeft(null);
      return;
    }
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Number.isFinite(target) ? Math.max(0, Math.round((target - Date.now()) / 1000)) : null);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return left;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

function blockView(call: InstantCall, left: number | null, rateCredits: number) {
  const atCap = call.authorizedBlocks !== null && call.blocksCharged >= call.authorizedBlocks;
  const nearEnd = left !== null && left <= EXTEND_PROMPT_SECONDS;
  return {
    atCap,
    nearEnd,
    highlight: nearEnd && !atCap,
    clock: left === null ? '—' : formatCountdown(left),
    // "N used" where the web says "N paid": credits are not money (CLAUDE.md).
    capText: call.authorizedBlocks === null ? `${call.blocksCharged} used` : `${call.blocksCharged} of ${call.authorizedBlocks} blocks`,
    extendText: rateCredits === 1 ? '1 credit' : `${rateCredits} credits`,
  };
}

export function CallBlocks({ call, rateCredits, extending, onExtend }: {
  call: InstantCall;
  rateCredits: number;
  extending: boolean;
  onExtend: () => void;
}) {
  const { t, r } = useFDTheme();
  const { atCap, nearEnd, highlight, clock, capText, extendText } = blockView(call, useSecondsUntil(call.paidThroughAtIso), rateCredits);
  return (
    <View style={[styles.strip, { borderRadius: r(12), backgroundColor: t.INPUT_BG, borderColor: highlight ? alpha(t.ACCENT, '55') : t.BORDER_HI }]}>
      <View style={styles.row}>
        <View>
          <Caption text="This block" color={t.MUTED} />
          <Text style={[font(22, '800'), styles.clock, { color: highlight ? t.ACCENT : t.TITLE }]}>{clock}</Text>
        </View>
        <Text style={[font(12.5), styles.cap, { color: t.SUBTLE }]}>{capText}</Text>
      </View>
      {atCap ? (
        <Text style={[font(12.5), styles.note, { color: t.SUBTLE }]}>
          You&apos;ve used all the blocks you authorized. The call will end when this block&apos;s time runs out.
        </Text>
      ) : (
        <FDButton
          wide
          label={extending ? 'Adding block…' : `Extend (+${extendText})`}
          disabled={extending}
          dimmed={0.6}
          look={nearEnd ? looks(t).primary : looks(t).neutral}
          pad={[10, 16]}
          radius={10}
          size={13.5}
          onPress={onExtend}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { alignSelf: 'stretch', borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  clock: { fontVariant: ['tabular-nums'] },
  cap: { textAlign: 'right' },
  note: { lineHeight: 19 },
});
