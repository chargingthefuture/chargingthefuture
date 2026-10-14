// The cards on the live audio usage screen, copied from the web (web components/chyme/
// chyme-stream-usage-shell.tsx): this month, right now, by surface, day by day, and the settings.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { UsagePayload } from './chyme-admin-api';
import type { ChymeTokens } from './chyme-tokens';
import {
  BAND_COLOR,
  BAND_LABEL,
  DAY_RANGES,
  DAY_RANGE_PILL,
  DAY_RANGE_TITLE,
  ONE_PERSON_ALL_DAY_MINUTES,
  daysInRange,
  formatMinutes,
  monthShare,
  surfaceLabel,
  type DayRange,
} from './chyme-usage-text';

export function SectionTitle({ children, t }: { children: React.ReactNode; t: ChymeTokens }) {
  return <Text style={[styles.sectionTitle, { color: t.SUBTLE }]}>{children}</Text>;
}

export function Section({ children, t }: { children: React.ReactNode; t: ChymeTokens }) {
  return <View style={[styles.section, { borderRadius: t.radius(14), borderColor: t.BORDER }]}>{children}</View>;
}

export function MonthSection({ usage, t }: { usage: UsagePayload['usage']; t: ChymeTokens }) {
  const bandColor = BAND_COLOR[usage.band];
  const barWidth = Math.min(100, Math.max(0, usage.percentUsed));
  return (
    <Section t={t}>
      <SectionTitle t={t}>This month · day {usage.daysElapsed} of {usage.daysInMonth}</SectionTitle>
      <Text style={[styles.big, { color: t.TEXT }]}>
        {formatMinutes(usage.usedMinutes)}
        <Text style={[styles.bigUnit, { color: t.SUBTLE }]}> of {formatMinutes(usage.budgetMinutes)} minutes</Text>
      </Text>
      <View style={[styles.bar, { borderRadius: t.radius(5), backgroundColor: t.INPUT_BG }]}>
        <View style={{ width: `${barWidth}%`, height: '100%', backgroundColor: bandColor }} />
      </View>
      <Text style={[styles.bandLine, { color: bandColor }]}>
        {usage.percentUsed}% used · {BAND_LABEL[usage.band]}
      </Text>
      <Text style={[styles.body, styles.gap10, { color: t.SUBTLE }]}>
        Today so far: {formatMinutes(usage.todayMinutes)} minutes. At this month&apos;s daily average the month ends at about{' '}
        {formatMinutes(usage.projectedMonthMinutes)} minutes ({usage.projectedPercent}%).
      </Text>
    </Section>
  );
}

export function NowSection({ payload, t }: { payload: UsagePayload; t: ChymeTokens }) {
  const { room, policy } = payload;
  const text = [styles.line, { color: t.TEXT }];
  return (
    <Section t={t}>
      <SectionTitle t={t}>Right now</SectionTitle>
      <Text style={text}>
        <Text style={styles.strong}>{room.roomName}</Text>: {room.isLive ? 'live' : 'not live'} — {room.participantCount}{' '}
        {room.participantCount === 1 ? 'member' : 'members'}, {room.guestCount} signed-out {room.guestCount === 1 ? 'listener' : 'listeners'}
      </Text>
      <Text style={text}>Room cap in force: {policy.memberCap} members · guest cap: {policy.guestCap}</Text>
      <Text style={text}>
        Listening without an account: <Text style={styles.strong}>{policy.guestListenAllowed ? 'open' : 'paused'}</Text> · Back Channel:{' '}
        <Text style={styles.strong}>{policy.backChannelAllowed ? 'open' : 'paused'}</Text>
      </Text>
      {policy.memberNotice ? <Text style={[styles.line, styles.gap6, { color: BAND_COLOR[policy.band] }]}>Members see: “{policy.memberNotice}”</Text> : null}
    </Section>
  );
}

export function MinuteRows({ rows, t }: { rows: { key: string; label: string; minutes: number }[]; t: ChymeTokens }) {
  if (rows.length === 0) return <Text style={[styles.body, { color: t.SUBTLE }]}>Nothing recorded yet this month.</Text>;
  return (
    <View>
      {rows.map((row) => (
        <View key={row.key} style={styles.minuteRow}>
          <Text style={[styles.line, styles.shrink, { color: t.TEXT }]}>{row.label}</Text>
          <Text style={[styles.line, styles.tabular, { color: t.TEXT }]}>{formatMinutes(row.minutes)} min</Text>
        </View>
      ))}
    </View>
  );
}

