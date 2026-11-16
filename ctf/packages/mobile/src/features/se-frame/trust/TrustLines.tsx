// The trust lines on Android, the copy of the web's trust-lines.tsx and trust-read-view.tsx: on the
// member's own trust, their lines and then exactly the lines another member gets, made by the same
// function the route runs; on anybody else's, the one list the route answered. Never a score.

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_TRUST_WORDS as W, seTrustLineDate, seTrustLineText, summarizeTrustEvidenceForPeer, type SeThemeTokens, type SeTrustItem, type SeTrustView } from '@ctf/shared';
import { makeTrustStyles, type TrustStyles } from './trustStyles';
import type { TrustRead } from './useTrust';

type S = { s: TrustStyles; t: SeThemeTokens };

function Line({ s, t, item }: S & { item: SeTrustItem }) {
  const date = seTrustLineDate(item);
  const text = seTrustLineText(item);
  return (
    <View accessible accessibilityLabel={[text, date, item.details].filter(Boolean).join('. ')} style={s.line}>
      <View style={s.lineHead}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l5 5 9-10" stroke={t.btn} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={s.lineText}>{text}</Text>
        {date ? <Text style={s.date}>{date}</Text> : null}
      </View>
      {item.details ? <Text style={s.details}>{item.details}</Text> : null}
    </View>
  );
}

function Lines({ s, t, items }: S & { items: readonly SeTrustItem[] }) {
  return (
    <View accessibilityRole="list" style={s.lines}>
      {items.map((item, index) => (
        <Line key={`${item.type}-${index}`} s={s} t={t} item={item} />
      ))}
    </View>
  );
}

function Empty({ s, own }: { s: TrustStyles; own: boolean }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{W.emptyTitle}</Text>
      <Text style={s.soft}>{own ? W.emptyOwn : W.emptyOther}</Text>
      {own ? (
        <View accessibilityRole="list" style={s.lines}>
          {W.steps.map((step) => (
            <View key={step} style={s.step}>
              <View style={s.ring} />
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MembersSee({ s, t, evidence }: S & { evidence: readonly SeTrustItem[] }) {
  const rows = summarizeTrustEvidenceForPeer(evidence);
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.label}>
        {W.membersSee}
      </Text>
      <Text style={s.soft}>{W.membersSeeText}</Text>
      {rows.length === 0 ? <Text style={s.soft}>{W.membersSeeEmpty}</Text> : null}
      {rows.length > 0 ? <Text style={s.note}>{W.summaryNote}</Text> : null}
      {rows.length > 0 ? <Lines s={s} t={t} items={rows} /> : null}
    </View>
  );
}

function Ready({ s, t, view, own }: S & { view: SeTrustView; own: boolean }) {
  if (view.evidence.length === 0) return <Empty s={s} own={own} />;
  if (!own) {
    return (
      <>
        {view.disclosure === 'summary' ? <Text style={s.note}>{W.summaryNote}</Text> : null}
        <Lines s={s} t={t} items={view.evidence} />
      </>
    );
  }
  return (
    <>
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.label}>
          {W.yours}
        </Text>
        <Lines s={s} t={t} items={view.evidence} />
      </View>
      <MembersSee s={s} t={t} evidence={view.evidence} />
    </>
  );
}

// One trust read in every state: reading, locked by Unlock, failed with a way to try again, or the
// lines. Me → Trust and People's profile both show it.
export function TrustReadView({ t, read, own, onRetry }: { t: SeThemeTokens; read: TrustRead; own: boolean; onRetry: () => void }) {
  const s = useMemo(() => makeTrustStyles(t), [t]);
  if (read.kind === 'loading') {
    return (
      <Text accessibilityLiveRegion="polite" style={s.soft}>
        {W.loading}
      </Text>
    );
  }
  if (read.kind === 'locked') return <Text style={s.soft}>{W.locked}</Text>;
  if (read.kind === 'failed') {
    return (
      <Text accessibilityRole="alert" style={s.soft}>
        {read.message}{' '}
        <Text accessibilityRole="button" onPress={onRetry} style={s.retry}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  return <Ready s={s} t={t} view={read.view} own={own} />;
}
