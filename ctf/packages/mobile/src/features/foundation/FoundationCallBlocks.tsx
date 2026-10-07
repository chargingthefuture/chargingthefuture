// The live call's time line: elapsed time for both people, and for the caller the time left in the
// current block, blocks used out of the number they authorized, and Extend. Mirrors the web
// CallerBillingStrip (foundation-instant-call.tsx); the callee sends nothing, so sees only the time.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { InstantCall } from './FoundationApi';
import { FDButton } from './FDButton';
import { useFDTheme } from './useFDTheme';

// Inside this many seconds of the block running out, Extend is highlighted (the web EXTEND_PROMPT_SECONDS).
const EXTEND_PROMPT_SECONDS = 60;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function secondsBetween(fromMs: number, toIso: string | null, reverse: boolean): number | null {
  if (!toIso) return null;
  const at = new Date(toIso).getTime();
  if (!Number.isFinite(at)) return null;
  const diff = reverse ? fromMs - at : at - fromMs;
  return Math.max(0, Math.round(diff / 1000));
}

export function CallBlocks({ call, isCaller, rateCredits, extending, onExtend }: {
  call: InstantCall;
  isCaller: boolean;
  rateCredits: number;
  extending: boolean;
  onExtend: () => void;
}) {
  const { tokens } = useFDTheme();
  const now = useNow();
  const elapsed = secondsBetween(now, call.answeredAtIso, true);
  return (
    <View style={[styles.strip, { borderColor: tokens.border, borderRadius: tokens.radius, backgroundColor: tokens.surfaceAlt }]}>
      <View style={styles.row}>
        <Text style={[styles.caption, { color: tokens.textMuted }]}>ELAPSED</Text>
        <Text style={[styles.value, { color: tokens.textPrimary }]}>{elapsed === null ? '—' : formatClock(elapsed)}</Text>
      </View>
      {isCaller ? (
        <CallerBlocks call={call} now={now} rateCredits={rateCredits} extending={extending} onExtend={onExtend} />
      ) : null}
    </View>
  );
}

function callerBlockView(call: InstantCall, now: number, rateCredits: number) {
  const left = secondsBetween(now, call.paidThroughAtIso, false);
  const atCap = call.authorizedBlocks !== null && call.blocksCharged >= call.authorizedBlocks;
  return {
    left,
    atCap,
    nearEnd: left !== null && left <= EXTEND_PROMPT_SECONDS,
    used: call.authorizedBlocks === null ? `${call.blocksCharged} used` : `${call.blocksCharged} of ${call.authorizedBlocks} blocks`,
    extendText: rateCredits === 1 ? '1 credit' : `${rateCredits} credits`,
  };
}

function CallerBlocks({ call, now, rateCredits, extending, onExtend }: {
  call: InstantCall;
  now: number;
  rateCredits: number;
  extending: boolean;
  onExtend: () => void;
}) {
  const { tokens, accent } = useFDTheme();
  const { left, atCap, nearEnd, used, extendText } = callerBlockView(call, now, rateCredits);
  return (
    <>
      <View style={styles.row}>
        <Text style={[styles.caption, { color: tokens.textMuted }]}>THIS BLOCK</Text>
        <Text style={[styles.value, { color: nearEnd && !atCap ? accent : tokens.textPrimary }]}>{left === null ? '—' : formatClock(left)}</Text>
      </View>
      <Text style={[styles.note, { color: tokens.textSecondary }]}>{used}</Text>
      {atCap ? (
        <Text style={[styles.note, { color: tokens.textSecondary }]}>
          You have used all the blocks you authorized. The call ends when this block&apos;s time runs out.
        </Text>
      ) : (
        <FDButton
          wide
          label={extending ? 'Adding block…' : `Extend (+${extendText})`}
          variant={nearEnd ? 'primary' : 'plain'}
          disabled={extending}
          onPress={onExtend}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  strip: { borderWidth: 1, padding: 12, gap: 8, alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  value: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, lineHeight: 18 },
});