export function SurfaceSection({ usage, t }: { usage: UsagePayload['usage']; t: ChymeTokens }) {
  return (
    <Section t={t}>
      <SectionTitle t={t}>This month by surface</SectionTitle>
      <MinuteRows rows={usage.bySurface.map((row) => ({ key: row.surface, label: surfaceLabel(row.surface), minutes: row.minutes }))} t={t} />
    </Section>
  );
}

export function DailySection({ usage, range, onRange, t }: { usage: UsagePayload['usage']; range: DayRange; onRange: (_next: DayRange) => void; t: ChymeTokens }) {
  const rows = daysInRange(usage, range);
  return (
    <Section t={t}>
      <SectionTitle t={t}>{DAY_RANGE_TITLE[range]}</SectionTitle>
      <View accessibilityLabel="How far back to show" style={styles.pills}>
        {DAY_RANGES.map((option) => {
          const active = option === range;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onRange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.pill, { borderRadius: t.radius(999), backgroundColor: active ? t.ACCENT : t.INPUT_BG, borderColor: active ? t.ACCENT : t.BORDER }]}
            >
              <Text style={[styles.pillText, { color: active ? '#0B0B0F' : t.SUBTLE }]}>{DAY_RANGE_PILL[option]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.small, { color: t.MUTED }]}>The meter keeps every day and never drops one. The record starts {usage.earliestDateIso}.</Text>
      <MinuteRows rows={rows.map((day) => ({ key: day.dateIso, label: day.dateIso, minutes: day.minutes }))} t={t} />
    </Section>
  );
}

export function SettingsSection({ payload, t }: { payload: UsagePayload; t: ChymeTokens }) {
  const { config } = payload;
  const line = [styles.line, { color: t.SUBTLE }];
  return (
    <Section t={t}>
      <SectionTitle t={t}>Settings in force</SectionTitle>
      <Text style={line}>Budget: {formatMinutes(config.budgetMinutes)} minutes a month (<Text style={styles.code}>STREAM_VIDEO_MINUTES_BUDGET</Text>)</Text>
      <Text style={line}>Room cap: {config.maxParticipants} members (<Text style={styles.code}>CHYME_MAX_PARTICIPANTS</Text>)</Text>
      <Text style={line}>Guest cap: {config.maxGuestListeners} listeners (<Text style={styles.code}>CHYME_MAX_GUEST_LISTENERS</Text>)</Text>
      <Text style={line}>Room cap in the Red band: {config.redBandMaxParticipants} members (<Text style={styles.code}>CHYME_RED_BAND_MAX_PARTICIPANTS</Text>)</Text>
      <Text style={[line, styles.gap6]}>
        One person in the room all day costs {formatMinutes(ONE_PERSON_ALL_DAY_MINUTES)} minutes — about {monthShare(payload)}% of the budget over an entire month.
      </Text>
    </Section>
  );
}

export const usageStyles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
});

const styles = StyleSheet.create({
  section: { borderWidth: 1, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 8, fontFamily: interFamily('700') },
  big: { fontSize: 28, lineHeight: 31, fontFamily: interFamily('800') },
  bigUnit: { fontSize: 14, fontFamily: interFamily('600') },
  bar: { height: 10, marginTop: 12, overflow: 'hidden' },
  bandLine: { marginTop: 8, fontSize: 13, fontFamily: interFamily('700') },
  body: usageStyles.body,
  gap10: { marginTop: 10 },
  gap6: { marginTop: 6 },
  line: { fontSize: 13, lineHeight: 22, fontFamily: interFamily('400') },
  strong: { fontFamily: interFamily('700') },
  minuteRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pill: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1 },
  pillText: { fontSize: 12, fontFamily: interFamily('700') },
  small: { fontSize: 12, marginBottom: 10, fontFamily: interFamily('400') },
  code: { fontFamily: 'monospace' },
});
