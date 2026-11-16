'use client';

import type { ReactNode } from 'react';
import { Flag } from 'lucide-react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import {
  dailyCreditStatusLabel,
  type DailyCreditLogRow,
  type DailyCreditSummaries,
} from 'lib/today/daily-credit/audit-summary';
import type { NameOf } from 'lib/today/daily-credit/audit-text';

const FLAG = '#F59E0B';

const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

function Card({ t, flagged, children }: { t: PluginShellTokens; flagged?: boolean; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${flagged ? FLAG : t.BORDER_SOLID}`, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Line({ t, label, children }: { t: PluginShellTokens; label: string; children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: t.TEXT, lineHeight: 1.55 }}>
      <span style={{ color: t.SUBTLE }}>{label}: </span>
      {children}
    </div>
  );
}

function pickedNote(row: DailyCreditLogRow): string {
  if (row.pickedFirst) return 'first to answer';
  return row.pickedAnswered ? 'not the first to answer' : 'did not answer I can help';
}

export function DailyCreditRowCard({ t, row, nameOf }: { t: PluginShellTokens; row: DailyCreditLogRow; nameOf: NameOf }) {
  return (
    <Card t={t} flagged={row.flagged}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{row.day}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: row.creditStatus === 'held' ? FLAG : t.ACCENT }}>{dailyCreditStatusLabel(row)}</span>
      </div>
      <div style={{ fontSize: 11, color: t.FAINT, marginBottom: 6, wordBreak: 'break-all' }}>Card {row.cardId}</div>
      <Line t={t} label="Asker">{nameOf(row.askerUserId)}</Line>
      <Line t={t} label="I can help">
        {row.helpers.length === 0 ? 'nobody' : row.helpers.map((helper, index) => `${index + 1}. ${nameOf(helper.userId)}`).join(', ')}
      </Line>
      <Line t={t} label="Picked">
        {row.pickedUserId ? `${nameOf(row.pickedUserId)} (${pickedNote(row)}) ${when(row.confirmedAt)}` : 'nobody yet'}
      </Line>
      {row.grantedAt ? <Line t={t} label="Granted">{when(row.grantedAt)}</Line> : null}
      {row.flagged ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FLAG, marginTop: 6 }}>
          <Flag size={12} aria-hidden="true" />
          This asker picked this helper {row.pairCount} times.
        </div>
      ) : null}
    </Card>
  );
}

function Section({ t, title, explanation, empty, children }: { t: PluginShellTokens; title: string; explanation: string; empty: boolean; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>{title}</h2>
      <p style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.55, margin: '0 0 10px' }}>{explanation}</p>
      {empty ? (
        <div style={{ fontSize: 12, color: t.FAINT, padding: '10px 14px', borderRadius: 10, border: `1px dashed ${t.BORDER_SOLID}` }}>Nothing here yet.</div>
      ) : (
        children
      )}
    </section>
  );
}

export function DailyCreditSummarySections({ t, summaries, nameOf }: { t: PluginShellTokens; summaries: DailyCreditSummaries; nameOf: NameOf }) {
  return (
    <>
      <Section
        t={t}
        title="Same helper three or more times"
        explanation="An asker who gave the day's credit to the same member three or more times. Friends do help each other; this is a question to look at, not a finding."
        empty={summaries.repeatPairs.length === 0}
      >
        {summaries.repeatPairs.map((pair) => (
          <Card key={`${pair.askerUserId}-${pair.helperUserId}`} t={t} flagged>
            <div style={{ fontSize: 13, color: t.TEXT }}>
              {nameOf(pair.askerUserId)} → {nameOf(pair.helperUserId)}: {pair.count} times
            </div>
          </Card>
        ))}
      </Section>
      <Section
        t={t}
        title="Askers"
        explanation="Every asker who closed a credit card: how many they closed, how many different members they picked, and how often they picked somebody other than the first to answer I can help."
        empty={summaries.askers.length === 0}
      >
        {summaries.askers.map((entry) => (
          <Card key={entry.askerUserId} t={t}>
            <div style={{ fontSize: 13, color: t.TEXT }}>{nameOf(entry.askerUserId)}</div>
            <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>
              {entry.closed} closed · {entry.distinctHelpers} different helpers · {entry.pickedNotFirst} not the first to answer
            </div>
          </Card>
        ))}
      </Section>
      <Section
        t={t}
        title="Helpers"
        explanation="Every member picked as the helper: credits granted, credits held until their Unlock is approved, and how many different askers picked them."
        empty={summaries.helpers.length === 0}
      >
        {summaries.helpers.map((entry) => (
          <Card key={entry.helperUserId} t={t}>
            <div style={{ fontSize: 13, color: t.TEXT }}>{nameOf(entry.helperUserId)}</div>
            <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>
              {entry.granted} granted · {entry.held} held · from {entry.distinctAskers} different askers
            </div>
          </Card>
        ))}
      </Section>
    </>
  );
}
