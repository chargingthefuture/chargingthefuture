'use client';

import type { ReportNote, ReportRow, TrendReportView } from '../../lib/click-log/trend-report-view';
import {
  TREND_ACCENT,
  TREND_BORDER,
  TREND_SUBTLE,
  TREND_SURFACE,
  TREND_TEXT,
} from './click-log-trend-tokens';

// The repeated pieces of the owner trends screen: a stat tile, a counted row, a titled list of
// them, and the method statement. Split out of the screen itself (rule 116) so the screen file
// stays one component doing one job — fetching the report and laying its sections out.

export function ClickLogTrendStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '14px 16px',
        borderRadius: 12,
        background: TREND_SURFACE,
        border: `1px solid ${TREND_BORDER}`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: TREND_ACCENT }}>{value}</div>
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

export function ClickLogTrendRow({ row }: { row: ReportRow }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        background: TREND_SURFACE,
        border: `1px solid ${TREND_BORDER}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: TREND_TEXT }}>{row.label}</div>
        {row.detail && (
          <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 2 }}>{row.detail}</div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: TREND_ACCENT }}>{row.value}</div>
    </div>
  );
}

// One titled list. Renders nothing when it has no rows, so a report with no schemes tagged simply
// has no scheme heading rather than an empty box.
export function ClickLogTrendSection({
  title,
  hint,
  rows,
}: {
  title: string;
  hint?: string;
  rows: ReportRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TREND_TEXT, marginBottom: hint ? 4 : 8 }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: TREND_SUBTLE, marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <ClickLogTrendRow key={`${row.label}-${row.value}`} row={row} />
        ))}
      </div>
    </div>
  );
}

// The method statement, shown under the numbers on the screen and drawn into the shareable image
// from the same source. It is on the screen and not only in the image so the owner reads exactly
// what anyone they send the image to will read.
export function ClickLogTrendMethod({ notes }: { notes: ReportNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${TREND_BORDER}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TREND_TEXT, marginBottom: 10 }}>
        How this was collected, and what it cannot show
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {notes.map((note) => (
          <div key={note.heading}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TREND_ACCENT, marginBottom: 3 }}>
              {note.heading}
            </div>
            <div style={{ fontSize: 12, color: TREND_SUBTLE, lineHeight: 1.6 }}>{note.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Every counted section of the report, in reading order — or the empty state when no member has
// shared anything yet. Kept here rather than inline in the screen so the screen stays a component
// that fetches and lays out, with the section order and their hint copy in one place.
export function ClickLogTrendResults({ view }: { view: TrendReportView }) {
  if (view.days.length === 0) {
    return (
      <div style={{ marginTop: 16, padding: '40px 16px', borderRadius: 12, background: TREND_SURFACE, border: `1px solid ${TREND_BORDER}`, textAlign: 'center', color: TREND_SUBTLE, fontSize: 13, lineHeight: 1.6 }}>
        No shared incidents yet. Members control sharing from their ClickLog — nothing appears here
        until someone opts in.
      </div>
    );
  }
  return (
    <>
      <ClickLogTrendSection title="Days with shared incidents" rows={view.days} />
      <ClickLogTrendSection
        title="Countries"
        hint="Worked out from the area already on each incident, against a border table held inside the app — members are never asked, and nothing is sent anywhere. This is what separates one town reporting from several countries reporting."
        rows={view.countries}
      />
      <ClickLogTrendSection
        title="Areas (each about 11 km across)"
        hint="Where the shared incidents were logged, rounded to about 11 km. Incidents logged without a location are absent here and counted everywhere else."
        rows={view.areas}
      />
      {view.areasTruncatedLine && (
        <div style={{ marginTop: 8, fontSize: 11, color: TREND_SUBTLE }}>{view.areasTruncatedLine}</div>
      )}
      <ClickLogTrendSection
        title="Kinds of harm reported"
        hint="The problems rolled up into the kinds of harm an outside reader recognizes. An incident counts once per kind."
        rows={view.categories}
      />
      <ClickLogTrendSection title="Top problems" rows={view.problems} />
      <ClickLogTrendSection
        title="Top schemes"
        hint="Counts are not comparable between kinds: some schemes run continuously and can be reported almost any day, others are single operations."
        rows={view.schemes}
      />
      <ClickLogTrendSection
        title="Problem and scheme reported together"
        hint="Which method was tagged alongside which harm on the same incident. The most common combinations, at most twelve."
        rows={view.pairs}
      />
    </>
  );
}
